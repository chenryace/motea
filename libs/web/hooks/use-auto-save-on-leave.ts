import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';

interface UseAutoSaveOnLeaveOptions {
    enabled?: boolean;
}

const useAutoSaveOnLeave = (options: UseAutoSaveOnLeaveOptions = {}) => {
    const { enabled = true } = options;
    const router = useRouter();
    const isAutoSavingRef = useRef(false);

    // 检查是否需要自动保存
    const shouldAutoSave = useCallback(() => {
        if (typeof window !== 'undefined' && (window as any).saveButtonStatus) {
            return (window as any).saveButtonStatus === 'save';
        }
        return false;
    }, []);

    // 执行自动保存
    const performAutoSave = useCallback(async () => {
        if (typeof window !== 'undefined' && (window as any).saveButtonAutoSave) {
            console.log('🔄 Auto-saving before leaving...');
            try {
                await (window as any).saveButtonAutoSave();
                console.log('✅ Auto-save completed');
                return true;
            } catch (error) {
                console.error('❌ Auto-save failed:', error);
                return false;
            }
        }
        return false;
    }, []);

    // 处理页面关闭/刷新事件
    const handleBeforeUnload = useCallback(async (event: BeforeUnloadEvent) => {
        if (!enabled) return;

        if (shouldAutoSave()) {
            // 对于 beforeunload，我们只能显示警告，无法执行异步操作
            // 但我们可以尝试同步保存
            event.preventDefault();
            event.returnValue = '正在自动保存，请稍候...';
            
            // 尝试同步执行保存（虽然可能不会完成）
            performAutoSave();
            
            return '正在自动保存，请稍候...';
        }
    }, [enabled, shouldAutoSave, performAutoSave]);

    // 处理路由变化事件
    const handleRouteChangeStart = useCallback((url: string) => {
        if (!enabled || isAutoSavingRef.current) return;

        if (shouldAutoSave()) {
            console.log('🔄 Auto-saving before route change...');
            isAutoSavingRef.current = true;

            // 阻止路由变化
            router.events.emit('routeChangeError', 'Auto-saving before route change', url);

            // 异步执行自动保存
            performAutoSave()
                .then((success) => {
                    if (success) {
                        console.log('✅ Auto-save completed, proceeding with navigation');
                        // 保存成功后，手动导航到目标页面
                        isAutoSavingRef.current = false;
                        router.push(url);
                    } else {
                        console.log('❌ Auto-save failed, asking user');
                        isAutoSavingRef.current = false;
                        const confirmed = window.confirm(
                            '自动保存失败，是否强制离开？'
                        );
                        if (confirmed) {
                            router.push(url);
                        }
                    }
                })
                .catch((error) => {
                    console.error('Auto-save error:', error);
                    isAutoSavingRef.current = false;
                    const confirmed = window.confirm(
                        '自动保存出错，是否强制离开？'
                    );
                    if (confirmed) {
                        router.push(url);
                    }
                });

            // 抛出字符串而不是 Error 对象来阻止路由
            throw 'Auto-saving, please wait...';
        }
    }, [enabled, shouldAutoSave, performAutoSave, router]);

    // 监听页面关闭/刷新事件
    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [enabled, handleBeforeUnload]);

    // 监听路由变化事件
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
