/**
 * Lazy Plugin Loader
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

import { lazy, Suspense, useState, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

// Lazy load heavy plugins
const TablePlugin = lazy(() => import('./table-plugin'));
const TextAlignPlugin = lazy(() => import('./text-align-plugin'));

interface LazyPluginLoaderProps {
    enableTable?: boolean;
    enableTextAlign?: boolean;
}

export default function LazyPluginLoader({
    enableTable = false,
    enableTextAlign = false
}: LazyPluginLoaderProps) {
    const [editor] = useLexicalComposerContext();
    const [shouldLoadTable, setShouldLoadTable] = useState(false);
    const [shouldLoadTextAlign, setShouldLoadTextAlign] = useState(false);

    useEffect(() => {
        if (!enableTable && !enableTextAlign) return;

        // Load plugins when user starts interacting with the editor
        const handleUserInteraction = () => {
            if (enableTable && !shouldLoadTable) {
                setShouldLoadTable(true);
            }
            if (enableTextAlign && !shouldLoadTextAlign) {
                setShouldLoadTextAlign(true);
            }
        };

        // Load on first focus or after a short delay
        const timeoutId = setTimeout(() => {
            handleUserInteraction();
        }, 2000); // Load after 2 seconds

        const editorElement = editor.getRootElement();
        if (editorElement) {
            editorElement.addEventListener('focus', handleUserInteraction, { once: true });
            editorElement.addEventListener('click', handleUserInteraction, { once: true });
        }

        return () => {
            clearTimeout(timeoutId);
            if (editorElement) {
                editorElement.removeEventListener('focus', handleUserInteraction);
                editorElement.removeEventListener('click', handleUserInteraction);
            }
        };
    }, [editor, enableTable, enableTextAlign, shouldLoadTable, shouldLoadTextAlign]);

    return (
        <>
            {shouldLoadTable && (
                <Suspense fallback={null}>
                    <TablePlugin />
                </Suspense>
            )}
            {shouldLoadTextAlign && (
                <Suspense fallback={null}>
                    <TextAlignPlugin />
                </Suspense>
            )}
        </>
    );
}

// Hook to enable lazy loading for specific features
export function useLazyPlugins() {
    const [enabledPlugins, setEnabledPlugins] = useState({
        table: false,
        textAlign: false,
    });

    const enablePlugin = (plugin: keyof typeof enabledPlugins) => {
        setEnabledPlugins(prev => ({
            ...prev,
            [plugin]: true
        }));
    };

    return {
        enabledPlugins,
        enablePlugin
    };
}
