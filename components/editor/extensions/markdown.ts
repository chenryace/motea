/**
 * Markdown Extension for Tiptap Editor
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

import { Extension } from '@tiptap/core';
import { textblockTypeInputRule } from '@tiptap/core';

class MarkdownTransformer {
    serialize(doc: any): string {
        return this.htmlToMarkdown(doc.content);
    }

    parse(markdown: string): any {
        return markdown;
    }

    private htmlToMarkdown(content: any): string {
        if (!content) return '';

        let markdown = '';

        if (Array.isArray(content)) {
            content.forEach((node: any) => {
                markdown += this.nodeToMarkdown(node);
            });
        } else {
            markdown = this.nodeToMarkdown(content);
        }

        return markdown;
    }

    private nodeToMarkdown(node: any): string {
        if (!node) return '';

        switch (node.type) {
            case 'paragraph':
                return this.inlineToMarkdown(node.content) + '\n\n';
            case 'heading':
                const level = node.attrs?.level || 1;
                return '#'.repeat(level) + ' ' + this.inlineToMarkdown(node.content) + '\n\n';
            case 'codeBlock':
                const lang = node.attrs?.language || '';
                return '```' + lang + '\n' + (node.content?.[0]?.text || '') + '\n```\n\n';
            case 'blockquote':
                return '> ' + this.inlineToMarkdown(node.content) + '\n\n';
            case 'bulletList':
                return this.listToMarkdown(node.content, '- ') + '\n';
            case 'orderedList':
                return this.listToMarkdown(node.content, '1. ') + '\n';
            case 'listItem':
                return this.inlineToMarkdown(node.content);
            case 'horizontalRule':
                return '---\n\n';
            case 'image':
                const src = node.attrs?.src || '';
                const alt = node.attrs?.alt || '';
                const title = node.attrs?.title || '';
                if (title && title !== alt) {
                    return `![${alt}](${src} "${title}")\n\n`;
                } else {
                    return `![${alt}](${src})\n\n`;
                }
            default:
                return this.inlineToMarkdown(node.content);
        }
    }

    private inlineToMarkdown(content: any): string {
        if (!content) return '';

        let result = '';

        if (Array.isArray(content)) {
            content.forEach((node: any) => {
                result += this.inlineNodeToMarkdown(node);
            });
        } else {
            result = this.inlineNodeToMarkdown(content);
        }

        return result;
    }

    private inlineNodeToMarkdown(node: any): string {
        if (!node) return '';

        if (node.type === 'text') {
            let text = node.text || '';

            if (node.marks) {
                node.marks.forEach((mark: any) => {
                    switch (mark.type) {
                        case 'strong':
                            text = '**' + text + '**';
                            break;
                        case 'em':
                            text = '*' + text + '*';
                            break;
                        case 'code':
                            text = '`' + text + '`';
                            break;
                        case 'link':
                            text = '[' + text + '](' + mark.attrs.href + ')';
                            break;
                        case 'underline':
                            text = '<u>' + text + '</u>';
                            break;
                    }
                });
            }

            return text;
        }

        return '';
    }

    private listToMarkdown(items: any[], prefix: string): string {
        if (!items) return '';

        return items.map((item: any) => {
            return prefix + this.inlineToMarkdown(item.content);
        }).join('\n');
    }
}

export const MarkdownExtension = Extension.create({
    name: 'markdown',
    priority: 1000, // 高优先级确保输入规则优先执行

    addStorage() {
        return {
            transformer: new MarkdownTransformer(),
        };
    },

    addCommands() {
        return {
            setMarkdown: (markdown: string) => ({ commands }: any) => {
                const doc = this.storage.transformer.parse(markdown);
                return commands.setContent(doc);
            },
            getMarkdown: () => ({ editor }: any) => {
                return this.storage.transformer.serialize(editor.state.doc);
            },
        } as any;
    },

    addInputRules() {
        return [
            // H1 标题输入规则 - 更精确的匹配
            textblockTypeInputRule({
                find: /^(#)\s$/,
                type: this.editor.schema.nodes.heading,
                getAttributes: (match) => {
                    console.log('H1 heading rule triggered:', match);
                    return { level: 1 };
                },
            }),
            // H2 标题输入规则
            textblockTypeInputRule({
                find: /^(##)\s$/,
                type: this.editor.schema.nodes.heading,
                getAttributes: (match) => {
                    console.log('H2 heading rule triggered:', match);
                    return { level: 2 };
                },
            }),
            // H3 标题输入规则
            textblockTypeInputRule({
                find: /^(###)\s$/,
                type: this.editor.schema.nodes.heading,
                getAttributes: (match) => {
                    console.log('H3 heading rule triggered:', match);
                    return { level: 3 };
                },
            }),
            // H4 标题输入规则
            textblockTypeInputRule({
                find: /^(####)\s$/,
                type: this.editor.schema.nodes.heading,
                getAttributes: (match) => {
                    console.log('H4 heading rule triggered:', match);
                    return { level: 4 };
                },
            }),
            // H5 标题输入规则
            textblockTypeInputRule({
                find: /^(#####)\s$/,
                type: this.editor.schema.nodes.heading,
                getAttributes: (match) => {
                    console.log('H5 heading rule triggered:', match);
                    return { level: 5 };
                },
            }),
            // H6 标题输入规则
            textblockTypeInputRule({
                find: /^(######)\s$/,
                type: this.editor.schema.nodes.heading,
                getAttributes: (match) => {
                    console.log('H6 heading rule triggered:', match);
                    return { level: 6 };
                },
            }),
        ];
    },

    addKeyboardShortcuts() {
        return {
            'Mod-s': () => {
                const saveButton = document.querySelector('button[data-save-button]') as HTMLButtonElement;
                if (saveButton) {
                    saveButton.click();
                }
                return true;
            },
        };
    },
});

export default MarkdownExtension;
