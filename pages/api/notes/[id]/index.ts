import { api } from 'libs/server/connect';
import { metaToJson, jsonToMeta } from 'libs/server/meta';
import { useAuth } from 'libs/server/middlewares/auth';
import { useStore } from 'libs/server/middlewares/store';
import { getPathNoteById } from 'libs/server/note-path';
import { NoteModel } from 'libs/shared/note';
import { StoreProvider } from 'libs/server/store';
import { API } from 'libs/server/middlewares/error';
import { strCompress, strDecompress } from 'libs/shared/str';
import { ROOT_ID } from 'libs/shared/tree';

export async function getNote(
    store: StoreProvider,
    id: string
): Promise<NoteModel> {
    const { content, meta, updated_at } = await store.getObjectAndMeta(getPathNoteById(id));

    if (!content && !meta) {
        throw API.NOT_FOUND.throw();
    }

    const jsonMeta = metaToJson(meta);

    return {
        id,
        content: content || '\n',
        ...jsonMeta,
        updated_at, 
    } as NoteModel;
}

export default api()
    .use(useAuth)
    .use(useStore)
    .delete(async (req, res) => {
        const id = req.query.id as string;
        const notePath = getPathNoteById(id);

        await Promise.all([
            req.state.store.deleteObject(notePath),
            req.state.treeStore.removeItem(id),
        ]);

        res.end();
    })
    .get(async (req, res) => {
        const id = req.query.id as string;

        if (id === ROOT_ID) {
            return res.json({
                id,
            });
        }

        const note = await getNote(req.state.store, id);

        res.json(note);
    })
    .post(async (req, res) => {
        const id = req.query.id as string;
        const { content } = req.body;
        const notePath = getPathNoteById(id);
        const oldMeta = await req.state.store.getObjectMeta(notePath);

        const oldMetaJson = metaToJson(oldMeta);

        const updatedMetaJson = {
            ...oldMetaJson,
            ...req.body, 
            date: new Date().toISOString(),
        };

        delete updatedMetaJson.content;

        const metaData = jsonToMeta(updatedMetaJson);

        const metaWithId = {
            ...metaData,
            id: id, 
        };

        console.log('🔧 Notes API updating content for note with title:', updatedMetaJson.title);

        if (!content || content.trim() === '\\') {
            await req.state.store.copyObject(notePath, notePath + '.bak', {
                meta: metaWithId,
                contentType: 'text/markdown',
            });
        }

        await req.state.store.putObject(notePath, content, {
            contentType: 'text/markdown',
            meta: metaWithId,
        });

        const updatedNote = {
            id,
            content,
            ...updatedMetaJson,
            updated_at: new Date().toISOString(),
        };

        console.log('🔧 Notes API returning updated note with title:', updatedNote.title);
        res.json(updatedNote);
    });
