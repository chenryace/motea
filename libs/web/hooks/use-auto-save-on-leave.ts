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
    const isLeavingRef = useRef(false);
    const beforeUnloadTriggeredRef = useRef(false);

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
            // 标记beforeunload已触发
            beforeUnloadTriggeredRef.current = true;

            // 显示确认对话框
            event.preventDefault();
            event.returnValue = '您有未保存的更改。确定要离开吗？';

            return '您有未保存的更改。确定要离开吗？';
        }
    }, [enabled, shouldAutoSave]);

    const handleRouteChangeStart = useCallback(async (url: string) => {
        if (!enabled || isAutoSavingRef.current) return;

        if (shouldAutoSave()) {
            isAutoSavingRef.current = true;

            // 阻止路由跳转
            router.events.emit('routeChangeError', new Error('Auto-saving before route change'), url);

            try {
                const success = await performAutoSave();
                isAutoSavingRef.current = false;

                if (success) {
                    // 自动保存成功，继续跳转
                    router.push(url);
                } else {
                    // 自动保存失败，询问用户
                    const confirmed = window.confirm('自动保存失败。是否强制离开？');
                    if (confirmed) {
                        router.push(url);
                    }
                }
            } catch (error) {
                isAutoSavingRef.current = false;
                // 自动保存出错，询问用户
                const confirmed = window.confirm('自动保存出错。是否强制离开？');
                if (confirmed) {
                    router.push(url);
                }
            }
        }
    }, [enabled, shouldAutoSave, performAutoSave, router]);

    // 处理页面真正卸载的情况
    const handlePageHide = useCallback((event: PageTransitionEvent) => {
        // 用户确实选择了离开，重置状态
        beforeUnloadTriggeredRef.current = false;
        isLeavingRef.current = false;
    }, []);

    // 处理用户交互（确认用户选择了"取消"）
    const handleUserInteraction = useCallback(() => {
        if (beforeUnloadTriggeredRef.current) {
            // beforeunload触发后，如果用户还能进行交互，说明选择了"取消"
            beforeUnloadTriggeredRef.current = false;
            performAutoSave();
        }
    }, [performAutoSave]);

    // 处理页面焦点变化
    const handleVisibilityChange = useCallback(() => {
        if (document.visibilityState === 'hidden') {
            // 页面变为隐藏状态，用户选择了离开
            beforeUnloadTriggeredRef.current = false;
            isLeavingRef.current = false;
        } else if (document.visibilityState === 'visible' && beforeUnloadTriggeredRef.current) {
            // 页面重新可见，且之前触发过beforeunload，说明用户选择了"取消"
            beforeUnloadTriggeredRef.current = false;
            performAutoSave();
        }
    }, [performAutoSave]);

    // 处理页面真正卸载（最终保险）
    const handleUnload = useCallback(() => {
        // 页面真正卸载，用户确实选择了离开
        beforeUnloadTriggeredRef.current = false;
        isLeavingRef.current = false;
    }, []);

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handlePageHide);
        window.addEventListener('unload', handleUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // 监听多种用户交互事件来确认用户选择了"取消"
        document.addEventListener('click', handleUserInteraction);
        document.addEventListener('keydown', handleUserInteraction);
        document.addEventListener('scroll', handleUserInteraction);
        document.addEventListener('mousemove', handleUserInteraction);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handlePageHide);
            window.removeEventListener('unload', handleUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);

            // 移除用户交互事件监听器
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keydown', handleUserInteraction);
            document.removeEventListener('scroll', handleUserInteraction);
            document.removeEventListener('mousemove', handleUserInteraction);
        };
    }, [enabled, handleBeforeUnload, handlePageHide, handleUnload, handleVisibilityChange, handleUserInteraction]);

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
