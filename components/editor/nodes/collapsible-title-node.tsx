/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { IS_CHROME } from '@lexical/utils';
import {
    $createParagraphNode,
    $isElementNode,
    DOMConversionMap,
    DOMConversionOutput,
    DOMExportOutput,
    EditorConfig,
    ElementNode,
    LexicalEditor,
    LexicalNode,
    RangeSelection,
    SerializedElementNode,
} from 'lexical';

import { $isCollapsibleContainerNode } from './collapsible-container-node';

export type SerializedCollapsibleTitleNode = SerializedElementNode;

export function $convertSummaryElement(
    domNode: HTMLElement,
): DOMConversionOutput | null {
    const node = $createCollapsibleTitleNode();
    return {
        node,
    };
}

export class CollapsibleTitleNode extends ElementNode {
    static getType(): string {
        return 'collapsible-title';
    }

    static clone(node: CollapsibleTitleNode): CollapsibleTitleNode {
        return new CollapsibleTitleNode(node.__key);
    }

    createDOM(config: EditorConfig, editor: LexicalEditor): HTMLElement {
        const dom = document.createElement('summary');
        dom.classList.add('Collapsible__title');

        // 创建图标元素 - 使用纯DOM而非React渲染
        const iconElement = document.createElement('span');
        iconElement.classList.add('Collapsible__icon');
        iconElement.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
        `;

        dom.appendChild(iconElement);

        if (IS_CHROME) {
            dom.addEventListener('click', () => {
                editor.update(() => {
                    const collapsibleContainer = this.getLatest().getParentOrThrow();
                    if (!$isCollapsibleContainerNode(collapsibleContainer)) {
                        throw new Error(
                            'Expected parent node to be a CollapsibleContainerNode',
                        );
                    }
                    collapsibleContainer.toggleOpen();
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
            summary: () => ({
                conversion: $convertSummaryElement,
                priority: 1,
            }),
        };
    }

    static importJSON(): CollapsibleTitleNode {
        return $createCollapsibleTitleNode();
    }

    exportDOM(): DOMExportOutput {
        const element = document.createElement('summary');
        element.classList.add('Collapsible__title');
        return { element };
    }

    exportJSON(): SerializedCollapsibleTitleNode {
        return {
            ...super.exportJSON(),
            type: 'collapsible-title',
            version: 1,
        };
    }

    insertNewAfter(_: RangeSelection, restoreSelection = true): ElementNode {
        const containerNode = this.getParentOrThrow();
        if (!$isCollapsibleContainerNode(containerNode)) {
            throw new Error(
                'CollapsibleTitleNode expects to be child of CollapsibleContainerNode',
            );
        }

        if (containerNode.getOpen()) {
            const contentNode = this.getNextSibling();
            if (!contentNode || contentNode.getType() !== 'collapsible-content') {
                throw new Error(
                    'CollapsibleTitleNode expects to have CollapsibleContentNode sibling',
                );
            }

            const firstChild = contentNode.getFirstChild();
            if ($isElementNode(firstChild)) {
                return firstChild;
            } else {
                const paragraph = $createParagraphNode();
                (contentNode as ElementNode).append(paragraph);
                return paragraph;
            }
        } else {
            const paragraph = $createParagraphNode();
            containerNode.insertAfter(paragraph, restoreSelection);
            return paragraph;
        }
    }

    collapseAtStart(): true {
        this.getParentOrThrow().insertBefore(this);
        return true;
    }

    insertNewAfter(): null {
        return null;
    }

    canIndent(): false {
        return false;
    }
}

export function $createCollapsibleTitleNode(): CollapsibleTitleNode {
    return new CollapsibleTitleNode();
}

export function $isCollapsibleTitleNode(
    node: LexicalNode | null | undefined,
): node is CollapsibleTitleNode {
    return node instanceof CollapsibleTitleNode;
}
