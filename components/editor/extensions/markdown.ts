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

import { Extension, Node } from '@tiptap/core';
import { textblockTypeInputRule, mergeAttributes } from '@tiptap/core';

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

        // 处理缩进
        const indent = node.attrs?.indent || 0;
        const indentStr = '  '.repeat(indent); // 每级缩进2个空格

        switch (node.type) {
            case 'paragraph':
                const paragraphContent = this.inlineToMarkdown(node.content);
                return indentStr + paragraphContent + '\n\n';
            case 'heading':
                const level = node.attrs?.level || 1;
                const headingContent = '#'.repeat(level) + ' ' + this.inlineToMarkdown(node.content);
                return indentStr + headingContent + '\n\n';
            case 'codeBlock':
                const lang = node.attrs?.language || '';
                const codeContent = '```' + lang + '\n' + (node.content?.[0]?.text || '') + '\n```';
                return indentStr + codeContent + '\n\n';
            case 'blockquote':
                const quoteContent = '> ' + this.inlineToMarkdown(node.content);
                return indentStr + quoteContent + '\n\n';
            case 'bulletList':
                return this.listToMarkdown(node.content, '- ') + '\n';
            case 'orderedList':
                return this.listToMarkdown(node.content, '1. ') + '\n';
            case 'listItem':
                return this.inlineToMarkdown(node.content);
            case 'horizontalRule':
                return indentStr + '---\n\n';
            case 'image':
                const src = node.attrs?.src || '';
                const alt = node.attrs?.alt || '';
                const title = node.attrs?.title || '';
                const imageContent = title && title !== alt
                    ? `![${alt}](${src} "${title}")`
                    : `![${alt}](${src})`;
                return indentStr + imageContent + '\n\n';
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

export const CustomHeading = Node.create({
    name: 'heading',

    addOptions() {
        return {
            levels: [1, 2, 3, 4, 5, 6],
            HTMLAttributes: {},
        };
    },

    content: 'inline*',
    group: 'block',
    defining: true,

    addAttributes() {
        return {
            level: {
                default: 1,
                rendered: false,
            },
        };
    },

    parseHTML() {
        return this.options.levels.map((level: number) => ({
            tag: `h${level}`,
            attrs: { level },
        }));
    },

    renderHTML({ node, HTMLAttributes }) {
        const hasLevel = this.options.levels.includes(node.attrs.level);
        const level = hasLevel ? node.attrs.level : this.options.levels[0];
        return [`h${level}`, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setHeading: (attributes: any) => ({ commands }: any) => {
                if (!this.options.levels.includes(attributes.level)) {
                    return false;
                }
                return commands.setNode(this.name, attributes);
            },
            toggleHeading: (attributes: any) => ({ commands }: any) => {
                if (!this.options.levels.includes(attributes.level)) {
                    return false;
                }
                return commands.toggleNode(this.name, 'paragraph', attributes);
            },
        };
    },
});

export const MarkdownExtension = Extension.create({
    name: 'markdown',
    priority: 1000, 

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
            // 标题输入规则
            textblockTypeInputRule({
                find: /^(#)\s$/,
                type: this.editor.schema.nodes.heading,
                getAttributes: () => ({ level: 1 }),
            }),
            textblockTypeInputRule({
                find: /^(##)\s$/,
                type: this.editor.schema.nodes.heading,
                getAttributes: () => ({ level: 2 }),
            }),
            textblockTypeInputRule({
                find: /^(###)\s$/,
                type: this.editor.schema.nodes.heading,
                getAttributes: () => ({ level: 3 }),
            }),
            textblockTypeInputRule({
                find: /^(####)\s$/,
                type: this.editor.schema.nodes.heading,
                getAttributes: () => ({ level: 4 }),
            }),
            textblockTypeInputRule({
                find: /^(#####)\s$/,
                type: this.editor.schema.nodes.heading,
                getAttributes: () => ({ level: 5 }),
            }),
            textblockTypeInputRule({
                find: /^(######)\s$/,
                type: this.editor.schema.nodes.heading,
                getAttributes: () => ({ level: 6 }),
            }),
            // 列表输入规则
            textblockTypeInputRule({
                find: /^[-*] $/,
                type: this.editor.schema.nodes.bulletList
            }),
            textblockTypeInputRule({
                find: /^1[.)] $/,
                type: this.editor.schema.nodes.orderedList
            })
        ];
    },

    addProseMirrorPlugins() {
        return [
            new (require('prosemirror-state').Plugin)({
                key: new (require('prosemirror-state').PluginKey)('headingInputHandler'),
                props: {
                    handleTextInput: (view: any, from: number, to: number, text: string) => {
                        setTimeout(() => {
                            const { state } = view;
                            const { $from } = state.selection;
                            const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

                            const headingMatches = [
                                { pattern: /^###### $/, level: 6 },
                                { pattern: /^##### $/, level: 5 },
                                { pattern: /^#### $/, level: 4 },
                                { pattern: /^### $/, level: 3 },
                                { pattern: /^## $/, level: 2 },
                                { pattern: /^# $/, level: 1 },
                            ];

                            for (const { pattern, level } of headingMatches) {
                                if (pattern.test(textBefore)) {
                                    const tr = state.tr
                                        .delete($from.start(), $from.pos)
                                        .setBlockType($from.start(), $from.start(), state.schema.nodes.heading, { level });

                                    view.dispatch(tr);
                                    break;
                                }
                            }
                        }, 10);

                        return false;
                    },
                }
            })
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
            'Enter': () => {
                const { state } = this.editor;
                const { $from } = state.selection;

                // 如果在空的列表项中按回车，跳出列表
                if ($from.parent.type.name === 'listItem' && $from.parent.textContent === '') {
                    return this.editor.commands.liftListItem('listItem');
                }
                return false; // 让 Tiptap 处理其他情况
            }
        };
    },
});

export default MarkdownExtension;
