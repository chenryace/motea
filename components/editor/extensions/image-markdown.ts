/**
 * Image Markdown Extension for Tiptap Editor
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

import Image from '@tiptap/extension-image';
import { nodeInputRule, inputRule } from '@tiptap/core';

export const ImageMarkdown = Image.extend({
    priority: 900, // 低于 markdown 扩展 (1000)，避免输入规则冲突

    addInputRules() {
        return [
            nodeInputRule({
                find: /!\[([^\]]*)\]\(([^)]+)\)\s$/,
                type: this.type,
                getAttributes: (match) => {
                    const [fullMatch, alt, src] = match;
                    console.log('Image markdown matched:', { fullMatch, alt, src, match });
                    return {
                        src: src?.trim() || '',
                        alt: alt || '',
                        title: alt || '',
                    };
                },
            }),
            nodeInputRule({
                find: /!\[([^\]]*)\]\(([^)]+)\)$/,
                type: this.type,
                getAttributes: (match) => {
                    const [fullMatch, alt, src] = match;
                    console.log('Image markdown matched (enter):', { fullMatch, alt, src, match });
                    return {
                        src: src?.trim() || '',
                        alt: alt || '',
                        title: alt || '',
                    };
                },
            }),
        ];
    },

    addCommands() {
        return {
            ...this.parent?.(),
            setImage: (options) => ({ commands, chain }) => {
                return chain()
                    .insertContent({
                        type: this.name,
                        attrs: options,
                    })
                    .insertContent({ type: 'paragraph' })
                    .run();
            },
        };
    },

    addKeyboardShortcuts() {
        return {
            'Space': () => {
                const { state, dispatch } = this.editor.view;
                const { selection } = state;
                const { $from } = selection;

                const textBefore = $from.nodeBefore?.textContent || '';
                const currentNode = $from.parent;
                const textContent = currentNode.textContent || '';

                console.log('Space pressed, checking for image markdown:', { textBefore, textContent });

                const imageMatch = textContent.match(/!\[([^\]]*)\]\(([^)]+)\)$/);
                if (imageMatch) {
                    const [fullMatch, alt, src] = imageMatch;
                    console.log('Found image markdown on space:', { fullMatch, alt, src });

                    const tr = state.tr;
                    const start = $from.pos - fullMatch.length;
                    const end = $from.pos;

                    tr.replaceWith(start, end, this.type.create({
                        src: src?.trim() || '',
                        alt: alt || '',
                        title: alt || '',
                    }));

                    if (dispatch) {
                        dispatch(tr);
                        return true;
                    }
                }

                return false;
            },
        };
    },
});

export default ImageMarkdown;
