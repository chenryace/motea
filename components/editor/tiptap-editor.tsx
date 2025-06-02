import { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Highlight from './extensions/highlight';
import { use100vh } from 'react-div-100vh';
import useMounted from 'libs/web/hooks/use-mounted';
import { useToast } from 'libs/web/hooks/use-toast';
import useI18n from 'libs/web/hooks/use-i18n';
import MarkdownExtension from './extensions/markdown';
import SlashCommands from './extensions/slash-commands';
import ImageMarkdown from './extensions/image-markdown';
import suggestion from './extensions/slash-suggestion';
import FloatingToolbar from './floating-toolbar';

export interface TiptapEditorProps {
    readOnly?: boolean;
    isPreview?: boolean;
    value?: string;
    onChange?: (value: () => string) => void;
    onCreateLink?: (title: string) => Promise<string>;
    onSearchLink?: (term: string) => Promise<any[]>;
    onClickLink?: (href: string, event: any) => void;
    onHoverLink?: (event: any) => boolean;
    className?: string;
}

export interface TiptapEditorRef {
    focusAtEnd: () => void;
    focusAtStart: () => void;
}

const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(({
    readOnly = false,
    value = '',
    onChange,
    onClickLink,
    onHoverLink,
    className = '',
}, ref) => {
    const height = use100vh();
    const mounted = useMounted();
    const { t } = useI18n();

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                // 禁用默认的 heading 扩展，我们会自定义
                heading: {
                    levels: [1, 2, 3, 4, 5, 6],
                },
                // 配置代码块
                codeBlock: {
                    languageClassPrefix: 'language-',
                },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-600 hover:text-blue-800 underline',
                },
            }),
            // 使用我们的自定义 ImageMarkdown 扩展
            ImageMarkdown.configure({
                HTMLAttributes: {
                    class: 'max-w-full h-auto rounded-lg my-4',
                },
                allowBase64: true,
                inline: false,
            }),
            Placeholder.configure({
                placeholder: t('Start writing...'),
            }),
            Underline,
            Highlight.configure({
                multicolor: false,
            }),
            MarkdownExtension,
            SlashCommands.configure({
                suggestion: suggestion(),
            }),
        ],
        content: value,
        editable: !readOnly,
        editorProps: {
            attributes: {
                spellcheck: 'false',
                autocorrect: 'off',
                autocapitalize: 'off',
                autocomplete: 'off',
            },
        },
        onUpdate: ({ editor }) => {
            if (onChange) {
                // 获取 Markdown 格式的内容
                const markdown = editor.storage.markdown?.transformer?.serialize(editor.state.doc) || editor.getHTML();
                onChange(() => markdown);
            }
        },
        onCreate: ({ editor }) => {
            // 编辑器创建时的初始化
            if (value && value !== editor.getHTML()) {
                editor.commands.setContent(value);
            }
        },
    });

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
        focusAtEnd: () => {
            editor?.commands.focus('end');
        },
        focusAtStart: () => {
            editor?.commands.focus('start');
        },
    }));

    // 处理内容变化
    useEffect(() => {
        if (editor && value !== undefined) {
            const currentContent = editor.getHTML();
            if (value !== currentContent) {
                editor.commands.setContent(value, false);
            }
        }
    }, [editor, value]);

    // 处理链接点击
    useEffect(() => {
        if (editor && onClickLink) {
            const handleClick = (event: MouseEvent) => {
                const target = event.target as HTMLElement;
                if (target.tagName === 'A') {
                    event.preventDefault();
                    const href = target.getAttribute('href');
                    if (href) {
                        onClickLink(href, event);
                    }
                }
            };

            const editorElement = editor.view.dom;
            editorElement.addEventListener('click', handleClick);

            return () => {
                editorElement.removeEventListener('click', handleClick);
            };
        }
    }, [editor, onClickLink]);

    // 处理链接悬停
    useEffect(() => {
        if (editor && onHoverLink) {
            const handleMouseOver = (event: MouseEvent) => {
                const target = event.target as HTMLElement;
                if (target.tagName === 'A') {
                    onHoverLink(event);
                }
            };

            const editorElement = editor.view.dom;
            editorElement.addEventListener('mouseover', handleMouseOver);

            return () => {
                editorElement.removeEventListener('mouseover', handleMouseOver);
            };
        }
    }, [editor, onHoverLink]);

    if (!mounted) {
        return null;
    }

    return (
        <div className={`tiptap-editor ${className}`}>
            <EditorContent
                editor={editor}
                className="focus:outline-none w-full"
                spellCheck={false}
            />
            <FloatingToolbar editor={editor} />
            <style jsx global>{`
                .ProseMirror {
                    outline: none;
                    padding: 1rem 0;
                    min-height: calc(${height ? height + 'px' : '100vh'} - 14rem);
                    padding-bottom: 10rem;
                    width: 100%;
                    max-width: none;
                    line-height: 1.7;
                    font-size: 1rem;
                    color: inherit;
                    /* 禁用拼写检查和自动更正 */
                    -webkit-spellcheck: false;
                    -moz-spellcheck: false;
                    -ms-spellcheck: false;
                    spellcheck: false;
                }

                .ProseMirror p {
                    margin: 1rem 0;
                    line-height: 1.7;
                }

                .ProseMirror h1 {
                    font-size: 2.8em;
                    font-weight: bold;
                    margin: 1.5rem 0 1rem 0;
                    line-height: 1.2;
                }

                .ProseMirror h2 {
                    font-size: 2.2em;
                    font-weight: bold;
                    margin: 1.3rem 0 0.8rem 0;
                    line-height: 1.3;
                }

                .ProseMirror h3 {
                    font-size: 1.8em;
                    font-weight: bold;
                    margin: 1.2rem 0 0.6rem 0;
                    line-height: 1.4;
                }

                .ProseMirror ul {
                    list-style-type: none;
                    padding-left: 0;
                    margin: 1rem 0;
                }

                .ProseMirror ul li {
                    position: relative;
                    padding-left: 1.5rem;
                    margin: 0.25rem 0;
                }

                .ProseMirror ul li::before {
                    content: '•';
                    position: absolute;
                    left: 0;
                    color: #374151;
                    font-weight: bold;
                }

                .ProseMirror ol {
                    list-style-type: none;
                    padding-left: 0;
                    margin: 1rem 0;
                    counter-reset: list-counter;
                }

                .ProseMirror ol li {
                    position: relative;
                    padding-left: 1.5rem;
                    margin: 0.25rem 0;
                    counter-increment: list-counter;
                }

                .ProseMirror ol li::before {
                    content: counter(list-counter) '.';
                    position: absolute;
                    left: 0;
                    color: #374151;
                    font-weight: bold;
                }

                .ProseMirror blockquote {
                    border-left: 4px solid #e5e7eb;
                    padding-left: 1rem;
                    margin: 1rem 0;
                    font-style: italic;
                    color: #6b7280;
                }

                .ProseMirror code {
                    background-color: #f3f4f6;
                    color: #1f2937;
                    padding: 0.2rem 0.4rem;
                    border-radius: 0.25rem;
                    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                    font-size: 0.875em;
                }

                .dark .ProseMirror code {
                    background-color: #374151;
                    color: #f9fafb;
                }

                .ProseMirror pre {
                    background-color: #f8f9fa;
                    border: 1px solid #e9ecef;
                    border-radius: 0.375rem;
                    padding: 1rem;
                    overflow-x: auto;
                    margin: 1rem 0;
                }

                .dark .ProseMirror pre {
                    background-color: #1f2937;
                    border: 1px solid #4b5563;
                    color: #f9fafb;
                }

                .ProseMirror pre code {
                    background: none;
                    padding: 0;
                    border-radius: 0;
                    font-size: 0.875rem;
                }

                .ProseMirror p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    color: #adb5bd;
                    pointer-events: none;
                    height: 0;
                }

                /* 高亮样式 - 浅色主题深黄色，深色主题蓝色背景白色字体 */
                .ProseMirror mark {
                    background-color: #fbbf24;
                    color: #1f2937;
                    padding: 0.1rem 0.2rem;
                    border-radius: 0.125rem;
                    box-decoration-break: clone;
                }

                .dark .ProseMirror mark {
                    background-color: #2563eb;
                    color: #ffffff;
                    font-weight: 500;
                }

                /* 修复深色主题下加粗+高亮的样式冲突 */
                .dark .ProseMirror strong mark,
                .dark .ProseMirror mark strong {
                    font-weight: bold;
                }

                /* 删除线样式 */
                .ProseMirror s {
                    text-decoration: line-through;
                    color: #6b7280;
                }

                /* 下划线样式 */
                .ProseMirror u {
                    text-decoration: underline;
                }
            `}</style>
        </div>
    );
});

TiptapEditor.displayName = 'TiptapEditor';

export default TiptapEditor;
