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

export interface TipTapEditorInterface {
    /**
     * TipTap编辑器实例
     */
    editor: any;

    /**
     * 获取当前选区
     */
    getSelection(): { from: number; to: number };

    /**
     * 插入文本
     */
    insertText(text: string, from?: number, to?: number): boolean;

    /**
     * 删除内容
     */
    deleteRange(from: number, to: number): boolean;

    /**
     * 向后删除
     */
    deleteBackward(count?: number): boolean;

    /**
     * 插入换行
     */
    insertBreak(): boolean;
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
     * TipTap编辑器接口
     */
    editorInterface?: TipTapEditorInterface;
}

/**
 * 现代IME处理器类
 */
export class ModernIMEHandler {
    private element: Element;
    private options: ModernIMEHandlerOptions;
    private isComposing = false;
    private useRestoreDOM = false;

    // 保存绑定后的事件处理器引用，确保可以正确移除
    private boundHandlers = {
        compositionStart: this.handleCompositionStart.bind(this),
        compositionEnd: this.handleCompositionEnd.bind(this),
        beforeInput: this.handleBeforeInput.bind(this)
    };

    constructor(element: Element, options: ModernIMEHandlerOptions = {}) {
        this.element = element;
        this.options = { debug: false, forceRestoreDOM: false, ...options };
        this.useRestoreDOM = options.forceRestoreDOM || shouldUseRestoreDOM();

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

        // 使用预绑定的事件处理器，确保可以正确移除
        editableElement.addEventListener('compositionstart', this.boundHandlers.compositionStart);
        editableElement.addEventListener('compositionend', this.boundHandlers.compositionEnd);
        editableElement.addEventListener('beforeinput', this.boundHandlers.beforeInput);

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
            timeout: 500, // 较短的超时时间，因为我们知道会有DOM变化
            restoreTypes: ['childList'], // 只恢复子节点变化，避免影响文本内容
            skipCharacterData: true, // 跳过字符数据变化，保持IME兼容性
            shouldRestore: (mutation) => {
                // 只恢复与IME输入相关的DOM变化
                if (mutation.type === 'childList') {
                    // 检查是否是IME相关的节点变化
                    const hasTextNodes = Array.from(mutation.addedNodes).some(node =>
                        node.nodeType === Node.TEXT_NODE ||
                        (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'SPAN')
                    );
                    return hasTextNodes;
                }
                return false;
            },
            excludeNodes: (node) => {
                // 排除编辑器自身的结构节点
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as Element;
                    const excludeClasses = ['ProseMirror', 'tiptap-editor'];
                    return excludeClasses.some(cls => element.classList?.contains(cls));
                }
                return false;
            }
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
        if (!this.options.editorInterface) {
            if (this.options.debug) {
                console.warn('🎯 ModernIMEHandler: No editor interface provided, cannot insert text');
            }
            return false;
        }

        try {
            const success = this.options.editorInterface.insertText(text);
            if (this.options.debug) {
                console.log('🎯 ModernIMEHandler: insertText', text, success ? 'success' : 'failed');
            }
            return success;
        } catch (error) {
            if (this.options.debug) {
                console.error('🎯 ModernIMEHandler: insertText error', error);
            }
            return false;
        }
    }

    private insertBreak() {
        if (!this.options.editorInterface) {
            if (this.options.debug) {
                console.warn('🎯 ModernIMEHandler: No editor interface provided, cannot insert break');
            }
            return false;
        }

        try {
            const success = this.options.editorInterface.insertBreak();
            if (this.options.debug) {
                console.log('🎯 ModernIMEHandler: insertBreak', success ? 'success' : 'failed');
            }
            return success;
        } catch (error) {
            if (this.options.debug) {
                console.error('🎯 ModernIMEHandler: insertBreak error', error);
            }
            return false;
        }
    }

    private deleteBackward(count: number = 1) {
        if (!this.options.editorInterface) {
            if (this.options.debug) {
                console.warn('🎯 ModernIMEHandler: No editor interface provided, cannot delete backward');
            }
            return false;
        }

        try {
            const success = this.options.editorInterface.deleteBackward(count);
            if (this.options.debug) {
                console.log('🎯 ModernIMEHandler: deleteBackward', count, success ? 'success' : 'failed');
            }
            return success;
        } catch (error) {
            if (this.options.debug) {
                console.error('🎯 ModernIMEHandler: deleteBackward error', error);
            }
            return false;
        }
    }

    private deleteRange(range: StaticRange) {
        if (!this.options.editorInterface) {
            if (this.options.debug) {
                console.warn('🎯 ModernIMEHandler: No editor interface provided, cannot delete range');
            }
            return false;
        }

        try {
            // 将StaticRange转换为编辑器位置
            const from = this.convertDOMPositionToEditorPosition(range.startContainer, range.startOffset);
            const to = this.convertDOMPositionToEditorPosition(range.endContainer, range.endOffset);

            if (from !== null && to !== null) {
                const success = this.options.editorInterface.deleteRange(from, to);
                if (this.options.debug) {
                    console.log('🎯 ModernIMEHandler: deleteRange', { from, to }, success ? 'success' : 'failed');
                }
                return success;
            } else {
                if (this.options.debug) {
                    console.warn('🎯 ModernIMEHandler: Could not convert DOM range to editor positions');
                }
                return false;
            }
        } catch (error) {
            if (this.options.debug) {
                console.error('🎯 ModernIMEHandler: deleteRange error', error);
            }
            return false;
        }
    }

    /**
     * 将DOM位置转换为编辑器位置
     * 这是一个简化的实现，实际可能需要更复杂的逻辑
     */
    private convertDOMPositionToEditorPosition(container: Node, offset: number): number | null {
        if (!this.options.editorInterface?.editor) {
            return null;
        }

        try {
            // 使用ProseMirror的posAtDOM方法
            const pos = this.options.editorInterface.editor.view.posAtDOM(container, offset);
            return pos;
        } catch (error) {
            if (this.options.debug) {
                console.error('🎯 ModernIMEHandler: convertDOMPositionToEditorPosition error', error);
            }
            return null;
        }
    }
    
    /**
     * 销毁处理器
     */
    destroy() {
        // 使用预绑定的事件处理器引用，确保正确移除
        const editableElement = getEditableElement(this.element);
        if (editableElement) {
            editableElement.removeEventListener('compositionstart', this.boundHandlers.compositionStart);
            editableElement.removeEventListener('compositionend', this.boundHandlers.compositionEnd);
            editableElement.removeEventListener('beforeinput', this.boundHandlers.beforeInput);
        }

        if (this.options.debug) {
            console.log('🎯 ModernIMEHandler: Destroyed');
        }
    }
}
