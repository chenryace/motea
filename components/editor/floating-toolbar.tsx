/**
 * Floating Toolbar Component
 * Based on the open-source project Notea, originally created by qingwei-li<cinwell.li@gmail.com>.
 * Modified and maintained by waycaan, 2025.
 *
 * Key modifications:
 * - Added Task List (checkbox) functionality
 * - Enhanced styling and responsiveness
 * - Added more formatting options
 */

import React, { useEffect, useState } from 'react';
import { Editor } from '@tiptap/react';
import { useTheme } from 'next-themes';

interface FloatingToolbarProps {
    editor: Editor | null;
}

const FloatingToolbar: React.FC<FloatingToolbarProps> = ({ editor }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const { theme } = useTheme();

    useEffect(() => {
        if (!editor) return;

        const updateToolbar = () => {
            const { selection } = editor.state;
            const { from, to } = selection;

            if (from === to) {
                setIsVisible(false);
                return;
            }

            const start = editor.view.coordsAtPos(from);
            const end = editor.view.coordsAtPos(to);

            const centerX = (start.left + end.left) / 2;
            const topY = start.top - 60;

            setPosition({
                top: topY,
                left: centerX - 150, 
            });
            setIsVisible(true);
        };

        editor.on('selectionUpdate', updateToolbar);
        editor.on('transaction', updateToolbar);

        return () => {
            editor.off('selectionUpdate', updateToolbar);
            editor.off('transaction', updateToolbar);
        };
    }, [editor]);

    if (!editor || !isVisible) {
        return null;
    }

    const isDark = theme === 'dark';
    const toolbarBg = 'bg-gray-200'; 
    const toolbarBorder = 'border-gray-300'; 
    const toolbarShadow = 'shadow-lg';
    const buttonText = isDark ? 'text-white' : 'text-gray-800';
    const buttonHover = isDark ? 'hover:bg-blue-500 hover:text-white' : 'hover:bg-yellow-400';
    const buttonActive = isDark ? 'bg-blue-200 text-white' : 'bg-yellow-500 text-gray-900';

    const toolbarButtons = [
        {
            icon: 'B',
            action: () => editor.chain().focus().toggleBold().run(),
            isActive: editor.isActive('bold'),
            title: 'Bold (Ctrl+B)',
            className: 'font-bold'
        },
        {
            icon: 'I',
            action: () => editor.chain().focus().toggleItalic().run(),
            isActive: editor.isActive('italic'),
            title: 'Italic (Ctrl+I)',
            className: 'italic'
        },
        {
            icon: 'U',
            action: () => editor.chain().focus().toggleUnderline().run(),
            isActive: editor.isActive('underline'),
            title: 'Underline (Ctrl+U)',
            className: 'underline'
        },
        {
            icon: 'S',
            action: () => editor.chain().focus().toggleStrike().run(),
            isActive: editor.isActive('strike'),
            title: 'Strikethrough',
            className: 'line-through'
        },
        {
            icon: '</>',
            action: () => editor.chain().focus().toggleCode().run(),
            isActive: editor.isActive('code'),
            title: 'Inline Code',
            className: 'font-mono text-sm'
        },
        {
            icon: 'H',
            action: () => editor.chain().focus().toggleHighlight().run(),
            isActive: editor.isActive('highlight'),
            title: 'Highlight (Ctrl+Shift+H)',
            className: 'font-bold'
        },
        {
            icon: '❝',
            action: () => editor.chain().focus().toggleBlockquote().run(),
            isActive: editor.isActive('blockquote'),
            title: 'Quote'
        },
        {
            icon: '•',
            action: () => editor.chain().focus().toggleBulletList().run(),
            isActive: editor.isActive('bulletList'),
            title: 'Bullet List'
        },
        {
            icon: '1.',
            action: () => editor.chain().focus().toggleOrderedList().run(),
            isActive: editor.isActive('orderedList'),
            title: 'Numbered List'
        },
        {
            icon: '☐',
            action: () => editor.chain().focus().toggleTaskList().run(),
            isActive: editor.isActive('taskList'),
            title: 'Task List (Checkbox)'
        },
        {
            icon: '🔗',
            action: () => {
                const url = window.prompt('Enter URL:');
                if (url) {
                    editor.chain().focus().setLink({ href: url }).run();
                }
            },
            isActive: editor.isActive('link'),
            title: 'Link'
        },
        {
            icon: '⇥',
            action: () => {
                // 检查是否在列表中
                const { state } = editor;
                const { $from } = state.selection;

                const isInList = $from.node(-1)?.type.name === 'listItem' ||
                                $from.node(-2)?.type.name === 'listItem' ||
                                $from.node(-3)?.type.name === 'listItem';

                const isInTaskList = $from.node(-1)?.type.name === 'taskItem' ||
                                    $from.node(-2)?.type.name === 'taskItem' ||
                                    $from.node(-3)?.type.name === 'taskItem';

                if (isInList) {
                    editor.commands.sinkListItem('listItem');
                } else if (isInTaskList) {
                    editor.commands.sinkListItem('taskItem');
                } else {
                    // 普通文本缩进 - 简单插入空格
                    const { from, to } = state.selection;
                    if (from === to) {
                        // 光标位置插入缩进
                        editor.commands.insertContent('    ');
                    } else {
                        // 选中文本，每行添加缩进
                        const selectedText = state.doc.textBetween(from, to);
                        const lines = selectedText.split('\n');
                        const indentedText = lines.map(line => '    ' + line).join('\n');
                        editor.chain()
                            .focus()
                            .deleteRange({ from, to })
                            .insertContent(indentedText)
                            .run();
                    }
                }
            },
            isActive: false,
            title: 'Indent (Tab)',
            className: 'font-mono'
        },
        {
            icon: '⇤',
            action: () => {
                // 检查是否在列表中
                const { state } = editor;
                const { $from } = state.selection;

                const isInList = $from.node(-1)?.type.name === 'listItem' ||
                                $from.node(-2)?.type.name === 'listItem' ||
                                $from.node(-3)?.type.name === 'listItem';

                const isInTaskList = $from.node(-1)?.type.name === 'taskItem' ||
                                    $from.node(-2)?.type.name === 'taskItem' ||
                                    $from.node(-3)?.type.name === 'taskItem';

                if (isInList) {
                    editor.commands.liftListItem('listItem');
                } else if (isInTaskList) {
                    editor.commands.liftListItem('taskItem');
                } else {
                    // 普通文本取消缩进 - 移除开头的空格
                    const { from, to } = state.selection;
                    if (from === to) {
                        // 光标位置，检查并移除前面的缩进
                        const lineStart = $from.start();
                        const textFromLineStart = state.doc.textBetween(lineStart, from);

                        if (textFromLineStart.endsWith('    ')) {
                            editor.commands.deleteRange({ from: from - 4, to: from });
                        } else if (textFromLineStart.endsWith('\t')) {
                            editor.commands.deleteRange({ from: from - 1, to: from });
                        }
                    } else {
                        // 选中文本，每行移除缩进
                        const selectedText = state.doc.textBetween(from, to);
                        const lines = selectedText.split('\n');
                        const outdentedText = lines.map(line => {
                            if (line.startsWith('    ')) {
                                return line.slice(4);
                            } else if (line.startsWith('\t')) {
                                return line.slice(1);
                            }
                            return line;
                        }).join('\n');
                        editor.chain()
                            .focus()
                            .deleteRange({ from, to })
                            .insertContent(outdentedText)
                            .run();
                    }
                }
            },
            isActive: false,
            title: 'Outdent (Shift+Tab)',
            className: 'font-mono'
        }
    ];

    return (
        <div
            className={`fixed z-50 ${toolbarBg} ${toolbarBorder} ${toolbarShadow} border rounded-lg p-1.5 flex space-x-0.5`}
            style={{
                top: position.top,
                left: position.left,
                transform: 'translateX(-50%)',
            }}
        >
            {toolbarButtons.map((button, index) => (
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
                        ${button.className || ''}
                    `}
                >
                    {button.icon}
                </button>
            ))}
        </div>
    );
};

export default FloatingToolbar;
