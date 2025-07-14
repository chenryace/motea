/**
 * Lexical Editor Component
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

import { useImperativeHandle, forwardRef, useCallback, useEffect, useMemo, useRef } from 'react';
import { $getRoot, $createParagraphNode, EditorState, $getSelection, $isRangeSelection, KEY_ENTER_COMMAND, COMMAND_PRIORITY_HIGH } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin, createEmptyHistoryState, type HistoryState } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { TRANSFORMERS, $convertFromMarkdownString, ElementTransformer, TextFormatTransformer, CHECK_LIST } from '@lexical/markdown';
import { UnifiedEditorManager } from 'libs/web/utils/unified-editor-manager';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode, $isListItemNode, $isListNode } from '@lexical/list';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { use100vh } from 'react-div-100vh';
import useMounted from 'libs/web/hooks/use-mounted';
import useI18n from 'libs/web/hooks/use-i18n';

// Import custom plugins and nodes
import SlashCommandsPlugin from './plugins/slash-commands-plugin';
import FloatingToolbarPlugin from './plugins/floating-toolbar-plugin';
import HighlightPlugin from './plugins/highlight-plugin';
import ImagePlugin from './plugins/image-plugin';
import IMEPlugin from './plugins/ime-plugin';
import CodeBlockPlugin from './plugins/code-block-plugin';
import CollapsiblePlugin from './plugins/collapsible-plugin';
import LazyPluginLoader from './plugins/lazy-plugin-loader';
import EnhancedDeletePlugin from './plugins/enhanced-delete-plugin';
import { ImageNode, $createImageNode, $isImageNode } from './nodes/image-node';
import { HorizontalRuleNode, $isHorizontalRuleNode, $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { $isTableNode, $isTableCellNode, $isTableRowNode } from '@lexical/table';
import { CollapsibleContainerNode } from './nodes/collapsible-container-node';
import { CollapsibleTitleNode } from './nodes/collapsible-title-node';
import { CollapsibleContentNode } from './nodes/collapsible-content-node';



export interface LexicalEditorProps {
    readOnly?: boolean;
    isPreview?: boolean;
    value?: string;
    onChange?: (jsonContent: string) => void;
    onCreateLink?: (title: string) => Promise<string>;
    onSearchLink?: (term: string) => Promise<any[]>;
    onClickLink?: (href: string, event: any) => void;
    onHoverLink?: (event: any) => boolean;
    className?: string;
    noteId?: string;
}

export interface LexicalEditorRef {
    focusAtEnd: () => void;
    focusAtStart: () => void;
}


const theme = {
    ltr: 'ltr',
    rtl: 'rtl',
    placeholder: 'editor-placeholder',
    paragraph: 'editor-paragraph',
    quote: 'editor-quote',
    heading: {
        h1: 'editor-heading-h1',
        h2: 'editor-heading-h2',
        h3: 'editor-heading-h3',
        h4: 'editor-heading-h4',
        h5: 'editor-heading-h5',
        h6: 'editor-heading-h6',
    },
    list: {
        nested: {
            listitem: 'editor-nested-listitem',
        },
        ol: 'editor-list-ol',
        ul: 'editor-list-ul',
        listitem: 'editor-listitem',
        listitemChecked: 'editor-listitem-checked',
        listitemUnchecked: 'editor-listitem-unchecked',
    },
    image: 'editor-image',
    link: 'editor-link',
    text: {
        bold: 'editor-text-bold',
        italic: 'editor-text-italic',
        overflowed: 'editor-text-overflowed',
        hashtag: 'editor-text-hashtag',
        underline: 'editor-text-underline',
        strikethrough: 'editor-text-strikethrough',
        underlineStrikethrough: 'editor-text-underlineStrikethrough',
        code: 'editor-text-code',
    },
    code: 'editor-code',
    codeHighlight: {
        atrule: 'editor-tokenAttr',
        attr: 'editor-tokenAttr',
        boolean: 'editor-tokenProperty',
        builtin: 'editor-tokenSelector',
        cdata: 'editor-tokenComment',
        char: 'editor-tokenSelector',
        class: 'editor-tokenFunction',
        'class-name': 'editor-tokenFunction',
        comment: 'editor-tokenComment',
        constant: 'editor-tokenProperty',
        deleted: 'editor-tokenProperty',
        doctype: 'editor-tokenComment',
        entity: 'editor-tokenOperator',
        function: 'editor-tokenFunction',
        important: 'editor-tokenVariable',
        inserted: 'editor-tokenSelector',
        keyword: 'editor-tokenAttr',
        namespace: 'editor-tokenVariable',
        number: 'editor-tokenProperty',
        operator: 'editor-tokenOperator',
        prolog: 'editor-tokenComment',
        property: 'editor-tokenProperty',
        punctuation: 'editor-tokenPunctuation',
        regex: 'editor-tokenVariable',
        selector: 'editor-tokenSelector',
        string: 'editor-tokenSelector',
        symbol: 'editor-tokenProperty',
        tag: 'editor-tokenProperty',
        url: 'editor-tokenOperator',
        variable: 'editor-tokenVariable',
    },
    indent: 'editor-indent',
    table: 'editor-table',
    tableRow: 'editor-table-row',
    tableCell: 'editor-table-cell',
    tableCellHeader: 'editor-table-cell-header',
    collapsibleContainer: 'collapsible-container',
    collapsibleTitle: 'collapsible-title',
    collapsibleContent: 'collapsible-content',
};

function Placeholder() {
    const { t } = useI18n();
    return <div className="editor-placeholder">{t('Start writing...')}</div>;
}


function createLimitedHistoryState(maxSize: number): HistoryState {
    const historyState = createEmptyHistoryState();

    const originalPush = Array.prototype.push;
    if (historyState.undoStack) {
        historyState.undoStack.push = function(...items) {
            const result = originalPush.apply(this, items);
            if (this.length > maxSize) {
                this.splice(0, this.length - maxSize);
            }
            return result;
        };
    }


    if (historyState.redoStack) {
        historyState.redoStack.push = function(...items) {
            const result = originalPush.apply(this, items);
            if (this.length > maxSize) {
                this.splice(0, this.length - maxSize);
            }
            return result;
        };
    }

    return historyState;
}

const LexicalEditor = forwardRef<LexicalEditorRef, LexicalEditorProps>(({
    readOnly = false,
    value = '',
    onChange,
    onClickLink: _onClickLink,
    onHoverLink: _onHoverLink,
    className = '',
    noteId,
}, ref) => {
    const height = use100vh();
    const mounted = useMounted();

    const historyStateRef = useRef<HistoryState | null>(null);
    const limitedHistoryState = useMemo(() => {
        const state = createLimitedHistoryState(50);
        historyStateRef.current = state;
        return state;
    }, []);

    const clearHistory = useCallback(() => {
        if (historyStateRef.current) {
            historyStateRef.current.undoStack.length = 0;
            historyStateRef.current.redoStack.length = 0;
            historyStateRef.current.current = null;
        }
    }, []);


    const editorManager = useMemo(() => {
        const manager = new UnifiedEditorManager({
            debounceDelay: 300,
            debug: false,
            onSave: async (event) => {
                if (onChange) {
                    onChange(event.jsonContent);
                }
            },
            onError: (error) => {
                console.error('Editor error:', error);
            },
            onHistoryClear: clearHistory
        });
        return manager;
    }, [onChange, clearHistory]);


    useEffect(() => {
        if (noteId) {
            editorManager.setNoteId(noteId);
        }
    }, [editorManager, noteId]);


    useEffect(() => {
        return () => {
            editorManager.destroy();
        };
    }, [editorManager]);

    const initialConfig = {
        namespace: 'LexicalEditor',
        theme,
        onError(error: Error) {
            console.error('Lexical Error:', error);
        },
        nodes: [
            HeadingNode,
            ListNode,
            ListItemNode,
            QuoteNode,
            CodeNode,
            CodeHighlightNode,
            AutoLinkNode,
            LinkNode,
            ImageNode,
            HorizontalRuleNode,
            TableNode,
            TableCellNode,
            TableRowNode,
            CollapsibleContainerNode,
            CollapsibleTitleNode,
            CollapsibleContentNode,
        ],
        editable: !readOnly,

        editorState: null,
    };


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
        replace: (_parentNode, _children, _match, _isImport) => {

            return false;
        },
        type: 'element',
    };

    // 重新排序transformers，确保CHECK_LIST优先级高于UNORDERED_LIST
    const customTransformers = [
        CHECK_LIST,
        ...TRANSFORMERS.filter(t => t !== CHECK_LIST),
        HR_TRANSFORMER,
        UNDERLINE_TRANSFORMER,
        IMAGE_TRANSFORMER,
        TABLE_TRANSFORMER
    ];


    const handleChange = useCallback((editorState: EditorState, _editor: any, tags: Set<string>) => {
        editorManager.handleEditorChange(editorState, tags);
    }, [editorManager]);


    const ListExitPlugin = () => {
        const [editor] = useLexicalComposerContext();

        useEffect(() => {
            return editor.registerCommand(
                KEY_ENTER_COMMAND,
                (event: KeyboardEvent | null) => {
                    const selection = $getSelection();
                    if (!$isRangeSelection(selection)) {
                        return false;
                    }

                    const anchorNode = selection.anchor.getNode();


                    if ($isListItemNode(anchorNode)) {
                        const textContent = anchorNode.getTextContent().trim();

                        if (textContent === '') {
                            const listNode = anchorNode.getParent();

                            if ($isListNode(listNode)) {
                                event?.preventDefault();

                                const paragraph = $createParagraphNode();
                                listNode.insertAfter(paragraph);

                                anchorNode.remove();
                                paragraph.select();

                                return true;
                            }
                        }
                    }

                    return false;
                },
                COMMAND_PRIORITY_HIGH
            );
        }, [editor]);

        return null;
    };


    const isJSONFormat = useCallback((content: string): boolean => {
        const trimmed = content.trim();
        return trimmed.startsWith('{') && trimmed.endsWith('}');
    }, []);




    const ContentSyncPlugin = () => {
        const [editor] = useLexicalComposerContext();

        useEffect(() => {
            if (editor && value !== undefined && mounted) {
                editor.getEditorState().read(() => {
                    const currentStateJSON = JSON.stringify(editor.getEditorState().toJSON());
                    if (currentStateJSON !== value) {
                        try {
                            if (isJSONFormat(value)) {

                                const editorState = editor.parseEditorState(value);
                                editor.setEditorState(editorState);
                            } else if (value.trim() === '') {

                                editor.update(() => {
                                    const root = $getRoot();
                                    root.clear();
                                    const paragraph = $createParagraphNode();
                                    root.append(paragraph);
                                }, { tag: 'content-sync' });
                            } else {

                                editor.update(() => {
                                    $convertFromMarkdownString(value, customTransformers);
                                }, { tag: 'content-sync' });
                            }
                        } catch (error) {
                            console.error('ContentSync error:', error);

                            editor.update(() => {
                                const root = $getRoot();
                                root.clear();
                                const paragraph = $createParagraphNode();
                                root.append(paragraph);
                            }, { tag: 'content-sync' });
                        }
                    }
                });
            }
        }, [editor, value, mounted]);

        return null;
    };

    useImperativeHandle(ref, () => ({
        focusAtEnd: () => {
            // TODO: Implement focus at end
        },
        focusAtStart: () => {
            // TODO: Implement focus at start
        },
    }));

    if (!mounted) {
        return null;
    }

    return (
        <div className={`lexical-editor ${className}`}>
            <LexicalComposer initialConfig={initialConfig}>
                <div className="editor-container">
                    <RichTextPlugin
                        contentEditable={
                            <ContentEditable
                                className="editor-input focus:outline-none w-full"
                                style={{
                                    minHeight: `calc(${height ? height + 'px' : '100vh'} - 14rem)`
                                }}
                                spellCheck={false}
                            />
                        }
                        placeholder={<Placeholder />}
                        ErrorBoundary={LexicalErrorBoundary}
                    />
                    <HistoryPlugin delay={1000} externalHistoryState={limitedHistoryState} />
                    <AutoFocusPlugin />
                    <LinkPlugin />
                    <ListPlugin />
                    <MarkdownShortcutPlugin transformers={customTransformers} />
                    <SlashCommandsPlugin />
                    <FloatingToolbarPlugin />
                    <CheckListPlugin />
                    <TabIndentationPlugin />
                    <HorizontalRulePlugin />
                    <ImagePlugin />
                    <HighlightPlugin />
                    <CodeBlockPlugin />
                    <CollapsiblePlugin />
                    <EnhancedDeletePlugin />
                    <LazyPluginLoader enableTable={true} enableTextAlign={true} />
                    <IMEPlugin enabled={true} debug={process.env.NODE_ENV === 'development'} />

                    <ListExitPlugin />


                    <ContentSyncPlugin />
                    <OnChangePlugin
                        onChange={handleChange}
                        ignoreHistoryMergeTagChange={true}
                        ignoreSelectionChange={true}
                    />
                </div>
            </LexicalComposer>

        </div>
    );
});

LexicalEditor.displayName = 'LexicalEditor';

export default LexicalEditor;
