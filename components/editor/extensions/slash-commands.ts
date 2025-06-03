import { Extension } from '@tiptap/core';
import { Suggestion } from '@tiptap/suggestion';

const slashCommands = [
    {
        title: 'Heading 1',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
        },
    },
    {
        title: 'Heading 2',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
        },
    },
    {
        title: 'Heading 3',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
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
            editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
    },
    {
        title: 'Code Block',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
    },
    {
        title: 'Horizontal Rule',
        command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        },
    },
];

const createSlashMenu = (commands: any[], onSelect: (command: any) => void) => {
    const menu = document.createElement('div');

    const isDark = document.documentElement.classList.contains('dark');
    const bgClass = 'bg-gray-200'; 
    const borderClass = 'border-gray-300'; 
    const textClass = isDark ? 'text-gray-200' : 'text-gray-800';
    const hoverClass = isDark ? 'hover:bg-blue-600 hover:text-white' : 'hover:bg-yellow-500';

    menu.className = `slash-commands-menu ${bgClass} ${borderClass} ${textClass} border rounded-lg shadow-lg p-1 max-h-64 overflow-y-auto fixed z-50`;
    menu.style.minWidth = '180px';

    commands.forEach((command, index) => {
        const button = document.createElement('button');
        const focusClass = isDark ? 'focus:bg-blue-600 focus:text-white' : 'focus:bg-yellow-500';
        button.className = `w-full text-left px-3 py-2 rounded ${hoverClass} ${focusClass} focus:outline-none block transition-colors duration-150`;
        button.onclick = () => {
            onSelect(command);
            menu.remove();
        };

        const titleDiv = document.createElement('div');
        titleDiv.className = 'font-medium text-sm';
        titleDiv.textContent = command.title;

        button.appendChild(titleDiv);
        menu.appendChild(button);
    });

    return menu;
};

export const SlashCommands = Extension.create({
    name: 'slashCommands',

    addOptions() {
        return {
            suggestion: {
                char: '/',
                command: ({ editor, range, props }: any) => {
                    props.command({ editor, range });
                },
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ];
    },
});

export default SlashCommands;
