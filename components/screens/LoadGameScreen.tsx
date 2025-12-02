
import React, { useState, useRef } from 'react';
import { SavedGame, SaveType, generateUUID, StoryGenre, StorySegment } from '../../types';
import { resolveBackground } from './load/utils';
import { LoadGameList } from './load/LoadGameList';
import { LoadGameCanvas } from './load/LoadGameCanvas';
import { DownloadModal } from './load/DownloadModal';

// Default Memory structure for imports
const DEFAULT_MEMORY = {
    memoryZone: "",
    storyMemory: "",
    longTermMemory: "",
    coreMemory: "",
    characterRecord: "",
    inventory: "暂无物品"
};

interface LoadGameScreenProps {
    savedGames: SavedGame[];
    onLoad: (save: SavedGame, forceSetup?: boolean) => void;
    onDelete: (id: string, e?: React.MouseEvent) => void;
    onDeleteSession: (sessionId: string) => void;
    onBack: () => void;
    onImport: (save: SavedGame | SavedGame[]) => number;
    playClickSound: () => void;
    onUndo?: () => void;
    canUndo?: boolean;
}

export const LoadGameScreen: React.FC<LoadGameScreenProps> = ({ 
    savedGames, onLoad, onDelete, onDeleteSession, onBack, onImport, playClickSound, onUndo, canUndo
}) => {
    const [viewMode, setViewMode] = useState<'list' | 'canvas'>('list');
    const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGenreFilter, setSelectedGenreFilter] = useState<string>('all');
    const [saveToDownload, setSaveToDownload] = useState<SavedGame | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const switchToCanvas = (sessionId?: string) => {
        playClickSound();
        setViewMode('canvas');
        setFocusedSessionId(sessionId || null);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (Array.isArray(json)) {
                    const count = onImport(json as SavedGame[]);
                    if (count > 0) alert(`成功导入 ${count} 条记录。`);
                    else alert("没有导入任何新记录（可能全部重复）。");
                    return;
                }
                const savesToProcess: SavedGame[] = [];
                let baseData: SavedGame;
                if (json.context && json.id) baseData = json as SavedGame;
                else if (json.character && json.worldSettings) {
                    baseData = { 
                        id: generateUUID(), 
                        sessionId: generateUUID(), 
                        storyName: json.storyName, 
                        timestamp: Date.now(), 
                        genre: json.genre, 
                        characterName: json.character.name, 
                        summary: "导入的配置档案", 
                        context: { 
                            sessionId: generateUUID(), 
                            storyName: json.storyName, 
                            genre: json.genre, 
                            customGenre: json.customGenre, 
                            character: json.character, 
                            supportingCharacters: json.supportingCharacters || [], 
                            worldSettings: json.worldSettings, 
                            history: [], 
                            currentSegment: null, 
                            lastUpdated: Date.now(), 
                            memories: { ...DEFAULT_MEMORY }, 
                            scheduledEvents: json.scheduledEvents || [], 
                            plotBlueprint: json.plotBlueprint || [] 
                        }, 
                        type: SaveType.SETUP 
                    } as SavedGame;
                } else { alert("无法识别的文件格式"); return; }
                
                const history = baseData.context.history as StorySegment[] || [];
                const sessionId = baseData.sessionId || generateUUID();
                baseData.context.scheduledEvents = baseData.context.scheduledEvents || [];
                baseData.context.plotBlueprint = baseData.context.plotBlueprint || [];
                const existingSessionSaves = savedGames.filter(s => s.sessionId === sessionId);

                if (history.length === 0) {
                    if (!baseData.id) baseData.id = generateUUID();
                    if (!baseData.sessionId) baseData.sessionId = sessionId;
                    const isDup = existingSessionSaves.some(s => s.id === baseData.id);
                    if (!isDup) savesToProcess.push(baseData);
                } else {
                    const baseTimestamp = baseData.timestamp || Date.now();
                    history.forEach(seg => { if (!seg.id) seg.id = generateUUID(); });
                    
                    history.forEach((segment, index) => {
                        const isDup = existingSessionSaves.some(s => s.storyId === segment.id);
                        if (isDup) return;
                        const isLast = index === history.length - 1;
                        const parentId = index === 0 ? undefined : history[index - 1].id;
                        const newId = (isLast && baseData.id && !existingSessionSaves.some(s => s.id === baseData.id)) ? baseData.id : generateUUID();

                        const node: SavedGame = { 
                            id: newId, 
                            sessionId: sessionId, 
                            storyName: baseData.storyName, 
                            storyId: segment.id, 
                            parentId: parentId, 
                            timestamp: baseTimestamp - ((history.length - 1 - index) * 60 * 1000), 
                            genre: baseData.genre, 
                            characterName: baseData.characterName, 
                            summary: segment.text ? (segment.text.substring(0, 50) + "...") : "历史节点", 
                            location: segment.location || baseData.location, 
                            choiceText: segment.causedBy || "", 
                            type: SaveType.AUTO, 
                            context: { 
                                ...baseData.context, 
                                sessionId: sessionId, 
                                history: history.slice(0, index + 1), 
                                currentSegment: segment, 
                                memories: isLast ? baseData.context.memories : { ...baseData.context.memories }, 
                                scheduledEvents: baseData.context.scheduledEvents || [], 
                                plotBlueprint: baseData.context.plotBlueprint || [] 
                            } 
                        };
                        if (isLast) { node.summary = baseData.summary; node.type = baseData.type || SaveType.MANUAL; node.choiceLabel = baseData.choiceLabel; node.choiceText = baseData.choiceText || segment.causedBy; node.metaData = baseData.metaData; node.context = baseData.context; if (node.context.currentSegment) node.context.currentSegment.id = segment.id; }
                        savesToProcess.push(node);
                    });
                }
                playClickSound();
                const importCount = onImport(savesToProcess);
                if (importCount === 0 && savesToProcess.length === 0 && history.length > 0) alert("检测到该存档配置在当前世界线已完全存在，未导入任何新节点。");
                else if (importCount === 0 && savesToProcess.length > 0) alert("检测到该存档完全重复，未导入任何新节点。");
                else if (importCount > 0) alert(`成功重构并导入 ${importCount} 个历史节点。`);
            } catch (err) { console.error(err); alert("导入失败：文件损坏"); }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleBackupSession = (includeImages: boolean) => {
        if (!saveToDownload) return;
        const sessionSaves = savedGames.filter(s => s.sessionId === saveToDownload.sessionId);
        if (sessionSaves.length === 0) return;
        const backupData = sessionSaves.map(s => {
            const copy = JSON.parse(JSON.stringify(s));
            const resolved = resolveBackground(s, savedGames);
            if (copy.context.currentSegment && !copy.context.currentSegment.backgroundImage && resolved) copy.context.currentSegment.backgroundImage = resolved;
            if (!includeImages) {
                if (copy.context.character.avatar) copy.context.character.avatar = undefined;
                copy.context.supportingCharacters.forEach((sc: any) => { if (sc.avatar) sc.avatar = undefined; });
                copy.context.history.forEach((seg: any) => { if (seg.backgroundImage) seg.backgroundImage = undefined; });
                if (copy.context.currentSegment?.backgroundImage) copy.context.currentSegment.backgroundImage = undefined;
            }
            return copy;
        });
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const safeName = (saveToDownload.storyName || saveToDownload.characterName || "archive").replace(/[^a-z0-9_\u4e00-\u9fa5]/gi, '_');
        link.download = `worldline_backup_${safeName}_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-stone-100 text-gray-800 select-none font-sans">
            
            {/* Header / HUD */}
            <div className="absolute top-0 left-0 p-6 z-50 flex flex-col md:flex-row md:items-center gap-4 pointer-events-none w-full bg-gradient-to-b from-stone-100/90 to-transparent pb-8">
                 <div className="flex gap-2 md:gap-4 pointer-events-auto items-center">
                    <button onClick={() => { playClickSound(); onBack(); }} className="bg-white hover:bg-stone-50 text-gray-600 hover:text-black font-bold font-mono px-4 md:px-6 py-2 shadow-lg transition-transform active:translate-y-0.5 flex items-center gap-2 clip-path-polygon text-xs md:text-sm" style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}><span>‹</span> 返回</button>
                    <button onClick={() => { playClickSound(); fileInputRef.current?.click(); }} className="bg-white hover:bg-stone-50 text-indigo-600 hover:text-indigo-800 font-bold font-mono px-4 md:px-6 py-2 shadow-lg transition-transform active:translate-y-0.5 flex items-center gap-2 clip-path-polygon text-xs md:text-sm" style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}><span></span> 导入</button>
                    <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
                    {viewMode === 'canvas' && ( <button onClick={() => { playClickSound(); setViewMode('list'); setFocusedSessionId(null); }} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors bg-white/60 px-4 py-2 rounded-full border border-black/5 shadow-sm backdrop-blur-md font-bold text-xs md:text-sm"><span>☰</span> 列表视图</button> )}
                 </div>
                 {viewMode === 'list' && (
                    <div className="flex-1 flex items-center gap-2 pointer-events-auto bg-white/60 p-1.5 rounded-lg border border-black/5 backdrop-blur-md shadow-sm max-w-lg">
                        <input type="text" placeholder="搜索角色名 / 故事名..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-xs md:text-sm px-2 text-gray-700 placeholder-gray-400" />
                        <div className="h-4 w-px bg-gray-300"></div>
                        <select value={selectedGenreFilter} onChange={(e) => setSelectedGenreFilter(e.target.value)} className="bg-transparent border-none outline-none text-xs md:text-sm text-gray-600 cursor-pointer max-w-[100px]"> <option value="all">全部分类</option> {Object.values(StoryGenre).map(g => ( <option key={g} value={g}>{g.split(' - ')[0]}</option> ))} </select>
                    </div>
                 )}
                 {viewMode === 'canvas' && (
                     <div className="flex-1 flex items-center gap-4 pointer-events-auto">
                         {focusedSessionId ? ( <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-md border border-amber-200 flex items-center gap-2 animate-fade-in-right"><span className="text-amber-600 text-xs font-bold">● 专注模式</span><button onClick={() => { playClickSound(); setFocusedSessionId(null); }} className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-0.5 rounded transition-colors">显示全部宇宙</button></div> ) : ( <div className="bg-white/60 px-4 py-2 rounded-full border border-black/5 backdrop-blur-md text-xs font-mono text-gray-500 shadow-sm flex items-center gap-2"><span>上帝视角</span><span className="w-px h-3 bg-gray-300"></span><span className="text-gray-400">显示所有时间线</span></div> )}
                         
                         {/* Undo Button - Moved Here */}
                         {canUndo && onUndo && (
                            <button 
                                onClick={() => { playClickSound(); onUndo(); }}
                                className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-md border border-stone-200 flex items-center gap-2 text-xs font-bold text-stone-600 hover:bg-white hover:text-stone-800 transition-all active:scale-95 animate-fade-in-right"
                            >
                                <span className="text-sm">↶</span>
                                <span>撤销删除</span>
                            </button>
                         )}
                     </div>
                 )}
                 <div className="bg-white/60 px-4 py-2 rounded-full border border-black/5 backdrop-blur-md text-xs font-mono text-gray-500 shadow-sm flex items-center gap-2 pointer-events-auto shrink-0 hidden md:flex">
                    <span>{viewMode === 'list' ? '记忆碎片整理' : '无限存档回廊'}</span>
                    <span className="w-px h-3 bg-gray-300"></span>
                    {viewMode === 'canvas' && <span className="text-amber-600 font-bold">按住 Ctrl 可拖拽节点</span>}
                 </div>
            </div>

            {viewMode === 'list' && (
                <LoadGameList 
                    savedGames={savedGames}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    selectedGenreFilter={selectedGenreFilter}
                    setSelectedGenreFilter={setSelectedGenreFilter}
                    onLoad={onLoad}
                    onDeleteSession={onDeleteSession}
                    onSwitchToCanvas={switchToCanvas}
                    onDownload={setSaveToDownload}
                    playClickSound={playClickSound}
                />
            )}

            {viewMode === 'canvas' && (
                <LoadGameCanvas 
                    savedGames={savedGames}
                    focusedSessionId={focusedSessionId}
                    onLoad={onLoad}
                    onDelete={onDelete}
                    playClickSound={playClickSound}
                    onUndo={onUndo}
                    canUndo={canUndo}
                />
            )}
            
            {saveToDownload && (
                <DownloadModal 
                    save={saveToDownload}
                    resolvedBackground={resolveBackground(saveToDownload, savedGames)}
                    onBackupSession={handleBackupSession}
                    onClose={() => setSaveToDownload(null)} 
                />
            )}
        </div>
    );
};
