import { FC, useState, useEffect, useCallback } from 'react';
import { Button, Chip } from '@material-ui/core';
import {
    DocumentIcon,
    UploadIcon,
    CheckIcon,
    XIcon,
    EyeIcon
} from '@heroicons/react/outline';
import TiptapEditorState from 'libs/web/state/tiptap-editor';
import noteCache from 'libs/web/cache/note';
import { useRouter } from 'next/router';
import { has } from 'lodash';

interface SaveButtonProps {
    className?: string;
}

type SyncStatus = 'synced' | 'local' | 'syncing' | 'error' | 'viewing';

const SaveButton: FC<SaveButtonProps> = ({ className }) => {
    const { syncToServer, note, onEditorChange } = TiptapEditorState.useContainer();
    const [isSaving, setIsSaving] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [hasLocalChanges, setHasLocalChanges] = useState(false);
    const router = useRouter();

    // 监听编辑器内容变化
    useEffect(() => {
        if (!note?.id) return;

        // 当有本地变化时，设置状态为需要保存
        if (hasLocalChanges) {
            setSyncStatus('local');
        }
    }, [hasLocalChanges, note?.id]);

    // Check sync status (借鉴旧项目的简单有效逻辑)
    useEffect(() => {
        const checkSyncStatus = async () => {
            if (!note?.id) {
                setSyncStatus('synced');
                setHasLocalChanges(false);
                return;
            }

            // 检查是否在预览模式
            const isPreviewMode = router.query.preview === 'true' ||
                                document.querySelector('.ProseMirror')?.getAttribute('contenteditable') === 'false';

            if (isPreviewMode) {
                setSyncStatus('viewing');
                setHasLocalChanges(false);
                return;
            }

            const isNew = has(router.query, 'new');
            if (isNew) {
                setSyncStatus('local');
                setHasLocalChanges(true);
                return;
            }

            // 始终设置上次保存时间（如果笔记有更新时间）
            if (note.updated_at) {
                setLastSyncTime(new Date(note.updated_at));
            }

            try {
                // 借鉴旧项目：检查本地缓存是否有更新
                const localNote = await noteCache.getItem(note.id);

                if (!localNote) {
                    setSyncStatus('synced');
                    setHasLocalChanges(false);
                    return;
                }

                // 简单比较：如果有本地缓存且时间戳更新，说明有本地更改
                if (localNote.updated_at && note.updated_at) {
                    const localTime = new Date(localNote.updated_at);
                    const serverTime = new Date(note.updated_at);

                    if (localTime > serverTime) {
                        setSyncStatus('local');
                        setHasLocalChanges(true);
                    } else {
                        setSyncStatus('synced');
                        setHasLocalChanges(false);
                    }
                } else {
                    setSyncStatus('local');
                    setHasLocalChanges(true);
                }
            } catch (error) {
                setSyncStatus('error');
                setHasLocalChanges(false);
            }
        };

        checkSyncStatus();

        // 设置定时检查，每5秒检查一次本地缓存变化
        const interval = setInterval(checkSyncStatus, 5000);
        return () => clearInterval(interval);
    }, [note, router.query]);

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        setSyncStatus('syncing');

        try {
            const success = await syncToServer();
            if (success) {
                setSyncStatus('synced');
                setLastSyncTime(new Date());
                setHasLocalChanges(false);
            } else {
                setSyncStatus('error');
            }
        } catch (error) {
            setSyncStatus('error');
        } finally {
            setIsSaving(false);
        }
    }, [syncToServer]);

    // Add keyboard shortcut Ctrl+S / Cmd+S (借鉴旧项目的实现)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // 只在按下 Ctrl+S 或 Cmd+S 时处理
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                const target = e.target as HTMLElement;
                const isInEditor = target.closest('.ProseMirror') ||
                                 target.closest('[contenteditable]') ||
                                 target.closest('textarea') ||
                                 target.closest('input');

                // 只在编辑器区域或输入元素中响应 Ctrl+S
                if (isInEditor) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSave();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown, true); // 使用捕获阶段
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [handleSave]);

    const getButtonIcon = () => {
        switch (syncStatus) {
            case 'viewing':
                return <EyeIcon className="w-4 h-4 animate-pulse" />;
            case 'syncing':
                return <UploadIcon className="w-4 h-4 animate-pulse" />;
            case 'synced':
                return <CheckIcon className="w-4 h-4" />;
            case 'error':
                return <XIcon className="w-4 h-4" />;
            case 'local':
            default:
                return <DocumentIcon className="w-4 h-4" />;
        }
    };

    const getButtonText = () => {
        switch (syncStatus) {
            case 'viewing':
                return 'Viewing';
            case 'syncing':
                return 'Syncing...';
            case 'synced':
                return 'Updated';
            case 'error':
                return 'X Retry';
            case 'local':
                return 'Save';
            default:
                return 'Save';
        }
    };

    const getStatusColor = () => {
        switch (syncStatus) {
            case 'synced':
                return 'primary';
            case 'viewing':
                return 'default';
            case 'local':
                return 'secondary';
            case 'syncing':
                return 'primary';
            case 'error':
                return 'secondary';
            default:
                return 'secondary';
        }
    };

    return (
        <div className="flex items-center gap-2">
            {/* 始终显示上次保存时间（如果存在） */}
            {lastSyncTime && (
                <span className="text-xs text-gray-500">
                    Last saved: {lastSyncTime.toLocaleTimeString()}
                </span>
            )}

            <Button
                variant="contained"
                color={getStatusColor()}
                startIcon={getButtonIcon()}
                onClick={handleSave}
                disabled={isSaving}
                className={className}
                size="small"
                data-save-button="true"
            >
                {getButtonText()}
            </Button>
        </div>
    );
};

export default SaveButton;
