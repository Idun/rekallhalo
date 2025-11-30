import React, { useRef, useState, useEffect } from 'react';
import { PlotChapter, generateUUID, SupportingCharacter } from '../../../types';

export interface FloatingNode {
    id: string;
    type: 'prereq' | 'completion' | 'character' | 'keyEvent' | 'scheduledEvent' | 'memo';
    label: string;
    data: {
        value: string; // The text content of the constraint
    };
    x: number;
    y: number;
}

interface DraggingAttachedItem {
    sourceChapterId: string;
    field: 'prerequisites' | 'keyCharacters' | 'keyEvents' | 'summary';
    value: string;
    label: string;
    type: 'prereq' | 'character' | 'keyEvent' | 'scheduledEvent' | 'summary';
    isCopy?: boolean; // Flag for copy operation
}

interface PlotGraphViewProps {
    chapters: PlotChapter[];
    setChapters: (chapters: PlotChapter[]) => void;
    activeChapterId: string | null;
    setActiveChapterId: (id: string | null) => void;
    nodePositions: Record<string, {x: number, y: number}>;
    setNodePositions: React.Dispatch<React.SetStateAction<Record<string, {x: number, y: number}>>>;
    onAddChapter: () => void;
    onDeleteChapter: (id: string, e: React.MouseEvent) => void;
    onResetLayout: () => void;
    // New Props for Floating Nodes
    floatingNodes: FloatingNode[];
    setFloatingNodes: React.Dispatch<React.SetStateAction<FloatingNode[]>>;
    characters: SupportingCharacter[];
    onRequestCreateEventNode: (x: number, y: number) => void;
    onSnapshot: () => void; // Snapshot callback for undo
    // New Props for Copy
    onCopyAttachedItem: (targetId: string, item: DraggingAttachedItem) => void;
}

export const PlotGraphView: React.FC<PlotGraphViewProps> = ({
    chapters, setChapters, activeChapterId, setActiveChapterId, 
    nodePositions, setNodePositions, onAddChapter, onDeleteChapter,
    floatingNodes, setFloatingNodes, characters, onRequestCreateEventNode,
    onSnapshot, onCopyAttachedItem
}) => {
    const [canvasPan, setCanvasPan] = useState<{x: number, y: number}>({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    // Track start position for drag trail animation
    const [dragNodeStartPos, setDragNodeStartPos] = useState<{x: number, y: number} | null>(null);
    
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePos, setLastMousePos] = useState<{x: number, y: number}>({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    // Floating Nodes State
    const [contextMenu, setContextMenu] = useState<{x: number, y: number, visible: boolean}>({ x: 0, y: 0, visible: false });
    const [draggingFloatingId, setDraggingFloatingId] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionStartPos, setConnectionStartPos] = useState<{x: number, y: number} | null>(null);

    // Memo Modal State
    const [memoModal, setMemoModal] = useState<{ visible: boolean, x: number, y: number, value: string } | null>(null);

    // Attached Item Dragging State
    const [draggingAttachedItem, setDraggingAttachedItem] = useState<DraggingAttachedItem | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const [mousePagePos, setMousePagePos] = useState<{x: number, y: number}>({ x: 0, y: 0 });

    // Editing Attached Item State
    const [editingItem, setEditingItem] = useState<{
        chapterId: string;
        field: 'prerequisites' | 'keyEvents' | 'keyCharacters';
        index: number;
        value: string;
    } | null>(null);

    // --- Helpers ---
    const toggleNodeExpand = (id: string) => {
        const newSet = new Set(expandedNodeIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedNodeIds(newSet);
    };

    const handleUpdateSummary = (id: string, newSummary: string) => {
        setChapters(chapters.map(c => c.id === id ? { ...c, summary: newSummary } : c));
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            setContextMenu({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                visible: true
            });
        }
    };

    const handleOpenMemoModal = () => {
        // Calculate position relative to canvas (inverse transform)
        const relX = (contextMenu.x - canvasPan.x) / scale;
        const relY = (contextMenu.y - canvasPan.y) / scale;
        
        setMemoModal({ visible: true, x: relX, y: relY, value: '' });
        setContextMenu({ ...contextMenu, visible: false });
    };

    const handleSaveMemo = () => {
        if (!memoModal || !memoModal.value.trim()) {
            setMemoModal(null);
            return;
        }
        
        const newNode: FloatingNode = {
            id: generateUUID(),
            type: 'memo',
            label: '灵感便签',
            data: { value: memoModal.value },
            x: memoModal.x,
            y: memoModal.y
        };
        setFloatingNodes([...floatingNodes, newNode]);
        setMemoModal(null);
    };

    const createFloatingNode = (type: FloatingNode['type'], initialLabel: string) => {
        // Calculate position relative to canvas (inverse transform)
        const relX = (contextMenu.x - canvasPan.x) / scale;
        const relY = (contextMenu.y - canvasPan.y) / scale;

        // If creating a scheduled event, delegate to parent to open modal
        if (type === 'scheduledEvent') {
            onRequestCreateEventNode(relX, relY);
            setContextMenu({ ...contextMenu, visible: false });
            return;
        }

        const newNode: FloatingNode = {
            id: generateUUID(),
            type,
            label: initialLabel, // Visual label for the header
            data: { value: '' }, // Empty init value for user to fill
            x: relX,
            y: relY
        };
        setFloatingNodes([...floatingNodes, newNode]);
        setContextMenu({ ...contextMenu, visible: false });
    };

    const deleteFloatingNode = (id: string) => {
        setFloatingNodes(prev => prev.filter(n => n.id !== id));
    };

    const handleFloatingValueChange = (id: string, newVal: string) => {
        setFloatingNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, value: newVal } } : n));
    };

    const handleConnectionDrop = (targetChapterId: string) => {
        if (!draggingFloatingId) return;
        const node = floatingNodes.find(n => n.id === draggingFloatingId);
        if (!node) return;

        const content = node.data.value.trim();
        if (!content) {
            alert("请在卡片中填写内容后再连接");
            setDraggingFloatingId(null);
            setIsConnecting(false);
            setDropTargetId(null);
            return;
        }

        const chapter = chapters.find(c => c.id === targetChapterId);
        if (chapter) {
            // Save state for undo before modifying
            onSnapshot();

            let updatedChapter = { ...chapter };
            let msg = '';

            switch (node.type) {
                case 'prereq':
                    const currentPre = updatedChapter.prerequisites || [];
                    if (!currentPre.includes(content)) {
                        updatedChapter.prerequisites = [...currentPre, content];
                        msg = "前置条件已添加";
                    }
                    break;
                case 'keyEvent':
                    const currentEvents = updatedChapter.keyEvents ? updatedChapter.keyEvents.split(/[;；]/).map(s => s.trim()).filter(s => s) : [];
                    if (!currentEvents.includes(content)) {
                        currentEvents.push(content);
                        updatedChapter.keyEvents = currentEvents.join('；');
                        msg = "关键事件已追加";
                    }
                    break;
                case 'character':
                    const currentChars = updatedChapter.keyCharacters || [];
                    if (!currentChars.includes(content)) {
                        updatedChapter.keyCharacters = [...currentChars, content];
                        msg = "角色已关联";
                    }
                    break;
                case 'scheduledEvent':
                    const eventStr = `[伏笔: ${content}]`;
                    const currentEventsSched = updatedChapter.keyEvents ? updatedChapter.keyEvents.split(/[;；]/).map(s => s.trim()).filter(s => s) : [];
                    if (!currentEventsSched.includes(eventStr)) {
                        currentEventsSched.push(eventStr);
                        updatedChapter.keyEvents = currentEventsSched.join('；');
                        msg = "伏笔已关联至本章";
                    }
                    break;
                case 'memo':
                    // Append memo content to summary
                    const newSummary = updatedChapter.summary 
                        ? updatedChapter.summary + '\n\n' + content 
                        : content;
                    updatedChapter.summary = newSummary;
                    msg = "灵感已并入剧情摘要";
                    break;
            }

            if (msg) {
                setChapters(chapters.map(c => c.id === targetChapterId ? updatedChapter : c));
                // Remove the node after successful attachment
                setFloatingNodes(prev => prev.filter(n => n.id !== draggingFloatingId));
            }
        }
        setDraggingFloatingId(null);
        setIsConnecting(false);
        setDropTargetId(null);
    };

    // --- Interaction Handlers (Mouse/Drag) ---

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; 
        if ((e.target as HTMLElement).closest('.stop-propagation')) return;
        setContextMenu({ ...contextMenu, visible: false }); 
        setEditingItem(null);
        setMemoModal(null); // Close memo modal if clicking outside
        setActiveChapterId(null); // Deselect chapter on background click
        setIsPanning(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDraggingNodeId(id);
        // Record start position for drag trail animation
        const pos = nodePositions[id] || { x: 0, y: 0 };
        setDragNodeStartPos({ x: pos.x, y: pos.y });
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleFloatingDragStart = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDraggingFloatingId(id);
        setIsConnecting(false); 
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleConnectionDragStart = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDraggingFloatingId(id);
        setIsConnecting(true);
        const node = floatingNodes.find(n => n.id === id);
        if (node) {
            // Start connection from the center of the drag handle
            setConnectionStartPos({ x: node.x + 128, y: node.y + 140 });
        }
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleAttachedItemDragStart = (e: React.MouseEvent, chapterId: string, field: DraggingAttachedItem['field'], value: string, type: DraggingAttachedItem['type']) => {
        e.stopPropagation();
        e.preventDefault();
        
        let label = value;
        if (type === 'keyEvent') label = value.replace(/[\[\]伏笔:]/g, ''); 
        if (type === 'summary') label = value.length > 15 ? value.substring(0, 15) + "..." : value;

        // Check if Ctrl or Meta is held for Copy Mode
        const isCopy = e.ctrlKey || e.metaKey;

        setDraggingAttachedItem({
            sourceChapterId: chapterId,
            field,
            value,
            label,
            type,
            isCopy
        });
        setMousePagePos({ x: e.clientX, y: e.clientY });
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        setMousePagePos({ x: e.clientX, y: e.clientY });

        if ((draggingFloatingId && isConnecting) || draggingAttachedItem) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                const canvasX = (e.clientX - rect.left - canvasPan.x) / scale;
                const canvasY = (e.clientY - rect.top - canvasPan.y) / scale;
                
                let foundTarget: string | null = null;
                for (const [id, pos] of Object.entries(nodePositions)) {
                    if (canvasX >= pos.x && canvasX <= pos.x + 260 && canvasY >= pos.y && canvasY <= pos.y + 200) {
                        foundTarget = id;
                        break;
                    }
                }
                setDropTargetId(foundTarget);
            }
        } else {
            setDropTargetId(null);
        }

        if (isPanning) {
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            setCanvasPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setLastMousePos({ x: e.clientX, y: e.clientY });
        } else if (draggingNodeId) {
            const dx = (e.clientX - lastMousePos.x) / scale;
            const dy = (e.clientY - lastMousePos.y) / scale;
            setNodePositions(prev => ({
                ...prev,
                [draggingNodeId]: {
                    x: (prev[draggingNodeId]?.x || 0) + dx,
                    y: (prev[draggingNodeId]?.y || 0) + dy
                }
            }));
            setLastMousePos({ x: e.clientX, y: e.clientY });
        } else if (draggingFloatingId && !isConnecting) {
            const dx = (e.clientX - lastMousePos.x) / scale;
            const dy = (e.clientY - lastMousePos.y) / scale;
            setFloatingNodes(prev => prev.map(n => n.id === draggingFloatingId ? { ...n, x: n.x + dx, y: n.y + dy } : n));
            setLastMousePos({ x: e.clientX, y: e.clientY });
        } else if (draggingFloatingId && isConnecting) {
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleCanvasMouseUp = (e: React.MouseEvent) => {
        if (draggingFloatingId && isConnecting) {
            if (dropTargetId) {
                handleConnectionDrop(dropTargetId);
            }
        }
        
        if (draggingAttachedItem && dropTargetId) {
            if (draggingAttachedItem.isCopy) {
                // Copy Logic: Add to target, don't remove from source
                onCopyAttachedItem(dropTargetId, draggingAttachedItem);
            } else if (dropTargetId !== draggingAttachedItem.sourceChapterId) {
                // Move Logic: Remove from source, add to target
                moveAttachedItem(draggingAttachedItem, dropTargetId);
            }
        }

        setIsPanning(false);
        setDraggingNodeId(null);
        setDragNodeStartPos(null); // Clear drag trail start point
        setDraggingFloatingId(null);
        setDraggingAttachedItem(null);
        setIsConnecting(false);
        setConnectionStartPos(null);
        setDropTargetId(null);
    };

    const moveAttachedItem = (item: DraggingAttachedItem, targetId: string) => {
        const sourceChapter = chapters.find(c => c.id === item.sourceChapterId);
        const targetChapter = chapters.find(c => c.id === targetId);
        if (!sourceChapter || !targetChapter) return;

        onSnapshot(); // Save state

        let updatedChapters = [...chapters];

        // Remove from source
        const remove = (chap: PlotChapter) => {
            let newChap = { ...chap };
            if (item.field === 'summary') {
                newChap.summary = "";
            } else if (item.field === 'keyEvents') {
                const arr = (newChap.keyEvents || "").split(/[;；]/).filter(s => s.trim());
                newChap.keyEvents = arr.filter(s => s !== item.value).join('；');
            } else {
                const arr = newChap[item.field] as string[] || [];
                // @ts-ignore
                newChap[item.field] = arr.filter(s => s !== item.value);
            }
            return newChap;
        };

        // Add to target
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

        updatedChapters = updatedChapters.map(c => {
            if (c.id === item.sourceChapterId) return remove(c);
            if (c.id === targetId) return add(c);
            return c;
        });

        setChapters(updatedChapters);
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        const oldScale = scale;
        const newScale = Math.min(Math.max(oldScale + delta, 0.2), 2);

        // Center zoom on mouse position
        const newPanX = mouseX - (mouseX - canvasPan.x) * (newScale / oldScale);
        const newPanY = mouseY - (mouseY - canvasPan.y) * (newScale / oldScale);

        setScale(newScale);
        setCanvasPan({ x: newPanX, y: newPanY });
    };

    const handleAutoLayout = () => {
        const newPositions: Record<string, {x: number, y: number}> = {};
        const levelSpacing = 320;
        const centerY = 300;
        
        chapters.forEach((c, i) => {
            newPositions[c.id] = { 
                x: 100 + (i * levelSpacing), 
                y: centerY + (Math.sin(i * 0.8) * 50) 
            };
        });
        setNodePositions(newPositions);
        setCanvasPan({ x: 50, y: 50 });
        setScale(0.8);
    };

    // --- Attached Item Editing ---
    const openEditAttached = (chapterId: string, field: 'prerequisites' | 'keyEvents' | 'keyCharacters', index: number, value: string) => {
        setEditingItem({ chapterId, field, index, value });
    };

    const saveEditAttached = () => {
        if (!editingItem) return;
        const { chapterId, field, index, value } = editingItem;
        const chapter = chapters.find(c => c.id === chapterId);
        if (!chapter) return;

        onSnapshot(); // Save state

        let updatedChapter = { ...chapter };

        if (field === 'keyEvents') {
            const events = (updatedChapter.keyEvents || "").split(/[;；]/).map(s => s.trim());
            if (value.trim() === "") {
                events.splice(index, 1);
            } else {
                events[index] = value.trim();
            }
            updatedChapter.keyEvents = events.join('；');
        } else {
            const arr = [...(updatedChapter[field] || [])];
            if (value.trim() === "") {
                arr.splice(index, 1);
            } else {
                arr[index] = value.trim();
            }
            // @ts-ignore
            updatedChapter[field] = arr;
        }

        setChapters(chapters.map(c => c.id === chapterId ? updatedChapter : c));
        setEditingItem(null);
    };

    const deleteAttached = () => {
        if (!editingItem) return;
        setEditingItem({ ...editingItem, value: "" });
        setTimeout(saveEditAttached, 0);
    };

    return (
        <div 
            className="relative w-full h-full bg-stone-100 overflow-hidden cursor-grab active:cursor-grabbing"
            ref={containerRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleWheel}
            onContextMenu={handleContextMenu}
        >
            <div 
                className="absolute left-0 top-0 w-full h-full origin-top-left transition-transform duration-75 ease-out"
                style={{ transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${scale})` }}
            >
                {/* Connections Layer */}
                <svg className="absolute top-[-5000px] left-[-5000px] w-[10000px] h-[10000px] pointer-events-none overflow-visible" style={{ zIndex: 0 }}>
                    {/* Drag Trail for Chapter Nodes */}
                    {draggingNodeId && dragNodeStartPos && nodePositions[draggingNodeId] && (
                        <line 
                            x1={dragNodeStartPos.x + 5000 + 128} 
                            y1={dragNodeStartPos.y + 5000 + 100} 
                            x2={nodePositions[draggingNodeId].x + 5000 + 128} 
                            y2={nodePositions[draggingNodeId].y + 5000 + 100} 
                            stroke="#cbd5e1" 
                            strokeWidth="2" 
                            strokeDasharray="8,4" 
                            className="opacity-50"
                        />
                    )}

                    {draggingFloatingId && isConnecting && connectionStartPos && (
                        <line 
                            x1={connectionStartPos.x + 5000} 
                            y1={connectionStartPos.y + 5000} 
                            x2={(lastMousePos.x - canvasPan.x)/scale + 5000} 
                            y2={(lastMousePos.y - canvasPan.y)/scale + 5000} 
                            stroke={dropTargetId ? "#10b981" : "#3b82f6"} 
                            strokeWidth={dropTargetId ? "4" : "2"}
                            strokeDasharray="5"
                            className={dropTargetId ? "" : "animate-pulse"}
                        />
                    )}
                    {chapters.map((chapter, i) => {
                        if (i < chapters.length - 1) {
                            const start = nodePositions[chapter.id] || {x:0, y:0};
                            const next = chapters[i+1];
                            const end = nodePositions[next.id] || {x:0, y:0};
                            
                            const isHighlighted = hoveredNodeId === next.id;
                            const strokeColor = isHighlighted ? "#06b6d4" : "#94a3b8";
                            const strokeWidth = isHighlighted ? "4" : "2";
                            const opacity = isHighlighted ? 1 : 0.6;

                            const dist = Math.abs(end.x - start.x);
                            const cpOffset = Math.max(dist * 0.5, 50);
                            const sX = start.x + 120; const sY = start.y + 50;
                            const eX = end.x + 120; const eY = end.y + 50;
                            const off = 5000;
                            return (
                                <path 
                                    key={i} 
                                    d={`M ${sX + off} ${sY + off} C ${sX + cpOffset + off} ${sY + off}, ${eX - cpOffset + off} ${eY + off}, ${eX + off} ${eY + off}`} 
                                    fill="none" 
                                    stroke={strokeColor} 
                                    strokeWidth={strokeWidth} 
                                    strokeDasharray={isHighlighted ? "none" : "4"}
                                    strokeOpacity={opacity}
                                    className="transition-all duration-300"
                                />
                            );
                        }
                        return null;
                    })}
                </svg>
                
                {/* Floating Cards */}
                {floatingNodes.map(node => (
                    <div 
                        key={node.id}
                        onMouseDown={(e) => handleFloatingDragStart(e, node.id)}
                        className={`absolute w-64 rounded-lg shadow-xl border-2 flex flex-col z-30 transition-transform stop-propagation ${
                            node.type === 'prereq' ? 'bg-white border-amber-300' :
                            node.type === 'keyEvent' ? 'bg-white border-red-300' :
                            node.type === 'character' ? 'bg-white border-blue-300' :
                            node.type === 'memo' ? 'bg-stone-50 border-stone-200' :
                            'bg-white border-purple-300'
                        }`}
                        style={{ left: node.x, top: node.y }}
                    >
                        {/* Card Header */}
                        <div className={`px-2 py-1.5 text-[10px] font-bold flex justify-between items-center rounded-t-md ${
                            node.type === 'prereq' ? 'bg-amber-100 text-amber-800' :
                            node.type === 'keyEvent' ? 'bg-red-100 text-red-800' :
                            node.type === 'character' ? 'bg-blue-100 text-blue-800' :
                            node.type === 'memo' ? 'bg-stone-200 text-stone-700' :
                            'bg-purple-100 text-purple-800'
                        }`}>
                            <span className="uppercase tracking-wider">{node.label}</span>
                            <button onClick={() => deleteFloatingNode(node.id)} className="hover:text-red-600 bg-white/20 rounded px-1">✕</button>
                        </div>
                        {/* Card Body */}
                        <div className={`p-2 flex flex-col gap-2 rounded-b-md ${node.type === 'memo' ? 'bg-stone-50' : 'bg-white'}`}>
                            {node.type === 'character' ? (
                                <select 
                                    className="w-full text-sm border border-stone-200 rounded p-2 h-10 outline-none focus:border-cyan-400 bg-white text-gray-900 cursor-pointer select-none"
                                    value={node.data.value}
                                    onChange={(e) => handleFloatingValueChange(node.id, e.target.value)}
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    <option value="" disabled className="text-gray-500">选择角色...</option>
                                    {characters.map(char => (
                                        <option key={char.id} value={char.name} className="text-gray-900 bg-white">{char.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <textarea 
                                    className={`w-full text-sm border border-stone-200 rounded p-2 resize-none outline-none focus:border-cyan-400 select-text cursor-text placeholder-gray-400 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] 
                                        ${node.type === 'memo' 
                                            ? 'bg-stone-50 border-none h-28 focus:ring-0 text-gray-600 shadow-inner' 
                                            : 'bg-white h-24 text-gray-900'}`}
                                    placeholder={node.type === 'scheduledEvent' ? "事件描述..." : node.type === 'memo' ? "记下你的灵感..." : "输入具体内容..."}
                                    value={node.data.value}
                                    onChange={(e) => handleFloatingValueChange(node.id, e.target.value)}
                                    onMouseDown={(e) => e.stopPropagation()} // Stop drag when clicking input
                                />
                            )}
                            
                            {/* Drag Handle for Connection */}
                            <div className={`flex justify-center border-t pt-2 ${node.type === 'memo' ? 'border-stone-200' : 'border-stone-100'}`}>
                                <div 
                                    className={`w-full py-1 text-[9px] text-center rounded cursor-crosshair transition-colors font-bold ${node.type === 'memo' ? 'text-stone-400 hover:text-cyan-600 bg-stone-100 hover:bg-stone-200' : 'bg-stone-100 border border-stone-300 hover:bg-cyan-50 hover:border-cyan-400 text-stone-500'}`}
                                    title={node.type === 'memo' ? "拖拽连接至章节以添加摘要" : "拖拽连线至章节节点"}
                                    onMouseDown={(e) => handleConnectionDragStart(e, node.id)}
                                >
                                    {node.type === 'memo' ? '☍ 拖拽连接' : '拖拽以连接'}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Chapter Nodes */}
                {chapters.map((chapter, i) => {
                    const pos = nodePositions[chapter.id] || {x:0, y:0};
                    const isActive = activeChapterId === chapter.id;
                    const isCompleted = chapter.status === 'completed';
                    const isExpanded = expandedNodeIds.has(chapter.id);
                    const isHovered = hoveredNodeId === chapter.id;
                    const isDropTarget = dropTargetId === chapter.id;
                    
                    const keyEventList = chapter.keyEvents ? chapter.keyEvents.split(/[;；]/).filter(s => s.trim()) : [];

                    return (
                        <React.Fragment key={chapter.id}>
                            <div 
                                onMouseDown={(e) => handleNodeMouseDown(e, chapter.id)}
                                onMouseEnter={() => setHoveredNodeId(chapter.id)}
                                onMouseLeave={() => setHoveredNodeId(null)}
                                onClick={(e) => { e.stopPropagation(); setActiveChapterId(chapter.id); }}
                                onDoubleClick={(e) => { e.stopPropagation(); setActiveChapterId(chapter.id); }}
                                className={`absolute w-64 bg-white rounded-xl shadow-md border-2 transition-all duration-300 flex flex-col stop-propagation
                                    ${isDropTarget ? 'border-green-500 ring-4 ring-green-500/20 scale-105 z-50' : isActive ? 'border-cyan-500 ring-4 ring-cyan-500/10 z-20 scale-105' : 'border-stone-200 hover:border-cyan-300 z-10'}
                                    ${isCompleted ? 'border-green-500 bg-green-50/30' : ''}
                                    ${isHovered && !isActive && !isDropTarget ? 'shadow-xl -translate-y-1' : ''}
                                `}
                                style={{ left: pos.x, top: pos.y }}
                            >
                                <div className="p-3 pb-2 relative">
                                    <div className={`w-8 h-1 rounded-full mx-auto mb-2 transition-colors ${isActive ? 'bg-cyan-500' : 'bg-stone-200'}`}></div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex justify-between items-center pr-2">
                                        <span className="select-none">第 {i + 1} 章</span>
                                        <div className="flex items-center gap-1">
                                            {isCompleted && <span className="text-green-600">✓</span>}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDeleteChapter(chapter.id, e); }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                className="text-stone-300 hover:text-red-500 font-bold px-1 transition-colors"
                                                title="删除"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                    <div className="font-bold text-sm text-gray-800 line-clamp-1 select-none mb-2 pr-1">{chapter.title}</div>
                                    
                                    {/* Attached Constraints Area */}
                                    <div className="flex flex-wrap gap-1 min-h-[20px]">
                                        {chapter.prerequisites && chapter.prerequisites.map((req, idx) => (
                                            <button 
                                                key={`pre-${idx}`} 
                                                onMouseDown={(e) => handleAttachedItemDragStart(e, chapter.id, 'prerequisites', req, 'prereq')}
                                                onClick={(e) => { e.stopPropagation(); openEditAttached(chapter.id, 'prerequisites', idx, req); }}
                                                className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded hover:bg-amber-100 hover:border-amber-400 transition-colors max-w-full truncate cursor-grab active:cursor-grabbing"
                                                title={`🔒 ${req} (按住Ctrl拖拽可复制)`}
                                            >
                                                🔒 {req}
                                            </button>
                                        ))}
                                        {chapter.keyCharacters && chapter.keyCharacters.map((char, idx) => (
                                            <button 
                                                key={`char-${idx}`}
                                                onMouseDown={(e) => handleAttachedItemDragStart(e, chapter.id, 'keyCharacters', char, 'character')}
                                                onClick={(e) => { e.stopPropagation(); openEditAttached(chapter.id, 'keyCharacters', idx, char); }}
                                                className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded hover:bg-blue-100 hover:border-blue-400 transition-colors max-w-full truncate cursor-grab active:cursor-grabbing"
                                                title={`👤 ${char} (按住Ctrl拖拽可复制)`}
                                            >
                                                👤 {char}
                                            </button>
                                        ))}
                                        {keyEventList.map((evt, idx) => (
                                            <button 
                                                key={`evt-${idx}`}
                                                onMouseDown={(e) => handleAttachedItemDragStart(e, chapter.id, 'keyEvents', evt, evt.includes('伏笔') ? 'scheduledEvent' : 'keyEvent')}
                                                onClick={(e) => { e.stopPropagation(); openEditAttached(chapter.id, 'keyEvents', idx, evt); }}
                                                className={`text-[9px] px-1.5 py-0.5 rounded hover:opacity-80 border transition-colors max-w-full truncate text-left cursor-grab active:cursor-grabbing ${evt.includes('伏笔') ? 'bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-400' : 'bg-red-50 text-red-700 border-red-200 hover:border-red-400'}`}
                                                title={`${evt} (按住Ctrl拖拽可复制)`}
                                            >
                                                {evt.includes('伏笔') ? '🔮' : '⚡'} {evt.replace(/[\[\]伏笔:]/g, '')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Summary Section - Editable Textarea */}
                                {isExpanded && (
                                    <div className="px-2 pb-2 border-t border-stone-100 pt-2 bg-stone-50/50 rounded-b-xl animate-fade-in-up">
                                        <div className="flex items-start gap-1">
                                            <textarea
                                                value={chapter.summary || ''}
                                                onChange={(e) => handleUpdateSummary(chapter.id, e.target.value)}
                                                placeholder="输入本章剧情摘要..."
                                                className="w-full text-[10px] text-gray-600 bg-transparent border border-transparent hover:border-stone-200 focus:border-cyan-300 rounded p-1 resize-none outline-none leading-tight h-20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onWheel={(e) => e.stopPropagation()}
                                            />
                                            {/* Drag Handle for Summary */}
                                            <button
                                                onMouseDown={(e) => handleAttachedItemDragStart(e, chapter.id, 'summary', chapter.summary, 'summary')}
                                                className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-cyan-500 p-1 flex-shrink-0"
                                                title="拖拽可复制/移动摘要"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); toggleNodeExpand(chapter.id); }}
                                    className="w-full h-4 flex items-center justify-center text-[8px] text-gray-300 hover:text-cyan-500 hover:bg-stone-50 transition-colors rounded-b-xl border-t border-transparent hover:border-stone-100"
                                >
                                    {isExpanded ? '▲' : '▼'}
                                </button>
                            </div>
                            
                        </React.Fragment>
                    );
                })}
            </div>
            
            <button 
                onClick={(e) => { e.stopPropagation(); onAddChapter(); }}
                className="absolute bottom-8 right-8 w-14 h-14 rounded-full bg-cyan-600 text-white shadow-xl hover:bg-cyan-500 hover:scale-110 transition-all flex items-center justify-center text-3xl font-light z-50 border-4 border-white"
                title="添加新章节节点"
            >
                +
            </button>
            
            {/* Auto Layout Button (Floating) */}
            <button
                onClick={(e) => { e.stopPropagation(); handleAutoLayout(); }}
                className="absolute top-4 left-4 z-[60] bg-white/90 backdrop-blur border border-stone-300 shadow-lg px-3 py-1.5 rounded-full text-xs font-bold text-stone-600 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-300 transition-all flex items-center gap-2"
                title="自动整理节点布局"
            >
                <span>🕸</span> 自动布局
            </button>

            {/* Drag Proxy for Attached Items */}
            {draggingAttachedItem && (
                <div 
                    className="fixed z-[999] pointer-events-none px-3 py-1.5 rounded-full shadow-2xl font-bold text-xs bg-white border-2 border-cyan-500 text-cyan-700 opacity-90 transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-2"
                    style={{ left: mousePagePos.x, top: mousePagePos.y }}
                >
                    <span className="text-lg">{draggingAttachedItem.isCopy ? '✚' : (draggingAttachedItem.type === 'prereq' ? '🔒' : draggingAttachedItem.type === 'character' ? '👤' : draggingAttachedItem.type === 'summary' ? '📝' : '⚡')}</span>
                    <span>{draggingAttachedItem.label}</span>
                    {draggingAttachedItem.isCopy && <span className="bg-cyan-100 text-cyan-800 text-[8px] px-1 rounded ml-1">复制</span>}
                </div>
            )}

            {/* Context Menu */}
            {contextMenu.visible && (
                <div 
                    className="absolute bg-stone-100 shadow-2xl rounded-lg border border-stone-300 py-2 z-[200] flex flex-col text-xs animate-fade-in-up min-w-[160px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="px-4 py-2 text-stone-500 font-bold border-b border-stone-200 mb-1 text-[10px] tracking-widest uppercase">创建约束卡片</div>
                    <button onClick={() => handleOpenMemoModal()} className="px-4 py-2 hover:bg-stone-200 text-stone-800 text-left transition-colors font-medium flex items-center gap-2">
                        灵感便签
                    </button>
                    <button onClick={() => createFloatingNode('prereq', "前置条件")} className="px-4 py-2 hover:bg-stone-200 text-stone-800 text-left transition-colors font-medium">
                        前置条件
                    </button>
                    <button onClick={() => createFloatingNode('keyEvent', "关键事件")} className="px-4 py-2 hover:bg-stone-200 text-stone-800 text-left transition-colors font-medium">
                        关键事件
                    </button>
                    <button onClick={() => createFloatingNode('character', "关键角色")} className="px-4 py-2 hover:bg-stone-200 text-stone-800 text-left transition-colors font-medium">
                        关键角色
                    </button>
                    <button onClick={() => createFloatingNode('scheduledEvent', "预设伏笔")} className="px-4 py-2 hover:bg-stone-200 text-stone-800 text-left transition-colors font-medium">
                        预设伏笔
                    </button>
                </div>
            )}

            {/* Memo Creation Modal */}
            {memoModal && (
                <div className="absolute inset-0 z-[250] flex items-center justify-center bg-black/20 backdrop-blur-sm pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
                    <div className="bg-white p-4 rounded-xl shadow-2xl border border-stone-200 w-80 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold text-gray-700">灵感速记</h4>
                            <button onClick={() => setMemoModal(null)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">✕</button>
                        </div>
                        <textarea 
                            className="w-full h-32 bg-stone-50 border border-stone-200 rounded p-2 outline-none resize-none text-sm text-gray-700 placeholder-gray-400 leading-relaxed custom-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']" 
                            placeholder="输入你的想法、对话片段或设定细节..." 
                            value={memoModal.value}
                            onChange={(e) => setMemoModal({...memoModal, value: e.target.value})}
                            autoFocus
                        />
                        <div className="flex justify-end mt-2">
                            <button onClick={handleSaveMemo} className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded font-bold text-xs shadow-sm transition-colors">
                                生成便签
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Editing Overlay Modal */}
            {editingItem && (
                <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
                    <div className="bg-white p-4 rounded-xl shadow-2xl border border-stone-200 w-80 animate-fade-in-up">
                        <h4 className="text-sm font-bold text-gray-700 mb-2">编辑约束内容</h4>
                        
                        {editingItem.field === 'keyCharacters' ? (
                            <select
                                value={editingItem.value}
                                onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                                className="w-full border border-stone-300 rounded p-2 text-sm mb-3 outline-none focus:border-cyan-500 bg-white text-gray-900"
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                <option value="" disabled className="text-gray-500">选择角色...</option>
                                {characters.map(char => (
                                    <option key={char.id} value={char.name} className="text-gray-900 bg-white">{char.name} ({char.role})</option>
                                ))}
                            </select>
                        ) : (
                            <textarea 
                                value={editingItem.value} 
                                onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                                className="w-full border border-stone-300 rounded p-2 text-sm mb-3 h-24 resize-none focus:border-cyan-500 outline-none select-text cursor-text text-gray-900 bg-white placeholder-gray-400"
                                onMouseDown={(e) => e.stopPropagation()}
                                autoFocus
                            />
                        )}

                        <div className="flex justify-between gap-2">
                            <button onClick={deleteAttached} className="px-3 py-1.5 bg-red-100 text-red-600 rounded text-xs font-bold hover:bg-red-200">删除</button>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingItem(null)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded text-xs font-bold hover:bg-gray-200">取消</button>
                                <button onClick={saveEditAttached} className="px-3 py-1.5 bg-cyan-600 text-white rounded text-xs font-bold hover:bg-cyan-500">保存</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};