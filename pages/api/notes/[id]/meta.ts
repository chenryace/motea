import { api } from 'libs/server/connect';
import { jsonToMeta, metaToJson } from 'libs/server/meta';
import { useAuth } from 'libs/server/middlewares/auth';
import { useStore } from 'libs/server/middlewares/store';
import { getPathNoteById } from 'libs/server/note-path';
import { NOTE_DELETED } from 'libs/shared/meta';

export default api()
    .use(useAuth)
    .use(useStore)
    .post(async (req, res) => {
        const id = req.body.id || req.query.id;
        const notePath = getPathNoteById(id);
        const oldMeta = await req.state.store.getObjectMeta(notePath);


        const oldMetaJson = metaToJson(oldMeta);

        const mergedMetaJson = {
            ...oldMetaJson,
            ...req.body,
            date: new Date().toISOString(),
        };

        console.log('🔧 Meta API merging data:', {
            oldTitle: oldMetaJson.title,
            newTitle: req.body.title,
            mergedTitle: mergedMetaJson.title
        });

        const meta = jsonToMeta(mergedMetaJson);

        const { deleted } = req.body;
        if (
            oldMetaJson.deleted !== deleted &&
            deleted === NOTE_DELETED.DELETED
        ) {
            await req.state.treeStore.removeItem(id);
        }

        const existingContent = await req.state.store.getObject(notePath);

        const metaWithId = {
            ...meta,
            id: id, 
        };

        await req.state.store.putObject(notePath, existingContent || '\n', {
            meta: metaWithId,
            contentType: 'text/markdown',
        });

        const updatedNote = {
            id,
            content: existingContent || '\n',
            ...mergedMetaJson,
            updated_at: new Date().toISOString(),
        };

        console.log('🔧 Meta API returning updated note with title:', updatedNote.title);
        res.json(updatedNote);
    })
    .get(async (req, res) => {
        const id = req.body.id || req.query.id;
        const notePath = getPathNoteById(id);
        const meta = await req.state.store.getObjectMeta(notePath);

        res.json(metaToJson(meta));
    });
