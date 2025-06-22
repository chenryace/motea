/**
 * IME Debug Component
 * 用于监控和调试IME输入状态
 */

import { FC, useState, useEffect } from 'react';
import { getIMEDebugInfo, isCurrentlyComposing } from 'libs/web/utils/simple-ime-fix';
import { getGlobalInputTracker, InputState } from 'libs/web/utils/input-state-tracker';

interface IMEDebugProps {
    enabled?: boolean;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const IMEDebug: FC<IMEDebugProps> = ({ 
    enabled = process.env.NODE_ENV === 'development',
    position = 'bottom-right' 
}) => {
    const [debugInfo, setDebugInfo] = useState({
        globalComposingState: false,
        windowComposingState: false,
        listenersAdded: false,
        isComposing: false,
        lastUpdate: Date.now(),
    });

    const [inputState, setInputState] = useState<InputState>({
        isTyping: false,
        isComposing: false,
        isDeleting: false,
        lastInputTime: 0,
        inputBuffer: [],
        fastTypingThreshold: 100
    });

    const [eventLog, setEventLog] = useState<string[]>([]);

    useEffect(() => {
        if (!enabled) return;

        const updateDebugInfo = () => {
            const info = getIMEDebugInfo();
            setDebugInfo({
                ...info,
                isComposing: isCurrentlyComposing(),
                lastUpdate: Date.now(),
            });
        };

        // 订阅输入状态变化
        const inputTracker = getGlobalInputTracker();
        const unsubscribe = inputTracker.subscribe((state) => {
            setInputState(state);
        });

        // 高频更新调试信息
        const interval = setInterval(updateDebugInfo, 100);

        // 监听composition和beforeinput事件并记录日志
        const logCompositionEvent = (eventType: string) => (event: CompositionEvent) => {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = `${timestamp}: ${eventType} - "${event.data || ''}"`;

            setEventLog(prev => [...prev.slice(-9), logEntry]); // 保留最近10条
            updateDebugInfo();
        };

        const logBeforeInputEvent = (event: InputEvent) => {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = `${timestamp}: BEFOREINPUT - ${event.inputType} "${event.data || ''}"`;

            setEventLog(prev => [...prev.slice(-9), logEntry]);
            updateDebugInfo();
        };

        document.addEventListener('compositionstart', logCompositionEvent('COMP_START'), true);
        document.addEventListener('compositionupdate', logCompositionEvent('COMP_UPDATE'), true);
        document.addEventListener('compositionend', logCompositionEvent('COMP_END'), true);
        document.addEventListener('beforeinput', logBeforeInputEvent, true);

        return () => {
            clearInterval(interval);
            unsubscribe();
            document.removeEventListener('compositionstart', logCompositionEvent('COMP_START'), true);
            document.removeEventListener('compositionupdate', logCompositionEvent('COMP_UPDATE'), true);
            document.removeEventListener('compositionend', logCompositionEvent('COMP_END'), true);
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
                <div className={`flex justify-between ${inputState.isTyping ? 'text-red-400' : 'text-green-400'}`}>
                    <span>输入状态:</span>
                    <span>{inputState.isTyping ? '正在输入' : '空闲'}</span>
                </div>

                <div className={`flex justify-between ${inputState.isComposing ? 'text-red-400' : 'text-gray-400'}`}>
                    <span>组合输入:</span>
                    <span>{inputState.isComposing ? 'ON' : 'OFF'}</span>
                </div>

                <div className={`flex justify-between ${inputState.isDeleting ? 'text-orange-400' : 'text-gray-400'}`}>
                    <span>删除中:</span>
                    <span>{inputState.isDeleting ? 'ON' : 'OFF'}</span>
                </div>

                <div className="flex justify-between text-blue-400">
                    <span>输入间隔:</span>
                    <span>{Date.now() - inputState.lastInputTime}ms</span>
                </div>

                <div className={`flex justify-between ${debugInfo.isComposing ? 'text-red-400' : 'text-green-400'}`}>
                    <span>IME状态:</span>
                    <span>{debugInfo.isComposing ? '输入中' : '空闲'}</span>
                </div>
                
                <div className="flex justify-between">
                    <span>全局状态:</span>
                    <span className={debugInfo.globalComposingState ? 'text-red-400' : 'text-gray-400'}>
                        {debugInfo.globalComposingState ? 'ON' : 'OFF'}
                    </span>
                </div>
                
                <div className="flex justify-between">
                    <span>窗口状态:</span>
                    <span className={debugInfo.windowComposingState ? 'text-red-400' : 'text-gray-400'}>
                        {debugInfo.windowComposingState ? 'ON' : 'OFF'}
                    </span>
                </div>
                
                <div className="flex justify-between">
                    <span>监听器:</span>
                    <span className={debugInfo.listenersAdded ? 'text-green-400' : 'text-red-400'}>
                        {debugInfo.listenersAdded ? '已添加' : '未添加'}
                    </span>
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
