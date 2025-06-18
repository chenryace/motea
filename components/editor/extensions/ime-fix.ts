/**
 * Tiptap 扩展：现代IME处理
 * 基于BeforeInput + RestoreDOM的现代方案
 * 不依赖延时策略，使用事件驱动处理IME输入
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { ModernIMEHandler } from 'libs/web/utils/modern-ime-handler';
import { restoreDOM, getEditableElement } from 'libs/web/utils/restore-dom';

export interface ModernIMEFixOptions {
    /**
     * 是否启用现代IME处理
     */
    enabled: boolean;

    /**
     * 调试模式
     */
    debug: boolean;

    /**
     * 是否强制使用RestoreDOM（即使不是移动设备）
     */
    forceRestoreDOM: boolean;
}

const ModernIMEFixPluginKey = new PluginKey('modern-ime-fix');

export const IMEFix = Extension.create<ModernIMEFixOptions>({
    name: 'modern-ime-fix',

    addOptions() {
        return {
            enabled: true,
            debug: false,
            forceRestoreDOM: false,
        };
    },

    addProseMirrorPlugins() {
        if (!this.options.enabled) {
            return [];
        }

        return [
            new Plugin({
                key: ModernIMEFixPluginKey,

                view: (editorView) => {
                    // 创建现代IME处理器
                    let imeHandler: ModernIMEHandler | null = null;

                    // 等待DOM准备好后初始化
                    setTimeout(() => {
                        const editableElement = getEditableElement(editorView.dom);
                        if (editableElement) {
                            imeHandler = new ModernIMEHandler(editableElement, {
                                debug: this.options.debug,
                                forceRestoreDOM: this.options.forceRestoreDOM,
                                editor: this.editor, // 传递编辑器实例
                                onChange: (getValue) => {
                                    // 这里可以添加额外的onChange处理
                                    if (this.options.debug) {
                                        console.log('🎯 Modern IME: Content changed via IME');
                                    }
                                }
                            });
                        }
                    }, 0);

                    return {
                        destroy() {
                            if (imeHandler) {
                                imeHandler.destroy();
                                imeHandler = null;
                            }
                        }
                    };
                },

                props: {
                    handleDOMEvents: {
                        // 现代方案主要依赖beforeinput事件，这里只做补充处理
                        beforeinput: (view, event) => {
                            const { inputType, data } = event;



                            // 对于需要特殊处理的inputType，使用RestoreDOM
                            const needsRestoreDOM = [
                                'insertCompositionText',
                                'deleteContentBackward',
                                'insertText'
                            ].includes(inputType);

                            // 检查是否需要使用RestoreDOM
                            const shouldUseRestoreDOM = () => {
                                if (typeof window === 'undefined') return false;
                                const userAgent = window.navigator.userAgent;
                                const isAndroid = /Android/i.test(userAgent);
                                const isMobile = /Mobile|Tablet/i.test(userAgent);
                                return this.options.forceRestoreDOM || isAndroid || isMobile;
                            };

                            if (needsRestoreDOM && shouldUseRestoreDOM()) {
                                // 尝试阻止默认行为
                                try {
                                    event.preventDefault();
                                } catch (e) {
                                    // 某些情况下无法阻止，使用RestoreDOM处理
                                }

                                // 使用RestoreDOM处理
                                const editableElement = getEditableElement(view.dom);
                                if (editableElement) {
                                    // 记录事件
                                    const tr = view.state.tr.setMeta(ModernIMEFixPluginKey, {
                                        type: 'restore-dom',
                                        inputType,
                                        data
                                    });
                                    view.dispatch(tr);

                                    restoreDOM(editableElement, () => {
                                        // 执行相应的编辑器命令
                                        const { state, dispatch } = view;

                                        switch (inputType) {
                                            case 'insertCompositionText':
                                            case 'insertText':
                                                if (data) {
                                                    if (data.includes('\n')) {
                                                        // 插入换行 - IME期间不记录历史
                                                        const tr = state.tr
                                                            .split(state.selection.from)
                                                            .setMeta('addToHistory', false);
                                                        dispatch(tr);
                                                    } else {
                                                        // 插入文本 - IME期间不记录历史
                                                        const tr = state.tr
                                                            .insertText(data, state.selection.from, state.selection.to)
                                                            .setMeta('addToHistory', false);
                                                        dispatch(tr);
                                                    }
                                                }
                                                break;
                                            case 'deleteContentBackward':
                                                // 向后删除 - IME期间不记录历史
                                                const tr = state.tr
                                                    .delete(state.selection.from - 1, state.selection.from)
                                                    .setMeta('addToHistory', false);
                                                dispatch(tr);
                                                break;
                                        }
                                    }, {
                                        debug: false,
                                        timeout: 50
                                    });
                                }
                                return true; // 阻止ProseMirror的默认处理
                            }

                            return false; // 让ProseMirror正常处理
                        },

                        // 简化的键盘事件处理
                        keydown: (view, event) => {
                            // 现代方案主要依赖beforeinput，keydown只做最小必要的处理
                            // 对于IME处理，我们主要依赖beforeinput事件

                            return false; // 让其他处理器正常工作
                        }
                    }
                },

                // 状态管理
                state: {
                    init() {
                        return {
                            imeEvents: 0,
                            lastInputType: null,
                            restoreDOMCount: 0
                        };
                    },

                    apply(tr, value) {
                        const meta = tr.getMeta(ModernIMEFixPluginKey);

                        if (meta) {
                            switch (meta.type) {
                                case 'ime-input':
                                    return {
                                        ...value,
                                        imeEvents: value.imeEvents + 1,
                                        lastInputType: meta.inputType
                                    };
                                case 'restore-dom':
                                    return {
                                        ...value,
                                        restoreDOMCount: value.restoreDOMCount + 1
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
