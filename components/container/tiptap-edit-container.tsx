import { FC, useEffect } from 'react';
import { useRouter } from 'next/router';
import { has } from 'lodash';
import TiptapMainEditor from 'components/editor/tiptap-main-editor';
import TiptapEditorState from 'libs/web/state/tiptap-editor';
import NoteState from 'libs/web/state/note';
import NoteTreeState from 'libs/web/state/tree';
import UIState from 'libs/web/state/ui';
import { useToast } from 'libs/web/hooks/use-toast';
import useAutoSaveOnLeave from 'libs/web/hooks/use-auto-save-on-leave';
import noteCache from 'libs/web/cache/note';
import NoteNav from 'components/note-nav';
import DeleteAlert from 'components/editor/delete-alert';
// import { genNewId } from 'libs/shared/id';

const TiptapEditContainer: FC = () => {
    const router = useRouter();
    const { id, pid } = router.query;
    const isNew = has(router.query, 'new');
    const { initNote, findOrCreateNote, fetchNote } = NoteState.useContainer();
    const { loadNoteOnDemand } = NoteTreeState.useContainer();
    const {
        settings: { settings },
    } = UIState.useContainer();
    const toast = useToast();

    // 启用自动保存功能
    useAutoSaveOnLeave({
        enabled: true,
    });

    useEffect(() => {
        const initializeEditor = async () => {
            if (!id || Array.isArray(id)) return;

            if (isNew) {
                // 检查是否是每日笔记（通过daily参数）
                const dailyDate = router.query.daily as string;

                if (dailyDate && /^\d{4}-\d{1,2}-\d{1,2}$/.test(dailyDate)) {
                    // 这是每日笔记，使用日期作为标题，并添加特殊标记
                    initNote({
                        id,
                        title: dailyDate,
                        content: '\n',
                        pid: settings.daily_root_id,
                        isDailyNote: true, // 添加每日笔记标记
                    });
                } else {
                    // 普通新笔记逻辑
                    const cachedNote = await noteCache.getItem(id);
                    if (cachedNote) {
                        initNote(cachedNote);
                        return;
                    }

                    // 借鉴旧项目：直接初始化本地笔记，简单有效
                    initNote({
                        id,
                        title: '',
                        content: '\n',
                        pid: (typeof pid === 'string' ? pid : undefined) || 'root'
                    });
                }
            } else {
                // 现有笔记逻辑 - 优先使用按需加载（支持缓存验证）
                try {
                    // 首先尝试按需加载（会检查缓存和树结构中的updated_at）
                    const noteData = await loadNoteOnDemand(id);

                    if (noteData) {
                        // 按需加载成功，初始化编辑器
                        initNote(noteData);
                    } else {
                        // 按需加载失败，回退到直接API调用
                        console.log('🔄 Fallback to direct API call for note:', id);
                        await fetchNote(id);
                    }
                } catch (error) {
                    console.error('Failed to load note:', error);
                    toast('Failed to load note', 'error');
                }
            }
        };

        initializeEditor();
    }, [
        id,
        isNew,
        pid,
        router.query.daily,
        settings.daily_root_id,
        initNote,
        findOrCreateNote,
        fetchNote,
        loadNoteOnDemand,
        toast,
    ]);

    if (!id || Array.isArray(id)) {
        return <div>Loading...</div>;
    }

    return (
        <TiptapEditorState.Provider>
            <NoteNav />
            <DeleteAlert />
            <section className="h-full">
                <TiptapMainEditor readOnly={false} />
            </section>
        </TiptapEditorState.Provider>
    );
};

export default TiptapEditContainer;
