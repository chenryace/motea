import SidebarTool from 'components/sidebar/sidebar-tool';
import SideBarList from 'components/sidebar/sidebar-list';
import UIState from 'libs/web/state/ui';
import { FC, useEffect } from 'react';
import NoteTreeState from 'libs/web/state/tree';

const Sidebar: FC = () => {
    const { ua } = UIState.useContainer();
    const { initTree } = NoteTreeState.useContainer();

    useEffect(() => {
        initTree()
            ?.catch((v) => console.error('Error whilst initialising tree: %O', v));
    }, [initTree]);

    return ua?.isMobileOnly ? <MobileSidebar /> : <BrowserSidebar />;
};

const BrowserSidebar: FC = () => {
    const {
        sidebar,
        split: { sizes },
    } = UIState.useContainer();

    return (
        <section
            className="flex h-full fixed left-0"
            style={{
                width: `calc(${sizes[0]}% - 5px)`,
            }}
        >
            <SidebarTool />
            {sidebar.isFold ? null : <SideBarList />}
        </section>
    );
};

const MobileSidebar: FC = () => {
    const {
        sidebar: { isFold },
    } = UIState.useContainer();

    return (
        <section className="flex h-full w-full">
            <SidebarTool />
            {!isFold && <SideBarList />}
        </section>
    );
};

export default Sidebar;
