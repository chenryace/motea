/**
 * Timer Manager
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

interface TimerConfig {
    id: string;
    callback: () => void;
    interval?: number;
    timeout?: number;
    immediate?: boolean;
}

interface ActiveTimer {
    id: string;
    type: 'interval' | 'timeout';
    timerId: NodeJS.Timeout;
    callback: () => void;
    startTime: number;
}

export class TimerManager {
    private activeTimers = new Map<string, ActiveTimer>();
    private debug: boolean;

    constructor(debug = false) {
        this.debug = debug && process.env.NODE_ENV === 'development';
        
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                this.clearAll();
            });
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.clearAll();
                }
            });
        }
    }

    setInterval(id: string, callback: () => void, interval: number, immediate = false): void {
        this.clear(id);

        if (immediate) {
            callback();
        }

        const timerId = setInterval(callback, interval);
        
        this.activeTimers.set(id, {
            id,
            type: 'interval',
            timerId,
            callback,
            startTime: Date.now()
        });

        if (this.debug) {
            console.log(`⏰ TimerManager: Set interval '${id}' (${interval}ms)`);
        }
    }

    setTimeout(id: string, callback: () => void, timeout: number): void {
        this.clear(id);

        const timerId = setTimeout(() => {
            callback();
            this.activeTimers.delete(id);
            
            if (this.debug) {
                console.log(`⏰ TimerManager: Timeout '${id}' completed and removed`);
            }
        }, timeout);

        this.activeTimers.set(id, {
            id,
            type: 'timeout',
            timerId,
            callback,
            startTime: Date.now()
        });

        if (this.debug) {
            console.log(`⏰ TimerManager: Set timeout '${id}' (${timeout}ms)`);
        }
    }


    clear(id: string): boolean {
        const timer = this.activeTimers.get(id);
        if (!timer) {
            return false;
        }

        if (timer.type === 'interval') {
            clearInterval(timer.timerId);
        } else {
            clearTimeout(timer.timerId);
        }

        this.activeTimers.delete(id);

        if (this.debug) {
            console.log(`⏰ TimerManager: Cleared ${timer.type} '${id}'`);
        }

        return true;
    }


    clearAll(): void {
        const count = this.activeTimers.size;
        
        this.activeTimers.forEach((timer) => {
            if (timer.type === 'interval') {
                clearInterval(timer.timerId);
            } else {
                clearTimeout(timer.timerId);
            }
        });

        this.activeTimers.clear();

        if (this.debug && count > 0) {
            console.log(`⏰ TimerManager: Cleared all ${count} timers`);
        }
    }


    getActiveTimers(): Array<{id: string, type: string, runningTime: number}> {
        const now = Date.now();
        return Array.from(this.activeTimers.values()).map(timer => ({
            id: timer.id,
            type: timer.type,
            runningTime: now - timer.startTime
        }));
    }


    exists(id: string): boolean {
        return this.activeTimers.has(id);
    }


    restart(id: string): boolean {
        const timer = this.activeTimers.get(id);
        if (!timer) {
            return false;
        }

        const { callback, type } = timer;

        this.clear(id);
        if (this.debug) {
            console.log(`⏰ TimerManager: Restarted '${id}'`);
        }

        return true;
    }


    getStats(): {
        totalTimers: number;
        intervalTimers: number;
        timeoutTimers: number;
        oldestTimer: string | null;
    } {
        const timers = Array.from(this.activeTimers.values());
        const intervalCount = timers.filter(t => t.type === 'interval').length;
        const timeoutCount = timers.filter(t => t.type === 'timeout').length;
        
        let oldestTimer: string | null = null;
        let oldestTime = Date.now();
        
        timers.forEach(timer => {
            if (timer.startTime < oldestTime) {
                oldestTime = timer.startTime;
                oldestTimer = timer.id;
            }
        });

        return {
            totalTimers: timers.length,
            intervalTimers: intervalCount,
            timeoutTimers: timeoutCount,
            oldestTimer
        };
    }
}

// 全局定时器管理器实例
let globalTimerManager: TimerManager | null = null;

export function getGlobalTimerManager(): TimerManager {
    if (!globalTimerManager) {
        globalTimerManager = new TimerManager(false);
    }
    return globalTimerManager;
}


export function setManagedInterval(id: string, callback: () => void, interval: number, immediate = false): void {
    getGlobalTimerManager().setInterval(id, callback, interval, immediate);
}


export function setManagedTimeout(id: string, callback: () => void, timeout: number): void {
    getGlobalTimerManager().setTimeout(id, callback, timeout);
}


export function clearManagedTimer(id: string): boolean {
    return getGlobalTimerManager().clear(id);
}


export function clearAllManagedTimers(): void {
    getGlobalTimerManager().clearAll();
}
