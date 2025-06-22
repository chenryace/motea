/**
 * 输入状态跟踪器
 * 基于ProseMirror社区最佳实践，解决快速输入丢失问题
 * 
 * 核心思路：
 * 1. 跟踪输入状态（正在输入、组合输入、删除等）
 * 2. 在快速输入期间暂停昂贵的操作（序列化、保存）
 * 3. 输入结束后批量处理
 */

export interface InputState {
    isTyping: boolean;
    isComposing: boolean;
    isDeleting: boolean;
    lastInputTime: number;
    inputBuffer: string[];
    fastTypingThreshold: number; // 快速输入阈值（ms）
}

export class InputStateTracker {
    private state: InputState = {
        isTyping: false,
        isComposing: false,
        isDeleting: false,
        lastInputTime: 0,
        inputBuffer: [],
        fastTypingThreshold: 100 // 100ms内的连续输入视为快速输入
    };

    private listeners: Array<(state: InputState) => void> = [];
    private typingTimer: NodeJS.Timeout | null = null;
    private batchTimer: NodeJS.Timeout | null = null;

    constructor(private options: {
        debug?: boolean;
        fastTypingThreshold?: number;
        batchDelay?: number;
    } = {}) {
        this.state.fastTypingThreshold = options.fastTypingThreshold || 100;
        this.init();
    }

    private init() {
        if (typeof window === 'undefined') return;

        // 监听各种输入事件
        document.addEventListener('beforeinput', this.handleBeforeInput.bind(this), true);
        document.addEventListener('input', this.handleInput.bind(this), true);
        document.addEventListener('compositionstart', this.handleCompositionStart.bind(this), true);
        document.addEventListener('compositionend', this.handleCompositionEnd.bind(this), true);
        document.addEventListener('keydown', this.handleKeyDown.bind(this), true);


    }

    private handleBeforeInput(event: InputEvent) {
        const { inputType, data } = event;
        const now = Date.now();
        
        // 检测是否为快速输入
        const isFastTyping = now - this.state.lastInputTime < this.state.fastTypingThreshold;
        


        // 更新状态
        this.updateState({
            isTyping: true,
            isDeleting: inputType.includes('delete'),
            lastInputTime: now
        });

        // 如果是快速输入，添加到缓冲区
        if (isFastTyping && data) {
            this.state.inputBuffer.push(data);
        }

        // 重置输入结束计时器
        this.resetTypingTimer();
    }

    private handleInput(event: InputEvent) {
        const { inputType, data } = event;
        


        // 输入事件发生，确保状态为正在输入
        this.updateState({ isTyping: true });
        this.resetTypingTimer();
    }

    private handleCompositionStart(event: CompositionEvent) {


        this.updateState({ isComposing: true });
    }

    private handleCompositionEnd(event: CompositionEvent) {


        this.updateState({ isComposing: false });
        this.resetTypingTimer();
    }

    private handleKeyDown(event: KeyboardEvent) {
        // 检测特殊按键
        if (event.key === 'Backspace' || event.key === 'Delete') {
            this.updateState({ 
                isTyping: true, 
                isDeleting: true,
                lastInputTime: Date.now()
            });
            this.resetTypingTimer();
        }
    }

    private resetTypingTimer() {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }

        // 200ms后认为输入结束
        this.typingTimer = setTimeout(() => {
            this.updateState({
                isTyping: false,
                isDeleting: false,
                inputBuffer: []
            });


        }, 200);
    }

    private updateState(updates: Partial<InputState>) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };

        // 通知监听器
        this.listeners.forEach(listener => {
            try {
                listener(this.state);
            } catch (error) {
                console.error('🎯 InputStateTracker: Listener error', error);
            }
        });


    }

    private hasStateChanged(oldState: InputState, newState: InputState): boolean {
        return oldState.isTyping !== newState.isTyping ||
               oldState.isComposing !== newState.isComposing ||
               oldState.isDeleting !== newState.isDeleting;
    }

    /**
     * 订阅状态变化
     */
    subscribe(listener: (state: InputState) => void): () => void {
        this.listeners.push(listener);
        
        // 返回取消订阅函数
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    /**
     * 获取当前状态
     */
    getState(): InputState {
        return { ...this.state };
    }

    /**
     * 检查是否正在快速输入
     */
    isFastTyping(): boolean {
        return this.state.isTyping && 
               (Date.now() - this.state.lastInputTime) < this.state.fastTypingThreshold;
    }

    /**
     * 检查是否应该暂停昂贵操作
     */
    shouldPauseExpensiveOperations(): boolean {
        return this.state.isTyping || this.state.isComposing || this.isFastTyping();
    }

    /**
     * 销毁跟踪器
     */
    destroy() {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }

        document.removeEventListener('beforeinput', this.handleBeforeInput.bind(this), true);
        document.removeEventListener('input', this.handleInput.bind(this), true);
        document.removeEventListener('compositionstart', this.handleCompositionStart.bind(this), true);
        document.removeEventListener('compositionend', this.handleCompositionEnd.bind(this), true);
        document.removeEventListener('keydown', this.handleKeyDown.bind(this), true);

        this.listeners = [];


    }
}

// 全局实例
let globalInputTracker: InputStateTracker | null = null;

/**
 * 获取全局输入状态跟踪器
 */
export function getGlobalInputTracker(): InputStateTracker {
    if (!globalInputTracker) {
        globalInputTracker = new InputStateTracker();
    }
    return globalInputTracker;
}

/**
 * 创建智能的onChange包装器
 * 在快速输入期间暂停昂贵操作
 */
export function createSmartOnChange<T extends (...args: any[]) => any>(
    originalCallback: T,
    options: {
        delay?: number;
        debug?: boolean;
    } = {}
): T {
    const { delay = 300, debug = false } = options;
    const tracker = getGlobalInputTracker();
    
    let pendingCall: { args: Parameters<T>; timestamp: number } | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const executeCallback = (args: Parameters<T>) => {
        return originalCallback(...args);
    };

    const smartCallback = (...args: Parameters<T>) => {
        const state = tracker.getState();
        


        // 如果正在快速输入，延迟执行
        if (tracker.shouldPauseExpensiveOperations()) {
            pendingCall = { args, timestamp: Date.now() };
            
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            timeoutId = setTimeout(() => {
                if (pendingCall) {
                    executeCallback(pendingCall.args);
                    pendingCall = null;
                }
            }, delay);
        } else {
            // 立即执行
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            executeCallback(args);
        }
    };

    return smartCallback as T;
}
