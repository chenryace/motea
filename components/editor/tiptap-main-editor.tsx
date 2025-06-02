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

    // 获取当前编辑器宽度设置
    const currentEditorSize = note?.editorsize ?? settings.editorsize;

    let editorWidthClass: string;
    switch (currentEditorSize) {
        case EDITOR_SIZE.SMALL:
            editorWidthClass = 'max-w-prose'; // ~65ch, 约 520px
            break;
        case EDITOR_SIZE.LARGE:
            editorWidthClass = 'max-w-4xl'; // 896px
            break;
        case EDITOR_SIZE.AS_WIDE_AS_POSSIBLE:
            editorWidthClass = 'max-w-full mx-4'; // 全宽，左右留边距
            break;
        default:
            editorWidthClass = 'max-w-prose';
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
