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
}

/**
 * 现代IME处理器类
 */
export class ModernIMEHandler {
    private element: Element;
    private options: ModernIMEHandlerOptions;
    private isComposing = false;
    private useRestoreDOM = false;
    
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
    
    // 这些方法需要在具体的编辑器集成中实现
    private insertText(text: string) {
        // 待实现：调用编辑器的插入文本命令
        console.log('🎯 ModernIMEHandler: insertText not implemented', text);
    }
    
    private insertBreak() {
        // 待实现：调用编辑器的插入换行命令
        console.log('🎯 ModernIMEHandler: insertBreak not implemented');
    }
    
    private deleteBackward() {
        // 待实现：调用编辑器的向后删除命令
        console.log('🎯 ModernIMEHandler: deleteBackward not implemented');
    }
    
    private deleteRange(range: StaticRange) {
        // 待实现：调用编辑器的删除范围命令
        console.log('🎯 ModernIMEHandler: deleteRange not implemented', range);
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
