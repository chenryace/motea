/**
 * TipTap IME扩展 - 基于Milkdown标准实现
 *
 * 核心设计原则（参考Milkdown）：
 * 1. 维护 view.composing 状态 - 标准的ProseMirror IME状态
 * 2. 阻止 InputRule 执行 - 在composition期间禁用输入规则
 * 3. 命令执行防干扰 - 使用 view.composing 拦截命令
 * 4. Markdown 模式下标记延迟 - compositionend 后再触发解析
 * 5. 编辑器状态同步控制 - 所有扩展遵循组合期间禁写规则
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { getGlobalIMEStateManager } from 'libs/web/utils/ime-state-manager';

export interface IMEFixOptions {
    /**
     * 是否启用IME处理
     */
    enabled: boolean;

    /**
     * 调试模式
     */
    debug: boolean;

    /**
     * 是否阻止InputRules在IME期间执行
     */
    blockInputRules: boolean;

    /**
     * 是否阻止命令在IME期间执行
     */
    blockCommands: boolean;
}

interface IMEPluginState {
    isComposing: boolean;
    lastCompositionData: string | null;
    timestamp: number;
    // Milkdown标准：记录composition开始时的选择范围
    compositionRange: { from: number; to: number } | null;
}

const IMEFixPluginKey = new PluginKey<IMEPluginState>('ime-fix');

export const IMEFix = Extension.create<IMEFixOptions>({
    name: 'ime-fix',

    addOptions() {
        return {
            enabled: true,
            debug: false,
            blockInputRules: true,  // Milkdown标准：阻止InputRules
            blockCommands: true,    // Milkdown标准：阻止命令执行
        };
    },

    addProseMirrorPlugins() {
        if (!this.options.enabled) {
            return [];
        }

        const stateManager = getGlobalIMEStateManager();

        return [
            new Plugin({
                key: IMEFixPluginKey,

                props: {
                    // Milkdown标准1: 阻止InputRule执行
                    handleTextInput: this.options.blockInputRules ? (view, from, to, text) => {
                        const pluginState = IMEFixPluginKey.getState(view.state);
                        if (pluginState?.isComposing) {
                            if (this.options.debug) {
                                console.log('🚫 IMEFix: Blocking InputRule during composition', { text, from, to });
                            }
                            return true; // 阻止InputRules处理
                        }
                        return false;
                    } : undefined,

                    // Milkdown标准2: 阻止命令执行
                    handleKeyDown: this.options.blockCommands ? (view, event) => {
                        const pluginState = IMEFixPluginKey.getState(view.state);
                        if (pluginState?.isComposing) {
                            // 阻止可能干扰IME的按键
                            if (event.key === 'Enter' || event.key === 'Tab' || event.key === 'Escape') {
                                if (this.options.debug) {
                                    console.log('🚫 IMEFix: Blocking command during composition', { key: event.key });
                                }
                                return true;
                            }
                        }
                        return false;
                    } : undefined,

                    handleDOMEvents: {
                        // Milkdown标准3: 维护composition状态
                        compositionstart: (view, event) => {
                            const { from, to } = view.state.selection;

                            // 更新插件状态
                            const tr = view.state.tr.setMeta(IMEFixPluginKey, {
                                type: 'composition-start',
                                range: { from, to },
                                data: event.data
                            });
                            view.dispatch(tr);

                            // 同步到全局状态管理器
                            stateManager.updateCompositionState(true, event.data, {
                                range: { from, to }
                            });

                            if (this.options.debug) {
                                console.log('🎯 IMEFix: Composition started (Milkdown style)', {
                                    data: event.data,
                                    range: { from, to },
                                    viewComposing: (view as any).composing
                                });
                            }

                            return false;
                        },

                        compositionupdate: (view, event) => {
                            // 更新composition数据
                            const tr = view.state.tr.setMeta(IMEFixPluginKey, {
                                type: 'composition-update',
                                data: event.data
                            });
                            view.dispatch(tr);

                            stateManager.updateCompositionState(true, event.data);

                            if (this.options.debug) {
                                console.log('🎯 IMEFix: Composition updating', {
                                    data: event.data,
                                    viewComposing: (view as any).composing
                                });
                            }

                            return false;
                        },

                        // Milkdown标准4: compositionend后延迟处理
                        compositionend: (view, event) => {
                            if (this.options.debug) {
                                console.log('🎯 IMEFix: Composition ending', {
                                    data: event.data,
                                    viewComposing: (view as any).composing
                                });
                            }

                            // Milkdown标准：延迟清理状态，确保所有相关处理完成
                            setTimeout(() => {
                                const tr = view.state.tr.setMeta(IMEFixPluginKey, {
                                    type: 'composition-end',
                                    data: event.data
                                });
                                view.dispatch(tr);

                                stateManager.updateCompositionState(false, event.data);

                                if (this.options.debug) {
                                    console.log('🎯 IMEFix: Composition ended (delayed)', {
                                        data: event.data,
                                        viewComposing: (view as any).composing
                                    });
                                }
                            }, 0); // 使用nextTick延迟

                            return false;
                        }
                    }
                },

                // Milkdown标准5: 状态管理
                state: {
                    init() {
                        return {
                            isComposing: false,
                            lastCompositionData: null,
                            timestamp: 0,
                            compositionRange: null
                        };
                    },

                    apply(tr, value) {
                        const meta = tr.getMeta(IMEFixPluginKey);
                        if (!meta) return value;

                        switch (meta.type) {
                            case 'composition-start':
                                return {
                                    ...value,
                                    isComposing: true,
                                    lastCompositionData: meta.data,
                                    timestamp: Date.now(),
                                    compositionRange: meta.range
                                };
                            case 'composition-update':
                                return {
                                    ...value,
                                    lastCompositionData: meta.data,
                                    timestamp: Date.now()
                                };
                            case 'composition-end':
                                return {
                                    ...value,
                                    isComposing: false,
                                    lastCompositionData: meta.data,
                                    timestamp: Date.now(),
                                    compositionRange: null
                                };
                            default:
                                return value;
                        }
                    }
                }
            })
        ];
    }
});

export default IMEFix;
