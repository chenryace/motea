/**
 * 中文输入法测试页面
 * 用于测试和验证中文输入法的改进效果
 */

import { useState, useCallback } from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import TiptapEditor from 'components/editor/tiptap-editor';
import { useCompositionState } from 'libs/web/utils/simple-ime-fix';

const IMETestPage: NextPage = () => {
    const [content, setContent] = useState(`# 中文输入法和冲突测试

请在下面测试中文输入和潜在冲突：

## 中文输入法测试

1. **基础中文输入**：尝试输入一些中文字符，如"你好世界"
2. **拼音输入**：测试拼音输入法，如输入"nihao"然后选择汉字
3. **快速输入**：快速连续输入中文，观察是否有打断现象
4. **混合输入**：中英文混合输入测试
5. **标点符号**：中文标点符号输入测试，如"，。？！"

## 冲突测试

6. **列表 + 中文输入**：
   - 输入 "- " 创建列表项
   - 在列表项中输入中文
   - 在空列表项中按 Enter（应该退出列表）

7. **标题 + 中文输入**：
   - 输入 "# " 创建标题
   - 在标题中输入中文

8. **图片 + 中文输入**：
   - 输入 "![中文描述](https://example.com/image.jpg) "
   - 观察是否正确转换为图片

9. **快捷键测试**：
   - 在中文输入过程中按 Enter、Backspace 等键
   - 观察是否被正确处理

---

开始测试：

`);

    const [saveCount, setSaveCount] = useState(0);
    const [eventLog, setEventLog] = useState<Array<{type: string, data: any, timestamp: number}>>([]);
    const isComposing = useCompositionState();

    const handleChange = useCallback((getValue: () => string) => {
        const newContent = getValue();
        setContent(newContent);
        setSaveCount(prev => prev + 1);

        // 记录编辑器变化事件
        setEventLog(prev => [...prev.slice(-20), {
            type: 'editor-change',
            data: {
                contentLength: newContent.length,
                isComposing,
                timestamp: Date.now()
            },
            timestamp: Date.now()
        }]);
    }, [isComposing]);

    return (
        <>
            <Head>
                <title>中文输入法测试 - Motea</title>
            </Head>
            
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-4xl mx-auto">
                        {/* 状态指示器 */}
                        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                                输入状态监控
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div className="flex items-center space-x-2">
                                    <div 
                                        className={`w-3 h-3 rounded-full ${
                                            isComposing ? 'bg-red-500' : 'bg-green-500'
                                        }`}
                                    />
                                    <span className="text-gray-700 dark:text-gray-300">
                                        Composition: {isComposing ? '进行中' : '空闲'}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                                    <span className="text-gray-700 dark:text-gray-300">
                                        保存次数: {saveCount}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                                    <span className="text-gray-700 dark:text-gray-300">
                                        字符数: {content.length}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 编辑器 */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                            <div className="p-6">
                                <TiptapEditor
                                    value={content}
                                    onChange={handleChange}
                                    className="min-h-96"
                                />
                            </div>
                        </div>

                        {/* 测试指南 */}
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <h3 className="text-lg font-semibold mb-3 text-blue-900 dark:text-blue-100">
                                测试指南
                            </h3>
                            <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                                <li>• 使用中文输入法（如搜狗、百度、微软拼音等）进行测试</li>
                                <li>• 观察上方的 "Composition" 状态，红色表示正在输入中文</li>
                                <li>• 在输入过程中，编辑器不应该中断或跳转</li>
                                <li>• 保存次数应该在输入完成后才增加，而不是在输入过程中频繁增加</li>
                                <li>• 如果发现问题，请记录具体的输入法和操作步骤</li>
                            </ul>
                        </div>

                        {/* 事件日志 */}
                        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                            <h3 className="text-lg font-semibold mb-3 text-yellow-900 dark:text-yellow-100">
                                事件日志 (最近20条)
                            </h3>
                            <div className="max-h-40 overflow-y-auto text-xs font-mono text-yellow-800 dark:text-yellow-200">
                                {eventLog.length === 0 ? (
                                    <div>暂无事件记录</div>
                                ) : (
                                    eventLog.slice(-10).map((event, index) => (
                                        <div key={index} className="mb-1">
                                            <span className="text-gray-500">
                                                {new Date(event.timestamp).toLocaleTimeString()}
                                            </span>
                                            {' '}
                                            <span className="font-semibold">{event.type}</span>
                                            {' '}
                                            <span>{JSON.stringify(event.data)}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* 调试信息 */}
                        {process.env.NODE_ENV === 'development' && (
                            <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                                    调试信息
                                </h3>
                                <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
                                    <div>当前内容长度: {content.length}</div>
                                    <div>是否正在输入: {isComposing.toString()}</div>
                                    <div>保存计数: {saveCount}</div>
                                    <div>事件总数: {eventLog.length}</div>
                                    <div>用户代理: {typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A'}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default IMETestPage;
