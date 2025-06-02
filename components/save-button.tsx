import { FC, useState, useEffect, useCallback, useRef } from 'react';
import { Button, makeStyles } from '@material-ui/core';
import {
    EyeIcon,
    DocumentIcon,
    UploadIcon,
    CheckIcon,
    XIcon
} from '@heroicons/react/outline';
import TiptapEditorState from 'libs/web/state/tiptap-editor';
import noteCache from 'libs/web/cache/note';

interface SaveButtonProps {
    className?: string;
}

type SyncStatus = 'view' | 'save' | 'syncing' | 'synced' | 'fail';

// 自定义样式
const useStyles = makeStyles({
    saveButton: {
        minWidth: '80px', // 加大宽度
        fontWeight: 'bold',
        textTransform: 'none',
        borderRadius: '8px', // 添加圆角
        boxShadow: 'none !important', // 移除阴影
        '&:hover': {
            opacity: 0.8,
            boxShadow: 'none !important', // 悬停时也不要阴影
        },
        '&:focus': {
            boxShadow: 'none !important', // 聚焦时也不要阴影
        },
        '&:active': {
            boxShadow: 'none !important', // 点击时也不要阴影
        },
    },
    // view 状态：灰色背景白色字
    viewButton: {
        backgroundColor: '#6B7280 !important', // 灰色
        color: '#FFFFFF !important', // 白色字
        '&:hover': {
            backgroundColor: '#4B5563 !important',
        },
    },
    // save 状态：红色背景白色字
    saveStateButton: {
        backgroundColor: '#DC2626 !important', // 红色
        color: '#FFFFFF !important', // 白色字
        '&:hover': {
            backgroundColor: '#B91C1C !important',
        },
    },
    // syncing 状态：蓝色背景白色字
    syncingButton: {
        backgroundColor: '#2563EB !important', // 蓝色
        color: '#FFFFFF !important', // 白色字
        '&:hover': {
            backgroundColor: '#1D4ED8 !important',
        },
    },
    // synced 状态：黄色背景黑色字
    syncedButton: {
        backgroundColor: '#FBBF24 !important', // 黄色
        color: '#000000 !important', // 黑色字
        '&:hover': {
            backgroundColor: '#F59E0B !important',
        },
    },
    // failed 状态：红色背景白色字
    failedButton: {
        backgroundColor: '#DC2626 !important', // 红色
        color: '#FFFFFF !important', // 白色字
        '&:hover': {
            backgroundColor: '#B91C1C !important',
        },
    },
});

const SaveButton: FC<SaveButtonProps> = ({ className }) => {
    const classes = useStyles();
    const { syncToServer, note } = TiptapEditorState.useContainer();
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('view');
    const syncedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 监听 IndexedDB 变化来检测编辑状态
    useEffect(() => {
        if (!note?.id) return;

        let isEditing = false;

        const checkIndexedDBChanges = async () => {
            try {
                const localNote = await noteCache.getItem(note.id);
                if (localNote && localNote.content !== note.content) {
                    if (!isEditing) {
                        isEditing = true;
                        setSyncStatus('save');
                    }
                }
            } catch (error) {
                console.error('Error checking IndexedDB:', error);
            }
        };

        // 定期检查 IndexedDB 变化
        const interval = setInterval(checkIndexedDBChanges, 1000);

        return () => {
            clearInterval(interval);
            if (syncedTimeoutRef.current) {
                clearTimeout(syncedTimeoutRef.current);
            }
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
            }
        };
    }, [note]);

    const handleSave = useCallback(async () => {
        setSyncStatus('syncing');

        // 清除之前的超时
        if (syncedTimeoutRef.current) {
            clearTimeout(syncedTimeoutRef.current);
        }
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
        }

        // 设置上传超时（30秒）
        syncTimeoutRef.current = setTimeout(() => {
            setSyncStatus('fail');
        }, 30000);

        try {
            const success = await syncToServer();

            // 清除超时
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = null;
            }

            if (success) {
                setSyncStatus('synced');

                // 3秒后回到 view 状态
                syncedTimeoutRef.current = setTimeout(() => {
                    setSyncStatus('view');
                }, 3000);
            } else {
                setSyncStatus('fail');
            }
        } catch (error) {
            // 清除超时
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = null;
            }
            setSyncStatus('fail');
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
            case 'view':
                return <EyeIcon className="w-4 h-4" />;
            case 'save':
                return <DocumentIcon className="w-4 h-4" />;
            case 'syncing':
                return <UploadIcon className="w-4 h-4 animate-pulse" />;
            case 'synced':
                return <CheckIcon className="w-4 h-4" />;
            case 'fail':
                return <XIcon className="w-4 h-4" />;
            default:
                return <EyeIcon className="w-4 h-4" />;
        }
    };

    const getButtonText = () => {
        switch (syncStatus) {
            case 'view':
                return 'View';
            case 'save':
                return 'Save';
            case 'syncing':
                return 'Syncing...';
            case 'synced':
                return 'Synced';
            case 'fail':
                return 'Failed';
            default:
                return 'View';
        }
    };

    const getButtonClassName = () => {
        const baseClass = `${classes.saveButton}`;
        switch (syncStatus) {
            case 'view':
                return `${baseClass} ${classes.viewButton}`;
            case 'save':
                return `${baseClass} ${classes.saveStateButton}`;
            case 'syncing':
                return `${baseClass} ${classes.syncingButton}`;
            case 'synced':
                return `${baseClass} ${classes.syncedButton}`;
            case 'fail':
                return `${baseClass} ${classes.failedButton}`;
            default:
                return `${baseClass} ${classes.viewButton}`;
        }
    };

    const isButtonDisabled = () => {
        return syncStatus === 'syncing' || syncStatus === 'view';
    };

    return (
        <Button
            variant="contained"
            startIcon={getButtonIcon()}
            onClick={handleSave}
            disabled={isButtonDisabled()}
            className={`${getButtonClassName()} ${className || ''}`}
            size="small"
            data-save-button="true"
        >
            {getButtonText()}
        </Button>
    );
};

export default SaveButton;
