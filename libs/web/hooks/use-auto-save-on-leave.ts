/**
 * Auto Save on Leave Hook
 *
 * Copyright (c) 2025 waycaan
 * Licensed under the MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';

interface UseAutoSaveOnLeaveOptions {
    enabled?: boolean;
}

const useAutoSaveOnLeave = (options: UseAutoSaveOnLeaveOptions = {}) => {
    const { enabled = true } = options;
    const router = useRouter();
    const isAutoSavingRef = useRef(false);
    const userChoiceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isLeavingRef = useRef(false);

    const shouldAutoSave = useCallback(() => {
        if (typeof window !== 'undefined' && (window as any).saveButtonStatus) {
            return (window as any).saveButtonStatus === 'save';
        }
        return false;
    }, []);

    const performAutoSave = useCallback(async () => {
        if (typeof window !== 'undefined' && (window as any).saveButtonAutoSave) {
            try {
                await (window as any).saveButtonAutoSave();
                return true;
            } catch (error) {
                return false;
            }
        }
        return false;
    }, []);

    const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
        if (!enabled) return;

        if (shouldAutoSave()) {
            // 标记正在处理离开事件
            isLeavingRef.current = true;

            // 清除之前的超时
            if (userChoiceTimeoutRef.current) {
                clearTimeout(userChoiceTimeoutRef.current);
            }

            // 显示确认对话框
            event.preventDefault();
            event.returnValue = '您有未保存的更改。确定要离开吗？';

            // 设置超时来检测用户选择
            userChoiceTimeoutRef.current = setTimeout(() => {
                // 如果500ms后页面还在，说明用户选择了"取消"
                if (isLeavingRef.current) {
                    isLeavingRef.current = false;
                    performAutoSave();
                }
            }, 500); // 给用户足够时间做选择

            return '您有未保存的更改。确定要离开吗？';
        }
    }, [enabled, shouldAutoSave, performAutoSave]);

    const handleRouteChangeStart = useCallback((url: string) => {
        if (!enabled || isAutoSavingRef.current) return;

        if (shouldAutoSave()) {
            isAutoSavingRef.current = true;

            router.events.emit('routeChangeError', 'Auto-saving before route change', url);

            performAutoSave()
                .then((success) => {
                    if (success) {
                        isAutoSavingRef.current = false;
                        router.push(url);
                    } else {
                        isAutoSavingRef.current = false;
                        const confirmed = window.confirm(
                            'Auto-save failed. Force leave?'
                        );
                        if (confirmed) {
                            router.push(url);
                        }
                    }
                })
                .catch((error) => {
                    isAutoSavingRef.current = false;
                    const confirmed = window.confirm(
                        'Auto-save error. Force leave?'
                    );
                    if (confirmed) {
                        router.push(url);
                    }
                });

            throw 'Auto-saving, please wait...';
        }
    }, [enabled, shouldAutoSave, performAutoSave, router]);

    // 处理页面真正卸载的情况
    const handlePageHide = useCallback((event: PageTransitionEvent) => {
        // 用户确实选择了离开，取消自动保存
        isLeavingRef.current = false;
        if (userChoiceTimeoutRef.current) {
            clearTimeout(userChoiceTimeoutRef.current);
            userChoiceTimeoutRef.current = null;
        }
    }, []);

    // 处理页面焦点变化（更可靠的检测方式）
    const handleVisibilityChange = useCallback(() => {
        if (document.visibilityState === 'hidden' && isLeavingRef.current) {
            // 页面变为隐藏状态，可能是用户选择了离开
            setTimeout(() => {
                if (document.visibilityState === 'hidden') {
                    // 确实离开了
                    isLeavingRef.current = false;
                    if (userChoiceTimeoutRef.current) {
                        clearTimeout(userChoiceTimeoutRef.current);
                        userChoiceTimeoutRef.current = null;
                    }
                }
            }, 100);
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handlePageHide);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handlePageHide);
            document.removeEventListener('visibilitychange', handleVisibilityChange);

            // 清理超时
            if (userChoiceTimeoutRef.current) {
                clearTimeout(userChoiceTimeoutRef.current);
            }
        };
    }, [enabled, handleBeforeUnload, handlePageHide, handleVisibilityChange]);

    useEffect(() => {
        if (!enabled) return;

        router.events.on('routeChangeStart', handleRouteChangeStart);
        return () => {
            router.events.off('routeChangeStart', handleRouteChangeStart);
        };
    }, [enabled, handleRouteChangeStart, router.events]);

    return {
        shouldAutoSave,
        performAutoSave,
    };
};

export default useAutoSaveOnLeave;
