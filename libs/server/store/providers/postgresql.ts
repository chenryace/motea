import { Pool, PoolClient } from 'pg';
import { StoreProvider, ObjectOptions } from './base';
import { createLogger } from 'libs/server/debugging';

export interface PostgreSQLConfig {
    connectionString: string;
    prefix?: string;
}

interface NoteRecord {
    id: string;
    path: string;
    content: string;
    content_type: string;
    metadata: Record<string, string>;
    created_at: Date;
    updated_at: Date;
}

interface TreeRecord {
    id: string;
    data: string; // JSON string
    created_at: Date;
    updated_at: Date;
}

export class StorePostgreSQL extends StoreProvider {
    private pool: Pool;
    private logger = createLogger('store.postgresql');
    private tablesInitialized = false;

    constructor(config: PostgreSQLConfig) {
        super(config);
        this.pool = new Pool({
            connectionString: config.connectionString,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 3, // 稍微增加连接数以提高并发性能
            idleTimeoutMillis: 30000, // 增加空闲超时
            connectionTimeoutMillis: 5000, // 减少连接超时
            statement_timeout: 10000, // 添加语句超时
        });
    }

    private async ensureTablesInitialized(): Promise<void> {
        if (this.tablesInitialized) {
            return;
        }

        const client = await this.pool.connect();
        try {
            // Create notes table
            await client.query(`
                CREATE TABLE IF NOT EXISTS notes (
                    id VARCHAR(255) PRIMARY KEY,
                    path VARCHAR(500) UNIQUE NOT NULL,
                    content TEXT,
                    content_type VARCHAR(100) DEFAULT 'text/markdown',
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `);

            // Create tree table for storing tree structure
            await client.query(`
                CREATE TABLE IF NOT EXISTS tree_data (
                    id VARCHAR(255) PRIMARY KEY DEFAULT 'main',
                    data JSONB NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `);

            // Create performance indexes
            await this.createPerformanceIndexes(client);

            this.tablesInitialized = true;
            this.logger.info('Database tables initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize database tables:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    private async createPerformanceIndexes(client: any): Promise<void> {
        const indexes = [
            // 基础查询索引
            'CREATE INDEX IF NOT EXISTS idx_notes_path ON notes(path)',
            'CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_notes_id ON notes(id)',

            // 元数据查询索引（用于树结构和搜索）
            'CREATE INDEX IF NOT EXISTS idx_notes_metadata_gin ON notes USING GIN(metadata)',

            // 特定元数据字段索引（提升常用查询性能）
            'CREATE INDEX IF NOT EXISTS idx_notes_metadata_pid ON notes((metadata->>\'pid\'))',
            'CREATE INDEX IF NOT EXISTS idx_notes_metadata_title ON notes((metadata->>\'title\'))',

            // 每日笔记查询索引
            'CREATE INDEX IF NOT EXISTS idx_notes_daily ON notes((metadata->>\'isDailyNote\')) WHERE metadata->>\'isDailyNote\' = \'true\'',

            // 内容搜索索引（全文搜索）
            'CREATE INDEX IF NOT EXISTS idx_notes_content_search ON notes USING GIN(to_tsvector(\'english\', COALESCE(content, \'\')))',

            // 树结构查询索引
            'CREATE INDEX IF NOT EXISTS idx_tree_data_updated_at ON tree_data(updated_at DESC)',
        ];

        for (const indexQuery of indexes) {
            try {
                await client.query(indexQuery);
                const indexName = indexQuery.match(/idx_\w+/)?.[0] || 'unknown';
                this.logger.debug('Created/verified index:', indexName);
            } catch (error) {
                // 索引可能已存在或有其他问题，记录但不中断初始化
                this.logger.warn('Index creation warning:', error instanceof Error ? error.message : String(error));
            }
        }
    }

    async getSignUrl(_path: string, _expires = 600): Promise<string | null> {
        // PostgreSQL doesn't support signed URLs like S3
        // Return null to indicate this feature is not available
        return null;
    }

    async hasObject(path: string): Promise<boolean> {
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT 1 FROM notes WHERE path = $1',
                [this.getPath(path)]
            );
            return result.rows.length > 0;
        } catch (error) {
            this.logger.error('Error checking if object exists:', error);
            return false;
        } finally {
            client.release();
        }
    }

    async getObject(path: string, _isCompressed = false): Promise<string | undefined> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT content FROM notes WHERE path = $1',
                [this.getPath(path)]
            );

            if (result.rows.length === 0) {
                return undefined;
            }

            return result.rows[0].content;
        } catch (error) {
            this.logger.error('Error getting object:', error);
            return undefined;
        } finally {
            client.release();
        }
    }

    async getObjectMeta(path: string): Promise<{ [key: string]: string } | undefined> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT metadata FROM notes WHERE path = $1',
                [this.getPath(path)]
            );

            if (result.rows.length === 0) {
                return undefined;
            }

            return result.rows[0].metadata || {};
        } catch (error) {
            this.logger.error('Error getting object metadata:', error);
            return undefined;
        } finally {
            client.release();
        }
    }

    async getObjectAndMeta(
        path: string,
        _isCompressed = false
    ): Promise<{
        content?: string;
        meta?: { [key: string]: string };
        contentType?: string;
        buffer?: Buffer;
        updated_at?: string;
    }> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT content, metadata, content_type, updated_at FROM notes WHERE path = $1',
                [this.getPath(path)]
            );

            if (result.rows.length === 0) {
                return {};
            }

            const row = result.rows[0];
            return {
                content: row.content,
                meta: row.metadata || {},
                contentType: row.content_type,
                updated_at: row.updated_at ? row.updated_at.toISOString() : undefined,
            };
        } catch (error) {
            this.logger.error('Error getting object and metadata:', error);
            return {};
        } finally {
            client.release();
        }
    }

    async putObject(
        path: string,
        raw: string | Buffer,
        options?: ObjectOptions,
        _isCompressed?: boolean
    ): Promise<void> {
        await this.ensureTablesInitialized();
        const client = await this.pool.connect();
        try {
            const content = Buffer.isBuffer(raw) ? raw.toString('utf-8') : raw;
            const fullPath = this.getPath(path);

            // 检查是否是笔记路径（需要ID）还是其他数据（如设置，不需要ID）
            const isNotePath = path.startsWith('notes/');

            if (isNotePath) {
                // 笔记数据：从metadata中提取ID
                const metadata = options?.meta || {};
                const noteId = metadata.id;

                if (!noteId) {
                    throw new Error('Note ID is required in metadata for notes');
                }

                // 创建不包含ID的metadata副本
                const metadataWithoutId = { ...metadata };
                delete metadataWithoutId.id;

                await client.query(`
                    INSERT INTO notes (id, path, content, content_type, metadata, updated_at)
                    VALUES ($1, $2, $3, $4, $5, NOW())
                    ON CONFLICT (path)
                    DO UPDATE SET
                        content = EXCLUDED.content,
                        content_type = EXCLUDED.content_type,
                        metadata = EXCLUDED.metadata,
                        updated_at = NOW()
                `, [
                    noteId,
                    fullPath,
                    content,
                    options?.contentType || 'text/markdown',
                    JSON.stringify(metadataWithoutId)
                ]);

                this.logger.debug('Successfully put note:', fullPath, 'with ID:', noteId);
            } else {
                // 非笔记数据（如设置）：使用路径作为ID
                await client.query(`
                    INSERT INTO notes (id, path, content, content_type, metadata, updated_at)
                    VALUES ($1, $2, $3, $4, $5, NOW())
                    ON CONFLICT (path)
                    DO UPDATE SET
                        content = EXCLUDED.content,
                        content_type = EXCLUDED.content_type,
                        metadata = EXCLUDED.metadata,
                        updated_at = NOW()
                `, [
                    fullPath, // 使用完整路径作为ID
                    fullPath,
                    content,
                    options?.contentType || 'text/markdown',
                    JSON.stringify(options?.meta || {})
                ]);

                this.logger.debug('Successfully put non-note object:', fullPath);
            }
        } catch (error) {
            this.logger.error('Error putting object:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async deleteObject(path: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query(
                'DELETE FROM notes WHERE path = $1',
                [this.getPath(path)]
            );
            this.logger.debug('Successfully deleted object:', this.getPath(path));
        } catch (error) {
            this.logger.error('Error deleting object:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async copyObject(
        fromPath: string,
        toPath: string,
        options: ObjectOptions
    ): Promise<void> {
        const client = await this.pool.connect();
        try {
            const fullFromPath = this.getPath(fromPath);
            const fullToPath = this.getPath(toPath);

            // 从metadata中提取ID
            const metadata = options.meta || {};
            const noteId = metadata.id;

            // 创建不包含ID的metadata副本
            const metadataWithoutId = { ...metadata };
            delete metadataWithoutId.id;

            if (fullFromPath === fullToPath) {
                // Update metadata only
                await client.query(`
                    UPDATE notes
                    SET metadata = $2, content_type = $3, updated_at = NOW()
                    WHERE path = $1
                `, [
                    fullFromPath,
                    JSON.stringify(metadataWithoutId),
                    options.contentType || 'text/markdown'
                ]);
            } else {
                // Copy to new path
                if (!noteId) {
                    throw new Error('Note ID is required in metadata for copy operation');
                }

                await client.query(`
                    INSERT INTO notes (id, path, content, content_type, metadata, updated_at)
                    SELECT $3, $2, content, $4, $5, NOW()
                    FROM notes WHERE path = $1
                    ON CONFLICT (path)
                    DO UPDATE SET
                        content = EXCLUDED.content,
                        content_type = EXCLUDED.content_type,
                        metadata = EXCLUDED.metadata,
                        updated_at = NOW()
                `, [
                    fullFromPath,
                    fullToPath,
                    noteId,
                    options.contentType || 'text/markdown',
                    JSON.stringify(metadataWithoutId)
                ]);
            }

            this.logger.debug('Successfully copied object from', fullFromPath, 'to', fullToPath);
        } catch (error) {
            this.logger.error('Error copying object:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Tree-specific methods
    async getTree(): Promise<any> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT data FROM tree_data WHERE id = $1',
                ['main']
            );

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0].data;
        } catch (error) {
            this.logger.error('Error getting tree:', error);
            return null;
        } finally {
            client.release();
        }
    }

    async putTree(treeData: any): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query(`
                INSERT INTO tree_data (id, data, updated_at)
                VALUES ('main', $1, NOW())
                ON CONFLICT (id)
                DO UPDATE SET
                    data = EXCLUDED.data,
                    updated_at = NOW()
            `, [JSON.stringify(treeData)]);

            this.logger.debug('Successfully updated tree data');
        } catch (error) {
            this.logger.error('Error updating tree:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}
