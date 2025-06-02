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

        // 🔧 修复标题乱码：正确处理metadata合并
        // 1. 先解压缩旧的metadata得到原始数据
        const oldMetaJson = metaToJson(oldMeta);

        // 2. 合并原始数据（未压缩的）
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

        // 3. 重新压缩整个合并后的数据
        const meta = jsonToMeta(mergedMetaJson);

        // 处理删除情况
        const { deleted } = req.body;
        if (
            oldMetaJson.deleted !== deleted &&
            deleted === NOTE_DELETED.DELETED
        ) {
            await req.state.treeStore.removeItem(id);
        }

        // 获取现有内容
        const existingContent = await req.state.store.getObject(notePath);

        // 确保metadata中包含ID（用于PostgreSQL存储）
        const metaWithId = {
            ...meta,
            id: id, // 添加ID到metadata中
        };

        // 使用 putObject 来正确更新 PostgreSQL 中的 metadata
        await req.state.store.putObject(notePath, existingContent || '\n', {
            meta: metaWithId,
            contentType: 'text/markdown',
        });

        // 🔧 修复：返回正确解压缩的数据
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
