/**
 * Tiptap 缩进扩展
 * 为所有块级元素提供统一的缩进支持
 * 支持普通段落、标题、引用块等的缩进
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Node as ProseMirrorNode } from 'prosemirror-model';

export interface IndentOptions {
    /**
     * 缩进单位（空格数）
     */
    indentSize: number;
    
    /**
     * 最大缩进级别
     */
    maxIndentLevel: number;
    
    /**
     * 支持缩进的节点类型
     */
    types: string[];
}

const IndentPluginKey = new PluginKey('indent');

export const Indent = Extension.create<IndentOptions>({
    name: 'indent',

    addOptions() {
        return {
            indentSize: 2, // 每级缩进2个空格
            maxIndentLevel: 10, // 最大10级缩进
            types: ['paragraph', 'heading', 'blockquote'], // 支持缩进的节点类型
        };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    indent: {
                        default: 0,
                        parseHTML: element => {
                            const style = element.getAttribute('style') || '';
                            const match = style.match(/margin-left:\s*(\d+)px/);
                            if (match) {
                                return Math.round(parseInt(match[1]) / (this.options.indentSize * 16)); // 假设1rem = 16px
                            }
                            return 0;
                        },
                        renderHTML: attributes => {
                            if (!attributes.indent || attributes.indent === 0) {
                                return {};
                            }
                            return {
                                style: `margin-left: ${attributes.indent * this.options.indentSize}rem`,
                            };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            indent: () => ({ tr, state, dispatch }) => {
                const { selection } = state;
                const { $from, $to } = selection;

                // 获取选中范围内的所有块级节点
                const blocks: { node: ProseMirrorNode; pos: number }[] = [];
                
                state.doc.nodesBetween($from.start(), $to.end(), (node, pos) => {
                    if (this.options.types.includes(node.type.name)) {
                        blocks.push({ node, pos });
                    }
                });

                if (blocks.length === 0) return false;

                blocks.forEach(({ node, pos }) => {
                    const currentIndent = node.attrs.indent || 0;
                    if (currentIndent < this.options.maxIndentLevel) {
                        tr.setNodeMarkup(pos, undefined, {
                            ...node.attrs,
                            indent: currentIndent + 1,
                        });
                    }
                });

                if (dispatch) dispatch(tr);
                return true;
            },

            outdent: () => ({ tr, state, dispatch }) => {
                const { selection } = state;
                const { $from, $to } = selection;

                // 获取选中范围内的所有块级节点
                const blocks: { node: ProseMirrorNode; pos: number }[] = [];
                
                state.doc.nodesBetween($from.start(), $to.end(), (node, pos) => {
                    if (this.options.types.includes(node.type.name)) {
                        blocks.push({ node, pos });
                    }
                });

                if (blocks.length === 0) return false;

                blocks.forEach(({ node, pos }) => {
                    const currentIndent = node.attrs.indent || 0;
                    if (currentIndent > 0) {
                        tr.setNodeMarkup(pos, undefined, {
                            ...node.attrs,
                            indent: currentIndent - 1,
                        });
                    }
                });

                if (dispatch) dispatch(tr);
                return true;
            },
        };
    },

    addKeyboardShortcuts() {
        return {
            Tab: () => {
                // 如果在列表中，让列表处理缩进
                if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) {
                    // 对于列表项，使用内置的缩进命令
                    return this.editor.commands.sinkListItem('listItem') ||
                           this.editor.commands.sinkListItem('taskItem');
                }

                // 否则使用我们的缩进命令
                return this.editor.commands.indent();
            },

            'Shift-Tab': () => {
                // 如果在列表中，让列表处理缩进
                if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) {
                    // 对于列表项，使用内置的反缩进命令
                    return this.editor.commands.liftListItem('listItem') ||
                           this.editor.commands.liftListItem('taskItem');
                }

                // 否则使用我们的反缩进命令
                return this.editor.commands.outdent();
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: IndentPluginKey,
                
                props: {
                    handleKeyDown: (view, event) => {
                        // 处理 Tab 键，防止失焦
                        if (event.key === 'Tab') {
                            event.preventDefault();
                            
                            if (event.shiftKey) {
                                return this.editor.commands.outdent();
                            } else {
                                return this.editor.commands.indent();
                            }
                        }
                        return false;
                    },
                },
            }),
        ];
    },
});

export default Indent;
