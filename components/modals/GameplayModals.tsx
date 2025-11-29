

import React from 'react';
import { GameContext, ImageSize, StoryMood, MOOD_LABELS, SupportingCharacter, Character } from '../../types';
import { Button } from '../Button';

// Helper for location icons based on keywords
// Updated to use black and white Unicode symbols/icons instead of colorful emojis
const getLocationIcon = (loc?: string): string => {
    if (!loc) return '◎';
    if (loc.match(/山|峰|岭/)) return '⛰️'; // Mountain
    if (loc.match(/林|森/)) return '🌲'; // Tree/Forest
    if (loc.match(/河|湖|海|水|溪/)) return '≋'; // Water
    if (loc.match(/城|镇|市|都/)) return '♜'; // Tower/City
    if (loc.match(/村|庄/)) return '⌂'; // House/Village
    if (loc.match(/客栈|酒楼|屋|室|房/)) return '🍚'; // Inn (Hot spring symbol often used for amenities)
    if (loc.match(/宫|殿|府/)) return '🏛️'; // Shrine/Palace
    if (loc.match(/庙|寺/)) return '卍'; // Temple
    if (loc.match(/洞|窟/)) return '∩'; // Cave
    if (loc.match(/路|道|途/)) return '🏞'; // Path
    if (loc.match(/船|舟/)) return '⚓'; // Boat/Anchor
    return '◎'; // Default Location
};

export const ExitConfirmModal = ({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-stone-100 border border-stone-200 p-6 rounded-xl shadow-2xl max-w-sm w-full text-center animate-fade-in-up">
            <h3 className="text-xl font-bold text-gray-800 mb-2">返回标题?</h3>
            <p className="text-sm text-gray-600 mb-6">当前进度将仅保存至本地，未完成的对话可能丢失。</p>
            <div className="flex justify-center gap-4">
                <button 
                    onClick={onCancel}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold font-mono px-6 py-2 clip-path-polygon hover:shadow-lg transition-all active:translate-y-0.5 text-sm"
                    style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                >
                    取消
                </button>
                <button 
                    onClick={onConfirm}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold font-mono px-6 py-2 clip-path-polygon hover:shadow-lg transition-all active:translate-y-0.5 text-sm"
                    style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                >
                    确定退出
                </button>
            </div>
        </div>
    </div>
);

export const RegenConfirmModal = ({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-stone-100 border border-stone-200 p-6 rounded-xl shadow-2xl max-w-sm w-full text-center animate-fade-in-up">
            <h3 className="text-xl font-bold text-gray-800 mb-2">重绘当前场景?</h3>
            <p className="text-sm text-gray-600 mb-6">将根据当前剧情重新生成背景图片。</p>
            <div className="flex justify-center gap-4">
                <button 
                    onClick={onCancel}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold font-mono px-6 py-2 clip-path-polygon hover:shadow-lg transition-all active:translate-y-0.5 text-sm"
                    style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                >
                    取消
                </button>
                <button 
                    onClick={onConfirm}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono px-6 py-2 clip-path-polygon hover:shadow-lg transition-all active:translate-y-0.5 text-sm"
                    style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                >
                    立即重绘
                </button>
            </div>
        </div>
    </div>
);

const toChineseNum = (num: number) => {
    const chinese = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    if (num <= 10) return chinese[num];
    if (num < 20) return '十' + (num % 10 === 0 ? '' : chinese[num % 10]);
    if (num < 100) {
        const ten = Math.floor(num / 10);
        const unit = num % 10;
        return chinese[ten] + '十' + (unit === 0 ? '' : chinese[unit]);
    }
    return num.toString(); 
};

export const HistoryModal = ({ history, onClose, fontSize, fontFamily }: { history: any[], onClose: () => void, fontSize: number, fontFamily?: string }) => {
    
    const totalWords = history.reduce((acc, cur) => acc + (cur.text?.length || 0), 0);

    const handleExport = () => {
        const title = `主角光环 - 剧情回顾 (${new Date().toLocaleDateString()})`;
        const mdContent = `# ${title}\n\n` + history.map((h, i) => {
            const userPart = h.causedBy ? `> **我**: ${h.causedBy}\n\n` : '';
            return `## 第${toChineseNum(i + 1)}幕\n**角色**: ${h.activeCharacterName || '未知'}\n\n${userPart}${h.text}\n`
        }).join('\n---\n\n');
        
        const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `story_history_${new Date().toISOString().slice(0,10)}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6" onClick={onClose}>
            <div className="bg-stone-100 border border-stone-200 rounded-xl max-w-2xl w-full max-h-[95vh] h-auto flex flex-col shadow-2xl text-gray-800 animate-fade-in-up overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-50 rounded-t-xl shrink-0">
                    <div className="flex flex-col">
                        <h3 className="font-bold text-purple-700 flex items-center gap-2 text-lg">
                            剧情回顾
                        </h3>
                        <span className="text-[10px] text-gray-400 font-mono mt-0.5">总字数: {totalWords}</span>
                    </div>
                    <div className="flex items-center gap-3">
                         <button 
                            onClick={handleExport} 
                            className="text-xs bg-white hover:bg-stone-200 text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded border border-stone-300 transition-colors flex items-center gap-1 shadow-sm"
                            title="将所有剧情导出为Markdown文件"
                        >
                            <span></span> 导出 Markdown
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-red-500 text-lg px-2 font-bold">✕</button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-stone-100 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                    {history.map((h, i) => {
                         // Check if the input was likely text mode (not in the list of choices)
                         const isChoiceMode = h.choices && h.choices.includes(h.causedBy);
                         const showUserInput = h.causedBy && !isChoiceMode;

                         return (
                            <div key={h.id} className="border-b border-stone-200 pb-4 last:border-0">
                                <div className="flex justify-between mb-2">
                                    <span className="text-xs text-purple-600 font-bold uppercase bg-purple-50 px-2 py-0.5 rounded">第{toChineseNum(i + 1)}幕</span>
                                    <span className="text-[10px] text-gray-500">{h.activeCharacterName}</span>
                                </div>
                                
                                {/* Only show User Input block if it was FREE TEXT input (Text Mode) */}
                                {showUserInput && (
                                    <div className="mb-3 p-3 bg-white rounded-lg border-l-4 border-rose-400 shadow-sm text-sm text-gray-700 relative">
                                        <span className="font-bold text-xs text-rose-500 block mb-1">我的回复:</span>
                                        {h.causedBy}
                                    </div>
                                )}
    
                                <p 
                                    className="text-gray-700 leading-relaxed whitespace-pre-wrap" 
                                    style={{ 
                                        fontSize: `${fontSize}px`,
                                        fontFamily: fontFamily || "'Noto Serif SC', serif"
                                    }}
                                >
                                    {h.text}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export const CharacterModal = ({ context, character, onClose }: { context: GameContext, character: Character | SupportingCharacter, onClose: () => void }) => {
    const isProtagonist = (character as Character).skills !== undefined;
    const supportChar = !isProtagonist ? (character as SupportingCharacter) : null;
    const traitText = (character as Character).trait || supportChar?.personality || '暂无描述';
    const appearanceText = supportChar?.appearance || '';
    
    // Resolve location info
    const currentLocation = context.currentSegment?.location || context.currentSegment?.visualPrompt?.split(',')[0] || '未知';
    const locationIcon = getLocationIcon(currentLocation);

    return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8">
        {/* Changed layout to wider row-based design, reduced height and balanced ratio */}
        <div className="bg-stone-100 border border-stone-200 rounded-xl max-w-3xl w-full h-[500px] shadow-2xl overflow-hidden animate-fade-in-up text-gray-800 flex flex-row">
                
                {/* Left Column: Full Height Image (50% width) */}
                <div className="relative w-1/2 h-full bg-gray-200 border-r border-stone-300">
                    {character.avatar ? (
                        <img src={character.avatar} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-6xl text-gray-400">👤</div>
                    )}
                    {/* Minimal overlay for name at bottom of image if desired, or keep clean */}
                    <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
                </div>

                {/* Right Column: Content (50% width) */}
                <div className="w-1/2 flex flex-col h-full bg-stone-50 relative">
                    {/* Header - Reduced padding for tighter layout */}
                    <div className="p-4 border-b border-stone-200 bg-white sticky top-0 z-10 shrink-0">
                        <div className="flex justify-between items-start">
                             <div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-1 leading-none">{character.name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                     <span className="text-[10px] font-bold text-white bg-gray-800 px-2 py-0.5 rounded">{context.genre.split(' - ')[0]}</span>
                                     {supportChar && <span className="text-[10px] text-gray-600 bg-stone-200 px-2 py-0.5 rounded border border-stone-300">{supportChar.role}</span>}
                                </div>
                             </div>
                             <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-1 text-xl font-bold">✕</button>
                        </div>
                    </div>

                    {/* Content - Reduced padding/spacing, hidden scrollbar */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        <div>
                            <h4 className="text-[10px] text-purple-700 uppercase tracking-wider mb-1 font-bold flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span> 
                                {isProtagonist ? '性格与特质' : '性格特征'}
                            </h4>
                            <p className="text-xs text-gray-700 bg-white p-3 rounded border border-stone-200 shadow-sm leading-relaxed">{traitText}</p>
                        </div>

                        {appearanceText && (
                            <div>
                                <h4 className="text-[10px] text-purple-700 uppercase tracking-wider mb-1 font-bold flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span> 外貌特征
                                </h4>
                                <p className="text-xs text-gray-700 bg-white p-3 rounded border border-stone-200 shadow-sm leading-relaxed">{appearanceText}</p>
                            </div>
                        )}

                        {supportChar && supportChar.archetype && (
                            <div>
                                <h4 className="text-[10px] text-indigo-700 uppercase tracking-wider mb-1 font-bold flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> 角色原型
                                </h4>
                                <div className="bg-indigo-50 p-3 rounded border border-indigo-100 shadow-sm">
                                    <div className="font-bold text-indigo-800 text-xs mb-0.5">{supportChar.archetype}</div>
                                    <div className="text-[10px] text-gray-600">{supportChar.archetypeDescription}</div>
                                </div>
                            </div>
                        )}

                        {isProtagonist && (
                            <div>
                                <h4 className="text-[10px] text-blue-700 uppercase tracking-wider mb-1 font-bold flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> 技能
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {(character as Character).skills.map(s => (
                                        <span key={s.id} className={`px-2 py-1 rounded text-xs border shadow-sm font-medium flex items-center gap-1 ${s.type === 'passive' ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}`}>
                                            <span className={`text-[8px] px-1 rounded mr-1 ${s.type === 'passive' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                                {s.type === 'passive' ? '被' : '主'}
                                            </span>
                                            {s.name} 
                                            <span className={`${s.type === 'passive' ? 'text-blue-600' : 'text-yellow-600'} ml-1 text-[10px]`}>Lv.{s.level}</span>
                                        </span>
                                    ))}
                                    {(character as Character).skills.length === 0 && <span className="text-[10px] text-gray-400 italic">暂无习得技能</span>}
                                </div>
                            </div>
                        )}

                        {supportChar && (
                            <div>
                                <h4 className="text-[10px] text-pink-700 uppercase tracking-wider mb-1 font-bold flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-pink-500 rounded-full"></span> 情感羁绊
                                </h4>
                                <div className="flex items-center gap-3 bg-white p-3 rounded border border-stone-200 shadow-sm">
                                    <div className="flex-1">
                                        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden border border-stone-100">
                                            <div className="h-full bg-pink-500 transition-all" style={{ width: `${Math.min(Math.max(((supportChar.affinity || 0) + 50) / 100 * 100, 0), 100)}%` }}></div>
                                        </div>
                                    </div>
                                    <span className={`font-mono font-bold text-sm ${(supportChar.affinity || 0) >= 0 ? 'text-pink-600' : 'text-blue-600'}`}>{supportChar.affinity || 0}</span>
                                </div>
                            </div>
                        )}

                        {isProtagonist && (
                            <div>
                                <h4 className="text-[10px] text-pink-700 uppercase tracking-wider mb-1 font-bold flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-pink-500 rounded-full"></span> 羁绊关系
                                </h4>
                                <div className="space-y-2 max-h-32 overflow-y-auto pr-1 bg-white rounded border border-stone-200 p-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                                    {context.supportingCharacters.map(char => (
                                        <div key={char.id} className="flex items-center justify-between text-[10px] p-1.5 rounded hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-0">
                                            <span className="text-gray-800 font-bold">{char.name} <span className="text-[9px] text-gray-500 font-normal">({char.role})</span></span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-12 h-1 bg-stone-200 rounded-full overflow-hidden">
                                                    <div className="h-full bg-pink-500 transition-all" style={{ width: `${Math.min(Math.max(((char.affinity || 0) + 50) / 100 * 100, 0), 100)}%` }}></div>
                                                </div>
                                                <span className={`w-5 text-right font-mono font-bold ${(char.affinity || 0) >= 0 ? 'text-pink-600' : 'text-blue-600'}`}>{char.affinity || 0}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {context.supportingCharacters.length === 0 && <div className="text-gray-400 text-[10px] italic p-2">暂无重要羁绊</div>}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Footer Status */}
                    <div className="p-3 border-t border-stone-200 bg-stone-100 shrink-0">
                        <div className="grid grid-cols-2 gap-4 text-[10px] text-gray-500">
                            <div className="flex justify-between">
                                <span>心情状态</span>
                                <span className="font-bold text-gray-800">{MOOD_LABELS[context.currentSegment?.mood || StoryMood.PEACEFUL]}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>当前环境</span>
                                <div className="flex items-center gap-1 font-bold text-gray-800 truncate max-w-[150px]" title={currentLocation}>
                                    <span className="text-xs">{locationIcon}</span>
                                    <span>{currentLocation}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
        </div>
    </div>
    );
};

export const SkillModal = ({ skills, onUseSkill, onClose, onUpgrade }: { skills: any[], onUseSkill: (skill: any) => void, onClose: () => void, onUpgrade?: (skill: any) => void }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-yellow-600/30 p-6 rounded-xl shadow-2xl max-w-4xl w-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-yellow-500 flex items-center gap-2"><span className="text-xl">⚡</span> 发动技能</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar p-1">
                {skills.length === 0 ? (
                    <div className="col-span-full text-center text-gray-500 py-12">暂无可用技能</div>
                ) : (
                    skills.map(skill => (
                        <div key={skill.id} className="relative group h-full">
                            <button 
                                onClick={() => onUseSkill(skill)}
                                className={`flex flex-col text-left w-full h-full p-4 rounded-lg border transition-all active:scale-[0.98] 
                                    ${skill.type === 'passive' 
                                        ? 'border-cyan-500/30 bg-cyan-900/10 hover:bg-cyan-900/20 hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                                        : 'border-yellow-500/30 bg-yellow-900/10 hover:bg-yellow-900/20 hover:border-yellow-400/50 hover:shadow-[0_0_15px_rgba(234,179,8,0.15)]'}
                                `}
                            >
                                <div className="flex justify-between items-start w-full mb-2">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold text-base ${skill.type === 'passive' ? 'text-cyan-200' : 'text-yellow-200'}`}>
                                                {skill.name}
                                            </span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${skill.type === 'passive' ? 'bg-cyan-900/50 text-cyan-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                                                {skill.type === 'passive' ? 'PASSIVE' : 'ACTIVE'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400 font-mono border border-gray-700">Lv.{skill.level}</span>
                                </div>
                                <div className="text-xs text-gray-400 group-hover:text-gray-300 leading-relaxed line-clamp-2">{skill.description}</div>
                            </button>

                            {onUpgrade && (
                                <button 
                                    onClick={() => onUpgrade(skill)}
                                    className="absolute top-3 right-16 px-2 py-1 bg-gray-800 border border-gray-600 text-gray-400 rounded hover:bg-gray-700 hover:text-white transition-colors text-[9px] font-bold opacity-0 group-hover:opacity-100 flex items-center gap-1 z-20"
                                    title="升级技能"
                                >
                                    <span>▲</span> UP
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
            </div>
    </div>
);

interface ImageGenModalProps {
    selectedStyle: string;
    onSelectStyle: (s: string) => void;
    onGenerate: () => void;
    onClose: () => void;
    customStyle?: string;
    onCustomStyleChange?: (s: string) => void;
}

export const ImageGenModal = ({ selectedStyle, onSelectStyle, onGenerate, onClose, customStyle, onCustomStyleChange }: ImageGenModalProps) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-stone-100 border border-stone-200 p-6 rounded-xl shadow-2xl max-w-sm w-full text-gray-800 animate-fade-in-up">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    场景具象化
                </h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-800 font-bold">✕</button>
            </div>
            
            <div className="space-y-4 mb-6">
                <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">基础画风</label>
                    <div className="grid grid-cols-2 gap-3">
                        {['anime', 'realistic', '3d', 'ink'].map(style => (
                            <button 
                            key={style}
                            onClick={() => onSelectStyle(style)}
                            className={`p-3 rounded border text-sm capitalize transition-all ${selectedStyle === style ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm' : 'bg-white border-stone-200 text-gray-500 hover:border-gray-400'}`}
                            >
                            {style === 'anime' ? '二次元' : style === 'realistic' ? '写实摄影' : style === '3d' ? '3D 渲染' : '水墨国风'}
                            </button>
                        ))}
                    </div>
                </div>

                {onCustomStyleChange && (
                    <div>
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">自定义风格指令 (可选)</label>
                        <input 
                            type="text" 
                            value={customStyle || ''}
                            onChange={(e) => onCustomStyleChange(e.target.value)}
                            placeholder="例: 梵高星空风格, 赛博朋克霓虹, 油画质感, 像素风..."
                            className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-purple-500 outline-none transition-colors"
                        />
                    </div>
                )}
            </div>

            <button 
                onClick={onGenerate}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-mono px-8 py-3 clip-path-polygon hover:shadow-lg transition-all active:translate-y-0.5"
                style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
            >
                开始生成
            </button>
            <p className="text-[10px] text-center text-gray-500 mt-3">我们将自动应用画质增强算法以确保最佳效果</p>
        </div>
    </div>
);