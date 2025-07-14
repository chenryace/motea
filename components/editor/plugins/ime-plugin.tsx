/**
 * IME Plugin for Lexical
 * Provides better Chinese input method support
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';

interface IMEPluginProps {
    enabled?: boolean;
    debug?: boolean;
}

export default function IMEPlugin({ 
    enabled = true, 
    debug = false 
}: IMEPluginProps = {}): null {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        if (!enabled) return;

        const rootElement = editor.getRootElement();
        if (!rootElement) return;

        let isComposing = false;
        let compositionData = '';

        const handleCompositionStart = (event: CompositionEvent) => {
            isComposing = true;
            compositionData = '';
        };

        const handleCompositionUpdate = (event: CompositionEvent) => {
            if (isComposing) {
                compositionData = event.data || '';
            }
        };

        const handleCompositionEnd = (event: CompositionEvent) => {
            isComposing = false;
            compositionData = '';
        };

        const handleBeforeInput = (event: InputEvent) => {
            // Let composition events handle IME input
            if (isComposing) {
                return;
            }
        };

        const handleInput = (event: InputEvent) => {
            // Additional input handling if needed
        };

        // Add event listeners
        rootElement.addEventListener('compositionstart', handleCompositionStart);
        rootElement.addEventListener('compositionupdate', handleCompositionUpdate);
        rootElement.addEventListener('compositionend', handleCompositionEnd);
        rootElement.addEventListener('beforeinput', handleBeforeInput);
        rootElement.addEventListener('input', handleInput);

        // Cleanup
        return () => {
            rootElement.removeEventListener('compositionstart', handleCompositionStart);
            rootElement.removeEventListener('compositionupdate', handleCompositionUpdate);
            rootElement.removeEventListener('compositionend', handleCompositionEnd);
            rootElement.removeEventListener('beforeinput', handleBeforeInput);
            rootElement.removeEventListener('input', handleInput);
        };
    }, [editor, enabled, debug]);

    return null;
}
