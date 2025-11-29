
import React, { useState, useEffect, useRef } from 'react';
import { PlotChapter, SupportingCharacter, generateUUID, GameContext, ScheduledEvent } from '../../types';
import { AddEventModal } from '../modals/GameplayModals';

interface PlotBlueprintModalProps {
    isOpen: boolean;
    onClose: () => void;
    context: GameContext;
    setContext: React.Dispatch<React.SetStateAction<GameContext>>;
}

export const PlotBlueprintModal: React.FC<PlotBlueprintModalProps> = ({ 
    isOpen, onClose, context, setContext 
}) => {
    const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
    const [showEventModal, setShowEventModal] = useState(false);
    const [eventToEdit, setEventToEdit] = useState<ScheduledEvent | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    const chapters = context.plotBlueprint || [];
    const characters = context.supportingCharacters || [];
    const events = context.scheduledEvents || [];

    const setChapters = (val: PlotChapter[]) => {
        setContext(prev => ({ ...prev, plotBlueprint: val }));
    };

    const filteredChapters = chapters.filter(c => 
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.summary && c.summary.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    useEffect(() => {
        if (activeChapterId && scrollRef.current) {
            // Logic to scroll to the active card (placeholder for now)
        }
    }, [chapters.length]);

    if (!isOpen) return null;

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
            trackedStats: { currentWordCount: 0, eventsTriggered: 0, interactionsCount: 0 }
        };
        setChapters([...chapters, newChapter]);
        setActiveChapterId(newChapter.id);
        // Clear search to show the new chapter
        if (searchTerm) setSearchTerm('');
    };

    const handleDeleteChapter = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        // No confirmation requested
        setChapters(chapters.filter(c => c.id !== id));
        if (activeChapterId === id) setActiveChapterId(null);
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
        updateChapter(chapterId, 'keyCharacters', newChars);
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
    };

    const handleUpdateEvent = (updatedEvent: ScheduledEvent) => {
        setContext(prev => ({
            ...prev,
            scheduledEvents: (prev.scheduledEvents || []).map(e => e.id === updatedEvent.id ? updatedEvent : e)
        }));
    };

    const handleDeleteEvent = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        // Direct delete without confirmation as requested
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in-up">
            <div className="w-full h-full md:w-[75%] max-h-[65vh] min-h-[550px] max-w-5xl bg-stone-100 md:rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative">
                {/* Global Close Button - Positioned absolutely relative to the main container */}
                <div className="absolute top-0 right-0 p-4 z-[60]">
                    <button onClick={onClose} className="bg-stone-200 hover:bg-red-100 text-stone-500 hover:text-red-500 rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl transition-colors shadow-sm">✕</button>
                </div>

                {/* Left: Visualization (Timeline & Chapters) */}
                <div className="w-full md:w-64 bg-stone-50 border-r border-stone-200 flex flex-col h-1/3 md:h-full overflow-hidden shrink-0">
                    <div className="p-5 border-b border-stone-200 bg-stone-100">
                        <h3 className="text-lg font-bold text-cyan-800 tracking-widest uppercase">剧情细纲</h3>
                    </div>
                    
                    {/* Search Bar */}
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
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-0 relative [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        {/* Chapters Section */}
                        <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-stone-200 pointer-events-none"></div>
                        
                        {filteredChapters.length === 0 && searchTerm && (
                            <div className="pl-10 pb-4 text-xs text-gray-400 italic">未找到匹配章节</div>
                        )}

                        {filteredChapters.map((chapter, idx) => {
                            const isCompleted = chapter.status === 'completed';
                            const isActive = chapter.status === 'active';
                            
                            let borderClass = 'border-stone-200 hover:border-cyan-300';
                            if (isCompleted) borderClass = 'border-l-4 border-l-green-500 border-t border-r border-b border-green-200 bg-green-50/50';
                            else if (isActive) borderClass = 'border-l-4 border-l-cyan-500 border-t border-r border-b border-cyan-200 bg-cyan-50 shadow-[0_0_10px_rgba(6,182,212,0.2)] animate-pulse-slow';
                            else if (activeChapterId === chapter.id) borderClass = 'bg-white border-cyan-400 shadow-md translate-x-1 ring-1 ring-cyan-200';
                            else borderClass = 'bg-white border-stone-200 hover:border-cyan-300';

                            return (
                                <div 
                                    key={chapter.id} 
                                    onClick={() => setActiveChapterId(chapter.id)}
                                    className={`relative pl-10 pb-6 cursor-pointer group ${activeChapterId === chapter.id ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                                >
                                    {/* Timeline Node */}
                                    <div className={`absolute left-5 top-1 w-4 h-4 rounded-full border-2 transition-all z-10 flex items-center justify-center 
                                        ${isCompleted ? 'bg-green-500 border-green-600' : isActive ? 'bg-cyan-500 border-cyan-300 scale-125' : activeChapterId === chapter.id ? 'bg-cyan-500 border-cyan-300' : 'bg-white border-stone-300 group-hover:border-cyan-400'}`}>
                                        {isCompleted && <span className="text-[8px] text-white font-bold">✓</span>}
                                    </div>
                                    
                                    <div className={`p-2.5 rounded-lg border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${borderClass}`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] font-bold text-gray-400">
                                                #{chapters.findIndex(c => c.id === chapter.id) + 1}
                                            </span>
                                            <span className={`text-[9px] font-mono px-1 rounded border ${isCompleted ? 'text-green-700 bg-green-100 border-green-200' : 'text-cyan-600 bg-white border-cyan-100'}`}>
                                                {chapter.targetWordCount}字
                                            </span>
                                        </div>
                                        
                                        {/* Directly below word count as requested */}
                                        <div className="flex justify-end mb-1">
                                            <button 
                                                onClick={(e) => handleDeleteChapter(chapter.id, e)}
                                                className="text-[9px] text-red-300 hover:text-red-500 hover:bg-red-50 rounded px-1 transition-colors flex items-center gap-1"
                                                title="删除章节"
                                            >
                                                <span>🗑</span> 删除
                                            </button>
                                        </div>

                                        <div className={`font-bold text-sm truncate mb-1 ${activeChapterId === chapter.id ? 'text-cyan-900' : 'text-gray-700'}`}>{chapter.title || "未命名章节"}</div>
                                        
                                        {isCompleted && (
                                            <div className="text-[8px] text-green-600 mt-1 pt-1 border-t border-green-200">
                                                耗时 {chapter.finishedTurnCount || '?'} 幕
                                            </div>
                                        )}
                                        {isActive && (
                                            <div className="text-[8px] text-cyan-600 mt-1 pt-1 border-t border-cyan-200 animate-pulse">
                                                当前进行中...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        
                        {/* Adjusted Button: Avoid timeline line overlap */}
                        <button 
                            onClick={handleAddChapter}
                            className="ml-12 w-[calc(100%-3rem)] mb-6 py-2 border-2 border-dashed border-stone-300 rounded-lg text-stone-400 hover:text-cyan-600 hover:border-cyan-300 hover:bg-cyan-50 transition-all text-xs font-bold flex items-center justify-center gap-2"
                        >
                            <span>+</span> 新增章节
                        </button>
                    </div>
                </div>

                {/* Right: Editor Panel */}
                <div className="flex-1 h-2/3 md:h-full bg-white flex flex-col min-w-0 relative">
                    {activeChapterId ? (
                        (() => {
                            const activeChapter = chapters.find(c => c.id === activeChapterId);
                            if(!activeChapter) return null;
                            
                            const isCompleted = activeChapter.status === 'completed';

                            return (
                                <>
                                    {/* FIXED HEADER: Stays at top, doesn't scroll */}
                                    <div className="px-6 md:px-8 pt-6 pb-2 border-b border-stone-100 shrink-0 flex justify-between items-center bg-white z-10">
                                        <div className="flex items-center gap-3 pr-12">
                                            <h2 className="text-xl font-bold text-gray-800">章节详情</h2>
                                            {isCompleted && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded font-bold border border-green-200">已完结</span>}
                                            {activeChapter.status === 'active' && <span className="bg-cyan-100 text-cyan-700 text-xs px-2 py-0.5 rounded font-bold border border-cyan-200 animate-pulse">进行中</span>}
                                        </div>
                                    </div>

                                    {/* SCROLLABLE CONTENT */}
                                    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5 animate-fade-in-right [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                                        
                                        {/* Adjusted Grid */}
                                        <div className="flex flex-col md:flex-row gap-6 items-end">
                                            <div className="space-y-1 flex-1 w-full">
                                                <label className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider">章节标题</label>
                                                <input 
                                                    value={activeChapter.title} 
                                                    onChange={(e) => updateChapter(activeChapter.id, 'title', e.target.value)}
                                                    className="w-full text-base font-bold border-b border-stone-300 focus:border-cyan-500 outline-none py-1 bg-transparent text-gray-800 placeholder-gray-300 transition-colors h-9"
                                                    placeholder="例如：初入江湖"
                                                    disabled={isCompleted} // Lock if completed
                                                />
                                            </div>
                                            <div className="space-y-1 flex-1 w-full">
                                                <label className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider flex justify-between">
                                                    <span>剧情节奏</span>
                                                    <span className="text-gray-400 text-[9px]">{activeChapter.pacing === 'fast' ? '紧凑激烈' : activeChapter.pacing === 'slow' ? '铺垫舒缓' : '标准推进'}</span>
                                                </label>
                                                <div className="flex bg-stone-100 p-1 rounded border border-stone-200 h-9">
                                                    {['fast', 'standard', 'slow'].map((p) => (
                                                        <button
                                                            key={p}
                                                            onClick={() => updateChapter(activeChapter.id, 'pacing', p)}
                                                            className={`flex-1 text-[10px] rounded font-bold transition-all ${
                                                                activeChapter.pacing === p 
                                                                ? 'bg-cyan-500 text-white shadow-sm' 
                                                                : 'text-gray-500 hover:bg-stone-200'
                                                            } ${isCompleted ? 'opacity-70 cursor-default' : ''}`}
                                                            disabled={isCompleted}
                                                        >
                                                            {p === 'fast' ? '快速' : p === 'standard' ? '标准' : '缓慢'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Completion Criteria (Sliders) */}
                                        <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
                                            <div className="flex justify-between items-center mb-4">
                                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">章节完成条件</label>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                {/* Word Count Slider */}
                                                <div>
                                                    <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                                                        <span>目标字数</span>
                                                        <span className="font-bold text-cyan-600 font-mono">{activeChapter.targetWordCount}</span>
                                                    </div>
                                                    <input 
                                                        type="range" min="500" max="10000" step="100" 
                                                        value={activeChapter.targetWordCount}
                                                        onChange={(e) => updateChapter(activeChapter.id, 'targetWordCount', parseInt(e.target.value))}
                                                        className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                                        disabled={isCompleted}
                                                    />
                                                </div>
                                                
                                                {/* Key Events Slider */}
                                                <div>
                                                    <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                                                        <span>最少伏笔触发</span>
                                                        <span className="font-bold text-cyan-600 font-mono">{activeChapter.completionCriteria?.minKeyEvents || 0}</span>
                                                    </div>
                                                    <input 
                                                        type="range" min="0" max="10" step="1"
                                                        value={activeChapter.completionCriteria?.minKeyEvents || 0}
                                                        onChange={(e) => updateCompletionCriteria(activeChapter.id, 'minKeyEvents', parseInt(e.target.value))}
                                                        className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                                        disabled={isCompleted}
                                                    />
                                                </div>
                                                
                                                {/* Interactions Slider */}
                                                <div>
                                                    <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                                                        <span>最少关键互动</span>
                                                        <span className="font-bold text-cyan-600 font-mono">{activeChapter.completionCriteria?.minInteractions || 0}</span>
                                                    </div>
                                                    <input 
                                                        type="range" min="0" max="20" step="1"
                                                        value={activeChapter.completionCriteria?.minInteractions || 0}
                                                        onChange={(e) => updateCompletionCriteria(activeChapter.id, 'minInteractions', parseInt(e.target.value))}
                                                        className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                                        disabled={isCompleted}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider">关键出场人物</label>
                                            <div className="flex flex-wrap gap-2 p-2 bg-stone-50 rounded border border-stone-200 min-h-[42px]">
                                                {characters.map(char => (
                                                    <button
                                                        key={char.id}
                                                        onClick={() => !isCompleted && toggleCharacter(activeChapter.id, char.name)}
                                                        className={`px-2 py-1 rounded text-[10px] font-bold transition-all border ${
                                                            activeChapter.keyCharacters.includes(char.name)
                                                            ? 'bg-cyan-500 text-white border-cyan-600 shadow-sm'
                                                            : 'bg-white text-gray-500 border-stone-200 hover:border-cyan-300 hover:text-cyan-600'
                                                        } ${isCompleted ? 'opacity-70 cursor-default' : ''}`}
                                                    >
                                                        {char.name}
                                                    </button>
                                                ))}
                                                {characters.length === 0 && <span className="text-[10px] text-gray-400 italic">请先在「配角 / 羁绊」面板添加角色</span>}
                                            </div>
                                        </div>

                                        {/* Local Key Events */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider">关键事件 / 硬性约束 (本章必做)</label>
                                                <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 rounded">用于控制本章节奏</span>
                                            </div>
                                            <input 
                                                value={activeChapter.keyEvents} 
                                                onChange={(e) => updateChapter(activeChapter.id, 'keyEvents', e.target.value)}
                                                className="w-full bg-red-50/30 border border-red-100 rounded px-3 py-2 text-xs text-gray-800 placeholder-red-200 focus:border-red-300 outline-none transition-colors"
                                                placeholder="本章必须发生的情节点，例如：主角获得神器..."
                                                disabled={isCompleted}
                                            />
                                        </div>

                                        {/* Global Scheduled Events Section */}
                                        <div className="space-y-2 pt-2 border-t border-stone-100 mt-2">
                                            <div className="flex justify-between items-center mb-1">
                                                <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">预设伏笔 / 事件队列 (全局悬浮)</h4>
                                                <button 
                                                    onClick={openAddEvent}
                                                    className="bg-blue-100 hover:bg-blue-200 text-blue-600 rounded px-2 py-0.5 text-[10px] font-bold transition-colors shadow-sm flex items-center gap-1"
                                                    title="添加新预设"
                                                >
                                                    <span>+</span> 新增
                                                </button>
                                            </div>
                                            <div className="text-[9px] text-gray-400 mb-2">这些事件不局限于当前章节，AI会根据剧情发展灵活插入。</div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {events.filter(e => e.status === 'pending').map(e => (
                                                    <div 
                                                        key={e.id} 
                                                        onClick={() => openEditEvent(e)}
                                                        className="bg-yellow-50 border-l-4 border-yellow-400 p-2 rounded shadow-sm relative group cursor-pointer hover:bg-yellow-100 transition-colors"
                                                    >
                                                        <div className="text-[9px] text-gray-500 flex justify-between font-bold">
                                                            <span>{e.type}</span>
                                                            <button 
                                                                onClick={(evt) => handleDeleteEvent(e.id, evt)}
                                                                className="text-red-300 hover:text-red-500 font-bold px-1"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                        <div className="text-[10px] text-gray-800 mt-1 leading-tight line-clamp-2">{e.description}</div>
                                                    </div>
                                                ))}
                                                {events.filter(e => e.status === 'pending').length === 0 && (
                                                    <div className="text-[10px] text-gray-400 text-center italic py-2 border-2 border-dashed border-stone-100 rounded col-span-full">暂无待触发伏笔</div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1 flex-1 flex flex-col pt-2">
                                            <label className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider">剧情摘要 / 细纲</label>
                                            <textarea 
                                                value={activeChapter.summary}
                                                onChange={(e) => updateChapter(activeChapter.id, 'summary', e.target.value)}
                                                className="w-full h-32 bg-white border border-stone-300 rounded p-3 text-sm text-gray-700 leading-relaxed outline-none focus:border-cyan-500 transition-all resize-none placeholder-gray-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
                                                placeholder="简要描述本章的起承转合..."
                                                disabled={isCompleted}
                                            />
                                        </div>
                                    </div>
                                </>
                            );
                        })()
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-stone-300">
                            <span className="text-4xl mb-2 opacity-50"></span>
                            <p className="text-sm font-bold">请选择或新建章节</p>
                        </div>
                    )}
                </div>
            </div>

            {showEventModal && (
                <AddEventModal 
                    onClose={() => setShowEventModal(false)}
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

export const SetupPlotPanel: React.FC<{ 
    className?: string; 
    style?: React.CSSProperties; 
    onClick?: () => void; 
    context: any; 
    onOpenModal: () => void;
}> = ({ className, style, onClick, context, onOpenModal }) => {
    return (
        <div 
            className={`${className} bg-stone-100/95 backdrop-blur-md border-cyan-700 text-gray-800 group`}
            style={style}
            onClick={onClick}
        >
            <div className="flex flex-col h-full items-center justify-center text-center relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
                    <div className="absolute top-10 left-10 w-32 h-32 border-2 border-cyan-900 rounded-full"></div>
                    <div className="absolute bottom-20 right-10 w-48 h-48 border border-cyan-900 rounded-full"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[120%] h-[1px] bg-cyan-900 rotate-45"></div>
                </div>

                <div className="mb-8 z-10">
                    <h3 className="text-3xl font-bold text-cyan-900 mb-2 tracking-[0.2em] font-serif">剧情蓝图</h3>
                    <div className="w-16 h-1 bg-cyan-600 mx-auto rounded-full mb-4"></div>
                    <p className="text-sm text-cyan-700/70 font-bold max-w-[80%] mx-auto leading-relaxed">
                        以时间为轴，以此为界。<br/>规划命运的既定轨迹，约束无序的混沌走向。
                    </p>
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation(); // Ensure button click doesn't just trigger panel switch if inactive
                        onOpenModal();
                    }}
                    className="bg-cyan-800 hover:bg-cyan-700 text-white text-lg font-bold py-4 px-10 rounded-xl shadow-lg hover:shadow-cyan-500/30 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 z-10"
                >
                    <span></span>
                    <span>进入构想空间</span>
                </button>

                <div className="mt-8 flex gap-4 text-xs text-cyan-600/50 font-mono z-10">
                    <span>已规划章节: {context.plotBlueprint?.length || 0}</span>
                    <span>|</span>
                    <span>预设伏笔: {context.scheduledEvents?.filter((e: any) => e.status === 'pending').length || 0}</span>
                </div>
            </div>
        </div>
    );
};
