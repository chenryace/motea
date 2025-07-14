/**
 * Unified Editor Manager
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

import { EditorState } from 'lexical';
import { NoteModel } from 'libs/shared/note';
import noteCache from 'libs/web/cache/note';
import { setManagedTimeout, clearManagedTimer } from './timer-manager';

export interface EditorChangeEvent {
    jsonContent: string;
    noteId: string;
    timestamp: number;
}

export interface UnifiedEditorManagerOptions {
    debounceDelay?: number;
    debug?: boolean;
    onSave?: (event: EditorChangeEvent) => Promise<void>;
    onError?: (error: Error) => void;
    onHistoryClear?: () => void;
}

export class UnifiedEditorManager {
    private lastSavedContent: string = '';
    private noteId: string = '';
    private options: Required<UnifiedEditorManagerOptions>;
    
    constructor(options: UnifiedEditorManagerOptions = {}) {
        this.options = {
            debounceDelay: 300,
            debug: false,
            onSave: async () => {},
            onError: (error) => console.error('UnifiedEditorManager Error:', error),
            onHistoryClear: () => {},
            ...options
        };
    }


    setNoteId(noteId: string): void {
        this.noteId = noteId;
        this.lastSavedContent = '';
    }


    handleEditorChange(editorState: EditorState, tags: Set<string>): void {
        try {
            if (this.shouldIgnoreEvent(tags)) {
                return;
            }

            const jsonContent = this.extractJSON(editorState);

            if (jsonContent === this.lastSavedContent) {
                return;
            }
            this.debouncedSave(jsonContent);

        } catch (error) {
            this.options.onError(error as Error);
        }
    }

    private shouldIgnoreEvent(tags: Set<string>): boolean {
        const ignoreTags = [
            'history-merge',
            'content-sync',
            'selection-change',
        ];

        return ignoreTags.some(tag => tags.has(tag));
    }


    private extractJSON(editorState: EditorState): string {
        return JSON.stringify(editorState.toJSON());
    }

    private debouncedSave(jsonContent: string): void {
        const timerId = `unified-editor-debounce-${this.noteId}`;

        clearManagedTimer(timerId);
        setManagedTimeout(timerId, () => {
            this.executeSave(jsonContent);
        }, this.options.debounceDelay);
    }


    private async executeSave(jsonContent: string): Promise<void> {
        try {
            if (!this.noteId) {
                return;
            }

            const event: EditorChangeEvent = {
                jsonContent,
                noteId: this.noteId,
                timestamp: Date.now()
            };

            await this.options.onSave(event);

            this.lastSavedContent = jsonContent;
            this.options.onHistoryClear();

        } catch (error) {
            this.options.onError(error as Error);
        }
    }

    async forceSave(editorState: EditorState): Promise<void> {
        const timerId = `unified-editor-debounce-${this.noteId}`;
        clearManagedTimer(timerId);

        const jsonContent = this.extractJSON(editorState);
        await this.executeSave(jsonContent);
    }

    destroy(): void {
        const timerId = `unified-editor-debounce-${this.noteId}`;
        clearManagedTimer(timerId);
    }
}


export async function createDefaultSaveHandler(
    getCurrentNote: () => NoteModel | undefined
): Promise<(event: EditorChangeEvent) => Promise<void>> {
    
    return async (event: EditorChangeEvent) => {
        const note = getCurrentNote();
        if (!note) return;

        try {
            const title = extractTitleFromJSON(event.jsonContent) || note.title || 'Untitled';
            const existingNote = await noteCache.getItem(event.noteId);
            const baseNote = existingNote || note;

            const updatedNote: Partial<NoteModel> = {
                ...baseNote,
                content: event.jsonContent,
                title,
                updated_at: new Date(event.timestamp).toISOString()
            };

            await noteCache.setItem(event.noteId, updatedNote);

        } catch (error) {
            console.error('Failed to save note:', error);
            throw error;
        }
    };
}


function extractTitleFromJSON(jsonContent: string): string | null {
    try {
        const editorState = JSON.parse(jsonContent);
        const root = editorState.root;
        
        if (!root || !root.children) return null;

        function findFirstHeading(children: any[]): string | null {
            for (const child of children) {
                if (child.type === 'heading' && child.tag === 'h1' && child.children) {
                    return extractTextFromChildren(child.children);
                }
                
                if (child.children) {
                    const result = findFirstHeading(child.children);
                    if (result) return result;
                }
            }
            return null;
        }

        function extractTextFromChildren(children: any[]): string {
            return children
                .filter(child => child.type === 'text')
                .map(child => child.text || '')
                .join('')
                .trim();
        }

        return findFirstHeading(root.children);

    } catch (error) {
        console.error('Failed to extract title from JSON:', error);
        return null;
    }
}
