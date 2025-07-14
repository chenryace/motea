/**
 * Image Plugin for Lexical
 * Handles image insertion and Markdown syntax parsing
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    $getSelection,
    $isRangeSelection,
    COMMAND_PRIORITY_LOW,
    createCommand,
    LexicalCommand,
} from 'lexical';
import { $insertNodes } from 'lexical';
import { useEffect } from 'react';
import { $createImageNode, ImagePayload } from '../nodes/image-node';

export const INSERT_IMAGE_COMMAND: LexicalCommand<ImagePayload> = createCommand(
    'INSERT_IMAGE_COMMAND',
);

function ImagePlugin(): null {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        const removeInsertImageCommand = editor.registerCommand(
            INSERT_IMAGE_COMMAND,
            (payload: ImagePayload) => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    const imageNode = $createImageNode(payload);
                    $insertNodes([imageNode]);
                }
                return true;
            },
            COMMAND_PRIORITY_LOW,
        );

        // 暂时禁用自动图片转换，避免问题
        // TODO: 重新实现更稳定的图片Markdown转换

        return () => {
            removeInsertImageCommand();
        };
    }, [editor]);

    return null;
}

export default ImagePlugin;
