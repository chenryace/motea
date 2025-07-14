/**
 * Table Plugin for Lexical
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

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { TablePlugin as LexicalTablePlugin } from '@lexical/react/LexicalTablePlugin';
import { useEffect } from 'react';
import {
    COMMAND_PRIORITY_EDITOR,
    createCommand,
    LexicalCommand,
    $getSelection,
    $isRangeSelection,
} from 'lexical';
import { $createTableNodeWithDimensions, INSERT_TABLE_COMMAND } from '@lexical/table';
import { $insertNodeToNearestRoot } from '@lexical/utils';

// 创建自定义的插入表格命令
export const INSERT_CUSTOM_TABLE_COMMAND: LexicalCommand<{rows: number, columns: number}> = createCommand(
    'INSERT_CUSTOM_TABLE_COMMAND'
);

export default function TablePlugin(): JSX.Element {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        return editor.registerCommand(
            INSERT_CUSTOM_TABLE_COMMAND,
            ({ rows, columns }) => {
                editor.update(() => {
                    const selection = $getSelection();
                    if (!$isRangeSelection(selection)) {
                        return;
                    }

                    const tableNode = $createTableNodeWithDimensions(rows, columns, true);
                    $insertNodeToNearestRoot(tableNode);
                });
                return true;
            },
            COMMAND_PRIORITY_EDITOR
        );
    }, [editor]);

    return <LexicalTablePlugin hasCellMerge={true} hasCellBackgroundColor={false} />;
}
