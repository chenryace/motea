/**
 * Universal Indent Extension for TipTap Editor
 * 为整个编辑器提供通用的缩进功能
 * 
 * Copyright (c) 2025 waycaan
 * Licensed under the MIT License
 */

import { Extension } from '@tiptap/core';

export const UniversalIndentExtension = Extension.create({
    name: 'universalIndent',
    priority: 1000,

    addCommands() {
        return {
            // 通用缩进命令
            indent: () => ({ state, dispatch }: any) => {
                const { selection } = state;
                const { from, to, $from } = selection;

                // 首先尝试列表项缩进（TipTap会自动处理多选情况）
                if (this.editor.commands.sinkListItem('listItem')) {
                    return true;
                }

                if (this.editor.commands.sinkListItem('taskItem')) {
                    return true;
                }

                // 如果不是列表项，处理普通文本缩进
                return this.handleTextIndent(state, dispatch, from, to);
            },
            
            // 通用取消缩进命令
            outdent: () => ({ state, dispatch }: any) => {
                const { selection } = state;
                const { from, to } = selection;

                // 首先尝试列表项取消缩进（TipTap会自动处理多选情况）
                if (this.editor.commands.liftListItem('listItem')) {
                    return true;
                }

                if (this.editor.commands.liftListItem('taskItem')) {
                    return true;
                }

                // 如果不是列表项，处理普通文本取消缩进
                return this.handleTextOutdent(state, dispatch, from, to);
            },
            // 处理普通文本缩进
            handleTextIndent: (state: any, dispatch: any, from: number, to: number) => {
                if (from === to) {
                    // 光标位置，插入缩进
                    const tr = state.tr.insertText('    ', from);
                    if (dispatch) dispatch(tr);
                    return true;
                } else {
                    // 选中文本，逐行处理缩进
                    const tr = state.tr;
                    let offset = 0;

                    // 找到选中范围内的所有行开始位置
                    const doc = state.doc;
                    const startLine = doc.resolve(from);
                    const endLine = doc.resolve(to);

                    // 从后往前处理，避免位置偏移问题
                    for (let pos = to; pos >= from; pos--) {
                        const resolved = doc.resolve(pos);
                        const char = doc.textBetween(pos, pos + 1);

                        // 如果是换行符的下一个位置，或者是选择的开始位置
                        if (char === '\n' || pos === from) {
                            const insertPos = char === '\n' ? pos + 1 : pos;
                            if (insertPos <= to + offset) {
                                tr.insertText('    ', insertPos);
                                offset += 4;
                            }
                        }
                    }

                    if (dispatch) dispatch(tr);
                    return true;
                }
            },

            // 处理普通文本取消缩进
            handleTextOutdent: (state: any, dispatch: any, from: number, to: number) => {
                if (from === to) {
                    // 光标位置，检查并移除前面的缩进
                    const { $from } = state.selection;
                    const lineStart = $from.start();
                    const textFromLineStart = state.doc.textBetween(lineStart, from);

                    if (textFromLineStart.endsWith('    ')) {
                        const tr = state.tr.delete(from - 4, from);
                        if (dispatch) dispatch(tr);
                        return true;
                    } else if (textFromLineStart.endsWith('\t')) {
                        const tr = state.tr.delete(from - 1, from);
                        if (dispatch) dispatch(tr);
                        return true;
                    }
                } else {
                    // 选中文本，逐行处理取消缩进
                    const tr = state.tr;
                    let offset = 0;
                    const doc = state.doc;

                    // 从后往前处理，避免位置偏移问题
                    for (let pos = to; pos >= from; pos--) {
                        const char = doc.textBetween(pos, pos + 1);

                        // 如果是换行符的下一个位置，或者是选择的开始位置
                        if (char === '\n' || pos === from) {
                            const checkPos = char === '\n' ? pos + 1 : pos;
                            if (checkPos <= to + offset) {
                                // 检查这个位置开始是否有缩进
                                const nextFour = doc.textBetween(checkPos, checkPos + 4);
                                const nextOne = doc.textBetween(checkPos, checkPos + 1);

                                if (nextFour === '    ') {
                                    tr.delete(checkPos, checkPos + 4);
                                    offset -= 4;
                                } else if (nextOne === '\t') {
                                    tr.delete(checkPos, checkPos + 1);
                                    offset -= 1;
                                }
                            }
                        }
                    }

                    if (dispatch) dispatch(tr);
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
                key: new (require('prosemirror-state').PluginKey)('universalIndentHandler'),
                props: {
                    handleKeyDown: (view: any, event: KeyboardEvent) => {
                        // 只处理Enter键
                        if (event.key !== 'Enter') {
                            return false;
                        }

                        const { state } = view;
                        const { selection } = state;
                        const { $from } = selection;

                        // 检查是否在列表项中，如果是，让列表处理
                        const isInList = $from.node(-1)?.type.name === 'listItem' ||
                                        $from.node(-2)?.type.name === 'listItem' ||
                                        $from.node(-3)?.type.name === 'listItem';
                        
                        const isInTaskList = $from.node(-1)?.type.name === 'taskItem' ||
                                            $from.node(-2)?.type.name === 'taskItem' ||
                                            $from.node(-3)?.type.name === 'taskItem';

                        if (isInList || isInTaskList) {
                            return false; // 让列表扩展处理
                        }

                        // 检测当前行的缩进
                        const lineStart = $from.start();
                        const lineEnd = $from.end();
                        const currentLine = state.doc.textBetween(lineStart, lineEnd);
                        
                        // 检测行开头的缩进
                        const indentMatch = currentLine.match(/^(\s+)/);
                        if (indentMatch) {
                            const indent = indentMatch[1];
                            
                            // 如果当前行只有缩进（空行），不保持缩进
                            if (currentLine.trim() === '') {
                                return false; // 让默认行为处理
                            }
                            
                            // 创建新行并保持缩进
                            const tr = state.tr;
                            tr.insertText('\n' + indent, $from.pos);
                            view.dispatch(tr);
                            
                            event.preventDefault();
                            return true;
                        }

                        return false; // 让默认行为处理
                    },
                }
            })
        ];
    },
});

export default UniversalIndentExtension;
