/**
 * 内存清理工具
 * 用于防止内存泄漏，清理全局资源
 */

import { cleanupGlobalInputTracker } from './input-state-tracker';
import { cleanupGlobalIMEStateManager } from './ime-state-manager';

/**
 * 执行全局内存清理
 * 应该在应用卸载或页面离开时调用
 */
export function performGlobalCleanup(): void {
    try {
        // 清理输入状态跟踪器
        cleanupGlobalInputTracker();

        // 清理IME状态管理器
        cleanupGlobalIMEStateManager();

        // 清理完成，不再输出日志
    } catch (error) {
        // 静默处理错误，不输出日志
    }
}

/**
 * 设置自动清理
 * 在页面卸载时自动执行清理
 */
export function setupAutoCleanup(): void {
    if (typeof window === 'undefined') return;
    
    // 页面卸载时清理
    window.addEventListener('beforeunload', performGlobalCleanup);
    
    // 页面隐藏时也执行清理（移动端）
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            performGlobalCleanup();
        }
    });
}

/**
 * 移除自动清理监听器
 */
export function removeAutoCleanup(): void {
    if (typeof window === 'undefined') return;
    
    window.removeEventListener('beforeunload', performGlobalCleanup);
    document.removeEventListener('visibilitychange', performGlobalCleanup);
}

// 自动设置清理
if (typeof window !== 'undefined') {
    setupAutoCleanup();
}
