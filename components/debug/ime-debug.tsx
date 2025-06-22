/**
 * IME Debug Component
 * 用于监控和调试IME输入状态
 */

import { FC, useState, useEffect } from 'react';
import { getGlobalIMEStateManager, IMEState } from 'libs/web/utils/ime-state-manager';

interface IMEDebugProps {
    enabled?: boolean;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const IMEDebug: FC<IMEDebugProps> = ({
    enabled = process.env.NODE_ENV === 'development',
    position = 'bottom-right'
}) => {
    const [imeState, setIMEState] = useState<IMEState>({
        isComposing: false,
        isTyping: false,
        isDeleting: false,
        lastInputTime: 0,
        lastInputType: null,
        fastTypingThreshold: 100
    });

    const [eventLog, setEventLog] = useState<string[]>([]);

    useEffect(() => {
        if (!enabled) return;

        // 订阅IME状态变化
        const stateManager = getGlobalIMEStateManager();
        const unsubscribe = stateManager.subscribe((state) => {
            setIMEState(state);
        });

        // 初始化状态
        setIMEState(stateManager.getState());

        // 监听composition和beforeinput事件并记录日志
        const logCompositionEvent = (eventType: string) => (event: CompositionEvent) => {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = `${timestamp}: ${eventType} - "${event.data || ''}"`;
            setEventLog(prev => [...prev.slice(-9), logEntry]); // 保留最近10条
        };

        const logBeforeInputEvent = (event: InputEvent) => {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = `${timestamp}: BEFOREINPUT - ${event.inputType} "${event.data || ''}"`;
            setEventLog(prev => [...prev.slice(-9), logEntry]);
        };

        const compositionStartHandler = logCompositionEvent('COMP_START');
        const compositionUpdateHandler = logCompositionEvent('COMP_UPDATE');
        const compositionEndHandler = logCompositionEvent('COMP_END');

        document.addEventListener('compositionstart', compositionStartHandler, true);
        document.addEventListener('compositionupdate', compositionUpdateHandler, true);
        document.addEventListener('compositionend', compositionEndHandler, true);
        document.addEventListener('beforeinput', logBeforeInputEvent, true);

        return () => {
            unsubscribe();
            document.removeEventListener('compositionstart', compositionStartHandler, true);
            document.removeEventListener('compositionupdate', compositionUpdateHandler, true);
            document.removeEventListener('compositionend', compositionEndHandler, true);
            document.removeEventListener('beforeinput', logBeforeInputEvent, true);
        };
    }, [enabled]);

    if (!enabled) return null;

    const positionClasses = {
        'top-left': 'top-4 left-4',
        'top-right': 'top-4 right-4',
        'bottom-left': 'bottom-4 left-4',
        'bottom-right': 'bottom-4 right-4',
    };

    return (
        <div className={`fixed ${positionClasses[position]} z-50 bg-black bg-opacity-80 text-white text-xs p-3 rounded-lg font-mono max-w-xs`}>
            <div className="mb-2 font-bold text-yellow-400">🚀 Smart Input Debug</div>

            <div className="space-y-1">
                <div className={`flex justify-between ${imeState.isTyping ? 'text-red-400' : 'text-green-400'}`}>
                    <span>输入状态:</span>
                    <span>{imeState.isTyping ? '正在输入' : '空闲'}</span>
                </div>

                <div className={`flex justify-between ${imeState.isComposing ? 'text-red-400' : 'text-gray-400'}`}>
                    <span>组合输入:</span>
                    <span>{imeState.isComposing ? 'ON' : 'OFF'}</span>
                </div>

                <div className={`flex justify-between ${imeState.isDeleting ? 'text-orange-400' : 'text-gray-400'}`}>
                    <span>删除中:</span>
                    <span>{imeState.isDeleting ? 'ON' : 'OFF'}</span>
                </div>

                <div className="flex justify-between text-blue-400">
                    <span>输入间隔:</span>
                    <span>{Date.now() - imeState.lastInputTime}ms</span>
                </div>

                <div className="flex justify-between text-purple-400">
                    <span>最后输入:</span>
                    <span>{imeState.lastInputType || 'None'}</span>
                </div>

                <div className="flex justify-between text-cyan-400">
                    <span>快速输入阈值:</span>
                    <span>{imeState.fastTypingThreshold}ms</span>
                </div>

                <div className={`flex justify-between ${(Date.now() - imeState.lastInputTime) < imeState.fastTypingThreshold ? 'text-yellow-400' : 'text-gray-400'}`}>
                    <span>快速输入:</span>
                    <span>{(Date.now() - imeState.lastInputTime) < imeState.fastTypingThreshold ? 'ON' : 'OFF'}</span>
                </div>
            </div>

            {eventLog.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-600">
                    <div className="text-yellow-400 mb-1">事件日志:</div>
                    <div className="space-y-0.5 max-h-32 overflow-y-auto">
                        {eventLog.map((log, index) => (
                            <div key={index} className="text-xs text-gray-300 truncate">
                                {log}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default IMEDebug;
