/**
 * 智能InputRules扩展
 * 解决InputRules与IME的竞态冲突问题
 * 
 * 核心思路：
 * 1. 包装原有的InputRules处理逻辑
 * 2. 在IME期间暂停InputRules的执行
 * 3. 保持StarterKit的所有功能正常工作
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { getGlobalIMEStateManager } from 'libs/web/utils/ime-state-manager';

export interface SmartInputRulesOptions {
    /**
     * 是否启用智能InputRules
     */
    enabled: boolean;

    /**
     * 调试模式
     */
    debug: boolean;
}

const SmartInputRulesPluginKey = new PluginKey('smartInputRules');

/**
 * 智能InputRules扩展
 * 
 * 这个扩展会拦截InputRules的执行，在IME期间暂停处理，
 * 从而避免与composition事件的竞态冲突
 */
export const SmartInputRules = Extension.create<SmartInputRulesOptions>({
    name: 'smartInputRules',

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
                key: SmartInputRulesPluginKey,

                props: {
                    // 拦截handleTextInput，这是InputRules的主要入口
                    handleTextInput(view, from, to, text) {
                        const imeState = stateManager.getState();
                        
                        // 如果正在IME输入，暂停InputRules处理
                        if (imeState.isComposing) {
                            if (this.options?.debug) {
                                console.log('🚫 SmartInputRules: Blocking text input during IME', {
                                    text,
                                    from,
                                    to,
                                    compositionKey: imeState.compositionKey
                                });
                            }
                            return true; // 阻止其他InputRules处理
                        }

                        // 不在IME期间，让其他插件正常处理
                        return false;
                    },

                    handleDOMEvents: {
                        // 监听compositionend，在适当时机重新启用InputRules
                        compositionend: (view, event) => {
                            const imeState = stateManager.getState();
                            
                            if (this.options?.debug) {
                                console.log('🔄 SmartInputRules: Composition ended, will re-enable rules', {
                                    data: event.data,
                                    isComposing: imeState.isComposing
                                });
                            }

                            // 在composition结束后，给一个短暂的延迟
                            // 让IME状态管理器先更新状态
                            setTimeout(() => {
                                const updatedState = stateManager.getState();
                                if (!updatedState.isComposing && this.options?.debug) {
                                    console.log('✅ SmartInputRules: IME state cleared, rules re-enabled');
                                }
                            }, 60); // 比IME状态管理器的延迟稍长

                            return false;
                        }
                    }
                },

                // 简单的状态管理
                state: {
                    init() {
                        return {
                            blocked: false,
                            lastBlockTime: 0
                        };
                    },

                    apply(tr, value) {
                        // 简单地跟踪状态
                        return value;
                    }
                }
            })
        ];
    }
});

export default SmartInputRules;
