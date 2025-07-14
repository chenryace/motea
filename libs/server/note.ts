import { NoteModel } from 'libs/shared/note';
import { genId } from 'libs/shared/id';
import { jsonToMeta } from 'libs/server/meta';
import { getPathNoteById } from 'libs/server/note-path';
import { ServerState } from './connect';

export const createNote = async (note: NoteModel, state: ServerState) => {
    const { content = '\n', ...meta } = note;

    let noteId = note.id;
    if (!noteId) {
        noteId = genId();
    }

    while (await state.store.hasObject(getPathNoteById(noteId))) {
        noteId = genId();
    }

    const currentTime = new Date().toISOString();
    const metaWithModel = {
        ...meta,
        id: noteId, 
        date: note.date ?? currentTime,
        updated_at: currentTime, 
    };
    const metaData = jsonToMeta(metaWithModel);

    // 检测内容格式并设置相应的 content type
    const isJSON = content.trim().startsWith('{') && content.trim().endsWith('}');
    const contentType = isJSON ? 'application/json' : 'text/markdown';

    await state.store.putObject(getPathNoteById(noteId), content, {
        contentType,
        meta: metaData,
    });


    const completeNote = {
        ...metaWithModel,
        content, 
    };

    return completeNote as NoteModel;
};
