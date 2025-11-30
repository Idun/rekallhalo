import React, { useState } from 'react';
import { PlotChapter, SupportingCharacter, ScheduledEvent } from '../../../types';

interface ChapterEditorProps {
    chapter: PlotChapter;
    characters: SupportingCharacter[];
    events: ScheduledEvent[];
    onUpdate: (id: string, field: keyof PlotChapter, value: any) => void;
    onUpdateCriteria: (id: string, field: 'minKeyEvents' | 'minInteractions', value: number) => void;
    onToggleCharacter: (id: string, charName: string) => void;
    onAddPrereq: (id: string, req: string) => void;
    onRemovePrereq: (id: string, req: string) => void;
    onOpenAddEvent: () => void;
    onOpenEditEvent: (e: ScheduledEvent) => void;
    onDeleteEvent: (id: string) => void;
    onClose: () => void;
}

export const ChapterEditor: React.FC<ChapterEditorProps> = ({ 
    chapter, characters, events, onUpdate, onUpdateCriteria, onToggleCharacter, 
    onAddPrereq, onRemovePrereq, onOpenAddEvent, onOpenEditEvent, onDeleteEvent, onClose 
}) => {
    
    // Internal state for input field to prevent flicker/focus loss on parent re-render
    const [localPrereq, setLocalPrereq] = useState('');
    const isCompleted = chapter.status === 'completed';

    // Progress Calculations
    const progressWord = Math.min(100, ((chapter.trackedStats?.currentWordCount || 0) / chapter.targetWordCount) * 100);
    const progressEvents = Math.min(100, ((chapter.trackedStats?.eventsTriggered || 0) / (chapter.completionCriteria?.minKeyEvents || 1)) * 100);
    const progressInteract = Math.min(100, ((chapter.trackedStats?.interactionsCount || 0) / (chapter.completionCriteria?.minInteractions || 1)) * 100);

    return (
        <div className="flex flex-col h-full bg-white relative overflow-hidden border-l border-stone-200">
            {/* FIXED HEADER - Sticky Top */}
            <div className="flex-none flex justify-between items-center px-6 py-4 border-b border-stone-100 bg-white z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-gray-800">章节详情</h2>
                    {isCompleted && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded font-bold border border-green-200">已完结</span>}
                    {chapter.status === 'active' && <span className="bg-cyan-100 text-cyan-700 text-xs px-2 py-0.5 rounded font-bold border border-cyan-200 animate-pulse">进行中</span>}
                </div>
                <button 
                    onClick={onClose} 
                    className="bg-stone-100 hover:bg-red-100 text-stone-500 hover:text-red-500 rounded-full w-8 h-8 flex items-center justify-center font-bold transition-colors shadow-sm"
                    title="关闭面板"
                >
                    ✕
                </button>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 animate-fade-in-right text-gray-800 custom-scrollbar">
                
                {/* Adjusted Grid */}
                <div className="flex flex-col md:flex-row gap-6 items-end">
                    <div className="space-y-1 flex-1 w-full">
                        <label className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider">章节标题</label>
                        <input 
                            value={chapter.title} 
                            onChange={(e) => onUpdate(chapter.id, 'title', e.target.value)}
                            className="w-full text-base font-bold border-b border-stone-300 focus:border-cyan-500 outline-none py-1 bg-transparent text-gray-800 placeholder-gray-300 transition-colors h-9"
                            placeholder="例如：初入江湖"
                            disabled={isCompleted} 
                        />
                    </div>
                    <div className="space-y-1 flex-1 w-full">
                        <label className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider flex justify-between">
                            <span>剧情节奏</span>
                            <span className="text-gray-400 text-[9px]">{chapter.pacing === 'fast' ? '紧凑激烈' : chapter.pacing === 'slow' ? '铺垫舒缓' : '标准推进'}</span>
                        </label>
                        <div className="flex bg-stone-100 p-1 rounded border border-stone-200 h-9">
                            {['fast', 'standard', 'slow'].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => onUpdate(chapter.id, 'pacing', p)}
                                    className={`flex-1 text-[10px] rounded font-bold transition-all ${
                                        chapter.pacing === p 
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

                {/* Prerequisites Section */}
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider flex items-center justify-between">
                        <span>前置条件 / 解锁要求</span>
                        <span className="text-[9px] text-gray-400">如: 需完成前章、需持有物品</span>
                    </label>
                    <div className="flex gap-2">
                        <input 
                            value={localPrereq}
                            onChange={(e) => setLocalPrereq(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { onAddPrereq(chapter.id, localPrereq); setLocalPrereq(''); } }}
                            className="flex-1 bg-white border border-stone-300 rounded px-2 py-1.5 text-xs text-gray-800 outline-none focus:border-cyan-500 placeholder-gray-400"
                            placeholder="输入条件后回车 (例: 获得古剑)"
                            disabled={isCompleted}
                        />
                        <button 
                            onClick={() => { onAddPrereq(chapter.id, localPrereq); setLocalPrereq(''); }}
                            className="px-3 bg-cyan-100 text-cyan-700 text-xs font-bold rounded hover:bg-cyan-200"
                            disabled={isCompleted || !localPrereq}
                        >
                            添加
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {(chapter.prerequisites || []).map((req, i) => (
                            <div key={i} className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] px-2 py-1 rounded shadow-sm">
                                <span>🔒 {req}</span>
                                {!isCompleted && (
                                    <button onClick={() => onRemovePrereq(chapter.id, req)} className="text-amber-400 hover:text-amber-600 font-bold ml-1">✕</button>
                                )}
                            </div>
                        ))}
                        {(!chapter.prerequisites || chapter.prerequisites.length === 0) && (
                            <div className="text-[10px] text-gray-400 italic">默认逻辑：自动承接上一章</div>
                        )}
                    </div>
                </div>

                {/* --- Live Stats & Affinity Dashboard (MOVED HERE) --- */}
                <div className="bg-gradient-to-br from-slate-50 to-stone-100 rounded-xl p-4 border border-stone-200 shadow-inner">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <span>实时进度监控</span>
                        </label>
                        <span className="text-[9px] text-gray-400 font-mono">ID: {chapter.id.slice(0,8)}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Progress Bars */}
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                                    <span>字数进度</span>
                                    <span className="font-mono">{chapter.trackedStats?.currentWordCount || 0} / {chapter.targetWordCount}</span>
                                </div>
                                <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${progressWord}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                                    <span>伏笔触发</span>
                                    <span className="font-mono">{chapter.trackedStats?.eventsTriggered || 0} / {chapter.completionCriteria?.minKeyEvents || 0}</span>
                                </div>
                                <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${progressEvents}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                                    <span>关键互动</span>
                                    <span className="font-mono">{chapter.trackedStats?.interactionsCount || 0} / {chapter.completionCriteria?.minInteractions || 0}</span>
                                </div>
                                <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${progressInteract}%` }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Character Affinity Tracker */}
                        <div className="bg-white/50 rounded-lg p-2 border border-stone-200">
                            <label className="text-[9px] font-bold text-gray-400 uppercase mb-2 block">登场角色状态</label>
                            <div className="space-y-2 max-h-[100px] overflow-y-auto pr-1 custom-scrollbar">
                                {chapter.keyCharacters.length === 0 && <span className="text-[9px] text-gray-400 italic">暂无关键角色</span>}
                                {chapter.keyCharacters.map(charName => {
                                    const charData = characters.find(c => c.name === charName);
                                    const affinity = charData?.affinity || 0;
                                    const isPositive = affinity >= 0;
                                    return (
                                        <div key={charName} className="flex items-center gap-2">
                                            <div className="w-16 truncate text-[10px] font-bold text-gray-700" title={charName}>{charName}</div>
                                            <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden flex">
                                                {/* Center pivoted bar */}
                                                <div className="w-1/2 flex justify-end bg-stone-200">
                                                    {!isPositive && <div className="h-full bg-blue-500" style={{ width: `${Math.min(Math.abs(affinity), 50) * 2}%` }}></div>}
                                                </div>
                                                <div className="w-1/2 flex justify-start bg-stone-200">
                                                    {isPositive && <div className="h-full bg-pink-500" style={{ width: `${Math.min(Math.abs(affinity), 50) * 2}%` }}></div>}
                                                </div>
                                            </div>
                                            <span className={`text-[9px] font-mono w-6 text-right ${isPositive ? 'text-pink-500' : 'text-blue-500'}`}>{affinity}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Completion Criteria (Sliders) */}
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">章节完成条件 (阈值设定)</label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Word Count Slider */}
                        <div>
                            <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                                <span>目标字数</span>
                                <span className="font-bold text-cyan-600 font-mono">{chapter.targetWordCount}</span>
                            </div>
                            <input 
                                type="range" min="500" max="10000" step="100" 
                                value={chapter.targetWordCount}
                                onChange={(e) => onUpdate(chapter.id, 'targetWordCount', parseInt(e.target.value))}
                                className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                disabled={isCompleted}
                            />
                        </div>
                        
                        {/* Key Events Slider */}
                        <div>
                            <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                                <span>最少伏笔触发</span>
                                <span className="font-bold text-cyan-600 font-mono">{chapter.completionCriteria?.minKeyEvents || 0}</span>
                            </div>
                            <input 
                                type="range" min="0" max="10" step="1"
                                value={chapter.completionCriteria?.minKeyEvents || 0}
                                onChange={(e) => onUpdateCriteria(chapter.id, 'minKeyEvents', parseInt(e.target.value))}
                                className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                disabled={isCompleted}
                            />
                        </div>
                        
                        {/* Interactions Slider */}
                        <div>
                            <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                                <span>最少关键互动</span>
                                <span className="font-bold text-cyan-600 font-mono">{chapter.completionCriteria?.minInteractions || 0}</span>
                            </div>
                            <input 
                                type="range" min="0" max="20" step="1"
                                value={chapter.completionCriteria?.minInteractions || 0}
                                onChange={(e) => onUpdateCriteria(chapter.id, 'minInteractions', parseInt(e.target.value))}
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
                                onClick={() => !isCompleted && onToggleCharacter(chapter.id, char.name)}
                                className={`px-2 py-1 rounded text-[10px] font-bold transition-all border ${
                                    chapter.keyCharacters.includes(char.name)
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
                        value={chapter.keyEvents} 
                        onChange={(e) => onUpdate(chapter.id, 'keyEvents', e.target.value)}
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
                            onClick={onOpenAddEvent}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-600 rounded px-2 py-0.5 text-[10px] font-bold transition-colors shadow-sm flex items-center gap-1"
                            title="添加新预设"
                        >
                            <span>+</span> 新增
                        </button>
                    </div>
                    <div className="text-[9px] text-gray-400 mb-2">这些事件不局限于当前章节，AI会根据剧情发展灵活插入。</div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {events.length === 0 && (
                            <div className="text-[10px] text-gray-400 text-center italic py-2 border-2 border-dashed border-stone-100 rounded col-span-full">暂无待触发伏笔</div>
                        )}
                        {events.map(e => (
                            <div 
                                key={e.id} 
                                onClick={() => e.status !== 'completed' && onOpenEditEvent(e)}
                                className={`p-2 rounded shadow-sm relative group transition-colors
                                    ${e.status === 'completed' 
                                        ? 'bg-green-50 border-l-4 border-green-300 cursor-default'
                                        : 'bg-yellow-50 border-l-4 border-yellow-400 hover:bg-yellow-100 cursor-pointer'}
                                `}
                            >
                                <div className="text-[9px] text-gray-500 flex justify-between font-bold">
                                    <span>{e.type}</span>
                                    {e.status === 'completed' ? (
                                        <span className="text-green-600 font-bold flex items-center gap-1">✓ 已触发</span>
                                    ) : (
                                        <button 
                                            onClick={(evt) => { evt.stopPropagation(); onDeleteEvent(e.id); }}
                                            className="text-red-300 hover:text-red-500 font-bold px-1"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                                <div className={`text-[10px] mt-1 leading-tight line-clamp-2 ${e.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                    {e.description}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-1 flex-1 flex flex-col pt-2">
                    <label className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider">剧情摘要 / 细纲</label>
                    <textarea 
                        value={chapter.summary}
                        onChange={(e) => onUpdate(chapter.id, 'summary', e.target.value)}
                        className="w-full h-32 bg-white border border-stone-300 rounded p-3 text-sm text-gray-700 leading-relaxed outline-none focus:border-cyan-500 transition-all resize-none placeholder-gray-300 custom-scrollbar"
                        placeholder="简要描述本章的起承转合..."
                        disabled={isCompleted}
                    />
                </div>
            </div>
        </div>
    );
};