import { NoteModel } from 'libs/shared/note';
import Link from 'next/link';
import { FC, ReactText, MouseEvent, useCallback, useMemo, useState } from 'react';
import classNames from 'classnames';
import { useRouter } from 'next/router';
import HotkeyTooltip from 'components/hotkey-tooltip';
import IconButton from 'components/icon-button';
import NoteTreeState from 'libs/web/state/tree';
import { Skeleton } from '@material-ui/lab';
import PortalState from 'libs/web/state/portal';
import useI18n from 'libs/web/hooks/use-i18n';
import emojiRegex from 'emoji-regex';

const TextSkeleton = () => (
    <Skeleton
        width={80}
        variant="text"
        animation="wave"
        classes={{
            root: 'bg-gray-300',
        }}
    />
);

const SidebarListItem: FC<{
    item: NoteModel;
    innerRef: (el: HTMLElement | null) => void;
    onExpand: (itemId?: ReactText) => void;
    onCollapse: (itemId?: ReactText) => void;
    isExpanded: boolean;
    hasChildren: boolean;
    snapshot: {
        isDragging: boolean;
    };
    style?: {
        paddingLeft: number;
    };
}> = ({
    item,
    innerRef,
    onExpand,
    onCollapse,
    isExpanded,
    snapshot,
    hasChildren,
    ...attrs
}) => {
    const { t } = useI18n();
    const router = useRouter();
    const { query } = router;
    const { mutateItem, initLoaded, genNewId } = NoteTreeState.useContainer();
    const {
        menu: { open, setData, setAnchor },
    } = PortalState.useContainer();

    // 添加hover状态来控制按钮显示
    const [isHovered, setIsHovered] = useState(false);

    // 提取图标选择逻辑
    const getIconType = useCallback(() => {
        if (hasChildren || isExpanded) return 'ChevronRight';
        if (item.title) return 'DocumentText';
        return 'Document';
    }, [hasChildren, isExpanded, item.title]);

    const onAddNote = useCallback(
        (e: MouseEvent) => {
            e.preventDefault();
            const newId = genNewId();
            router.push(`/${newId}?new&pid=` + item.id, undefined, { shallow: true })
                ?.catch((v) => console.error('Error whilst pushing to router: %O', v));
            mutateItem(item.id, {
                isExpanded: true,
            })
                ?.catch((v) => console.error('Error whilst mutating item: %O', v));
        },
        [item.id, mutateItem, genNewId]
    );

    const handleClickMenu = useCallback(
        (event: MouseEvent) => {
            event.preventDefault();
            setAnchor(event.target as Element);
            open();
            setData(item);
        },
        [item, open, setAnchor, setData]
    );

    const handleClickIcon = useCallback(
        (e: MouseEvent) => {
            e.preventDefault();
            isExpanded ? onCollapse(item.id) : onExpand(item.id);
        },
        [item.id, isExpanded, onCollapse, onExpand]
    );

    const emoji = useMemo(() => {
        const emoji = item.title?.match(emojiRegex());
        if (emoji?.length === 1) return emoji[0];
        return undefined;
    }, [item.title]);

    // 提取标题显示逻辑（必须在emoji声明之后）
    const getDisplayTitle = useCallback(() => {
        if (!initLoaded) return <TextSkeleton />;

        const baseTitle = emoji
            ? item.title.replace(emoji, '').trimLeft()
            : item.title;

        return baseTitle || t('Untitled');
    }, [emoji, item.title, initLoaded, t]);

    return (
        <>
            <div
                {...attrs}
                ref={innerRef}
                className={classNames(
                    'flex items-center group pr-2 overflow-hidden hover:bg-gray-300 text-gray-700',
                    {
                        'shadow bg-gray-300': snapshot.isDragging,
                        'bg-gray-200': query.id === item.id,
                    }
                )}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <Link href={`/${item.id}`} shallow>
                    <a className="flex flex-1 items-center truncate px-2 py-1.5">
                        {emoji ? (
                            <span
                                onClick={handleClickIcon}
                                className={classNames(
                                    'block p-0.5 cursor-pointer w-7 h-7 md:w-6 md:h-6 rounded hover:bg-gray-400 mr-1 text-center'
                                )}
                            >
                                {emoji}
                            </span>
                        ) : (
                            <IconButton
                                className="mr-1"
                                icon={getIconType()}
                                iconClassName={classNames(
                                    'transition-transform transform',
                                    {
                                        'rotate-90': isExpanded,
                                    }
                                )}
                                onClick={handleClickIcon}
                            ></IconButton>
                        )}

                        <span className="flex-1 truncate" dir="auto">
                            {getDisplayTitle()}
                        </span>
                    </a>
                </Link>

                {isHovered && (
                    <>
                        <HotkeyTooltip text={t('Remove, Copy Link, etc')}>
                            <IconButton
                                icon="DotsHorizontal"
                                onClick={handleClickMenu}
                            ></IconButton>
                        </HotkeyTooltip>

                        <HotkeyTooltip text={t('Add a page inside')}>
                            <IconButton
                                icon="Plus"
                                onClick={onAddNote}
                                className="ml-1"
                            ></IconButton>
                        </HotkeyTooltip>
                    </>
                )}
            </div>

            {!hasChildren && isExpanded && (
                <div
                    className="ml-9 py-1.5 text-gray-400 select-none"
                    style={{
                        paddingLeft: attrs.style?.paddingLeft,
                    }}
                >
                    {initLoaded ? t('No notes inside') : <TextSkeleton />}
                </div>
            )}
        </>
    );
};

export default SidebarListItem;
