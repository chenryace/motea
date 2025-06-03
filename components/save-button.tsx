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

const useStyles = makeStyles({
    saveButton: {
        minWidth: '80px',
        fontWeight: 'bold',
        textTransform: 'none',
        borderRadius: '8px',
        boxShadow: 'none !important',
        '&:hover': {
            opacity: 0.8,
            boxShadow: 'none !important',
        },
        '&:focus': {
            boxShadow: 'none !important',
        },
        '&:active': {
            boxShadow: 'none !important',
        },
    },
    viewButton: {
        backgroundColor: '#6B7280 !important',
        color: '#FFFFFF !important',
        '&:hover': {
            backgroundColor: '#4B5563 !important',
        },
    },
    saveStateButton: {
        backgroundColor: '#DC2626 !important',
        color: '#FFFFFF !important',
        '&:hover': {
            backgroundColor: '#B91C1C !important',
        },
    },
    syncingButton: {
        backgroundColor: '#2563EB !important',
        color: '#FFFFFF !important',
        '&:hover': {
            backgroundColor: '#1D4ED8 !important',
        },
    },
    syncedButton: {
        backgroundColor: '#FBBF24 !important',
        color: '#000000 !important',
        '&:hover': {
            backgroundColor: '#F59E0B !important',
        },
    },
    failedButton: {
        backgroundColor: '#DC2626 !important',
        color: '#FFFFFF !important',
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
            }
        };

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

        if (syncedTimeoutRef.current) {
            clearTimeout(syncedTimeoutRef.current);
        }
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
        }

        syncTimeoutRef.current = setTimeout(() => {
            setSyncStatus('fail');
            setTimeout(() => {
                setSyncStatus('view');
            }, 2000);
        }, 30000);

        try {
            const success = await syncToServer();

            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = null;
            }

            if (success) {
                setSyncStatus('synced');

                syncedTimeoutRef.current = setTimeout(() => {
                    setSyncStatus('view');
                }, 3000);
            } else {
                setSyncStatus('fail');
                setTimeout(() => {
                    setSyncStatus('view');
                }, 2000);
            }
        } catch (error) {
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = null;
            }
            setSyncStatus('fail');
            setTimeout(() => {
                setSyncStatus('view');
            }, 2000);
        }
    }, [syncToServer]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).saveButtonStatus = syncStatus;
            (window as any).saveButtonAutoSave = handleSave;
        }

        return () => {
            if (typeof window !== 'undefined') {
                delete (window as any).saveButtonStatus;
                delete (window as any).saveButtonAutoSave;
            }
        };
    }, [syncStatus, handleSave]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                const target = e.target as HTMLElement;
                const isInEditor = target.closest('.ProseMirror') ||
                                 target.closest('[contenteditable]') ||
                                 target.closest('textarea') ||
                                 target.closest('input');

                if (isInEditor) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSave();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
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
