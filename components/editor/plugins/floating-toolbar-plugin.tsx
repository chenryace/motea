/**
 * Floating Toolbar Plugin for Lexical
 * Shows formatting options when text is selected
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, TextFormatType, INDENT_CONTENT_COMMAND, OUTDENT_CONTENT_COMMAND, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_LOW } from 'lexical';
import { INSERT_CODE_BLOCK_COMMAND, $isSelectionInCodeBlock } from './code-block-plugin';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $setBlocksType } from '@lexical/selection';
import { $createParagraphNode } from 'lexical';

import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from '@lexical/list';
import { INSERT_CHECK_LIST_COMMAND } from '@lexical/list';
import { $isListItemNode, $isListNode } from '@lexical/list';
import { TOGGLE_HIGHLIGHT_COMMAND } from './highlight-plugin';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';

// Heroicons
import {
    LinkIcon,
    CodeIcon,
    ArrowRightIcon,
    ArrowLeftIcon,
    ViewListIcon,
    CollectionIcon,
    ClipboardListIcon
} from '@heroicons/react/outline';



export default function FloatingToolbarPlugin(): JSX.Element | null {
    const [editor] = useLexicalComposerContext();
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [isBold, setIsBold] = useState(false);
    const [isUnderline, setIsUnderline] = useState(false);
    const [isStrikethrough, setIsStrikethrough] = useState(false);
    const [isCodeBlock, setIsCodeBlock] = useState(false);
    const [isLink, setIsLink] = useState(false);
    const [isHighlight, setIsHighlight] = useState(false);
    const [isUnorderedList, setIsUnorderedList] = useState(false);
    const [isOrderedList, setIsOrderedList] = useState(false);
    const [isCheckList, setIsCheckList] = useState(false);
    const { theme } = useTheme();

    const updateToolbar = useCallback(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
            const textContent = selection.getTextContent();

            if (textContent !== '') {
                const nativeSelection = window.getSelection();
                const rootElement = editor.getRootElement();

                if (
                    nativeSelection !== null &&
                    nativeSelection.rangeCount > 0 &&
                    rootElement !== null &&
                    rootElement.contains(nativeSelection.anchorNode)
                ) {
                    const rangeRect = nativeSelection.getRangeAt(0).getBoundingClientRect();

                    setPosition({
                        top: rangeRect.top - 60,
                        left: rangeRect.left + rangeRect.width / 2 - 150,
                    });
                    setIsVisible(true);

                    // Update button states
                    setIsBold(selection.hasFormat('bold'));
                    setIsUnderline(selection.hasFormat('underline'));
                    setIsStrikethrough(selection.hasFormat('strikethrough'));
                    setIsCodeBlock($isSelectionInCodeBlock());

                    // Check if selection contains a link
                    const node = selection.anchor.getNode();
                    const parent = node.getParent();
                    setIsLink($isLinkNode(parent) || $isLinkNode(node));

                    // Check for highlight using Lexical's built-in format
                    setIsHighlight(selection.hasFormat('highlight'));

                    // Check for list states - 更全面的检测逻辑
                    let isInList = false;
                    let listType = '';

                    // 检查选择范围内的所有节点
                    const nodes = selection.getNodes();
                    for (const selectedNode of nodes) {
                        let currentNode = selectedNode;

                        // 向上遍历找到列表项
                        while (currentNode) {
                            if ($isListItemNode(currentNode)) {
                                const listNode = currentNode.getParent();
                                if ($isListNode(listNode)) {
                                    isInList = true;
                                    listType = listNode.getListType();
                                    break;
                                }
                            }
                            currentNode = currentNode.getParent();
                        }

                        if (isInList) break;
                    }

                    // 如果没有找到，检查锚点节点
                    if (!isInList) {
                        const anchorNode = selection.anchor.getNode();
                        let currentNode = anchorNode;

                        while (currentNode) {
                            if ($isListItemNode(currentNode)) {
                                const listNode = currentNode.getParent();
                                if ($isListNode(listNode)) {
                                    isInList = true;
                                    listType = listNode.getListType();
                                    break;
                                }
                            }
                            currentNode = currentNode.getParent();
                        }
                    }

                    // 设置状态
                    setIsUnorderedList(isInList && listType === 'bullet');
                    setIsOrderedList(isInList && listType === 'number');
                    setIsCheckList(isInList && listType === 'check');
                } else {
                    setIsVisible(false);
                }
            } else {
                setIsVisible(false);
            }
        } else {
            setIsVisible(false);
        }
    }, [editor]);

    useEffect(() => {
        const unregisterListener = editor.registerUpdateListener(({ editorState }) => {
            editorState.read(() => {
                updateToolbar();
            });
        });

        // 监听选择变化
        const unregisterSelectionListener = editor.registerCommand(
            SELECTION_CHANGE_COMMAND,
            () => {
                updateToolbar();
                return false;
            },
            COMMAND_PRIORITY_LOW
        );

        // 添加鼠标事件监听器来处理选择
        const rootElement = editor.getRootElement();
        if (rootElement) {
            const handleMouseUp = () => {
                setTimeout(() => {
                    editor.getEditorState().read(() => {
                        updateToolbar();
                    });
                }, 0);
            };

            rootElement.addEventListener('mouseup', handleMouseUp);
            rootElement.addEventListener('keyup', handleMouseUp);

            return () => {
                unregisterListener();
                unregisterSelectionListener();
                rootElement.removeEventListener('mouseup', handleMouseUp);
                rootElement.removeEventListener('keyup', handleMouseUp);
            };
        }

        return () => {
            unregisterListener();
            unregisterSelectionListener();
        };
    }, [editor, updateToolbar]);

    const handleFormat = (format: TextFormatType) => {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    };

    const handleListToggle = (listType: 'bullet' | 'number' | 'check') => {
        const isCurrentlyActive =
            (listType === 'bullet' && isUnorderedList) ||
            (listType === 'number' && isOrderedList) ||
            (listType === 'check' && isCheckList);

        if (isCurrentlyActive) {
            // 如果当前已经是这种列表类型，则取消列表，转换为普通段落
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    $setBlocksType(selection, () => $createParagraphNode());
                }
            });
        } else {
            // 否则转换为指定的列表类型
            if (listType === 'bullet') {
                editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
            } else if (listType === 'number') {
                editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
            } else if (listType === 'check') {
                editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
            }
        }
    };

    const handleLink = () => {
        if (isLink) {
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
        } else {
            const url = prompt('Enter URL:');
            if (url) {
                editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
            }
        }
    };

    if (!isVisible) {
        return null;
    }

    const toolbarBg = theme === 'dark'
        ? 'border-gray-600'
        : 'border-gray-200';
    
    const buttonText = theme === 'dark' ? 'text-white' : 'text-gray-700';
    const buttonHover = theme === 'dark'
        ? 'hover:text-white'
        : 'hover:text-gray-900';
    
    const buttonActive = theme === 'dark'
        ? 'text-white'
        : 'text-gray-900';

    const toolbarButtons = [
        {
            title: 'Bold',
            icon: <span className="font-bold text-sm">B</span>,
            isActive: isBold,
            action: () => handleFormat('bold'),
        },
        {
            title: 'Strikethrough',
            icon: <span className="line-through text-sm">S</span>,
            isActive: isStrikethrough,
            action: () => handleFormat('strikethrough'),
        },
        {
            title: 'Underline',
            icon: <span className="underline text-sm">U</span>,
            isActive: isUnderline,
            action: () => handleFormat('underline'),
        },
        {
            title: 'Highlight',
            icon: theme === 'dark'
                ? <span className="text-xs px-1 rounded text-white" style={{backgroundColor: '#3185eb'}}>H</span>
                : <span className="text-xs px-1 rounded" style={{backgroundColor: '#eab834'}}>H</span>,
            isActive: isHighlight,
            action: () => editor.dispatchCommand(TOGGLE_HIGHLIGHT_COMMAND, undefined),
        },
        {
            title: 'Code Block',
            icon: <CodeIcon className="w-4 h-4" />,
            isActive: isCodeBlock,
            action: () => editor.dispatchCommand(INSERT_CODE_BLOCK_COMMAND, undefined),
        },
        {
            title: isLink ? 'Remove Link' : 'Add Link',
            icon: <LinkIcon className="w-4 h-4" />,
            isActive: isLink,
            action: handleLink,
        },
        // 分隔符
        { type: 'separator' },
        {
            title: isCheckList ? 'Remove Checklist' : 'Checklist',
            icon: <CollectionIcon className="w-4 h-4" />,
            isActive: isCheckList,
            action: () => handleListToggle('check'),
        },
        {
            title: isUnorderedList ? 'Remove Bullet List' : 'Bullet List',
            icon: <ViewListIcon className="w-4 h-4" />,
            isActive: isUnorderedList,
            action: () => handleListToggle('bullet'),
        },
        {
            title: isOrderedList ? 'Remove Numbered List' : 'Numbered List',
            icon: <ClipboardListIcon className="w-4 h-4" />,
            isActive: isOrderedList,
            action: () => handleListToggle('number'),
        },
        // 分隔符
        { type: 'separator' },
        {
            title: 'Indent',
            icon: <ArrowRightIcon className="w-4 h-4" />,
            isActive: false,
            action: () => {
                // 使用Lexical的内置缩进命令，避免直接操作节点
                editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
            },
        },
        {
            title: 'Outdent',
            icon: <ArrowLeftIcon className="w-4 h-4" />,
            isActive: false,
            action: () => {
                // 使用Lexical的内置缩进命令，避免直接操作节点
                editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
            },
        },

    ];

    return createPortal(
        <div
            className={`fixed z-50 ${toolbarBg} border rounded-lg p-1.5 flex space-x-0.5 shadow-lg`}
            style={{
                top: position.top,
                left: position.left,
                transform: 'translateX(-50%)',
                backgroundColor: theme === 'dark' ? '#3f3f46' : '#e4e4e7',
            }}
        >
            {toolbarButtons.map((button, index) => {
                if (button.type === 'separator') {
                    return (
                        <div
                            key={index}
                            className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'} mx-1`}
                        />
                    );
                }

                return (
                    <button
                        key={index}
                        onClick={button.action}
                        title={button.title}
                        className={`
                            px-2.5 py-1.5 rounded transition-colors duration-150 min-w-[30px] h-7 flex items-center justify-center text-sm font-medium
                            ${button.isActive
                                ? buttonActive
                                : `${buttonText} ${buttonHover}`
                            }
                        `}
                        style={{
                            backgroundColor: button.isActive
                                ? (theme === 'dark' ? '#3185eb' : '#eab834')
                                : 'transparent'
                        }}
                        onMouseEnter={(e) => {
                            if (!button.isActive) {
                                e.currentTarget.style.backgroundColor = theme === 'dark' ? '#3185eb' : '#eab834';
                                if (theme === 'dark') {
                                    e.currentTarget.style.color = 'white';
                                }
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!button.isActive) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '';
                            }
                        }}
                    >
                        {button.icon}
                    </button>
                );
            })}
        </div>,
        document.body
    );
}
