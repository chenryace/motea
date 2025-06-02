import { EDITOR_SIZE, NOTE_DELETED, NOTE_PINNED, NOTE_SHARED } from './meta';

export interface NoteModel {
    id: string;
    title: string;
    /**
     * Parent ID
     */
    pid?: string;
    content?: string;
    pic?: string;
    date?: string;
    deleted: NOTE_DELETED;
    shared: NOTE_SHARED;
    pinned: NOTE_PINNED;
    editorsize: EDITOR_SIZE | null;
    isDailyNote?: boolean; // 标记是否为每日笔记
    updated_at?: string; // 添加更新时间字段
}

/**
 * like `/IHqMRohfi2`
 */
export const isNoteLink = (str: string) => {
    return new RegExp(`^/${NOTE_ID_REGEXP}$`).test(str);
};

export const NOTE_ID_REGEXP = '[A-Za-z0-9_-]+';
