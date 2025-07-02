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

    /**
     * 是否启用快速输入检测
     */
    enableRapidInputDetection: boolean;

    /**
     * 快速输入检测延时（毫秒）
     */
    rapidInputDelay: number;
}

interface IMEPluginState {
    isComposing: boolean;
    lastCompositionData: string | null;
    timestamp: number;
    // 快速输入检测相关
    rapidInputDetected: boolean;
    lastInputTime: number;
    pendingCompositionTimeout: number | null;
}

const IMEFixPluginKey = new PluginKey<IMEPluginState>('ime-fix');

/**
 * 检测是否为快速输入（可能是中文输入的拼音）
 */
function isRapidInput(text: string, lastInputTime: number): boolean {
    const now = Date.now();
    const timeSinceLastInput = now - lastInputTime;

    // 快速输入的特征：
    // 1. 连续的字母输入
    // 2. 时间间隔很短（< 100ms）
    // 3. 不是明显的命令（如 #、*、> 等）
    const isLettersOnly = /^[a-zA-Z]+$/.test(text);
    const isRapid = timeSinceLastInput < 100;
    const isNotCommand = !text.match(/^[#*>\-\+\[\]]/);

    return isLettersOnly && isRapid && isNotCommand && text.length > 0;
}

/**
 * 模拟触发composition事件
 */
function simulateCompositionStart(view: any, text: string, debug: boolean) {
    if (debug) {
        console.log('🚀 IMEFix: Simulating composition start for rapid input', { text });
    }

    // 创建并触发compositionstart事件
    const compositionStartEvent = new CompositionEvent('compositionstart', {
        data: text,
        bubbles: true,
        cancelable: true
    });

    // 在DOM元素上触发事件
    if (view.dom) {
        view.dom.dispatchEvent(compositionStartEvent);
    }
}

export const IMEFix = Extension.create<IMEFixOptions>({
    name: 'ime-fix',

    addOptions() {
        return {
            enabled: true,
            debug: false,
            enableRapidInputDetection: true,
            rapidInputDelay: 20, // 20ms延时
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
                    // 核心：在InputRules层面添加快速输入检测
                    handleTextInput: this.options.enableRapidInputDetection ? (view, from, to, text) => {
                        const pluginState = IMEFixPluginKey.getState(view.state);

                        // 如果已经在composition状态，不干预
                        if (view.composing || pluginState?.isComposing || pluginState?.rapidInputDetected) {
                            return false;
                        }

                        // 检测是否为快速输入
                        const isRapid = isRapidInput(text, pluginState?.lastInputTime || 0);

                        if (isRapid) {
                            if (this.options.debug) {
                                console.log('🚀 IMEFix: Rapid input detected, redirecting to composition', {
                                    text,
                                    from,
                                    to
                                });
                            }

                            // 立即更新插件状态，标记为快速输入检测
                            const tr = view.state.tr.setMeta(IMEFixPluginKey, {
                                type: 'rapid-input-detected',
                                text,
                                from,
                                to,
                                timestamp: Date.now()
                            });
                            view.dispatch(tr);

                            // 短延时后模拟composition事件，让composition流程接管
                            setTimeout(() => {
                                // 检查状态是否还有效（避免重复触发）
                                const currentState = IMEFixPluginKey.getState(view.state);
                                if (currentState?.rapidInputDetected) {
                                    simulateCompositionStart(view, text, this.options.debug);
                                }
                            }, this.options.rapidInputDelay);

                            return true; // 阻止原始InputRules处理
                        }

                        // 更新最后输入时间
                        const tr = view.state.tr.setMeta(IMEFixPluginKey, {
                            type: 'update-input-time',
                            timestamp: Date.now()
                        });
                        view.dispatch(tr);

                        return false; // 允许正常处理
                    } : undefined,

                    handleDOMEvents: {
                        // 监听真实的composition事件
                        compositionstart: (view, event) => {
                            const { from, to } = view.state.selection;

                            // 更新插件状态
                            const tr = view.state.tr.setMeta(IMEFixPluginKey, {
                                type: 'composition-start',
                                data: event.data,
                                range: { from, to }
                            });
                            view.dispatch(tr);

                            // 同步到全局状态管理器
                            stateManager.updateCompositionState(true, event.data, {
                                range: { from, to }
                            });

                            if (this.options.debug) {
                                console.log('🎯 IMEFix: Real composition started', {
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

                        compositionend: (view, event) => {
                            // 更新插件状态，清理所有composition相关状态
                            const tr = view.state.tr.setMeta(IMEFixPluginKey, {
                                type: 'composition-end',
                                data: event.data
                            });
                            view.dispatch(tr);

                            stateManager.updateCompositionState(false, event.data);

                            if (this.options.debug) {
                                console.log('🎯 IMEFix: Composition ended', {
                                    data: event.data,
                                    viewComposing: (view as any).composing
                                });
                            }

                            return false;
                        }
                    }
                },

                // 状态管理
                state: {
                    init() {
                        return {
                            isComposing: false,
                            lastCompositionData: null,
                            timestamp: 0,
                            rapidInputDetected: false,
                            lastInputTime: 0,
                            pendingCompositionTimeout: null
                        };
                    },

                    apply(tr, value) {
                        const meta = tr.getMeta(IMEFixPluginKey);
                        if (!meta) return value;

                        switch (meta.type) {
                            case 'rapid-input-detected':
                                return {
                                    ...value,
                                    rapidInputDetected: true,
                                    lastInputTime: meta.timestamp,
                                    timestamp: meta.timestamp
                                };
                            case 'update-input-time':
                                return {
                                    ...value,
                                    lastInputTime: meta.timestamp
                                };
                            case 'composition-start':
                                return {
                                    ...value,
                                    isComposing: true,
                                    rapidInputDetected: false, // 真实composition开始，清除快速输入标记
                                    lastCompositionData: meta.data,
                                    timestamp: Date.now()
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
                                    rapidInputDetected: false, // 清除所有标记
                                    lastCompositionData: meta.data,
                                    timestamp: Date.now(),
                                    pendingCompositionTimeout: null
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
