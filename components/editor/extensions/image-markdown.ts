import Image from '@tiptap/extension-image';
import { nodeInputRule, inputRule } from '@tiptap/core';

export const ImageMarkdown = Image.extend({
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
