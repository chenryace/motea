/**
 * TipTap IME扩展 - 简化版本
 * 基于ProseMirror最佳实践，采用最小干预原则
 *
 * 设计理念：
 * 1. 信任ProseMirror - 让ProseMirror处理大部分IME逻辑
 * 2. 状态同步 - 只同步必要的composition状态到全局状态管理器
 * 3. 避免冲突 - 不阻止或修改ProseMirror的内置IME处理
 * 4. 简单可靠 - 移除复杂的RestoreDOM和事件拦截机制
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { getGlobalIMEStateManager } from 'libs/web/utils/ime-state-manager';

export interface IMEFixOptions {
    /**
     * 是否启用IME状态同步
     */
    enabled: boolean;

    /**
     * 调试模式
     */
    debug: boolean;
}

interface IMEPluginState {
    isComposing: boolean;
    lastCompositionData: string | null;
    timestamp: number;
}

const IMEFixPluginKey = new PluginKey<IMEPluginState>('ime-fix');

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

        const stateManager = getGlobalIMEStateManager();

        return [
            new Plugin({
                key: IMEFixPluginKey,

                props: {
                    handleDOMEvents: {
                        // 增强的composition事件处理，借鉴Lexical的细粒度管理
                        compositionstart: (view, event) => {
                            const { from, to } = view.state.selection;
                            const compositionId = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

                            // 使用增强的状态管理（借鉴Lexical）
                            stateManager.updateCompositionState(true, event.data, {
                                range: { from, to },
                                key: compositionId
                            });

                            if (this.options.debug) {
                                console.log('🎯 IMEFix: Composition started', {
                                    data: event.data,
                                    compositionId,
                                    range: { from, to }
                                });
                            }

                            // 不阻止事件，让ProseMirror正常处理
                            return false;
                        },

                        compositionupdate: (view, event) => {
                            // 保持当前的composition状态，但可以更新数据
                            stateManager.updateCompositionState(true, event.data, {
                                forceUpdate: false // 避免过多的状态更新
                            });

                            if (this.options.debug) {
                                console.log('🎯 IMEFix: Composition updating', {
                                    data: event.data,
                                    anomalyCount: stateManager.getState().anomalyCount
                                });
                            }

                            return false;
                        },

                        compositionend: (view, event) => {
                            if (this.options.debug) {
                                console.log('🎯 IMEFix: Composition ending (immediate)', { data: event.data });
                            }

                            // 关键：延迟清除composition状态
                            // 这样InputRules在compositionend的setTimeout中执行时，
                            // 仍然能检查到IME状态，从而避免竞态冲突
                            setTimeout(() => {
                                stateManager.updateCompositionState(false, event.data, {
                                    forceUpdate: true // 确保状态被正确清理
                                });

                                if (this.options.debug) {
                                    const state = stateManager.getState();
                                    console.log('🎯 IMEFix: Composition ended (delayed)', {
                                        data: event.data,
                                        anomalyCount: state.anomalyCount,
                                        environment: state.environment
                                    });
                                }
                            }, 50); // 延迟50ms，确保在InputRules的setTimeout之后执行

                            return false;
                        }
                    }
                },

                // 简化的状态管理，主要用于调试
                state: {
                    init() {
                        return {
                            isComposing: false,
                            lastCompositionData: null,
                            timestamp: 0
                        };
                    },

                    apply(tr, value) {
                        // 简单地跟踪状态，不做复杂处理
                        return value;
                    }
                }
            })
        ];
    }
});

export default IMEFix;
