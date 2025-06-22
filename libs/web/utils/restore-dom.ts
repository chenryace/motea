/**
 * RestoreDOM - 现代IME处理的核心机制
 * 基于Slate社区最佳实践，不依赖延时策略
 * 
 * 原理：
 * 1. 监听DOM变化（MutationObserver）
 * 2. 恢复被浏览器默认行为修改的DOM
 * 3. 执行编辑器的数据模型更新
 * 4. 让编辑器重新渲染正确的DOM
 */

export interface RestoreDOMOptions {
    /**
     * 是否启用调试模式
     */
    debug?: boolean;

    /**
     * 超时时间（毫秒），防止observer永远不断开
     */
    timeout?: number;

    /**
     * 只恢复特定类型的变化
     */
    restoreTypes?: ('childList' | 'characterData' | 'attributes')[];

    /**
     * 排除特定的节点
     */
    excludeNodes?: (node: Node) => boolean;

    /**
     * 只在特定条件下恢复
     */
    shouldRestore?: (mutation: MutationRecord) => boolean;

    /**
     * 是否跳过characterData类型的恢复（推荐用于IME）
     */
    skipCharacterData?: boolean;
}

/**
 * RestoreDOM 函数
 * 
 * @param element - 要监听的DOM元素（通常是编辑器容器）
 * @param execute - DOM恢复后要执行的函数（通常是编辑器数据更新）
 * @param options - 配置选项
 */
export function restoreDOM(
    element: Element,
    execute: () => void,
    options: RestoreDOMOptions = {}
): void {
    const {
        debug = false,
        timeout = 100,
        restoreTypes = ['childList'],
        excludeNodes,
        shouldRestore,
        skipCharacterData = true
    } = options;

    if (debug) {
        console.log('🔄 RestoreDOM: Starting DOM restoration cycle', { restoreTypes, skipCharacterData });
    }

    let observer: MutationObserver | null = new MutationObserver((mutations) => {
        if (debug) {
            console.log('🔄 RestoreDOM: Detected DOM mutations:', mutations.length);
        }

        // 筛选需要恢复的mutations
        const filteredMutations = mutations.filter(mutation => {
            // 检查类型筛选
            if (!restoreTypes.includes(mutation.type as any)) {
                if (debug) {
                    console.log('🔄 RestoreDOM: Skipping mutation type:', mutation.type);
                }
                return false;
            }

            // 跳过characterData类型（用于IME兼容性）
            if (skipCharacterData && mutation.type === 'characterData') {
                if (debug) {
                    console.log('🔄 RestoreDOM: Skipping characterData mutation for IME compatibility');
                }
                return false;
            }

            // 自定义筛选逻辑
            if (shouldRestore && !shouldRestore(mutation)) {
                if (debug) {
                    console.log('🔄 RestoreDOM: Custom filter rejected mutation');
                }
                return false;
            }

            return true;
        });

        if (filteredMutations.length === 0) {
            if (debug) {
                console.log('🔄 RestoreDOM: No mutations to restore, executing callback directly');
            }
            disconnect();
            execute();
            return;
        }

        // 反向处理筛选后的mutations，确保正确恢复
        filteredMutations.reverse().forEach((mutation) => {
            // 恢复被删除的节点
            mutation.removedNodes.forEach((node) => {
                // 检查节点排除规则
                if (excludeNodes && excludeNodes(node)) {
                    if (debug) {
                        console.log('🔄 RestoreDOM: Excluding removed node:', node);
                    }
                    return;
                }

                if (debug) {
                    console.log('🔄 RestoreDOM: Restoring removed node:', node);
                }

                try {
                    mutation.target.insertBefore(node, mutation.nextSibling);
                } catch (error) {
                    if (debug) {
                        console.warn('🔄 RestoreDOM: Failed to restore removed node:', error);
                    }
                }
            });

            // 移除被添加的节点
            mutation.addedNodes.forEach((node) => {
                // 检查节点排除规则
                if (excludeNodes && excludeNodes(node)) {
                    if (debug) {
                        console.log('🔄 RestoreDOM: Excluding added node:', node);
                    }
                    return;
                }

                if (debug) {
                    console.log('🔄 RestoreDOM: Removing added node:', node);
                }

                try {
                    if (node.parentNode) {
                        node.parentNode.removeChild(node);
                    }
                } catch (error) {
                    if (debug) {
                        console.warn('🔄 RestoreDOM: Failed to remove added node:', error);
                    }
                }
            });
        });

        // 断开observer并执行回调
        disconnect();
        execute();
    });

    const disconnect = () => {
        if (observer) {
            observer.disconnect();
            observer = null;
            if (debug) {
                console.log('🔄 RestoreDOM: Observer disconnected');
            }
        }
    };

    // 开始监听DOM变化 - 根据配置动态设置监听选项
    const observeOptions: MutationObserverInit = {
        subtree: true,
        childList: restoreTypes.includes('childList'),
        characterData: restoreTypes.includes('characterData'),
        attributes: restoreTypes.includes('attributes'),
        characterDataOldValue: restoreTypes.includes('characterData'),
        attributeOldValue: restoreTypes.includes('attributes')
    };

    observer.observe(element, observeOptions);

    // 设置超时保护，防止observer永远不断开
    setTimeout(() => {
        if (observer) {
            if (debug) {
                console.log('🔄 RestoreDOM: Timeout reached, executing without mutations');
            }
            disconnect();
            execute();
        }
    }, timeout);
}

/**
 * 检查是否需要使用RestoreDOM
 * 主要用于Android设备和某些IME场景
 */
export function shouldUseRestoreDOM(): boolean {
    if (typeof window === 'undefined') return false;
    
    const userAgent = window.navigator.userAgent;
    
    // Android设备
    const isAndroid = /Android/i.test(userAgent);
    
    // 某些移动设备
    const isMobile = /Mobile|Tablet/i.test(userAgent);
    
    // 可以根据需要添加更多检测条件
    return isAndroid || isMobile;
}

/**
 * 获取编辑器元素
 * 用于RestoreDOM的目标元素查找
 */
export function getEditableElement(element: Element): Element | null {
    // 查找contenteditable元素
    if (element.getAttribute('contenteditable') === 'true') {
        return element;
    }
    
    // 查找子元素中的contenteditable
    const editable = element.querySelector('[contenteditable="true"]');
    if (editable) {
        return editable;
    }
    
    // 查找ProseMirror编辑器
    const prosemirror = element.querySelector('.ProseMirror');
    if (prosemirror) {
        return prosemirror;
    }
    
    return null;
}
