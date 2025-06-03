/**
 * PostgreSQL Tree Store
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

import { Pool } from 'pg';
import { createLogger } from 'libs/server/debugging';
import { TreeModel, DEFAULT_TREE, ROOT_ID, MovePosition, TreeItemModel } from 'libs/shared/tree';
import TreeActions from 'libs/shared/tree';
import { filter, forEach, isNil } from 'lodash';

export interface TreeStoreConfig {
    connectionString: string;
}


function fixedTree(tree: TreeModel) {
    forEach(tree.items, (item) => {
        if (
            item.children.find(
                (i) => i === null || i === item.id || !tree.items[i]
            )
        ) {
            console.log('item.children error', item);
            tree.items[item.id] = {
                ...item,
                children: filter(
                    item.children,
                    (cid) => !isNil(cid) && cid !== item.id && !!tree.items[cid]
                ),
            };
        }
    });
    return tree;
}

export class TreeStorePostgreSQL {
    private pool: Pool;
    private logger = createLogger('tree-store.postgresql');

    constructor(config: TreeStoreConfig) {
        this.pool = new Pool({
            connectionString: config.connectionString,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 1, 
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 10000,
        });
    }

    async get(): Promise<TreeModel> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT data FROM tree_data WHERE id = $1',
                ['main']
            );

            if (result.rows.length === 0) {
                const defaultTree = fixedTree(DEFAULT_TREE);
                await client.query(`
                    INSERT INTO tree_data (id, data, updated_at)
                    VALUES ('main', $1, NOW())
                `, [JSON.stringify(defaultTree)]);

                this.logger.debug('Initialized default tree');
                return defaultTree;
            }

            const tree = result.rows[0].data as TreeModel;
            return fixedTree(tree);
        } catch (error) {
            this.logger.error('Error getting tree:', error);
            return fixedTree(DEFAULT_TREE);
        } finally {
            client.release();
        }
    }

    async set(tree: TreeModel): Promise<TreeModel> {
        const newTree = fixedTree(tree);
        const client = await this.pool.connect();
        try {
            await client.query(`
                INSERT INTO tree_data (id, data, updated_at)
                VALUES ('main', $1, NOW())
                ON CONFLICT (id)
                DO UPDATE SET
                    data = EXCLUDED.data,
                    updated_at = NOW()
            `, [JSON.stringify(newTree)]);

            this.logger.debug('Successfully updated tree data');
            return newTree;
        } catch (error) {
            this.logger.error('Error updating tree:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async addItem(id: string, parentId: string = ROOT_ID): Promise<TreeModel> {
        const tree = await this.get();
        return await this.set(TreeActions.addItem(tree, id, parentId));
    }

    async addItems(ids: string[], parentId: string = ROOT_ID): Promise<TreeModel> {
        let tree = await this.get();
        ids.forEach((id) => {
            tree = TreeActions.addItem(tree, id, parentId);
        });
        return await this.set(tree);
    }

    async removeItem(id: string): Promise<TreeModel> {
        const tree = await this.get();
        return await this.set(TreeActions.removeItem(tree, id));
    }

    async moveItem(source: MovePosition, destination: MovePosition): Promise<TreeModel> {
        const tree = await this.get();
        return await this.set(TreeActions.moveItem(tree, source, destination));
    }

    async mutateItem(id: string, data: TreeItemModel): Promise<TreeModel> {
        const tree = await this.get();
        return await this.set(TreeActions.mutateItem(tree, id, data));
    }

    async restoreItem(id: string, parentId: string): Promise<TreeModel> {
        const tree = await this.get();
        return await this.set(TreeActions.restoreItem(tree, id, parentId));
    }

    async deleteItem(id: string): Promise<TreeModel> {
        const tree = await this.get();
        return await this.set(TreeActions.deleteItem(tree, id));
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}
