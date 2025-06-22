/**
 * 现代IME处理工具 - 过渡期兼容层
 * 为了保持向后兼容，保留部分旧API
 * 新项目建议直接使用 modern-ime-handler.ts
 */

import { useDebouncedCallback } from 'use-debounce';
import { useCallback, useRef, useEffect } from 'react';
import { ModernIMEHandler } from './modern-ime-handler';

// 全局IME状态管理
let globalComposingState = false;
let compositionListenersAdded = false;

/**
 * 初始化全局IME状态监听器
 */
function initGlobalIMEListeners() {
    if (typeof window === 'undefined' || compositionListenersAdded) {
        return;
    }

    const handleCompositionStart = () => {
        globalComposingState = true;
        (window as any).__isComposing = true;
        console.log('🎯 IME: Composition started');
    };

    const handleCompositionEnd = () => {
        globalComposingState = false;
        (window as any).__isComposing = false;
        console.log('🎯 IME: Composition ended');
    };

    document.addEventListener('compositionstart', handleCompositionStart, true);
    document.addEventListener('compositionend', handleCompositionEnd, true);

    compositionListenersAdded = true;
    console.log('🎯 IME: Global listeners initialized');
}

/**
 * 创建一个现代IME安全的回调
 * 新版本：优先使用事件驱动，最小化延时依赖
 */
export function useIMESafeCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 100 // 大幅减少默认延时
): T {
    const isComposingRef = useRef(false);
    const modernHandlerRef = useRef<ModernIMEHandler | null>(null);

    // 初始化全局监听器
    useEffect(() => {
        initGlobalIMEListeners();
    }, []);

    // 同步全局状态到本地ref
    useEffect(() => {
        const syncState = () => {
            isComposingRef.current = globalComposingState;
        };

        const interval = setInterval(syncState, 16); // 60fps同步频率
        return () => clearInterval(interval);
    }, []);

    // 创建立即执行的回调（用于非IME状态）
    const immediateCallback = useCallback((...args: Parameters<T>) => {
        if (!globalComposingState && !isComposingRef.current) {
            return callback(...args);
        }
    }, [callback]);

    // 创建最小延时的防抖回调（仅作为安全网）
    const debouncedCallback = useDebouncedCallback(
        (...args: Parameters<T>) => {
            // 三重检查：确保不在IME输入状态
            if (!globalComposingState && !isComposingRef.current && !isCurrentlyComposing()) {
                return callback(...args);
            }
        },
        delay,
        {
            leading: false,
            trailing: true,
        }
    );

    // 智能执行策略：优先立即执行，IME状态下最小延时
    const smartCallback = useCallback((...args: Parameters<T>) => {
        const isComposing = globalComposingState || isComposingRef.current || isCurrentlyComposing();

        if (!isComposing) {
            // 非IME状态：立即执行
            return immediateCallback(...args);
        } else {
            // IME状态：使用最小延时作为安全网
            return debouncedCallback(...args);
        }
    }, [immediateCallback, debouncedCallback]);

    return smartCallback as T;
}

/**
 * 现代IME安全的编辑器变化处理
 * 新版本：大幅减少延时，优先事件驱动
 */
export function wrapEditorChangeForIME(
    originalOnEditorChange: (value: () => string) => Promise<void>,
    delay: number = 50 // 极小延时，仅作为安全网
) {
    return useIMESafeCallback(originalOnEditorChange, delay);
}

/**
 * 创建现代IME处理器的便捷函数
 * 推荐新项目使用此方法
 */
export function createModernIMEHandler(element: Element, options: any = {}) {
    return new ModernIMEHandler(element, {
        debug: process.env.NODE_ENV === 'development',
        ...options
    });
}

/**
 * 检查当前是否正在进行 IME 输入
 * 统一的状态检查函数
 */
export function isCurrentlyComposing(): boolean {
    // 确保初始化了监听器
    initGlobalIMEListeners();
    return globalComposingState || (window as any).__isComposing || false;
}

/**
 * 手动设置 IME 状态（用于调试和测试）
 */
export function setComposingState(composing: boolean) {
    globalComposingState = composing;
    (window as any).__isComposing = composing;
    console.log(`🎯 IME: Manually set composing state to ${composing}`);
}

/**
 * 获取IME状态的调试信息
 */
export function getIMEDebugInfo() {
    return {
        globalComposingState,
        windowComposingState: (window as any).__isComposing,
        listenersAdded: compositionListenersAdded,
    };
}
