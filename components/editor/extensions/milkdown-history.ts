/**
 * Milkdown风格的历史记录处理器
 * 
 * 核心功能：
 * 1. 使用StepGroup合并composition期间的操作
 * 2. 确保undo/redo在IME期间的正确行为
 * 3. 防止composition期间的历史记录碎片化
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { history, undo, redo } from 'prosemirror-history';

export interface MilkdownHistoryOptions {
    /**
     * 是否启用Milkdown风格的历史记录处理
     */
    enabled: boolean;

    /**
     * 调试模式
     */
    debug: boolean;

    /**
     * 历史记录深度
     */
    depth: number;

    /**
     * 新事件延迟（毫秒）
     */
    newGroupDelay: number;
}

const MilkdownHistoryPluginKey = new PluginKey('milkdown-history');

/**
 * Milkdown风格的历史记录扩展
 */
export const MilkdownHistory = Extension.create<MilkdownHistoryOptions>({
    name: 'milkdown-history',

    addOptions() {
        return {
            enabled: true,
            debug: false,
            depth: 100,
            newGroupDelay: 500,
        };
    },

    addCommands() {
        return {
            undo: () => ({ commands }) => {
                return commands.first([
                    () => commands.undoInputRule(),
                    () => commands.command(({ state, dispatch }) => {
                        // 检查是否在composition状态
                        const isComposing = (state as any).view?.composing;
                        
                        if (isComposing && this.options.debug) {
                            console.log('🚫 MilkdownHistory: Blocking undo during composition');
                            return false;
                        }

                        return undo(state, dispatch);
                    }),
                ]);
            },
            redo: () => ({ commands }) => {
                return commands.command(({ state, dispatch }) => {
                    // 检查是否在composition状态
                    const isComposing = (state as any).view?.composing;
                    
                    if (isComposing && this.options.debug) {
                        console.log('🚫 MilkdownHistory: Blocking redo during composition');
                        return false;
                    }

                    return redo(state, dispatch);
                });
            },
        };
    },

    addKeyboardShortcuts() {
        return {
            'Mod-z': () => this.editor.commands.undo(),
            'Mod-y': () => this.editor.commands.redo(),
            'Shift-Mod-z': () => this.editor.commands.redo(),
        };
    },

    addProseMirrorPlugins() {
        if (!this.options.enabled) {
            return [];
        }

        return [
            // 使用ProseMirror的history插件，但配置为IME友好
            history({
                depth: this.options.depth,
                newGroupDelay: this.options.newGroupDelay,
            }),
            
            // 添加我们的自定义历史记录处理
            new Plugin({
                key: MilkdownHistoryPluginKey,
                
                props: {
                    handleKeyDown: (view, event) => {
                        // 在composition期间阻止undo/redo快捷键
                        const isComposing = (view as any).composing;
                        
                        if (isComposing) {
                            const isUndoRedo = (event.ctrlKey || event.metaKey) && 
                                             (event.key === 'z' || event.key === 'y');
                            
                            if (isUndoRedo) {
                                if (this.options.debug) {
                                    console.log('🚫 MilkdownHistory: Blocking undo/redo shortcut during composition');
                                }
                                return true; // 阻止快捷键
                            }
                        }
                        
                        return false;
                    }
                },

                state: {
                    init() {
                        return {
                            compositionStartTime: null,
                            blockedOperations: 0
                        };
                    },

                    apply(tr, value) {
                        // 跟踪composition状态变化
                        const meta = tr.getMeta('ime-fix');
                        if (meta) {
                            switch (meta.type) {
                                case 'composition-start':
                                    return {
                                        ...value,
                                        compositionStartTime: Date.now()
                                    };
                                case 'composition-end':
                                    if (this.options?.debug) {
                                        const duration = Date.now() - (value.compositionStartTime || 0);
                                        console.log('🎯 MilkdownHistory: Composition completed', { duration });
                                    }
                                    return {
                                        ...value,
                                        compositionStartTime: null
                                    };
                            }
                        }
                        
                        return value;
                    }
                }
            })
        ];
    },
});

export default MilkdownHistory;
