import { Extension } from '@tiptap/core';

// 简单的 Markdown 转换器
class MarkdownTransformer {
    // 将 ProseMirror 文档转换为 Markdown（简化版本）
    serialize(doc: any): string {
        // 这里我们使用一个简化的方法
        // 实际上应该遍历 ProseMirror 文档节点并转换为 Markdown
        // 暂时返回 HTML，后续可以改进
        return this.htmlToMarkdown(doc.content);
    }

    // 将 Markdown 转换为 ProseMirror 文档（简化版本）
    parse(markdown: string): any {
        // 简化的解析，实际应该使用 markdown-it 解析
        return markdown;
    }

    // 简单的 HTML 到 Markdown 转换
    private htmlToMarkdown(content: any): string {
        // 这是一个简化的实现
        // 实际项目中应该使用更完善的转换器
        if (!content) return '';

        let markdown = '';

        if (Array.isArray(content)) {
            content.forEach((node: any) => {
                markdown += this.nodeToMarkdown(node);
            });
        } else {
            markdown = this.nodeToMarkdown(content);
        }

        return markdown;
    }

    private nodeToMarkdown(node: any): string {
        if (!node) return '';

        switch (node.type) {
            case 'paragraph':
                return this.inlineToMarkdown(node.content) + '\n\n';
            case 'heading':
                const level = node.attrs?.level || 1;
                return '#'.repeat(level) + ' ' + this.inlineToMarkdown(node.content) + '\n\n';
            case 'codeBlock':
                const lang = node.attrs?.language || '';
                return '```' + lang + '\n' + (node.content?.[0]?.text || '') + '\n```\n\n';
            case 'blockquote':
                return '> ' + this.inlineToMarkdown(node.content) + '\n\n';
            case 'bulletList':
                return this.listToMarkdown(node.content, '- ') + '\n';
            case 'orderedList':
                return this.listToMarkdown(node.content, '1. ') + '\n';
            case 'listItem':
                return this.inlineToMarkdown(node.content);
            case 'horizontalRule':
                return '---\n\n';
            case 'image':
                const src = node.attrs?.src || '';
                const alt = node.attrs?.alt || '';
                const title = node.attrs?.title || '';
                if (title && title !== alt) {
                    return `![${alt}](${src} "${title}")\n\n`;
                } else {
                    return `![${alt}](${src})\n\n`;
                }
            default:
                return this.inlineToMarkdown(node.content);
        }
    }

    private inlineToMarkdown(content: any): string {
        if (!content) return '';

        let result = '';

        if (Array.isArray(content)) {
            content.forEach((node: any) => {
                result += this.inlineNodeToMarkdown(node);
            });
        } else {
            result = this.inlineNodeToMarkdown(content);
        }

        return result;
    }

    private inlineNodeToMarkdown(node: any): string {
        if (!node) return '';

        if (node.type === 'text') {
            let text = node.text || '';

            if (node.marks) {
                node.marks.forEach((mark: any) => {
                    switch (mark.type) {
                        case 'strong':
                            text = '**' + text + '**';
                            break;
                        case 'em':
                            text = '*' + text + '*';
                            break;
                        case 'code':
                            text = '`' + text + '`';
                            break;
                        case 'link':
                            text = '[' + text + '](' + mark.attrs.href + ')';
                            break;
                        case 'underline':
                            text = '<u>' + text + '</u>';
                            break;
                    }
                });
            }

            return text;
        }

        return '';
    }

    private listToMarkdown(items: any[], prefix: string): string {
        if (!items) return '';

        return items.map((item: any) => {
            return prefix + this.inlineToMarkdown(item.content);
        }).join('\n');
    }
}

// Tiptap 扩展
export const MarkdownExtension = Extension.create({
    name: 'markdown',

    addStorage() {
        return {
            transformer: new MarkdownTransformer(),
        };
    },

    addCommands() {
        return {
            setMarkdown: (markdown: string) => ({ commands }: any) => {
                const doc = this.storage.transformer.parse(markdown);
                return commands.setContent(doc);
            },
            getMarkdown: () => ({ editor }: any) => {
                return this.storage.transformer.serialize(editor.state.doc);
            },
        } as any;
    },

    addKeyboardShortcuts() {
        return {
            // Ctrl+S 保存快捷键
            'Mod-s': () => {
                // 触发保存事件
                const saveButton = document.querySelector('button[data-save-button]') as HTMLButtonElement;
                if (saveButton) {
                    saveButton.click();
                }
                return true;
            },
        };
    },
});

export default MarkdownExtension;
