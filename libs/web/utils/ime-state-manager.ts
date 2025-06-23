/**
 * 统一的IME状态管理器
 * 解决多个状态源不同步的问题
 */

export interface IMEState {
    isComposing: boolean;
    isTyping: boolean;
    isDeleting: boolean;
    lastInputTime: number;
    lastInputType: string | null;
    fastTypingThreshold: number;
}

export type IMEStateListener = (state: IMEState) => void;

export class IMEStateManager {
    private state: IMEState = {
        isComposing: false,
        isTyping: false,
        isDeleting: false,
        lastInputTime: 0,
        lastInputType: null,
        fastTypingThreshold: 200
    };

    private listeners = new Set<IMEStateListener>();
    private typingTimer: NodeJS.Timeout | null = null;
    private debug: boolean;

    // 保存绑定后的事件处理器引用
    private boundHandlers = {
        compositionStart: this.handleCompositionStart.bind(this),
        compositionEnd: this.handleCompositionEnd.bind(this),
        beforeInput: this.handleBeforeInput.bind(this),
        keyDown: this.handleKeyDown.bind(this)
    };

    constructor(options: { debug?: boolean } = {}) {
        this.debug = options.debug || false;
        this.init();
    }

    private init() {
        if (typeof window === 'undefined') return;

        // 使用预绑定的事件处理器
        document.addEventListener('compositionstart', this.boundHandlers.compositionStart, true);
        document.addEventListener('compositionend', this.boundHandlers.compositionEnd, true);
        document.addEventListener('beforeinput', this.boundHandlers.beforeInput, true);
        document.addEventListener('keydown', this.boundHandlers.keyDown, true);

        if (this.debug) {
            console.log('🎯 IMEStateManager: Initialized');
        }
    }

    private handleCompositionStart(event: CompositionEvent) {
        this.updateState({ isComposing: true });
        if (this.debug) {
            console.log('🎯 IMEStateManager: Composition started');
        }
    }

    private handleCompositionEnd(event: CompositionEvent) {
        this.updateState({ isComposing: false });
        this.resetTypingTimer();
        if (this.debug) {
            console.log('🎯 IMEStateManager: Composition ended');
        }
    }

    private handleBeforeInput(event: InputEvent) {
        const { inputType, data } = event;
        const now = Date.now();

        this.updateState({
            isTyping: true,
            isDeleting: inputType.includes('delete'),
            lastInputTime: now,
            lastInputType: inputType
        });

        this.resetTypingTimer();

        if (this.debug) {
            console.log('🎯 IMEStateManager: BeforeInput', { inputType, data });
        }
    }

    private handleKeyDown(event: KeyboardEvent) {
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

        this.typingTimer = setTimeout(() => {
            this.updateState({
                isTyping: false,
                isDeleting: false
            });
        }, 200);
    }

    private updateState(updates: Partial<IMEState>) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };

        // 只在状态真正变化时通知监听器
        if (this.hasStateChanged(oldState, this.state)) {
            this.listeners.forEach(listener => {
                try {
                    listener(this.state);
                } catch (error) {
                    console.error('🎯 IMEStateManager: Listener error', error);
                }
            });

            if (this.debug) {
                console.log('🎯 IMEStateManager: State updated', this.state);
            }
        }
    }

    private hasStateChanged(oldState: IMEState, newState: IMEState): boolean {
        return oldState.isComposing !== newState.isComposing ||
               oldState.isTyping !== newState.isTyping ||
               oldState.isDeleting !== newState.isDeleting ||
               oldState.lastInputType !== newState.lastInputType;
    }

    /**
     * 订阅状态变化
     */
    subscribe(listener: IMEStateListener): () => void {
        this.listeners.add(listener);
        
        // 返回取消订阅函数
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * 获取当前状态
     */
    getState(): IMEState {
        return { ...this.state };
    }

    /**
     * 检查是否正在组合输入
     */
    isComposing(): boolean {
        return this.state.isComposing;
    }

    /**
     * 检查是否正在输入
     */
    isTyping(): boolean {
        return this.state.isTyping;
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
        return this.state.isComposing || this.isFastTyping();
    }

    /**
     * 手动设置状态（用于测试和调试）
     */
    setState(updates: Partial<IMEState>) {
        this.updateState(updates);
    }

    /**
     * 销毁状态管理器
     */
    destroy() {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }

        // 使用预绑定的事件处理器引用正确移除监听器
        document.removeEventListener('compositionstart', this.boundHandlers.compositionStart, true);
        document.removeEventListener('compositionend', this.boundHandlers.compositionEnd, true);
        document.removeEventListener('beforeinput', this.boundHandlers.beforeInput, true);
        document.removeEventListener('keydown', this.boundHandlers.keyDown, true);

        this.listeners.clear();

        if (this.debug) {
            console.log('🎯 IMEStateManager: Destroyed');
        }
    }
}

// 全局实例
let globalIMEStateManager: IMEStateManager | null = null;

/**
 * 获取全局IME状态管理器
 */
export function getGlobalIMEStateManager(): IMEStateManager {
    if (!globalIMEStateManager) {
        globalIMEStateManager = new IMEStateManager({
            debug: process.env.NODE_ENV === 'development'
        });
    }
    return globalIMEStateManager;
}

/**
 * 检查当前是否正在进行IME输入
 */
export function isCurrentlyComposing(): boolean {
    return getGlobalIMEStateManager().isComposing();
}

/**
 * 检查是否应该暂停昂贵操作
 */
export function shouldPauseExpensiveOperations(): boolean {
    return getGlobalIMEStateManager().shouldPauseExpensiveOperations();
}

/**
 * 创建智能的onChange包装器
 * 在IME输入期间暂停昂贵操作，确保中文输入不被打断
 */
export function createSmartOnChange<T extends (...args: any[]) => any>(
    originalCallback: T,
    options: {
        delay?: number;
        debug?: boolean;
    } = {}
): T {
    const { delay = 200, debug = false } = options;
    const stateManager = getGlobalIMEStateManager();

    let pendingCall: { args: Parameters<T>; timestamp: number } | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const executeCallback = (args: Parameters<T>) => {
        if (debug) {
            console.log('🎯 SmartOnChange: Executing callback');
        }
        return originalCallback(...args);
    };

    const smartCallback = (...args: Parameters<T>) => {
        const state = stateManager.getState();

        if (debug) {
            console.log('🎯 SmartOnChange: Called', {
                isComposing: state.isComposing,
                isTyping: state.isTyping,
                shouldPause: stateManager.shouldPauseExpensiveOperations()
            });
        }

        // 如果正在IME输入或快速输入，延迟执行
        if (stateManager.shouldPauseExpensiveOperations()) {
            pendingCall = { args, timestamp: Date.now() };

            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(() => {
                if (pendingCall && !stateManager.shouldPauseExpensiveOperations()) {
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
