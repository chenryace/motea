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
        updated_at, // 添加真实的更新时间
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

        // 🔧 修复标题乱码：正确处理metadata更新
        // 1. 解压缩旧的metadata
        const oldMetaJson = metaToJson(oldMeta);

        // 2. 合并新的metadata（包括可能的标题更新）
        const updatedMetaJson = {
            ...oldMetaJson,
            ...req.body, // 🔧 关键修复：合并请求中的新metadata（如标题）
            date: new Date().toISOString(),
        };

        // 移除content字段，因为它不属于metadata
        delete updatedMetaJson.content;

        // 3. 重新压缩
        const metaData = jsonToMeta(updatedMetaJson);

        // 确保metadata中包含ID（用于PostgreSQL存储）
        const metaWithId = {
            ...metaData,
            id: id, // 添加ID到metadata中
        };

        console.log('🔧 Notes API updating content for note with title:', updatedMetaJson.title);

        // Empty content may be a misoperation
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

        // 🔧 修复：返回正确解压缩的数据
        const updatedNote = {
            id,
            content,
            ...updatedMetaJson,
            updated_at: new Date().toISOString(),
        };

        console.log('🔧 Notes API returning updated note with title:', updatedNote.title);
        res.json(updatedNote);
    });
