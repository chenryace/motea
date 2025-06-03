/**
 * Store Factory
 * Based on the open-source project Notea, originally created by qingwei-li<cinwell.li@gmail.com>.
 * Modified and maintained by waycaan, 2025.
 *
 * Key modifications:
 * - Replaced S3 store creation with PostgreSQL store
 * - Simplified store factory to only support PostgreSQL
 */

import { StorePostgreSQL } from './providers/postgresql';
import { StoreProvider } from './providers/base';
import { config, PostgreSQLStoreConfiguration } from 'libs/server/config';

export function createStore(): StoreProvider {
    const cfg = config().store as PostgreSQLStoreConfiguration;

    return new StorePostgreSQL({
        connectionString: cfg.connectionString,
        prefix: cfg.prefix,
    });
}

export { StoreProvider } from './providers/base';
