/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { IS_CHROME } from '@lexical/utils';
import {
    DOMConversionMap,
    DOMConversionOutput,
    DOMExportOutput,
    EditorConfig,
    ElementNode,
    LexicalEditor,
    LexicalNode,
    SerializedElementNode,
} from 'lexical';

import { $isCollapsibleContainerNode } from './collapsible-container-node';

function setDomHiddenUntilFound(dom: HTMLElement): void {
    // @ts-ignore
    dom.hidden = 'until-found';
}

function domOnBeforeMatch(
    dom: HTMLElement,
    callback: () => void,
): () => void {
    // @ts-ignore
    const onBeforeMatch = (event: Event) => {
        if (event.target === dom) {
            callback();
        }
    };
    // @ts-ignore
    dom.addEventListener('beforematch', onBeforeMatch);
    return () => {
        // @ts-ignore
        dom.removeEventListener('beforematch', onBeforeMatch);
    };
}

type SerializedCollapsibleContentNode = SerializedElementNode;

export function $convertCollapsibleContentElement(
    domNode: HTMLElement,
): DOMConversionOutput | null {
    const node = $createCollapsibleContentNode();
    return {
        node,
    };
}

export class CollapsibleContentNode extends ElementNode {
    static getType(): string {
        return 'collapsible-content';
    }

    static clone(node: CollapsibleContentNode): CollapsibleContentNode {
        return new CollapsibleContentNode(node.__key);
    }

    createDOM(config: EditorConfig, editor: LexicalEditor): HTMLElement {
        const dom = document.createElement('div');
        dom.classList.add('Collapsible__content');
        if (IS_CHROME) {
            editor.getEditorState().read(() => {
                const containerNode = this.getParentOrThrow();
                if (!$isCollapsibleContainerNode(containerNode)) {
                    throw new Error(
                        'Expected parent node to be a CollapsibleContainerNode',
                    );
                }
                if (!containerNode.__open) {
                    setDomHiddenUntilFound(dom);
                }
            });
            domOnBeforeMatch(dom, () => {
                editor.update(() => {
                    const containerNode = this.getParentOrThrow().getLatest();
                    if (!$isCollapsibleContainerNode(containerNode)) {
                        throw new Error(
                            'Expected parent node to be a CollapsibleContainerNode',
                        );
                    }
                    if (!containerNode.__open) {
                        containerNode.toggleOpen();
                    }
                });
            });
        }
        return dom;
    }

    updateDOM(): boolean {
        return false;
    }

    static importDOM(): DOMConversionMap | null {
        return {
            div: (domNode: HTMLElement) => {
                if (domNode.classList.contains('collapsible-content')) {
                    return {
                        conversion: $convertCollapsibleContentElement,
                        priority: 2,
                    };
                }
                return null;
            },
        };
    }

    static importJSON(
        serializedNode: SerializedCollapsibleContentNode,
    ): CollapsibleContentNode {
        return $createCollapsibleContentNode().updateFromJSON(serializedNode);
    }

    exportDOM(): DOMExportOutput {
        const element = document.createElement('div');
        element.classList.add('Collapsible__content');
        element.setAttribute('data-lexical-collapsible-content', 'true');
        return { element };
    }

    exportJSON(): SerializedCollapsibleContentNode {
        return {
            ...super.exportJSON(),
            type: 'collapsible-content',
            version: 1,
        };
    }

    isShadowRoot(): boolean {
        return true;
    }

    insertNewAfter(): null {
        return null;
    }

    canIndent(): false {
        return false;
    }
}

export function $createCollapsibleContentNode(): CollapsibleContentNode {
    return new CollapsibleContentNode();
}

export function $isCollapsibleContentNode(
    node: LexicalNode | null | undefined,
): node is CollapsibleContentNode {
    return node instanceof CollapsibleContentNode;
}
