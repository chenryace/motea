/**
 * Note State Management
 *
 * Copyright (c) 2025 waycaan
 * Licensed under the MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */

import { useCallback, useState } from 'react';
import { createContainer } from 'unstated-next';
import NoteTreeState from 'libs/web/state/tree';
import { NOTE_DELETED, NOTE_PINNED, NOTE_SHARED } from 'libs/shared/meta';
import useNoteAPI from '../api/note';
import noteCache from '../cache/note';
import { NoteModel } from 'libs/shared/note';
import { useToast } from '../hooks/use-toast';
import { isEmpty, map } from 'lodash';

const useNote = (initData?: NoteModel) => {
    const [note, setNote] = useState<NoteModel | undefined>(initData);
    const { find, abort: abortFindNote } = useNoteAPI();
    const { create, error: createError } = useNoteAPI();
    const { mutate, loading, abort } = useNoteAPI();
    const { addItem, removeItem, mutateItem, genNewId } =
        NoteTreeState.useContainer();
    const toast = useToast();

    const fetchNote = useCallback(
        async (id: string) => {
            const cache = await noteCache.getItem(id);
            if (cache) {
                setNote(cache);
            }
            const result = await find(id);

            if (!result) {
                return;
            }

            result.content = result.content || '\n';
            setNote(result);
            await noteCache.setItem(id, result);

            return result;
        },
        [find]
    );

    const removeNote = useCallback(
        async (id: string) => {
            const payload = {
                deleted: NOTE_DELETED.DELETED,
            };

            setNote((prev) => {
                if (prev?.id === id) {
                    return { ...prev, ...payload };
                }
                return prev;
            });
            await mutate(id, payload);
            await noteCache.mutateItem(id, payload);
            await removeItem(id);
        },
        [mutate, removeItem]
    );

    const mutateNote = useCallback(
        async (id: string, payload: Partial<NoteModel>) => {
            const note = await noteCache.getItem(id);

            if (!note) {
                // todo
                console.error('mutate note error');
                return;
            }

            const diff: Partial<NoteModel> = {};
            map(payload, (value: any, key: keyof NoteModel) => {
                if (note[key] !== value) {
                    diff[key] = value;
                }
            });

            if (isEmpty(diff)) {
                return;
            }

            setNote((prev) => {
                if (prev?.id === id) {
                    return { ...prev, ...payload };
                }
                return prev;
            });
            await mutate(id, payload);
            await noteCache.mutateItem(id, payload);
            await mutateItem(id, {
                data: {
                    ...note,
                    ...payload,
                },
            });
        },
        [mutate, mutateItem]
    );

    const createNote = useCallback(
        async (body: Partial<NoteModel>) => {
            const result = await create(body);

            if (!result) {
                toast(createError, 'error');
                return;
            }

            result.content = result.content || '\n';

            await noteCache.setItem(result.id, result);
            setNote(result);

            addItem(result);

            return result;
        },
        [create, addItem, toast, createError]
    );

    const createNoteWithTitle = useCallback(
        async (title: NoteModel['title']) => {
            const id = genNewId();
            const result = await create({
                id,
                title,
            });

            if (!result) {
                return;
            }

            result.content = result.content || '\n';
            await noteCache.setItem(result.id, result);
            addItem(result);

            return { id };
        },
        [addItem, create, genNewId]
    );

    const updateNote = useCallback(
        async (data: Partial<NoteModel>) => {
            abort();

            if (!note?.id) {
                toast('Not found id', 'error');
                return;
            }

            const localNote = await noteCache.getItem(note.id);
            const noteToUpdate = localNote || note;

            const updateData = {
                ...data,
                content: data.content || noteToUpdate.content, 
            };

            const newNote = {
                ...noteToUpdate,
                ...data,
            };

            setNote(newNote);
            await mutateItem(newNote.id, {
                data: newNote,
            });

            const result = await mutate(note.id, updateData);
            await noteCache.mutateItem(note.id, updateData);

            return result;
        },
        [abort, toast, note, mutate, mutateItem]
    );

    const initNote = useCallback((note: Partial<NoteModel>) => {
        setNote({
            deleted: NOTE_DELETED.NORMAL,
            shared: NOTE_SHARED.PRIVATE,
            pinned: NOTE_PINNED.UNPINNED,
            editorsize: null,
            id: '-1',
            title: '',
            ...note,
        });
    }, []);

    const findOrCreateNote = useCallback(
        async (id: string, note: Partial<NoteModel>) => {
            try {
                const data = await fetchNote(id);
                if (!data) {
                    throw data;
                }
            } catch (e) {
                await createNote({
                    id,
                    ...note,
                });
            }
        },
        [createNote, fetchNote]
    );

    return {
        note,
        fetchNote,
        abortFindNote,
        createNote,
        findOrCreateNote,
        createNoteWithTitle,
        updateNote,
        removeNote,
        mutateNote,
        initNote,
        loading,
    };
};

const NoteState = createContainer(useNote);

export default NoteState;
