/**
 * Milkdown风格的粘贴处理器
 * 
 * 核心功能：
 * 1. 在粘贴事件中判断composing状态
 * 2. 确保粘贴逻辑是IME安全的
 * 3. 防止在composition期间的粘贴操作干扰IME
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';

export interface MilkdownPasteHandlerOptions {
    /**
     * 是否启用Milkdown风格的粘贴处理
     */
    enabled: boolean;

    /**
     * 调试模式
     */
    debug: boolean;
}

const MilkdownPasteHandlerPluginKey = new PluginKey('milkdown-paste-handler');

/**
 * Milkdown风格的粘贴处理扩展
 */
export const MilkdownPasteHandler = Extension.create<MilkdownPasteHandlerOptions>({
    name: 'milkdown-paste-handler',

    addOptions() {
        return {
            enabled: true,
            debug: false,
        };
    },

    addProseMirrorPlugins() {
        if (!this.options.enabled) {
            return [];
        }

        return [
            new Plugin({
                key: MilkdownPasteHandlerPluginKey,
                
                props: {
                    // Milkdown标准：粘贴事件中判断composing状态
                    handlePaste: (view, event, slice) => {
                        // 检查是否在composition状态
                        const isComposing = (view as any).composing || 
                                          view.dom?.getAttribute('data-composing') === 'true';

                        if (isComposing) {
                            if (this.options.debug) {
                                console.log('🚫 MilkdownPasteHandler: Blocking paste during composition', {
                                    sliceSize: slice.size,
                                    viewComposing: (view as any).composing
                                });
                            }
                            
                            // 阻止在composition期间的粘贴
                            event.preventDefault();
                            return true;
                        }

                        if (this.options.debug) {
                            console.log('✅ MilkdownPasteHandler: Allowing paste (not composing)', {
                                sliceSize: slice.size,
                                viewComposing: (view as any).composing
                            });
                        }

                        // 不在composition状态，允许正常粘贴
                        return false;
                    },

                    // 处理拖拽粘贴
                    handleDrop: (view, event, slice, moved) => {
                        const isComposing = (view as any).composing || 
                                          view.dom?.getAttribute('data-composing') === 'true';

                        if (isComposing) {
                            if (this.options.debug) {
                                console.log('🚫 MilkdownPasteHandler: Blocking drop during composition');
                            }
                            
                            event.preventDefault();
                            return true;
                        }

                        return false;
                    }
                },

                state: {
                    init() {
                        return {
                            blockedPastes: 0,
                            blockedDrops: 0,
                            lastBlockTime: 0
                        };
                    },

                    apply(tr, value) {
                        // 简单的状态跟踪
                        return value;
                    }
                }
            })
        ];
    },

    // 优先级设置：确保在其他粘贴处理器之前执行
    priority: 1000,
});

export default MilkdownPasteHandler;
