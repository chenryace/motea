/**
 * 简单的 IME 输入优化工具
 * 最小化修改，只解决核心的中文输入打断问题
 */

import { useDebouncedCallback } from 'use-debounce';
import { useCallback, useRef } from 'react';

/**
 * 创建一个 IME 安全的防抖回调
 * 这是最小化的解决方案，只需要替换现有的 onEditorChange
 */
export function useIMESafeCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 500
): T {
    const isComposingRef = useRef(false);
    
    // 监听全局的 composition 事件
    if (typeof window !== 'undefined') {
        // 只添加一次监听器
        if (!(window as any).__imeListenerAdded) {
            document.addEventListener('compositionstart', () => {
                isComposingRef.current = true;
            });
            
            document.addEventListener('compositionend', () => {
                isComposingRef.current = false;
            });
            
            (window as any).__imeListenerAdded = true;
        }
    }

    const debouncedCallback = useDebouncedCallback(
        (...args: Parameters<T>) => {
            // 只有在非 IME 输入状态下才执行回调
            if (!isComposingRef.current) {
                return callback(...args);
            }
        },
        delay,
        {
            leading: false,
            trailing: true,
        }
    );

    return debouncedCallback.callback as T;
}

/**
 * 优化现有的 onEditorChange 函数
 * 使用方法：将原来的 onEditorChange 包装一下
 */
export function wrapEditorChangeForIME(
    originalOnEditorChange: (value: () => string) => Promise<void>,
    delay: number = 500
) {
    return useIMESafeCallback(originalOnEditorChange, delay);
}

/**
 * 检查当前是否正在进行 IME 输入
 */
export function isCurrentlyComposing(): boolean {
    return (window as any).__isComposing || false;
}

/**
 * 手动设置 IME 状态（用于调试）
 */
export function setComposingState(composing: boolean) {
    (window as any).__isComposing = composing;
}
