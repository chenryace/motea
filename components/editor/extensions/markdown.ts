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

// 检查是否是markdown内容
function isMarkdownContent(text: string): boolean {
    if (!text) return false;

    // 检查常见的markdown模式
    const markdownPatterns = [
        /^#{1,6}\s+/m,           // 标题
        /^\s*[-*+]\s+/m,         // 无序列表
        /^\s*\d+\.\s+/m,         // 有序列表
        /^\s*>\s+/m,             // 引用
        /```[\s\S]*```/,         // 代码块
        /`[^`]+`/,               // 行内代码
        /\*\*[^*]+\*\*/,         // 粗体
        /\*[^*]+\*/,             // 斜体
        /\[[^\]]+\]\([^)]+\)/,   // 链接
    ];

    return markdownPatterns.some(pattern => pattern.test(text));
}

// 预处理markdown内容
function preprocessMarkdown(markdown: string): string {
    let processed = markdown;

    // 改进列表项的缩进处理
    const lines = processed.split('\n');
    const processedLines = lines.map(line => {
        // 处理缩进的列表项
        const indentMatch = line.match(/^(\s*)([*+-]|\d+\.)\s+(.*)$/);
        if (indentMatch) {
            const [, indent, marker, content] = indentMatch;
            // 确保缩进是4的倍数，这样TipTap能更好地处理嵌套
            const indentLevel = Math.floor(indent.length / 2);
            const normalizedIndent = '  '.repeat(indentLevel);
            return `${normalizedIndent}${marker} ${content}`;
        }
        return line;
    });

    return processedLines.join('\n');
}

// 处理列表转换
function processLists(text: string): string {
    const lines = text.split('\n');
    let result = '';
    let inList = false;
    let listType = '';
    let currentIndent = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const listMatch = line.match(/^(\s*)([*+-]|\d+\.)\s+(.*)$/);

        if (listMatch) {
            const [, indent, marker, content] = listMatch;
            const indentLevel = Math.floor(indent.length / 2);
            const isOrdered = /\d+\./.test(marker);
            const newListType = isOrdered ? 'ol' : 'ul';

            if (!inList) {
                result += `<${newListType}>`;
                inList = true;
                listType = newListType;
                currentIndent = indentLevel;
            } else if (indentLevel > currentIndent) {
                result += `<${newListType}>`;
                currentIndent = indentLevel;
            } else if (indentLevel < currentIndent) {
                result += `</${listType}>`;
                currentIndent = indentLevel;
            }

            result += `<li>${content}</li>`;
        } else {
            if (inList) {
                result += `</${listType}>`;
                inList = false;
            }
            result += line + '\n';
        }
    }

    if (inList) {
        result += `</${listType}>`;
    }

    return result;
}

// 简单的markdown到HTML转换
function markdownToHtml(markdown: string): string {
    let html = markdown;

    // 标题
    html = html.replace(/^(#{1,6})\s+(.*)$/gm, (match, hashes, content) => {
        const level = hashes.length;
        return `<h${level}>${content}</h${level}>`;
    });

    // 粗体
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 斜体
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // 行内代码
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');

    // 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // 处理列表
    html = processLists(html);

    // 处理段落
    html = html.replace(/\n\n/g, '</p><p>');
    html = `<p>${html}</p>`;
    html = html.replace(/<p><\/p>/g, '');

    return html;
}

// 处理markdown粘贴
function handleMarkdownPaste(view: any, markdown: string): void {
    try {
        // 预处理markdown内容，改进列表缩进处理
        const processedMarkdown = preprocessMarkdown(markdown);

        // 使用TipTap的内置markdown解析
        const { state } = view;
        const { tr } = state;
        const { from } = state.selection;

        // 将markdown转换为HTML，然后让TipTap解析
        const html = markdownToHtml(processedMarkdown);

        // 创建一个临时的DOM元素来解析HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // 使用TipTap的DOMParser来解析内容
        const parser = require('prosemirror-model').DOMParser.fromSchema(state.schema);
        const doc = parser.parse(tempDiv);

        // 插入解析后的内容
        const newTr = tr.replaceWith(from, from, doc.content);
        view.dispatch(newTr);
    } catch (error) {
        console.error('Error handling markdown paste:', error);
        // 如果处理失败，回退到普通文本插入
        const { state } = view;
        const { tr } = state;
        const { from } = state.selection;
        view.dispatch(tr.insertText(markdown, from));
    }
}

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
            }),
            // 增强的粘贴处理插件
            new (require('prosemirror-state').Plugin)({
                key: new (require('prosemirror-state').PluginKey)('enhancedPasteHandler'),
                props: {
                    handlePaste: (view: any, event: ClipboardEvent, slice: any) => {
                        const clipboardData = event.clipboardData;
                        if (!clipboardData) return false;

                        const text = clipboardData.getData('text/plain');
                        const html = clipboardData.getData('text/html');

                        // 检查是否是markdown内容
                        if (isMarkdownContent(text)) {
                            event.preventDefault();
                            handleMarkdownPaste(view, text);
                            return true;
                        }

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
            'Tab': () => {
                const { state } = this.editor;
                const { $from } = state.selection;

                // 检查是否在列表项中
                const isInList = $from.node(-1)?.type.name === 'listItem' ||
                                $from.node(-2)?.type.name === 'listItem' ||
                                $from.node(-3)?.type.name === 'listItem';

                if (isInList) {
                    // 在列表项中，执行缩进
                    const result = this.editor.commands.sinkListItem('listItem');
                    if (result) {
                        return true; // 阻止默认Tab行为
                    }
                }

                // 检查是否在任务列表中
                const isInTaskList = $from.node(-1)?.type.name === 'taskItem' ||
                                    $from.node(-2)?.type.name === 'taskItem' ||
                                    $from.node(-3)?.type.name === 'taskItem';

                if (isInTaskList) {
                    // 在任务列表中，执行缩进
                    const result = this.editor.commands.sinkListItem('taskItem');
                    if (result) {
                        return true; // 阻止默认Tab行为
                    }
                }

                // 如果不在列表中或缩进失败，阻止默认Tab行为以防止焦点离开编辑器
                return true;
            },
            'Shift-Tab': () => {
                const { state } = this.editor;
                const { $from } = state.selection;

                // 检查是否在列表项中
                const isInList = $from.node(-1)?.type.name === 'listItem' ||
                                $from.node(-2)?.type.name === 'listItem' ||
                                $from.node(-3)?.type.name === 'listItem';

                if (isInList) {
                    // 在列表项中，执行取消缩进
                    const result = this.editor.commands.liftListItem('listItem');
                    if (result) {
                        return true; // 阻止默认Shift+Tab行为
                    }
                }

                // 检查是否在任务列表中
                const isInTaskList = $from.node(-1)?.type.name === 'taskItem' ||
                                    $from.node(-2)?.type.name === 'taskItem' ||
                                    $from.node(-3)?.type.name === 'taskItem';

                if (isInTaskList) {
                    // 在任务列表中，执行取消缩进
                    const result = this.editor.commands.liftListItem('taskItem');
                    if (result) {
                        return true; // 阻止默认Shift+Tab行为
                    }
                }

                // 如果不在列表中或取消缩进失败，阻止默认Shift+Tab行为以防止焦点离开编辑器
                return true;
            },
            'Enter': () => {
                const { state } = this.editor;
                const { $from } = state.selection;

                // 如果在空的列表项中按回车，跳出列表
                if ($from.parent.type.name === 'listItem' && $from.parent.textContent === '') {
                    return this.editor.commands.liftListItem('listItem');
                }

                // 如果在空的任务项中按回车，跳出任务列表
                if ($from.parent.type.name === 'taskItem' && $from.parent.textContent === '') {
                    return this.editor.commands.liftListItem('taskItem');
                }

                return false; // 让 Tiptap 处理其他情况
            }
        };
    },
});

export default MarkdownExtension;
