/**
 * Save Status Indicator Component
 * Shows the current save status of the document
 */

import { FC } from 'react';
import LexicalEditorState from 'libs/web/state/lexical-editor';

const SaveStatusIndicator: FC = () => {
    const { hasUnsavedChanges, isSaving } = LexicalEditorState.useContainer();

    if (isSaving) {
        return (
            <div className="save-status saving">
                <span className="save-status-dot animate-pulse"></span>
                <span className="save-status-text">Saving...</span>
            </div>
        );
    }

    if (hasUnsavedChanges) {
        return (
            <div className="save-status unsaved">
                <span className="save-status-dot"></span>
                <span className="save-status-text">Unsaved changes</span>
            </div>
        );
    }

    return (
        <div className="save-status saved">
            <span className="save-status-dot"></span>
            <span className="save-status-text">All changes saved</span>
            <style jsx>{`
                .save-status {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.875rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.375rem;
                }

                .save-status-dot {
                    width: 0.5rem;
                    height: 0.5rem;
                    border-radius: 50%;
                }

                .save-status.saving .save-status-dot {
                    background-color: #3b82f6;
                }

                .save-status.saving .save-status-text {
                    color: #3b82f6;
                }

                .save-status.unsaved .save-status-dot {
                    background-color: #f59e0b;
                }

                .save-status.unsaved .save-status-text {
                    color: #f59e0b;
                }

                .save-status.saved .save-status-dot {
                    background-color: #10b981;
                }

                .save-status.saved .save-status-text {
                    color: #10b981;
                }

                @media (prefers-color-scheme: dark) {
                    .save-status.saving .save-status-text {
                        color: #60a5fa;
                    }

                    .save-status.unsaved .save-status-text {
                        color: #fbbf24;
                    }

                    .save-status.saved .save-status-text {
                        color: #34d399;
                    }
                }
            `}</style>
        </div>
    );
};

export default SaveStatusIndicator;
