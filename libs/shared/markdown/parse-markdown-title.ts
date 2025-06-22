import { convertHtmlToMarkdown } from '../html-to-markdown';

/**
 * Parse the first line as title from HTML or Markdown content
 */
export const parseMarkdownTitle = (content: string) => {
    // Convert HTML to Markdown if needed
    const markdown = convertHtmlToMarkdown(content);
    
    // Split by newline and get first non-empty line
    const lines = markdown.split('\n').filter(line => line.trim().length > 0);
    const firstLine = lines[0];
    
    if (!firstLine) {
        return { content, title: undefined };
    }

    // Remove heading markers if present
    let title = firstLine.replace(/^#+\s*/, '').trim();

    // Remove other common markdown formatting
    // Order matters here: remove links first, then other inline formatting
    title = title
        .replace(/!?\[(.*?)\]\(.*?\)/g, '$1') // Remove links and images, keeping the text: [text](url) or ![alt](url) -> text/alt
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold: **text** -> text
        .replace(/\*(.*?)\*/g, '$1')     // Italic: *text* -> text
        .replace(/__(.*?)__/g, '$1')    // Bold (underscore): __text__ -> text
        .replace(/_(.*?)_/g, '$1')      // Italic (underscore): _text_ -> text
        .replace(/~~(.*?)~~/g, '$1')    // Strikethrough: ~~text~~ -> text
        .replace(/`(.*?)`/g, '$1')      // Inline code: `code` -> code
        .trim();
    
    return {
        content: content, // 保留原始内容
        title: title.length > 0 ? title : undefined,
    };
};
