
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GameState, GameContext, StoryGenre, StoryMood, generateUUID, SupportingCharacter } from '../../types';
import { SmoothBackground } from '../SmoothBackground';
import { CHARACTER_ARCHETYPES } from '../../constants';
import * as GeminiService from '../../services/geminiService';

// Import New Refactored Components
import { CharacterEditModal, SkillEditModal } from '../setup/SetupEditModals';
import { SetupPlotPanel } from '../setup/SetupPlotPanel';
import { PlotBlueprintModal } from '../setup/plot/PlotBlueprintModal';
import { SetupProtagonistPanel } from '../setup/SetupProtagonistPanel';
import { SetupWorldPanel } from '../setup/SetupWorldPanel';
import { SetupCharactersPanel } from '../setup/SetupCharactersPanel';
import { SetupNarrativePanel } from '../setup/SetupNarrativePanel';

interface SetupScreenProps {
    context: GameContext;
    setContext: React.Dispatch<React.SetStateAction<GameContext>>;
    bgImage: string;
    setGameState: (state: GameState) => void;
    handleStartGame: () => void;
    error: string | null;
    onSaveConfig?: () => void;
    tempData?: {
        skill: { name: string, description: string, level?: number, type?: 'active' | 'passive' };
    };
    setTempData?: (data: any) => void;
    playClickSound?: () => void;
    playHoverSound?: () => void;
    handleAutoPlanBlueprint?: (config?: any) => void; // Updated signature
    isGeneratingBlueprint?: boolean;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({
    context, setContext, bgImage, setGameState, handleStartGame, error, onSaveConfig, tempData, setTempData, playClickSound, playHoverSound, handleAutoPlanBlueprint, isGeneratingBlueprint
}) => {
    // 0: Protagonist, 1: World, 2: Supporting, 3: Narrative, 4: Plot Blueprint
    const [activePanel, setActivePanel] = useState(1);
    
    // Plot Blueprint Modal State
    const [showPlotModal, setShowPlotModal] = useState(false);
    const [plotModalChapterId, setPlotModalChapterId] = useState<string | null>(null);
    const [plotModalViewMode, setPlotModalViewMode] = useState<'list' | 'graph'>('list');

    // Supporting Character State
    const [showCharModal, setShowCharModal] = useState(false);
    // Gender defaults to empty string to force user selection
    const [tempSupportingChar, setTempSupportingChar] = useState<Partial<SupportingCharacter>>({
        name: '', role: '', gender: '' as any, category: 'supporting', personality: '', appearance: '', archetype: '', archetypeDescription: '', initialAffinity: 0
    });
    
    // Skill Modal State
    const [showSkillModal, setShowSkillModal] = useState(false);
    
    // Track if we are editing an existing character
    const [editingCharId, setEditingCharId] = useState<string | null>(null);
    const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

    // Parsing State
    const [isParsing, setIsParsing] = useState(false);
    // Character Auto-Gen State
    const [isGeneratingChar, setIsGeneratingChar] = useState(false);
    // Skill Auto-Gen State
    const [isGeneratingSkill, setIsGeneratingSkill] = useState(false);

    // Use lifted state if available, else local
    const [localTempSkill, setLocalTempSkill] = useState({ name: '', description: '', level: 1, type: 'active' as 'active' | 'passive' });
    
    const tempSkill = tempData?.skill 
        ? { ...tempData.skill, type: tempData.skill.type || 'active', level: tempData.skill.level || 1 } 
        : localTempSkill;

    const setTempSkill = (val: { name: string, description: string, level: number, type: 'active' | 'passive' } | ((prev: { name: string, description: string, level: number, type: 'active' | 'passive' }) => { name: string, description: string, level: number, type: 'active' | 'passive' })) => {
        if (setTempData && tempData) {
            // @ts-ignore
            const newVal = typeof val === 'function' ? val({ ...tempData.skill, type: tempData.skill.type || 'active', level: tempData.skill.level || 1 }) : val;
            setTempData({ ...tempData, skill: newVal });
        } else {
            // @ts-ignore
            setLocalTempSkill(val);
        }
    };
    
    // Auto Name State
    const [isAutoName, setIsAutoName] = useState(!context.storyName);

    const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Validation
    const isProtagonistValid = context.character.name.trim().length > 0 && context.character.trait.trim().length > 0;
    const isStoryNameValid = isAutoName || (context.storyName && context.storyName.trim().length > 0);
    const hasSupportingChars = context.supportingCharacters.length > 0;
    
    // Progress Calculation
    const progress = useMemo(() => {
        let p = 0;
        if (isProtagonistValid) p += 25;
        if (isStoryNameValid) p += 25;
        if (hasSupportingChars) p += 25;
        p += 25; // Narrative is always valid by default
        return p;
    }, [isProtagonistValid, isStoryNameValid, hasSupportingChars]);

    const isReady = progress >= 100;

    // Wheel event listener for carousel switching
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            let el = e.target as HTMLElement;
            while(el && el !== document.body) {
                const style = window.getComputedStyle(el);
                const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll';
                if (isScrollable && el.scrollHeight > el.clientHeight) return;
                if (el.classList.contains('overflow-y-auto') && el.scrollHeight > el.clientHeight) return;
                if (!el.parentElement) break;
                el = el.parentElement;
            }

            if (wheelTimeoutRef.current) return;
            
            if (Math.abs(e.deltaY) > 20) {
                wheelTimeoutRef.current = setTimeout(() => { wheelTimeoutRef.current = null; }, 300);
                if (e.deltaY > 0) setActivePanel(prev => (prev + 1) % 5);
                else setActivePanel(prev => (prev - 1 + 5) % 5);
            }
        };
        window.addEventListener('wheel', handleWheel);
        return () => window.removeEventListener('wheel', handleWheel);
    }, []);
    
    useEffect(() => {
        if (isAutoName) {
            setContext(prev => ({ ...prev, storyName: '' }));
        }
    }, [isAutoName, setContext]);

    // --- Logic ---

    const handleSaveSupportingChar = () => {
        if (tempSupportingChar.name && tempSupportingChar.role && tempSupportingChar.gender) {
            setContext(prev => {
                const newList = [...prev.supportingCharacters];
                let updatedBlueprint = [...(prev.plotBlueprint || [])];

                if (editingCharId) {
                    const idx = newList.findIndex(c => c.id === editingCharId);
                    if (idx !== -1) {
                        const oldName = newList[idx].name;
                        const newName = tempSupportingChar.name;

                        newList[idx] = { 
                            ...newList[idx], 
                            ...tempSupportingChar as SupportingCharacter,
                            initialAffinity: tempSupportingChar.initialAffinity || 0,
                            affinity: tempSupportingChar.initialAffinity || 0
                        };

                        // SYNC FIX: If name changed, update all occurrences in Plot Blueprint
                        if (oldName && newName && oldName !== newName) {
                            updatedBlueprint = updatedBlueprint.map(chapter => ({
                                ...chapter,
                                keyCharacters: (chapter.keyCharacters || []).map(k => k === oldName ? newName : k)
                            }));
                        }
                    }
                } else {
                    const affinityVal = tempSupportingChar.initialAffinity || 0;
                    const randomArchetype = CHARACTER_ARCHETYPES[Math.floor(Math.random() * CHARACTER_ARCHETYPES.length)];
                    newList.push({
                        id: generateUUID(),
                        ...tempSupportingChar as SupportingCharacter,
                        affinity: affinityVal,
                        initialAffinity: affinityVal,
                        archetype: randomArchetype.name,
                        archetypeDescription: randomArchetype.description
                    } as SupportingCharacter);
                }
                return { ...prev, supportingCharacters: newList, plotBlueprint: updatedBlueprint };
            });
            closeCharModal();
        }
    };

    const handleSmartParse = async () => {
        const outline = context.customGenre;
        if (!outline || outline.trim().length < 10) {
            alert("请在输入框中填写入更详细的故事大纲（至少10个字）");
            return;
        }
        setIsParsing(true);
        try {
            const result = await GeminiService.parseStoryOutline(outline);
            let detectedGenre = StoryGenre.CUSTOM;
            const genreKey = result.genre ? result.genre.toUpperCase() : 'CUSTOM';
            const genreMap: Record<string, StoryGenre> = { 'XIANXIA': StoryGenre.XIANXIA, 'WUXIA': StoryGenre.WUXIA, 'ROMANCE': StoryGenre.ROMANCE, 'SUPERHERO': StoryGenre.SUPERHERO, 'CYBERPUNK': StoryGenre.CYBERPUNK, 'FANTASY': StoryGenre.FANTASY };
            if (genreMap[genreKey]) detectedGenre = genreMap[genreKey];
            else { const found = Object.keys(genreMap).find(k => genreKey.includes(k)); if (found) detectedGenre = genreMap[found]; }

            setContext(prev => {
                const newSupporting = (result.supportingCharacters || []).map((c: any) => {
                    const randomArchetype = CHARACTER_ARCHETYPES[Math.floor(Math.random() * CHARACTER_ARCHETYPES.length)];
                    const rndAffinity = Math.floor(Math.random() * 21) - 10;
                    return { id: generateUUID(), name: c.name, role: c.role || "未定义", gender: c.gender || "female", category: c.category || "supporting", personality: c.personality || "", appearance: c.appearance || "", affinity: rndAffinity, initialAffinity: rndAffinity, archetype: randomArchetype.name, archetypeDescription: randomArchetype.description };
                });
                const newSkills = (result.character?.skills || []).map((s: any) => ({ id: generateUUID(), name: s.name, description: s.description || "暂无描述", type: s.type || 'active', level: 1 }));
                const moodMap: Record<string, StoryMood> = { 'PEACEFUL': StoryMood.PEACEFUL, 'BATTLE': StoryMood.BATTLE, 'TENSE': StoryMood.TENSE, 'EMOTIONAL': StoryMood.EMOTIONAL, 'MYSTERIOUS': StoryMood.MYSTERIOUS, 'VICTORY': StoryMood.VICTORY };
                const mappedTone = result.worldSettings?.tone ? moodMap[result.worldSettings.tone] : prev.worldSettings.tone;
                
                // Map generated blueprint
                const newBlueprint = (result.plotBlueprint || []).map((chapter: any) => ({
                    id: generateUUID(),
                    title: chapter.title || "未命名章节",
                    summary: chapter.summary || "",
                    targetWordCount: chapter.targetWordCount || 3000,
                    keyEvents: chapter.keyEvents || "",
                    keyCharacters: chapter.keyCharacters || [],
                    pacing: chapter.pacing || 'standard',
                    // Auto-initialize criteria
                    completionCriteria: {
                        minKeyEvents: 1,
                        minInteractions: 1
                    },
                    trackedStats: {
                        currentWordCount: 0,
                        eventsTriggered: 0,
                        interactionsCount: 0
                    },
                    status: 'pending'
                }));

                return {
                    ...prev,
                    genre: detectedGenre,
                    customGenre: '',
                    character: { ...prev.character, name: result.character?.name || prev.character.name, gender: result.character?.gender || prev.character.gender, trait: result.character?.trait || prev.character.trait, skills: newSkills },
                    worldSettings: { ...prev.worldSettings, isHarem: result.worldSettings?.isHarem ?? prev.worldSettings.isHarem, isAdult: result.worldSettings?.isAdult ?? prev.worldSettings.isAdult, hasSystem: result.worldSettings?.hasSystem ?? prev.worldSettings.hasSystem, tone: mappedTone ?? prev.worldSettings.tone },
                    supportingCharacters: newSupporting,
                    plotBlueprint: newBlueprint.length > 0 ? newBlueprint : prev.plotBlueprint
                };
            });
            setActivePanel(0); // Switch to protagonist panel to show result
        } catch (e) { console.error(e); alert("解析失败，请稍后重试"); } finally { setIsParsing(false); }
    };

    const handleAutoGenerateChar = async () => {
        if (!tempSupportingChar.name || !tempSupportingChar.role || !tempSupportingChar.gender) return;
        setIsGeneratingChar(true);
        try {
            const details = await GeminiService.generateCharacterDetails(context.genre, tempSupportingChar.name || "未知", tempSupportingChar.role || "配角", tempSupportingChar.gender, tempSupportingChar.category || 'supporting', tempSupportingChar.personality, tempSupportingChar.appearance);
            setTempSupportingChar(prev => ({ ...prev, personality: details.personality, appearance: details.appearance }));
        } catch (e) { console.error(e); } finally { setIsGeneratingChar(false); }
    };

    const handleAutoGenerateSkill = async () => {
        if (!tempSkill.name) return;
        setIsGeneratingSkill(true);
        try {
            const desc = await GeminiService.generateSkillDescription(context.genre, tempSkill.name, context.character.name || "主角");
            setTempSkill(prev => ({ ...prev, description: desc }));
        } catch(e) { console.error(e); } finally { setIsGeneratingSkill(false); }
    };

    const openAddCharModal = () => {
        setEditingCharId(null);
        setTempSupportingChar({ name: '', role: '', gender: '' as any, category: 'supporting', personality: '', appearance: '', archetype: '', archetypeDescription: '', initialAffinity: Math.floor(Math.random() * 21) - 10 });
        setShowCharModal(true);
    };

    const openEditCharModal = (char: SupportingCharacter, e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        setEditingCharId(char.id);
        setTempSupportingChar({ name: char.name, role: char.role, gender: char.gender, category: char.category, personality: char.personality || '', appearance: char.appearance || '', archetype: char.archetype || '', archetypeDescription: char.archetypeDescription || '', initialAffinity: char.initialAffinity !== undefined ? char.initialAffinity : (char.affinity || 0) });
        setShowCharModal(true);
    };

    const closeCharModal = () => { setShowCharModal(false); setEditingCharId(null); setTempSupportingChar({ name: '', role: '', gender: '' as any, category: 'supporting', personality: '', appearance: '', archetype: '', archetypeDescription: '', initialAffinity: 0 }); };
    
    const handleRemoveSupportingChar = (id: string, e: React.MouseEvent) => { 
        e.stopPropagation(); 
        setContext(prev => {
            const charToRemove = prev.supportingCharacters.find(c => c.id === id);
            const charName = charToRemove?.name;
            
            // Remove from list
            const newList = prev.supportingCharacters.filter(c => c.id !== id);
            
            // SYNC FIX: Remove from blueprint
            let updatedBlueprint = prev.plotBlueprint;
            if (charName) {
                 updatedBlueprint = (prev.plotBlueprint || []).map(chapter => ({
                    ...chapter,
                    keyCharacters: (chapter.keyCharacters || []).filter(k => k !== charName)
                }));
            }

            return { ...prev, supportingCharacters: newList, plotBlueprint: updatedBlueprint };
        }); 
    };

    const openAddSkillModal = () => { setEditingSkillId(null); setTempSkill({ name: '', description: '', level: 1, type: 'active' }); setShowSkillModal(true); };
    const openEditSkillModal = (skill: any) => { setEditingSkillId(skill.id); setTempSkill({ name: skill.name, description: skill.description, level: skill.level || 1, type: skill.type || 'active' }); setShowSkillModal(true); };
    
    const handleSaveSkill = () => {
        if (tempSkill.name && tempSkill.description) {
            if (editingSkillId) {
                setContext(prev => ({ ...prev, character: { ...prev.character, skills: prev.character.skills.map(s => s.id === editingSkillId ? { ...s, name: tempSkill.name, description: tempSkill.description, level: tempSkill.level || 1, type: tempSkill.type || 'active' } : s ) } }));
            } else {
                setContext(prev => ({ ...prev, character: { ...prev.character, skills: [...prev.character.skills, { id: generateUUID(), name: tempSkill.name, description: tempSkill.description, level: tempSkill.level || 1, type: tempSkill.type || 'active' }] } }));
            }
            setShowSkillModal(false); setEditingSkillId(null); setTempSkill({ name: '', description: '', level: 1, type: 'active' });
        }
    };

    const handleRemoveSkill = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (editingSkillId === id) { setEditingSkillId(null); setTempSkill({ name: '', description: '', level: 1, type: 'active' }); }
        setContext(prev => ({ ...prev, character: { ...prev.character, skills: prev.character.skills.filter(s => s.id !== id) } }));
    };

    // Calculate styles for 3D effect
    const getPanelStyle = (index: number) => {
        const totalPanels = 5;
        let diff = (index - activePanel + totalPanels) % totalPanels;
        if (diff > 2) diff -= 5;

        const baseStyle = "absolute top-1/2 left-1/2 w-[340px] md:w-[380px] h-[73vh] transition-all duration-700 cubic-bezier(0.25, 0.8, 0.25, 1) origin-center rounded-2xl border-l-2 p-6 flex flex-col shadow-2xl overflow-hidden";
        let specificStyle: React.CSSProperties = {};

        if (diff === 0) { // Center
            specificStyle = { transform: 'translate3d(-50%, -55%, 0) rotateY(0deg) scale(1)', zIndex: 30, opacity: 1, filter: 'none', pointerEvents: 'auto', cursor: 'default' };
        } else if (diff === 1) { // Right
            specificStyle = { transform: 'translate3d(60%, -55%, -200px) rotateY(-20deg) scale(0.85)', zIndex: 20, opacity: 0.5, filter: 'blur(2px) brightness(0.6)', pointerEvents: 'auto', cursor: 'pointer' };
        } else if (diff === -1) { // Left
            specificStyle = { transform: 'translate3d(-160%, -55%, -200px) rotateY(20deg) scale(0.85)', zIndex: 20, opacity: 0.5, filter: 'blur(2px) brightness(0.6)', pointerEvents: 'auto', cursor: 'pointer' };
        } else if (diff === 2) { // Far Right
             specificStyle = { transform: 'translate3d(140%, -55%, -400px) rotateY(-30deg) scale(0.7)', zIndex: 10, opacity: 0.2, filter: 'blur(4px) brightness(0.4)', pointerEvents: 'auto', cursor: 'pointer' };
        } else if (diff === -2) { // Far Left
             specificStyle = { transform: 'translate3d(-240%, -55%, -400px) rotateY(30deg) scale(0.7)', zIndex: 10, opacity: 0.2, filter: 'blur(4px) brightness(0.4)', pointerEvents: 'auto', cursor: 'pointer' };
        }
        return { 
            className: baseStyle, 
            style: specificStyle, 
            onClick: diff === 0 ? undefined : () => setActivePanel(index),
            // Add sound trigger for panel hover (interaction)
            onMouseEnter: () => playHoverSound?.() 
        };
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-black text-white font-sans select-none perspective-[1500px]">
            <SmoothBackground src={bgImage} shouldBlur={false} brightness={1.0} />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60" />

            {/* Error Notification Toast */}
            {error && (
                <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-[100] bg-red-600/90 text-white px-6 py-3 rounded-lg shadow-xl backdrop-blur animate-fade-in-up border border-red-400 flex items-center gap-2 max-w-sm text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 shrink-0">
                        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-bold">{error}</span>
                </div>
            )}

            {/* Header */}
            <div className="absolute top-0 left-0 w-full p-6 z-40 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <div className="flex items-center gap-3 pointer-events-auto">
                    {onSaveConfig && (
                        <button 
                            onClick={onSaveConfig}
                            disabled={!isReady}
                            className={`flex items-center gap-2 px-6 py-2 transition-all font-bold tracking-wider text-xs clip-path-polygon ${isReady ? 'bg-gradient-to-r from-blue-900/40 to-cyan-900/40 text-blue-100 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-gray-800/20 text-gray-500 cursor-not-allowed'}`}
                            style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                        >
                            <span>保存配置</span>
                        </button>
                    )}
                    
                    <button 
                        onClick={() => setGameState(GameState.LANDING)}
                        className="flex items-center gap-2 px-6 py-2 bg-black/20 hover:bg-white/10 transition-all duration-300 text-gray-300 hover:text-white text-xs font-bold tracking-wider backdrop-blur-sm clip-path-polygon"
                        style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                    >
                        <span>‹</span>
                        <span>返回</span>
                    </button>
                    
                    <div className="h-6 w-px bg-white/20 mx-1"></div>
                    <h2 className="text-2xl font-mono tracking-[0.2em] text-gray-300 font-bold" style={{ textShadow: '2px 2px 0px #000, -1px -1px 0px #555', transform: 'scaleY(0.9)', letterSpacing: '0.25em' }}>命运重构</h2>
                </div>
                <div className="text-[10px] md:text-xs font-mono text-gray-500 tracking-[0.3em] opacity-60">REKALL_SYSTEM_SETUP_MODE_V2.5.0_BETA</div>
            </div>

            {/* Carousel Container */}
            <div className="absolute inset-0 z-10 transform-style-3d">
                
                {/* Panel 0: Protagonist */}
                <SetupProtagonistPanel 
                    {...getPanelStyle(0)}
                    context={context}
                    setContext={setContext}
                    isProtagonistValid={isProtagonistValid}
                    onAddSkill={openAddSkillModal}
                    onEditSkill={openEditSkillModal}
                    onRemoveSkill={handleRemoveSkill}
                />

                {/* Panel 1: World Settings */}
                <SetupWorldPanel 
                    {...getPanelStyle(1)}
                    context={context}
                    setContext={setContext}
                    isStoryNameValid={isStoryNameValid as boolean}
                    isAutoName={isAutoName}
                    setIsAutoName={setIsAutoName}
                    isParsing={isParsing}
                    handleSmartParse={handleSmartParse}
                />

                {/* Panel 2: Supporting Characters */}
                <SetupCharactersPanel 
                    {...getPanelStyle(2)}
                    context={context}
                    onAddChar={openAddCharModal}
                    onEditChar={openEditCharModal}
                    onRemoveChar={handleRemoveSupportingChar}
                    onReorder={(chars) => setContext(prev => ({ ...prev, supportingCharacters: chars }))}
                />

                {/* Panel 3: Narrative */}
                <SetupNarrativePanel 
                    {...getPanelStyle(3)}
                    context={context}
                    setContext={setContext}
                />

                {/* Panel 4: Plot Blueprint */}
                <SetupPlotPanel 
                    {...getPanelStyle(4)}
                    context={context}
                    onOpenModal={(chapterId, viewMode) => {
                        setPlotModalChapterId(chapterId || null);
                        setPlotModalViewMode(viewMode || 'list');
                        setShowPlotModal(true);
                    }}
                    onAutoPlan={handleAutoPlanBlueprint}
                    isGenerating={isGeneratingBlueprint}
                />

            </div>

            {/* Modals */}
            {showCharModal && (
                <CharacterEditModal 
                    isEditing={!!editingCharId}
                    tempChar={tempSupportingChar}
                    setTempChar={setTempSupportingChar}
                    onClose={closeCharModal}
                    onSave={handleSaveSupportingChar}
                    onAutoGenerate={handleAutoGenerateChar}
                    isGenerating={isGeneratingChar}
                />
            )}

            {showSkillModal && (
                <SkillEditModal 
                    isEditing={!!editingSkillId}
                    tempSkill={tempSkill}
                    setTempSkill={setTempSkill}
                    onClose={() => setShowSkillModal(false)}
                    onSave={handleSaveSkill}
                    onAutoGenerate={handleAutoGenerateSkill}
                    isGenerating={isGeneratingSkill}
                />
            )}

            <PlotBlueprintModal 
                isOpen={showPlotModal} 
                onClose={() => {
                    setShowPlotModal(false);
                    setPlotModalChapterId(null);
                }}
                context={context}
                setContext={setContext}
                initialChapterId={plotModalChapterId}
                initialViewMode={plotModalViewMode}
            />

            {/* Start Game Progress Button */}
            <div className="absolute bottom-10 left-0 w-full flex justify-center items-end pointer-events-none z-50">
                <div className="flex items-center gap-4 pointer-events-auto">
                    {/* Left Decoration: System Monitor */}
                    <div className="hidden md:flex flex-col gap-1 items-end opacity-80 hover:opacity-100 transition-all duration-300 cursor-pointer group active:scale-95" onClick={() => playClickSound?.()} title="系统遥测模块">
                        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" className="drop-shadow-[0_0_10px_rgba(14,165,233,0.3)]">
                            <path d="M0 10 L10 0 H60 V50 L50 60 H0 V10 Z" fill="#0f172a" stroke="#0ea5e9" strokeWidth="1.5" className="group-hover:stroke-cyan-300 transition-colors" />
                            <rect x="10" y="15" width="20" height="3" fill="#0ea5e9" className="animate-pulse" />
                            <rect x="35" y="15" width="5" height="3" fill="#0ea5e9" className="animate-pulse delay-100" />
                            <rect x="10" y="22" width="40" height="2" fill="#334155" />
                            <rect x="10" y="27" width="30" height="2" fill="#334155" />
                            <rect x="10" y="32" width="35" height="2" fill="#334155" />
                            <rect x="45" y="45" width="6" height="6" fill="#ef4444" className="animate-[pulse_0.5s_ease-in-out_infinite]" />
                            <text x="8" y="55" fontSize="6" fill="#94a3b8" fontFamily="monospace">SYS.RDY</text>
                        </svg>
                    </div>

                    {/* Center Button Container */}
                    <div className="w-80 bg-black/80 backdrop-blur-md rounded-2xl border border-gray-700 p-2 shadow-2xl flex items-center gap-4 transition-all duration-300 relative">
                        <div className="flex gap-1.5 flex-col pl-2">
                            <div className={`w-2 h-2 rounded-full ${isProtagonistValid ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-red-500 animate-pulse'} transition-colors`} title="主角设定"></div>
                            <div className={`w-2 h-2 rounded-full ${isStoryNameValid ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-red-500 animate-pulse'} transition-colors`} title="世界设定"></div>
                            <div className={`w-2 h-2 rounded-full ${hasSupportingChars ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-red-500 animate-pulse'} transition-colors`} title="配角设定"></div>
                            <div className={`w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e] transition-colors`} title="叙事架构"></div>
                            <div className={`w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e] transition-colors`} title="剧情蓝图"></div>
                        </div>

                        <button
                            onClick={() => {
                                if (isReady) handleStartGame();
                                else {
                                    if(!isProtagonistValid) setActivePanel(0);
                                    else if(!isStoryNameValid) setActivePanel(1);
                                    else if(!hasSupportingChars) setActivePanel(2);
                                }
                            }}
                            className={`flex-1 h-14 relative overflow-hidden rounded-xl font-bold tracking-[0.2em] transition-all duration-300 border-2 ${isReady ? 'border-cyan-400 bg-cyan-950/30 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:bg-cyan-400/10 hover:shadow-[0_0_30px_rgba(34,211,238,0.6)]' : 'border-gray-800 bg-black/40 text-gray-600 cursor-not-allowed hover:bg-gray-900/50'}`}
                        >
                            <div className={`absolute left-0 top-0 h-full transition-all duration-500 ease-out ${isReady ? 'opacity-0' : 'opacity-100'}`} style={{ width: `${progress}%` }}><div className="w-full h-full bg-cyan-500/20 backdrop-blur-sm border-r border-cyan-500/30"></div></div>
                            <div className="relative z-10 flex flex-col items-center justify-center h-full">
                                {isReady ? ( <div className="flex items-center gap-2"><span className="text-xl animate-pulse text-cyan-400">◈</span><span className="text-lg text-shadow-glow">启动体验</span><span className="text-xl animate-pulse text-cyan-400">◈</span></div> ) : ( <div className="flex flex-col items-center opacity-80"><span className="text-xs font-mono mb-0.5 tracking-widest">SYSTEM CHARGING</span><span className="text-xl font-mono text-cyan-600">{progress}%</span></div> )}
                            </div>
                        </button>
                    </div>

                    {/* Right Decoration */}
                    <div className="hidden md:flex flex-col gap-1 items-start opacity-80 hover:opacity-100 transition-all duration-300 cursor-pointer group active:scale-95" onClick={() => playClickSound?.()} title="磁通量电容器">
                        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" className="drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                            <path d="M10 0 H50 L60 10 V50 L50 60 H10 L0 50 V10 L10 0 Z" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" className="group-hover:stroke-amber-300 transition-colors" />
                            <g className="origin-center animate-[spin_6s_linear_infinite] group-hover:animate-[spin_2s_linear_infinite]">
                                <circle cx="30" cy="30" r="18" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 2" opacity="0.6" />
                                <circle cx="30" cy="30" r="8" stroke="#f59e0b" strokeWidth="2" fill="#1c1917" />
                                <path d="M30 10 V22 M30 50 V38 M10 30 H22 M50 30 H38" stroke="#f59e0b" strokeWidth="2" opacity="0.8" />
                            </g>
                            <rect x="5" y="5" width="2" height="2" fill="#f59e0b" /><rect x="53" y="5" width="2" height="2" fill="#f59e0b" /><rect x="5" y="53" width="2" height="2" fill="#f59e0b" /><rect x="53" y="53" width="2" height="2" fill="#f59e0b" />
                            <text x="40" y="56" fontSize="5" fill="#f59e0b" fontFamily="monospace" textAnchor="end">SYNC</text>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};
