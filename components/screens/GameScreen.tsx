import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SmoothBackground, getSmartBackground, getRandomBackground } from '../SmoothBackground';
import { TypingText } from '../TypingText';
import { Button } from '../Button';
import { GameContext, ImageSize, StoryMood, StoryGenre, InputMode, MemoryState, SupportingCharacter, VisualEffectType, ShotSize, ScheduledEvent } from '../../types';
import { VisualEffectsLayer } from '../VisualEffectsLayer';
import { GenreAvatar } from '../GenreAvatar';

interface GameScreenProps {
    context: GameContext;
    bgImage: string;
    backgroundStyle: string;
    battleAnim: string | null;
    generatingImage: boolean;
    isLoading: boolean;
    isUiVisible: boolean;
    setIsUiVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
    isMuted: boolean;
    setIsMuted: (muted: boolean) => void;
    volume: number;
    setVolume: (vol: number) => void;
    textTypingComplete: boolean;
    setTextTypingComplete: (complete: boolean) => void;
    typingSpeed: number;
    setTypingSpeed: (speed: number) => void;
    inputMode: InputMode;
    
    // Actions
    handleBackToHome: () => void;
    handleManualSave: () => void;
    handleChoice: (choice: string, fromIndex?: number) => void;
    handleUseSkill: (skill: any) => void;
    handleSummarizeMemory: () => void;
    handleRegenerate: () => void;
    handleSwitchVersion: (segmentId: string, direction: 'prev' | 'next') => void;
    handleGlobalReplace: (findText: string, replaceText: string) => number;
    handleAddScheduledEvent?: (event: Omit<ScheduledEvent, 'id' | 'createdTurn' | 'status'>) => void; 
    handleUpdateScheduledEvent?: (event: ScheduledEvent) => void; 
    handleDeleteScheduledEvent?: (id: string) => void; 
    isSummarizing: boolean;
    
    // Modals Triggers
    onOpenImageModal: () => void;
    onOpenCharacterModal: (characterId?: string) => void;
    onOpenHistoryModal: () => void;
    onOpenSkillModal: () => void;
    onOpenRegenConfirm: () => void;
    onOpenSettings: () => void;
    
    shouldBlurBackground: boolean;
    playClickSound: () => void;

    // Visual Effects
    visualEffect: VisualEffectType;
    setVisualEffect: (type: VisualEffectType) => void;
    
    autoSaveState: 'saving' | 'complete' | null;
    showStoryPanelBackground: boolean;
    storyFontSize: number;
    storyFontFamily: string;
    
    // Favorite BG
    isCurrentBgFavorited: boolean;
    onToggleFavorite: () => void;
}

// Entity Tooltip Overlay Component
const EntityTooltipRenderer = ({ info, rect }: { info: { type: 'protagonist' | 'npc' | 'location', data: any }, rect: DOMRect }) => {
    if (!rect) return null;

    let bgClass = "bg-blue-900/95 border-blue-500";
    let tooltipContent = null;
    let arrowColor = "text-blue-500";

    if (info.type === 'protagonist') {
        bgClass = "bg-amber-900/95 border-amber-500";
        arrowColor = "text-amber-500";
        tooltipContent = (
            <>
                <div className="font-bold text-amber-400 text-sm">{info.data.name} <span className="text-[10px] text-amber-200 bg-amber-800/50 px-1 rounded ml-1 align-middle">主角</span></div>
                <div className="text-[10px] text-gray-200 mt-1 italic">{info.data.trait}</div>
                <div className="text-[10px] text-gray-300 mt-1 border-t border-amber-500/30 pt-1">Lv.{info.data.skills.reduce((a:any,b:any)=>a+b.level,0)} | 技能数: {info.data.skills.length}</div>
            </>
        );
    } else if (info.type === 'npc') {
        const npc = info.data as SupportingCharacter;
        const isVillain = npc.category === 'villain' || (npc.affinity || 0) < -10;
        const isFriend = (npc.affinity || 0) > 10;
        
        if (isVillain) {
            bgClass = "bg-red-900/95 border-red-500";
            arrowColor = "text-red-500";
        } else if (isFriend) {
            bgClass = "bg-pink-900/95 border-pink-500";
            arrowColor = "text-pink-500";
        } else {
            bgClass = "bg-indigo-900/95 border-indigo-500";
            arrowColor = "text-indigo-500";
        }

        tooltipContent = (
            <>
                <div className="flex justify-between items-center gap-4 mb-1">
                    <span className={`font-bold text-sm ${isVillain ? 'text-red-400' : 'text-pink-300'}`}>{npc.name}</span>
                    <span className="text-[10px] font-mono bg-black/30 px-1.5 rounded text-white/80">♥ {npc.affinity || 0}</span>
                </div>
                <div className="flex gap-1 mb-1">
                    <span className="text-[9px] text-white/80 bg-white/10 px-1 rounded">{npc.role}</span>
                    {npc.archetype && <span className="text-[9px] text-gray-400 italic bg-black/20 px-1 rounded">{npc.archetype}</span>}
                </div>
                <div className="text-[10px] text-gray-300 leading-tight border-t border-white/10 pt-1 mt-1">{npc.personality || npc.appearance || "暂无详细记录"}</div>
            </>
        );
    } else if (info.type === 'location') {
        bgClass = "bg-cyan-950/95 border-cyan-500";
        arrowColor = "text-cyan-500";
        tooltipContent = (
            <>
                <div className="font-bold text-cyan-400 text-sm flex items-center gap-1">
                    <span>📍</span>
                    {info.data}
                </div>
                <div className="text-[10px] text-gray-300 mt-1">当前剧情所在区域</div>
            </>
        );
    }

    // Outer Position Style - Purely for positioning the anchor point
    const positionStyle: React.CSSProperties = {
        position: 'fixed',
        top: `${rect.top - 12}px`, // Slight offset up
        left: `${rect.left + rect.width / 2}px`,
        transform: 'translate(-50%, -100%)', // Move up by its own height to sit ON TOP of the text
        zIndex: 9999,
        pointerEvents: 'none' // Allows mouse events to pass through, fixing sticky hover issues
    };

    // Inner Box Style - Handles sizing
    const contentStyle: React.CSSProperties = {
        maxWidth: '220px',
        minWidth: '160px'
    };

    return (
        <div style={positionStyle}>
            <div 
                className={`p-3 rounded-lg border shadow-2xl backdrop-blur-md animate-fade-in-up relative ${bgClass}`}
                style={contentStyle}
            >
                {tooltipContent}
                {/* Down Arrow - Anchored to bottom of tooltip */}
                <div className={`absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-b border-r ${bgClass} ${arrowColor} border-t-0 border-l-0`}></div>
            </div>
        </div>
    );
};

// Regex Helper
const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const detectShotType = (visualPrompt?: string): ShotSize | null => {
    if (!visualPrompt) return null;
    const lower = visualPrompt.toLowerCase();
    if (lower.includes('extreme close-up') || lower.includes('extreme close up')) return ShotSize.EXTREME_CLOSE_UP;
    if (lower.includes('close-up') || lower.includes('close up')) return ShotSize.CLOSE_UP;
    if (lower.includes('extreme long shot') || lower.includes('panoramic')) return ShotSize.EXTREME_LONG_SHOT;
    if (lower.includes('long shot') || lower.includes('wide shot') || lower.includes('full shot')) return ShotSize.LONG_SHOT;
    if (lower.includes('medium shot') || lower.includes('waist up')) return ShotSize.MEDIUM_SHOT;
    if (lower.includes('dynamic perspective') || lower.includes('wide angle') || lower.includes('fish-eye')) return ShotSize.DYNAMIC_PERSPECTIVE;
    return null;
};

// ... MemoryTextRenderer and InventoryRenderer remain same ...
const MemoryTextRenderer = ({ text, context }: { text: string, context: GameContext }) => {
    if (!text) return <span>无数据</span>;
    const entityKeywords = [
        context.character.name, 
        ...context.supportingCharacters.map(c => c.name)
    ].filter(n => n && n.trim().length > 0);
    const coreMemoryRaw = context.memories.coreMemory || "";
    const coreKeywords = coreMemoryRaw.split(/[，。：；\n]/).filter(s => s.trim().length > 3 && s.trim().length < 10).map(s => s.trim());
    const entityPattern = entityKeywords.length > 0 ? entityKeywords.map(escapeRegExp).join('|') : null;
    const corePattern = coreKeywords.length > 0 ? coreKeywords.map(escapeRegExp).join('|') : null;
    if (!entityPattern && !corePattern) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${entityPattern ? entityPattern : ''}${entityPattern && corePattern ? '|' : ''}${corePattern ? corePattern : ''})`, 'g'));
    return (
        <span>
            {parts.map((part, i) => {
                if (entityKeywords.some(k => k === part)) {
                    return <span key={i} className="text-blue-600 font-bold bg-blue-50/50 px-0.5 rounded cursor-help hover:bg-blue-100 transition-colors" title="角色记录关联">{part}</span>;
                }
                if (coreKeywords.some(k => k === part)) {
                    return <span key={i} className="text-red-600 font-bold border-b-2 border-dashed border-red-400 cursor-help hover:bg-red-100 hover:text-red-800 hover:border-solid transition-all duration-200 inline-block transform hover:scale-105 px-1 rounded" title="核心记忆共鸣">{part}</span>;
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
};

const InventoryRenderer = ({ text, activeCharName }: { text: string, activeCharName: string }) => {
    if (!text) return <span>无数据</span>;
    const lines = text.split(/[\n;]/).map(line => line.trim()).filter(line => line.length > 0);
    return (
        <div className="flex flex-col gap-2">
            {lines.map((line, idx) => {
                const isActive = line.includes(activeCharName) || (activeCharName === '我' && (line.includes('[我]') || line.includes('[主角]')));
                const isOther = !isActive && (line.includes('[') || line.includes('：') || line.includes(':'));
                return <div key={idx} className={`px-3 py-1.5 rounded-md border-l-4 transition-all duration-300 ${isActive ? 'bg-emerald-100 border-emerald-500 text-emerald-900 font-bold shadow-md scale-[1.02] ring-1 ring-emerald-200' : isOther ? 'border-gray-200 text-gray-500 text-[10px] bg-gray-50' : 'border-transparent text-gray-600'}`}>{isActive && <span className="mr-2 text-xs">🎒</span>}{line}</div>;
            })}
        </div>
    );
};

const MemoryAccordionItem = ({ title, content, type, context, onSummarize, isSummarizing, activeCharName }: { title: string, content: string, type: 'core' | 'active' | 'archived' | 'inventory', context: GameContext, onSummarize?: () => void, isSummarizing?: boolean, activeCharName?: string }) => {
    const [isOpen, setIsOpen] = useState(true);
    const colors = { core: "border-red-500 text-red-700", active: "border-amber-500 text-amber-700", archived: "border-blue-500 text-blue-700", inventory: "border-emerald-500 text-emerald-700" };
    return (
        <div className="mb-3 group last:mb-0">
             <div className="flex items-center gap-2">
                 <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className={`flex-1 flex items-center justify-between p-2 text-xs font-bold bg-stone-200 border-l-4 ${colors[type]} hover:bg-stone-300 transition-colors shadow-sm`}>
                    <div className="flex items-center gap-2"><div className={`w-1.5 h-1.5 ${type === 'core' ? 'bg-red-500' : type === 'active' ? 'bg-amber-500' : type === 'inventory' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>{title}</div>
                    <span className="text-stone-500 font-mono">{isOpen ? '-' : '+'}</span>
                 </button>
                 {onSummarize && <button onClick={(e) => { e.stopPropagation(); onSummarize(); }} disabled={isSummarizing} className={`px-2 py-1 rounded-md flex items-center justify-center transition-all duration-300 border border-stone-300 bg-stone-100 text-stone-500 hover:text-amber-600 hover:border-amber-500 hover:bg-amber-50 hover:shadow-[0_0_8px_rgba(245,191,36,0.5)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-bold tracking-wider`} title="自动摘要最近剧情">{isSummarizing ? "摘要中..." : "摘要"}</button>}
             </div>
             {isOpen && <div className="mt-1 p-3 bg-white border border-stone-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] text-xs text-stone-600 leading-relaxed whitespace-pre-wrap relative overflow-hidden font-mono [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">{type === 'inventory' && activeCharName ? <InventoryRenderer text={content} activeCharName={activeCharName} /> : <MemoryTextRenderer text={content} context={context} />}</div>}
        </div>
    );
};

interface SuggestionItem { label: string; value: string; type: 'skill' | 'item' | 'location' | 'character'; }
const AutocompleteList = ({ suggestions, onSelect }: { suggestions: SuggestionItem[], onSelect: (val: string) => void }) => {
    if (suggestions.length === 0) return null;
    return (
        <div className="absolute bottom-full left-0 mb-2 w-full max-w-sm bg-stone-100 border border-stone-300 rounded-lg shadow-xl overflow-hidden z-[100] animate-fade-in-up">
            <div className="bg-stone-200 px-3 py-1 text-[10px] text-gray-500 font-bold uppercase tracking-wider flex justify-between"><span>建议补全</span><span>Tab / Click</span></div>
            <div className="max-h-40 overflow-y-auto custom-scrollbar">{suggestions.map((item, idx) => (<button key={idx} onClick={() => onSelect(item.value)} className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-stone-200 last:border-0 flex items-center gap-2 group"><span className={`text-[10px] px-1.5 rounded font-bold uppercase w-12 text-center ${item.type === 'skill' ? 'bg-yellow-100 text-yellow-700' : item.type === 'item' ? 'bg-emerald-100 text-emerald-700' : item.type === 'character' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>{item.type === 'skill' ? '技能' : item.type === 'item' ? '物品' : item.type === 'character' ? '角色' : '地点'}</span><span className="font-medium text-gray-700 group-hover:text-indigo-700">{item.label}</span></button>))}</div>
        </div>
    );
};

interface MultiSelectProps {
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    label?: string;
    placeholder?: string;
}

const MultiSelectDropdown: React.FC<MultiSelectProps> = ({ options, selected, onChange, label, placeholder = "选择..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = (option: string) => {
        if (selected.includes(option)) {
            onChange(selected.filter(s => s !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            {label && <label className="text-[10px] text-gray-500 font-bold block mb-1">{label}</label>}
            
            <div 
                className={`w-full bg-white border rounded px-2 py-2 text-sm cursor-pointer flex justify-between items-center transition-colors min-h-[38px] ${isOpen ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-stone-300 hover:border-gray-400'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex flex-wrap gap-1 flex-1">
                    {selected.length === 0 && <span className="text-gray-400">{placeholder}</span>}
                    {selected.map(item => (
                        <span key={item} className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                            {item}
                            <span 
                                onClick={(e) => { e.stopPropagation(); handleToggle(item); }}
                                className="cursor-pointer hover:text-blue-900 font-normal"
                            >
                                ✕
                            </span>
                        </span>
                    ))}
                </div>
                <span className="text-gray-400 text-xs ml-2">▼</span>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-stone-300 rounded shadow-lg z-50 max-h-40 overflow-y-auto custom-scrollbar animate-fade-in-up">
                    {options.map(option => {
                        const isSelected = selected.includes(option);
                        return (
                            <div 
                                key={option} 
                                className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 hover:bg-stone-50 ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                                onClick={() => handleToggle(option)}
                            >
                                <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}`}>
                                    {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                                </div>
                                <span>{option}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface AddEventModalProps {
    onClose: () => void;
    onConfirm: (event: any) => void;
    characters: SupportingCharacter[];
    protagonistName: string;
    initialEvent?: ScheduledEvent | null; // Optional prop for editing
}

const AddEventModal: React.FC<AddEventModalProps> = ({ onClose, onConfirm, characters, protagonistName, initialEvent }) => {
    const [schedTime, setSchedTime] = useState('');
    const [schedLocation, setSchedLocation] = useState('');
    const [schedChars, setSchedChars] = useState<string[]>([]); // Multi-select array
    const [schedType, setSchedType] = useState('一般事件');
    const [schedDesc, setSchedDesc] = useState('');

    useEffect(() => {
        if (initialEvent) {
            setSchedTime(initialEvent.time || '');
            setSchedLocation(initialEvent.location || '');
            // Attempt to split string back to array if it was stored as string
            setSchedChars(initialEvent.characters ? initialEvent.characters.split(', ') : []);
            setSchedType(initialEvent.type || '一般事件');
            setSchedDesc(initialEvent.description || '');
        }
    }, [initialEvent]);

    const handleSave = () => {
        if (!schedDesc) return;
        const eventData: any = {
            type: schedType,
            time: schedTime,
            location: schedLocation,
            characters: schedChars.join(', '), // Join array to string for storage
            description: schedDesc
        };
        if (initialEvent) {
            eventData.id = initialEvent.id;
            eventData.createdTurn = initialEvent.createdTurn;
            eventData.status = initialEvent.status;
        }
        onConfirm(eventData);
        onClose();
    };

    // Prepare multi-select options
    const characterOptions = [
        `${protagonistName}`,
        ...characters.map(c => c.name),
        "新角色",
        "其他势力/组织"
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in-up" onClick={onClose}>
            <div className="bg-stone-100 border border-stone-200 p-6 rounded-xl shadow-2xl max-w-sm w-full relative text-gray-800" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                    {initialEvent ? '编辑预设伏笔' : '添加预设事件 / 伏笔'}
                </h3>
                
                <div className="space-y-4">
                    {/* Row 1: Time & Location */}
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <input 
                                value={schedTime} 
                                onChange={e => setSchedTime(e.target.value)} 
                                placeholder="时间 (例如: 下一幕, 明天)" 
                                className="w-full bg-white border border-stone-300 rounded px-2 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 placeholder-gray-400 transition-colors" 
                            />
                        </div>
                        <div className="flex-1">
                            <input 
                                value={schedLocation} 
                                onChange={e => setSchedLocation(e.target.value)} 
                                placeholder="地点" 
                                className="w-full bg-white border border-stone-300 rounded px-2 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 placeholder-gray-400 transition-colors" 
                            />
                        </div>
                    </div>

                    {/* Row 2: Type & Characters */}
                    <div className="flex flex-col gap-2">
                        <div className="relative">
                            <select 
                                value={schedType} 
                                onChange={e => setSchedType(e.target.value)} 
                                className="w-full bg-white border border-stone-300 rounded px-2 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 cursor-pointer appearance-none"
                            >
                                <option value="一般事件">一般事件</option>
                                <option value="战斗遭遇">战斗遭遇</option>
                                <option value="人物重逢">人物重逢</option>
                                <option value="重要转折">重要转折</option>
                                <option value="物品发现">物品发现</option>
                            </select>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">▼</span>
                        </div>

                        <MultiSelectDropdown 
                            options={characterOptions}
                            selected={schedChars}
                            onChange={setSchedChars}
                            placeholder="涉及人物 (可多选)..."
                        />
                    </div>

                    {/* Row 3: Description */}
                    <div>
                        <textarea 
                            value={schedDesc} 
                            onChange={e => setSchedDesc(e.target.value)} 
                            placeholder="简短描述事件内容，AI将尝试在后续剧情中自然触发..." 
                            className="w-full h-20 bg-white border border-stone-300 rounded px-2 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 placeholder-gray-400 transition-colors resize-none custom-scrollbar" 
                        />
                    </div>
                </div>

                <div className="flex gap-4 mt-6">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-2 text-sm font-bold bg-gray-200 hover:bg-gray-300 text-gray-700 clip-path-polygon hover:shadow-lg transition-all active:translate-y-0.5"
                        style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={!schedDesc}
                        className={`flex-1 py-2 text-sm font-bold clip-path-polygon transition-all shadow-lg active:translate-y-0.5
                            ${!schedDesc 
                                ? 'bg-stone-200 text-gray-400 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-500 text-white'}
                        `}
                        style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                    >
                        {initialEvent ? '更新伏笔' : '添加伏笔'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const getNamePlateStyles = (genre: StoryGenre, isProtagonist: boolean) => {
    if (isProtagonist) {
        switch (genre) {
            case StoryGenre.XIANXIA: case StoryGenre.WUXIA:
                return {
                    container: "bg-[#1c1917]/90 border border-[#a16207]/60 shadow-[0_0_20px_rgba(161,98,7,0.4)] backdrop-blur-md px-5 py-2 rounded-r-xl border-l-4 border-l-[#a16207] min-w-[120px]",
                    name: "text-amber-100 font-serif tracking-widest text-shadow-sm",
                    role: "bg-[#451a03] text-amber-500 border border-amber-900/50 shadow-inner"
                };
            case StoryGenre.CYBERPUNK:
                return {
                    container: "bg-black/90 border border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.4)] backdrop-blur-md px-5 py-2 skew-x-[-10deg] border-l-4 border-l-cyan-400 min-w-[120px]",
                    name: "text-cyan-50 font-mono tracking-tighter skew-x-[10deg] drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]",
                    role: "bg-cyan-950 text-cyan-400 border border-cyan-700/50 skew-x-[10deg]"
                };
            case StoryGenre.ROMANCE:
                return {
                    container: "bg-white/95 border border-pink-300 shadow-[0_0_20px_rgba(249,168,212,0.5)] backdrop-blur-md px-6 py-2 rounded-[24px] min-w-[120px]",
                    name: "text-pink-600 font-sans tracking-wide",
                    role: "bg-pink-50 text-pink-400 border border-pink-200"
                };
            default:
                return {
                    container: "bg-slate-900/90 border border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.4)] backdrop-blur-md px-5 py-2 rounded-lg border-l-4 border-l-indigo-500 min-w-[120px]",
                    name: "text-indigo-50 font-sans tracking-wide",
                    role: "bg-indigo-950 text-indigo-400 border border-indigo-800/50"
                };
        }
    } else {
        // Generic NPC or Supporting
        return {
            container: "bg-stone-900/90 border border-stone-600/50 shadow-lg backdrop-blur-md px-4 py-2 rounded-lg min-w-[100px]",
            name: "text-stone-200 font-sans",
            role: "bg-stone-800 text-stone-400 border border-stone-700"
        };
    }
};

export const GameScreen: React.FC<GameScreenProps> = (props) => {
    const { 
        context, bgImage, backgroundStyle, battleAnim, generatingImage, isLoading, 
        isUiVisible, setIsUiVisible, isMuted, setIsMuted, volume, setVolume,
        textTypingComplete, setTextTypingComplete, typingSpeed, setTypingSpeed, inputMode,
        handleBackToHome, handleManualSave, handleChoice, handleAddScheduledEvent, handleUpdateScheduledEvent, handleDeleteScheduledEvent,
        onOpenImageModal, onOpenCharacterModal, onOpenHistoryModal, onOpenSkillModal, onOpenRegenConfirm, onOpenSettings,
        shouldBlurBackground, playClickSound, handleSummarizeMemory, isSummarizing, handleRegenerate, handleSwitchVersion,
        handleGlobalReplace, visualEffect, setVisualEffect, autoSaveState, showStoryPanelBackground, storyFontSize, storyFontFamily,
        isCurrentBgFavorited, onToggleFavorite
    } = props;

    const [viewingIndex, setViewingIndex] = useState(context.history.length - 1);
    const [showSpeedControl, setShowSpeedControl] = useState(false);
    const [inputText, setInputText] = useState('');
    const [showMemory, setShowMemory] = useState(false);
    const [showInventory, setShowInventory] = useState(false);
    const [showGodMode, setShowGodMode] = useState(false);
    const [showScheduler, setShowScheduler] = useState(false); 
    const [showAddEventModal, setShowAddEventModal] = useState(false);
    const [eventToEdit, setEventToEdit] = useState<ScheduledEvent | null>(null);
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
    
    // Heart Animation State
    const [heartBeat, setHeartBeat] = useState(false);
    
    // Entity Tooltip State
    const [tooltipData, setTooltipData] = useState<{ info: any, rect: DOMRect } | null>(null);
    
    // God Mode inputs
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [replaceError, setReplaceError] = useState<string | null>(null);

    const [inputPage, setInputPage] = useState<0 | 1>(0);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const sideToolsRef = useRef<HTMLDivElement>(null);

    // Keyboard & Scroll Effects
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab') { e.preventDefault(); setIsUiVisible(prev => !prev); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setIsUiVisible]);

    useEffect(() => {
        setViewingIndex(context.history.length - 1);
        setInputText(''); setSuggestions([]); setInputPage(0);
        setTooltipData(null); // Clear tooltip on new turn
    }, [context.history.length]);

    useEffect(() => { if (inputMode === 'text' && chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [context.history.length, textTypingComplete, inputMode, context.history[context.history.length-1]?.currentVersionIndex]);

    useEffect(() => {
        if ((inputMode !== 'text' && inputPage !== 1) || !inputText) { setSuggestions([]); return; }
        const lowerInput = inputText.toLowerCase().trim();
        const lastChars = lowerInput.slice(-4);
        let newSuggestions: SuggestionItem[] = [];
        if (lastChars.endsWith("技能") || lastChars.endsWith("招式") || lastChars.endsWith("/")) {
            newSuggestions = context.character.skills.map(s => ({ label: s.name, value: `(发动技能) ${s.name}: ${s.description}`, type: 'skill' }));
        } else if (lastChars.endsWith("道具") || lastChars.endsWith("物品") || lastChars.endsWith("背包") || lastChars.endsWith("#")) {
            const invText = context.memories.inventory || "";
            const lines = invText.split(/[\n;]/).map(s => s.trim()).filter(s => s.length > 0 && !s.includes("暂无"));
            newSuggestions = lines.map(line => ({ label: line, value: `使用 ${line}`, type: 'item' }));
        } else if (lastChars.endsWith("地点") || lastChars.endsWith("前往")) {
            const currentLoc = context.currentSegment?.location || "未知区域";
            newSuggestions.push({ label: `当前: ${currentLoc}`, value: `调查 ${currentLoc}`, type: 'location' });
            newSuggestions.push({ label: "寻找附近城镇", value: "前往附近的城镇", type: 'location' });
            newSuggestions.push({ label: "探索周边", value: "探索周边环境", type: 'location' });
        } else if (lastChars.endsWith("@")) {
            newSuggestions = context.supportingCharacters.map(c => ({ label: c.name, value: `与 ${c.name} 对话`, type: 'character' }));
            newSuggestions.unshift({ label: "自言自语", value: "自言自语：", type: 'character' });
        }
        setSuggestions(newSuggestions);
    }, [inputText, context, inputMode, inputPage]);

    const handleSuggestionSelect = (val: string) => {
        const currentText = inputText;
        const triggers = ["技能", "招式", "/", "道具", "物品", "背包", "#", "地点", "前往", "@"];
        let baseText = currentText;
        
        // Find which trigger was used and remove it from the end of the string
        for (const trigger of triggers) {
            if (currentText.endsWith(trigger)) {
                baseText = currentText.slice(0, -trigger.length);
                break;
            }
        }
        
        setInputText(baseText + val);
        setSuggestions([]);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sideToolsRef.current && !sideToolsRef.current.contains(event.target as Node)) {
                if (showGodMode) setShowGodMode(false);
                if (showMemory) setShowMemory(false);
                if (showInventory) setShowInventory(false);
                if (showScheduler) setShowScheduler(false);
            }
            // Clear tooltip on click anywhere
            setTooltipData(null);
        };
        if (showGodMode || showMemory || showInventory || showScheduler || true) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showGodMode, showMemory, showInventory, showScheduler]);

    const handleConfirmEvent = (eventData: any) => {
        if (eventToEdit && handleUpdateScheduledEvent) {
            handleUpdateScheduledEvent(eventData);
        } else if (handleAddScheduledEvent) {
            handleAddScheduledEvent(eventData);
        }
        playClickSound();
    };

    const handleEditEvent = (event: ScheduledEvent) => {
        setEventToEdit(event);
        setShowAddEventModal(true);
        setShowScheduler(false); 
    };

    const handleRemoveEvent = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (handleDeleteScheduledEvent) {
            if (window.confirm("确定要删除这个预设伏笔吗？")) {
                handleDeleteScheduledEvent(id);
            }
        }
    };

    // Use useCallback to ensure stability for child components
    const handleHoverEntity = useCallback((info: any, rect: DOMRect | null) => {
        if (info && rect) {
            setTooltipData({ info, rect });
        } else {
            setTooltipData(null);
        }
    }, []);

    const triggerHeart = () => {
        setHeartBeat(true);
        playClickSound();
        if (onToggleFavorite) {
            onToggleFavorite();
        }
        setTimeout(() => setHeartBeat(false), 500);
    };

    // Render Setup
    const segment = context.history[viewingIndex] || context.currentSegment;
    const isLatest = viewingIndex === context.history.length - 1;
    const currentShotType = isLatest ? detectShotType(segment?.visualPrompt) : null;
    if (!segment) return null;
    const showChoices = isLatest && textTypingComplete && !isLoading && isUiVisible;
    const getActiveCharacterDisplay = () => {
        const protagonist = context.character;
        const activeName = segment.activeCharacterName || protagonist.name;
        if (activeName === protagonist.name || activeName === '我' || activeName.includes(protagonist.name)) return { name: protagonist.name, avatar: protagonist.avatar, isProtagonist: true };
        const supportChar = context.supportingCharacters?.find(sc => activeName.includes(sc.name));
        if (supportChar) { const currentAffinity = supportChar.affinity ?? supportChar.initialAffinity ?? 0; return { id: supportChar.id, name: supportChar.name, avatar: supportChar.avatar, isProtagonist: false, role: supportChar.role, affinity: currentAffinity }; }
        return { name: activeName, avatar: null, isProtagonist: false };
    };
    const activeCharDisplay = getActiveCharacterDisplay();
    const displayImage = segment.backgroundImage ? segment.backgroundImage : (bgImage || getSmartBackground(context.genre, segment.mood, backgroundStyle as any));
    const getThemeStyles = (genre: StoryGenre) => {
        const inputBase = "transition-all outline-none";
        const transparentOverride = !showStoryPanelBackground ? "!bg-transparent !border-none !shadow-none !backdrop-blur-none" : "";
        switch (genre) {
            case StoryGenre.XIANXIA: case StoryGenre.WUXIA:
                return { container: `${transparentOverride} bg-[#1c1917]/90 border-[#a16207]/60 shadow-[0_0_30px_rgba(161,98,7,0.2)]`, border: "border-[#a16207]/60", font: "font-serif", accent: "text-amber-500", button: "hover:bg-amber-900/40 border-amber-800/40", choice: "hover:border-amber-500/80 hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] border-x-transparent border-y-2 border-y-amber-700/60 bg-stone-900/90 double-border-style", choiceImportant: "border-red-500/80 bg-red-900/30 shadow-[0_0_20px_rgba(220,38,38,0.5)] hover:border-red-400 hover:bg-red-900/50", choiceText: "font-serif text-amber-100", choiceNum: "text-amber-600", triangle: "text-amber-600 hover:text-amber-400", input: `${inputBase} bg-stone-900/90 text-amber-100 placeholder-amber-500/80 border-amber-900/50 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30`, choiceStyle: { borderStyle: "double", borderWidth: "4px", borderLeft: "none", borderRight: "none" } };
            case StoryGenre.CYBERPUNK:
                return { container: `${transparentOverride} bg-black/90 border-cyan-500/60 shadow-[0_0_30px_rgba(6,182,212,0.2)]`, border: "border-cyan-500/60", font: "font-mono", accent: "text-cyan-400", button: "hover:bg-cyan-900/40 border-cyan-800/40", choice: "hover:bg-cyan-900/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] border-none bg-gray-900/80 backdrop-blur-sm", choiceImportant: "bg-yellow-900/30 shadow-[0_0_20px_rgba(250,204,21,0.5)] hover:bg-yellow-900/50", choiceText: "font-mono tracking-wide text-cyan-50", choiceNum: "text-cyan-500", triangle: "text-cyan-500 hover:text-cyan-300", input: `${inputBase} bg-gray-900/95 text-cyan-50 placeholder-cyan-500/80 border-cyan-900/50 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30`, choiceStyle: { clipPath: "polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)", borderLeft: "2px solid rgba(6,182,212,0.5)" } };
            case StoryGenre.ROMANCE:
                return { container: `${transparentOverride} bg-rose-950/90 border-pink-400/50 shadow-[0_0_30px_rgba(244,114,182,0.2)]`, border: "border-pink-400/50", font: "font-sans", accent: "text-pink-400", button: "hover:bg-pink-900/40 border-pink-800/40", choice: "hover:border-pink-400 hover:shadow-[0_0_20px_rgba(244,114,182,0.5)] border-2 border-pink-300/30 bg-gray-900/80 rounded-[24px]", choiceImportant: "border-purple-500 bg-purple-900/30 shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:border-purple-400 hover:bg-purple-900/50", choiceText: "font-sans text-pink-50", choiceNum: "text-pink-400", triangle: "text-pink-400 hover:text-pink-200", input: `${inputBase} bg-gray-900/90 text-pink-50 placeholder-pink-400/80 border-pink-900/50 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/30`, choiceStyle: {} };
            default: 
                return { container: `${transparentOverride} bg-slate-900/90 border-indigo-500/40 shadow-[0_0_30px_rgba(99,102,241,0.2)]`, border: "border-indigo-500/40", font: "font-sans", accent: "text-indigo-400", button: "hover:bg-indigo-900/40 border-indigo-800/40", choice: "hover:border-indigo-400 hover:shadow-[0_0_20px_rgba(129,140,248,0.4)] border border-indigo-900/50 bg-gray-900/90 rounded-lg", choiceImportant: "border-orange-500 bg-orange-900/30 shadow-[0_0_20px_rgba(249,115,22,0.5)] hover:border-orange-400 hover:bg-orange-900/50", choiceText: "text-indigo-50", choiceNum: "text-indigo-400", triangle: "text-indigo-400 hover:text-indigo-200", input: `${inputBase} bg-gray-900/90 text-indigo-50 placeholder-indigo-400/80 border-indigo-900/50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30`, choiceStyle: {} };
        }
    };
    const styles = getThemeStyles(context.genre);
    const nameStyles = getNamePlateStyles(context.genre, activeCharDisplay.isProtagonist);
    const handleNavUp = (e: React.MouseEvent) => { e.stopPropagation(); playClickSound(); if (viewingIndex > 0) setViewingIndex(prev => prev - 1); };
    const handleNavDown = (e: React.MouseEvent) => { e.stopPropagation(); playClickSound(); if (viewingIndex < context.history.length - 1) setViewingIndex(prev => prev + 1); };
    const handleGodModeReplace = () => {
        if (!findText.trim() || !replaceText.trim()) return;
        setReplaceError(null);
        const protectedNames = [context.character.name, ...context.supportingCharacters.map(c => c.name), ...context.character.skills.map(s => s.name)];
        if (protectedNames.some(name => name && name.includes(findText))) { setReplaceError("拒绝执行：目标包含核心角色或技能名称，受法则保护。"); playClickSound(); return; }
        const count = handleGlobalReplace(findText, replaceText);
        if (count > 0) { setShowGodMode(false); setFindText(''); setReplaceText(''); playClickSound(); } else { setReplaceError("未在近期记忆或剧情中找到该文本。"); playClickSound(); }
    };
    const Tooltip = ({ text }: { text: string }) => ( <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-2 py-1 bg-stone-800 text-stone-100 text-xs font-bold rounded shadow-lg whitespace-nowrap opacity-0 group-hover/tool:opacity-100 transition-opacity pointer-events-none z-[100] border border-stone-600"> {text} <div className="absolute top-1/2 right-[-4px] -translate-y-1/2 border-y-4 border-y-transparent border-l-4 border-l-stone-600"></div> </div> );

    const sideToolsContent = (
        <div ref={sideToolsRef} className="flex flex-col gap-3 pointer-events-auto items-end">
            <div className="relative group/tool flex items-center">
                {!showGodMode && !showMemory && !showInventory && !showScheduler && <Tooltip text="剧情回顾：查看完整故事历史" />}
                <button onClick={(e) => { e.stopPropagation(); playClickSound(); onOpenHistoryModal(); setShowGodMode(false); setShowMemory(false); setShowInventory(false); setShowScheduler(false); }} className={`shadow-lg transition-all duration-300 rounded-full w-12 h-12 flex items-center justify-center border-2 bg-stone-800 border-stone-600 text-stone-200 hover:scale-110`} title="剧情回顾">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                </button>
            </div>

            {/* Scheduler Button & Panel */}
            <div className="relative group/tool flex items-center">
                {!showScheduler && <Tooltip text="伏笔预设：安排未来剧情事件" />}
                <div 
                    className={`absolute top-0 right-full mr-4 bg-stone-100/95 backdrop-blur border border-stone-300 shadow-2xl flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] origin-top-right rounded-xl overflow-hidden z-[150] ${showScheduler ? 'w-[280px] opacity-100 scale-100 visible' : 'w-[280px] opacity-0 scale-90 invisible pointer-events-none'}`}
                    onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} 
                >
                    <div className="bg-stone-200/80 p-3 border-b border-stone-300 flex justify-between items-center relative overflow-hidden shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(59,130,246,0.5)]"></div>
                            <h4 className="text-sm font-bold text-stone-700 font-mono tracking-widest uppercase">预设事件 / 剧本</h4>
                        </div>
                        <button 
                            onClick={() => { setEventToEdit(null); setShowAddEventModal(true); setShowScheduler(false); }}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs transition-colors shadow-sm"
                            title="添加新预设"
                        >
                            +
                        </button>
                    </div>
                    {/* Fixed max-height and hidden scrollbar logic */}
                    <div className="p-3 space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        {/* List - Pending */}
                        <div className="space-y-2">
                            {context.scheduledEvents?.filter(e => e.status === 'pending').map(e => (
                                <div 
                                    key={e.id} 
                                    className="bg-yellow-50 border-l-4 border-yellow-400 p-2 rounded shadow-sm relative group/item hover:bg-yellow-100 transition-colors cursor-pointer select-none"
                                    onClick={() => handleEditEvent(e)}
                                    title="点击编辑"
                                >
                                    <div className="text-[10px] text-gray-500 flex justify-between font-bold">
                                        <span>{e.type} @ {e.location || '未知'}</span>
                                        <div className="flex items-center gap-1">
                                            <span className="bg-yellow-100 text-yellow-700 px-1 rounded">待触发</span>
                                            <button 
                                                onClick={(evt) => handleRemoveEvent(e.id, evt)}
                                                className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors z-20 pointer-events-auto"
                                                title="删除"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-800 font-medium mt-1 leading-tight">{e.description}</div>
                                </div>
                            ))}
                            {(!context.scheduledEvents || context.scheduledEvents.filter(e => e.status === 'pending').length === 0) && <div className="text-[10px] text-gray-400 text-center italic py-2">暂无待触发的伏笔</div>}
                        </div>
                        
                        {/* List - Completed */}
                        {context.scheduledEvents && context.scheduledEvents.filter(e => e.status === 'completed').length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-stone-200">
                                <h5 className="text-[10px] font-bold text-gray-400 uppercase">已回收伏笔</h5>
                                {context.scheduledEvents.filter(e => e.status === 'completed').map(e => (
                                    <div key={e.id} className="bg-green-50 border-l-4 border-green-500 p-2 rounded shadow-sm opacity-70 relative group/item">
                                        <div className="text-[10px] text-gray-500 flex justify-between">
                                            <span>{e.type}</span>
                                            <div className="flex items-center gap-1">
                                                <span className="text-green-600">已于第 {e.triggeredTurn} 幕触发</span>
                                                <button 
                                                    onClick={(evt) => handleRemoveEvent(e.id, evt)}
                                                    className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors z-20 pointer-events-auto"
                                                    title="删除"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-600 mt-1 line-through">{e.description}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); playClickSound(); setShowScheduler(!showScheduler); setShowGodMode(false); setShowMemory(false); setShowInventory(false); }} className={`shadow-lg transition-all duration-300 rounded-full w-12 h-12 flex items-center justify-center border-2 ${showScheduler ? 'bg-stone-100 border-stone-300 text-stone-600' : 'bg-stone-800 border-stone-600 text-stone-200 hover:scale-110'}`} title="预设事件">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                    </svg>
                </button>
            </div>

            {/* Other side tools... */}
            <div className="relative group/tool flex items-center">
                 {!showGodMode && <Tooltip text="全局查找替换：修正记忆与近期剧情中的错误内容" />}
                 <div className={`absolute bottom-0 right-full mr-4 mb-0 bg-stone-100/95 backdrop-blur border border-stone-300 shadow-2xl flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] origin-bottom-right rounded-xl overflow-hidden z-[90] ${showGodMode ? 'w-[280px] opacity-100 scale-100 visible' : 'w-[280px] opacity-0 scale-90 invisible pointer-events-none'}`} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} >
                        <div className="bg-stone-200/80 p-3 border-b border-stone-300 flex justify-between items-center"> <h4 className="text-sm font-bold text-stone-700 font-mono tracking-widest uppercase flex items-center gap-2"><span className="text-base"></span> 全局修正</h4><span className="text-[9px] text-gray-400 bg-stone-300/30 px-1 rounded">范围: 最近5段</span></div>
                        <div className="p-4 space-y-3">
                            <div className="space-y-1"><label className="text-[10px] text-gray-500 font-bold block">查找内容</label><input value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="输入错误文本..." className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 text-xs text-stone-800 outline-none focus:border-stone-500"/></div>
                            <div className="space-y-1"><label className="text-[10px] text-gray-500 font-bold block">替换为</label><input value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="输入正确文本..." className="w-full bg-white border border-stone-300 rounded px-2 py-1.5 text-xs text-stone-800 outline-none focus:border-stone-500"/></div>
                            {replaceError && <div className="text-[10px] text-red-500 font-bold bg-red-50 p-2 rounded border border-red-100">{replaceError}</div>}
                            <p className="text-[9px] text-gray-400 leading-tight">* 仅修正记忆区与最近5段剧情。<br/>* 主角/配角档案及技能不可修改。</p>
                            <button onClick={handleGodModeReplace} disabled={!findText.trim() || !replaceText.trim()} className="w-full bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-bold py-2 rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors">执行修正</button>
                        </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); playClickSound(); setShowGodMode(!showGodMode); setShowMemory(false); setShowInventory(false); setShowScheduler(false); }} className={`shadow-lg transition-all duration-300 rounded-full w-12 h-12 flex items-center justify-center border-2 ${showGodMode ? 'bg-stone-100 border-stone-300 text-stone-600' : 'bg-stone-800 border-stone-600 text-stone-200 hover:scale-110'}`} title="全局查找替换">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" /></svg>
                </button>
            </div>

            <div className="relative group/tool flex items-center">
                {!showMemory && <Tooltip text="记忆核心：查看当前故事的各类记忆状态" />}
                <div className={`absolute bottom-0 right-full mr-4 mb-0 bg-stone-100/95 backdrop-blur border border-stone-300 shadow-2xl flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] origin-bottom-right rounded-xl overflow-hidden z-[90] ${showMemory ? 'w-[320px] opacity-100 scale-100 visible' : 'w-[320px] opacity-0 scale-90 invisible pointer-events-none'}`} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                        <div className="w-full flex flex-col max-h-[50vh]">
                        <div className="bg-stone-200/80 p-3 border-b border-stone-300 flex justify-between items-center relative overflow-hidden shrink-0">
                                <div className="flex items-center gap-2"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.5)]"></div><h4 className="text-sm font-bold text-stone-700 font-mono tracking-widest uppercase">记忆核心</h4></div>
                                <span className="text-[10px] text-stone-500 bg-stone-300/50 px-1.5 rounded font-mono">实时同步</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 relative bg-stone-100 min-h-[200px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                            <MemoryAccordionItem title="记忆区" content={context.memories?.memoryZone} type="active" context={context} />
                            <MemoryAccordionItem title="剧情记忆" content={context.memories?.storyMemory} type="active" context={context} onSummarize={handleSummarizeMemory} isSummarizing={isSummarizing} />
                            <MemoryAccordionItem title="长期记忆" content={context.memories?.longTermMemory} type="archived" context={context} />
                            <MemoryAccordionItem title="核心记忆" content={context.memories?.coreMemory} type="core" context={context} />
                            <MemoryAccordionItem title="角色状态" content={context.memories?.characterRecord} type="active" context={context} />
                        </div>
                    </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); playClickSound(); setShowMemory(!showMemory); setShowGodMode(false); setShowInventory(false); setShowScheduler(false); }} className={`shadow-lg transition-all duration-300 rounded-full w-12 h-12 flex items-center justify-center border-2 ${showMemory ? 'bg-stone-100 border-stone-300 text-stone-600' : 'bg-stone-800 border-stone-600 text-stone-200 hover:scale-110'}`} title="记忆区">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" /></svg>
                </button>
            </div>

            <div className="relative group/tool flex items-center">
                {!showInventory && <Tooltip text="物品清单：查看角色持有的道具与伏笔" />}
                <div className={`absolute bottom-0 right-full mr-4 mb-0 bg-stone-100/95 backdrop-blur border border-stone-300 shadow-2xl flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] origin-bottom-right rounded-xl overflow-hidden z-[90] ${showInventory ? 'w-[320px] opacity-100 scale-100 visible' : 'w-[320px] opacity-0 scale-90 invisible pointer-events-none'}`} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                    <div className="w-full flex flex-col max-h-[50vh]">
                    <div className="bg-stone-200/80 p-3 border-b border-stone-300 flex justify-between items-center relative overflow-hidden shrink-0">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div><h4 className="text-sm font-bold text-stone-700 font-mono tracking-widest uppercase">物品清单</h4></div>
                            <span className="text-[10px] text-stone-500 bg-stone-300/50 px-1.5 rounded font-mono truncate max-w-[120px]">{activeCharDisplay.isProtagonist ? "当前: 主角" : `当前: ${activeCharDisplay.name}`}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 relative bg-stone-100 min-h-[200px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        <div className="text-[10px] text-emerald-600 mb-2 bg-emerald-50 p-2 rounded border border-emerald-100 italic">* 背包记录了当前小队及活跃角色的重要持有物</div>
                        <MemoryAccordionItem title="持有物品 / 伏笔" content={context.memories?.inventory} type="inventory" context={context} activeCharName={activeCharDisplay.name} />
                    </div>
                </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); playClickSound(); setShowInventory(!showInventory); setShowMemory(false); setShowGodMode(false); setShowScheduler(false); }} className={`shadow-lg transition-all duration-300 rounded-full w-12 h-12 flex items-center justify-center border-2 ${showInventory ? 'bg-stone-100 border-stone-300 text-stone-600' : 'bg-stone-800 border-stone-600 text-stone-200 hover:scale-110'}`} title="背包 / 物品">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 004.25 22.5h15.5a1.875 1.875 0 001.865-2.071l-1.263-12a1.875 1.875 0 00-1.865-1.679H16.5V6a4.5 4.5 0 10-9 0zM12 3a3 3 0 00-3 3v.75h6V6a3 3 0 00-3-3zm-3 8.25a3 3 0 106 0v-.75a.75.75 0 011.5 0v.75a4.5 4.5 0 11-9 0v-.75a.75.75 0 011.5 0v.75z" clipRule="evenodd" /></svg>
            </button>
        </div>
        </div>
    );

    // ... (renderChoices, renderTextInput, renderPaginator, getBubbleStyles remain unchanged) ...
    const renderChoices = (isChatMode: boolean) => (
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 ${isChatMode ? 'w-full max-w-4xl mx-auto' : ''}`}>
            {segment.choices.map((choice, idx) => {
                const isImportant = choice.startsWith("【命运】");
                const displayChoice = isImportant ? choice.replace("【命运】", "").trim() : choice;
                return (
                    <button key={idx} onClick={() => handleChoice(choice, viewingIndex)} className={`group relative px-4 py-2.5 rounded-lg text-left transition-all duration-300 transform hover:scale-[1.02] overflow-hidden border ${isImportant ? styles.choiceImportant : styles.choice}`} style={styles.choiceStyle}>
                        <div className={`absolute inset-0 bg-gradient-to-r from-white/5 to-transparent w-0 group-hover:w-full transition-all duration-500`} />
                        <div className="relative z-10 flex gap-2 items-center">
                            {isImportant && <span className="text-xl animate-pulse">⚡</span>}
                            <span className={`${styles.choiceNum} ${styles.font} opacity-60 group-hover:opacity-100 transition-opacity italic`}>{idx + 1}.</span>
                            <span className={`${styles.choiceText} group-hover:text-white text-sm ${isImportant ? 'font-bold tracking-wide' : ''}`}>{displayChoice}</span>
                        </div>
                    </button>
                );
            })}
        </div>
    );

    const renderTextInput = (isChatMode: boolean) => (
        <div className={`flex gap-3 items-end w-full max-w-5xl mx-auto`}>
            <div className="relative flex-1">
                <AutocompleteList suggestions={suggestions} onSelect={handleSuggestionSelect} />
                 <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); if (inputText.trim()) handleChoice(inputText, viewingIndex); } }} placeholder="按 Enter 换行，Shift + Enter 发送... (输入 /技能 #物品 @角色 可联想)" className={`w-full p-4 rounded-lg shadow-lg resize-none min-h-[80px] max-h-[120px] custom-scrollbar ${styles.input} ${styles.font}`} autoFocus />
            </div>
            { (isLoading || (isLatest && !textTypingComplete)) ? (
                <div className={`h-[80px] w-[80px] rounded-lg font-bold transition-all border flex items-center justify-center ${styles.container} opacity-100`}>
                     <div className="flex flex-col items-center justify-center gap-2">
                        <div className="flex gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${styles.accent.replace('text-', 'bg-').replace('400', '500')} animate-pulse`}></div>
                            <div className={`w-1.5 h-1.5 rounded-full ${styles.accent.replace('text-', 'bg-').replace('400', '500')} animate-pulse delay-200`}></div>
                        </div>
                        <span className={`text-[9px] font-mono tracking-widest ${styles.accent}`}>思考中</span>
                     </div>
                </div>
            ) : (
                <button onClick={() => { if(inputText.trim()) { handleChoice(inputText, viewingIndex); } else { handleRegenerate(); } }} className={`h-[80px] w-[80px] rounded-lg font-bold transition-all border flex items-center justify-center ${styles.button} hover:scale-105 opacity-100 ${styles.container}`} title={inputText.trim() ? "发送" : "重新生成上一条"}>
                     {inputText.trim() ? ( <span className="text-2xl">➤</span> ) : ( <span className="text-2xl">↻</span> )}
                </button>
            )}
        </div>
    );

    const renderPaginator = () => (
        <div className="flex justify-center mt-2 mb-0">
            <div className="flex items-center gap-2 bg-stone-900/90 backdrop-blur-md border border-white/5 rounded px-3 py-1.5 shadow-xl transform scale-90 hover:scale-95 transition-transform duration-300 group">
                <div className="w-1.5 h-1.5 rounded-full bg-stone-700 flex items-center justify-center"><div className="w-1 h-[1px] bg-stone-900 transform rotate-45"></div></div>
                <div className="flex gap-1 p-0.5 bg-black/50 rounded border border-white/5">
                    <button onClick={() => { playClickSound(); setInputPage(0); }} className={`h-1.5 w-6 rounded-[1px] transition-all duration-300 ${inputPage === 0 ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]' : 'bg-stone-800 hover:bg-stone-600'}`} title="模式 A" />
                    <button onClick={() => { playClickSound(); setInputPage(1); }} className={`h-1.5 w-6 rounded-[1px] transition-all duration-300 ${inputPage === 1 ? 'bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'bg-stone-800 hover:bg-stone-600'}`} title="模式 B" />
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-stone-700 flex items-center justify-center"><div className="w-1 h-[1px] bg-stone-900 transform rotate-12"></div></div>
            </div>
        </div>
    );

    const getBubbleStyles = (charName: string) => {
        const protagonist = context.character;
        if (charName === protagonist.name || charName === '我' || charName.includes(protagonist.name)) return { border: 'border-amber-500/50', bg: 'bg-amber-950/30' };
        const npc = context.supportingCharacters.find(c => charName.includes(c.name));
        if (npc) {
            if (npc.category === 'villain' || (npc.affinity || 0) <= -20) return { border: 'border-red-500/50', bg: 'bg-red-950/30' };
            if (npc.category === 'protagonist' || (npc.affinity || 0) >= 30) return { border: 'border-emerald-500/50', bg: 'bg-emerald-950/30' };
        }
        return null; 
    }

    return (
      <div className={`relative w-full h-screen overflow-hidden bg-black select-none ${battleAnim || ''}`}>
        <SmoothBackground src={displayImage} shouldBlur={shouldBlurBackground} brightness={isUiVisible ? 0.6 : 1.0} position="center" shotType={currentShotType} />
        <VisualEffectsLayer type={visualEffect} onComplete={() => setVisualEffect('none')} />
        
        {/* Entity Tooltip Rendered at Root Level */}
        {tooltipData && <EntityTooltipRenderer info={tooltipData.info} rect={tooltipData.rect} />}

        {/* Render Modals at Root Level */}
        {showAddEventModal && (
            <AddEventModal 
                onClose={() => setShowAddEventModal(false)} 
                onConfirm={handleConfirmEvent}
                characters={context.supportingCharacters}
                protagonistName={context.character.name}
                initialEvent={eventToEdit}
            />
        )}

        <div className={`absolute inset-0 z-10 cursor-pointer transition-opacity ${isUiVisible ? 'block' : 'hidden'}`} onClick={() => setIsUiVisible(false)} title="点击隐藏界面 (沉浸模式)" />
        {generatingImage && (
            <div className="absolute top-20 right-4 z-20 bg-black/40 backdrop-blur px-3 py-1 rounded-full flex items-center gap-2 border border-white/10 animate-pulse">
                 <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                 <span className="text-[10px] text-white/80">具象化重构中...</span>
            </div>
        )}
        <div className={`absolute top-0 left-0 right-0 p-4 z-30 flex justify-between items-start transition-opacity duration-500 ${isUiVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
             <div className="flex items-center">
                <button onClick={handleBackToHome} className="p-3 rounded-full bg-black/30 backdrop-blur text-white hover:bg-white/20 border border-white/10 transition-all mr-2 group" title="返回标题">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 group-hover:scale-110 transition-transform"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
                </button>
                <button onClick={handleManualSave} className="p-3 rounded-full bg-black/30 backdrop-blur text-white hover:bg-white/20 border border-white/10 transition-all mr-4 group" title="保存当前进度">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 group-hover:text-green-400 transition-colors"><path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
                </button>
                <div className="flex flex-col">
                    <span className="text-white/60 text-[10px] font-mono tracking-widest uppercase shadow-black drop-shadow-md">{`《${context.storyName || '未命名'}》 / ${context.genre.split(' - ')[0]} / ${context.character.name}`}</span>
                    {autoSaveState === 'complete' && <div className="mt-1 flex items-center gap-1 animate-fade-in-right"><div className="h-1 w-1 bg-orange-500"></div><span className="text-[9px] text-orange-500 font-mono tracking-widest">系统存档完成</span></div>}
                     {autoSaveState === 'saving' && <div className="mt-1 flex items-center gap-1 animate-pulse"><div className="h-1 w-1 bg-yellow-500 rounded-full"></div><span className="text-[9px] text-yellow-500 font-mono tracking-widest">记录写入中...</span></div>}
                </div>
             </div>
             <div className="flex items-center gap-3 justify-end flex-wrap max-w-[50vw]">
                 <button onClick={() => { playClickSound(); onOpenSettings(); }} className="p-2 rounded-full bg-black/30 backdrop-blur text-white hover:bg-white/20 border border-white/10 transition-all hover:rotate-90 duration-500" title="系统设置"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.43.811 1.035.811 1.73 0 .695-.316 1.3-.811 1.73m0-3.46a24.42 24.42 0 010 3.46" /></svg></button>
                 
                 {/* Heart / Favorite Button */}
                 <button 
                    onClick={triggerHeart} 
                    className="p-2 rounded-full bg-black/30 backdrop-blur border border-white/10 transition-all hover:bg-white/20 group relative overflow-hidden" 
                    title="收藏当前场景至画廊"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" fill={isCurrentBgFavorited ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 group-hover:text-red-500 transition-colors ${heartBeat ? 'text-red-500 animate-ping' : isCurrentBgFavorited ? 'text-red-500' : 'text-white'}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                     </svg>
                     {heartBeat && <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping"></span>}
                 </button>

                 <div className="relative" onMouseEnter={() => setShowSpeedControl(true)} onMouseLeave={() => setShowSpeedControl(false)}>
                     <button className="px-3 py-2 rounded-full bg-black/30 backdrop-blur text-white/80 hover:text-white border border-white/10 text-xs font-mono flex items-center gap-1 transition-colors"><span>{typingSpeed === 0 ? "MAX" : (100 - typingSpeed)/10 + "x"}</span></button>
                     <div className={`absolute top-full left-0 w-full h-4 ${showSpeedControl ? 'block' : 'hidden'}`}></div>
                     {showSpeedControl && <div className="absolute top-full left-0 mt-2 p-3 bg-stone-100 border border-stone-300 text-gray-800 rounded-lg shadow-xl min-w-[140px] z-50 animate-fade-in-up"><label className="text-[10px] text-gray-500 uppercase block mb-1 font-bold">打印速度</label><input type="range" min="0" max="50" step="10" value={50 - typingSpeed} onChange={(e) => setTypingSpeed(50 - parseInt(e.target.value))} className="w-full h-1 bg-stone-300 rounded-lg appearance-none cursor-pointer accent-indigo-500"/></div>}
                 </div>
                 <button onClick={() => { playClickSound(); setIsUiVisible(false); }} className="p-2 rounded-full bg-black/30 backdrop-blur text-white hover:bg-white/20 border border-white/10 transition-all" title="隐藏界面 (Tab)"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
                 <div className="group relative flex items-center bg-black/30 backdrop-blur rounded-full border border-white/10 transition-all hover:bg-black/50">
                     <button onClick={() => { setIsMuted(!isMuted); playClickSound(); }} className={`p-2 rounded-full text-white transition-all ${isMuted ? 'text-red-400' : ''}`} title="取消静音" >{isMuted || volume === 0 ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>}</button>
                    <div className="w-0 overflow-hidden group-hover:w-24 transition-all duration-300 flex items-center pr-0 group-hover:pr-3"><input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); if(isMuted && parseFloat(e.target.value) > 0) setIsMuted(false); }} className="w-20 h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-purple-500" /></div>
                 </div>
                <button onClick={() => { playClickSound(); onOpenRegenConfirm(); }} className="p-2 rounded-full bg-black/30 backdrop-blur text-white hover:bg-white/20 border border-white/10 transition-all" title="重绘当前场景"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg></button>
                <button onClick={() => { playClickSound(); onOpenImageModal(); }} className="h-10 px-4 flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs tracking-widest uppercase transition-all active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-[4px_4px_0_rgba(0,0,0,0.5)] active:shadow-none border-2 border-black" style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)` }} disabled={generatingImage || isLoading} title="视觉具象化"><span className="font-sans font-black">{generatingImage ? "生成中..." : "具象化"}</span></button>
             </div>
        </div>
        {!isUiVisible && <div className="absolute inset-0 z-50 cursor-pointer" onClick={() => setIsUiVisible(true)} title="点击恢复界面" />}
        <div className={`absolute bottom-0 left-0 w-full z-20 transition-all duration-500 transform ${isUiVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
            <div className="max-w-6xl mx-auto w-full px-4 pb-6 flex flex-col justify-end gap-4 relative pointer-events-none">
            {inputMode === 'choice' && (
                <div className="absolute -top-14 left-0 z-[60] flex items-end gap-0 animate-fade-in-left pointer-events-auto">
                    <GenreAvatar avatar={activeCharDisplay.avatar || undefined} name={activeCharDisplay.name} genre={context.genre} isProtagonist={activeCharDisplay.isProtagonist} onClick={() => { playClickSound(); onOpenCharacterModal(activeCharDisplay.id || undefined); }} size="lg" />
                    <div className="flex items-stretch gap-2 pb-1 relative z-10 -ml-3">
                        <div className={nameStyles.container}>
                            <div className="flex items-center gap-2"><span className={`text-lg ${nameStyles.name}`}>{activeCharDisplay.name}</span>{activeCharDisplay.role && <span className={`text-[10px] px-1.5 py-0.5 rounded ${nameStyles.role}`}>{activeCharDisplay.role}</span>}</div>
                            {!activeCharDisplay.isProtagonist && activeCharDisplay.affinity !== undefined && (<div className="flex items-center gap-2 mt-1 bg-black/20 rounded-full px-2 py-0.5 border border-white/5"><span className="text-[10px] text-pink-400 font-bold">♥ {activeCharDisplay.affinity}</span><div className="h-1.5 w-16 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-pink-600 to-pink-400 shadow-[0_0_5px_rgba(236,72,153,0.5)] transition-all duration-500" style={{ width: `${Math.min(Math.max(((activeCharDisplay.affinity + 50) / 100) * 100, 0), 100)}%` }} /></div></div>)}
                        </div>
                    </div>
                </div>
            )}
            {inputMode === 'choice' ? (
                <div className={`${styles.container} group backdrop-blur-md border rounded-xl shadow-2xl relative overflow-visible animate-fade-in-up mt-4 transition-all duration-500 flex flex-col pointer-events-auto z-[50]`}>
                    {isLoading && (
                        <div className={`absolute top-0 left-0 right-0 h-10 ${styles.border} border-b flex items-center justify-center gap-3 px-4 animate-fade-in-up bg-black/30 backdrop-blur-sm z-20`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${styles.accent.replace('text-', 'bg-').replace('400', '500')} animate-pulse shadow-lg`}></div>
                            <span className={`text-[10px] font-mono tracking-widest ${styles.accent}`}>推演未来轨迹中...</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${styles.accent.replace('text-', 'bg-').replace('400', '500')} animate-pulse shadow-lg delay-200`}></div>
                        </div>
                    )}
                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50 z-10 ${!showStoryPanelBackground ? 'hidden' : ''}`}></div>
                    <div className="absolute -right-16 bottom-0 z-[100]">{sideToolsContent}</div>
                    <div className="absolute bottom-3 left-6 flex flex-col items-start z-20 pointer-events-auto opacity-0 hover:opacity-100 transition-opacity duration-300"><span className={`text-[10px] font-mono font-bold text-white/90 bg-black/50 backdrop-blur-md px-2 py-1 rounded border border-white/20 shadow-sm cursor-default`}>{segment.text.length}字 / ≈{Math.round(segment.text.length * 1.3)} tokens</span></div>
                    <div className="flex-1 overflow-y-auto p-5 md:p-6 pt-10 pb-12 max-h-[43vh] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        <div className={`${styles.font} leading-relaxed select-text cursor-text pointer-events-auto`} onMouseDown={(e) => e.stopPropagation()} style={{ fontSize: `${storyFontSize}px`, fontFamily: storyFontFamily }}>
                            <TypingText key={segment.id} text={segment.text} speed={typingSpeed === 0 ? 0 : typingSpeed} onComplete={() => { if (isLatest) setTextTypingComplete(true); }} instant={!isLatest || (isLatest && textTypingComplete) || typingSpeed === 0} context={context} onHoverEntity={handleHoverEntity} />
                        </div>
                    </div>
                    <div className="absolute bottom-4 right-4 flex flex-row gap-4 z-20 items-center bg-inherit rounded-tl-lg pl-2 pt-2 opacity-0 hover:opacity-100 transition-opacity duration-300">
                        <button onClick={handleNavUp} disabled={viewingIndex <= 0} className={`p-1 transition-all transform hover:scale-125 ${viewingIndex <= 0 ? 'opacity-20 cursor-not-allowed' : `opacity-60 cursor-pointer ${styles.triangle}`}`} title="上一段剧情"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path fillRule="evenodd" d="M11.47 7.72a.75.75 0 011.06 0l7.5 7.5a.75.75 0 11-1.06 1.06L12 9.31l-6.97 6.97a.75.75 0 01-1.06-1.06l7.5-7.5z" clipRule="evenodd" /></svg></button>
                        <button onClick={handleNavDown} disabled={viewingIndex >= context.history.length - 1} className={`p-1 transition-all transform hover:scale-125 ${viewingIndex >= context.history.length - 1 ? 'opacity-20 cursor-not-allowed' : `opacity-60 cursor-pointer ${styles.triangle}`}`} title="下一段剧情"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path fillRule="evenodd" d="M12.53 16.28a.75.75 0 01-1.06 0l-7.5-7.5a.75.75 0 011.06-1.06L12 14.69l6.97-6.97a.75.75 0 111.06 1.06l-7.5 7.5z" clipRule="evenodd" /></svg></button>
                    </div>
                    {!isLatest && <div className="absolute top-2 right-4 px-2 py-0.5 bg-black/50 rounded text-[10px] text-white/50 font-mono uppercase border border-white/10 z-20">历史回溯 [{viewingIndex + 1}/{context.history.length}]</div>}
                </div>
            ) : (
                <div className="pointer-events-auto h-[70vh] w-full flex flex-col justify-end relative" onClick={() => setIsUiVisible(false)}>
                    <div className="overflow-y-auto px-4 pt-6 space-y-6 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        {context.history.map((seg, idx) => {
                            const isCurrent = idx === context.history.length - 1;
                            const isUserCaused = !!seg.causedBy;
                            const protagonist = context.character;
                            const segName = seg.activeCharacterName || protagonist.name;
                            const isProtagonistSpeaking = segName === protagonist.name || segName === '我';
                            const charAvatar = isProtagonistSpeaking ? protagonist.avatar : (context.supportingCharacters.find(c => segName.includes(c.name))?.avatar);
                            const supportingChar = !isProtagonistSpeaking ? context.supportingCharacters.find(c => segName.includes(c.name)) : null;
                            const hasVersions = seg.versions && seg.versions.length > 1;
                            const factionStyle = getBubbleStyles(segName);
                            const bubbleContainerClass = factionStyle ? `border ${factionStyle.border} ${factionStyle.bg}` : `${styles.container}`;
                            return (
                                <div key={seg.id} className="flex flex-col gap-4">
                                    {isUserCaused && (<div className="flex justify-end animate-fade-in-up" onClick={(e) => e.stopPropagation()}><div className="max-w-[80%] bg-stone-200 text-gray-800 p-4 rounded-2xl shadow-md border border-stone-300 relative"><div className="text-sm font-sans whitespace-pre-wrap select-text cursor-text">{seg.causedBy}</div></div></div>)}
                                    <div className="flex justify-start animate-fade-in-up delay-100 items-start" onClick={(e) => e.stopPropagation()}>
                                         <div className="ml-3 mr-2 shrink-0 pt-0 z-20 translate-x-1"><GenreAvatar avatar={charAvatar} name={segName} genre={context.genre} isProtagonist={isProtagonistSpeaking} onClick={() => { playClickSound(); onOpenCharacterModal(supportingChar?.id); }} className="w-24 h-24 md:w-28 md:h-28 text-xl" /></div>
                                         <div className={`max-w-[85%] p-5 rounded-2xl shadow-lg relative group bg-opacity-95 ${bubbleContainerClass}`}>
                                             <div className="flex items-center gap-2 mb-2 opacity-60">
                                                 <span className={`text-xs font-bold ${styles.accent}`}>{segName}</span>
                                                 {supportingChar && supportingChar.affinity !== undefined && (<div className="flex items-center gap-1 ml-2 bg-black/20 px-1.5 py-0.5 rounded-full"><span className="text-[10px] text-pink-500 font-bold">♥ {supportingChar.affinity}</span><div className="w-8 h-1 bg-black/20 rounded-full overflow-hidden"><div className="h-full bg-pink-500 transition-all" style={{width: `${Math.min(Math.max(((supportingChar.affinity + 50) / 100) * 100, 0), 100)}%`}} /></div></div>)}
                                             </div>
                                             <div className={`${styles.font} leading-relaxed mb-2 select-text cursor-text pointer-events-auto`} onMouseDown={(e) => e.stopPropagation()} style={{ fontSize: `${storyFontSize}px`, fontFamily: storyFontFamily }}>{isCurrent ? ( <TypingText text={seg.text} speed={typingSpeed === 0 ? 0 : typingSpeed} onComplete={() => setTextTypingComplete(true)} instant={typingSpeed === 0} context={context} onHoverEntity={handleHoverEntity} /> ) : ( <span>{seg.text}</span> )}</div>
                                             <div className="mt-2 pt-2 border-t border-white/5 flex items-center opacity-50 text-[9px] font-mono"><span>{seg.text.length}字 / ≈{Math.round(seg.text.length * 1.3)} tokens</span></div>
                                             {hasVersions && (<div className="absolute -bottom-3 right-0 bg-black/80 backdrop-blur text-white text-[10px] rounded-full px-2 py-0.5 border border-white/20 flex items-center gap-2 shadow-sm z-30 cursor-pointer"><button onClick={(e) => { e.stopPropagation(); handleSwitchVersion(seg.id, 'prev'); }} className="hover:text-purple-400 px-1 font-bold">‹</button><span className="font-mono select-none">{(seg.currentVersionIndex || 0) + 1}/{seg.versions?.length}</span><button onClick={(e) => { e.stopPropagation(); handleSwitchVersion(seg.id, 'next'); }} className="hover:text-purple-400 px-1 font-bold">›</button></div>)}
                                         </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="absolute -right-3 bottom-4 z-[100]">{sideToolsContent}</div>
                </div>
            )}
             {showChoices && (<div className="animate-fade-in-up animation-delay-300 pointer-events-auto z-[70]" onClick={(e) => e.stopPropagation()}>{inputMode === 'choice' ? ( inputPage === 0 ? renderChoices(false) : renderTextInput(false) ) : ( inputPage === 0 ? renderTextInput(true) : renderChoices(true) )} {renderPaginator()} </div>)}
          </div>
        </div>
      </div>
    );
};