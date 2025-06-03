import { cloneDeep, forEach, isEmpty, map, reduce } from 'lodash';
import { genId } from 'libs/shared/id';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createContainer } from 'unstated-next';
import TreeActions, {
    DEFAULT_TREE,
    MovePosition,
    ROOT_ID,
    TreeItemModel,
    TreeModel,
} from 'libs/shared/tree';
import useNoteAPI from '../api/note';
import noteCache from '../cache/note';
import useTreeAPI from '../api/tree';
import { NOTE_DELETED, NOTE_PINNED } from 'libs/shared/meta';
import { NoteModel } from 'libs/shared/note';
import { useToast } from '../hooks/use-toast';
import { uiCache } from '../cache';

const TREE_CACHE_KEY = 'tree';

const findParentTreeItems = (tree: TreeModel, note: NoteModel) => {
    const parents = [] as TreeItemModel[];

    let tempNote = note;
    while (tempNote.pid && tempNote.pid !== ROOT_ID) {
        const curData = tree.items[tempNote.pid];
        if (curData?.data) {
            tempNote = curData.data;
            parents.push(curData);
        } else {
            break;
        }
    }

    return parents;
};

const useNoteTree = (initData: TreeModel = DEFAULT_TREE) => {
    const { mutate, loading, fetch: fetchTree } = useTreeAPI();
    const [tree, setTree] = useState<TreeModel>(initData);
    const [initLoaded, setInitLoaded] = useState<boolean>(false);
    const { fetch: fetchNote } = useNoteAPI();
    const treeRef = useRef(tree);
    const toast = useToast();

    useEffect(() => {
        treeRef.current = tree;
    }, [tree]);

    const fetchNotes = useCallback(
        async (tree: TreeModel) => {
            const preloadCount = parseInt(process.env.PRELOAD_NOTES_COUNT || '10', 10);
            console.log(`⚙️ 预加载配置: ${preloadCount} 个笔记`);

            const allNotes = Object.values(tree.items)
                .filter(item => item.id !== ROOT_ID && item.data)
                .sort((a, b) => {
                    const timeA = a.data?.updated_at ? new Date(a.data.updated_at).getTime() : 0;
                    const timeB = b.data?.updated_at ? new Date(b.data.updated_at).getTime() : 0;
                    return timeB - timeA;
                });

            const priorityNotes = allNotes.slice(0, preloadCount);
            const otherNotes = allNotes.slice(preloadCount);

            console.log(`📊 Total notes: ${allNotes.length}, Priority: ${priorityNotes.length}, Others: ${otherNotes.length}`);

            const priorityNotesToLoad: string[] = [];

            for (const item of priorityNotes) {
                const cache = await noteCache.getItem(item.id);

                if (cache && item.data?.updated_at && cache.updated_at === item.data.updated_at) {
                    tree.items[item.id].data = {
                        ...item.data,
                        ...cache,
                    };
                    console.log(`✅ Cache hit for priority note: ${item.id}`);
                } else {
                    if (cache) {
                        console.log(`🗑️ Clearing stale cache for note: ${item.id} (meta_time: ${item.data?.updated_at}, cache_time: ${cache?.updated_at})`);
                        await noteCache.removeItem(item.id);
                    }

                    priorityNotesToLoad.push(item.id);
                    console.log(`📡 Will fetch priority note: ${item.id} (cache: ${!!cache}, meta_time: ${item.data?.updated_at}, cache_time: ${cache?.updated_at})`);
                }
            }

            for (const item of otherNotes) {
                const cache = await noteCache.getItem(item.id);

                if (cache && item.data?.updated_at && cache.updated_at === item.data.updated_at) {
                    tree.items[item.id].data = {
                        ...item.data, 
                        ...cache,
                    };
                    console.log(`✅ Cache hit for other note: ${item.id}`);
                } else {
                    if (cache) {
                        console.log(`🗑️ Clearing stale cache for other note: ${item.id} (meta_time: ${item.data?.updated_at}, cache_time: ${cache?.updated_at})`);
                        await noteCache.removeItem(item.id);
                    }

                    console.log(`⏳ Cache miss for other note: ${item.id}, will load on demand (has metadata: ${!!item.data})`);
                }
            }

            if (priorityNotesToLoad.length > 0) {
                console.log(`🚀 Loading ${priorityNotesToLoad.length} priority notes from API`);

                await Promise.all(
                    priorityNotesToLoad.map(async (id) => {
                        try {
                            const noteData = await fetchNote(id);
                            tree.items[id].data = {
                                ...tree.items[id].data, 
                                ...noteData,
                                id,
                            } as NoteModel;
                            console.log(`✅ Loaded priority note: ${id}`);
                        } catch (error) {
                            console.error(`❌ Failed to load priority note ${id}:`, error);
                        }
                    })
                );
            }

            console.log(`🎯 Optimization complete: ${priorityNotesToLoad.length} API requests instead of ${allNotes.length}`);
            return tree;
        },
        [fetchNote]
    );

    const initTree = useCallback(async () => {
        console.log('🚀 Starting tree initialization...');
        const startTime = performance.now();

        const cache = await uiCache.getItem<TreeModel>(TREE_CACHE_KEY);
        if (cache) {
            console.log('📦 Loading from cache first...');
            const treeWithNotes = await fetchNotes(cache);
            setTree(treeWithNotes);
        }

        console.log('🌐 Fetching latest tree from server...');
        const tree = await fetchTree();

        if (!tree) {
            toast('Failed to load tree', 'error');
            return;
        }

        console.log('📊 Processing tree with optimized loading...');
        const treeWithNotes = await fetchNotes(tree);

        setTree(treeWithNotes);
        await Promise.all([
            uiCache.setItem(TREE_CACHE_KEY, tree),
            noteCache.checkItems(tree.items),
        ]);

        const endTime = performance.now();
        const totalTime = (endTime - startTime) / 1000;
        console.log(`✅ Tree initialization complete in ${totalTime.toFixed(2)}s`);

        setInitLoaded(true);
    }, [fetchNotes, fetchTree, toast]);

    const loadNoteOnDemand = useCallback(async (noteId: string) => {
        const currentItem = treeRef.current.items[noteId];
        if (!currentItem) {
            console.error(`❌ Note ${noteId} not found in tree`);
            return null;
        }

        const cache = await noteCache.getItem(noteId);
        const serverMeta = currentItem.data;

        if (cache && serverMeta?.updated_at && cache.updated_at !== serverMeta.updated_at) {
            console.log(`🗑️ Clearing stale cache for on-demand note: ${noteId} (meta_time: ${serverMeta.updated_at}, cache_time: ${cache.updated_at})`);
            await noteCache.removeItem(noteId);
        }

        if (currentItem.data && currentItem.data.content !== undefined &&
            cache && serverMeta?.updated_at && cache.updated_at === serverMeta.updated_at) {
            console.log(`✅ Note ${noteId} already loaded`);
            return currentItem.data;
        }

        try {
            console.log(`🔄 Loading note ${noteId} on demand...`);
            const noteData = await fetchNote(noteId);

            const updatedTree = TreeActions.mutateItem(treeRef.current, noteId, {
                data: noteData
            });
            setTree(updatedTree);

            console.log(`✅ Successfully loaded note ${noteId} on demand`);
            return noteData;
        } catch (error) {
            console.error(`❌ Failed to load note ${noteId} on demand:`, error);
            toast('Failed to load note', 'error');
            return null;
        }
    }, [fetchNote, toast]);

    const addItem = useCallback((item: NoteModel) => {
        const tree = TreeActions.addItem(treeRef.current, item.id, item.pid);

        tree.items[item.id].data = item;
        setTree(tree);
    }, []);

    const removeItem = useCallback(async (id: string) => {
        const tree = TreeActions.removeItem(treeRef.current, id);

        setTree(tree);
        await Promise.all(
            map(
                TreeActions.flattenTree(tree, id),
                async (item) =>
                    await noteCache.mutateItem(item.id, {
                        deleted: NOTE_DELETED.DELETED,
                    })
            )
        );
    }, []);

    const genNewId = useCallback(() => {
        let newId = genId();
        while (treeRef.current.items[newId]) {
            newId = genId();
        }
        return newId;
    }, []);

    const moveItem = useCallback(
        async (data: { source: MovePosition; destination: MovePosition }) => {
            setTree(
                TreeActions.moveItem(
                    treeRef.current,
                    data.source,
                    data.destination
                )
            );
            await mutate({
                action: 'move',
                data,
            });
        },
        [mutate]
    );

    const mutateItem = useCallback(
        async (id: string, data: Partial<TreeItemModel>) => {
            setTree(TreeActions.mutateItem(treeRef.current, id, data));
            delete data.data;
            if (!isEmpty(data)) {
                await mutate({
                    action: 'mutate',
                    data: {
                        ...data,
                        id,
                    },
                });
            }
        },
        [mutate]
    );

    const restoreItem = useCallback(async (id: string, pid: string) => {
        const tree = TreeActions.restoreItem(treeRef.current, id, pid);

        setTree(tree);
        await Promise.all(
            map(
                TreeActions.flattenTree(tree, id),
                async (item) =>
                    await noteCache.mutateItem(item.id, {
                        deleted: NOTE_DELETED.NORMAL,
                    })
            )
        );
    }, []);

    const deleteItem = useCallback(async (id: string) => {
        setTree(TreeActions.deleteItem(treeRef.current, id));
    }, []);

    const getPaths = useCallback((note: NoteModel) => {
        const tree = treeRef.current;
        return findParentTreeItems(tree, note).map(
            (listItem) => listItem.data!
        );
    }, []);

    const setItemsExpandState = useCallback(
        async (items: TreeItemModel[], newValue: boolean) => {
            const newTree = reduce(
                items,
                (tempTree, item) =>
                    TreeActions.mutateItem(tempTree, item.id, {
                        isExpanded: newValue,
                    }),
                treeRef.current
            );
            setTree(newTree);

            for (const item of items) {
                await mutate({
                    action: 'mutate',
                    data: {
                        isExpanded: newValue,
                        id: item.id,
                    },
                });
            }
        },
        [mutate]
    );

    const showItem = useCallback(
        (note: NoteModel) => {
            const parents = findParentTreeItems(treeRef.current, note);
            setItemsExpandState(parents, true)
                ?.catch((v) => console.error('Error whilst expanding item: %O', v));
        },
        [setItemsExpandState]
    );

    const checkItemIsShown = useCallback((note: NoteModel) => {
        const parents = findParentTreeItems(treeRef.current, note);
        return reduce(
            parents,
            (value, item) => value && !!item.isExpanded,
            true
        );
    }, []);

    const collapseAllItems = useCallback(() => {
        const expandedItems = TreeActions.flattenTree(treeRef.current).filter(
            (item) => item.isExpanded
        );
        setItemsExpandState(expandedItems, false)
            .catch((v) => console.error('Error whilst collapsing item: %O', v));
    }, [setItemsExpandState]);

    const pinnedTree = useMemo(() => {
        const items = cloneDeep(tree.items);
        const pinnedIds: string[] = [];
        forEach(items, (item) => {
            if (
                item.data?.pinned === NOTE_PINNED.PINNED &&
                item.data.deleted !== NOTE_DELETED.DELETED
            ) {
                pinnedIds.push(item.id);
            }
        });

        items[ROOT_ID] = {
            id: ROOT_ID,
            children: pinnedIds,
            isExpanded: true,
            hasChildren: pinnedIds.length > 0,
        };

        return {
            ...tree,
            items,
        };
    }, [tree]);

    return {
        tree,
        pinnedTree,
        initTree,
        genNewId,
        addItem,
        removeItem,
        moveItem,
        mutateItem,
        restoreItem,
        deleteItem,
        getPaths,
        showItem,
        checkItemIsShown,
        collapseAllItems,
        loadNoteOnDemand,
        loading,
        initLoaded,
    };
};

const NoteTreeState = createContainer(useNoteTree);

export default NoteTreeState;
