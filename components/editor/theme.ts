import { useTheme } from 'next-themes';

// Simple theme configuration for Tiptap editor
export const darkTheme = {
    background: 'inherit',
    text: 'inherit',
    fontFamily: 'inherit',
};

export const lightTheme = {
    background: 'inherit',
    text: 'inherit',
    fontFamily: 'inherit',
};

export const useEditorTheme = () => {
    const { resolvedTheme } = useTheme();

    return resolvedTheme === 'dark' ? darkTheme : lightTheme;
};
