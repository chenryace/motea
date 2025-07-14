/**
 * Notes CRUD API
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

import { api } from 'libs/server/connect';
import { metaToJson, jsonToMeta } from 'libs/server/meta';
import { useAuth } from 'libs/server/middlewares/auth';
import { useStore } from 'libs/server/middlewares/store';
import { getPathNoteById } from 'libs/server/note-path';
import { NoteModel } from 'libs/shared/note';
import { StoreProvider } from 'libs/server/store';
import { API } from 'libs/server/middlewares/error';
import { strCompress, strDecompress } from 'libs/shared/str';
import { ROOT_ID } from 'libs/shared/tree';

export async function getNote(
    store: StoreProvider,
    id: string
): Promise<NoteModel> {
    const { content, meta, updated_at } = await store.getObjectAndMeta(getPathNoteById(id));

    if (!content && !meta) {
        throw API.NOT_FOUND.throw();
    }

    const jsonMeta = metaToJson(meta);

    return {
        id,
        content: content || '', // 不要默认为 '\n'，让前端处理空内容
        ...jsonMeta,
        updated_at,
    } as NoteModel;
}

export default api()
    .use(useAuth)
    .use(useStore)
    .delete(async (req, res) => {
        const id = req.query.id as string;
        const notePath = getPathNoteById(id);

        await Promise.all([
            req.state.store.deleteObject(notePath),
            req.state.treeStore.removeItem(id),
        ]);

        res.end();
    })
    .get(async (req, res) => {
        const id = req.query.id as string;

        if (id === ROOT_ID) {
            return res.json({
                id,
            });
        }

        const note = await getNote(req.state.store, id);

        res.json(note);
    })
    .post(async (req, res) => {
        const id = req.query.id as string;
        const { content } = req.body;
        const notePath = getPathNoteById(id);
        const oldMeta = await req.state.store.getObjectMeta(notePath);

        const oldMetaJson = metaToJson(oldMeta);

        const updatedMetaJson = {
            ...oldMetaJson,
            ...req.body, 
            date: new Date().toISOString(),
        };

        delete updatedMetaJson.content;

        const metaData = jsonToMeta(updatedMetaJson);

        const metaWithId = {
            ...metaData,
            id: id, 
        };



        // 检测内容格式
        const isJSON = content && content.trim().startsWith('{') && content.trim().endsWith('}');
        const contentType = isJSON ? 'application/json' : 'text/markdown';

        if (!content || content.trim() === '\\') {
            await req.state.store.copyObject(notePath, notePath + '.bak', {
                meta: metaWithId,
                contentType,
            });
        }

        await req.state.store.putObject(notePath, content, {
            contentType,
            meta: metaWithId,
        });

        const updatedNote = {
            id,
            content,
            ...updatedMetaJson,
            updated_at: new Date().toISOString(),
        };


        res.json(updatedNote);
    });
