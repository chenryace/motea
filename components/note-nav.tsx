import classNames from 'classnames';
import NoteState from 'libs/web/state/note';
import UIState from 'libs/web/state/ui';
import { useCallback, MouseEvent } from 'react';
import { CircularProgress, Tooltip } from '@material-ui/core';
import NoteTreeState from 'libs/web/state/tree';
import { Breadcrumbs } from '@material-ui/core';
import Link from 'next/link';
import IconButton from './icon-button';
import HotkeyTooltip from './hotkey-tooltip';
import PortalState from 'libs/web/state/portal';
import { NOTE_SHARED } from 'libs/shared/meta';
import useI18n from 'libs/web/hooks/use-i18n';
import NavButtonGroup from './nav-button-group';
import SaveButton from './save-button';
import UpdatedAtDisplay from './updated-at-display';
import { EyeIcon } from '@heroicons/react/outline';

const MenuButton = () => {
    const { sidebar } = UIState.useContainer();

    const onToggle = useCallback(
        (e: MouseEvent) => {
            e.stopPropagation();
            sidebar.toggle()
                ?.catch((v) => console.error('Error whilst toggling sidebar: %O', v));
        },
        [sidebar]
    );

    return (
        <IconButton
            icon="Menu"
            className="mr-2 active:bg-gray-400"
            onClick={onToggle}
        ></IconButton>
    );
};

const NoteNav = () => {
    const { t } = useI18n();
    const { note, loading } = NoteState.useContainer();
    const { ua } = UIState.useContainer();
    const { getPaths, showItem, checkItemIsShown } =
        NoteTreeState.useContainer();
    const { share, menu, editorWidthSelect } = PortalState.useContainer();

    const handleClickShare = useCallback(
        (event: MouseEvent) => {
            share.setData(note);
            share.setAnchor(event.target as Element);
            share.open();
        },
        [note, share]
    );

    const handleClickMenu = useCallback(
        (event: MouseEvent) => {
            menu.setData(note);
            menu.setAnchor(event.target as Element);
            menu.open();
        },
        [note, menu]
    );
    const handleClickEditorWidth = useCallback(
        (event: MouseEvent) => {
            editorWidthSelect.setData(note);
            editorWidthSelect.setAnchor(event.target as Element);
            editorWidthSelect.open();
        },
        [note, editorWidthSelect]
    );

    const handleClickOpenInTree = useCallback(() => {
        if (!note) return;
        showItem(note);
    }, [note, showItem]);

    // 手机端渲染
    if (ua.isMobileOnly) {
        return (
            <nav
                className="fixed bg-gray-50 z-10 p-2 right-0 shadow"
                style={{ width: '100%' }}
            >
                {/* 第一行：菜单按钮 + 标题 */}
                <div className="flex items-center mb-1">
                    <MenuButton />
                    <div className="flex-auto ml-2">
                        {note && (
                            <Tooltip title={note.title}>
                                <span className="text-gray-600 text-sm truncate select-none block">
                                    {note.title}
                                </span>
                            </Tooltip>
                        )}
                    </div>
                </div>

                {/* 第二行：上传时间 */}
                <div className="flex items-center mb-1 ml-10">
                    {note && <UpdatedAtDisplay className="text-xs text-gray-400" />}
                </div>

                {/* 第三行：SaveButton */}
                <div className="flex items-center ml-10">
                    <div
                        className={classNames(
                            'flex mr-2 transition-opacity delay-100',
                            {
                                'opacity-0': !loading,
                            }
                        )}
                    >
                        <CircularProgress size="14px" color="inherit" />
                    </div>
                    <SaveButton />
                </div>
            </nav>
        );
    }

    // 桌面端渲染（保持原有布局）
    return (
        <nav
            className="fixed bg-gray-50 z-10 p-2 flex items-center right-0"
        >
            <NavButtonGroup />
            <div className="flex-auto ml-4">
                {note && (
                    <Breadcrumbs
                        maxItems={2}
                        className="text-gray-800 leading-none"
                        aria-label="breadcrumb"
                    >
                        {getPaths(note)
                            .reverse()
                            .map((path) => (
                                <Tooltip key={path.id} title={path.title}>
                                    <div>
                                        <Link href={`/${path.id}`} shallow>
                                            <a className="title block hover:bg-gray-200 px-1 py-0.5 rounded text-sm truncate">
                                                {path.title}
                                            </a>
                                        </Link>
                                    </div>
                                </Tooltip>
                            ))}
                        <span>
                            <Tooltip title={note.title}>
                                <span
                                    className="title inline-block text-gray-600 text-sm truncate select-none align-middle"
                                    aria-current="page"
                                >
                                    {note.title}
                                </span>
                            </Tooltip>
                            <UpdatedAtDisplay className="inline-block ml-2" />
                            {!checkItemIsShown(note) && (
                                <Tooltip title={t('Show note in tree')}>
                                    <span>
                                        <EyeIcon
                                            width="20"
                                            className="inline-block cursor-pointer ml-1"
                                            onClick={handleClickOpenInTree}
                                        />
                                    </span>
                                </Tooltip>
                            )}
                        </span>
                    </Breadcrumbs>
                )}
                <style jsx>
                    {`
                        .title {
                            max-width: 120px;
                        }
                    `}
                </style>
            </div>
            <div
                className={classNames(
                    'flex mr-2 transition-opacity delay-100',
                    {
                        'opacity-0': !loading,
                    }
                )}
            >
                <CircularProgress size="14px" color="inherit" />
            </div>
            <SaveButton className="mr-2" />
            <HotkeyTooltip text={t('Share page')}>
                <IconButton
                    onClick={handleClickShare}
                    className="mr-2"
                    disabled={!note}
                    iconClassName={classNames({
                        'text-blue-500': note?.shared === NOTE_SHARED.PUBLIC,
                    })}
                    icon="Share"
                />
            </HotkeyTooltip>
            <HotkeyTooltip text={t('Editor width')}>
                <IconButton
                    icon="WidthSize"
                    className="mr-2"
                    onClick={handleClickEditorWidth}
                >
                </IconButton>
            </HotkeyTooltip>
            <HotkeyTooltip text={t('Settings')}>
                <IconButton
                    disabled={!note}
                    onClick={handleClickMenu}
                    icon="DotsHorizontal"
                />
            </HotkeyTooltip>
        </nav>
    );
};

export default NoteNav;
