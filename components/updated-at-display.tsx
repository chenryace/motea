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

    // 监听编辑状态
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
                    // 编辑完成后更新时间
                    if (note.updated_at) {
                        setLastUpdatedTime(new Date(note.updated_at));
                    }
                }
            } catch (error) {
                console.error('Error checking editing status:', error);
            }
        };

        // 初始化时设置时间
        if (note.updated_at) {
            setLastUpdatedTime(new Date(note.updated_at));
        }

        // 定期检查编辑状态
        const interval = setInterval(checkEditingStatus, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [note]);

    // 监听笔记的 updated_at 变化（同步完成后更新）
    useEffect(() => {
        if (note?.updated_at) {
            const newTime = new Date(note.updated_at);
            // 只有在时间真的变化时才更新（避免重复设置）
            if (!lastUpdatedTime || newTime.getTime() !== lastUpdatedTime.getTime()) {
                setLastUpdatedTime(newTime);
                // 如果正在编辑，同步完成后停止编辑状态
                if (isEditing) {
                    setIsEditing(false);
                }
            }
        }
    }, [note?.updated_at, lastUpdatedTime, isEditing]);

    // 编辑时不显示
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
