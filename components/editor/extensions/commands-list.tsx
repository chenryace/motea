/**
 * Commands List Component for Tiptap Editor
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

import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';

interface Command {
    title: string;
    command: (props: any) => void;
}

interface CommandsListProps {
    items: Command[];
    command: (item: Command) => void;
}

const CommandsList = forwardRef<any, CommandsListProps>(({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setSelectedIndex(0);
    }, [items]);

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowUp') {
            setSelectedIndex((selectedIndex + items.length - 1) % items.length);
            return true;
        } else if (event.key === 'ArrowDown') {
            setSelectedIndex((selectedIndex + 1) % items.length);
            return true;
        } else if (event.key === 'Enter') {
            selectItem(selectedIndex);
            return true;
        }
        return false;
    };

    const selectItem = (index: number) => {
        const item = items[index];
        if (item) {
            command(item);
        }
    };

    useImperativeHandle(ref, () => ({
        onKeyDown,
    }));

    return (
        <div
            ref={containerRef}
            className="bg-gray-200 border border-gray-300 rounded-lg shadow-xl p-2 max-w-xs z-50"
            style={{
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 6px rgba(0, 0, 0, 0.1)', 
            }}
        >
            {items.length ? (
                items.map((item, index) => (
                    <button
                        key={index}
                        className={`w-full text-left px-3 py-2 rounded-md hover:bg-yellow-300 dark:hover:bg-blue-600 dark:hover:text-white focus:bg-yellow-200 dark:focus:bg-blue-600 dark:focus:text-white focus:outline-none block transition-colors duration-150 ${
                            index === selectedIndex
                                ? 'bg-yellow-500 dark:bg-blue-600 dark:text-white border border-yellow-500 dark:border-blue-500'
                                : 'border border-transparent'
                        }`}
                        onClick={() => selectItem(index)}
                    >
                        <div className="font-semibold text-sm text-gray-900 dark:text-white">{item.title}</div>
                    </button>
                ))
            ) : (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <span>❌</span>
                    <span>No result</span>
                </div>
            )}
        </div>
    );
});

CommandsList.displayName = 'CommandsList';

export default CommandsList;
