/**
 * Note Cache
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

import { TreeModel } from 'libs/shared/tree';
import { noteCacheInstance, NoteCacheItem } from 'libs/web/cache';
import { isNoteLink, NoteModel } from 'libs/shared/note';
import { keys, pull } from 'lodash';
import { removeMarkdown } from '../utils/markdown';


function extractMarkdownLinks(content: string): string[] {
    const links: string[] = [];

    // 匹配 [text](url) 格式的链接
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
        const url = match[2];
        if (url && !url.startsWith('#')) { // 排除锚点链接
            links.push(url);
        }
    }

    // 匹配 <url> 格式的自动链接
    const autoLinkRegex = /<(https?:\/\/[^>]+)>/g;
    while ((match = autoLinkRegex.exec(content)) !== null) {
        links.push(match[1]);
    }

    return links;
}

/**
 * 清除本地存储中未使用的 note
 */
async function checkItems(items: TreeModel['items']) {
    const noteIds = keys(items);
    const localNoteIds = await noteCache.keys();
    const unusedNoteIds = pull(localNoteIds, ...noteIds);

    await Promise.all(
        unusedNoteIds.map((id) => (id ? noteCache.removeItem(id) : undefined))
    );
}

async function getItem(id: string) {
    return noteCacheInstance.getItem<NoteCacheItem>(id);
}

async function setItem(id: string, note: NoteModel) {
    const extractorLinks = extractMarkdownLinks(note.content ?? '');
    const linkIds: string[] = [];
    if (Array.isArray(extractorLinks) && extractorLinks.length) {
        extractorLinks.forEach((link) => {
            if (isNoteLink(link)) {
                linkIds.push(link.slice(1));
            }
        });
    }
    return noteCacheInstance.setItem<NoteCacheItem>(id, {
        ...note,
        rawContent: removeMarkdown(note.content),
        linkIds,
    });
}

async function mutateItem(id: string, body: Partial<NoteModel>) {
    const note = await getItem(id);

    if (!note) {
        throw new Error('not found note cache:' + id);
    }

    await setItem(id, {
        ...note,
        ...body,
    });
}

const noteCache = {
    ...noteCacheInstance,
    getItem,
    setItem,
    mutateItem,
    checkItems,
};

export default noteCache;
