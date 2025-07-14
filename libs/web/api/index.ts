/**
 * API Index
 * Exports all API modules
 */

import * as note from './note';
import * as settings from './settings';
import * as trash from './trash';
import * as tree from './tree';

export const api = {
    note,
    settings,
    trash,
    tree,
};

export default api;
