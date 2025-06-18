/**
 * Slash Suggestion Component for Tiptap Editor
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

import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import CommandsList from './commands-list';

const commands = [
    {
        title: 'Text',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).setParagraph().run();
        },
    },
    {
        title: 'Heading 1',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
        },
    },
    {
        title: 'Heading 2',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
        },
    },
    {
        title: 'Heading 3',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
        },
    },
    {
        title: 'Bullet List',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
    },
    {
        title: 'Numbered List',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
    },
    {
        title: 'Task List',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).toggleTaskList().run();
        },
    },
    {
        title: 'Quote',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).setParagraph().toggleBlockquote().run();
        },
    },
    {
        title: 'Code Block',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
    },
    {
        title: 'Image',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).run();
            const url = prompt('Enter image URL:');
            if (url) {
                editor.chain().focus().setImage({ src: url }).run();
            }
        },
    },
    {
        title: 'Indent List Item',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).run();
            // 尝试缩进列表项或任务项
            const success = editor.commands.sinkListItem('listItem') ||
                           editor.commands.sinkListItem('taskItem');
            if (!success) {
                // 如果不在列表中，插入缩进空格
                editor.commands.insertContent('    ');
            }
        },
    },
    {
        title: 'Outdent List Item',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).run();
            // 尝试取消缩进列表项或任务项
            editor.commands.liftListItem('listItem') ||
            editor.commands.liftListItem('taskItem');
        },
    },
];

export default function suggestion() {
    return {
        items: ({ query }: any) => {
            return commands
                .filter(item =>
                    item.title.toLowerCase().includes(query.toLowerCase())
                )
                .slice(0, 10);
        },
        render: () => {
            let component: ReactRenderer;
            let popup: any;

            return {
                onStart: (props: any) => {
                    component = new ReactRenderer(CommandsList, {
                        props,
                        editor: props.editor,
                    });

                    if (!props.clientRect) {
                        return;
                    }

                    popup = tippy('body', {
                        getReferenceClientRect: props.clientRect,
                        appendTo: () => document.body,
                        content: component.element,
                        showOnCreate: true,
                        interactive: true,
                        trigger: 'manual',
                        placement: 'bottom-start',
                    });
                },

                onUpdate(props: any) {
                    component.updateProps(props);

                    if (!props.clientRect) {
                        return;
                    }

                    popup[0].setProps({
                        getReferenceClientRect: props.clientRect,
                    });
                },

                onKeyDown(props: any) {
                    if (props.event.key === 'Escape') {
                        popup[0].hide();
                        return true;
                    }

                    return component.ref?.onKeyDown(props.event);
                },

                onExit() {
                    popup[0].destroy();
                    component.destroy();
                },
            };
        },
    };
}
