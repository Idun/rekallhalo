
import React, { useState } from 'react';
import { GameContext } from '../../types';

// --- Configuration Modal ---
interface AutoPlanConfigModalProps {
    onConfirm: (config: { chapterCount: number; wordCountRange: [number, number]; newCharCount: number }) => void;
    onClose: () => void;
    isContinuing: boolean;
}

const AutoPlanConfigModal: React.FC<AutoPlanConfigModalProps> = ({ onConfirm, onClose, isContinuing }) => {
    const [chapterCount, setChapterCount] = useState(3);
    const [targetWordCount, setTargetWordCount] = useState(3000);
    const [newCharCount, setNewCharCount] = useState(3);

    const handleConfirm = () => {
        // Calculate range based on target (approx +/- 20%)
        const min = Math.max(1000, Math.floor(targetWordCount * 0.8));
        const max = Math.ceil(targetWordCount * 1.2);
        
        onConfirm({ 
            chapterCount, 
            wordCountRange: [min, max], 
            newCharCount 
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div className="bg-stone-100 border border-stone-200 p-6 rounded-xl shadow-2xl max-w-sm w-full text-gray-800" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                        <span className="text-cyan-600">✦</span> 
                        {isContinuing ? '剧情续写规划' : '智能章纲生成'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-800 font-bold">✕</button>
                </div>
                
                <p className="text-xs text-gray-500 mb-6">
                    {isContinuing 
                        ? 'AI 将根据当前已有章节，分析剧情走向并规划后续发展。' 
                        : 'AI 将根据世界观与主角设定，从零构建故事大纲。'}
                </p>

                <div className="space-y-5 mb-8">
                    {/* Chapter Count */}
                    <div>
                        <div className="flex justify-between text-[10px] text-gray-500 uppercase font-bold mb-2">
                            <span>生成章节数量</span>
                            <span className="text-cyan-600 font-mono text-sm">{chapterCount} 章</span>
                        </div>
                        <input 
                            type="range" min="1" max="10" step="1" 
                            value={chapterCount}
                            onChange={(e) => setChapterCount(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>

                    {/* Target Word Count (Single Slider) */}
                    <div>
                        <div className="flex justify-between text-[10px] text-gray-500 uppercase font-bold mb-2">
                            <span>单章目标字数</span>
                            <span className="text-cyan-600 font-mono text-sm">约 {targetWordCount} 字</span>
                        </div>
                        <input 
                            type="range" min="1000" max="10000" step="500" 
                            value={targetWordCount}
                            onChange={(e) => setTargetWordCount(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                        <div className="flex justify-between text-[9px] text-gray-400 mt-1 font-mono">
                            <span>1k</span>
                            <span>5k</span>
                            <span>10k</span>
                        </div>
                    </div>

                    {/* New Character Count */}
                    <div>
                        <div className="flex justify-between text-[10px] text-gray-500 uppercase font-bold mb-2">
                            <span>涉及/新增角色数</span>
                            <span className="text-cyan-600 font-mono text-sm">约 {newCharCount} 人</span>
                        </div>
                        <input 
                            type="range" min="1" max="8" step="1" 
                            value={newCharCount}
                            onChange={(e) => setNewCharCount(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>
                </div>

                <button 
                    onClick={handleConfirm}
                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold font-mono px-8 py-3 clip-path-polygon hover:shadow-lg transition-all active:translate-y-0.5 flex items-center justify-center gap-2"
                    style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                >
                    <span>{isContinuing ? '开始续写' : '开始规划'}</span>
                </button>
                <p className="text-[10px] text-center text-gray-400 mt-3">这将消耗一定的 AI 推理算力</p>
            </div>
        </div>
    );
};

export const SetupPlotPanel: React.FC<{ 
    className?: string; 
    style?: React.CSSProperties; 
    onClick?: () => void; 
    context: GameContext; 
    onOpenModal: (id?: string, viewMode?: 'list' | 'graph') => void;
    onAutoPlan?: (config: any) => void;
    isGenerating?: boolean; 
}> = ({ className, style, onClick, context, onOpenModal, onAutoPlan, isGenerating }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showConfigModal, setShowConfigModal] = useState(false);
    
    const chapters = context.plotBlueprint || [];
    const filteredChapters = chapters.filter(c => 
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.summary && c.summary.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const hasExistingChapters = chapters.length > 0;

    return (
        <div 
            className={`${className} bg-stone-100/95 backdrop-blur-md border-cyan-700 text-gray-800 group hover:shadow-cyan-500/20 flex flex-col`}
            style={style}
            onClick={onClick}
        >
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none overflow-hidden">
                <div className="absolute top-10 left-10 w-32 h-32 border-2 border-cyan-900 rounded-full"></div>
                <div className="absolute bottom-20 right-10 w-48 h-48 border border-cyan-900 rounded-full"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[120%] h-[1px] bg-cyan-900 rotate-45"></div>
            </div>

            {/* Header: Title + Button */}
            <div className="flex justify-between items-center p-4 border-b border-cyan-200/30 z-10 shrink-0">
                <h3 className="text-xl font-bold text-cyan-900 tracking-[0.2em] font-serif flex items-center gap-2">
                    <span className="w-1 h-4 bg-cyan-600 block"></span>
                    剧情蓝图
                </h3>
                <div className="flex gap-2">
                    {onAutoPlan && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isGenerating) setShowConfigModal(true);
                            }}
                            disabled={isGenerating}
                            className={`text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-md transition-all flex items-center gap-1
                                ${isGenerating 
                                    ? 'bg-cyan-700 cursor-not-allowed opacity-80' 
                                    : 'bg-cyan-800 hover:bg-cyan-700 hover:shadow-cyan-500/30 active:scale-95'
                                }
                            `}
                            title={hasExistingChapters ? "基于现有章节续写后续剧情" : "AI 自动生成剧情蓝图"}
                        >
                            {isGenerating ? (
                                <>
                                    <span className="animate-spin inline-block">⟳</span>
                                    <span>规划中...</span>
                                </>
                            ) : (
                                <>
                                    <span>✦</span>
                                    <span>{hasExistingChapters ? '智能续写' : '智能章纲'}</span>
                                </>
                            )}
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenModal(undefined, 'graph');
                        }}
                        className="bg-cyan-800 hover:bg-cyan-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-md hover:shadow-cyan-500/30 transition-all active:scale-95 flex items-center gap-1"
                        title="查看剧情思维导图"
                    >
                        <span>☊</span>
                        <span className="hidden md:inline">脑图</span>
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenModal(undefined, 'list');
                        }}
                        className="bg-cyan-800 hover:bg-cyan-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-md hover:shadow-cyan-500/30 transition-all active:scale-95 flex items-center gap-1"
                    >
                        <span>进入章节</span>
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="px-4 py-2 border-b border-cyan-100/50 z-10 bg-cyan-50/10">
                 <input
                    type="text"
                    placeholder="搜索章节..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-white/60 border border-cyan-200 rounded px-2 py-1 text-xs text-cyan-900 outline-none focus:bg-white focus:border-cyan-400 transition-all placeholder-cyan-800/30"
                 />
            </div>

            {/* List Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 z-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                {chapters.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-cyan-900/20 gap-4">
                         <div className="text-6xl font-serif select-none pointer-events-none">§</div>
                         <div className="flex flex-col items-center gap-2">
                             <span className="text-xs">{isGenerating ? 'AI 正在构建大纲...' : '暂无规划'}</span>
                         </div>
                    </div>
                ) : filteredChapters.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-cyan-900/30">
                        <span className="text-xs">未找到匹配章节</span>
                    </div>
                ) : (
                    filteredChapters.map((chapter, idx) => (
                        <div 
                            key={chapter.id} 
                            className="bg-white/60 border border-cyan-100 p-2.5 rounded hover:bg-white hover:shadow-sm hover:border-cyan-300 transition-all cursor-pointer group/card"
                            onClick={(e) => { e.stopPropagation(); onOpenModal(chapter.id, 'list'); }}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-bold text-cyan-800 group-hover/card:text-cyan-600">
                                    {chapter.title}
                                </span>
                                <div className="flex gap-1">
                                    {chapter.status === 'completed' && <span className="text-[8px] text-green-600">✓</span>}
                                    <span className={`text-[8px] px-1 rounded border ${chapter.status === 'completed' ? 'text-green-600 bg-green-50 border-green-200' : 'text-cyan-600 bg-cyan-50 border-cyan-100'}`}>
                                        {chapter.targetWordCount}字
                                    </span>
                                </div>
                            </div>
                            <div className="text-[9px] text-gray-500 line-clamp-2 leading-tight">
                                {chapter.summary || <span className="italic opacity-50">暂无摘要...</span>}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer: Stats */}
            <div className="p-3 border-t border-cyan-200/30 bg-cyan-50/20 flex justify-between text-[10px] text-cyan-800/60 font-mono z-10 shrink-0">
                <span>{chapters.length} 章节</span>
                <span>{(context.scheduledEvents || []).filter((e: any) => e.status === 'pending').length || 0} 伏笔</span>
            </div>

            {/* Config Modal */}
            {showConfigModal && onAutoPlan && (
                <AutoPlanConfigModal 
                    isContinuing={hasExistingChapters}
                    onClose={() => setShowConfigModal(false)}
                    onConfirm={(config) => {
                        setShowConfigModal(false);
                        onAutoPlan(config);
                    }}
                />
            )}
        </div>
    );
};
