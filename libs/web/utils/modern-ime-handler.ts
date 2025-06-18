/**
 * 现代IME处理器 - 基于BeforeInput + RestoreDOM
 * 不依赖延时策略，使用事件驱动的方式处理IME输入
 * 
 * 核心思路：
 * 1. 监听beforeinput事件，识别用户意图
 * 2. 对于composition相关的输入，使用RestoreDOM恢复DOM
 * 3. 执行编辑器的数据模型更新
 * 4. 让编辑器重新渲染正确的DOM
 */

import { restoreDOM, shouldUseRestoreDOM, getEditableElement } from './restore-dom';

export interface IMEInputEvent {
    inputType: string;
    data: string | null;
    targetRanges: StaticRange[];
    isComposing: boolean;
}

export interface ModernIMEHandlerOptions {
    /**
     * 是否启用调试模式
     */
    debug?: boolean;

    /**
     * 是否强制使用RestoreDOM（即使不是移动设备）
     */
    forceRestoreDOM?: boolean;

    /**
     * 编辑器onChange回调
     */
    onChange?: (getValue: () => string) => void;

    /**
     * TipTap编辑器实例
     */
    editor?: any;
}

/**
 * 现代IME处理器类
 */
export class ModernIMEHandler {
    private element: Element;
    private options: ModernIMEHandlerOptions;
    private isComposing = false;
    private useRestoreDOM = false;
    private editor: any;

    constructor(element: Element, options: ModernIMEHandlerOptions = {}) {
        this.element = element;
        this.options = { debug: false, forceRestoreDOM: false, ...options };
        this.useRestoreDOM = options.forceRestoreDOM || shouldUseRestoreDOM();
        this.editor = options.editor;

        this.init();
    }
    
    private init() {
        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: Initializing', {
                useRestoreDOM: this.useRestoreDOM,
                element: this.element
            });
        }
        
        // 绑定事件监听器
        this.bindEvents();
    }
    
    private bindEvents() {
        const editableElement = getEditableElement(this.element);
        if (!editableElement) {
            console.warn('🎯 ModernIMEHandler: No editable element found');
            return;
        }
        
        // 监听composition事件
        editableElement.addEventListener('compositionstart', this.handleCompositionStart.bind(this));
        editableElement.addEventListener('compositionend', this.handleCompositionEnd.bind(this));
        
        // 监听beforeinput事件（核心）
        editableElement.addEventListener('beforeinput', this.handleBeforeInput.bind(this));
        
        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: Event listeners bound to', editableElement);
        }
    }
    
    private handleCompositionStart(event: CompositionEvent) {
        this.isComposing = true;
        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: Composition started', event);
        }
    }
    
    private handleCompositionEnd(event: CompositionEvent) {
        this.isComposing = false;
        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: Composition ended', event);
        }
    }
    
    private handleBeforeInput(event: InputEvent) {
        const { inputType, data } = event;
        
        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: BeforeInput', {
                inputType,
                data,
                isComposing: this.isComposing,
                useRestoreDOM: this.useRestoreDOM
            });
        }
        
        // 根据inputType决定处理策略
        if (this.shouldUseRestoreDOMForInput(inputType)) {
            // 阻止默认行为（如果可能）
            try {
                event.preventDefault();
            } catch (e) {
                // 某些情况下无法阻止，这是正常的
                if (this.options.debug) {
                    console.log('🎯 ModernIMEHandler: Cannot prevent default, will use RestoreDOM');
                }
            }
            
            // 使用RestoreDOM处理
            this.handleWithRestoreDOM(inputType, data, event);
        } else {
            // 正常处理，不需要RestoreDOM
            if (this.options.debug) {
                console.log('🎯 ModernIMEHandler: Normal input, no RestoreDOM needed');
            }
        }
    }
    
    private shouldUseRestoreDOMForInput(inputType: string): boolean {
        if (!this.useRestoreDOM) return false;
        
        // 需要使用RestoreDOM的inputType列表
        const restoreDOMInputTypes = [
            'insertCompositionText',
            'deleteContentBackward',
            'insertText', // 在某些Android输入法中需要
        ];
        
        return restoreDOMInputTypes.includes(inputType);
    }
    
    private handleWithRestoreDOM(inputType: string, data: string | null, event: InputEvent) {
        const editableElement = getEditableElement(this.element);
        if (!editableElement) return;
        
        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: Using RestoreDOM for', inputType, data);
        }
        
        // 获取目标范围（用于确定编辑位置）
        const targetRanges = event.getTargetRanges ? event.getTargetRanges() : [];
        
        restoreDOM(editableElement, () => {
            // 在DOM恢复后执行编辑器操作
            this.executeEditorOperation(inputType, data, targetRanges);
        }, {
            debug: this.options.debug,
            timeout: 50 // 较短的超时时间，因为我们知道会有DOM变化
        });
    }
    
    private executeEditorOperation(inputType: string, data: string | null, targetRanges: StaticRange[]) {
        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: Executing editor operation', {
                inputType,
                data,
                targetRanges: targetRanges.length
            });
        }
        
        // 这里需要根据具体的编辑器实现来处理
        // 对于TipTap，我们需要调用相应的commands
        
        switch (inputType) {
            case 'insertCompositionText':
                this.handleInsertCompositionText(data);
                break;
            case 'insertText':
                this.handleInsertText(data);
                break;
            case 'deleteContentBackward':
                this.handleDeleteBackward(targetRanges);
                break;
            default:
                if (this.options.debug) {
                    console.log('🎯 ModernIMEHandler: Unhandled inputType', inputType);
                }
        }
        
        // 触发onChange回调
        if (this.options.onChange) {
            // 这里需要根据具体编辑器实现获取内容
            // this.options.onChange(() => getEditorContent());
        }
    }
    
    private handleInsertCompositionText(data: string | null) {
        if (!data) return;
        
        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: Insert composition text', data);
        }
        
        // 检查是否包含换行符
        if (data.includes('\n')) {
            // 处理换行
            this.insertBreak();
        } else {
            // 插入文本
            this.insertText(data);
        }
    }
    
    private handleInsertText(data: string | null) {
        if (!data) return;
        
        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: Insert text', data);
        }
        
        this.insertText(data);
    }
    
    private handleDeleteBackward(targetRanges: StaticRange[]) {
        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: Delete backward', targetRanges);
        }
        
        // 根据targetRanges决定删除策略
        if (targetRanges.length > 0) {
            // 有明确的删除范围
            this.deleteRange(targetRanges[0]);
        } else {
            // 默认向后删除
            this.deleteBackward();
        }
    }
    
    // TipTap编辑器命令集成
    private insertText(text: string) {
        if (!this.editor) {
            if (this.options.debug) {
                console.warn('🎯 ModernIMEHandler: No editor instance available for insertText');
            }
            return;
        }

        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: Inserting text via editor commands', text);
        }

        // 使用TipTap的chain命令，在IME期间不记录历史
        this.editor.chain()
            .command(({ tr }: any) => {
                tr.setMeta('addToHistory', this.isComposing ? false : true);
                return true;
            })
            .insertContent(text)
            .run();
    }

    private insertBreak() {
        if (!this.editor) {
            if (this.options.debug) {
                console.warn('🎯 ModernIMEHandler: No editor instance available for insertBreak');
            }
            return;
        }

        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: Inserting break via editor commands');
        }

        // 使用TipTap的chain命令，在IME期间不记录历史
        this.editor.chain()
            .command(({ tr }: any) => {
                tr.setMeta('addToHistory', this.isComposing ? false : true);
                return true;
            })
            .setHardBreak()
            .run();
    }

    private deleteBackward() {
        if (!this.editor) {
            if (this.options.debug) {
                console.warn('🎯 ModernIMEHandler: No editor instance available for deleteBackward');
            }
            return;
        }

        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: Deleting backward via editor commands');
        }

        // 使用TipTap的chain命令，在IME期间不记录历史
        const { state } = this.editor;
        const { from } = state.selection;

        if (from > 0) {
            this.editor.chain()
                .command(({ tr }: any) => {
                    tr.setMeta('addToHistory', this.isComposing ? false : true);
                    return true;
                })
                .deleteRange({ from: from - 1, to: from })
                .run();
        }
    }

    private deleteRange(range: StaticRange) {
        if (!this.editor) {
            if (this.options.debug) {
                console.warn('🎯 ModernIMEHandler: No editor instance available for deleteRange');
            }
            return;
        }

        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: Deleting range via editor commands', range);
        }

        // 将StaticRange转换为编辑器位置并删除
        // 注意：这里需要将DOM位置转换为ProseMirror位置
        try {
            const { state } = this.editor;
            const { doc } = state;

            // 简化处理：使用当前选择范围
            const { from, to } = state.selection;
            if (from !== to) {
                this.editor.commands.deleteRange({ from, to });
            }
        } catch (error) {
            if (this.options.debug) {
                console.error('🎯 ModernIMEHandler: Error deleting range', error);
            }
        }
    }
    
    /**
     * 销毁处理器
     */
    destroy() {
        // 移除事件监听器
        const editableElement = getEditableElement(this.element);
        if (editableElement) {
            editableElement.removeEventListener('compositionstart', this.handleCompositionStart.bind(this));
            editableElement.removeEventListener('compositionend', this.handleCompositionEnd.bind(this));
            editableElement.removeEventListener('beforeinput', this.handleBeforeInput.bind(this));
        }
        
        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: Destroyed');
        }
    }
}
