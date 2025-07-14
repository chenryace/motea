/**
 * PostgreSQL Store Provider
 *
 * Copyright (c) 2025 waycaan
 * Licensed under the MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */

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

        // 🎯 智能环境检测
        const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
        const isDocker = !!(process.env.DOCKER || process.env.HOSTNAME === '0.0.0.0');
        const isProduction = process.env.NODE_ENV === 'production';

        // 🔧 根据部署环境智能配置连接池
        const poolConfig = this.getOptimalPoolConfig(isServerless, isDocker, isProduction);

        this.pool = new Pool({
            connectionString: config.connectionString,
            ssl: isProduction && !isDocker ? { rejectUnauthorized: false } : false,
            ...poolConfig,
        });

        // 📊 记录配置信息
        this.logger.info('PostgreSQL pool configured:', {
            environment: isServerless ? 'serverless' : isDocker ? 'docker' : 'traditional',
            maxConnections: poolConfig.max,
            minConnections: poolConfig.min || 0,
            idleTimeout: poolConfig.idleTimeoutMillis,
        });
    }

    /**
     * 根据部署环境获取最优连接池配置
     */
    private getOptimalPoolConfig(isServerless: boolean, isDocker: boolean, isProduction: boolean) {
        if (isServerless) {
            // Vercel/Serverless 环境：保守配置，避免超出 Neon 连接限制
            return {
                max: 2,                    // 最大2个连接，避免多个 Lambda 实例累积过多连接
                min: 0,                    // 最小0个，允许完全释放连接
                idleTimeoutMillis: 10000,  // 10秒快速释放，适应 Serverless 短生命周期
                connectionTimeoutMillis: 5000,
                statement_timeout: 8000,   // 稍短的语句超时，适应 Serverless 限制
            };
        } else if (isDocker) {
            // Docker 环境：激进配置，充分利用内建数据库性能
            return {
                max: isProduction ? 10 : 6,  // 生产环境更多连接，开发环境适中
                min: 2,                      // 保持最少2个连接，减少连接建立开销
                idleTimeoutMillis: 60000,    // 60秒保持连接，适应长期运行
                connectionTimeoutMillis: 5000,
                statement_timeout: 15000,    // 更长的语句超时，适应复杂查询
            };
        } else {
            // 传统部署：平衡配置
            return {
                max: isProduction ? 6 : 4,
                min: 1,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
                statement_timeout: 10000,
            };
        }
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
            'CREATE INDEX IF NOT EXISTS idx_notes_path ON notes(path)',
            'CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_notes_id ON notes(id)',

            'CREATE INDEX IF NOT EXISTS idx_notes_metadata_gin ON notes USING GIN(metadata)',

            'CREATE INDEX IF NOT EXISTS idx_notes_metadata_pid ON notes((metadata->>\'pid\'))',
            'CREATE INDEX IF NOT EXISTS idx_notes_metadata_title ON notes((metadata->>\'title\'))',

            'CREATE INDEX IF NOT EXISTS idx_notes_daily ON notes((metadata->>\'isDailyNote\')) WHERE metadata->>\'isDailyNote\' = \'true\'',

            'CREATE INDEX IF NOT EXISTS idx_notes_content_search ON notes USING GIN(to_tsvector(\'english\', COALESCE(content, \'\')))',

            'CREATE INDEX IF NOT EXISTS idx_tree_data_updated_at ON tree_data(updated_at DESC)',
        ];

        for (const indexQuery of indexes) {
            try {
                await client.query(indexQuery);
                const indexName = indexQuery.match(/idx_\w+/)?.[0] || 'unknown';
                this.logger.debug('Created/verified index:', indexName);
            } catch (error) {
                this.logger.warn('Index creation warning:', error instanceof Error ? error.message : String(error));
            }
        }
    }

    async getSignUrl(_path: string, _expires = 600): Promise<string | null> {
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
            const isNotePath = path.startsWith('notes/');

            if (isNotePath) {
                const metadata = options?.meta || {};
                const noteId = metadata.id;

                if (!noteId) {
                    throw new Error('Note ID is required in metadata for notes');
                }

                const metadataWithoutId = { ...metadata };
                delete metadataWithoutId.id;

                // 检测内容格式并设置默认 content type
                const defaultContentType = content && content.trim().startsWith('{') && content.trim().endsWith('}')
                    ? 'application/json'
                    : 'text/markdown';

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
                    options?.contentType || defaultContentType,
                    JSON.stringify(metadataWithoutId)
                ]);

                this.logger.debug('Successfully put note:', fullPath, 'with ID:', noteId);
            } else {
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
                    fullPath, 
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

            const metadata = options.meta || {};
            const noteId = metadata.id;

            const metadataWithoutId = { ...metadata };
            delete metadataWithoutId.id;

            if (fullFromPath === fullToPath) {
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

    /**
     * 🚀 批量获取对象元数据 - 性能优化
     * 解决 N+1 查询问题，将多次查询合并为一次
     */
    async batchGetObjectMeta(paths: string[]): Promise<Array<{ [key: string]: string } | undefined>> {
        if (paths.length === 0) {
            return [];
        }

        const client = await this.pool.connect();
        try {
            // 🎯 使用 IN 查询批量获取元数据
            const placeholders = paths.map((_, index) => `$${index + 1}`).join(', ');
            const fullPaths = paths.map(path => this.getPath(path));

            const result = await client.query(
                `SELECT path, metadata FROM notes WHERE path IN (${placeholders}) ORDER BY path`,
                fullPaths
            );

            // 📊 创建路径到元数据的映射
            const metaMap = new Map<string, any>();
            result.rows.forEach(row => {
                metaMap.set(row.path, row.metadata || {});
            });

            // 🔄 按原始顺序返回结果，缺失的返回 undefined
            return fullPaths.map(fullPath => metaMap.get(fullPath));
        } catch (error) {
            this.logger.error('Error batch getting object metadata:', error);
            // 🛡️ 降级到单个查询
            return Promise.all(paths.map(path => this.getObjectMeta(path)));
        } finally {
            client.release();
        }
    }

    /**
     * 🚀 批量获取对象内容和元数据 - 性能优化
     */
    async batchGetObjectAndMeta(paths: string[]): Promise<Array<{
        content?: string;
        meta?: { [key: string]: string };
        contentType?: string;
        updated_at?: string;
    }>> {
        if (paths.length === 0) {
            return [];
        }

        const client = await this.pool.connect();
        try {
            const placeholders = paths.map((_, index) => `$${index + 1}`).join(', ');
            const fullPaths = paths.map(path => this.getPath(path));

            const result = await client.query(
                `SELECT path, content, metadata, content_type, updated_at
                 FROM notes
                 WHERE path IN (${placeholders})
                 ORDER BY path`,
                fullPaths
            );

            // 📊 创建路径到数据的映射
            const dataMap = new Map<string, any>();
            result.rows.forEach(row => {
                dataMap.set(row.path, {
                    content: row.content,
                    meta: row.metadata || {},
                    contentType: row.content_type,
                    updated_at: row.updated_at ? row.updated_at.toISOString() : undefined,
                });
            });

            // 🔄 按原始顺序返回结果，缺失的返回空对象
            return fullPaths.map(fullPath => dataMap.get(fullPath) || {});
        } catch (error) {
            this.logger.error('Error batch getting objects and metadata:', error);
            // 🛡️ 降级到单个查询
            return Promise.all(paths.map(path => this.getObjectAndMeta(path)));
        } finally {
            client.release();
        }
    }



    async close(): Promise<void> {
        await this.pool.end();
    }
}
