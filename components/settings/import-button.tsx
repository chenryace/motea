/**
 * Import Button Component
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

import { ChangeEvent, FC, useCallback, useEffect, useState } from 'react';
import useI18n from 'libs/web/hooks/use-i18n';
import { ButtonProps } from './type';
import { useToast } from 'libs/web/hooks/use-toast';
import { ButtonProgress } from 'components/button-progress';
import { useRouter } from 'next/router';
import { ROOT_ID } from 'libs/shared/tree';
import NoteState from 'libs/web/state/note';
import { NoteModel } from 'libs/shared/note';
import lexicalMarkdownProcessor from 'libs/web/utils/markdown-processor';
import { parseMarkdownTitle } from 'libs/shared/markdown/parse-markdown-title';

const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
};

export const ImportButton: FC<ButtonProps> = ({ parentId = ROOT_ID }) => {
    const { t } = useI18n();
    const toast = useToast();
    const router = useRouter();
    const { createNote, mutateNote } = NoteState.useContainer();
    // const tiptapEditorState = TiptapEditorState.useContainer(); // Not needed for direct mutation
    const [loading, setLoading] = useState(false);

    const processFiles = useCallback(
        async (files: FileList) => {
            setLoading(true);
            const notesToUpload = Array.from(files).filter(file => file.name.endsWith('.md'));
            let successCount = 0;
            let errorCount = 0;

            if (notesToUpload.length === 0) {
                toast(t('No Markdown files selected'), 'warning');
                setLoading(false);
                return;
            }

            console.log(`Starting import of ${notesToUpload.length} Markdown files.`);

            for (let i = 0; i < notesToUpload.length; i += 5) {
                const batch = notesToUpload.slice(i, i + 5);
                console.log(`Processing batch ${i / 5 + 1} with ${batch.length} files.`);

                const batchPromises = batch.map(async (file) => {
                    const fileName = file.name.replace(/\.md$/, '');
                    const markdownContent = await readFileAsText(file);
                    console.log(`Read file: ${fileName}`);
                    console.log('Raw markdown content:', JSON.stringify(markdownContent));

                    try {
                        // 1. Create a new note to get an ID
                        const newNote = await createNote({
                            title: fileName, // Initial title
                            pid: parentId,
                        });

                        if (!newNote || !newNote.id) {
                            console.error(`Failed to create note shell for: ${fileName}`);
                            throw new Error(`Failed to create note shell for: ${fileName}`);
                        }
                        console.log(`Created note shell for ${fileName} with ID: ${newNote.id}`);

                        // 2. 处理 markdown 内容，前端转换为 JSON 格式
                        const processedContent = await lexicalMarkdownProcessor.processImportedContent(markdownContent);
                        console.log('Processed content for Lexical (JSON):', processedContent.substring(0, 200) + '...');

                        // 3. Update the note with processed JSON content
                        await mutateNote(newNote.id, { content: processedContent });

                        console.log(`Successfully imported and saved: ${fileName} (ID: ${newNote.id})`);
                        successCount++;
                    } catch (e: any) {
                        console.error(`Error importing ${fileName}:`, e.message);
                        toast(t('Error importing {{fileName}}: {{message}}', { fileName, message: e.message }), 'error');
                        errorCount++;
                    }
                });

                await Promise.allSettled(batchPromises);

                if (i + 5 < notesToUpload.length) {
                    console.log('Waiting 1 second before next batch...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            toast(
                t('Import finished. Successful: {{success}}, Failed: {{failed}}',
                  { success: successCount, failed: errorCount }),
                successCount > 0 && errorCount === 0 ? 'success' : (errorCount > 0 ? 'warning' : 'info')
            );
            setLoading(false);
            if (successCount > 0) {
                router.reload(); // Reload to see new notes
            }
        },
        [parentId, createNote, mutateNote, router, t, toast]
    );

    const onSelectFile = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            if (!event.target.files?.length) {
                return toast(t('Please select Markdown files'), 'error');
            }
            await processFiles(event.target.files);
            event.target.value = ''; // Reset file input
        },
        [processFiles, t, toast]
    );

    return (
        <label htmlFor="import-button">
            <input
                hidden
                accept=".md,text/markdown"
                id="import-button"
                type="file"
                multiple // Allow multiple file selection
                onChange={onSelectFile}
            />
            <ButtonProgress loading={loading}>{t('Import')}</ButtonProgress>
        </label>
    );
};