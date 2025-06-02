import NoteState from 'libs/web/state/note';
import { useRouter } from 'next/router';
import {
    useCallback,
    MouseEvent as ReactMouseEvent,
    useState,
    useRef,
} from 'react';
import { searchNote, searchRangeText } from 'libs/web/utils/search';
// import { NOTE_DELETED } from 'libs/shared/meta';
import { isNoteLink, NoteModel } from 'libs/shared/note';
import { useToast } from 'libs/web/hooks/use-toast';
import PortalState from 'libs/web/state/portal';
import { NoteCacheItem } from 'libs/web/cache';
import noteCache from 'libs/web/cache/note';
import { createContainer } from 'unstated-next';
import { TiptapEditorRef } from 'components/editor/tiptap-editor';
import UIState from 'libs/web/state/ui';
import { has } from 'lodash';
// import { ROOT_ID } from 'libs/shared/const';
const ROOT_ID = 'root';

const useTiptapEditor = (initNote?: NoteModel) => {
    // Use initNote if provided, otherwise try to get from NoteState
    let note = initNote;
    let createNoteWithTitle: any, updateNote: any, createNote: any;

    try {
        const noteState = NoteState.useContainer();
        createNoteWithTitle = noteState.createNoteWithTitle;
        updateNote = noteState.updateNote;
        createNote = noteState.createNote;

        // Only use noteState.note if no initNote is provided
        if (!note) {
            note = noteState.note;
        }
    } catch (error) {
        // If NoteState is not available, we'll work with just the initNote
        console.warn('NoteState not available in TiptapEditorState, using initNote only');
        createNoteWithTitle = async () => undefined;
        updateNote = async () => undefined;
        createNote = async () => undefined;
    }
    // const {
    //     ua: { isBrowser },
    // } = UIState.useContainer();
    const router = useRouter();
    const toast = useToast();
    const editorEl = useRef<TiptapEditorRef>(null);

    // Manual save function for IndexedDB
    const saveToIndexedDB = useCallback(
        async (data: Partial<NoteModel>) => {
            if (!note?.id) return;

            const updatedNote = { ...note, ...data };
            await noteCache.setItem(note.id, updatedNote);
        },
        [note]
    );

    // Manual sync to server (借鉴旧项目的核心逻辑)
    const syncToServer = useCallback(
        async () => {
            if (!note?.id) return false;

            const isNew = has(router.query, 'new');

            try {
                // 借鉴旧项目：优先使用IndexedDB中的最新数据
                const localNote = await noteCache.getItem(note.id);
                const noteToSave = localNote || note;

                if (isNew) {
                    // 借鉴旧项目：创建新笔记时包含完整数据
                    const noteData = {
                        ...noteToSave,
                        pid: (router.query.pid as string) || ROOT_ID
                    };

                    const item = await createNote(noteData);

                    if (item) {
                        // 借鉴旧项目：成功后移除?new参数
                        const noteUrl = `/${item.id}`;
                        if (router.asPath !== noteUrl) {
                            await router.replace(noteUrl, undefined, { shallow: true });
                        }
                        toast('Note saved to server', 'success');
                        return true;
                    }
                } else {
                    // 借鉴旧项目：更新现有笔记
                    const updatedNote = await updateNote(noteToSave);

                    if (updatedNote) {
                        // 借鉴旧项目：用服务器响应更新本地缓存
                        await noteCache.setItem(updatedNote.id, updatedNote);
                        toast('Note updated on server', 'success');
                        return true;
                    }
                }
            } catch (error) {
                console.error('Sync to server failed:', error);
                toast('Failed to save note to server', 'error');
                return false;
            }

            return false;
        },
        [note, router, createNote, updateNote, toast]
    );

    const onCreateLink = useCallback(
        async (title: string) => {
            if (!createNoteWithTitle) return '';

            const result = await createNoteWithTitle(title);
            if (result?.id) {
                return `/${result.id}`;
            }
            return '';
        },
        [createNoteWithTitle]
    );

    const onSearchLink = useCallback(
        async (term: string) => {
            // 简化搜索功能，暂时返回空数组
            // const searchResults = await searchNote(term, NOTE_DELETED.NORMAL);
            // return searchResults.map((item) => ({
            //     title: item.title,
            //     url: `/${item.id}`,
            //     subtitle: searchRangeText(item.content),
            // }));
            return [];
        },
        []
    );

    const onClickLink = useCallback(
        (href: string, event: ReactMouseEvent) => {
            if (isNoteLink(href)) {
                event.preventDefault();
                router.push(href);
            } else {
                // 外部链接，在新窗口打开
                window.open(href, '_blank', 'noopener,noreferrer');
            }
        },
        [router]
    );

    const onUploadImage = useCallback(
        async (_file: File, _id?: string) => {
            // Image upload is disabled in PostgreSQL version
            toast('Image upload is not supported in this version', 'error');
            throw new Error('Image upload is not supported');
        },
        [toast]
    );

    const onHoverLink = useCallback((event: ReactMouseEvent) => {
        // 简化悬停处理
        // const { setLinkElement } = PortalState.useContainer();
        // setLinkElement(event.target as HTMLElement);
        return true;
    }, []);

    const [backlinks, setBackLinks] = useState<NoteCacheItem[]>();

    const getBackLinks = useCallback(async () => {
        console.log(note?.id);
        const linkNotes: NoteCacheItem[] = [];
        if (!note?.id) return linkNotes;
        setBackLinks([]);
        await noteCache.iterate<NoteCacheItem, void>((value) => {
            if (value.linkIds?.includes(note?.id || '')) {
                linkNotes.push(value);
            }
        });
        setBackLinks(linkNotes);
    }, [note?.id]);

    const onEditorChange = useCallback(
        async (value: () => string): Promise<void> => {
            const content = value();

            let title: string;
            if (note?.isDailyNote) {
                // 每日笔记：保持原标题不变（日期格式）
                title = note.title;
            } else {
                // 普通笔记：只有在标题为空时才自动填充
                // 首先尝试从页面上的标题输入框获取当前值
                let currentTitle = '';

                // 尝试从页面上的标题输入框获取当前值
                const titleInput = document.querySelector('h1 textarea') as HTMLTextAreaElement;
                if (titleInput && titleInput.value) {
                    currentTitle = titleInput.value.trim();
                } else {
                    // 如果无法从DOM获取，则从 IndexedDB 获取最新标题
                    if (note?.id) {
                        try {
                            const localNote = await noteCache.getItem(note.id);
                            currentTitle = localNote?.title || '';
                        } catch (error) {
                            // 如果 IndexedDB 获取失败，使用 note 对象中的标题
                            currentTitle = note?.title || '';
                        }
                    } else {
                        // 如果没有 ID，使用 note 对象中的标题
                        currentTitle = note?.title || '';
                    }
                }

                // 🔧 修复自动标题提取：处理更多情况
                if (!currentTitle ||
                    currentTitle === 'Untitled' ||
                    currentTitle === 'New Page' ||
                    currentTitle === '' ||
                    // 检测到HTML标签说明标题损坏，需要重新提取
                    (currentTitle.includes('<') && currentTitle.includes('>'))) {

                    const lines = content.split('\n');
                    const firstLine = lines[0]?.replace(/^#\s*/, '').trim() || '';

                    // 🔧 改进标题提取：只取第一行的纯文本部分
                    if (firstLine) {
                        // 移除可能的markdown格式
                        title = firstLine
                            .replace(/\*\*(.*?)\*\*/g, '$1')  // 移除粗体
                            .replace(/\*(.*?)\*/g, '$1')      // 移除斜体
                            .replace(/`(.*?)`/g, '$1')        // 移除代码
                            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // 移除链接，保留文本
                            .trim();
                    } else {
                        title = 'Untitled';
                    }

                    console.log(`🔧 Auto-extracted title: "${title}" from content: "${firstLine}"`);
                } else {
                    // 保持现有标题不变
                    title = currentTitle;
                }
            }

            // Save to IndexedDB immediately for local persistence
            saveToIndexedDB({
                content,
                title,
                updated_at: new Date().toISOString()
            })?.catch((v) => console.error('Error whilst saving to IndexedDB: %O', v));
        },
        [saveToIndexedDB, note?.isDailyNote, note?.id]
    );

    // Function to handle title changes specifically
    const onTitleChange = useCallback(
        (title: string): void => {
            saveToIndexedDB({
                title,
                updated_at: new Date().toISOString()
            })?.catch((v) => console.error('Error whilst saving title to IndexedDB: %O', v));
        },
        [saveToIndexedDB]
    );

    return {
        onCreateLink,
        onSearchLink,
        onClickLink,
        onUploadImage,
        onHoverLink,
        getBackLinks,
        onEditorChange,
        onTitleChange,
        saveToIndexedDB,
        syncToServer,
        backlinks,
        editorEl,
        note,
    };
};

const TiptapEditorState = createContainer(useTiptapEditor);

export default TiptapEditorState;
