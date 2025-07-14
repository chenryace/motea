/**
 * UpdatedAtDisplay Component
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

import { FC, useState, useEffect } from 'react';
import LexicalEditorState from 'libs/web/state/lexical-editor';
import noteCache from 'libs/web/cache/note';

interface UpdatedAtDisplayProps {
    className?: string;
}

const UpdatedAtDisplay: FC<UpdatedAtDisplayProps> = ({ className }) => {
    const { note } = LexicalEditorState.useContainer();
    const [lastUpdatedTime, setLastUpdatedTime] = useState<Date | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!note?.id) {
            setIsEditing(false);
            setLastUpdatedTime(null);
            return;
        }

        let editingState = false;

        const checkEditingStatus = async () => {
            try {
                const localNote = await noteCache.getItem(note.id);
                const hasLocalChanges = localNote && localNote.content !== note.content;

                if (hasLocalChanges && !editingState) {
                    editingState = true;
                    setIsEditing(true);
                } else if (!hasLocalChanges && editingState) {
                    editingState = false;
                    setIsEditing(false);
                    if (note.updated_at) {
                        setLastUpdatedTime(new Date(note.updated_at));
                    }
                }
            } catch (error) {
            }
        };

        if (note.updated_at) {
            setLastUpdatedTime(new Date(note.updated_at));
        }

        // 减少检查频率以降低内存使用，从1秒改为3秒
        const interval = setInterval(checkEditingStatus, 3000);

        return () => {
            clearInterval(interval);
        };
    }, [note]);

    useEffect(() => {
        if (note?.updated_at) {
            const newTime = new Date(note.updated_at);
            if (!lastUpdatedTime || newTime.getTime() !== lastUpdatedTime.getTime()) {
                setLastUpdatedTime(newTime);
                if (isEditing) {
                    setIsEditing(false);
                }
            }
        }
    }, [note?.updated_at, lastUpdatedTime, isEditing]);

    if (isEditing || !lastUpdatedTime) {
        return null;
    }

    return (
        <span className={`text-xs text-gray-400 whitespace-nowrap ${className || ''}`}>
            - Last updated: {lastUpdatedTime.toLocaleString()}
        </span>
    );
};

export default UpdatedAtDisplay;
