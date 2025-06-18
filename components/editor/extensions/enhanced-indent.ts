/**
 * 增强缩进扩展
 * 非入侵性地为编辑器添加缩进功能
 * 不修改StarterKit，而是扩展现有功能
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';

const EnhancedIndentPluginKey = new PluginKey('enhanced-indent');

// 缩进配置
const INDENT_SIZE = 30; // px
const MAX_INDENT = 240; // px

/**
 * 检查是否在列表环境中
 */
function isInListContext(state: any): boolean {
    const { $from } = state.selection;
    
    // 检查当前节点及其父节点
    for (let depth = $from.depth; depth >= 0; depth--) {
        const node = $from.node(depth);
        if (['listItem', 'taskItem', 'bulletList', 'orderedList', 'taskList'].includes(node.type.name)) {
            return true;
        }
    }
    
    return false;
}

/**
 * 为普通文本节点添加缩进
 */
function addTextIndent(state: any, dispatch: any): boolean {
    if (isInListContext(state)) {
        return false; // 让列表扩展处理
    }
    
    const { selection, tr } = state;
    const { from, to } = selection;
    
    let changed = false;
    
    // 遍历选中范围内的节点
    tr.doc.nodesBetween(from, to, (node: any, pos: number) => {
        // 只处理段落和标题
        if (!['paragraph', 'heading'].includes(node.type.name)) {
            return true;
        }
        
        const currentIndent = node.attrs.indent || 0;
        const newIndent = Math.min(MAX_INDENT, currentIndent + INDENT_SIZE);
        
        if (newIndent !== currentIndent) {
            tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent: newIndent
            });
            changed = true;
        }
        
        return false;
    });
    
    if (changed && dispatch) {
        dispatch(tr);
        return true;
    }
    
    return false;
}

/**
 * 为普通文本节点移除缩进
 */
function removeTextIndent(state: any, dispatch: any): boolean {
    if (isInListContext(state)) {
        return false; // 让列表扩展处理
    }
    
    const { selection, tr } = state;
    const { from, to } = selection;
    
    let changed = false;
    
    // 遍历选中范围内的节点
    tr.doc.nodesBetween(from, to, (node: any, pos: number) => {
        // 只处理段落和标题
        if (!['paragraph', 'heading'].includes(node.type.name)) {
            return true;
        }
        
        const currentIndent = node.attrs.indent || 0;
        const newIndent = Math.max(0, currentIndent - INDENT_SIZE);
        
        if (newIndent !== currentIndent) {
            tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent: newIndent
            });
            changed = true;
        }
        
        return false;
    });
    
    if (changed && dispatch) {
        dispatch(tr);
        return true;
    }
    
    return false;
}

export const EnhancedIndentExtension = Extension.create({
    name: 'enhanced-indent',
    priority: 50, // 低优先级，让列表扩展优先

    addGlobalAttributes() {
        return [
            {
                types: ['heading', 'paragraph'],
                attributes: {
                    indent: {
                        default: 0,
                        renderHTML: attributes => {
                            if (!attributes.indent) return {};
                            return {
                                style: `margin-left: ${attributes.indent}px;`
                            };
                        },
                        parseHTML: element => {
                            const style = element.getAttribute('style');
                            if (!style) return { indent: 0 };
                            
                            const match = style.match(/margin-left:\s*(\d+)px/);
                            return {
                                indent: match ? parseInt(match[1], 10) : 0
                            };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            indentText: () => ({ state, dispatch }) => {
                return addTextIndent(state, dispatch);
            },
            outdentText: () => ({ state, dispatch }) => {
                return removeTextIndent(state, dispatch);
            },
        };
    },

    addKeyboardShortcuts() {
        return {
            'Tab': () => {
                // 首先尝试列表缩进
                if (this.editor.commands.sinkListItem('listItem')) {
                    return true;
                }
                if (this.editor.commands.sinkListItem('taskItem')) {
                    return true;
                }
                
                // 如果不在列表中，处理普通文本缩进
                return this.editor.commands.indentText();
            },
            'Shift-Tab': () => {
                // 首先尝试列表取消缩进
                if (this.editor.commands.liftListItem('listItem')) {
                    return true;
                }
                if (this.editor.commands.liftListItem('taskItem')) {
                    return true;
                }
                
                // 如果不在列表中，处理普通文本取消缩进
                return this.editor.commands.outdentText();
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: EnhancedIndentPluginKey,
                
                props: {
                    // 处理键盘事件
                    handleKeyDown(view, event) {
                        const { state } = view;
                        
                        // Tab键处理
                        if (event.key === 'Tab' && !event.shiftKey) {
                            // 首先检查是否在列表中
                            if (isInListContext(state)) {
                                return false; // 让列表扩展处理
                            }
                            
                            // 处理普通文本缩进
                            if (addTextIndent(state, view.dispatch)) {
                                event.preventDefault();
                                return true;
                            }
                        }
                        
                        // Shift+Tab键处理
                        if (event.key === 'Tab' && event.shiftKey) {
                            // 首先检查是否在列表中
                            if (isInListContext(state)) {
                                return false; // 让列表扩展处理
                            }
                            
                            // 处理普通文本取消缩进
                            if (removeTextIndent(state, view.dispatch)) {
                                event.preventDefault();
                                return true;
                            }
                        }
                        
                        return false;
                    },
                },
            })
        ];
    },
});

export default EnhancedIndentExtension;
