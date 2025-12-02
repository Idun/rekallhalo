
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SavedGame, SaveType } from '../../../types';
import { GenreAvatar } from '../../GenreAvatar';
import { resolveBackground, GRID_SIZE, NODE_POSITIONS_KEY, CHAPTER_COLORS } from './utils';

interface LoadGameCanvasProps {
    savedGames: SavedGame[];
    focusedSessionId: string | null;
    onLoad: (save: SavedGame, forceSetup?: boolean) => void;
    onDelete: (id: string, e?: React.MouseEvent) => void;
    playClickSound: () => void;
    onUndo?: () => void;
    canUndo?: boolean;
}

interface Coords {
    x: number;
    y: number;
}

interface TreeNode {
    save: SavedGame;
    children: TreeNode[];
    x: number;
    y: number;
    chapterInfo?: {
        id: string;
        title: string;
        color: string;
        isStart: boolean;
    };
}

// Logic to determine if a node is Text Input (Free) or Choice Selection
const isSaveTextNode = (save: SavedGame): boolean => {
    // 1. If explicitly labeled, it is a choice
    if (save.choiceLabel) return false;
    
    // 2. Root nodes are not text nodes
    if (!save.parentId) return false;

    // 3. Check context history to verify
    const history = save.context.history;
    if (!history || history.length < 2) {
        // Fallback: If no history, assume text if not root and no label? 
        // Actually safe to default to true (text) if we can't prove it's a choice.
        return true; 
    }

    const parentSegment = history[history.length - 2];
    const currentSegment = history[history.length - 1];
    
    // The text that caused this state
    const actionText = save.choiceText || currentSegment.causedBy;

    if (!actionText) return false;

    if (parentSegment && parentSegment.choices) {
        // If the action text matches one of the provided choices, it's NOT a text node.
        if (parentSegment.choices.includes(actionText)) {
            return false;
        }
        // Special case: Destiny/Skill choices might have prefixes or be formatted
        // but typically they are passed exactly as is.
        // We can add a loose check for common choice prefixes if needed.
    }

    // If it didn't match any choice from parent, it is a free text input.
    return true;
};

export const LoadGameCanvas: React.FC<LoadGameCanvasProps> = ({ 
    savedGames, focusedSessionId, onLoad, onDelete, playClickSound, onUndo, canUndo
}) => {
    const [pan, setPan] = useState<Coords>({ x: 100, y: 100 });
    const [scale, setScale] = useState(0.8);
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePos, setLastMousePos] = useState<Coords>({ x: 0, y: 0 });
    
    const [nodePositions, setNodePositions] = useState<Record<string, {x: number, y: number}>>({});
    const [dragNodeState, setDragNodeState] = useState<{id: string, startX: number, startY: number, originX: number, originY: number} | null>(null);
    const isNodeDraggingRef = useRef(false);
    const hasMovedRef = useRef(false);
    const isBackgroundInteractionRef = useRef(false);
    const [isCtrlDown, setIsCtrlDown] = useState(false);
    const [selectedSave, setSelectedSave] = useState<SavedGame | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initial Load & Sync of Node Positions
    useEffect(() => {
        try {
            const saved = localStorage.getItem(NODE_POSITIONS_KEY);
            if (saved) setNodePositions(JSON.parse(saved));
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        if (Object.keys(nodePositions).length > 0) {
            localStorage.setItem(NODE_POSITIONS_KEY, JSON.stringify(nodePositions));
        }
    }, [nodePositions]);

    // Keyboard Listeners
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { 
            if (e.key === 'Control' || e.key === 'Meta') setIsCtrlDown(true); 
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (onUndo) onUndo();
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Control' || e.key === 'Meta') setIsCtrlDown(false); };
        const handleBlur = () => setIsCtrlDown(false);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, [onUndo]);

    // Initial View Position
    useEffect(() => {
        if (focusedSessionId) { setPan({ x: 100, y: window.innerHeight / 2 }); setScale(0.8); }
        else { setPan({ x: 100, y: 100 }); setScale(0.8); }
    }, [focusedSessionId]);

    const resolvedSelectedBg = useMemo(() => resolveBackground(selectedSave, savedGames), [selectedSave, savedGames]);

    const sessionTrees = useMemo(() => {
        const sessions: Record<string, SavedGame[]> = {};
        savedGames.forEach(save => {
            if (focusedSessionId && save.sessionId !== focusedSessionId) return;
            if (!sessions[save.sessionId]) sessions[save.sessionId] = [];
            sessions[save.sessionId].push(save);
        });

        const trees: { sessionId: string, nodes: TreeNode[], edges: {x1: number, y1: number, x2: number, y2: number, isTextNode: boolean, color?: string}[], rootY: number }[] = [];
        let globalYOffset = 0;

        const getChapterInfo = (save: SavedGame, parentChapterId?: string) => {
            if (!save.context.plotBlueprint || save.context.plotBlueprint.length === 0) return undefined;
            const blueprint = save.context.plotBlueprint;
            let activeChapter = blueprint.find(c => c.status === 'active');
            if (!activeChapter) {
                const completed = blueprint.filter(c => c.status === 'completed');
                if (completed.length > 0) activeChapter = completed[completed.length - 1];
                else activeChapter = blueprint[0];
            }
            if (!activeChapter) return undefined;
            const index = blueprint.findIndex(c => c.id === activeChapter?.id);
            const color = CHAPTER_COLORS[index % CHAPTER_COLORS.length];
            const isStart = !parentChapterId || parentChapterId !== activeChapter.id;
            return { id: activeChapter.id, title: activeChapter.title, color, isStart };
        };

        Object.entries(sessions).forEach(([sessionId, sessionSaves]) => {
            sessionSaves.sort((a, b) => a.timestamp - b.timestamp);
            const childMap: Record<string, SavedGame[]> = {};
            const saveMap: Record<string, SavedGame> = {};
            sessionSaves.forEach(save => {
                const parentId = save.parentId || 'root';
                if (!childMap[parentId]) childMap[parentId] = [];
                childMap[parentId].push(save);
                saveMap[save.id] = save;
                if(save.storyId) saveMap[save.storyId] = save;
            });

            const savedStoryIds = new Set(sessionSaves.map(s => s.storyId));
            const visualNodes: TreeNode[] = [];
            const nodesMap: Record<string, TreeNode> = {};
            const X_SPACING = 250;
            const Y_SPACING = 150;
            let currentLeafY = globalYOffset;
            let rootY = globalYOffset;

            const assignCoords = (save: SavedGame, depth: number, parentChapterId?: string): number => {
                const myStoryId = save.storyId;
                const childrenSaves = myStoryId ? (childMap[myStoryId] || []) : [];
                const chapterInfo = getChapterInfo(save, parentChapterId);
                let myY = 0;

                if (childrenSaves.length === 0) {
                    myY = currentLeafY;
                    currentLeafY += Y_SPACING;
                } else {
                    let sumY = 0;
                    childrenSaves.forEach(child => {
                        sumY += assignCoords(child, depth + 1, chapterInfo?.id);
                    });
                    myY = sumY / childrenSaves.length;
                }
                
                const historyLen = save.context.history.length || 1;
                const calculatedX = (save.type === SaveType.SETUP) ? 100 : ((historyLen - 1) * X_SPACING + 100);
                const finalX = nodePositions[save.id]?.x ?? calculatedX;
                const finalY = nodePositions[save.id]?.y ?? myY;

                const node: TreeNode = { save, children: [], x: finalX, y: finalY, chapterInfo };
                nodesMap[save.id] = node;
                visualNodes.push(node);
                if (depth === 0) rootY = myY;
                return myY; 
            };

            const rootSaves = sessionSaves.filter(s => !s.parentId || !savedStoryIds.has(s.parentId));
            rootSaves.sort((a, b) => a.timestamp - b.timestamp);
            rootSaves.forEach(root => { assignCoords(root, 0); currentLeafY += Y_SPACING; });

            const edges: {x1: number, y1: number, x2: number, y2: number, isTextNode: boolean, color?: string}[] = [];
            visualNodes.forEach(node => {
                 const children = node.save.storyId ? childMap[node.save.storyId] : [];
                 children?.forEach(childSave => {
                     const childNode = nodesMap[childSave.id];
                     if (childNode) {
                         if (childNode.chapterInfo?.isStart) return;
                         
                         // Determine connection type using improved logic
                         const isTextNode = isSaveTextNode(childSave);
                         
                         edges.push({
                             x1: node.x + 50,
                             y1: node.y,
                             x2: childNode.x - 50,
                             y2: childNode.y,
                             isTextNode,
                             color: childNode.chapterInfo?.color
                         });
                     }
                 });
            });
            trees.push({ sessionId, nodes: visualNodes, edges, rootY });
            globalYOffset = currentLeafY + 200; 
        });
        return trees;
    }, [savedGames, nodePositions, focusedSessionId]);

    const handleWheel = (e: React.WheelEvent) => {
        if (!containerRef.current) return;
        e.stopPropagation();
        const delta = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(scale + delta, 0.2), 3);
        const rect = containerRef.current.getBoundingClientRect();
        const viewCenterX = rect.width / 2;
        const viewCenterY = rect.height / 2;
        const worldCenterX = (viewCenterX - pan.x) / scale;
        const worldCenterY = (viewCenterY - pan.y) / scale;
        const newPanX = viewCenterX - (worldCenterX * newScale);
        const newPanY = viewCenterY - (worldCenterY * newScale);
        setScale(newScale);
        setPan({ x: newPanX, y: newPanY });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.story-node-draggable')) return;
        isBackgroundInteractionRef.current = true;
        setIsPanning(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
        hasMovedRef.current = false;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if ((e.ctrlKey || e.metaKey) !== isCtrlDown) setIsCtrlDown(e.ctrlKey || e.metaKey);
        if (dragNodeState) {
            isNodeDraggingRef.current = true;
            hasMovedRef.current = true;
            const dx = (e.clientX - dragNodeState.startX) / scale;
            const dy = (e.clientY - dragNodeState.startY) / scale;
            const newX = dragNodeState.originX + dx;
            const newY = dragNodeState.originY + dy;
            const snappedX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
            const snappedY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
            setNodePositions(prev => ({ ...prev, [dragNodeState.id]: { x: snappedX, y: snappedY } }));
        } else if (isPanning) {
            hasMovedRef.current = true;
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = () => {
        if (isBackgroundInteractionRef.current && !isNodeDraggingRef.current && !hasMovedRef.current) setSelectedSave(null);
        setIsPanning(false);
        setDragNodeState(null);
        isBackgroundInteractionRef.current = false;
        setTimeout(() => { isNodeDraggingRef.current = false; }, 0);
    };

    return (
        <div 
            ref={containerRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        >
            <div 
                className="absolute inset-0 opacity-10 pointer-events-none transition-opacity duration-500"
                style={{
                    backgroundImage: 'radial-gradient(circle, #000 1.5px, transparent 1.5px)',
                    backgroundSize: `${GRID_SIZE * scale}px ${GRID_SIZE * scale}px`,
                    transform: `translate(${pan.x % (GRID_SIZE * scale)}px, ${pan.y % (GRID_SIZE * scale)}px)`
                }}
            />

            <div 
                className="absolute transition-transform duration-75 ease-out origin-top-left"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
            >
                {sessionTrees.map((tree) => (
                    <div key={tree.sessionId}>
                        <svg className="absolute top-0 left-0 w-[10000px] h-[10000px] pointer-events-none overflow-visible" style={{ zIndex: 0 }}>
                            {tree.edges.map((edge, i) => {
                                const controlPointOffset = Math.abs(edge.x2 - edge.x1) / 2;
                                const path = `M ${edge.x1} ${edge.y1} C ${edge.x1 + controlPointOffset} ${edge.y1}, ${edge.x2 - controlPointOffset} ${edge.y2}, ${edge.x2} ${edge.y2}`;
                                const strokeColor = edge.color || (edge.isTextNode ? "#f43f5e" : "#cbd5e1"); 
                                const markerId = edge.isTextNode ? "url(#arrowhead-text)" : "url(#arrowhead-choice)";
                                const dashArray = edge.isTextNode ? "5,5" : "none";
                                return (
                                    <path key={i} d={path} fill="none" stroke={strokeColor} strokeWidth={2} strokeDasharray={dashArray} strokeOpacity={edge.color ? 0.6 : 1} markerEnd={markerId} className="transition-all duration-300" />
                                );
                            })}
                        </svg>

                        {tree.nodes.map((node) => {
                            const isSelected = selectedSave?.id === node.save.id;
                            const isRoot = !node.save.parentId;
                            const isSetup = node.save.type === SaveType.SETUP;
                            
                            // Improved text node detection
                            const isTextNode = isSaveTextNode(node.save);
                            
                            const activeCharName = node.save.context.currentSegment?.activeCharacterName || node.save.characterName;
                            const supportingChar = node.save.context.supportingCharacters.find(c => activeCharName.includes(c.name));
                            const isProtagonistActive = activeCharName === node.save.characterName || activeCharName === '我';
                            const displayAvatar = !isProtagonistActive && supportingChar?.avatar ? supportingChar.avatar : node.save.context.character.avatar;
                            const chapterColor = node.chapterInfo?.color || '#cbd5e1';
                            const ringStyle = { borderColor: chapterColor, boxShadow: isSelected ? `0 0 30px ${chapterColor}` : node.chapterInfo ? `0 0 15px ${chapterColor}40` : 'none' };

                            return (
                                <div
                                    key={node.save.id}
                                    className={`absolute flex justify-center items-center group z-10 hover:z-50 story-node-draggable`}
                                    style={{ left: node.x, top: node.y, transform: 'translate(-50%, -50%)', cursor: isCtrlDown ? 'grab' : 'pointer' }}
                                    onMouseDown={(e) => {
                                        if (isCtrlDown) {
                                            e.stopPropagation(); setIsPanning(false);
                                            setDragNodeState({ id: node.save.id, startX: e.clientX, startY: e.clientY, originX: node.x, originY: node.y });
                                        } else {
                                            e.stopPropagation(); setSelectedSave(prev => prev && prev.id === node.save.id ? null : node.save);
                                        }
                                    }}
                                >
                                    {node.chapterInfo?.isStart && (
                                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-md whitespace-nowrap z-20 flex items-center gap-2" style={{ backgroundColor: chapterColor }}><span>★</span><span>{node.chapterInfo.title}</span></div>
                                    )}
                                    {node.save.choiceText && (
                                        <div className="absolute right-full mr-4 w-64 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:-translate-x-2 pointer-events-none">
                                            <div className="bg-black/80 backdrop-blur-md text-white p-3 rounded-xl border border-white/20 shadow-2xl relative">
                                                <div className="absolute top-1/2 right-[-6px] w-3 h-3 bg-black/80 border-r border-b border-white/20 transform -translate-y-1/2 -rotate-45"></div>
                                                <div className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${isTextNode ? 'text-rose-400' : 'text-indigo-400'}`}>{isTextNode ? '自由输入' : `关键抉择${node.save.choiceLabel ? ` #${node.save.choiceLabel}` : ''}`}</div>
                                                <div className="text-sm font-medium leading-tight">{node.save.choiceText}</div>
                                            </div>
                                        </div>
                                    )}
                                    <div className={`relative transition-transform duration-300 rounded-full bg-white ${isSelected ? 'scale-125 z-50' : ''}`} style={{ borderWidth: '3px', borderStyle: 'solid', ...ringStyle }}>
                                         {isRoot && !node.chapterInfo?.isStart && <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-500 text-white text-[9px] px-2 py-0.5 rounded-full shadow-sm font-bold whitespace-nowrap z-20">起点</div>}
                                         {!isRoot && !isSetup && <div className={`absolute -top-3 -right-3 w-6 h-6 rounded-full flex items-center justify-center text-sm shadow-sm z-30 border-2 border-white ${isTextNode ? 'bg-rose-500 text-white' : 'bg-stone-100 text-stone-600'}`}>{isTextNode ? '⌨' : '☰'}</div>}
                                         <GenreAvatar avatar={displayAvatar} name={activeCharName} genre={node.save.genre} isProtagonist={isProtagonistActive} size="md" className={`${isSetup ? 'ring-2 ring-blue-400' : ''} ${isTextNode ? 'grayscale-[0.3]' : ''}`} />
                                         <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-2 py-0.5 rounded text-[9px] text-gray-600 font-mono shadow-sm border border-gray-200 whitespace-nowrap opacity-60 group-hover:opacity-100 transition-opacity">{new Date(node.save.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                    </div>
                                    <div className="absolute left-full ml-4 w-72 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-2 pointer-events-none z-50">
                                        <div className="bg-white/95 backdrop-blur-md text-gray-800 p-4 rounded-xl border border-gray-200 shadow-2xl relative">
                                            <div className="absolute top-1/2 left-[-6px] w-3 h-3 bg-white/95 border-l border-t border-gray-200 transform -translate-y-1/2 -rotate-45"></div>
                                            <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-2"><span className="text-xs font-bold text-gray-500">{node.save.location || "未知区域"}</span><span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">第 {node.save.metaData?.turnCount || 0} 幕</span></div>
                                            <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">{node.save.context.currentSegment?.text || node.save.summary}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
            
            {selectedSave && (
                <div className="absolute top-20 right-6 w-96 bg-white/90 backdrop-blur-md border border-gray-200 shadow-2xl rounded-xl p-0 animate-fade-in-right z-[60] flex flex-col max-h-[calc(100vh-120px)] overflow-hidden" onWheel={(e) => e.stopPropagation()}>
                     <div className="relative h-40 bg-gray-100 shrink-0">
                        {resolvedSelectedBg ? ( <img src={resolvedSelectedBg} className="w-full h-full object-cover" /> ) : ( <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">NO IMAGE</div> )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                        <div className="absolute bottom-4 left-5 right-5 text-white"><h3 className="font-bold text-xl shadow-black drop-shadow-md">{selectedSave.storyName || selectedSave.characterName}</h3><p className="text-xs opacity-80 font-mono">{new Date(selectedSave.timestamp).toLocaleString()}</p></div>
                        <button onClick={() => setSelectedSave(null)} className="absolute top-3 right-3 bg-black/30 hover:bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors">✕</button>
                     </div>
                     <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 bg-white/50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']" onWheel={(e) => e.stopPropagation()}>
                         {selectedSave.context.plotBlueprint && ( <div className="bg-gradient-to-r from-stone-100 to-stone-50 p-3 rounded border-l-4 border-stone-400 shadow-sm"><label className="text-[10px] text-gray-400 font-bold block mb-1">当前章节</label><div className="text-sm font-bold text-gray-800">{selectedSave.context.plotBlueprint.find(c => c.status === 'active')?.title || "序章 / 未知"}</div></div> )}
                         <div><label className="text-[10px] text-indigo-400 font-bold mb-1 block">剧情回顾</label><p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-serif">{selectedSave.context.currentSegment?.text || selectedSave.summary}</p></div>
                         {selectedSave.choiceText && ( <div className={`border-l-4 p-3 rounded-r-lg ${isSaveTextNode(selectedSave) ? 'bg-rose-50 border-rose-500' : 'bg-indigo-50 border-indigo-500'}`}><label className={`text-[10px] font-bold block mb-1 ${isSaveTextNode(selectedSave) ? 'text-rose-400' : 'text-indigo-400'}`}>{isSaveTextNode(selectedSave) ? '自由输入' : '关键抉择'}</label><p className={`text-sm font-bold ${isSaveTextNode(selectedSave) ? 'text-rose-800' : 'text-indigo-800'}`}>{selectedSave.choiceText}</p></div> )}
                         <div className="grid grid-cols-2 gap-3 pt-2"><div className="bg-gray-50 p-3 rounded border border-gray-100"><label className="text-[10px] text-gray-400 font-bold block">地点</label><span className="text-xs font-bold text-gray-700">{selectedSave.location || "未知"}</span></div><div className="bg-gray-50 p-3 rounded border border-gray-100"><label className="text-[10px] text-gray-400 font-bold block">进度</label><span className="text-xs font-bold text-gray-700">第 {selectedSave.metaData?.turnCount || 0} 幕</span></div></div>
                     </div>
                     <div className="p-5 bg-gray-50 border-t border-gray-100 shrink-0 flex gap-3">
                         <button onClick={() => onLoad(selectedSave)} className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold font-mono py-3 shadow-lg transition-transform active:translate-y-0.5 hover:shadow-purple-500/30 clip-path-polygon" style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}>读取进度</button>
                         <button onClick={() => onLoad(selectedSave, true)} className="flex-1 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold font-mono py-3 shadow-lg transition-transform active:translate-y-0.5 hover:shadow-teal-500/30 clip-path-polygon" style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}>查看配置</button>
                         <button onClick={() => { onDelete(selectedSave.id); setSelectedSave(null); }} className="w-10 bg-red-100 hover:bg-red-200 text-red-500 rounded flex items-center justify-center transition-colors border border-red-200" title="删除"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                     </div>
                </div>
            )}

            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                    <marker id="arrowhead-choice" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" /></marker>
                    <marker id="arrowhead-text" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#f43f5e" /></marker>
                </defs>
            </svg>
        </div>
    );
};
