/**
 * Enhanced Delete Plugin for Lexical
 * 实现Collapsible和Table的渐进式删除逻辑
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    $getSelection,
    $isRangeSelection,
    COMMAND_PRIORITY_HIGH,
    KEY_DELETE_COMMAND,
    KEY_BACKSPACE_COMMAND,
    $createParagraphNode,
    $insertNodes,
    $isElementNode,
} from 'lexical';
import { $isCollapsibleContainerNode } from '../nodes/collapsible-container-node';
import { $isCollapsibleTitleNode } from '../nodes/collapsible-title-node';

export default function EnhancedDeletePlugin(): null {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        // 处理Collapsible渐进式删除
        const handleCollapsibleDeletion = (selection: any, event: KeyboardEvent | null): boolean => {
            const nodes = selection.getNodes();

            for (const node of nodes) {
                // 检查是否在CollapsibleTitle中
                if ($isCollapsibleTitleNode(node) || node.getParent() && $isCollapsibleTitleNode(node.getParent())) {
                    const titleNode = $isCollapsibleTitleNode(node) ? node : node.getParent();

                    // 检查title是否为空
                    const titleText = titleNode?.getTextContent().trim();

                    if (!titleText || titleText === '') {
                        // title为空，删除整个容器
                        const container = titleNode?.getParent();
                        if ($isCollapsibleContainerNode(container)) {
                            event?.preventDefault();
                            container.remove();

                            // 插入新段落
                            const paragraph = $createParagraphNode();
                            $insertNodes([paragraph]);
                            paragraph.select();
                            return true;
                        }
                    }
                    // title不为空，让默认删除行为处理（删除字符）
                    return false;
                }
            }
            return false;
        };

        // 主删除处理函数
        const handleDeletion = (event: KeyboardEvent | null) => {
            return editor.update(() => {
                const selection = $getSelection();

                if (!$isRangeSelection(selection)) return false;

                // 只处理Collapsible删除，Table删除由Lexical原生处理
                if (handleCollapsibleDeletion(selection, event)) {
                    return true;
                }

                // 都不匹配，让默认行为处理
                return false;
            });
        };

        // 处理Delete键
        const removeDeleteCommand = editor.registerCommand(
            KEY_DELETE_COMMAND,
            (event) => {
                return handleDeletion(event);
            },
            COMMAND_PRIORITY_HIGH
        );

        // 处理Backspace键
        const removeBackspaceCommand = editor.registerCommand(
            KEY_BACKSPACE_COMMAND,
            (event) => {
                return handleDeletion(event);
            },
            COMMAND_PRIORITY_HIGH
        );

        return () => {
            removeDeleteCommand();
            removeBackspaceCommand();
        };
    }, [editor]);

    return null;
}
