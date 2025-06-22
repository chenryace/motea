/**
 * Tiptap Edit Container Component
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

import { FC, useEffect } from 'react';
import { useRouter } from 'next/router';
import { has } from 'lodash';
import TiptapMainEditor from 'components/editor/tiptap-main-editor';
import TiptapEditorState from 'libs/web/state/tiptap-editor';
import NoteState from 'libs/web/state/note';
import NoteTreeState from 'libs/web/state/tree';
import UIState from 'libs/web/state/ui';
import { useToast } from 'libs/web/hooks/use-toast';
import useAutoSaveOnLeave from 'libs/web/hooks/use-auto-save-on-leave';
import noteCache from 'libs/web/cache/note';
import NoteNav from 'components/note-nav';
import DeleteAlert from 'components/editor/delete-alert';

const TiptapEditContainer: FC = () => {
    const router = useRouter();
    const { id, pid } = router.query;
    const isNew = has(router.query, 'new');
    const { initNote, findOrCreateNote, fetchNote } = NoteState.useContainer();
    const { loadNoteOnDemand } = NoteTreeState.useContainer();
    const {
        settings: { settings },
    } = UIState.useContainer();
    const toast = useToast();

    useAutoSaveOnLeave({
        enabled: true,
    });

    useEffect(() => {
        const initializeEditor = async () => {
            if (!id || Array.isArray(id)) return;

            if (isNew) {
                const dailyDate = router.query.daily as string;

                if (dailyDate && /^\d{4}-\d{1,2}-\d{1,2}$/.test(dailyDate)) {
                    initNote({
                        id,
                        title: dailyDate,
                        content: '\n',
                        pid: settings.daily_root_id,
                        isDailyNote: true, 
                    });
                } else {
                    const cachedNote = await noteCache.getItem(id);
                    if (cachedNote) {
                        initNote(cachedNote);
                        return;
                    }

                    initNote({
                        id,
                        title: '',
                        content: '\n',
                        pid: (typeof pid === 'string' ? pid : undefined) || 'root'
                    });
                }
            } else {
                try {
                    const noteData = await loadNoteOnDemand(id);

                    if (noteData) {
                        initNote(noteData);
                    } else {
                        console.log('🔄 Fallback to direct API call for note:', id);
                        await fetchNote(id);
                    }
                } catch (error) {
                    console.error('Failed to load note:', error);
                    toast('Failed to load note', 'error');
                }
            }
        };

        initializeEditor();
    }, [
        id,
        isNew,
        pid,
        router.query.daily,
        settings.daily_root_id,
        initNote,
        findOrCreateNote,
        fetchNote,
        loadNoteOnDemand,
        toast,
    ]);

    if (!id || Array.isArray(id)) {
        return <div>Loading...</div>;
    }

    return (
        <TiptapEditorState.Provider>
            <NoteNav />
            <DeleteAlert />
            <section className="h-full">
                <TiptapMainEditor readOnly={false} />
            </section>
        </TiptapEditorState.Provider>
    );
};

export default TiptapEditContainer;
