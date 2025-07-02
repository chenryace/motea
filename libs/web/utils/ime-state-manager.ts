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
    // 借鉴Lexical：更细粒度的状态跟踪
    compositionKey: string | null;
    compositionRange: { from: number; to: number } | null;
    // 环境和保护相关
    environment: 'development' | 'production';
    protectionEnabled: boolean;
    // 错误恢复相关
    lastValidState: string | null;
    anomalyCount: number;
}

export type IMEStateListener = (state: IMEState) => void;

export class IMEStateManager {
    private state: IMEState = {
        isComposing: false,
        lastCompositionData: null,
        lastEventTime: 0,
        compositionKey: null,
        compositionRange: null,
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
        protectionEnabled: process.env.NODE_ENV === 'production',
        lastValidState: null,
        anomalyCount: 0,
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
     * 借鉴Lexical：支持更细粒度的状态跟踪
     */
    updateCompositionState(
        isComposing: boolean,
        data?: string | null,
        options?: {
            range?: { from: number; to: number };
            key?: string;
            forceUpdate?: boolean;
        }
    ) {
        const oldState = { ...this.state };
        const now = Date.now();

        // 生成composition key（借鉴Lexical的做法）
        const compositionKey = isComposing
            ? (options?.key || `comp_${now}_${Math.random().toString(36).substring(2, 11)}`)
            : null;

        this.state = {
            ...this.state,
            isComposing,
            lastCompositionData: data || null,
            lastEventTime: now,
            compositionKey,
            compositionRange: options?.range || null,
        };

        // 检测异常情况（借鉴Lexical的主动检测）
        this.detectAnomalies(oldState);

        // 只在状态真正变化时通知监听器
        const shouldNotify = options?.forceUpdate ||
                           oldState.isComposing !== this.state.isComposing ||
                           oldState.lastCompositionData !== this.state.lastCompositionData;

        if (shouldNotify) {
            this.notifyListeners();

            if (this.debug) {
                console.log('🎯 IMEStateManager: Composition state updated', {
                    isComposing,
                    data,
                    compositionKey,
                    range: options?.range,
                    timestamp: now,
                    environment: this.state.environment,
                    anomalyCount: this.state.anomalyCount
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
     * 检测异常情况（借鉴Lexical的主动检测机制）
     */
    private detectAnomalies(oldState: IMEState) {
        const now = Date.now();
        const timeSinceLastEvent = now - oldState.lastEventTime;

        // 检测1: 异常快速的事件序列（可能表示事件冲突）
        if (timeSinceLastEvent < 10 && oldState.lastEventTime > 0) {
            this.state.anomalyCount++;
            if (this.debug) {
                console.warn('🚨 IMEStateManager: Rapid event sequence detected', {
                    timeSinceLastEvent,
                    currentData: this.state.lastCompositionData,
                    previousData: oldState.lastCompositionData,
                    anomalyCount: this.state.anomalyCount
                });
            }
        }

        // 检测2: composition被意外中断
        if (this.state.isComposing && oldState.isComposing &&
            this.state.compositionKey !== oldState.compositionKey) {
            this.state.anomalyCount++;
            if (this.debug) {
                console.warn('🚨 IMEStateManager: Composition interrupted', {
                    previousKey: oldState.compositionKey,
                    newKey: this.state.compositionKey,
                    previousData: oldState.lastCompositionData,
                    newData: this.state.lastCompositionData
                });
            }
        }

        // 检测3: 生产环境特殊检测
        if (this.state.environment === 'production' && this.state.protectionEnabled) {
            // 检测空的composition结束（常见的生产环境问题）
            if (!this.state.isComposing && oldState.isComposing &&
                (!this.state.lastCompositionData || this.state.lastCompositionData.trim() === '') &&
                oldState.lastCompositionData && oldState.lastCompositionData.trim() !== '') {

                this.state.anomalyCount++;
                if (this.debug) {
                    console.warn('🚨 IMEStateManager: Empty composition end in production', {
                        previousData: oldState.lastCompositionData,
                        environment: this.state.environment
                    });
                }
            }
        }

        // 重置异常计数（如果长时间没有异常）
        if (timeSinceLastEvent > 5000) {
            this.state.anomalyCount = Math.max(0, this.state.anomalyCount - 1);
        }
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
