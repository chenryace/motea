import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import CommandsList from './commands-list';

// 命令定义
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
            // 这里可以触发图片上传对话框
            const url = prompt('Enter image URL:');
            if (url) {
                editor.chain().focus().setImage({ src: url }).run();
            }
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
