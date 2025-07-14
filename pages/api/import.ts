/**
 * Import API
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

import { useAuth } from 'libs/server/middlewares/auth';
import { useStore } from 'libs/server/middlewares/store';
import { readFileFromRequest } from 'libs/server/file';
import AdmZip from 'adm-zip';
import { api } from 'libs/server/connect';
import { IMPORT_FILE_LIMIT_SIZE } from 'libs/shared/const';
import { extname } from 'path';
import { genId } from 'libs/shared/id';
import { ROOT_ID } from 'libs/shared/tree';
import { createNote } from 'libs/server/note';
import { NoteModel } from 'libs/shared/note';
import { parseMarkdownTitle } from 'libs/shared/markdown/parse-markdown-title';

const MARKDOWN_EXT = [
    '.markdown',
    '.mdown',
    '.mkdn',
    '.md',
    '.mkd',
    '.mdwn',
    '.mdtxt',
    '.mdtext',
    '.text',
    '.Rmd',
];

export const config = {
    api: {
        bodyParser: false,
    },
};

export default api()
    .use(useAuth)
    .use(useStore)
    .post(async (req, res) => {
        const pid = (req.query.pid as string) || ROOT_ID;
        const file = await readFileFromRequest(req);

        if (!file || !file.path) {
            console.error('File not received or file path is missing');
            return res.status(400).json({ error: 'File not received or invalid file data' });
        }

        if (file.size > IMPORT_FILE_LIMIT_SIZE) {
            return res.APIError.IMPORT_FILE_LIMIT_SIZE.throw();
        }

        const zip = new AdmZip(file.path);
        const zipEntries = zip.getEntries();
        const total = zipEntries.length;

        if (total === 0) {
            return res.status(400).json({ error: 'ZIP file is empty' });
        }

        // 检查是否包含 Markdown 文件
        const hasMarkdownFiles = zipEntries.some(entry => {
            const ext = extname(entry.name);
            return MARKDOWN_EXT.includes(ext.toLowerCase());
        });

        if (!hasMarkdownFiles) {
            return res.status(400).json({ error: 'No Markdown files found in ZIP' });
        }

        // Step 1: Build hierarchy of entries
        type HierarchyNode = {
            name: string;
            entry?: AdmZip.IZipEntry;
            children: Hierarchy;
        };
        type Hierarchy = Record<string, HierarchyNode>;

        const hierachy: Hierarchy = {};
        zipEntries.forEach((v) => {
            let name: string = v.name;
            if (!v.isDirectory) {
                const entryNameExtension = extname(v.name).toLowerCase();
                let isMarkdown = MARKDOWN_EXT.includes(entryNameExtension);
                
                if (isMarkdown) {
                    name = v.name.substring(
                        0,
                        v.name.length - entryNameExtension.length
                    );
                } else {
                    return; // 不是 Markdown 文件，跳过
                }
            }
            const pathParts = v.entryName.split(/[\\/]/).filter(Boolean); // 同时处理 '/' 和 '\' 分隔符

            let currentHierarchy = hierachy;
            let me: HierarchyNode | undefined;
            for (const part of pathParts) {
                if (!currentHierarchy[part]) {
                    currentHierarchy[part] = {
                        name: part,
                        children: {},
                    };
                }
                me = currentHierarchy[part];
                currentHierarchy = me.children;
            }
            if (!me) {
                throw Error('Current hierarchy node is undefined');
            }
            me.name = name;
            me.entry = v;
        });

        let count: number = 0;

        async function createNotes(
            currentNode: HierarchyNode,
            parent?: string
        ): Promise<string> {
            let date: string | undefined,
                title: string | undefined,
                content: string | undefined;
            if (currentNode.entry) {
                const entry = currentNode.entry;
                date = entry.header.time.toISOString();
                if (!entry.isDirectory) {
                    try {
                        const rawContent = entry.getData().toString('utf-8');
                        const parsed = parseMarkdownTitle(rawContent);
                        title = parsed.title;
                        content = parsed.content;
                    } catch (error) {
                        console.error(`Error processing file ${entry.name}:`, error);
                        throw new Error(`Failed to process Markdown file: ${entry.name}`);
                    }
                }
            }
            const note = {
                title: title ?? currentNode.name,
                pid: parent,
                id: genId(),
                date,
                content,
            } as NoteModel;

            const createdNote = await createNote(note, req.state);
            await req.state.treeStore.addItem(createdNote.id, parent);
            count++;
            
            for (const child of Object.values(currentNode.children)) {
                await createNotes(child, createdNote.id);
            }

            return createdNote.id;
        }

        try {
            await Promise.all(
                Object.values(hierachy).map((v) => createNotes(v, pid))
            );
            res.json({ total, imported: count });
        } catch (error) {
            console.error('Error importing notes:', error);
            res.status(500).json({ error: error.message });
        }
    });
