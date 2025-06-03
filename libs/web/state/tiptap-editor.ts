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

    const onEditorChange = useCallback(
        async (value: () => string): Promise<void> => {
            const content = value();

            let title: string;
            if (note?.isDailyNote) {
                title = note.title;
            } else {
                let currentTitle = '';

                const titleInput = document.querySelector('h1 textarea') as HTMLTextAreaElement;
                if (titleInput && titleInput.value) {
                    currentTitle = titleInput.value.trim();
                } else {
                    if (note?.id) {
                        try {
                            const localNote = await noteCache.getItem(note.id);
                            currentTitle = localNote?.title || '';
                        } catch (error) {
                            currentTitle = note?.title || '';
                        }
                    } else {
                        currentTitle = note?.title || '';
                    }
                }

                if (!currentTitle ||
                    currentTitle === 'Untitled' ||
                    currentTitle === 'New Page' ||
                    currentTitle === '' ||
                    (currentTitle.includes('<') && currentTitle.includes('>'))) {

                    const lines = content.split('\n');
                    const firstLine = lines[0]?.replace(/^#\s*/, '').trim() || '';

                    if (firstLine) {
                        title = firstLine
                            .replace(/\*\*(.*?)\*\*/g, '$1')
                            .replace(/\*(.*?)\*/g, '$1')
                            .replace(/`(.*?)`/g, '$1')
                            .replace(/\[(.*?)\]\(.*?\)/g, '$1')
                            .trim();
                    } else {
                        title = 'Untitled';
                    }
                } else {
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
