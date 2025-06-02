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
