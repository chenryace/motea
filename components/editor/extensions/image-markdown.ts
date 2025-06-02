import Image from '@tiptap/extension-image';
import { nodeInputRule, inputRule } from '@tiptap/core';

// 扩展图片节点以支持 Markdown 语法
export const ImageMarkdown = Image.extend({
    addInputRules() {
        return [
            // 使用更宽松的正则表达式，匹配完整的图片语法
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
            // 也尝试匹配回车的情况
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
                // 插入图片后，确保光标在图片下方
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
            // 添加空格键处理
            'Space': () => {
                const { state, dispatch } = this.editor.view;
                const { selection } = state;
                const { $from } = selection;

                // 获取当前行的文本
                const textBefore = $from.nodeBefore?.textContent || '';
                const currentNode = $from.parent;
                const textContent = currentNode.textContent || '';

                console.log('Space pressed, checking for image markdown:', { textBefore, textContent });

                // 检查是否匹配图片 markdown 语法
                const imageMatch = textContent.match(/!\[([^\]]*)\]\(([^)]+)\)$/);
                if (imageMatch) {
                    const [fullMatch, alt, src] = imageMatch;
                    console.log('Found image markdown on space:', { fullMatch, alt, src });

                    // 手动插入图片
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
