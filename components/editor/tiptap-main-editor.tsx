/**
 * Tiptap Main Editor Component
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

import EditTitle from './edit-title';
import TiptapEditor, { TiptapEditorProps } from './tiptap-editor';
import Backlinks from './backlinks';
import UIState from 'libs/web/state/ui';
import { FC } from 'react';
import { NoteModel } from 'libs/shared/note';
import { EDITOR_SIZE } from 'libs/shared/meta';
import TiptapEditorState from 'libs/web/state/tiptap-editor';

const TiptapMainEditor: FC<
    TiptapEditorProps & {
        note?: NoteModel;
        isPreview?: boolean;
        className?: string;
    }
> = ({ className, note, isPreview, ...props }) => {
    const {
        settings: { settings },
    } = UIState.useContainer();

    const {
        onSearchLink,
        onCreateLink,
        onClickLink,
        onHoverLink,
        onEditorChange,
        editorEl,
        note: editorNote,
    } = TiptapEditorState.useContainer();

    const currentEditorSize = note?.editorsize ?? settings.editorsize;

    let editorWidthClass: string;
    switch (currentEditorSize) {
        case EDITOR_SIZE.SMALL:
            editorWidthClass = 'max-w-400';
            break;
        case EDITOR_SIZE.LARGE:
            editorWidthClass = 'max-w-4xl';
            break;
        case EDITOR_SIZE.FULL:
            editorWidthClass = 'max-w-full mx-4';
            break;
        default:
            editorWidthClass = 'max-w-400';
            break;
    }

    const articleClassName =
        className || `pt-16 md:pt-40 px-6 m-auto h-full ${editorWidthClass}`;

    return (
        <article className={articleClassName}>
            <EditTitle readOnly={props.readOnly} />
            <TiptapEditor
                ref={editorEl}
                value={editorNote?.content}
                onChange={onEditorChange}
                onCreateLink={onCreateLink}
                onSearchLink={onSearchLink}
                onClickLink={onClickLink}
                onHoverLink={onHoverLink}
                isPreview={isPreview}
                className="px-4 md:px-0"
                {...props}
            />
            {!isPreview && <Backlinks />}
        </article>
    );
};

export default TiptapMainEditor;
