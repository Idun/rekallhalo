import React, { useState, useEffect } from 'react';
import { PlotChapter, GameContext, ScheduledEvent, generateUUID } from '../../../types';
import { AddEventModal } from '../../modals/GameplayModals';
import { ChapterEditor } from './ChapterEditor';
import { PlotListView } from './PlotListView';
import { PlotGraphView, FloatingNode } from './PlotGraphView';

interface PlotBlueprintModalProps {
    isOpen: boolean;
    onClose: () => void;
    context: GameContext;
    setContext: React.Dispatch<React.SetStateAction<GameContext>>;
    initialChapterId?: string | null;
    initialViewMode?: 'list' | 'graph';
}

interface HistoryState {
    chapters: PlotChapter[];
    floatingNodes: FloatingNode[];
}

export const PlotBlueprintModal: React.FC<PlotBlueprintModalProps> = ({ 
    isOpen, onClose, context, setContext, initialChapterId, initialViewMode 
}) => {
    const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
    const [showEventModal, setShowEventModal] = useState(false);
    const [eventToEdit, setEventToEdit] = useState<ScheduledEvent | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
    
    // Bulk Mode State (List only)
    const [isBulkMode, setIsBulkMode] = useState(false);

    // Graph View State
    const [nodePositions, setNodePositions] = useState<Record<string, {x: number, y: number}>>({});
    // Lifted Floating Nodes State
    const [floatingNodes, setFloatingNodes] = useState<FloatingNode[]>([]);
    // Track where to create a floating event node after the modal closes
    const [pendingGraphEventCoords, setPendingGraphEventCoords] = useState<{x: number, y: number} | null>(null);

    // Undo History State
    const [historyStack, setHistoryStack] = useState<HistoryState[]>([]);

    const chapters = context.plotBlueprint || [];
    const characters = context.supportingCharacters || [];
    const events = context.scheduledEvents || [];

    // Helper to push current state to history before modification
    const pushHistory = () => {
        setHistoryStack(prev => [...prev, { chapters, floatingNodes }]);
    };

    // Raw update (no history)
    const setChapters = (val: PlotChapter[]) => {
        setContext(prev => ({ ...prev, plotBlueprint: val }));
    };

    // Update with history snapshot (for discrete actions like drag-drop, add, delete)
    const setChaptersWithUndo = (val: PlotChapter[]) => {
        pushHistory();
        setContext(prev => ({ ...prev, plotBlueprint: val }));
    };

    const handleUndo = () => {
        if (historyStack.length === 0) return;
        const prevState = historyStack[historyStack.length - 1];
        setHistoryStack(prev => prev.slice(0, -1));
        setChapters(prevState.chapters);
        setFloatingNodes(prevState.floatingNodes);
    };

    // Global Undo Listener
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                // Ignore if typing in an input
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
                
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, historyStack, chapters, floatingNodes]);

    // Sync initial chapter and view mode
    useEffect(() => {
        if (isOpen) {
            if (initialChapterId) setActiveChapterId(initialChapterId);
            else setActiveChapterId(null);
            
            if (initialViewMode) setViewMode(initialViewMode);
        }
    }, [isOpen, initialChapterId, initialViewMode]);

    // Initial positioning for graph nodes
    useEffect(() => {
        if (isOpen && viewMode === 'graph') {
            setNodePositions(prev => {
                const newPositions = { ...prev };
                let hasChanges = false;
                
                chapters.forEach((c, i) => {
                    if (!newPositions[c.id]) {
                        // Default layout: Horizontal line with some organic jitter
                        newPositions[c.id] = { 
                            x: 100 + (i * 280), 
                            y: 300 + (Math.sin(i) * 50) 
                        };
                        hasChanges = true;
                    }
                });
                
                return hasChanges ? newPositions : prev;
            });
        }
    }, [isOpen, viewMode, chapters.length]);

    // Exit bulk mode when switching views
    useEffect(() => {
        if (viewMode === 'graph') {
            setIsBulkMode(false);
        }
    }, [viewMode]);

    if (!isOpen) return null;

    // --- CRUD Logic ---

    const handleAddChapter = () => {
        const newChapter: PlotChapter = {
            id: generateUUID(),
            title: `第 ${chapters.length + 1} 章`,
            targetWordCount: 3000,
            summary: '',
            keyCharacters: [],
            keyEvents: '',
            pacing: 'standard',
            status: 'pending',
            trackedStats: { currentWordCount: 0, eventsTriggered: 0, interactionsCount: 0 },
            prerequisites: []
        };
        setChaptersWithUndo([...chapters, newChapter]);
        setActiveChapterId(newChapter.id);
        
        if (viewMode === 'graph') {
            const lastChapter = chapters[chapters.length - 1];
            const lastPos = lastChapter ? nodePositions[lastChapter.id] : { x: 0, y: 300 };
            setNodePositions(prev => ({
                ...prev,
                [newChapter.id]: { x: (lastPos?.x || 0) + 280, y: lastPos?.y || 300 }
            }));
        }
        
        if (searchTerm) setSearchTerm('');
    };

    const handleDeleteChapter = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setChaptersWithUndo(chapters.filter(c => c.id !== id));
        if (activeChapterId === id) setActiveChapterId(null);
        setNodePositions(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const updateChapter = (id: string, field: keyof PlotChapter, value: any) => {
        setChapters(chapters.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const updateCompletionCriteria = (id: string, field: 'minKeyEvents' | 'minInteractions', value: number) => {
        setChapters(chapters.map(c => {
            if (c.id !== id) return c;
            const newCriteria = { ...(c.completionCriteria || {}) };
            newCriteria[field] = value;
            return { ...c, completionCriteria: newCriteria };
        }));
    };

    const toggleCharacter = (chapterId: string, charName: string) => {
        const chapter = chapters.find(c => c.id === chapterId);
        if (!chapter) return;
        
        let newChars = chapter.keyCharacters || [];
        if (newChars.includes(charName)) {
            newChars = newChars.filter(n => n !== charName);
        } else {
            newChars = [...newChars, charName];
        }
        // Discrete action, use Undo
        const updatedChapters = chapters.map(c => c.id === chapterId ? { ...c, keyCharacters: newChars } : c);
        setChaptersWithUndo(updatedChapters);
    };

    const addPrerequisite = (chapterId: string, prereq: string) => {
        const chapter = chapters.find(c => c.id === chapterId);
        if (!chapter || !prereq.trim()) return;
        const currentPrereqs = chapter.prerequisites || [];
        if (!currentPrereqs.includes(prereq.trim())) {
            const updatedChapters = chapters.map(c => c.id === chapterId ? { ...c, prerequisites: [...currentPrereqs, prereq.trim()] } : c);
            setChaptersWithUndo(updatedChapters);
        }
    };

    const removePrerequisite = (chapterId: string, prereq: string) => {
        const chapter = chapters.find(c => c.id === chapterId);
        if (!chapter) return;
        const currentPrereqs = chapter.prerequisites || [];
        const updatedChapters = chapters.map(c => c.id === chapterId ? { ...c, prerequisites: currentPrereqs.filter(p => p !== prereq) } : c);
        setChaptersWithUndo(updatedChapters);
    };

    const handleResetLayout = () => {
        const newPositions: Record<string, {x: number, y: number}> = {};
        chapters.forEach((c, i) => {
            newPositions[c.id] = { x: 100 + (i * 280), y: 300 + (Math.sin(i) * 50) };
        });
        setNodePositions(newPositions);
    };

    // --- Copy Logic for Graph View ---
    const handleCopyAttachedItem = (targetId: string, item: any) => {
        const targetChapter = chapters.find(c => c.id === targetId);
        if (!targetChapter) return;

        pushHistory(); // Save state

        const add = (chap: PlotChapter) => {
            let newChap = { ...chap };
            if (item.field === 'summary') {
                newChap.summary = newChap.summary ? (newChap.summary + '\n' + item.value) : item.value;
            } else if (item.field === 'keyEvents') {
                const arr = (newChap.keyEvents || "").split(/[;；]/).filter(s => s.trim());
                if (!arr.includes(item.value)) arr.push(item.value);
                newChap.keyEvents = arr.join('；');
            } else {
                const arr = [...(newChap[item.field] as string[] || [])];
                if (!arr.includes(item.value)) arr.push(item.value);
                // @ts-ignore
                newChap[item.field] = arr;
            }
            return newChap;
        };

        const updatedChapters = chapters.map(c => c.id === targetId ? add(c) : c);
        setChapters(updatedChapters);
    };

    // Event Management
    const handleAddEvent = (eventData: Omit<ScheduledEvent, 'id' | 'createdTurn' | 'status'>) => {
        const newEvent: ScheduledEvent = {
            ...eventData,
            id: generateUUID(),
            createdTurn: 0,
            status: 'pending'
        };
        setContext(prev => ({
            ...prev,
            scheduledEvents: [...(prev.scheduledEvents || []), newEvent]
        }));

        // If this was triggered from the Graph View, also create a floating node
        if (pendingGraphEventCoords) {
            const newNode: FloatingNode = {
                id: generateUUID(),
                type: 'scheduledEvent',
                label: '预设伏笔',
                data: { value: eventData.description },
                x: pendingGraphEventCoords.x,
                y: pendingGraphEventCoords.y
            };
            setFloatingNodes(prev => [...prev, newNode]);
            setPendingGraphEventCoords(null);
        }
    };

    const handleUpdateEvent = (updatedEvent: ScheduledEvent) => {
        setContext(prev => ({
            ...prev,
            scheduledEvents: (prev.scheduledEvents || []).map(e => e.id === updatedEvent.id ? updatedEvent : e)
        }));
    };

    const handleDeleteEvent = (id: string) => {
        setContext(prev => ({
            ...prev,
            scheduledEvents: (prev.scheduledEvents || []).filter(e => e.id !== id)
        }));
    };

    const openAddEvent = () => {
        setEventToEdit(null);
        setShowEventModal(true);
    };

    const openEditEvent = (event: ScheduledEvent) => {
        setEventToEdit(event);
        setShowEventModal(true);
    };

    // Callback from Graph View to open Add Event Modal at specific coords
    const handleRequestCreateEventNode = (x: number, y: number) => {
        setPendingGraphEventCoords({ x, y });
        setEventToEdit(null);
        setShowEventModal(true);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in-up">
            <div className="w-full h-full md:w-[85%] max-h-[75vh] min-h-[550px] max-w-6xl bg-stone-100 md:rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative">
                
                {viewMode === 'list' && !activeChapterId && (
                    <div className="absolute top-0 right-0 p-4 z-[120]">
                        <button onClick={onClose} className="bg-stone-200 hover:bg-red-100 text-stone-500 hover:text-red-500 rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl transition-colors shadow-sm">✕</button>
                    </div>
                )}

                {/* Left Panel: Grows to full width if viewMode is 'graph' */}
                <div className={`flex flex-col h-1/3 md:h-full overflow-hidden shrink-0 transition-all duration-300 ${viewMode === 'graph' ? 'w-full bg-stone-100' : 'w-full md:w-72 bg-stone-50 border-r border-stone-200 relative'}`}>
                    <div className={`p-5 border-b border-stone-200 bg-stone-100 flex justify-between items-center ${viewMode === 'graph' ? 'absolute top-0 left-0 right-0 z-[70] bg-white/90 backdrop-blur-sm shadow-sm' : ''}`}>
                        <div className="flex items-center">
                            <h3 className="text-lg font-bold text-cyan-800 tracking-widest uppercase flex items-center gap-2">
                                <span>剧情细纲</span>
                                {viewMode === 'graph' && <span className="text-[10px] bg-cyan-100 text-cyan-700 px-2 rounded-full">思维导图模式</span>}
                            </h3>
                            {viewMode === 'graph' && (
                                <span className="hidden md:inline-block text-[9px] text-gray-400 ml-4 font-normal bg-white/50 px-2 py-1 rounded border border-gray-100">
                                    右键新建卡片 | Ctrl+拖拽节点内卡片可复制
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {viewMode === 'graph' && (
                                <>
                                    {historyStack.length > 0 && (
                                        <button 
                                            onClick={handleUndo}
                                            className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 transition-colors border border-amber-300 font-bold"
                                            title="撤销上一步操作 (Ctrl+Z)"
                                        >
                                            ↶ 撤销
                                        </button>
                                    )}
                                    <button 
                                        onClick={handleResetLayout}
                                        className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200 transition-colors border border-gray-300"
                                        title="重置节点排列"
                                    >
                                        ↺ 重置布局
                                    </button>
                                </>
                            )}
                            {viewMode === 'list' && (
                                <button 
                                    onClick={() => { setIsBulkMode(!isBulkMode); setActiveChapterId(null); }}
                                    className={`text-[10px] px-2 py-1 rounded transition-colors border ${isBulkMode ? 'bg-indigo-100 text-indigo-700 border-indigo-200 font-bold' : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200'}`}
                                >
                                    {isBulkMode ? '完成管理' : '批量管理'}
                                </button>
                            )}
                            <button 
                                onClick={() => setViewMode(viewMode === 'list' ? 'graph' : 'list')}
                                className="text-[10px] bg-cyan-100 text-cyan-700 px-2 py-1 rounded hover:bg-cyan-200 transition-colors z-[70] relative border border-cyan-200"
                                title={viewMode === 'list' ? "切换至自由拖拽视图" : "切换至列表排序"}
                            >
                                {viewMode === 'list' ? '☊ 脑图视图' : '☰ 列表视图'}
                            </button>
                            {viewMode === 'graph' && (
                                 <button onClick={onClose} className="bg-stone-200 hover:bg-red-100 text-stone-500 hover:text-red-500 rounded px-3 py-1 font-bold transition-colors shadow-sm text-xs">退出</button>
                            )}
                        </div>
                    </div>
                    
                    {/* Search Bar - Only in List Mode */}
                    {viewMode === 'list' && !isBulkMode && (
                        <div className="px-4 py-3 bg-stone-50 border-b border-stone-200">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="搜索章节..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-white border border-stone-300 rounded-lg py-1.5 pl-8 pr-2 text-xs text-gray-700 outline-none focus:border-cyan-500 transition-all placeholder-gray-400"
                                />
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                                {searchTerm && (
                                    <button 
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    
                    <div className="flex-1 overflow-hidden relative">
                        {viewMode === 'list' ? (
                            <PlotListView 
                                chapters={chapters}
                                setChapters={setChaptersWithUndo} // Use Undo for list reordering too
                                activeChapterId={activeChapterId}
                                setActiveChapterId={setActiveChapterId}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                isBulkMode={isBulkMode}
                                setIsBulkMode={setIsBulkMode}
                                onAddChapter={handleAddChapter}
                                onDeleteChapter={handleDeleteChapter}
                            />
                        ) : (
                            <PlotGraphView 
                                chapters={chapters}
                                setChapters={setChaptersWithUndo} // Use Undo for graph drag-drop
                                activeChapterId={activeChapterId}
                                setActiveChapterId={setActiveChapterId}
                                nodePositions={nodePositions}
                                setNodePositions={setNodePositions}
                                onAddChapter={handleAddChapter}
                                onDeleteChapter={handleDeleteChapter}
                                onResetLayout={handleResetLayout}
                                floatingNodes={floatingNodes}
                                setFloatingNodes={setFloatingNodes}
                                characters={characters}
                                onRequestCreateEventNode={handleRequestCreateEventNode}
                                onSnapshot={pushHistory} // Snapshot callback for memo undo
                                onCopyAttachedItem={handleCopyAttachedItem}
                            />
                        )}
                    </div>
                </div>

                {/* Right: Editor Panel (Conditionally rendered or overlay in Graph Mode) */}
                <div 
                    className={`
                        flex-1 bg-white flex flex-col min-w-0 relative transition-all duration-300 shadow-2xl z-[80]
                        ${viewMode === 'graph' 
                            ? (activeChapterId ? 'absolute right-0 top-0 bottom-0 w-[400px] translate-x-0' : 'absolute right-0 top-0 bottom-0 w-0 translate-x-full overflow-hidden') 
                            : 'h-2/3 md:h-full'
                        }
                    `}
                >
                    {activeChapterId && (
                        (() => {
                            const activeChapter = chapters.find(c => c.id === activeChapterId);
                            if(!activeChapter) return null;
                            
                            return (
                                <ChapterEditor 
                                    key={activeChapter.id}
                                    chapter={activeChapter}
                                    characters={characters}
                                    events={events}
                                    onUpdate={updateChapter}
                                    onUpdateCriteria={updateCompletionCriteria}
                                    onToggleCharacter={toggleCharacter}
                                    onAddPrereq={addPrerequisite}
                                    onRemovePrereq={removePrerequisite}
                                    onOpenAddEvent={openAddEvent}
                                    onOpenEditEvent={openEditEvent}
                                    onDeleteEvent={handleDeleteEvent}
                                    onClose={() => {
                                        if (viewMode === 'list') {
                                            onClose();
                                        } else {
                                            setActiveChapterId(null);
                                        }
                                    }} 
                                />
                            );
                        })()
                    )}
                    
                    {!activeChapterId && viewMode === 'list' && (
                        <div className="flex-1 flex flex-col items-center justify-center text-stone-300">
                            <p className="text-sm font-bold">请选择或新建章节</p>
                        </div>
                    )}
                </div>
            </div>

            {showEventModal && (
                <AddEventModal 
                    onClose={() => { setShowEventModal(false); setPendingGraphEventCoords(null); }}
                    onConfirm={(data) => {
                        if (eventToEdit) handleUpdateEvent(data);
                        else handleAddEvent(data);
                    }}
                    characters={characters}
                    protagonistName={context.character.name}
                    initialEvent={eventToEdit}
                />
            )}
        </div>
    );
};