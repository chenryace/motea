/**
 * ProseMirror原生缩进扩展
 * 直接使用ProseMirror API，不依赖TipTap的高级抽象
 * 参考TaskItem的实现方式
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';

const IndentPluginKey = new PluginKey('prosemirror-indent');

// 缩进配置
const INDENT_SIZE = 30; // px
const MAX_INDENT = 240; // px

/**
 * 检查节点是否在列表中
 */
function isInList(state: any): boolean {
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
 * 获取当前节点的缩进级别
 */
function getIndentLevel(node: any): number {
    return node.attrs.indent || 0;
}

/**
 * 设置节点缩进
 */
function setIndent(state: any, dispatch: any, delta: number): boolean {
    const { selection, tr } = state;
    const { from, to } = selection;
    
    let changed = false;
    
    // 遍历选中范围内的所有节点
    tr.doc.nodesBetween(from, to, (node: any, pos: number) => {
        // 只处理段落和标题
        if (!['paragraph', 'heading'].includes(node.type.name)) {
            return true; // 继续遍历子节点
        }
        
        const currentIndent = getIndentLevel(node);
        const newIndent = Math.max(0, Math.min(MAX_INDENT, currentIndent + delta));
        
        if (newIndent !== currentIndent) {
            tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent: newIndent
            });
            changed = true;
        }
        
        return false; // 不遍历子节点
    });
    
    if (changed && dispatch) {
        dispatch(tr);
        return true;
    }
    
    return false;
}

/**
 * 处理Tab键
 */
function handleTab(state: any, dispatch: any): boolean {
    // 如果在列表中，让列表扩展处理
    if (isInList(state)) {
        return false;
    }
    
    // 处理普通文本缩进
    return setIndent(state, dispatch, INDENT_SIZE);
}

/**
 * 处理Shift+Tab键
 */
function handleShiftTab(state: any, dispatch: any): boolean {
    // 如果在列表中，让列表扩展处理
    if (isInList(state)) {
        return false;
    }
    
    // 处理普通文本取消缩进
    return setIndent(state, dispatch, -INDENT_SIZE);
}

export const ProseMirrorIndentExtension = Extension.create({
    name: 'prosemirror-indent',
    priority: 50, // 低优先级，让列表扩展优先处理

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
            indent: () => ({ state, dispatch }) => {
                if (isInList(state)) {
                    return false; // 让列表扩展处理
                }
                return setIndent(state, dispatch, INDENT_SIZE);
            },
            outdent: () => ({ state, dispatch }) => {
                if (isInList(state)) {
                    return false; // 让列表扩展处理
                }
                return setIndent(state, dispatch, -INDENT_SIZE);
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            // 键盘快捷键插件
            keymap({
                'Tab': handleTab,
                'Shift-Tab': handleShiftTab,
            }),
            
            // 主要的缩进处理插件
            new Plugin({
                key: IndentPluginKey,
                
                props: {
                    // 处理键盘事件
                    handleKeyDown(view, event) {
                        const { state } = view;
                        
                        // Tab键处理
                        if (event.key === 'Tab' && !event.shiftKey) {
                            if (handleTab(state, view.dispatch)) {
                                event.preventDefault();
                                return true;
                            }
                        }
                        
                        // Shift+Tab键处理
                        if (event.key === 'Tab' && event.shiftKey) {
                            if (handleShiftTab(state, view.dispatch)) {
                                event.preventDefault();
                                return true;
                            }
                        }
                        
                        return false;
                    },
                },
                
                // 插件状态
                state: {
                    init() {
                        return {
                            indentCount: 0
                        };
                    },
                    apply(tr, value) {
                        // 跟踪缩进操作
                        const meta = tr.getMeta(IndentPluginKey);
                        if (meta) {
                            return {
                                ...value,
                                indentCount: value.indentCount + 1
                            };
                        }
                        return value;
                    }
                }
            })
        ];
    },
});

export default ProseMirrorIndentExtension;
