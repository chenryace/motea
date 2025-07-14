/**
 * Lexical Markdown Processor
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
class LexicalMarkdownProcessor {


    processMarkdown(markdown: string): string {
        if (!markdown || markdown.trim() === '') {
            return '';
        }

        try {
            let cleanMarkdown = markdown;

            cleanMarkdown = cleanMarkdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            cleanMarkdown = cleanMarkdown.trim();
            cleanMarkdown = cleanMarkdown.replace(/^(\s*)-\s*\[\s*\]\s*/gm, '$1- [ ] ');
            cleanMarkdown = cleanMarkdown.replace(/^(\s*)-\s*\[x\]\s*/gm, '$1- [x] ');

            return cleanMarkdown;
        } catch (error) {
            console.error('Error processing markdown:', error);
            return markdown;
        }
    }


    isMarkdownContent(content: string): boolean {
        if (!content || content.trim() === '') {
            return false;
        }


        const markdownPatterns = [
            /^#{1,6}\s+/m,
            /^\*\s+/m,
            /^-\s+/m,
            /^\d+\.\s+/m,
            /^-\s+\[[ x]\]\s+/m,
            /```[\s\S]*?```/,
            /`[^`]+`/,
            /\*\*[^*]+\*\*/,
            /\*[^*]+\*/,
            /\[[^\]]+\]\([^)]+\)/,
            /!\[[^\]]*\]\([^)]+\)/,
            /^>\s+/m,
            /^\|.*\|$/m,
            /^---+$/m,
        ];

        return markdownPatterns.some(pattern => pattern.test(content));
    }

    private async createEditorTransformers() {
        const {
            TRANSFORMERS,
            CHECK_LIST,
            HEADING,
            QUOTE,
            CODE,
            UNORDERED_LIST,
            ORDERED_LIST,
            BOLD_ITALIC_STAR,
            BOLD_STAR,
            ITALIC_STAR,
            INLINE_CODE,
            LINK,
            HIGHLIGHT,
            STRIKETHROUGH,
            ElementTransformer,
            TextFormatTransformer
        } = await import('@lexical/markdown');

        const { $isImageNode, ImageNode } = await import('../../../components/editor/nodes/image-node');
        const { $isHorizontalRuleNode, HorizontalRuleNode } = await import('@lexical/react/LexicalHorizontalRuleNode');
        const { $isTableNode, $isTableRowNode, $isTableCellNode, TableNode, TableRowNode, TableCellNode } = await import('@lexical/table');


        const IMAGE_TRANSFORMER: ElementTransformer = {
            dependencies: [ImageNode],
            export: (node) => {
                if (!$isImageNode(node)) {
                    return null;
                }
                return `![${node.getAltText()}](${node.getSrc()})`;
            },
            regExp: /!\[([^\]]*)\]\(([^)]+)\)/,
            replace: (parentNode, children, match) => {
                const [, altText, src] = match;
                const { $createImageNode } = require('../../../components/editor/nodes/image-node');
                const imageNode = $createImageNode({
                    altText,
                    src,
                    maxWidth: 800,
                });
                children.forEach(child => child.remove());
                parentNode.append(imageNode);
            },
            type: 'element',
        };

        const UNDERLINE_TRANSFORMER: TextFormatTransformer = {
            format: ['underline'],
            tag: '<u>',
            type: 'text-format',
        };

        const HR_TRANSFORMER: ElementTransformer = {
            dependencies: [HorizontalRuleNode],
            export: (node) => {
                return $isHorizontalRuleNode(node) ? '---' : null;
            },
            regExp: /^(---|\*\*\*|___)\s?$/,
            replace: (parentNode, _children, _match, isImport) => {
                const { $createHorizontalRuleNode } = require('@lexical/react/LexicalHorizontalRuleNode');
                const line = $createHorizontalRuleNode();
                if (isImport || parentNode.getNextSibling() != null) {
                    parentNode.replace(line);
                } else {
                    parentNode.insertBefore(line);
                }
                line.selectNext();
            },
            type: 'element',
        };

        const TABLE_TRANSFORMER: ElementTransformer = {
            dependencies: [TableNode, TableRowNode, TableCellNode],
            export: (node, traverseChildren) => {
                if (!$isTableNode(node)) {
                    return null;
                }

                const rows = node.getChildren();
                let markdown = '\n';

                rows.forEach((row, rowIndex) => {
                    if ($isTableRowNode(row)) {
                        const cells = row.getChildren();
                        const cellTexts = cells.map(cell => {
                            if ($isTableCellNode(cell)) {
                                return traverseChildren(cell).trim() || ' ';
                            }
                            return ' ';
                        });

                        markdown += '| ' + cellTexts.join(' | ') + ' |\n';


                        if (rowIndex === 0) {
                            markdown += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
                        }
                    }
                });

                return markdown + '\n';
            },
            regExp: /^\|(.+)\|$/,
            replace: (parentNode, children, match, isImport) => {
                if (!isImport) return false;

                try {
                    const cellsText = match[1].split('|').map(cell => cell.trim());

                    const tableNode = $createTableNode();
                    const rowNode = $createTableRowNode();

                    cellsText.forEach(cellText => {
                        const cellNode = $createTableCellNode(1);
                        const { $createParagraphNode, $createTextNode } = require('lexical');
                        const paragraphNode = $createParagraphNode();
                        const textNode = $createTextNode(cellText);
                        paragraphNode.append(textNode);
                        cellNode.append(paragraphNode);
                        rowNode.append(cellNode);
                    });

                    tableNode.append(rowNode);
                    parentNode.append(tableNode);

                    return true;
                } catch (error) {
                    console.error('Table creation error:', error);
                    return false;
                }
            },
            type: 'element',
        };

        return [
            CHECK_LIST,
            ...TRANSFORMERS.filter(t => t !== CHECK_LIST),
            HR_TRANSFORMER,
            UNDERLINE_TRANSFORMER,
            IMAGE_TRANSFORMER,
            TABLE_TRANSFORMER
        ];
    }


    async markdownToJSON(markdown: string): Promise<string> {
        if (!markdown || markdown.trim() === '') {
            return this.createEmptyEditorJSON();
        }

        try {

            const { createEditor } = await import('lexical');
            const {
                $convertFromMarkdownString,
                TRANSFORMERS,
                CHECK_LIST,
                HEADING,
                QUOTE,
                CODE,
                UNORDERED_LIST,
                ORDERED_LIST,
                BOLD_ITALIC_STAR,
                BOLD_STAR,
                ITALIC_STAR,
                INLINE_CODE,
                LINK,
                HIGHLIGHT
            } = await import('@lexical/markdown');
            const { HeadingNode, QuoteNode } = await import('@lexical/rich-text');
            const { ListNode, ListItemNode } = await import('@lexical/list');
            const { CodeNode, CodeHighlightNode } = await import('@lexical/code');
            const { LinkNode, AutoLinkNode } = await import('@lexical/link');
            const { MarkNode } = await import('@lexical/mark');
            const { TableNode, TableCellNode, TableRowNode } = await import('@lexical/table');
            const { HorizontalRuleNode } = await import('@lexical/react/LexicalHorizontalRuleNode');

            const COMPLETE_TRANSFORMERS = await this.createEditorTransformers();
            const {
                registerTableCellUnmergeTransform,
                INSERT_TABLE_COMMAND,
                $createTableNode,
                $createTableRowNode,
                $createTableCellNode
            } = await import('@lexical/table');


            const tempEditor = createEditor({
                nodes: [
                    HeadingNode,
                    QuoteNode,
                    ListNode,
                    ListItemNode,
                    CodeNode,
                    CodeHighlightNode,
                    LinkNode,
                    AutoLinkNode,
                    MarkNode,
                    TableNode,
                    TableCellNode,
                    TableRowNode,
                    HorizontalRuleNode,

                ],
                onError: (error) => console.error('Temp editor error:', error),
            });

            const unregisterTableTransform = registerTableCellUnmergeTransform(tempEditor);

            let jsonResult = '';

            await new Promise<void>((resolve) => {
                tempEditor.update(() => {
                    const cleanMarkdown = this.processMarkdown(markdown);
                    $convertFromMarkdownString(cleanMarkdown, COMPLETE_TRANSFORMERS);
                    resolve();
                });
            });


            const editorState = tempEditor.getEditorState();
            jsonResult = JSON.stringify(editorState.toJSON());

            return jsonResult;
        } catch (error) {
            console.error('Error converting markdown to JSON:', error);

            return this.createSimpleTextJSON(markdown);
        }
    }


    private createEmptyEditorJSON(): string {
        return JSON.stringify({
            root: {
                children: [
                    {
                        children: [],
                        direction: null,
                        format: "",
                        indent: 0,
                        type: "paragraph",
                        version: 1
                    }
                ],
                direction: null,
                format: "",
                indent: 0,
                type: "root",
                version: 1
            }
        });
    }


    private createSimpleTextJSON(text: string): string {
        return JSON.stringify({
            root: {
                children: [
                    {
                        children: [
                            {
                                detail: 0,
                                format: 0,
                                mode: "normal",
                                style: "",
                                text: text,
                                type: "text",
                                version: 1
                            }
                        ],
                        direction: null,
                        format: "",
                        indent: 0,
                        type: "paragraph",
                        version: 1
                    }
                ],
                direction: null,
                format: "",
                indent: 0,
                type: "root",
                version: 1
            }
        });
    }


    async processImportedContent(content: string): Promise<string> {
        if (this.isMarkdownContent(content)) {
            console.log('Detected markdown content, converting to JSON for Lexical...');
            return await this.markdownToJSON(content);
        } else {
            console.log('Content does not appear to be markdown, treating as plain text...');

            return this.createSimpleTextJSON(content);
        }
    }


    validateMarkdown(markdown: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];


        const invalidCheckboxes = markdown.match(/^(\s*)-\s*\[[^\sx ]\]/gm);
        if (invalidCheckboxes) {
            errors.push(`Invalid checkbox format found: ${invalidCheckboxes.join(', ')}`);
        }


        const lines = markdown.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];


            if (/^\s*\d+\.\s/.test(line)) {
                const match = line.match(/^\s*(\d+)\.\s/);
                if (match) {
                    const num = parseInt(match[1]);

                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}


const lexicalMarkdownProcessor = new LexicalMarkdownProcessor();

export default lexicalMarkdownProcessor;
