import { FC } from 'react';
import useI18n from 'libs/web/hooks/use-i18n';
import PortalState from 'libs/web/state/portal';
import { Menu, MenuItem } from '@material-ui/core';
import { EDITOR_SIZE } from 'libs/shared/meta';
import UIState from 'libs/web/state/ui';

interface EditorWidthSelectItem {
    text: string;
    value: EDITOR_SIZE;
}

const EditorWidthSelect: FC = () => {
    const { t } = useI18n();
    const {
        editorWidthSelect: { close, anchor, data, visible },
    } = PortalState.useContainer();
    const {
        settings: { settings, updateSettings },
    } = UIState.useContainer();

    const items: Array<EditorWidthSelectItem> = [
        {
            text: t("Small (default)"),
            value: EDITOR_SIZE.SMALL,
        },
        {
            text: t("Large"),
            value: EDITOR_SIZE.LARGE
        },
        {
            text: t("As wide as possible"),
            value: EDITOR_SIZE.AS_WIDE_AS_POSSIBLE
        }
    ];

    const setTo = async (width: EDITOR_SIZE) => {
        close();
        try {
            // 更新全局设置，与设置页面保持一致
            await updateSettings({ editorsize: width });
            // 刷新页面以应用新的宽度设置
            window.location.reload();
        } catch (error) {
            console.error("Error whilst switching editor size", error);
        }
    };

    const editorWidth = settings.editorsize;

    return (
        <Menu
            anchorEl={anchor}
            open={visible}
            onClose={close}
            classes={{
                paper: 'bg-gray-200 text-gray-800',
            }}
        >
            {items.map((item) =>
                <MenuItem key={item.value} onClick={() => setTo(item.value)}>
                    <span className={`text-xs ${editorWidth == item.value ? 'font-bold' : ''}`}>
                        {item.text}
                    </span>
                </MenuItem>
            )}
        </Menu>
    );
};

export default EditorWidthSelect;