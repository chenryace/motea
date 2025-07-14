import NoteState from 'libs/web/state/note';
import { useRouter } from 'next/router';
import {
    useCallback,
    MouseEvent as ReactMouseEvent,
    useState,
    useRef,
} from 'react';
import { searchNote, searchRangeText } from 'libs/web/utils/search';
import { isNoteLink, NoteModel } from 'libs/shared/note';
import { useToast } from 'libs/web/hooks/use-toast';
import PortalState from 'libs/web/state/portal';
import { NoteCacheItem } from 'libs/web/cache';
import noteCache from 'libs/web/cache/note';
import { createContainer } from 'unstated-next';
import { LexicalEditorRef } from 'components/editor/lexical-editor';
import UIState from 'libs/web/state/ui';
import { has } from 'lodash';
// 移除了复杂的智能包装器和 Markdown 解析，直接处理 JSON
const ROOT_ID = 'root';

const useLexicalEditor = (initNote?: NoteModel) => {
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
        console.warn('NoteState not available in LexicalEditorState, using initNote only');
        createNoteWithTitle = async () => undefined;
        updateNote = async () => undefined;
        createNote = async () => undefined;
    }

    const router = useRouter();
    const toast = useToast();
    const editorEl = useRef<LexicalEditorRef>(null);

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
                const noteToSave = localNote || note;

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

    // 简化的编辑器变化处理逻辑 - 直接处理 JSON
    const onEditorChange = useCallback(
        async (jsonContent: string): Promise<void> => {
            if (!note?.id) {
                return;
            }

            try {
                // 从 JSON 中提取标题
                let title: string;
                if (note?.isDailyNote) {
                    title = note.title;
                } else {
                    // 优先从标题输入框获取
                    const titleInput = document.querySelector('h1 textarea') as HTMLTextAreaElement;
                    if (titleInput && titleInput.value.trim()) {
                        title = titleInput.value.trim();
                    } else {
                        // 从 JSON 内容中提取标题
                        title = extractTitleFromJSON(jsonContent) || note.title || 'Untitled';
                    }
                }

                // 保存到 IndexedDB
                await saveToIndexedDB({
                    content: jsonContent,
                    title,
                    updated_at: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error in onEditorChange:', error);
            }
        },
        [saveToIndexedDB, note?.isDailyNote, note?.id, note?.title]
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

/**
 * 从 JSON 内容中提取标题
 * 查找第一个 heading 节点作为标题
 */
function extractTitleFromJSON(jsonContent: string): string | null {
    try {
        const editorState = JSON.parse(jsonContent);
        const root = editorState.root;

        if (!root || !root.children) return null;

        // 递归查找第一个 heading 节点
        function findFirstHeading(children: any[]): string | null {
            for (const child of children) {
                if (child.type === 'heading' && child.children) {
                    // 提取文本内容
                    const text = extractTextFromChildren(child.children);
                    if (text) return text;
                }

                if (child.children) {
                    const result = findFirstHeading(child.children);
                    if (result) return result;
                }
            }
            return null;
        }

        function extractTextFromChildren(children: any[]): string {
            if (!Array.isArray(children)) return '';

            return children
                .filter(child => child && child.type === 'text')
                .map(child => child.text || '')
                .join('')
                .trim();
        }

        const title = findFirstHeading(root.children);

        if (title) {
            console.log('🔍 extractTitleFromJSON: Found title:', title);
        } else {
            console.log('🔍 extractTitleFromJSON: No title found in JSON');
        }

        return title;

    } catch (error) {
        console.error('Failed to extract title from JSON:', error);
        return null;
    }
}

const LexicalEditorState = createContainer(useLexicalEditor);

export default LexicalEditorState;
