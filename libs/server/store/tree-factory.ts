import { config, PostgreSQLStoreConfiguration } from 'libs/server/config';
import { TreeStorePostgreSQL } from './tree-postgresql';
import { StoreProvider } from './providers/base';

export function createTreeStore(store: StoreProvider): TreeStorePostgreSQL {
    const cfg = config().store as PostgreSQLStoreConfiguration;

    return new TreeStorePostgreSQL({
        connectionString: cfg.connectionString,
    });
}
