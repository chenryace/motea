import { api } from 'libs/server/connect';
import { useAuth } from 'libs/server/middlewares/auth';
import { useStore } from 'libs/server/middlewares/store';
import { readRateLimit } from 'libs/server/middlewares/rate-limit';
import TreeActions, { TreeModel, ROOT_ID } from 'libs/shared/tree';
import { StoreProvider } from 'libs/server/store';
import { getPathNoteById } from 'libs/server/note-path';
import { metaToJson } from 'libs/server/meta';

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
        )
    ]);
}

async function enrichTreeWithMetadata(tree: TreeModel, store: StoreProvider): Promise<TreeModel> {
    const enrichedTree = { ...tree };

    const noteIds = Object.keys(tree.items).filter(id => id !== ROOT_ID);
    console.log(`📊 Enriching ${noteIds.length} notes with metadata...`);

    const startTime = performance.now();

    try {
        // 🚀 使用批量查询优化 - 解决 N+1 查询问题
        const notePaths = noteIds.map(noteId => getPathNoteById(noteId));
        const batchResults = await store.batchGetObjectAndMeta(notePaths);

        // 📝 处理批量查询结果
        const processedResults = noteIds.map((noteId, index) => {
            const result = batchResults[index];
            if (result?.meta) {
                const jsonMeta = metaToJson(result.meta);

                let safeTitle = '';
                try {
                    safeTitle = jsonMeta.title || '';
                    if (safeTitle.includes('<') && safeTitle.includes('>')) {
                        console.warn(`⚠️ Detected HTML in title for note ${noteId}, using fallback`);
                        safeTitle = '';
                    }
                } catch (error) {
                    console.warn(`⚠️ Failed to process title for note ${noteId}:`, error);
                    safeTitle = '';
                }

                return {
                    id: noteId,
                    metadata: {
                        title: safeTitle,
                        updated_at: result.updated_at || jsonMeta.date || new Date().toISOString(),
                        deleted: jsonMeta.deleted,
                        pinned: jsonMeta.pinned,
                        shared: jsonMeta.shared,
                        pid: jsonMeta.pid,
                    }
                };
            }
            return null;
        });

        // 📝 更新树结构中的元数据
        processedResults.forEach(result => {
            if (result && enrichedTree.items[result.id]) {
                enrichedTree.items[result.id].data = result.metadata as any;
            }
        });

        const endTime = performance.now();
        const duration = (endTime - startTime) / 1000;
        console.log(`✅ Batch metadata enrichment completed in ${duration.toFixed(2)}s (${noteIds.length} notes)`);

    } catch (error) {
        console.warn('⚠️ Batch metadata enrichment failed, falling back to individual queries:', error);

        // 🛡️ 降级到原有的并发查询方式
        const metadataPromises = noteIds.map(async (noteId) => {
            try {
                const { meta, updated_at } = await store.getObjectAndMeta(getPathNoteById(noteId));
                if (meta) {
                    const jsonMeta = metaToJson(meta);

                    let safeTitle = '';
                    try {
                        safeTitle = jsonMeta.title || '';
                        if (safeTitle.includes('<') && safeTitle.includes('>')) {
                            console.warn(`⚠️ Detected HTML in title for note ${noteId}, using fallback`);
                            safeTitle = '';
                        }
                    } catch (error) {
                        console.warn(`⚠️ Failed to process title for note ${noteId}:`, error);
                        safeTitle = '';
                    }

                    return {
                        id: noteId,
                        metadata: {
                            title: safeTitle,
                            updated_at: updated_at || jsonMeta.date || new Date().toISOString(),
                            deleted: jsonMeta.deleted,
                            pinned: jsonMeta.pinned,
                            shared: jsonMeta.shared,
                            pid: jsonMeta.pid,
                        }
                    };
                }
                return null;
            } catch (error) {
                console.warn(`⚠️ Failed to get metadata for note ${noteId}:`, error);
                return null;
            }
        });

        const metadataResults = await Promise.all(metadataPromises);

        metadataResults.forEach(result => {
            if (result && enrichedTree.items[result.id]) {
                enrichedTree.items[result.id].data = result.metadata as any;
            }
        });

        const endTime = performance.now();
        const duration = (endTime - startTime) / 1000;
        console.log(`✅ Fallback metadata enrichment completed in ${duration.toFixed(2)}s`);
    }

    return enrichedTree;
}

export default api()
    .use(readRateLimit)
    .use(useAuth)
    .use(useStore)
    .get(async (req, res) => {
        try {
            console.log('Getting tree data...');

            const tree = await withTimeout(
                req.state.treeStore.get(),
                8000
            );

            console.log('Tree data retrieved, enriching with note metadata...');

            const enrichedTree = await enrichTreeWithMetadata(tree, req.state.store);

            console.log('Tree data enriched, cleaning...');
            const cleanedTree = TreeActions.cleanTreeModel(enrichedTree);

            const style = req.query['style'];
            switch (style) {
                case 'hierarchy':
                    res.json(TreeActions.makeHierarchy(cleanedTree));
                    break;
                case 'list':
                default:
                    res.json(cleanedTree);
                    break;
            }
        } catch (error) {
            console.error('Error in GET /api/tree:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to get tree',
                timestamp: new Date().toISOString()
            });
        }
    })
    .post(async (req, res) => {
        try {
            const { action, data } = req.body as {
                action: 'move' | 'mutate';
                data: any;
            };

            console.log('Tree action:', action, 'data:', data);

            switch (action) {
                case 'move':
                    await withTimeout(
                        req.state.treeStore.moveItem(data.source, data.destination),
                        8000
                    );
                    break;

                case 'mutate':
                    await withTimeout(
                        req.state.treeStore.mutateItem(data.id, data),
                        8000
                    );
                    break;

                default:
                    return res.APIError.NOT_SUPPORTED.throw('action not found');
            }

            res.status(204).end();
        } catch (error) {
            console.error('Error in POST /api/tree:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to update tree',
                timestamp: new Date().toISOString()
            });
        }
    });
