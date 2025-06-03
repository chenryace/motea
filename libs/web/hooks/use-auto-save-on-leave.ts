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

    const handleBeforeUnload = useCallback(async (event: BeforeUnloadEvent) => {
        if (!enabled) return;

        if (shouldAutoSave()) {
            event.preventDefault();
            event.returnValue = 'Auto-saving, please wait...';

            performAutoSave();

            return 'Auto-saving, please wait...';
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
