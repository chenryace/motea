/**
 * Tiptap 扩展：现代IME处理
 * 基于BeforeInput + RestoreDOM的现代方案
 * 不依赖延时策略，使用事件驱动处理IME输入
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { ModernIMEHandler, TipTapEditorInterface } from 'libs/web/utils/modern-ime-handler';
import { getEditableElement } from 'libs/web/utils/restore-dom';

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

interface IMEFixPluginState {
    isComposing: boolean;
    lastEvent: string | null;
    timestamp: number;
}

const ModernIMEFixPluginKey = new PluginKey<IMEFixPluginState>('modern-ime-fix');

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
                    // 创建TipTap编辑器接口
                    const editorInterface: TipTapEditorInterface = {
                        editor: this.editor,
                        view: editorView,

                        getSelection() {
                            const { from, to } = editorView.state.selection;
                            return { from, to };
                        },

                        insertText(text: string, from?: number, to?: number) {
                            try {
                                const { state, dispatch } = editorView;
                                const insertFrom = from ?? state.selection.from;
                                const insertTo = to ?? state.selection.to;

                                const tr = state.tr.insertText(text, insertFrom, insertTo);
                                dispatch(tr);
                                return true;
                            } catch (error) {
                                console.error('🎯 TipTap IME: insertText error', error);
                                return false;
                            }
                        },

                        deleteRange(from: number, to: number) {
                            try {
                                const { state, dispatch } = editorView;
                                const tr = state.tr.delete(from, to);
                                dispatch(tr);
                                return true;
                            } catch (error) {
                                console.error('🎯 TipTap IME: deleteRange error', error);
                                return false;
                            }
                        },

                        deleteBackward(count: number = 1) {
                            try {
                                const { state, dispatch } = editorView;
                                const { from } = state.selection;
                                const deleteFrom = Math.max(0, from - count);
                                const tr = state.tr.delete(deleteFrom, from);
                                dispatch(tr);
                                return true;
                            } catch (error) {
                                console.error('🎯 TipTap IME: deleteBackward error', error);
                                return false;
                            }
                        },

                        insertBreak() {
                            try {
                                // 使用TipTap的命令系统插入换行
                                return this.editor.commands.setHardBreak() || this.editor.commands.splitBlock();
                            } catch (error) {
                                console.error('🎯 TipTap IME: insertBreak error', error);
                                return false;
                            }
                        },

                        setCompositionState(isComposing: boolean) {
                            // 使用类型断言来设置只读属性
                            (editorView as any).composing = isComposing;
                        }
                    };

                    // 创建现代IME处理器
                    let imeHandler: ModernIMEHandler | null = null;

                    // 直接初始化，不延迟，确保事件监听器优先级
                    const editableElement = getEditableElement(editorView.dom);
                    if (editableElement) {
                        imeHandler = new ModernIMEHandler(editableElement, {
                            debug: this.options.debug,
                            forceRestoreDOM: this.options.forceRestoreDOM,
                            editorInterface,
                            onChange: () => {
                                // 这里可以添加额外的onChange处理
                                if (this.options.debug) {
                                    console.log('🎯 Modern IME: Content changed via IME');
                                }
                            }
                        });
                    }

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
                        // 简化处理：只记录事件，让ModernIMEHandler完全控制
                        beforeinput: (view, event) => {
                            const { inputType, data } = event;

                            // 记录事件到插件状态
                            const tr = view.state.tr.setMeta(ModernIMEFixPluginKey, {
                                type: 'ime-input',
                                inputType,
                                data,
                                timestamp: Date.now()
                            });
                            view.dispatch(tr);

                            return false;
                        }
                    }
                },

                // 状态管理 - 简化版本，主要用于调试和监控
                state: {
                    init() {
                        return {
                            imeEvents: 0,
                            lastInputType: null,
                            lastEventTime: 0,
                            isActive: true
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
                                        lastInputType: meta.inputType,
                                        lastEventTime: meta.timestamp || Date.now()
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
