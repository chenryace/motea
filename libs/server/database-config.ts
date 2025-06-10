// Database configuration mapping for motea
// Based on the open-source project Notea, originally created by qingwei-li<cinwell.li@gmail.com>
// Modified and maintained by waycaan, 2025.

export type DatabaseProvider = 'self-hosted' | 'supabase' | 'neon';

export interface DatabaseConfig {
    provider: DatabaseProvider;
    connectionString: string;
    ssl: boolean;
    poolConfig?: {
        max?: number;
        idleTimeoutMillis?: number;
        connectionTimeoutMillis?: number;
        statement_timeout?: number;
    };
}

export interface DatabaseProviderConfig {
    name: string;
    description: string;
    defaultSSL: boolean;
    urlPattern: RegExp;
    poolDefaults: {
        max: number;
        idleTimeoutMillis: number;
        connectionTimeoutMillis: number;
        statement_timeout: number;
    };
    envVars: {
        required: string[];
        optional: string[];
    };
    examples: {
        connectionString: string;
        description: string;
    }[];
}

export const DATABASE_PROVIDERS: Record<DatabaseProvider, DatabaseProviderConfig> = {
    'self-hosted': {
        name: 'Self-hosted PostgreSQL',
        description: 'Your own PostgreSQL server or local development database',
        defaultSSL: false,
        urlPattern: /^postgresql:\/\/.*$/,
        poolDefaults: {
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            statement_timeout: 10000,
        },
        envVars: {
            required: ['DATABASE_URL'],
            optional: ['DB_PROVIDER', 'STORE_PREFIX'],
        },
        examples: [
            {
                connectionString: 'postgresql://postgres:password@localhost:5432/motea',
                description: 'Local development database',
            },
            {
                connectionString: 'postgresql://user:password@your-server.com:5432/motea?sslmode=require',
                description: 'Remote PostgreSQL with SSL',
            },
            {
                connectionString: 'postgresql://postgres:password@postgres:5432/motea',
                description: 'Docker Compose PostgreSQL service',
            },
        ],
    },
    'neon': {
        name: 'Neon PostgreSQL',
        description: 'Serverless PostgreSQL from Neon.tech',
        defaultSSL: true,
        urlPattern: /^postgres:\/\/.*@.*\.neon\.tech\/.*$/,
        poolDefaults: {
            max: 3,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 8000,
            statement_timeout: 15000,
        },
        envVars: {
            required: ['DATABASE_URL'],
            optional: ['DB_PROVIDER', 'STORE_PREFIX'],
        },
        examples: [
            {
                connectionString: 'postgres://username:password@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require',
                description: 'Neon database in US East region (recommended for Vercel)',
            },
            {
                connectionString: 'postgres://username:password@ep-xxx.eu-central-1.aws.neon.tech/dbname?sslmode=require',
                description: 'Neon database in EU Central region',
            },
        ],
    },
    'supabase': {
        name: 'Supabase PostgreSQL',
        description: 'PostgreSQL from Supabase with additional features',
        defaultSSL: true,
        urlPattern: /^postgresql:\/\/.*@.*\.supabase\.co\/.*$/,
        poolDefaults: {
            max: 3,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 8000,
            statement_timeout: 15000,
        },
        envVars: {
            required: ['DATABASE_URL'],
            optional: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DB_PROVIDER', 'STORE_PREFIX'],
        },
        examples: [
            {
                connectionString: 'postgresql://postgres:password@db.xxx.supabase.co:5432/postgres',
                description: 'Direct PostgreSQL connection to Supabase',
            },
            {
                connectionString: 'postgresql://postgres:password@db.xxx.supabase.co:5432/postgres?sslmode=require',
                description: 'Supabase with explicit SSL requirement',
            },
        ],
    },
};

/**
 * Auto-detect database provider from connection string
 */
export function detectDatabaseProvider(connectionString: string): DatabaseProvider {
    for (const [provider, config] of Object.entries(DATABASE_PROVIDERS)) {
        if (config.urlPattern.test(connectionString)) {
            return provider as DatabaseProvider;
        }
    }
    return 'self-hosted';
}

/**
 * Get database configuration for a provider
 */
export function getDatabaseConfig(
    connectionString: string,
    explicitProvider?: string
): DatabaseConfig {
    const provider = (explicitProvider as DatabaseProvider) || detectDatabaseProvider(connectionString);
    const providerConfig = DATABASE_PROVIDERS[provider];

    return {
        provider,
        connectionString,
        ssl: providerConfig.defaultSSL || 
             connectionString.includes('sslmode=require') || 
             connectionString.includes('ssl=true'),
        poolConfig: providerConfig.poolDefaults,
    };
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(config: DatabaseConfig): {
    valid: boolean;
    errors: string[];
    warnings: string[];
} {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.connectionString) {
        errors.push('Connection string is required');
    }

    if (!config.connectionString.startsWith('postgres://') && 
        !config.connectionString.startsWith('postgresql://')) {
        errors.push('Connection string must start with postgres:// or postgresql://');
    }

    const providerConfig = DATABASE_PROVIDERS[config.provider];
    if (!providerConfig.urlPattern.test(config.connectionString)) {
        warnings.push(`Connection string doesn't match expected pattern for ${providerConfig.name}`);
    }

    if (config.provider === 'neon' && !config.ssl) {
        warnings.push('Neon databases typically require SSL connections');
    }

    if (config.provider === 'supabase' && !config.ssl) {
        warnings.push('Supabase databases typically require SSL connections');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Get environment variable template for a provider
 */
export function getEnvTemplate(provider: DatabaseProvider): Record<string, string> {
    const config = DATABASE_PROVIDERS[provider];
    const template: Record<string, string> = {};

    // Add required variables
    config.envVars.required.forEach(varName => {
        if (varName === 'DATABASE_URL') {
            template[varName] = config.examples[0].connectionString;
        } else {
            template[varName] = `your_${varName.toLowerCase()}`;
        }
    });

    // Add optional variables with comments
    config.envVars.optional.forEach(varName => {
        if (varName === 'DB_PROVIDER') {
            template[`# ${varName}`] = provider;
        } else {
            template[`# ${varName}`] = `optional_${varName.toLowerCase()}`;
        }
    });

    return template;
}
