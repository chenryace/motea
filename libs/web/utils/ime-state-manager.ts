/**
 * 简化的IME状态管理器
 * 基于ProseMirror最佳实践，采用最小干预原则
 *
 * 设计理念：
 * 1. 信任ProseMirror - 让ProseMirror处理大部分IME逻辑
 * 2. 最小干预 - 只跟踪必要的composition状态
 * 3. 避免冲突 - 不与ProseMirror内置处理产生冲突
 * 4. 简单可靠 - 移除复杂的定时器和多层事件处理
 */

export interface IMEState {
    isComposing: boolean;
    lastCompositionData: string | null;
    lastEventTime: number;
}

export type IMEStateListener = (state: IMEState) => void;

export class IMEStateManager {
    private state: IMEState = {
        isComposing: false,
        lastCompositionData: null,
        lastEventTime: 0,
    };

    private listeners = new Set<IMEStateListener>();
    private debug: boolean;

    constructor(options: { debug?: boolean } = {}) {
        this.debug = options.debug || false;

        if (this.debug) {
            console.log('🎯 IMEStateManager: Initialized with minimal intervention approach');
        }
    }

    /**
     * 手动更新composition状态
     * 主要由TipTap插件调用，避免重复的全局事件监听
     */
    updateCompositionState(isComposing: boolean, data?: string | null) {
        const oldState = { ...this.state };
        this.state = {
            ...this.state,
            isComposing,
            lastCompositionData: data || null,
            lastEventTime: Date.now()
        };

        // 只在状态真正变化时通知监听器
        if (oldState.isComposing !== this.state.isComposing) {
            this.notifyListeners();

            if (this.debug) {
                console.log('🎯 IMEStateManager: Composition state updated', {
                    isComposing,
                    data,
                    timestamp: this.state.lastEventTime
                });
            }
        }
    }

    private notifyListeners() {
        this.listeners.forEach(listener => {
            try {
                listener(this.state);
            } catch (error) {
                console.error('🎯 IMEStateManager: Listener error', error);
            }
        });
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
     * 检查是否应该暂停昂贵操作
     * 简化逻辑：只在composition期间暂停
     */
    shouldPauseExpensiveOperations(): boolean {
        return this.state.isComposing;
    }

    /**
     * 手动设置状态（用于测试和调试）
     */
    setState(updates: Partial<IMEState>) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };

        if (oldState.isComposing !== this.state.isComposing) {
            this.notifyListeners();
        }
    }

    /**
     * 销毁状态管理器
     * 简化版本：只清理监听器
     */
    destroy() {
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
 * 简化版本：只在composition期间延迟执行
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
                shouldPause: stateManager.shouldPauseExpensiveOperations()
            });
        }

        // 如果正在IME输入，延迟执行
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
