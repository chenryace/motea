import LayoutMain from 'components/layout/layout-main';
import { useSession } from 'libs/server/middlewares/session';
import { applySettings } from 'libs/server/middlewares/settings';
import { applyAuth, applyRedirectLogin } from 'libs/server/middlewares/auth';
import { applyTree } from 'libs/server/middlewares/tree';
import TiptapEditContainer from 'components/container/tiptap-edit-container';
import { applyCsrf } from 'libs/server/middlewares/csrf';
import { ssr, SSRContext, ServerProps } from 'libs/server/connect';
import { applyUA } from 'libs/server/middlewares/ua';
import { applyReset } from 'libs/server/middlewares/reset';

export default function TiptapTestPage({
    tree,
    note,
    isLoggedIn,
}: ServerProps) {
    if (isLoggedIn) {
        return (
            <LayoutMain tree={tree} note={note}>
                <TiptapEditContainer />
            </LayoutMain>
        );
    }

    return (
        <div>
            <h1>Please log in to test Tiptap editor</h1>
        </div>
    );
}

export const getServerSideProps = async (
    ctx: SSRContext
) => {
    await ssr()
        .use(useSession)
        .use(applyAuth)
        .use(applyTree)
        .use(applyRedirectLogin(ctx.resolvedUrl))
        .use(applyReset)
        .use(applySettings)
        .use(applyCsrf)
        .use(applyUA)
        .run(ctx.req, ctx.res);

    return {
        props: ctx.req.props,
        redirect: ctx.req.redirect,
    };
};
