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
            // 显示确认对话框，但不执行任何保存操作
            event.preventDefault();
            event.returnValue = '您有未保存的更改。确定要离开吗？';

            // 使用一个简单的延迟来检测用户选择
            // 如果用户选择"离开"，页面会立即卸载，这个setTimeout不会执行
            // 如果用户选择"取消"，这个setTimeout会在用户回到页面后执行
            setTimeout(() => {
                // 如果能执行到这里，说明用户选择了"取消"
                performAutoSave();
            }, 100);

            return '您有未保存的更改。确定要离开吗？';
        }
    }, [enabled, shouldAutoSave, performAutoSave]);

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



    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [enabled, handleBeforeUnload]);

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
