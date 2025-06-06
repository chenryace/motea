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
    const title = firstLine.replace(/^#+\s*/,'').trim();
    
    // Remove the first line from content if it was used as title
    const remainingContent = content.replace(firstLine, '').trim();
    
    return {
        content: remainingContent,
        title: title.length > 0 ? title : undefined,
    };
};
