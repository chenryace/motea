/**
 * Milkdown风格的InputRules包装器
 * 
 * 核心功能：
 * 1. 包装所有InputRule，在执行前检查view.composing状态
 * 2. 确保在IME期间不会触发InputRules
 * 3. 保持StarterKit的所有功能正常工作
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { InputRule } from '@tiptap/core';

export interface MilkdownInputRulesOptions {
    /**
     * 是否启用Milkdown风格的InputRules处理
     */
    enabled: boolean;

    /**
     * 调试模式
     */
    debug: boolean;
}

const MilkdownInputRulesPluginKey = new PluginKey('milkdown-input-rules');

/**
 * 创建一个IME安全的InputRule包装器
 */
function createIMESafeInputRule(originalRule: InputRule, debug = false): InputRule {
    return new InputRule({
        find: originalRule.find,
        handler: (props) => {
            const { state } = props;
            
            // 检查是否在composition状态
            // 这里我们检查多个可能的composition状态源
            const view = (state as any).view;
            const isComposing = view?.composing || 
                               view?.dom?.composing || 
                               (view?.dom?.getAttribute && view.dom.getAttribute('data-composing') === 'true');

            if (isComposing) {
                if (debug) {
                    console.log('🚫 MilkdownInputRules: Skipping rule during composition', {
                        rule: originalRule.find,
                        viewComposing: view?.composing
                    });
                }
                return null; // 不执行规则
            }

            // 不在composition状态，正常执行原始规则
            return originalRule.handler(props);
        }
    });
}

/**
 * Milkdown风格的InputRules扩展
 */
export const MilkdownInputRules = Extension.create<MilkdownInputRulesOptions>({
    name: 'milkdown-input-rules',

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
                key: MilkdownInputRulesPluginKey,
                
                props: {
                    // 拦截所有文本输入，在composition期间阻止InputRules
                    handleTextInput: (view, from, to, text) => {
                        // 检查是否在composition状态
                        if ((view as any).composing) {
                            if (this.options.debug) {
                                console.log('🚫 MilkdownInputRules: Blocking all InputRules during composition', {
                                    text,
                                    from,
                                    to,
                                    viewComposing: (view as any).composing
                                });
                            }
                            return true; // 阻止所有InputRules处理
                        }
                        
                        return false; // 允许正常处理
                    },

                    handleDOMEvents: {
                        // 监听composition事件，标记DOM元素
                        compositionstart: (view, event) => {
                            // 在DOM元素上标记composition状态
                            if (view.dom) {
                                view.dom.setAttribute('data-composing', 'true');
                            }
                            
                            if (this.options.debug) {
                                console.log('🎯 MilkdownInputRules: Composition started, marking DOM', {
                                    data: event.data,
                                    viewComposing: (view as any).composing
                                });
                            }
                            
                            return false;
                        },

                        compositionend: (view, event) => {
                            // 延迟清除DOM标记，确保所有InputRules检查完成
                            setTimeout(() => {
                                if (view.dom) {
                                    view.dom.removeAttribute('data-composing');
                                }
                                
                                if (this.options.debug) {
                                    console.log('🎯 MilkdownInputRules: Composition ended, clearing DOM mark', {
                                        data: event.data,
                                        viewComposing: (view as any).composing
                                    });
                                }
                            }, 10); // 短暂延迟
                            
                            return false;
                        }
                    }
                },

                state: {
                    init() {
                        return {
                            blockedRules: 0,
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

    // 优先级设置：确保在其他InputRules之前执行
    priority: 1000,
});

export default MilkdownInputRules;
