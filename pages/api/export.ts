/**
 * Export API
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
import AdmZip from 'adm-zip';
import { api } from 'libs/server/connect';
import TreeActions, {
    ROOT_ID,
    HierarchicalTreeItemModel,
} from 'libs/shared/tree';
import { getPathNoteById } from 'libs/server/note-path';
import { NOTE_DELETED } from 'libs/shared/meta';
import { metaToJson } from 'libs/server/meta';
import { toBuffer } from 'libs/shared/str';
import { convertHtmlToMarkdown } from 'libs/shared/html-to-markdown';


export function escapeFileName(name: string): string {
    // list of characters taken from https://www.mtu.edu/umc/services/websites/writing/characters-avoid/
    return name.replace(/[#%&{}\\<>*?/$!'":@+`|=]/g, "_");
}

/**
 * Convert Lexical JSON to Markdown
 */
function convertJSONToMarkdown(jsonContent: string): string {
    try {
        const data = JSON.parse(jsonContent);
        const root = data.root;
        if (!root || !root.children) {
            return '';
        }

        return convertNodesToMarkdown(root.children);
    } catch (error) {
        console.error('Error parsing JSON:', error);
        return jsonContent;
    }
}

function convertNodesToMarkdown(nodes: any[]): string {
    let markdown = '';

    for (const node of nodes) {
        if (node.type === 'paragraph') {
            markdown += convertNodesToMarkdown(node.children || []) + '\n\n';
        } else if (node.type === 'heading') {
            const level = node.tag ? parseInt(node.tag.replace('h', '')) : 1;
            const prefix = '#'.repeat(level);
            markdown += prefix + ' ' + convertNodesToMarkdown(node.children || []) + '\n\n';
        } else if (node.type === 'list') {
            markdown += convertListToMarkdown(node) + '\n';
        } else if (node.type === 'quote') {
            const quoteText = convertNodesToMarkdown(node.children || []);
            markdown += '> ' + quoteText.replace(/\n/g, '\n> ') + '\n\n';
        } else if (node.type === 'code') {
            const language = node.language || '';
            const codeText = convertNodesToMarkdown(node.children || []);
            markdown += '```' + language + '\n' + codeText + '\n```\n\n';
        } else if (node.type === 'horizontalrule') {
            markdown += '---\n\n';
        } else if (node.type === 'table') {
            markdown += convertTableToMarkdown(node) + '\n';
        } else if (node.type === 'image') {
            const alt = node.altText || '';
            const src = node.src || '';
            markdown += `![${alt}](${src})\n\n`;
        } else if (node.type === 'text') {
            let nodeText = node.text || '';
            if (node.format) {
                if (node.format & 1) nodeText = '**' + nodeText + '**'; // bold
                if (node.format & 2) nodeText = '*' + nodeText + '*'; // italic
                if (node.format & 4) nodeText = '~~' + nodeText + '~~'; // strikethrough
                if (node.format & 8) nodeText = '`' + nodeText + '`'; // code
                if (node.format & 16) nodeText = '<u>' + nodeText + '</u>'; // underline
                if (node.format & 32) nodeText = '==' + nodeText + '=='; // highlight
            }
            markdown += nodeText;
        } else if (node.children) {
            markdown += convertNodesToMarkdown(node.children);
        }
    }

    return markdown;
}

function convertListToMarkdown(listNode: any): string {
    let markdown = '';
    const items = listNode.children || [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type === 'listitem') {
            const itemText = convertNodesToMarkdown(item.children || []);
            if (listNode.listType === 'number') {
                markdown += `${i + 1}. ${itemText}\n`;
            } else if (listNode.listType === 'check') {
                const checked = item.checked ? '[x]' : '[ ]';
                markdown += `- ${checked} ${itemText}\n`;
            } else {
                markdown += `- ${itemText}\n`;
            }
        }
    }

    return markdown;
}

function convertTableToMarkdown(tableNode: any): string {
    let markdown = '\n';
    const rows = tableNode.children || [];

    rows.forEach((row: any, rowIndex: number) => {
        if (row.type === 'tablerow') {
            const cells = row.children || [];
            const cellTexts = cells.map((cell: any) => {
                if (cell.type === 'tablecell') {
                    return convertNodesToMarkdown(cell.children || []).trim() || ' ';
                }
                return ' ';
            });

            markdown += '| ' + cellTexts.join(' | ') + ' |\n';

            if (rowIndex === 0) {
                markdown += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
            }
        }
    });

    return markdown + '\n';
}

// 简单的JSON文本提取函数（备用）
function extractTextFromJSON(json: any): string {
    if (!json || !json.root || !json.root.children) {
        return '';
    }

    function extractFromNode(node: any): string {
        let text = '';

        if (node.text) {
            text += node.text;
        }

        if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
                text += extractFromNode(child);
            }
        }

        // 为段落和标题添加换行
        if (node.type === 'paragraph' || node.type === 'heading') {
            text += '\n';
        }

        return text;
    }

    return extractFromNode(json.root).trim();
}

export default api()
    .use(useAuth)
    .use(useStore)
    .get(async (req, res) => {
        const pid = (req.query.pid as string) || ROOT_ID;
        const zip = new AdmZip();
        const tree = await req.state.treeStore.get();
        const rootItem = TreeActions.makeHierarchy(tree, pid);
        const duplicate: Record<string, number> = {};

        async function addItem(
            item: HierarchicalTreeItemModel,
            prefix: string = ''
        ): Promise<void> {
            const note = await req.state.store.getObjectAndMeta(
                getPathNoteById(item.id)
            );
            const metaJson = metaToJson(note.meta);

            if (metaJson.deleted === NOTE_DELETED.DELETED) {
                return;
            }
            const title = escapeFileName(metaJson.title ?? 'Untitled');

            const resolvedPrefix = prefix.length === 0 ? '' : prefix + '/';
            const basePath = resolvedPrefix + title;
            const uniquePath = duplicate[basePath]
                ? `${basePath} (${duplicate[basePath]})`
                : basePath;
            duplicate[basePath] = (duplicate[basePath] ?? 0) + 1;

            // 检测内容格式并转换为markdown
            let markdownContent = '';
            if (note.content) {
                const trimmed = note.content.trim();
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {

                    try {
                        markdownContent = convertJSONToMarkdown(note.content);
                    } catch (error) {
                        console.error('JSON conversion failed, using fallback:', error);
                        try {
                            const jsonData = JSON.parse(note.content);
                            markdownContent = extractTextFromJSON(jsonData);
                        } catch (parseError) {
                            markdownContent = note.content;
                        }
                    }
                } else {

                    markdownContent = convertHtmlToMarkdown(note.content);
                }
            }

            zip.addFile(`${uniquePath}.md`, toBuffer(markdownContent));
            await Promise.all(item.children.map((v) => addItem(v, uniquePath)));
        }

        if (rootItem) {
            await Promise.all(rootItem.children.map((v) => addItem(v)));
        }

        // 生成带时间戳的文件名：motea_20250712013736.zip
        const now = new Date();
        const timestamp = now.getFullYear().toString() +
            (now.getMonth() + 1).toString().padStart(2, '0') +
            now.getDate().toString().padStart(2, '0') +
            now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0') +
            now.getSeconds().toString().padStart(2, '0');
        const filename = `motea_${timestamp}.zip`;

        res.setHeader('content-type', 'application/zip');
        res.setHeader('content-disposition', `attachment; filename=${filename}`);
        res.send(zip.toBuffer());
    });
