import { Tooltip, TooltipProps } from '@material-ui/core';
import UIState from 'libs/web/state/ui';
import { noop } from 'lodash';
import { FC, useEffect } from 'react';
import type { ReactNodeLike } from 'prop-types';

const Title: FC<{
    text: string;
    keys: string[];
}> = ({ text, keys }) => {
    return (
        <span>
            {text} {keys.join('+')}
        </span>
    );
};

const HotkeyTooltip: FC<{
    text: string;
    keys?: string[];
    children: ReactNodeLike;
    /**
     * first key
     */
    commandKey?: boolean;
    optionKey?: boolean;
    onClose?: TooltipProps['onClose'];
    onHotkey?: () => void;
    disableOnContentEditable?: boolean;
}> = ({
    text,
    keys = [],
    children,
    onClose,
    commandKey,
    optionKey,
    onHotkey = noop,
    disableOnContentEditable = false,
}) => {
    const {
        ua: { isMac },
    } = UIState.useContainer();
    const keyMap = [...keys];

    if (commandKey) {
        keyMap.unshift(isMac ? '⌘' : 'ctrl');
    }

    if (optionKey) {
        keyMap.unshift(isMac ? '⌥' : 'alt');
    }

    // Use native keyboard event handling (借鉴旧项目的简单实现)
    useEffect(() => {
        if (!keys.length) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;

            // 检查是否在编辑器或输入元素中
            const isInEditor = target.closest('.ProseMirror') ||
                             target.closest('[contenteditable]') ||
                             target.tagName === 'INPUT' ||
                             target.tagName === 'TEXTAREA';

            // 如果在编辑器中，完全不处理快捷键（除非明确允许）
            if (isInEditor && !disableOnContentEditable) {
                return;
            }

            // 精确匹配键盘组合
            let matches = true;

            // 检查修饰键
            if (commandKey && !(event.ctrlKey || event.metaKey)) {
                matches = false;
            }
            if (!commandKey && (event.ctrlKey || event.metaKey)) {
                matches = false;
            }

            if (optionKey && !event.altKey) {
                matches = false;
            }
            if (!optionKey && event.altKey) {
                matches = false;
            }

            // 检查主键
            if (keys.length === 1) {
                if (event.key.toLowerCase() !== keys[0].toLowerCase()) {
                    matches = false;
                }
            } else if (keys.length > 1) {
                // 处理组合键（如 shift+O）
                const hasShift = keys.includes('shift') || keys.includes('Shift');
                if (hasShift && !event.shiftKey) {
                    matches = false;
                }
                if (!hasShift && event.shiftKey) {
                    matches = false;
                }

                const mainKey = keys.find(k => k.toLowerCase() !== 'shift');
                if (mainKey && event.key.toLowerCase() !== mainKey.toLowerCase()) {
                    matches = false;
                }
            }

            if (matches) {
                event.preventDefault();
                event.stopPropagation();
                onHotkey();
            }
        };

        document.addEventListener('keydown', handleKeyDown, true); // 使用捕获阶段
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [keys, commandKey, optionKey, onHotkey, disableOnContentEditable]);

    return (
        <Tooltip
            enterDelay={200}
            TransitionProps={{ timeout: 0 }}
            title={<Title text={text} keys={keyMap} />}
            onClose={onClose}
            placement="bottom-start"
        >
            {children as any}
        </Tooltip>
    );
};

export default HotkeyTooltip;
