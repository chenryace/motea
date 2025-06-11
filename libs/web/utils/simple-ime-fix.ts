/**
 * 增强的 IME 输入优化工具
 * 解决中文输入法在 tiptap 编辑器中的打断问题
 */

import { useCallback, useRef, useEffect, useState } from 'react';

// 全局 composition 状态管理
class CompositionManager {
    private static instance: CompositionManager;
    private isComposing = false;
    private listeners: Set<(composing: boolean) => void> = new Set();
    private initialized = false;

    static getInstance(): CompositionManager {
        if (!CompositionManager.instance) {
            CompositionManager.instance = new CompositionManager();
        }
        return CompositionManager.instance;
    }

    private constructor() {
        this.init();
    }

    private init() {
        if (typeof window === 'undefined' || this.initialized) return;

        this.initialized = true;

        // 监听全局 composition 事件
        document.addEventListener('compositionstart', this.handleCompositionStart, true);
        document.addEventListener('compositionend', this.handleCompositionEnd, true);
        document.addEventListener('compositionupdate', this.handleCompositionUpdate, true);
    }

    private handleCompositionStart = (e: CompositionEvent) => {
        this.setComposing(true);
    };

    private handleCompositionEnd = (e: CompositionEvent) => {
        // 使用 setTimeout 确保 compositionend 事件完全处理完毕
        setTimeout(() => {
            this.setComposing(false);
        }, 0);
    };

    private handleCompositionUpdate = (e: CompositionEvent) => {
        // 确保在 composition 过程中状态正确
        this.setComposing(true);
    };

    private setComposing(composing: boolean) {
        if (this.isComposing !== composing) {
            this.isComposing = composing;
            this.listeners.forEach(listener => listener(composing));
        }
    }

    public getComposing(): boolean {
        return this.isComposing;
    }

    public subscribe(listener: (composing: boolean) => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
}

/**
 * 创建一个 IME 安全的回调 - 无 debounce 版本
 * 直接基于 composition 状态决定是否执行，避免 debounce 的不确定性
 */
export function useIMESafeCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 0 // 保留参数兼容性，但不再使用
): T {
    const isComposingRef = useRef(false);
    const pendingCallRef = useRef<{ args: Parameters<T>; timestamp: number } | null>(null);
    const compositionManager = CompositionManager.getInstance();

    useEffect(() => {
        const unsubscribe = compositionManager.subscribe((composing) => {
            const wasComposing = isComposingRef.current;
            isComposingRef.current = composing;

            // 当 composition 结束时，检查是否有待执行的调用
            if (wasComposing && !composing && pendingCallRef.current) {
                const { args, timestamp } = pendingCallRef.current;
                pendingCallRef.current = null;

                // 使用 setTimeout 确保在下一个事件循环中执行
                setTimeout(() => {
                    callback(...args);
                }, 0);
            }
        });

        // 初始化状态
        isComposingRef.current = compositionManager.getComposing();

        return unsubscribe;
    }, [compositionManager, callback]);

    const safeCallback = useCallback((...args: Parameters<T>) => {
        if (!isComposingRef.current) {
            // 不在 composition 状态，直接执行
            return callback(...args);
        } else {
            // 在 composition 状态，记录最后一次调用
            pendingCallRef.current = {
                args,
                timestamp: Date.now()
            };
        }
    }, [callback]) as T;

    return safeCallback;
}

/**
 * 优化现有的 onEditorChange 函数
 * 使用方法：将原来的 onEditorChange 包装一下
 * 新版本：不再使用 debounce，基于 composition 状态精确控制
 */
export function wrapEditorChangeForIME(
    originalOnEditorChange: (value: () => string) => Promise<void>,
    delay: number = 0 // 保留参数兼容性，但不再使用
) {
    return useIMESafeCallback(originalOnEditorChange, delay);
}

/**
 * 检查当前是否正在进行 IME 输入
 */
export function isCurrentlyComposing(): boolean {
    return CompositionManager.getInstance().getComposing();
}

/**
 * 手动设置 IME 状态（用于调试）
 */
export function setComposingState(composing: boolean) {
    // 这个函数保留用于调试，但实际状态由 CompositionManager 管理
    console.warn('setComposingState is deprecated, composition state is now managed automatically');
}

/**
 * Hook 用于监听 composition 状态变化
 */
export function useCompositionState(): boolean {
    const [isComposing, setIsComposing] = useState(false);

    useEffect(() => {
        const compositionManager = CompositionManager.getInstance();
        const unsubscribe = compositionManager.subscribe(setIsComposing);

        // 初始化状态
        setIsComposing(compositionManager.getComposing());

        return unsubscribe;
    }, []);

    return isComposing;
}

/**
 * 为 tiptap 编辑器创建 IME 安全的 editorProps
 * 注意：这个函数已被弃用，请使用 IMEFix 扩展代替
 * @deprecated 使用 IMEFix 扩展来处理 composition 事件
 */
export function createIMESafeEditorProps() {
    console.warn('createIMESafeEditorProps is deprecated. Use IMEFix extension instead.');
    return {};
}

/**
 * 高级版本：带有额外安全保障的 IME 安全回调
 * 包含多重检查机制，确保在各种边缘情况下都能正确工作
 */
export function useAdvancedIMESafeCallback<T extends (...args: any[]) => any>(
    callback: T,
    options: {
        // 最大延迟执行时间（毫秒），防止无限期等待
        maxDelay?: number;
        // 是否在组件卸载时强制执行待执行的调用
        executeOnUnmount?: boolean;
        // 调试模式
        debug?: boolean;
    } = {}
): T {
    const { maxDelay = 5000, executeOnUnmount = true, debug = false } = options;

    const isComposingRef = useRef(false);
    const pendingCallRef = useRef<{
        args: Parameters<T>;
        timestamp: number;
        timeoutId?: NodeJS.Timeout;
    } | null>(null);
    const compositionManager = CompositionManager.getInstance();
    const isMountedRef = useRef(true);

    useEffect(() => {
        const unsubscribe = compositionManager.subscribe((composing) => {
            const wasComposing = isComposingRef.current;
            isComposingRef.current = composing;

            if (debug) {
                console.log(`[IME Safe Callback] Composition state changed: ${wasComposing} -> ${composing}`);
            }

            // 当 composition 结束时，执行待执行的调用
            if (wasComposing && !composing && pendingCallRef.current && isMountedRef.current) {
                const { args, timeoutId } = pendingCallRef.current;

                // 清除超时定时器
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                pendingCallRef.current = null;

                if (debug) {
                    console.log('[IME Safe Callback] Executing pending call after composition end');
                }

                // 使用 setTimeout 确保在下一个事件循环中执行
                setTimeout(() => {
                    if (isMountedRef.current) {
                        callback(...args);
                    }
                }, 0);
            }
        });

        // 初始化状态
        isComposingRef.current = compositionManager.getComposing();

        return unsubscribe;
    }, [compositionManager, callback, debug, maxDelay]);

    // 组件卸载时的清理
    useEffect(() => {
        return () => {
            isMountedRef.current = false;

            // 如果有待执行的调用且设置了在卸载时执行
            if (executeOnUnmount && pendingCallRef.current) {
                const { args, timeoutId } = pendingCallRef.current;

                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                if (debug) {
                    console.log('[IME Safe Callback] Executing pending call on unmount');
                }

                // 立即执行
                callback(...args);
            }
        };
    }, [callback, executeOnUnmount, debug]);

    const safeCallback = useCallback((...args: Parameters<T>) => {
        if (!isMountedRef.current) {
            if (debug) {
                console.log('[IME Safe Callback] Component unmounted, ignoring call');
            }
            return;
        }

        if (!isComposingRef.current) {
            // 不在 composition 状态，直接执行
            if (debug) {
                console.log('[IME Safe Callback] Executing immediately (not composing)');
            }
            return callback(...args);
        } else {
            // 在 composition 状态，记录调用并设置超时保护
            if (debug) {
                console.log('[IME Safe Callback] Deferring call (composing)');
            }

            // 清除之前的调用和超时
            if (pendingCallRef.current?.timeoutId) {
                clearTimeout(pendingCallRef.current.timeoutId);
            }

            // 设置超时保护，防止无限期等待
            const timeoutId = setTimeout(() => {
                if (pendingCallRef.current && isMountedRef.current) {
                    if (debug) {
                        console.log('[IME Safe Callback] Executing pending call due to timeout');
                    }

                    const { args: timeoutArgs } = pendingCallRef.current;
                    pendingCallRef.current = null;
                    callback(...timeoutArgs);
                }
            }, maxDelay);

            pendingCallRef.current = {
                args,
                timestamp: Date.now(),
                timeoutId
            };
        }
    }, [callback, debug, maxDelay]) as T;

    return safeCallback;
}
