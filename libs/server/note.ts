import { NoteModel } from 'libs/shared/note';
import { genId } from 'libs/shared/id';
import { jsonToMeta } from 'libs/server/meta';
import { getPathNoteById } from 'libs/server/note-path';
import { ServerState } from './connect';

export const createNote = async (note: NoteModel, state: ServerState) => {
    const { content = '\n', ...meta } = note;

    // 如果前端没有提供ID，生成一个新的
    let noteId = note.id;
    if (!noteId) {
        noteId = genId();
    }

    // 检查ID冲突，如果冲突则生成新ID
    while (await state.store.hasObject(getPathNoteById(noteId))) {
        noteId = genId();
    }

    const currentTime = new Date().toISOString();
    const metaWithModel = {
        ...meta,
        id: noteId, // 使用确定的ID
        date: note.date ?? currentTime,
        updated_at: currentTime, // ✅ 确保包含 updated_at 字段
    };
    const metaData = jsonToMeta(metaWithModel);

    await state.store.putObject(getPathNoteById(noteId), content, {
        contentType: 'text/markdown',
        meta: metaData,
    });

    // ✅ 返回包含完整字段的笔记数据
    const completeNote = {
        ...metaWithModel,
        content, // 确保包含内容
    };

    return completeNote as NoteModel;
};
