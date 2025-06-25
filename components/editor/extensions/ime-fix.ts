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
                        // 监听composition事件，同步状态到全局状态管理器
                        compositionstart: (view, event) => {
                            stateManager.updateCompositionState(true, event.data);

                            if (this.options.debug) {
                                console.log('🎯 IMEFix: Composition started', { data: event.data });
                            }

                            // 不阻止事件，让ProseMirror正常处理
                            return false;
                        },

                        compositionupdate: (view, event) => {
                            stateManager.updateCompositionState(true, event.data);

                            if (this.options.debug) {
                                console.log('🎯 IMEFix: Composition updating', { data: event.data });
                            }

                            return false;
                        },

                        compositionend: (view, event) => {
                            stateManager.updateCompositionState(false, event.data);

                            if (this.options.debug) {
                                console.log('🎯 IMEFix: Composition ended', { data: event.data });
                            }

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
