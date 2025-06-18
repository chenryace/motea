/**
 * Universal Indent Extension for TipTap Editor
 * 基于TipTap社区成熟方案的通用缩进功能
 *
 * 参考: https://github.com/ueberdosis/tiptap/issues/1036
 * Copyright (c) 2025 waycaan
 * Licensed under the MIT License
 */

import { Extension, Command } from '@tiptap/core';
import { Node } from 'prosemirror-model';
import { TextSelection, AllSelection, Transaction } from 'prosemirror-state';

type IndentOptions = {
    types: string[];
    indentLevels: number[];
    defaultIndentLevel: number;
};

declare module '@tiptap/core' {
    interface Commands<ReturnType = any> {
        indent: {
            /**
             * 增加缩进
             */
            indent: () => ReturnType;
            /**
             * 减少缩进
             */
            outdent: () => ReturnType;
        };
    }
}

export function clamp(val: number, min: number, max: number): number {
    if (val < min) {
        return min;
    }
    if (val > max) {
        return max;
    }
    return val;
}

export enum IndentProps {
    min = 0,
    max = 240,
    more = 30,
    less = -30
}

export function isListNode(node: Node): boolean {
    return ['bulletList', 'orderedList', 'taskList', 'listItem', 'taskItem'].includes(node.type.name);
}

function setNodeIndentMarkup(tr: Transaction, pos: number, delta: number): Transaction {
    if (!tr.doc) return tr;

    const node = tr.doc.nodeAt(pos);
    if (!node) return tr;

    const minIndent = IndentProps.min;
    const maxIndent = IndentProps.max;

    const indent = clamp(
        (node.attrs.indent || 0) + delta,
        minIndent,
        maxIndent,
    );

    if (indent === node.attrs.indent) return tr;

    const nodeAttrs = {
        ...node.attrs,
        indent,
    };

    return tr.setNodeMarkup(pos, node.type, nodeAttrs, node.marks);
}

function updateIndentLevel(tr: Transaction, delta: number): Transaction {
    const { doc, selection } = tr;

    if (!doc || !selection) return tr;

    if (!(selection instanceof TextSelection || selection instanceof AllSelection)) {
        return tr;
    }

    const { from, to } = selection;

    doc.nodesBetween(from, to, (node, pos) => {
        const nodeType = node.type;

        if (nodeType.name === 'paragraph' || nodeType.name === 'heading') {
            tr = setNodeIndentMarkup(tr, pos, delta);
            return false;
        } else if (isListNode(node)) {
            return false;
        }
        return true;
    });

    return tr;
}

export const UniversalIndentExtension = Extension.create<IndentOptions>({
    name: 'universalIndent',
    priority: 1000,

    addOptions() {
        return {
            types: ['heading', 'paragraph'],
            indentLevels: [0, 30, 60, 90, 120, 150, 180, 210, 240],
            defaultIndentLevel: 0,
        };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    indent: {
                        default: this.options.defaultIndentLevel,
                        renderHTML: attributes => ({
                            style: `margin-left: ${attributes.indent}px!important;`
                        }),
                        parseHTML: element => ({
                            indent: parseInt(element.style.marginLeft) || this.options.defaultIndentLevel,
                        }),
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            indent: (): Command => ({ tr, state, dispatch }) => {
                // 首先尝试列表项缩进
                if (this.editor.commands.sinkListItem('listItem')) {
                    return true;
                }

                if (this.editor.commands.sinkListItem('taskItem')) {
                    return true;
                }

                // 处理普通文本缩进
                const { selection } = state;
                tr = tr.setSelection(selection);
                tr = updateIndentLevel(tr, IndentProps.more);

                if (tr.docChanged) {
                    dispatch && dispatch(tr);
                    return true;
                }

                return false;
            },
            
            outdent: (): Command => ({ tr, state, dispatch }) => {
                // 首先尝试列表项取消缩进
                if (this.editor.commands.liftListItem('listItem')) {
                    return true;
                }

                if (this.editor.commands.liftListItem('taskItem')) {
                    return true;
                }

                // 处理普通文本取消缩进
                const { selection } = state;
                tr = tr.setSelection(selection);
                tr = updateIndentLevel(tr, IndentProps.less);

                if (tr.docChanged) {
                    dispatch && dispatch(tr);
                    return true;
                }

                return false;
            },
        };
    },

    addKeyboardShortcuts() {
        return {
            'Tab': () => this.editor.commands.indent(),
            'Shift-Tab': () => this.editor.commands.outdent(),
        };
    },

    addProseMirrorPlugins() {
        return [
            // 换行保持缩进插件
            new (require('prosemirror-state').Plugin)({
                key: new (require('prosemirror-state').PluginKey)('indentNewlineHandler'),
                props: {
                    handleKeyDown: (view: any, event: KeyboardEvent) => {
                        if (event.key !== 'Enter') {
                            return false;
                        }

                        const { state } = view;
                        const { selection } = state;
                        const { $from } = selection;

                        // 检查是否在列表项中，如果是，让列表处理
                        if (isListNode($from.parent)) {
                            return false;
                        }

                        // 检查当前节点是否有缩进属性
                        const currentNode = $from.parent;
                        const indent = currentNode.attrs.indent;

                        if (indent && indent > 0) {
                            // 如果当前行只有缩进（空行），不保持缩进
                            if (currentNode.textContent.trim() === '') {
                                return false;
                            }

                            // 创建新段落并保持缩进
                            const tr = state.tr;
                            const newParagraph = state.schema.nodes.paragraph.create({ indent });
                            tr.replaceSelectionWith(newParagraph);
                            view.dispatch(tr);

                            event.preventDefault();
                            return true;
                        }

                        return false;
                    },
                }
            })
        ];
    },
});

export default UniversalIndentExtension;
