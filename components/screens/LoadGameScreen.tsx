import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SavedGame, SaveType, generateUUID, StoryGenre, StorySegment } from '../../types';
import { Button } from '../Button';
import { GenreAvatar } from '../GenreAvatar';

interface LoadGameScreenProps {
    savedGames: SavedGame[];
    onLoad: (save: SavedGame, forceSetup?: boolean) => void;
    onDelete: (id: string, e?: React.MouseEvent) => void;
    onDeleteSession: (sessionId: string) => void;
    onBack: () => void;
    onImport: (save: SavedGame | SavedGame[]) => number; // Updated signature
    playClickSound: () => void;
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
}

type ViewMode = 'list' | 'canvas';

// Default Memory structure for imports
const DEFAULT_MEMORY = {
    memoryZone: "",
    storyMemory: "",
    longTermMemory: "",
    coreMemory: "",
    characterRecord: "",
    inventory: "暂无物品"
};

// --- Download Modal Component ---
interface DownloadModalProps {
    save: SavedGame;
    resolvedBackground?: string;
    onClose: () => void;
    onBackupSession: (includeImages: boolean) => void;
}

const DownloadModal: React.FC<DownloadModalProps> = ({ save, resolvedBackground, onClose, onBackupSession }) => {
    const [includeImages, setIncludeImages] = useState(true);

    const handleDownloadConfig = () => {
        const configData = {
            storyName: save.storyName,
            genre: save.genre,
            customGenre: save.context.customGenre,
            character: save.context.character,
            worldSettings: save.context.worldSettings,
            supportingCharacters: save.context.supportingCharacters,
            exportedAt: new Date().toISOString()
        };
        
        downloadJson(configData, `config_${save.storyName || save.characterName}_${new Date().toISOString().slice(0,10)}.json`);
        onClose();
    };

    const handleDownloadFull = () => {
        // Deep clone to avoid mutating the original object in state
        const fullData = JSON.parse(JSON.stringify(save));
        
        // Fix: Inject resolved background if current segment missing it (due to storage optimization)
        if (fullData.context.currentSegment && !fullData.context.currentSegment.backgroundImage && resolvedBackground) {
            fullData.context.currentSegment.backgroundImage = resolvedBackground;
        }

        fullData.exportedAt = new Date().toISOString();
        fullData.version = "2.5";

        downloadJson(fullData, `save_${save.storyName || save.characterName}_${new Date().toISOString().slice(0,10)}.json`);
        onClose();
    };

    const downloadJson = (data: any, filename: string) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in-up" onClick={onClose}>
            <div className="bg-stone-100 border border-stone-200 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 border-b border-stone-200 pb-2">
                     <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        下载数据
                     </h3>
                     <button onClick={onClose} className="text-gray-400 hover:text-gray-800">✕</button>
                </div>
                
                <p className="text-sm text-gray-600 mb-6">
                    请选择您要导出的数据类型。
                </p>

                <div className="space-y-3">
                    <button 
                        onClick={handleDownloadConfig}
                        className="w-full flex flex-col items-start p-3 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors group"
                    >
                        <div className="flex items-center gap-2 font-bold text-blue-700 mb-1">
                            下载故事配置
                        </div>
                        <div className="text-[10px] text-blue-500/80">仅包含设定、主角信息、世界观与人物羁绊。</div>
                    </button>

                    <button 
                        onClick={handleDownloadFull}
                        className="w-full flex flex-col items-start p-3 rounded border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors group"
                    >
                        <div className="flex items-center gap-2 font-bold text-purple-700 mb-1">
                            下载当前节点存档
                        </div>
                        <div className="text-[10px] text-purple-500/80 leading-relaxed">
                            包含完整的剧情历史与当前状态。<br/>
                            <span className="text-rose-500 font-bold">注意：此选项仅保存当前节点及其线性过往，不包含该世界线上的其他平行分支。</span>
                        </div>
                    </button>
                    
                    <div className="w-full flex flex-col items-start p-3 rounded border border-emerald-200 bg-emerald-50 group">
                        <div className="font-bold text-emerald-700 mb-1">备份整条世界线 (全部节点)</div>
                        <div className="text-[10px] text-emerald-600/80 leading-relaxed mb-3">
                            将打包导出该故事线下的所有平行宇宙分支与历史节点。<br/>
                            <span className="font-bold">注意：包含大量冗余数据与图片，文件体积可能较大。</span>
                        </div>
                        
                        <div className="space-y-2 mb-3 w-full bg-white/50 p-2 rounded border border-emerald-200">
                            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-not-allowed opacity-70">
                                <input type="checkbox" checked disabled className="w-4 h-4" />
                                <span>包含文本数据 (必需)</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={includeImages} 
                                    onChange={(e) => setIncludeImages(e.target.checked)}
                                    className="w-4 h-4 accent-emerald-600"
                                />
                                <span>包含图片文件 (可能很大)</span>
                            </label>
                        </div>

                        <button 
                            onClick={() => { onBackupSession(includeImages); onClose(); }}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-2 rounded transition-colors"
                        >
                            开始备份
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};


export const LoadGameScreen: React.FC<LoadGameScreenProps> = ({ savedGames, onLoad, onDelete, onDeleteSession, onBack, onImport, playClickSound }) => {
    // Mode State
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    // Focused Session State (for isolation)
    const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);
    
    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGenreFilter, setSelectedGenreFilter] = useState<string>('all');

    // Canvas State
    const [pan, setPan] = useState<Coords>({ x: 100, y: 100 });
    const [scale, setScale] = useState(1);
    
    // Canvas Pan State
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePos, setLastMousePos] = useState<Coords>({ x: 0, y: 0 });
    
    // Node Drag State
    const [nodePositions, setNodePositions] = useState<Record<string, {x: number, y: number}>>({});
    const [dragNodeState, setDragNodeState] = useState<{id: string, startX: number, startY: number, originX: number, originY: number} | null>(null);
    const isNodeDraggingRef = useRef(false);
    // Ref to track if we actually moved during a "click" to distinguish drag vs click
    const hasMovedRef = useRef(false);
    
    // Ref to track if the interaction started on the background canvas
    const isBackgroundInteractionRef = useRef(false);
    
    // Control Key State
    const [isCtrlDown, setIsCtrlDown] = useState(false);
    
    // Download Modal State
    const [saveToDownload, setSaveToDownload] = useState<SavedGame | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedSave, setSelectedSave] = useState<SavedGame | null>(null);

    // Track Ctrl Key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control' || e.key === 'Meta') setIsCtrlDown(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control' || e.key === 'Meta') setIsCtrlDown(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        // Safety cleanup if window loses focus
        const handleBlur = () => setIsCtrlDown(false);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    // Helper to resolve background image recursively
    const resolveBackground = (save: SavedGame | null): string | undefined => {
        if (!save) return undefined;
        let curr: SavedGame | undefined = save;
        while (curr) {
            if (curr.context.currentSegment?.backgroundImage) return curr.context.currentSegment.backgroundImage;
            if (!curr.parentId) break;
            const pid = curr.parentId;
            curr = savedGames.find(s => s.storyId === pid);
        }
        return undefined;
    };

    const resolvedSelectedBg = useMemo(() => resolveBackground(selectedSave), [selectedSave, savedGames]);
    // Also resolve background for the modal save if it's different from selected
    const resolvedDownloadBg = useMemo(() => resolveBackground(saveToDownload), [saveToDownload, savedGames]);

    // Group Saves by Session for List View
    const sessionGroups = useMemo(() => {
        const groups: Record<string, SavedGame[]> = {};
        
        // Filter logic first
        const filteredSaves = savedGames.filter(save => {
            const matchSearch = searchTerm === '' || 
                (save.storyName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                (save.characterName || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchGenre = selectedGenreFilter === 'all' || save.genre === selectedGenreFilter;

            return matchSearch && matchGenre;
        });

        filteredSaves.forEach(save => {
            if (!groups[save.sessionId]) groups[save.sessionId] = [];
            groups[save.sessionId].push(save);
        });
        
        // Return array of representative saves (latest timestamp or root)
        return Object.values(groups).map(group => {
            // Sort by timestamp desc to get latest
            group.sort((a, b) => b.timestamp - a.timestamp);
            
            // Prefer showing a non-setup save as the main card if possible, 
            // unless only setup exists.
            let displaySave = group[0];
            const gameSaves = group.filter(s => s.type !== SaveType.SETUP);
            if (gameSaves.length > 0) {
                displaySave = gameSaves[0]; // Latest game save
            }

            return {
                latest: displaySave, 
                count: group.length,
                root: group.find(s => !s.parentId) || group[group.length - 1],
                all: group
            };
        }).sort((a, b) => b.latest.timestamp - a.latest.timestamp);
    }, [savedGames, searchTerm, selectedGenreFilter]);

    // --- Tree Layout Algorithm ---
    const sessionTrees = useMemo(() => {
        // 1. Group by Session ID
        const sessions: Record<string, SavedGame[]> = {};
        savedGames.forEach(save => {
            // Filter by focused session if active
            if (focusedSessionId && save.sessionId !== focusedSessionId) return;
            
            if (!sessions[save.sessionId]) sessions[save.sessionId] = [];
            sessions[save.sessionId].push(save);
        });

        const trees: { sessionId: string, nodes: TreeNode[], edges: {x1: number, y1: number, x2: number, y2: number, isTextNode: boolean}[], rootY: number }[] = [];
        let globalYOffset = 0;

        Object.entries(sessions).forEach(([sessionId, sessionSaves]) => {
            // Sort by timestamp to ensure consistent processing order
            sessionSaves.sort((a, b) => a.timestamp - b.timestamp);

            // 2. Build Maps
            const childMap: Record<string, SavedGame[]> = {};
            
            sessionSaves.forEach(save => {
                const parentId = save.parentId || 'root';
                if (!childMap[parentId]) childMap[parentId] = [];
                childMap[parentId].push(save);
            });

            // 3. Layout Recursively
            const savedStoryIds = new Set(sessionSaves.map(s => s.storyId));
            const visualNodes: TreeNode[] = [];
            const nodesMap: Record<string, TreeNode> = {}; // keyed by save.id for edges
            const X_SPACING = 250;
            const Y_SPACING = 150;
            let currentLeafY = globalYOffset;
            let rootY = globalYOffset; // Track approximate root Y for jumping

            const assignCoords = (save: SavedGame, depth: number): number => {
                const myStoryId = save.storyId;
                const childrenSaves = myStoryId ? (childMap[myStoryId] || []) : [];
                
                let myY = 0;

                if (childrenSaves.length === 0) {
                    // Leaf node
                    myY = currentLeafY;
                    currentLeafY += Y_SPACING;
                } else {
                    // Internal node: Y is average of children
                    let sumY = 0;
                    childrenSaves.forEach(child => {
                        sumY += assignCoords(child, depth + 1);
                    });
                    myY = sumY / childrenSaves.length;
                }
                
                // Construct Node
                // For Setup nodes or nodes without history, assume depth 0
                const historyLen = save.context.history.length || 1;
                // If setup type, force to left
                const calculatedX = (save.type === SaveType.SETUP) ? 100 : ((historyLen - 1) * X_SPACING + 100);

                // Apply Override if exists (Visual Only)
                const finalX = nodePositions[save.id]?.x ?? calculatedX;
                const finalY = nodePositions[save.id]?.y ?? myY;

                const node: TreeNode = {
                    save,
                    children: [],
                    x: finalX,
                    y: finalY
                };
                
                nodesMap[save.id] = node;
                visualNodes.push(node);
                
                if (depth === 0) rootY = myY;

                return myY; 
            };

            // Find Roots
            // A root is any node whose parentId does not exist in the current set of storyIds for this session
            const rootSaves = sessionSaves.filter(s => !s.parentId || !savedStoryIds.has(s.parentId));
            rootSaves.sort((a, b) => a.timestamp - b.timestamp);

            rootSaves.forEach(root => {
                 assignCoords(root, 0);
                 currentLeafY += Y_SPACING; 
            });

            // 4. Build Edges
            const edges: {x1: number, y1: number, x2: number, y2: number, isTextNode: boolean}[] = [];
            visualNodes.forEach(node => {
                 const children = node.save.storyId ? childMap[node.save.storyId] : [];
                 children?.forEach(childSave => {
                     const childNode = nodesMap[childSave.id];
                     if (childNode) {
                         const isTextNode = !childSave.choiceLabel && !!childSave.parentId;
                         edges.push({
                             x1: node.x + 50,
                             y1: node.y,
                             x2: childNode.x - 50,
                             y2: childNode.y,
                             isTextNode
                         });
                     }
                 });
            });

            trees.push({ sessionId, nodes: visualNodes, edges, rootY });
            globalYOffset = currentLeafY + 200; 
        });

        return trees;
    }, [savedGames, nodePositions, focusedSessionId]);

    // Canvas Events
    const handleWheel = (e: React.WheelEvent) => {
        if (viewMode !== 'canvas' || !containerRef.current) return;
        e.stopPropagation();

        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
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
        if (viewMode !== 'canvas') return;
        isBackgroundInteractionRef.current = true;
        setIsPanning(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
        hasMovedRef.current = false;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (viewMode !== 'canvas') return;
        if ((e.ctrlKey || e.metaKey) !== isCtrlDown) {
            setIsCtrlDown(e.ctrlKey || e.metaKey);
        }

        if (dragNodeState) {
            isNodeDraggingRef.current = true;
            hasMovedRef.current = true;
            const dx = (e.clientX - dragNodeState.startX) / scale;
            const dy = (e.clientY - dragNodeState.startY) / scale;
            
            setNodePositions(prev => ({
                ...prev,
                [dragNodeState.id]: {
                    x: dragNodeState.originX + dx,
                    y: dragNodeState.originY + dy
                }
            }));
        } else if (isPanning) {
            hasMovedRef.current = true;
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = () => {
        if (viewMode !== 'canvas') return;
        if (isBackgroundInteractionRef.current && !isNodeDraggingRef.current && !hasMovedRef.current) {
             setSelectedSave(null);
        }
        setIsPanning(false);
        setDragNodeState(null);
        isBackgroundInteractionRef.current = false;
        setTimeout(() => { isNodeDraggingRef.current = false; }, 0);
    };

    const switchToCanvas = (sessionId?: string) => {
        playClickSound();
        setViewMode('canvas');
        setFocusedSessionId(sessionId || null);
        // Reset Pan/Scale when switching
        if (sessionId) {
            setPan({ x: 100, y: window.innerHeight / 2 }); 
            setScale(0.8);
        } else {
            setPan({ x: 100, y: 100 });
            setScale(0.8);
        }
    };

    const handleBackupSession = (includeImages: boolean) => {
        if (!saveToDownload) return;
        
        const sessionSaves = savedGames.filter(s => s.sessionId === saveToDownload.sessionId);
        
        if (sessionSaves.length === 0) {
            alert("未找到该世界线的存档数据。");
            return;
        }

        const backupData = sessionSaves.map(s => {
            const copy = JSON.parse(JSON.stringify(s)); // Deep clone
            
            const resolved = resolveBackground(s);
            if (copy.context.currentSegment && !copy.context.currentSegment.backgroundImage && resolved) {
                copy.context.currentSegment.backgroundImage = resolved;
            }

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

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                
                // --- CASE A: Bulk Backup Array ---
                if (Array.isArray(json)) {
                    const count = onImport(json as SavedGame[]);
                    if (count > 0) alert(`成功导入 ${count} 条记录。`);
                    else alert("没有导入任何新记录（可能全部重复）。");
                    return;
                }

                // --- CASE B: Single Save File (Reconstruction Strategy) ---
                const savesToProcess: SavedGame[] = [];
                let baseData: SavedGame;

                // 1. Identify Format
                if (json.context && json.id) {
                    baseData = json as SavedGame;
                } else if (json.character && json.worldSettings) {
                    // Config/Setup File
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
                            scheduledEvents: []
                        },
                        type: SaveType.SETUP
                    } as SavedGame;
                } else {
                    alert("无法识别的文件格式");
                    return;
                }

                // 2. Reconstruct History
                const history = baseData.context.history as StorySegment[] || [];
                
                if (history.length === 0) {
                    // No history (Setup or Empty), just push the base node
                    baseData.id = generateUUID(); // Ensure unique ID for container
                    if (!baseData.sessionId) baseData.sessionId = generateUUID();
                    savesToProcess.push(baseData);
                } else {
                    // Has history: Reconstruct chain
                    const sessionId = baseData.sessionId || generateUUID();
                    const baseTimestamp = baseData.timestamp || Date.now();

                    // A. Ensure IDs exist
                    history.forEach(seg => { if (!seg.id) seg.id = generateUUID(); });

                    // B. Build nodes
                    history.forEach((segment, index) => {
                        const isLast = index === history.length - 1;
                        
                        // LINKING LOGIC:
                        // Root (index 0): parentId = undefined (Force explicit root)
                        // Others: parentId = previous segment's ID
                        const parentId = index === 0 ? undefined : history[index - 1].id;

                        const node: SavedGame = {
                            id: generateUUID(),
                            sessionId: sessionId,
                            storyName: baseData.storyName,
                            storyId: segment.id,
                            parentId: parentId,
                            
                            // Time staggering: Latest is base, predecessors are earlier
                            timestamp: baseTimestamp - ((history.length - 1 - index) * 60 * 1000),
                            
                            genre: baseData.genre,
                            characterName: baseData.characterName,
                            
                            // Content
                            summary: segment.text ? (segment.text.substring(0, 50) + "...") : "历史节点",
                            location: segment.location || baseData.location,
                            choiceText: segment.causedBy || "",
                            
                            type: SaveType.AUTO, // Default to AUTO for intermediate nodes
                            
                            context: {
                                ...baseData.context,
                                sessionId: sessionId,
                                history: history.slice(0, index + 1),
                                currentSegment: segment,
                                // Use base memories for all, as state is linear
                                memories: isLast ? baseData.context.memories : { ...baseData.context.memories },
                                // Explicitly carry over scheduled events to ensure they are not lost during reconstruction
                                scheduledEvents: baseData.context.scheduledEvents || []
                            }
                        };

                        // Final Node Overrides (Restore Original Metadata)
                        if (isLast) {
                            node.summary = baseData.summary;
                            node.type = baseData.type || SaveType.MANUAL;
                            node.choiceLabel = baseData.choiceLabel;
                            node.choiceText = baseData.choiceText || segment.causedBy;
                            node.metaData = baseData.metaData;
                            // Ensure context is exactly as exported
                            node.context = baseData.context;
                            if (node.context.currentSegment) node.context.currentSegment.id = segment.id;
                            // Defensive check for the final node as well
                            if (!node.context.scheduledEvents) {
                                node.context.scheduledEvents = [];
                            }
                        }

                        savesToProcess.push(node);
                    });
                }

                playClickSound();
                
                // Pass array to main engine import
                const importCount = onImport(savesToProcess);

                if (importCount === 0 && savesToProcess.length > 0) {
                    alert("检测到该存档完全重复，未导入任何新节点。");
                } else if (importCount > 0) {
                    alert(`成功重构并导入 ${savesToProcess.length} 个历史节点。`);
                }

            } catch (err) {
                console.error(err);
                alert("导入失败：文件损坏");
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-stone-100 text-gray-800 select-none font-sans">
            
            {/* Header / HUD */}
            <div className="absolute top-0 left-0 p-6 z-50 flex flex-col md:flex-row md:items-center gap-4 pointer-events-none w-full bg-gradient-to-b from-stone-100/90 to-transparent pb-8">
                 <div className="flex gap-2 md:gap-4 pointer-events-auto items-center">
                    <button 
                        onClick={() => { playClickSound(); onBack(); }} 
                        className="bg-white hover:bg-stone-50 text-gray-600 hover:text-black font-bold font-mono px-4 md:px-6 py-2 shadow-lg transition-transform active:translate-y-0.5 flex items-center gap-2 clip-path-polygon text-xs md:text-sm"
                        style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                    >
                        <span>‹</span> 返回
                    </button>
                    
                    <button 
                        onClick={() => { playClickSound(); fileInputRef.current?.click(); }} 
                        className="bg-white hover:bg-stone-50 text-indigo-600 hover:text-indigo-800 font-bold font-mono px-4 md:px-6 py-2 shadow-lg transition-transform active:translate-y-0.5 flex items-center gap-2 clip-path-polygon text-xs md:text-sm"
                        style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                    >
                        <span></span> 导入
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />

                    {viewMode === 'canvas' && (
                        <button onClick={() => { playClickSound(); setViewMode('list'); setFocusedSessionId(null); }} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors bg-white/60 px-4 py-2 rounded-full border border-black/5 shadow-sm backdrop-blur-md font-bold text-xs md:text-sm">
                            <span>☰</span> 列表视图
                        </button>
                    )}
                 </div>
                 
                 {/* Filters - ONLY IN LIST MODE */}
                 {viewMode === 'list' && (
                    <div className="flex-1 flex items-center gap-2 pointer-events-auto bg-white/60 p-1.5 rounded-lg border border-black/5 backdrop-blur-md shadow-sm max-w-lg">
                        <input 
                            type="text" 
                            placeholder="搜索角色名 / 故事名..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 bg-transparent border-none outline-none text-xs md:text-sm px-2 text-gray-700 placeholder-gray-400"
                        />
                        <div className="h-4 w-px bg-gray-300"></div>
                        <select 
                            value={selectedGenreFilter}
                            onChange={(e) => setSelectedGenreFilter(e.target.value)}
                            className="bg-transparent border-none outline-none text-xs md:text-sm text-gray-600 cursor-pointer max-w-[100px]"
                        >
                            <option value="all">全部分类</option>
                            {Object.values(StoryGenre).map(g => (
                                <option key={g} value={g}>{g.split(' - ')[0]}</option>
                            ))}
                        </select>
                    </div>
                 )}
                 {viewMode === 'canvas' && (
                     <div className="flex-1 flex items-center gap-4 pointer-events-auto">
                         {focusedSessionId ? (
                             <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-md border border-amber-200 flex items-center gap-2 animate-fade-in-right">
                                 <span className="text-amber-600 text-xs font-bold">● 专注模式</span>
                                 <button 
                                    onClick={() => { playClickSound(); setFocusedSessionId(null); switchToCanvas(); }}
                                    className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-0.5 rounded transition-colors"
                                 >
                                     显示全部宇宙
                                 </button>
                             </div>
                         ) : (
                             <div className="bg-white/60 px-4 py-2 rounded-full border border-black/5 backdrop-blur-md text-xs font-mono text-gray-500 shadow-sm flex items-center gap-2">
                                 <span>上帝视角</span>
                                 <span className="w-px h-3 bg-gray-300"></span>
                                 <span className="text-gray-400">显示所有时间线</span>
                             </div>
                         )}
                     </div>
                 )}

                 <div className="bg-white/60 px-4 py-2 rounded-full border border-black/5 backdrop-blur-md text-xs font-mono text-gray-500 shadow-sm flex items-center gap-2 pointer-events-auto shrink-0 hidden md:flex">
                    <span>{viewMode === 'list' ? '记忆碎片整理' : '无限存档回廊'}</span>
                    <span className="w-px h-3 bg-gray-300"></span>
                    {viewMode === 'canvas' ? (
                        <span className="text-amber-600 font-bold">{isCtrlDown ? "● 拖拽模式已激活" : "按住 Ctrl 可拖拽节点"}</span>
                    ) : (
                        <span className="text-gray-400">显示：{sessionGroups.length}</span>
                    )}
                 </div>
            </div>

            {/* VIEW MODE: LIST */}
            {viewMode === 'list' && (
                <div className="w-full h-full pt-28 px-4 md:px-12 pb-12 overflow-y-auto custom-scrollbar bg-stone-100 animate-fade-in-up">
                    <div className="max-w-6xl mx-auto">
                        <h2 className="text-2xl font-serif font-bold text-gray-800 mb-6 flex items-center gap-2">
                            故事列表
                            {searchTerm && <span className="text-sm font-sans font-normal text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-200">筛选中...</span>}
                        </h2>
                        
                        {sessionGroups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-300 rounded-xl">
                                <span className="text-4xl mb-2 grayscale opacity-50">📂</span>
                                <p>未找到相关存档记录</p>
                                {searchTerm && <button onClick={() => { setSearchTerm(''); setSelectedGenreFilter('all'); }} className="text-indigo-500 text-sm mt-2 hover:underline">清除筛选条件</button>}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {sessionGroups.map((group) => {
                                    const save = group.latest;
                                    const bg = resolveBackground(save);
                                    const hasGameSave = save.type !== SaveType.SETUP;
                                    
                                    return (
                                        <div 
                                            key={group.latest.sessionId} 
                                            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 group hover:shadow-xl hover:-translate-y-1 hover:border-indigo-500 hover:ring-4 hover:ring-indigo-500/10 active:scale-[0.98]"
                                        >
                                            <div className="h-32 bg-gray-100 relative overflow-hidden">
                                                {bg ? (
                                                    <img src={bg} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500 group-hover:scale-105" />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                                <div className="absolute bottom-3 left-4 text-white">
                                                    <h3 className="text-lg font-bold shadow-black drop-shadow-md">{save.storyName || save.characterName}</h3>
                                                    <p className="text-[10px] opacity-80">{save.genre.split(' - ')[0]}</p>
                                                </div>
                                                
                                                {save.type === SaveType.SETUP && (
                                                    <div className="absolute top-2 left-2 bg-blue-500/90 text-white text-[10px] px-2 py-0.5 rounded shadow-lg backdrop-blur font-bold">
                                                        初始设定
                                                    </div>
                                                )}

                                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {/* NEW: Download Button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            playClickSound();
                                                            setSaveToDownload(save);
                                                        }}
                                                        className="bg-black/40 hover:bg-black/60 text-white/90 hover:text-white w-6 h-6 rounded flex items-center justify-center transition-all backdrop-blur-sm shadow-sm"
                                                        title="下载故事数据"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                    
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if(confirm('确定要删除这条世界线的全部记录吗？')) {
                                                                onDeleteSession(group.latest.sessionId);
                                                            }
                                                        }}
                                                        className="bg-black/40 hover:bg-red-600 text-white/90 hover:text-white w-6 h-6 rounded flex items-center justify-center transition-all backdrop-blur-sm shadow-sm"
                                                        title="删除整个存档"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="p-4 flex flex-col h-[180px]">
                                                <div className="flex justify-between items-center text-xs text-gray-500 mb-3 font-mono">
                                                    <span>{new Date(save.timestamp).toLocaleString()}</span>
                                                    <span>{group.count} 节点</span>
                                                </div>
                                                
                                                <p className="text-sm text-gray-600 line-clamp-2 mb-4 group-hover:text-gray-900 transition-colors flex-1">
                                                    {save.summary}
                                                </p>

                                                <div className={`grid gap-2 pt-3 border-t border-gray-100 ${hasGameSave ? 'grid-cols-3' : 'grid-cols-1'}`}>
                                                    <button 
                                                        onClick={() => onLoad(save)} 
                                                        className="py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-800 hover:text-white transition-colors flex items-center justify-center clip-path-polygon"
                                                        style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                                                    >
                                                        {save.type === SaveType.SETUP ? '编辑配置' : '读取进度'}
                                                    </button>
                                                    
                                                    {hasGameSave && (
                                                        <>
                                                            <button 
                                                                onClick={() => switchToCanvas(group.latest.sessionId)} 
                                                                className="py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors flex items-center justify-center clip-path-polygon"
                                                                style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                                                            >
                                                                查看世界线
                                                            </button>
                                                            
                                                            <button 
                                                                onClick={() => onLoad(save, true)} 
                                                                className="py-2 text-xs font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 transition-colors flex items-center justify-center clip-path-polygon"
                                                                style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                                                            >
                                                                查看配置
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* VIEW MODE: CANVAS */}
            {viewMode === 'canvas' && (
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
                            backgroundSize: `${30 * scale}px ${30 * scale}px`,
                            transform: `translate(${pan.x % (30 * scale)}px, ${pan.y % (30 * scale)}px)`
                        }}
                    />

                    <div 
                        className="absolute transition-transform duration-75 ease-out origin-top-left"
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
                        }}
                    >
                        {sessionTrees.map((tree) => (
                            <div key={tree.sessionId}>
                                {/* Render Edges */}
                                <svg className="absolute top-0 left-0 w-[10000px] h-[10000px] pointer-events-none overflow-visible" style={{ zIndex: 0 }}>
                                    {tree.edges.map((edge, i) => {
                                        const controlPointOffset = Math.abs(edge.x2 - edge.x1) / 2;
                                        const path = `M ${edge.x1} ${edge.y1} C ${edge.x1 + controlPointOffset} ${edge.y1}, ${edge.x2 - controlPointOffset} ${edge.y2}, ${edge.x2} ${edge.y2}`;
                                        
                                        const strokeColor = edge.isTextNode ? "#f43f5e" : "#cbd5e1"; 
                                        const markerId = edge.isTextNode ? "url(#arrowhead-text)" : "url(#arrowhead-choice)";
                                        const strokeWidth = edge.isTextNode ? 2 : 2;
                                        const dashArray = edge.isTextNode ? "5,5" : "none";

                                        return (
                                            <path
                                                key={i}
                                                d={path}
                                                fill="none"
                                                stroke={strokeColor}
                                                strokeWidth={strokeWidth}
                                                strokeDasharray={dashArray}
                                                markerEnd={markerId}
                                                className="transition-all duration-300"
                                            />
                                        );
                                    })}
                                </svg>

                                {/* Render Nodes */}
                                {tree.nodes.map((node) => {
                                    const isSelected = selectedSave?.id === node.save.id;
                                    const isRoot = !node.save.parentId;
                                    const isSetup = node.save.type === SaveType.SETUP;
                                    const isTextNode = !node.save.choiceLabel && !!node.save.parentId;
                                    
                                    const activeCharName = node.save.context.currentSegment?.activeCharacterName || node.save.characterName;
                                    const supportingChar = node.save.context.supportingCharacters.find(c => activeCharName.includes(c.name));
                                    const isProtagonistActive = activeCharName === node.save.characterName || activeCharName === '我';
                                    
                                    const displayAvatar = !isProtagonistActive && supportingChar?.avatar
                                        ? supportingChar.avatar
                                        : node.save.context.character.avatar;

                                    return (
                                        <div
                                            key={node.save.id}
                                            className={`absolute flex justify-center items-center group z-10 hover:z-50`}
                                            style={{
                                                left: node.x,
                                                top: node.y,
                                                transform: 'translate(-50%, -50%)',
                                                cursor: isCtrlDown ? 'grab' : 'pointer'
                                            }}
                                            onMouseDown={(e) => {
                                                if (isCtrlDown) {
                                                    e.stopPropagation();
                                                    setDragNodeState({
                                                        id: node.save.id,
                                                        startX: e.clientX,
                                                        startY: e.clientY,
                                                        originX: node.x,
                                                        originY: node.y
                                                    });
                                                } else {
                                                    e.stopPropagation();
                                                    setSelectedSave(node.save);
                                                }
                                            }}
                                        >
                                            {/* Left Panel: Choice Info */}
                                            {node.save.choiceText && (
                                                <div className="absolute right-full mr-4 w-64 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:-translate-x-2 pointer-events-none">
                                                    <div className="bg-black/80 backdrop-blur-md text-white p-3 rounded-xl border border-white/20 shadow-2xl relative">
                                                        <div className="absolute top-1/2 right-[-6px] w-3 h-3 bg-black/80 border-r border-b border-white/20 transform -translate-y-1/2 -rotate-45"></div>
                                                        <div className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${isTextNode ? 'text-rose-400' : 'text-indigo-400'}`}>
                                                            {isTextNode ? '自由输入' : `关键抉择 #${node.save.choiceLabel}`}
                                                        </div>
                                                        <div className="text-sm font-medium leading-tight">{node.save.choiceText}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Center: Avatar Node */}
                                            <div className={`relative transition-transform duration-300 ${isSelected ? 'scale-125 shadow-[0_0_20px_rgba(147,51,234,0.6)] ring-2 ring-purple-500 ring-offset-2 ring-offset-stone-100 rounded-full z-50' : ''}`}>
                                                 {isRoot && (
                                                     <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-500 text-white text-[9px] px-2 py-0.5 rounded-full shadow-sm font-bold whitespace-nowrap z-20">
                                                         起点
                                                     </div>
                                                 )}

                                                 {!isRoot && !isSetup && (
                                                    <div className={`absolute -top-3 -right-3 w-6 h-6 rounded-full flex items-center justify-center text-sm shadow-sm z-30 border-2 border-white ${isTextNode ? 'bg-rose-500 text-white' : 'bg-purple-100 text-purple-600'}`}>
                                                         {isTextNode ? '⌨' : '☰'}
                                                     </div>
                                                 )}
                                                 
                                                 <GenreAvatar 
                                                    avatar={displayAvatar}
                                                    name={activeCharName}
                                                    genre={node.save.genre}
                                                    isProtagonist={isProtagonistActive}
                                                    size="md" 
                                                    className={`${isSetup ? 'ring-2 ring-blue-400' : ''} ${isTextNode ? 'grayscale-[0.3]' : ''}`}
                                                 />

                                                 <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-2 py-0.5 rounded text-[9px] text-gray-600 font-mono shadow-sm border border-gray-200 whitespace-nowrap opacity-60 group-hover:opacity-100 transition-opacity">
                                                     {new Date(node.save.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                 </div>
                                            </div>

                                            {/* Right Panel: Story Preview */}
                                            <div className="absolute left-full ml-4 w-72 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-2 pointer-events-none z-50">
                                                <div className="bg-white/95 backdrop-blur-md text-gray-800 p-4 rounded-xl border border-gray-200 shadow-2xl relative">
                                                    <div className="absolute top-1/2 left-[-6px] w-3 h-3 bg-white/95 border-l border-t border-gray-200 transform -translate-y-1/2 -rotate-45"></div>
                                                    
                                                    <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-2">
                                                        <span className="text-xs font-bold text-gray-500">{node.save.location || "未知区域"}</span>
                                                        <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">第 {node.save.metaData?.turnCount || 0} 幕</span>
                                                    </div>
                                                    
                                                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">
                                                        {node.save.context.currentSegment?.text || node.save.summary}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                    
                    {selectedSave && (
                        <div 
                            className="absolute top-20 right-6 w-96 bg-white/90 backdrop-blur-md border border-gray-200 shadow-2xl rounded-xl p-0 animate-fade-in-right z-[60] flex flex-col max-h-[calc(100vh-120px)] overflow-hidden"
                            onWheel={(e) => e.stopPropagation()}
                        >
                             <div className="relative h-40 bg-gray-100 shrink-0">
                                {resolvedSelectedBg ? (
                                    <img src={resolvedSelectedBg} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">NO IMAGE</div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                                <div className="absolute bottom-4 left-5 right-5 text-white">
                                    <h3 className="font-bold text-xl shadow-black drop-shadow-md">{selectedSave.storyName || selectedSave.characterName}</h3>
                                    <p className="text-xs opacity-80 font-mono">{new Date(selectedSave.timestamp).toLocaleString()}</p>
                                </div>
                                <button onClick={() => setSelectedSave(null)} className="absolute top-3 right-3 bg-black/30 hover:bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors">✕</button>
                             </div>

                             <div 
                                className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 bg-white/50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
                                onWheel={(e) => e.stopPropagation()}
                             >
                                 <div>
                                     <label className="text-[10px] text-indigo-400 font-bold mb-1 block">剧情回顾</label>
                                     <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-serif">
                                         {selectedSave.context.currentSegment?.text || selectedSave.summary}
                                     </p>
                                 </div>
                                 
                                 {selectedSave.choiceText && (
                                     <div className={`border-l-4 p-3 rounded-r-lg ${!selectedSave.choiceLabel && selectedSave.parentId ? 'bg-rose-50 border-rose-500' : 'bg-indigo-50 border-indigo-500'}`}>
                                        <label className={`text-[10px] font-bold block mb-1 ${!selectedSave.choiceLabel && selectedSave.parentId ? 'text-rose-400' : 'text-indigo-400'}`}>
                                            {!selectedSave.choiceLabel && selectedSave.parentId ? '自由输入' : '关键抉择'}
                                        </label>
                                        <p className={`text-sm font-bold ${!selectedSave.choiceLabel && selectedSave.parentId ? 'text-rose-800' : 'text-indigo-800'}`}>{selectedSave.choiceText}</p>
                                     </div>
                                 )}

                                 <div className="grid grid-cols-2 gap-3 pt-2">
                                     <div className="bg-gray-50 p-3 rounded border border-gray-100">
                                         <label className="text-[10px] text-gray-400 font-bold block">地点</label>
                                         <span className="text-xs font-bold text-gray-700">{selectedSave.location || "未知"}</span>
                                     </div>
                                     <div className="bg-gray-50 p-3 rounded border border-gray-100">
                                          <label className="text-[10px] text-gray-400 font-bold block">进度</label>
                                          <span className="text-xs font-bold text-gray-700">第 {selectedSave.metaData?.turnCount || 0} 幕</span>
                                     </div>
                                 </div>
                             </div>

                             <div className="p-5 bg-gray-50 border-t border-gray-100 shrink-0 flex gap-3">
                                 <button 
                                    onClick={() => onLoad(selectedSave)} 
                                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold font-mono py-3 shadow-lg transition-transform active:translate-y-0.5 hover:shadow-purple-500/30 clip-path-polygon"
                                    style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                                 >
                                     读取进度
                                 </button>
                                 <button 
                                     onClick={() => onLoad(selectedSave, true)} 
                                     className="flex-1 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold font-mono py-3 shadow-lg transition-transform active:translate-y-0.5 hover:shadow-teal-500/30 clip-path-polygon"
                                     style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                                 >
                                     查看配置
                                 </button>
                                 <button 
                                     onClick={() => { if(confirm('删除此节点?')) onDelete(selectedSave.id); setSelectedSave(null); }}
                                     className="w-10 bg-red-100 hover:bg-red-200 text-red-500 rounded flex items-center justify-center transition-colors border border-red-200"
                                     title="删除"
                                 >
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                     </svg>
                                 </button>
                             </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* Download Modal Overlay */}
            {saveToDownload && (
                <DownloadModal 
                    save={saveToDownload}
                    resolvedBackground={resolvedDownloadBg}
                    onBackupSession={handleBackupSession}
                    onClose={() => setSaveToDownload(null)} 
                />
            )}

            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                    <marker id="arrowhead-choice" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
                    </marker>
                    <marker id="arrowhead-text" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#f43f5e" />
                    </marker>
                </defs>
            </svg>
        </div>
    );
};
