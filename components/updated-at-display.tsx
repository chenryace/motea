import { FC, useState, useEffect } from 'react';
import TiptapEditorState from 'libs/web/state/tiptap-editor';
import noteCache from 'libs/web/cache/note';

interface UpdatedAtDisplayProps {
    className?: string;
}

const UpdatedAtDisplay: FC<UpdatedAtDisplayProps> = ({ className }) => {
    const { note } = TiptapEditorState.useContainer();
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

        const interval = setInterval(checkEditingStatus, 1000);

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
