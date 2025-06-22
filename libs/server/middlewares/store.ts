import { createStore } from 'libs/server/store';
import { createTreeStore } from 'libs/server/store/tree-factory';
import { ApiRequest, SSRMiddleware } from '../connect';

export const useStore: SSRMiddleware = async (req, _res, next) => {
    applyStore(req);

    return next();
};

export function applyStore(req: ApiRequest) {
    const store = createStore();
    const treeStore = createTreeStore(store);

    req.state = {
        ...req.state,
        store,
        treeStore,
    };
}
