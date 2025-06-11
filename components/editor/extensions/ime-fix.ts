/**
 * Tiptap 扩展：中文输入法优化
 * 专门处理中文输入法在 tiptap 编辑器中的问题
 * 与 CompositionManager 协同工作，避免冲突
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { isCurrentlyComposing } from 'libs/web/utils/simple-ime-fix';

export interface IMEFixOptions {
    /**
     * 是否启用 IME 修复
     */
    enabled: boolean;
    
    /**
     * 调试模式
     */
    debug: boolean;
}

const IMEFixPluginKey = new PluginKey('ime-fix');

export const IMEFix = Extension.create<IMEFixOptions>({
    name: 'ime-fix',

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
                key: IMEFixPluginKey,
                
                props: {
                    handleDOMEvents: {
                        // 不再处理 composition 事件，让 CompositionManager 统一处理
                        // 只处理在 composition 期间需要特殊处理的其他事件

                        // 处理输入事件，在 composition 期间可能需要特殊处理
                        beforeinput: (view, event) => {
                            if (isCurrentlyComposing()) {
                                if (this.options.debug) {
                                    console.log('IME Fix: beforeinput during composition', event);
                                }

                                // 在 composition 期间，某些输入事件可能需要特殊处理
                                // 这里可以根据需要添加特定的逻辑
                            }

                            return false;
                        },

                        // 处理键盘事件
                        keydown: (view, event) => {
                            if (isCurrentlyComposing()) {
                                if (this.options.debug) {
                                    console.log('IME Fix: keydown during composition', event);
                                }

                                const { state } = view;
                                const { $from } = state.selection;

                                // 智能处理 Enter 键：在空列表项中允许 markdown 扩展处理
                                if (event.key === 'Enter') {
                                    if ($from.parent.type.name === 'listItem' && $from.parent.textContent === '') {
                                        if (this.options.debug) {
                                            console.log('IME Fix: allowing Enter in empty list item');
                                        }
                                        return false; // 让 markdown 扩展处理
                                    }
                                    // 其他情况下在 composition 期间阻止 Enter
                                    return true;
                                }

                                // 其他可能干扰输入法的按键
                                const problematicKeys = ['Backspace', 'Delete', 'ArrowUp', 'ArrowDown'];

                                if (problematicKeys.includes(event.key)) {
                                    // 记录被阻止的按键（用于调试）
                                    const tr = state.tr.setMeta(IMEFixPluginKey, {
                                        type: 'keydown-prevented',
                                        key: event.key
                                    });
                                    view.dispatch(tr);

                                    // 让输入法处理这些键，而不是编辑器
                                    return true; // 阻止编辑器处理
                                }
                            }

                            return false;
                        }
                    }
                },

                // 简化的状态管理，主要用于调试和监控
                state: {
                    init() {
                        return {
                            keydownEvents: 0,
                            preventedKeys: []
                        };
                    },

                    apply(tr, value) {
                        const meta = tr.getMeta(IMEFixPluginKey);

                        if (meta) {
                            switch (meta.type) {
                                case 'keydown-prevented':
                                    return {
                                        ...value,
                                        keydownEvents: value.keydownEvents + 1,
                                        preventedKeys: [...value.preventedKeys, meta.key].slice(-10) // 只保留最近10个
                                    };

                                default:
                                    return value;
                            }
                        }

                        return value;
                    }
                }
            })
        ];
    }
});

export default IMEFix;
