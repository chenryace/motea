export interface StoreProviderConfig {
    prefix?: string;
}

export interface ObjectOptions {
    meta?: { [key: string]: string };
    contentType?: string;
    headers?: {
        cacheControl?: string;
        contentDisposition?: string;
        contentEncoding?: string;
    };
}

export abstract class StoreProvider {
    constructor({ prefix }: StoreProviderConfig) {
        this.prefix = prefix?.replace(/\/$/, '');

        if (this.prefix) {
            this.prefix += '/';
        }
    }

    prefix?: string;

    getPath(...paths: string[]) {
        return this.prefix + paths.join('/');
    }

    /**
     * 获取签名 URL
     */
    abstract getSignUrl(path: string, expires: number): Promise<string | null>;

    /**
     * 检测对象是否存在
     */
    abstract hasObject(path: string): Promise<boolean>;

    /**
     * 获取对象内容
     * @returns content
     */
    abstract getObject(
        path: string,
        isCompressed?: boolean
    ): Promise<string | undefined>;

    /**
     * 获取对象 Meta
     * @returns meta
     */
    abstract getObjectMeta(
        path: string
    ): Promise<{ [key: string]: string } | undefined>;

    /**
     * 获取对象和对象 Meta
     * @returns [content, meta]
     */
    abstract getObjectAndMeta(
        path: string,
        isCompressed?: boolean
    ): Promise<{
        content?: string;
        meta?: { [key: string]: string };
        contentType?: string;
        buffer?: Buffer;
        updated_at?: string;
    }>;

    /**
     * 存储对象
     */
    abstract putObject(
        path: string,
        raw: string | Buffer,
        headers?: ObjectOptions,
        isCompressed?: boolean
    ): Promise<void>;

    /**
     * 删除对象
     */
    abstract deleteObject(path: string): Promise<void>;

    /**
     * 复制对象，可用于更新 meta
     */
    abstract copyObject(
        fromPath: string,
        toPath: string,
        options: ObjectOptions
    ): Promise<void>;

    /**
     * 🚀 批量获取对象元数据 - 性能优化
     * 默认实现：降级到单个查询，子类可以重写以提供更高效的实现
     */
    async batchGetObjectMeta(paths: string[]): Promise<Array<{ [key: string]: string } | undefined>> {
        return Promise.all(paths.map(path => this.getObjectMeta(path)));
    }

    /**
     * 🚀 批量获取对象内容和元数据 - 性能优化
     * 默认实现：降级到单个查询，子类可以重写以提供更高效的实现
     */
    async batchGetObjectAndMeta(paths: string[]): Promise<Array<{
        content?: string;
        meta?: { [key: string]: string };
        contentType?: string;
        buffer?: Buffer;
        updated_at?: string;
    }>> {
        return Promise.all(paths.map(path => this.getObjectAndMeta(path)));
    }
}
