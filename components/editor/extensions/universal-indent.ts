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
                
                // 检查是否在列表项中，如果是，使用列表的缩进
                const isInList = $from.node(-1)?.type.name === 'listItem' ||
                                $from.node(-2)?.type.name === 'listItem' ||
                                $from.node(-3)?.type.name === 'listItem';
                
                const isInTaskList = $from.node(-1)?.type.name === 'taskItem' ||
                                    $from.node(-2)?.type.name === 'taskItem' ||
                                    $from.node(-3)?.type.name === 'taskItem';
                
                if (isInList) {
                    return this.editor.commands.sinkListItem('listItem');
                }
                
                if (isInTaskList) {
                    return this.editor.commands.sinkListItem('taskItem');
                }
                
                // 通用缩进：处理选中文本或光标位置
                if (from === to) {
                    // 光标位置，插入缩进
                    const tr = state.tr.insertText('    ', from);
                    if (dispatch) dispatch(tr);
                    return true;
                } else {
                    // 选中文本，对每行添加缩进
                    const selectedText = state.doc.textBetween(from, to);
                    const lines = selectedText.split('\n');
                    const indentedText = lines.map((line: string) => '    ' + line).join('\n');
                    
                    const tr = state.tr.replaceWith(from, to, state.schema.text(indentedText));
                    if (dispatch) dispatch(tr);
                    return true;
                }
            },
            
            // 通用取消缩进命令
            outdent: () => ({ state, dispatch }: any) => {
                const { selection } = state;
                const { from, to, $from } = selection;
                
                // 检查是否在列表项中，如果是，使用列表的取消缩进
                const isInList = $from.node(-1)?.type.name === 'listItem' ||
                                $from.node(-2)?.type.name === 'listItem' ||
                                $from.node(-3)?.type.name === 'listItem';
                
                const isInTaskList = $from.node(-1)?.type.name === 'taskItem' ||
                                    $from.node(-2)?.type.name === 'taskItem' ||
                                    $from.node(-3)?.type.name === 'taskItem';
                
                if (isInList) {
                    return this.editor.commands.liftListItem('listItem');
                }
                
                if (isInTaskList) {
                    return this.editor.commands.liftListItem('taskItem');
                }
                
                // 通用取消缩进
                if (from === to) {
                    // 光标位置，检查并移除前面的缩进
                    const lineStart = $from.start();
                    const textFromLineStart = state.doc.textBetween(lineStart, from);
                    
                    // 检查是否有缩进可以移除
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
                    // 选中文本，对每行移除缩进
                    const selectedText = state.doc.textBetween(from, to);
                    const lines = selectedText.split('\n');
                    const outdentedText = lines.map((line: string) => {
                        if (line.startsWith('    ')) {
                            return line.substring(4);
                        } else if (line.startsWith('\t')) {
                            return line.substring(1);
                        }
                        return line;
                    }).join('\n');
                    
                    const tr = state.tr.replaceWith(from, to, state.schema.text(outdentedText));
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
