import MarkdownIt from 'markdown-it';

/**
 * Markdown 处理器 - 专门用于处理导入的 markdown 文件
 * 将原始 markdown 内容转换为 TipTap 编辑器可以理解的格式
 */
class MarkdownProcessor {
    private md: MarkdownIt;

    constructor() {
        this.md = new MarkdownIt({
            html: true,        // 允许 HTML 标签
            linkify: true,     // 自动转换 URL 为链接
            typographer: true, // 启用一些语言中性的替换 + 引号美化
            breaks: true,      // 将换行符转换为 <br>
        });
    }

    /**
     * 将 markdown 内容转换为 HTML
     * TipTap 可以直接解析 HTML 内容并正确渲染
     */
    markdownToHtml(markdown: string): string {
        if (!markdown || markdown.trim() === '') {
            return '<p></p>';
        }

        try {
            // 使用 markdown-it 将 markdown 转换为 HTML
            const html = this.md.render(markdown);
            
            // 如果转换结果为空，返回一个空段落
            if (!html || html.trim() === '') {
                return '<p></p>';
            }

            return html;
        } catch (error) {
            console.error('Error converting markdown to HTML:', error);
            // 如果转换失败，将原始内容包装在 <p> 标签中
            return `<p>${this.escapeHtml(markdown)}</p>`;
        }
    }

    /**
     * 转义 HTML 特殊字符
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 检查内容是否看起来像 markdown
     */
    isMarkdownContent(content: string): boolean {
        if (!content || content.trim() === '') {
            return false;
        }

        // 检查常见的 markdown 语法
        const markdownPatterns = [
            /^#{1,6}\s+/m,           // 标题 # ## ###
            /^\*\s+/m,               // 无序列表 *
            /^-\s+/m,                // 无序列表 -
            /^\d+\.\s+/m,            // 有序列表 1.
            /```[\s\S]*?```/,        // 代码块
            /`[^`]+`/,               // 行内代码
            /\*\*[^*]+\*\*/,         // 粗体
            /\*[^*]+\*/,             // 斜体
            /\[[^\]]+\]\([^)]+\)/,   // 链接
            /!\[[^\]]*\]\([^)]+\)/,  // 图片
            /^>\s+/m,                // 引用
            /^\|.*\|$/m,             // 表格
            /^---+$/m,               // 分隔线
        ];

        return markdownPatterns.some(pattern => pattern.test(content));
    }

    /**
     * 处理导入的内容
     * 如果是 markdown 格式，转换为 HTML；否则保持原样
     */
    processImportedContent(content: string): string {
        if (this.isMarkdownContent(content)) {
            console.log('Detected markdown content, converting to HTML...');
            return this.markdownToHtml(content);
        } else {
            console.log('Content does not appear to be markdown, keeping as plain text...');
            // 如果不是 markdown，将其包装在段落中以确保正确显示
            return `<p>${this.escapeHtml(content)}</p>`;
        }
    }
}

// 创建单例实例
const markdownProcessor = new MarkdownProcessor();

export default markdownProcessor;
