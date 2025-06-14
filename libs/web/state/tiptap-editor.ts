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
import { parseMarkdownTitle } from 'libs/shared/markdown/parse-markdown-title';
import { wrapEditorChangeForIME } from 'libs/web/utils/simple-ime-fix';
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

            // 从 IndexedDB 获取最新数据作为基础，避免覆盖已保存的数据
            const existingNote = await noteCache.getItem(note.id);
            const baseNote = existingNote || note;

            const updatedNote = { ...baseNote, ...data };
            await noteCache.setItem(note.id, updatedNote);
        },
        [note]
    );

    const syncToServer = useCallback(
        async () => {
            if (!note?.id) return false;

            const isNew = has(router.query, 'new');

            try {
                const localNote = await noteCache.getItem(note.id);
                let noteToSave = localNote || note;

                // 在上传前处理标题逻辑
                let finalTitle = noteToSave.title;

                // 如果不是每日笔记且标题为空，从内容中解析标题
                if (!note?.isDailyNote && (!finalTitle ||
                    finalTitle === 'Untitled' ||
                    finalTitle === 'New Page' ||
                    finalTitle === '' ||
                    (finalTitle.includes('<') && finalTitle.includes('>')))) {

                    const parsed = parseMarkdownTitle(noteToSave.content || '');
                    finalTitle = parsed.title || 'Untitled';
                }

                // 准备最终的笔记数据，包含处理后的标题和更新时间
                noteToSave = {
                    ...noteToSave,
                    title: finalTitle,
                    updated_at: new Date().toISOString()
                };

                if (isNew) {
                    const noteData = {
                        ...noteToSave,
                        pid: (router.query.pid as string) || ROOT_ID
                    };

                    const item = await createNote(noteData);

                    if (item) {
                        const noteUrl = `/${item.id}`;
                        if (router.asPath !== noteUrl) {
                            await router.replace(noteUrl, undefined, { shallow: true });
                        }
                        toast('Note saved to server', 'success');
                        return true;
                    }
                } else {
                    const updatedNote = await updateNote(noteToSave);

                    if (updatedNote) {
                        await noteCache.setItem(updatedNote.id, updatedNote);
                        toast('Note updated on server', 'success');
                        return true;
                    }
                }
            } catch (error) {
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

    // 编辑器变化处理逻辑 - 主要处理内容，但需要保护每日笔记标题
    const originalOnEditorChange = useCallback(
        async (value: () => string): Promise<void> => {
            const content = value();

            // 对于每日笔记，需要确保标题不被覆盖
            if (note?.isDailyNote) {
                // 每日笔记：保存内容，同时确保标题保持为日期
                await saveToIndexedDB({
                    content,
                    title: note.title // 保持原有的日期标题
                });
            } else {
                // 普通笔记：只保存内容，标题处理留给上传时或onTitleChange
                await saveToIndexedDB({
                    content
                });
            }
        },
        [saveToIndexedDB, note?.isDailyNote, note?.title]
    );

    // 使用 IME 安全的包装器
    const onEditorChange = wrapEditorChangeForIME(originalOnEditorChange, 600);

    // 标题变化处理逻辑 - 只处理标题
    const onTitleChange = useCallback(
        (title: string): void => {
            // 只保存标题，不处理时间戳
            saveToIndexedDB({
                title
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
