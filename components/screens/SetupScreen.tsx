
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GameState, GameContext, StoryGenre, StoryMood, generateUUID, MOOD_LABELS, SupportingCharacter } from '../../types';
import { SmoothBackground } from '../SmoothBackground';
import { Button } from '../Button';
import { CHARACTER_ARCHETYPES, NARRATIVE_STRUCTURES, NARRATIVE_TECHNIQUES } from '../../constants';
import * as GeminiService from '../../services/geminiService';

interface SetupScreenProps {
    context: GameContext;
    setContext: React.Dispatch<React.SetStateAction<GameContext>>;
    bgImage: string;
    setGameState: (state: GameState) => void;
    handleStartGame: () => void;
    error: string | null;
    onSaveConfig?: () => void;
    // New prop to persist temp data
    tempData?: {
        skill: { name: string, description: string, level?: number, type?: 'active' | 'passive' };
    };
    setTempData?: (data: any) => void;
    playClickSound?: () => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({
    context, setContext, bgImage, setGameState, handleStartGame, error, onSaveConfig, tempData, setTempData, playClickSound
}) => {
    // 0: Protagonist, 1: World (Default), 2: Supporting, 3: Narrative
    const [activePanel, setActivePanel] = useState(1);
    
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
    
    const tempSkill = tempData?.skill ? { ...tempData.skill, type: tempData.skill.type || 'active' } : localTempSkill;
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
    
    // New: Auto Name State
    const [isAutoName, setIsAutoName] = useState(!context.storyName);

    const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Collapsible state for world settings
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

    // Validation
    const isProtagonistValid = context.character.name.trim().length > 0 && context.character.trait.trim().length > 0;
    const isStoryNameValid = isAutoName || (context.storyName && context.storyName.trim().length > 0);
    const hasSupportingChars = context.supportingCharacters.length > 0;
    // Narrative is "valid" by default since it defaults to "auto"
    
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
            // Check if scrolling within a scrollable container
            let el = e.target as HTMLElement;
            while(el && el !== document.body) {
                // Check if element is scrollable (overflow-y auto/scroll and content > height)
                const style = window.getComputedStyle(el);
                const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll';
                if (isScrollable && el.scrollHeight > el.clientHeight) {
                     // If inside a scrollable element that actually has room to scroll, don't trigger carousel
                     return;
                }
                if (el.classList.contains('overflow-y-auto') && el.scrollHeight > el.clientHeight) {
                     return;
                }
                if (!el.parentElement) break;
                el = el.parentElement;
            }

            if (wheelTimeoutRef.current) return;
            
            // Threshold to prevent accidental tiny scrolls
            if (Math.abs(e.deltaY) > 20) {
                wheelTimeoutRef.current = setTimeout(() => {
                    wheelTimeoutRef.current = null;
                }, 300); // Debounce 300ms

                if (e.deltaY > 0) {
                    // Scroll Down -> Next (Right)
                    setActivePanel(prev => (prev + 1) % 4);
                } else {
                    // Scroll Up -> Prev (Left)
                    setActivePanel(prev => (prev - 1 + 4) % 4);
                }
            }
        };

        window.addEventListener('wheel', handleWheel);
        return () => window.removeEventListener('wheel', handleWheel);
    }, []);
    
    // Update context if auto name is toggled
    useEffect(() => {
        if (isAutoName) {
            setContext(prev => ({ ...prev, storyName: '' }));
        }
    }, [isAutoName, setContext]);

    const handleSaveSupportingChar = () => {
        if (tempSupportingChar.name && tempSupportingChar.role && tempSupportingChar.gender) {
            setContext(prev => {
                const newList = [...prev.supportingCharacters];
                
                if (editingCharId) {
                    // Update existing
                    const idx = newList.findIndex(c => c.id === editingCharId);
                    if (idx !== -1) {
                        newList[idx] = { 
                            ...newList[idx], 
                            ...tempSupportingChar as SupportingCharacter,
                            // Ensure affinity matches initial if this is setup phase edit
                            initialAffinity: tempSupportingChar.initialAffinity || 0,
                            affinity: tempSupportingChar.initialAffinity || 0
                        };
                    }
                } else {
                    // Add new
                    const affinityVal = tempSupportingChar.initialAffinity || 0;
                    
                    // Randomly assign Archetype
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
                return { ...prev, supportingCharacters: newList };
            });
            
            // Reset and close
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
            
            // 1. Map Genre string to Enum
            let detectedGenre = StoryGenre.CUSTOM;
            // The service returns uppercase keys like 'XIANXIA'
            const genreKey = result.genre ? result.genre.toUpperCase() : 'CUSTOM';
            
            const genreMap: Record<string, StoryGenre> = {
                'XIANXIA': StoryGenre.XIANXIA,
                'WUXIA': StoryGenre.WUXIA,
                'ROMANCE': StoryGenre.ROMANCE,
                'SUPERHERO': StoryGenre.SUPERHERO,
                'CYBERPUNK': StoryGenre.CYBERPUNK,
                'FANTASY': StoryGenre.FANTASY
            };
            
            // Try explicit match first, then fuzzy match if needed
            if (genreMap[genreKey]) {
                detectedGenre = genreMap[genreKey];
            } else {
                // Fallback: Check if user entered text matches enum values roughly
                const found = Object.keys(genreMap).find(k => genreKey.includes(k));
                if (found) detectedGenre = genreMap[found];
            }

            setContext(prev => {
                const newSupporting = (result.supportingCharacters || []).map((c: any) => {
                    const randomArchetype = CHARACTER_ARCHETYPES[Math.floor(Math.random() * CHARACTER_ARCHETYPES.length)];
                    const rndAffinity = Math.floor(Math.random() * 21) - 10;
                    return {
                        id: generateUUID(),
                        name: c.name,
                        role: c.role || "未定义",
                        gender: c.gender || "female",
                        category: c.category || "supporting",
                        personality: c.personality || "",
                        appearance: c.appearance || "",
                        affinity: rndAffinity, 
                        initialAffinity: rndAffinity, 
                        archetype: randomArchetype.name,
                        archetypeDescription: randomArchetype.description
                    };
                });

                const newSkills = (result.character?.skills || []).map((s: any) => ({
                    id: generateUUID(),
                    name: s.name,
                    description: s.description || "暂无描述",
                    type: s.type || 'active',
                    level: 1
                }));

                // Map tone string to enum
                const moodMap: Record<string, StoryMood> = {
                    'PEACEFUL': StoryMood.PEACEFUL,
                    'BATTLE': StoryMood.BATTLE,
                    'TENSE': StoryMood.TENSE,
                    'EMOTIONAL': StoryMood.EMOTIONAL,
                    'MYSTERIOUS': StoryMood.MYSTERIOUS,
                    'VICTORY': StoryMood.VICTORY
                };
                const mappedTone = result.worldSettings?.tone ? moodMap[result.worldSettings.tone] : prev.worldSettings.tone;

                return {
                    ...prev,
                    genre: detectedGenre, // Auto-select genre
                    customGenre: '', // Clear the input after successful parse
                    character: {
                        ...prev.character,
                        name: result.character?.name || prev.character.name,
                        gender: result.character?.gender || prev.character.gender,
                        trait: result.character?.trait || prev.character.trait,
                        skills: newSkills // Replace skills entirely
                    },
                    worldSettings: {
                        ...prev.worldSettings,
                        isHarem: result.worldSettings?.isHarem ?? prev.worldSettings.isHarem,
                        isAdult: result.worldSettings?.isAdult ?? prev.worldSettings.isAdult,
                        hasSystem: result.worldSettings?.hasSystem ?? prev.worldSettings.hasSystem,
                        tone: mappedTone ?? prev.worldSettings.tone
                    },
                    supportingCharacters: newSupporting // Replace existing supporting characters entirely
                };
            });
            
            // Jump to character panel to show results
            setActivePanel(2); // Jump to Panel 2 (Supporting)
        } catch (e) {
            console.error(e);
            alert("解析失败，请稍后重试");
        } finally {
            setIsParsing(false);
        }
    };

    const handleAutoGenerateChar = async () => {
        if (!tempSupportingChar.name || !tempSupportingChar.role || !tempSupportingChar.gender) return;
        setIsGeneratingChar(true);
        try {
            const details = await GeminiService.generateCharacterDetails(
                context.genre,
                tempSupportingChar.name || "未知",
                tempSupportingChar.role || "配角",
                tempSupportingChar.gender,
                tempSupportingChar.category || 'supporting',
                tempSupportingChar.personality,
                tempSupportingChar.appearance
            );
            setTempSupportingChar(prev => ({
                ...prev,
                personality: details.personality,
                appearance: details.appearance
            }));
        } catch (e) {
            console.error(e);
        } finally {
            setIsGeneratingChar(false);
        }
    };

    const handleAutoGenerateSkill = async () => {
        if (!tempSkill.name) return;
        setIsGeneratingSkill(true);
        try {
            const desc = await GeminiService.generateSkillDescription(
                context.genre,
                tempSkill.name,
                context.character.name || "主角"
            );
            setTempSkill(prev => ({ ...prev, description: desc }));
        } catch(e) {
            console.error(e);
        } finally {
            setIsGeneratingSkill(false);
        }
    };

    const openAddCharModal = () => {
        setEditingCharId(null);
        // Random affinity between -10 and 10 for flavor
        const randomAffinity = Math.floor(Math.random() * 21) - 10;
        // Reset gender to empty string to force selection
        setTempSupportingChar({ 
            name: '', role: '', gender: '' as any, category: 'supporting', 
            personality: '', appearance: '', archetype: '', archetypeDescription: '', 
            initialAffinity: randomAffinity 
        });
        setShowCharModal(true);
    };

    const openEditCharModal = (char: SupportingCharacter, e: React.MouseEvent) => {
        e.preventDefault(); // Prevent default context menu if used there, or normal click
        e.stopPropagation();
        setEditingCharId(char.id);
        setTempSupportingChar({
            name: char.name,
            role: char.role,
            gender: char.gender,
            category: char.category,
            personality: char.personality || '',
            appearance: char.appearance || '',
            archetype: char.archetype || '',
            archetypeDescription: char.archetypeDescription || '',
            // Ensure we read affinity if initial is missing
            initialAffinity: char.initialAffinity !== undefined ? char.initialAffinity : (char.affinity || 0)
        });
        setShowCharModal(true);
    };

    const closeCharModal = () => {
        setShowCharModal(false);
        setEditingCharId(null);
        setTempSupportingChar({ name: '', role: '', gender: '' as any, category: 'supporting', personality: '', appearance: '', archetype: '', archetypeDescription: '', initialAffinity: 0 });
    };

    const handleRemoveSupportingChar = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setContext(prev => ({ ...prev, supportingCharacters: prev.supportingCharacters.filter(c => c.id !== id) }));
    };

    // Skill Modal Logic
    const openAddSkillModal = () => {
        setEditingSkillId(null);
        setTempSkill({ name: '', description: '', level: 1, type: 'active' });
        setShowSkillModal(true);
    };

    const openEditSkillModal = (skill: any) => {
        setEditingSkillId(skill.id);
        setTempSkill({ 
            name: skill.name, 
            description: skill.description, 
            level: skill.level || 1, 
            type: skill.type || 'active' 
        });
        setShowSkillModal(true);
    };

    const handleSaveSkill = () => {
        if (tempSkill.name && tempSkill.description) {
            if (editingSkillId) {
                // Update Existing Skill
                setContext(prev => ({
                    ...prev,
                    character: {
                        ...prev.character,
                        skills: prev.character.skills.map(s => 
                            s.id === editingSkillId 
                            ? { ...s, name: tempSkill.name, description: tempSkill.description, level: tempSkill.level || 1, type: tempSkill.type || 'active' }
                            : s
                        )
                    }
                }));
            } else {
                // Add New Skill
                setContext(prev => ({
                    ...prev,
                    character: {
                        ...prev.character,
                        skills: [...prev.character.skills, { id: generateUUID(), name: tempSkill.name, description: tempSkill.description, level: tempSkill.level || 1, type: tempSkill.type || 'active' }]
                    }
                }));
            }
            // Close and reset
            setShowSkillModal(false);
            setEditingSkillId(null);
            setTempSkill({ name: '', description: '', level: 1, type: 'active' });
        }
    };

    const handleRemoveSkill = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (editingSkillId === id) {
            setEditingSkillId(null);
            setTempSkill({ name: '', description: '', level: 1, type: 'active' });
        }
        setContext(prev => ({ ...prev, character: { ...prev.character, skills: prev.character.skills.filter(s => s.id !== id) } }));
    };

    const getCharacterLabel = (char: SupportingCharacter, allChars: SupportingCharacter[]) => {
        const sameCategory = allChars.filter(c => c.category === char.category);
        const index = sameCategory.findIndex(c => c.id === char.id);
        const numberStr = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][index] || (index + 1).toString();
        
        switch(char.category) {
            case 'protagonist': return `主角(友方) ${numberStr}`;
            case 'villain': return `反派 ${numberStr}`;
            case 'other': return `其他 ${numberStr}`;
            case 'supporting': default: return `配角 ${numberStr}`;
        }
    }

    // Calculate styles for 3D effect - UPDATED FOR 4 PANELS
    const getPanelStyle = (index: number) => {
        const diff = (index - activePanel + 4) % 4;
        // diff 0: Center, 1: Right, 2: Back, 3: Left
        
        const isCenter = diff === 0;
        const isRight = diff === 1;
        const isBack = diff === 2;
        const isLeft = diff === 3;

        // Ensure height is 73vh as requested
        const baseStyle = "absolute top-1/2 left-1/2 w-[340px] md:w-[380px] h-[73vh] transition-all duration-700 cubic-bezier(0.25, 0.8, 0.25, 1) origin-center rounded-2xl border-l-2 p-6 flex flex-col shadow-2xl overflow-hidden";
        
        let specificStyle: React.CSSProperties = {};

        if (isCenter) {
            specificStyle = {
                transform: 'translate3d(-50%, -55%, 0) rotateY(0deg) scale(1)',
                zIndex: 30,
                opacity: 1,
                filter: 'none',
                pointerEvents: 'auto',
                cursor: 'default'
            };
        } else if (isRight) {
            specificStyle = {
                transform: 'translate3d(60%, -55%, -200px) rotateY(-20deg) scale(0.85)',
                zIndex: 20,
                opacity: 0.5,
                filter: 'blur(2px) brightness(0.6)',
                pointerEvents: 'auto', // Clickable to switch
                cursor: 'pointer'
            };
        } else if (isLeft) {
            specificStyle = {
                transform: 'translate3d(-160%, -55%, -200px) rotateY(20deg) scale(0.85)',
                zIndex: 20,
                opacity: 0.5,
                filter: 'blur(2px) brightness(0.6)',
                pointerEvents: 'auto', // Clickable to switch
                cursor: 'pointer'
            };
        } else if (isBack) {
             specificStyle = {
                transform: 'translate3d(-50%, -55%, -400px) rotateY(0deg) scale(0.7)',
                zIndex: 10,
                opacity: 0.2,
                filter: 'blur(4px) brightness(0.4)',
                pointerEvents: 'auto', 
                cursor: 'pointer'
            };
        }

        return { className: baseStyle, style: specificStyle, onClick: isCenter ? undefined : () => setActivePanel(index) };
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-black text-white font-sans select-none perspective-[1500px]">
            <SmoothBackground src={bgImage} shouldBlur={false} brightness={1.0} />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60" />

            {/* Header */}
            <div className="absolute top-0 left-0 w-full p-6 z-40 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <div className="flex items-center gap-3 pointer-events-auto">
                    {onSaveConfig && (
                        <button 
                            onClick={onSaveConfig}
                            disabled={!isReady}
                            className={`flex items-center gap-2 px-6 py-2 transition-all font-bold tracking-wider text-xs clip-path-polygon
                                ${isReady 
                                    ? 'bg-gradient-to-r from-blue-900/40 to-cyan-900/40 text-blue-100 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                                    : 'bg-gray-800/20 text-gray-500 cursor-not-allowed'}
                            `}
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
                    
                    {/* Title Style Updated: Pixel Art Simulation using Shadows and Scale */}
                    <h2 
                        className="text-2xl font-mono tracking-[0.2em] text-gray-300 font-bold" 
                        style={{ 
                            textShadow: '2px 2px 0px #000, -1px -1px 0px #555',
                            transform: 'scaleY(0.9)',
                            letterSpacing: '0.25em'
                        }}
                    >
                        命运重构
                    </h2>
                </div>
                <div className="text-[10px] md:text-xs font-mono text-gray-500 tracking-[0.3em] opacity-60">
                    REKALL_SYSTEM_SETUP_MODE_V2.5.0_BETA
                </div>
            </div>

            {/* Carousel Container */}
            <div className="absolute inset-0 z-10 transform-style-3d">
                
                {/* Panel 0: Protagonist */}
                <div 
                    {...getPanelStyle(0)} 
                    className={`${getPanelStyle(0).className} bg-stone-100/95 backdrop-blur-md text-gray-800 group ${!isProtagonistValid ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'border-yellow-500'}`}
                >
                    <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${!isProtagonistValid ? 'text-red-500 animate-pulse' : 'text-yellow-700'}`}>
                        <span className={`w-1 h-4 block ${!isProtagonistValid ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                        主角档案 {!isProtagonistValid && <span className="text-[10px] text-red-500 ml-2 font-normal">(必填)</span>}
                    </h3>
                    {/* No Scrollbar Utility */}
                    <div className="space-y-3 overflow-y-auto pr-1 flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        {/* Name & Gender: Compact Row */}
                        <div className="space-y-1">
                            <label className="text-xs text-gray-500 uppercase tracking-wider font-bold">主角设定</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={context.character.name} 
                                    onChange={(e) => setContext(prev => ({ ...prev, character: { ...prev.character, name: e.target.value } }))} 
                                    className="flex-1 bg-white border border-stone-300 rounded px-3 py-1.5 text-sm text-gray-800 focus:border-yellow-500 outline-none transition-all placeholder-gray-400 focus:shadow-sm" 
                                    placeholder="姓名" 
                                />
                                <div className="flex bg-stone-100 p-1 rounded border border-stone-200 shrink-0 gap-1">
                                     {['male', 'female', 'other'].map((g) => {
                                        const isSelected = context.character.gender === g;
                                        let activeClass = '';
                                        let inactiveClass = '';
                                        let icon = '';
                                        let label = '';

                                        if (g === 'male') {
                                            activeClass = 'bg-blue-500 text-white shadow-md ring-1 ring-blue-600';
                                            inactiveClass = 'text-gray-400 hover:text-blue-500 hover:bg-blue-50';
                                            icon = '♂';
                                            label = '男';
                                        } else if (g === 'female') {
                                            activeClass = 'bg-pink-500 text-white shadow-md ring-1 ring-pink-600';
                                            inactiveClass = 'text-gray-400 hover:text-pink-500 hover:bg-pink-50';
                                            icon = '♀';
                                            label = '女';
                                        } else {
                                            activeClass = 'bg-purple-500 text-white shadow-md ring-1 ring-purple-600';
                                            inactiveClass = 'text-gray-400 hover:text-purple-500 hover:bg-purple-50';
                                            icon = '⚥';
                                            label = '其他';
                                        }

                                        return (
                                            <button 
                                                key={g} 
                                                onClick={() => setContext(prev => ({ ...prev, character: { ...prev.character, gender: g as any } }))} 
                                                className={`px-3 py-1.5 text-xs rounded transition-all flex items-center justify-center gap-1 font-bold ${isSelected ? activeClass : inactiveClass}`}
                                                title={label}
                                            >
                                                <span className="text-sm leading-none">{icon}</span>
                                                <span>{label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-gray-500 uppercase tracking-wider font-bold">核心特质</label>
                            <textarea 
                                value={context.character.trait} 
                                onChange={(e) => setContext(prev => ({ ...prev, character: { ...prev.character, trait: e.target.value } }))} 
                                className="w-full h-24 bg-white border border-stone-300 rounded px-3 py-1.5 text-sm text-gray-800 focus:border-yellow-500 outline-none transition-all placeholder-gray-400 resize-y focus:shadow-sm leading-tight custom-scrollbar" 
                                placeholder="描述主角的性格、外貌或特殊能力..." 
                            />
                        </div>

                        {/* Special Rules: Moved from Panel 1 */}
                        <div className="border-t border-stone-200 pt-2">
                             <button 
                                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                                className={`w-full flex items-center justify-between p-2 rounded border transition-all ${showAdvancedSettings ? 'bg-stone-200 border-gray-400' : 'bg-white border-stone-200 hover:bg-stone-50'}`}
                            >
                                <div className="flex flex-col text-left">
                                    <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">特殊规则配置</span>
                                    <span className="text-[10px] text-gray-400 mt-0.5">
                                        {(() => {
                                            const actives = [];
                                            if (context.worldSettings.isHarem) actives.push("后宫");
                                            if (context.worldSettings.isAdult) actives.push("成人");
                                            if (context.worldSettings.hasSystem) actives.push("系统");
                                            return actives.length > 0 ? `已开启: ${actives.join(', ')}` : "点击展开 (可多选)";
                                        })()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1 mr-1">
                                        {context.worldSettings.isHarem && <div className="w-2 h-2 rounded-full bg-purple-500 shadow-sm" title="后宫模式"></div>}
                                        {context.worldSettings.isAdult && <div className="w-2 h-2 rounded-full bg-red-500 shadow-sm" title="成人内容"></div>}
                                        {context.worldSettings.hasSystem && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm" title="系统加持"></div>}
                                    </div>
                                    <span className={`text-gray-400 text-xs transform transition-transform duration-300 ${showAdvancedSettings ? 'rotate-180' : ''}`}>▼</span>
                                </div>
                            </button>

                            {showAdvancedSettings && (
                                <div className="space-y-1 animate-fade-in-up p-2 bg-stone-50 rounded border border-stone-200 mt-1">
                                    <button onClick={() => setContext(prev => ({ ...prev, worldSettings: { ...prev.worldSettings, isHarem: !prev.worldSettings.isHarem } }))} className={`w-full flex items-center justify-between p-2 rounded border transition-all ${context.worldSettings.isHarem ? 'bg-purple-100 border-purple-500 text-purple-800' : 'bg-white border-stone-200 text-gray-500 hover:bg-stone-50'}`}>
                                        <div className="flex flex-col text-left"><span className="text-xs font-bold">后宫模式</span><span className="text-[10px] opacity-70">多重羁绊 / 情感线</span></div>
                                        <div className={`w-3 h-3 rounded-full border border-stone-300 ${context.worldSettings.isHarem ? 'bg-purple-500 shadow-sm' : 'bg-gray-300'}`}></div>
                                    </button>
                                    <button onClick={() => setContext(prev => ({ ...prev, worldSettings: { ...prev.worldSettings, isAdult: !prev.worldSettings.isAdult } }))} className={`w-full flex items-center justify-between p-2 rounded border transition-all ${context.worldSettings.isAdult ? 'bg-red-100 border-red-500 text-red-800' : 'bg-white border-stone-200 text-gray-500 hover:bg-stone-50'}`}>
                                        <div className="flex flex-col text-left"><span className="text-xs font-bold">成人内容</span><span className="text-[10px] opacity-70">深度剧情 / 人性黑暗面</span></div>
                                        <div className={`w-3 h-3 rounded-full border border-stone-300 ${context.worldSettings.isAdult ? 'bg-red-500 shadow-sm' : 'bg-gray-300'}`}></div>
                                    </button>
                                    <button onClick={() => setContext(prev => ({ ...prev, worldSettings: { ...prev.worldSettings, hasSystem: !prev.worldSettings.hasSystem } }))} className={`w-full flex items-center justify-between p-2 rounded border transition-all ${context.worldSettings.hasSystem ? 'bg-blue-100 border-blue-500 text-blue-800' : 'bg-white border-stone-200 text-gray-500 hover:bg-stone-50'}`}>
                                        <div className="flex flex-col text-left"><span className="text-xs font-bold">系统加持</span><span className="text-[10px] opacity-70">任务辅助 / 奖励机制</span></div>
                                        <div className={`w-3 h-3 rounded-full border border-stone-300 ${context.worldSettings.hasSystem ? 'bg-blue-500 shadow-sm' : 'bg-gray-300'}`}></div>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1 border-t border-stone-200 pt-2">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-2 font-bold">
                                    <span>技能系统</span>
                                    <span className="text-[10px] text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">总等级: Lv.{context.character.skills.reduce((acc, s) => acc + s.level, 0) || 1}</span>
                                </label>
                                <button 
                                    onClick={openAddSkillModal}
                                    className="w-6 h-6 rounded-full bg-yellow-50 border border-yellow-300 text-yellow-600 flex items-center justify-center hover:bg-yellow-500 hover:text-white transition-all shadow-sm active:scale-95 pointer-events-auto"
                                    title="添加技能"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                            
                            <div className="space-y-1.5">
                                {context.character.skills.length === 0 ? (
                                    <div className="bg-stone-50 p-3 rounded border border-stone-200 text-center">
                                        <span className="text-[10px] text-gray-400 italic">暂无技能，点击右上角 + 添加</span>
                                    </div>
                                ) : (
                                    context.character.skills.map(skill => (
                                        <div 
                                            key={skill.id} 
                                            onClick={() => openEditSkillModal(skill)}
                                            className={`bg-white p-2 rounded border shadow-sm flex justify-between items-start text-xs transition-colors cursor-pointer border-stone-200 hover:border-yellow-300 hover:bg-stone-50`}
                                            title="点击编辑"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-gray-800 flex items-center gap-1 mb-0.5">
                                                    <span className={`text-[9px] px-1 rounded font-bold shrink-0 ${skill.type === 'passive' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {skill.type === 'passive' ? '被' : '主'}
                                                    </span>
                                                    <span className="truncate">{skill.name}</span>
                                                    <span className="text-[9px] text-yellow-700 bg-yellow-200 px-1 rounded ml-1 font-bold shrink-0">Lv.{skill.level || 1}</span>
                                                </div>
                                                <div className="text-[10px] text-gray-500 break-words whitespace-pre-wrap leading-tight">{skill.description}</div>
                                            </div>
                                            <button onClick={(e) => handleRemoveSkill(skill.id, e)} className="text-gray-400 hover:text-red-500 ml-2 p-1 font-bold shrink-0">✕</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Panel 1: World Settings */}
                <div {...getPanelStyle(1)} className={`${getPanelStyle(1).className} bg-stone-100/95 backdrop-blur-md border-purple-500 text-gray-800 group ${!isStoryNameValid ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : ''}`}>
                    <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${!isStoryNameValid ? 'text-red-500 animate-pulse' : 'text-purple-800'}`}>
                        <span className={`w-1 h-4 block ${!isStoryNameValid ? 'bg-red-500' : 'bg-purple-500'}`}></span>
                        世界观 / 附加设定
                    </h3>

                    {/* No Scrollbar Utility */}
                    <div className="flex-1 overflow-y-auto space-y-5 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        
                        {/* Story Name Input */}
                        <div>
                            <label className="text-xs text-purple-700 uppercase tracking-wider mb-2 flex items-center justify-between font-bold">
                                <span>故事名称</span>
                                {!isStoryNameValid && <span className="text-[10px] text-red-500 font-normal">(必填 或 勾选自动)</span>}
                            </label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    disabled={isAutoName}
                                    value={isAutoName ? '' : (context.storyName || '')} 
                                    onChange={(e) => setContext(prev => ({ ...prev, storyName: e.target.value }))} 
                                    className={`flex-1 bg-white border rounded px-3 py-2 text-sm text-gray-800 outline-none transition-all placeholder-gray-400 focus:shadow-sm ${isAutoName ? 'bg-gray-100 text-gray-400 border-stone-200 cursor-not-allowed' : 'border-stone-300 focus:border-purple-500'}`}
                                    placeholder={isAutoName ? "系统将自主生成..." : "输入故事标题..."} 
                                />
                                <button 
                                    onClick={() => setIsAutoName(!isAutoName)}
                                    className={`px-3 py-2 rounded border text-xs font-bold transition-all whitespace-nowrap
                                        ${isAutoName 
                                            ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm' 
                                            : 'bg-white border-stone-300 text-gray-500 hover:bg-stone-50'}
                                    `}
                                    title="由AI后端根据世界观信息自主命名"
                                >
                                    {isAutoName ? "自动" : "手动"}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-purple-700 uppercase tracking-wider mb-2 block font-bold">故事类型</label>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.values(StoryGenre).filter(g => g !== StoryGenre.CUSTOM).map((g) => (
                                    <button key={g} onClick={() => setContext(prev => ({ ...prev, genre: g }))} className={`px-2 py-2 rounded text-[10px] md:text-xs transition-all border truncate font-medium ${context.genre === g ? 'bg-purple-100 border-purple-500 text-purple-800 shadow-sm font-bold' : 'bg-white border-stone-200 text-gray-500 hover:bg-stone-50'}`}>
                                        {g.split(' - ')[0]}
                                    </button>
                                ))}
                            </div>
                        </div>

                         {/* Custom Genre Input - Compact */}
                         <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs text-purple-700 uppercase tracking-wider font-bold">自定义故事</label>
                                <button
                                    onClick={handleSmartParse}
                                    disabled={isParsing}
                                    className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded border border-purple-300 hover:bg-purple-200 transition-colors shadow-sm"
                                    title="智能解析文本，自动填写主角与配角信息"
                                >
                                    {isParsing ? "解析中..." : "智能解析"}
                                </button>
                            </div>
                            <div className="relative">
                                <textarea 
                                    value={context.customGenre || ''} 
                                    onChange={(e) => setContext(prev => ({ ...prev, customGenre: e.target.value }))}
                                    onFocus={() => setContext(prev => ({ ...prev, genre: StoryGenre.CUSTOM }))}
                                    className="w-full h-10 bg-white border border-stone-300 rounded px-3 py-2 text-[10px] text-gray-800 focus:border-purple-500 outline-none transition-all placeholder-gray-400 resize-y custom-scrollbar focus:shadow-sm leading-relaxed" 
                                    placeholder="可粘贴故事大纲、设定集或特定风格要求..." 
                                />
                            </div>
                        </div>

                        {/* Tone Selection */}
                        <div className="pt-2 border-t border-stone-200">
                            <label className="text-xs text-purple-700 uppercase tracking-wider mb-2 block font-bold">故事基调</label>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.values(StoryMood).map((mood) => (
                                    <button key={mood} onClick={() => setContext(prev => ({ ...prev, worldSettings: { ...prev.worldSettings, tone: mood } }))} className={`px-1 py-2 rounded text-[10px] border transition-all truncate font-medium ${context.worldSettings.tone === mood ? 'bg-purple-100 border-purple-500 text-purple-800 shadow-sm' : 'bg-white border-stone-200 text-gray-500 hover:bg-stone-50'}`}>
                                        {MOOD_LABELS[mood]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Panel 2: Supporting Characters */}
                <div {...getPanelStyle(2)} className={`${getPanelStyle(2).className} bg-stone-100/95 backdrop-blur-md border-blue-500 text-gray-800 group`}>
                    
                    {/* Header with Add Button */}
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2">
                            <span className="w-1 h-4 bg-blue-500 block"></span>
                            配角 / 羁绊
                        </h3>
                        <button 
                            onClick={openAddCharModal}
                            className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all shadow-sm active:scale-95 z-50 pointer-events-auto"
                            title="添加新配角"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Character List - No Scrollbar Utility */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                            {context.supportingCharacters.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                                    <span className="text-2xl mb-2">👥</span>
                                    <span className="text-xs italic">至少添加一位重要配角</span>
                                </div>
                            ) : (
                                context.supportingCharacters.map(char => (
                                    <div 
                                        key={char.id} 
                                        onClick={(e) => openEditCharModal(char, e)}
                                        className={`relative bg-white border p-3 rounded-lg flex justify-between items-center transition-all group hover:shadow-lg hover:-translate-y-0.5 cursor-pointer border-stone-200 hover:border-blue-500`}
                                        title="点击编辑信息"
                                    >
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold ${char.gender === 'female' ? 'text-pink-600' : char.gender === 'male' ? 'text-blue-600' : 'text-gray-600'}`}>
                                                    {char.name}
                                                </span>
                                                <span className={`text-[10px] px-1.5 rounded-sm border ${char.gender === 'female' ? 'border-pink-200 text-pink-500 bg-pink-50' : char.gender === 'male' ? 'border-blue-200 text-blue-500 bg-blue-50' : 'border-gray-200 text-gray-500 bg-gray-50'}`}>
                                                     {char.gender === 'female' ? '♀' : char.gender === 'male' ? '♂' : '?'}
                                                </span>
                                            </div>
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-[10px] bg-stone-100 text-gray-600 px-1 rounded border border-stone-200">{getCharacterLabel(char, context.supportingCharacters)}</span>
                                                {char.archetype && (
                                                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1 rounded border border-indigo-200 font-bold">{char.archetype}</span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-gray-500 mt-1">{char.role}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-xs font-bold font-mono ${(char.affinity || char.initialAffinity || 0) >= 0 ? 'text-pink-500' : 'text-blue-500'}`}>
                                                        {char.affinity || char.initialAffinity || 0}
                                                    </span>
                                                    <span className="text-[8px] text-gray-400 uppercase tracking-wider">好感度</span>
                                                </div>
                                                <button 
                                                    onClick={(e) => handleRemoveSupportingChar(char.id, e)} 
                                                    className="w-6 h-6 flex items-center justify-center rounded-full bg-stone-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors z-20"
                                                    title="移除羁绊"
                                                >
                                                    ✕
                                                </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Panel 3: Narrative Architecture (Structure & Techniques) */}
                <div {...getPanelStyle(3)} className={`${getPanelStyle(3).className} bg-stone-100/95 backdrop-blur-md border-teal-500 text-gray-800 group`}>
                    
                    <div className="mb-4 border-b border-stone-200 pb-2">
                        <h3 className="text-lg font-bold text-teal-800 flex items-center gap-2">
                            <span className="w-1 h-4 bg-teal-500 block"></span>
                            叙事架构与手法
                        </h3>
                    </div>
                    
                    {/* No Scrollbar Utility + Grid Layout */}
                    <div className="flex-1 overflow-y-auto pr-1 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] space-y-6">
                        
                        {/* Section 1: Structure */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs text-teal-700 uppercase tracking-wider font-bold">叙事架构</label>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setContext(prev => ({ ...prev, narrativeMode: 'none' })); }}
                                        className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-all ${context.narrativeMode === 'none' ? 'bg-stone-600 text-white border-stone-700' : 'bg-stone-200 text-gray-600 border-stone-300 hover:bg-stone-300'}`}
                                    >
                                        无
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setContext(prev => ({ ...prev, narrativeMode: 'auto' })); }}
                                        className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-all ${context.narrativeMode === 'auto' ? 'bg-teal-500 text-white border-teal-600 shadow-sm' : 'bg-white text-teal-600 border-teal-200 hover:bg-teal-50'}`}
                                    >
                                        自动
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {NARRATIVE_STRUCTURES.map(structure => (
                                    <button 
                                        key={structure.id}
                                        onClick={(e) => { e.stopPropagation(); setContext(prev => ({ ...prev, narrativeMode: prev.narrativeMode === structure.id ? 'auto' : structure.id })); }}
                                        title={structure.tooltipText} 
                                        className={`
                                            flex flex-col items-center justify-center text-center px-1 py-3 rounded border transition-all relative overflow-hidden
                                            ${context.narrativeMode === structure.id 
                                                ? 'bg-teal-100 border-teal-500 text-teal-900 shadow-sm font-bold' 
                                                : 'bg-white border-stone-200 text-gray-600 hover:border-teal-300 hover:bg-teal-50'
                                            }
                                        `}
                                    >
                                        {context.narrativeMode === structure.id && <div className="absolute top-0 right-0 w-0 h-0 border-t-[12px] border-r-[12px] border-t-transparent border-r-teal-500 z-10"></div>}
                                        <span className="text-[10px] leading-tight">{structure.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Section 2: Technique */}
                        <div>
                            <div className="flex justify-between items-center mb-2 border-t border-stone-200 pt-4">
                                <label className="text-xs text-teal-700 uppercase tracking-wider font-bold">叙事手法</label>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setContext(prev => ({ ...prev, narrativeTechnique: 'none' })); }}
                                        className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-all ${context.narrativeTechnique === 'none' ? 'bg-stone-600 text-white border-stone-700' : 'bg-stone-200 text-gray-600 border-stone-300 hover:bg-stone-300'}`}
                                    >
                                        无
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setContext(prev => ({ ...prev, narrativeTechnique: 'auto' })); }}
                                        className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-all ${context.narrativeTechnique === 'auto' ? 'bg-teal-500 text-white border-teal-600 shadow-sm' : 'bg-white text-teal-600 border-teal-200 hover:bg-teal-50'}`}
                                    >
                                        自动
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {NARRATIVE_TECHNIQUES.map(tech => (
                                    <button 
                                        key={tech.id}
                                        onClick={(e) => { e.stopPropagation(); setContext(prev => ({ ...prev, narrativeTechnique: prev.narrativeTechnique === tech.id ? 'auto' : tech.id })); }}
                                        title={tech.tooltipText} 
                                        className={`
                                            flex flex-col items-center justify-center text-center px-1 py-3 rounded border transition-all relative overflow-hidden
                                            ${context.narrativeTechnique === tech.id 
                                                ? 'bg-teal-100 border-teal-500 text-teal-900 shadow-sm font-bold' 
                                                : 'bg-white border-stone-200 text-gray-600 hover:border-teal-300 hover:bg-teal-50'
                                            }
                                        `}
                                    >
                                        {context.narrativeTechnique === tech.id && <div className="absolute top-0 right-0 w-0 h-0 border-t-[12px] border-r-[12px] border-t-transparent border-r-teal-500 z-10"></div>}
                                        <span className="text-[10px] leading-tight">{tech.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>

            </div>

            {/* Character Add/Edit Modal - Updated to Light Theme */}
            {showCharModal && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in-up">
                    <div className="bg-stone-100 border border-stone-200 p-6 rounded-xl shadow-2xl max-w-sm w-full relative text-gray-800 max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                        <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                             {editingCharId ? '编辑羁绊' : '建立新羁绊'}
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">基本信息</label>
                                <div className="flex gap-2">
                                    <input 
                                        placeholder="姓名" 
                                        value={tempSupportingChar.name} 
                                        onChange={e => setTempSupportingChar(prev => ({ ...prev, name: e.target.value }))} 
                                        className="w-[65%] bg-white border border-stone-300 rounded px-2 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 placeholder-gray-400 transition-colors" 
                                    />
                                    <select 
                                        value={tempSupportingChar.gender || ""} 
                                        onChange={e => setTempSupportingChar(prev => ({ ...prev, gender: e.target.value as any }))}
                                        className={`w-[35%] rounded px-1 py-2 text-sm outline-none border transition-colors appearance-none text-center cursor-pointer 
                                            ${tempSupportingChar.gender === 'male' ? 'text-blue-600 font-bold bg-blue-50 border-blue-300' : 
                                              tempSupportingChar.gender === 'female' ? 'text-pink-600 font-bold bg-pink-50 border-pink-300' : 
                                              tempSupportingChar.gender === 'other' ? 'text-purple-600 font-bold bg-purple-50 border-purple-300' : 
                                              'text-gray-400 bg-white border-stone-300 hover:bg-stone-50'}`}
                                    >
                                        <option value="" disabled>选择性别</option>
                                        <option value="female">♀ 女性</option>
                                        <option value="male">♂ 男性</option>
                                        <option value="other">? 其他</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">定位与关系</label>
                                <div className="flex flex-col gap-2">
                                    <select 
                                        value={tempSupportingChar.category} 
                                        onChange={e => setTempSupportingChar(prev => ({ ...prev, category: e.target.value as any }))}
                                        className="w-full bg-white border border-stone-300 rounded px-2 py-2 text-sm text-gray-600 outline-none focus:border-blue-500 cursor-pointer hover:bg-stone-50 transition-colors"
                                    >
                                        <option value="supporting">配角</option>
                                        <option value="protagonist">主角(友)</option>
                                        <option value="villain">反派</option>
                                        <option value="other">其他</option>
                                    </select>
                                    <input 
                                        placeholder="关系描述 (例: 青梅竹马, 宿敌)" 
                                        value={tempSupportingChar.role} 
                                        onChange={e => setTempSupportingChar(prev => ({ ...prev, role: e.target.value }))} 
                                        className="w-full bg-white border border-stone-300 rounded px-2 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 placeholder-gray-400 transition-colors" 
                                    />
                                </div>
                            </div>

                             {/* Initial Affinity Slider */}
                             <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold">初始好感度</label>
                                    <span className={`text-xs font-mono font-bold ${(tempSupportingChar.initialAffinity || 0) >= 0 ? 'text-pink-600' : 'text-blue-600'}`}>
                                        {tempSupportingChar.initialAffinity || 0}
                                    </span>
                                </div>
                                <input 
                                    type="range" 
                                    min="-50"
                                    max="50"
                                    step="5"
                                    value={tempSupportingChar.initialAffinity || 0}
                                    onChange={e => setTempSupportingChar(prev => ({ ...prev, initialAffinity: parseInt(e.target.value) }))}
                                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, #3b82f6 0%, #ec4899 100%)`
                                    }}
                                />
                                <div className="flex justify-between text-[8px] text-gray-400 mt-1">
                                    <span>敌对 (-50)</span>
                                    <span>中立 (0)</span>
                                    <span>亲密 (+50)</span>
                                </div>
                            </div>

                            {/* Display Archetype Info */}
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">角色原型</label>
                                <div className="w-full bg-indigo-50 border border-indigo-100 rounded px-2 py-1.5 text-xs text-gray-700">
                                    {editingCharId ? (
                                        tempSupportingChar.archetype ? (
                                            <details className="group">
                                                <summary className="list-none flex items-center justify-between cursor-pointer outline-none">
                                                     <div className="font-bold text-indigo-700">{tempSupportingChar.archetype}</div>
                                                     <span className="text-[10px] text-indigo-400 transition-transform group-open:rotate-180">▼</span>
                                                </summary>
                                                <div className="text-[10px] text-gray-600 mt-1 pt-1 border-t border-indigo-100/50 animate-fade-in-up">
                                                    {tempSupportingChar.archetypeDescription}
                                                </div>
                                            </details>
                                        ) : (
                                            <span className="text-gray-400 italic">此角色暂无原型定义</span>
                                        )
                                    ) : (
                                        <div className="flex items-center gap-2 text-gray-500 italic text-xs">
                                            <span>🎲</span>
                                            <span>角色原型将在创建时随机赋予...</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex justify-between items-center">
                                    <span>性格与外貌</span>
                                    <button 
                                        onClick={handleAutoGenerateChar}
                                        disabled={isGeneratingChar || !tempSupportingChar.name || !tempSupportingChar.role || !tempSupportingChar.gender}
                                        className={`
                                            text-[9px] px-2 py-0.5 rounded border transition-colors flex items-center gap-1
                                            ${isGeneratingChar || !tempSupportingChar.name || !tempSupportingChar.role || !tempSupportingChar.gender
                                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                                : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                                            }
                                        `}
                                        title="AI将根据姓名与定位自动生成描述"
                                    >
                                        {isGeneratingChar ? <span className="animate-spin">⟳</span> : <span></span>}
                                        {isGeneratingChar ? '生成中...' : 'AI 自动补全'}
                                    </button>
                                </label>
                                <div className="flex flex-col gap-2">
                                    <input 
                                        placeholder="性格关键词 (例: 傲娇, 腹黑)" 
                                        value={tempSupportingChar.personality} 
                                        onChange={e => setTempSupportingChar(prev => ({ ...prev, personality: e.target.value }))} 
                                        className="w-full bg-white border border-stone-300 rounded px-2 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 placeholder-gray-400 transition-colors" 
                                    />
                                    <textarea 
                                        placeholder="外貌描述 (例: 银发红瞳, 身着机甲)" 
                                        value={tempSupportingChar.appearance} 
                                        onChange={e => setTempSupportingChar(prev => ({ ...prev, appearance: e.target.value }))} 
                                        className="w-full h-16 bg-white border border-stone-300 rounded px-2 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 placeholder-gray-400 transition-colors resize-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-6">
                            <button 
                                onClick={closeCharModal}
                                className="flex-1 py-2 text-sm font-bold bg-gray-200 hover:bg-gray-300 text-gray-700 clip-path-polygon hover:shadow-lg transition-all active:translate-y-0.5"
                                style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                            >
                                取消
                            </button>
                            <button 
                                onClick={handleSaveSupportingChar}
                                disabled={!tempSupportingChar.name || !tempSupportingChar.role || !tempSupportingChar.gender}
                                className={`flex-1 py-2 text-sm font-bold clip-path-polygon transition-all shadow-lg active:translate-y-0.5
                                    ${(!tempSupportingChar.name || !tempSupportingChar.role || !tempSupportingChar.gender) 
                                        ? 'bg-stone-200 text-gray-400 cursor-not-allowed' 
                                        : 'bg-blue-600 hover:bg-blue-500 text-white'}
                                `}
                                style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                            >
                                确认保存
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Skill Add/Edit Modal - Unified Style with Supporting Character Modal */}
            {showSkillModal && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in-up">
                    <div className="bg-stone-100 border border-stone-200 p-6 rounded-xl shadow-2xl max-w-sm w-full relative text-gray-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <h3 className="text-lg font-bold text-yellow-700 mb-4 flex items-center gap-2">
                             {editingSkillId ? '编辑技能' : '添加新技能'}
                        </h3>
                        
                        <div className="space-y-4">
                            {/* Row 1: Name & Level */}
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">技能信息</label>
                                <div className="flex gap-2">
                                    <input 
                                        placeholder="技能名称 (如: 炎龙破)" 
                                        value={tempSkill.name} 
                                        onChange={e => setTempSkill(prev => ({ ...prev, name: e.target.value }))} 
                                        className="flex-1 bg-white border border-stone-300 rounded px-2 py-2 text-sm text-gray-800 outline-none focus:border-yellow-500 placeholder-gray-400 transition-colors" 
                                    />
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="99" 
                                        value={tempSkill.level || 1} 
                                        onChange={e => setTempSkill(prev => ({ ...prev, level: parseInt(e.target.value) || 1 }))} 
                                        className="w-16 bg-white border border-stone-300 rounded px-2 py-2 text-sm text-gray-800 outline-none focus:border-yellow-500 text-center" 
                                        title="技能等级"
                                    />
                                </div>
                            </div>

                            {/* Row 2: Type Selection */}
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">技能类型</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setTempSkill(prev => ({...prev, type: 'active'}))} 
                                        className={`flex-1 py-2 text-xs font-bold rounded border transition-all ${tempSkill.type === 'active' ? 'bg-yellow-100 text-yellow-700 border-yellow-300 shadow-sm' : 'bg-white text-gray-500 border-stone-300 hover:bg-stone-50'}`}
                                    >
                                        主动技能
                                    </button>
                                    <button 
                                        onClick={() => setTempSkill(prev => ({...prev, type: 'passive'}))} 
                                        className={`flex-1 py-2 text-xs font-bold rounded border transition-all ${tempSkill.type === 'passive' ? 'bg-blue-100 text-blue-700 border-blue-300 shadow-sm' : 'bg-white text-gray-500 border-stone-300 hover:bg-stone-50'}`}
                                    >
                                        被动技能
                                    </button>
                                </div>
                            </div>

                            {/* Row 3 & 4: Description */}
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex justify-between items-center">
                                    <span>效果描述</span>
                                    <button 
                                        onClick={handleAutoGenerateSkill}
                                        disabled={isGeneratingSkill || !tempSkill.name}
                                        className={`
                                            text-[9px] px-2 py-0.5 rounded border transition-colors flex items-center gap-1
                                            ${isGeneratingSkill || !tempSkill.name
                                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                                : 'bg-yellow-50 text-yellow-600 border-yellow-200 hover:bg-yellow-100'
                                            }
                                        `}
                                        title="AI自动生成技能描述"
                                    >
                                        {isGeneratingSkill ? <span className="animate-spin">⟳</span> : <span></span>}
                                        {isGeneratingSkill ? '生成中...' : 'AI 自动补全'}
                                    </button>
                                </label>
                                <textarea 
                                    placeholder="描述技能效果 (如: 造成范围火焰伤害)" 
                                    value={tempSkill.description} 
                                    onChange={e => setTempSkill(prev => ({ ...prev, description: e.target.value }))} 
                                    className="w-full h-24 bg-white border border-stone-300 rounded px-2 py-2 text-sm text-gray-800 outline-none focus:border-yellow-500 placeholder-gray-400 transition-colors resize-y custom-scrollbar" 
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-6">
                            <button 
                                onClick={() => setShowSkillModal(false)}
                                className="flex-1 py-2 text-sm font-bold bg-gray-200 hover:bg-gray-300 text-gray-700 clip-path-polygon hover:shadow-lg transition-all active:translate-y-0.5"
                                style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                            >
                                取消
                            </button>
                            <button 
                                onClick={handleSaveSkill}
                                disabled={!tempSkill.name || !tempSkill.description}
                                className={`flex-1 py-2 text-sm font-bold clip-path-polygon transition-all shadow-lg active:translate-y-0.5
                                    ${(!tempSkill.name || !tempSkill.description)
                                        ? 'bg-stone-200 text-gray-400 cursor-not-allowed' 
                                        : 'bg-yellow-600 hover:bg-yellow-500 text-white'}
                                `}
                                style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                            >
                                确认保存
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Start Game Progress Button with Cassette Futurism Decorations */}
            <div className="absolute bottom-10 left-0 w-full flex justify-center items-end pointer-events-none z-50">
                <div className="flex items-center gap-4 pointer-events-auto">

                    {/* Left Decoration: System Monitor */}
                    <div 
                        className="hidden md:flex flex-col gap-1 items-end opacity-80 hover:opacity-100 transition-all duration-300 cursor-pointer group active:scale-95"
                        onClick={() => playClickSound?.()}
                        title="系统遥测模块"
                    >
                        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" className="drop-shadow-[0_0_10px_rgba(14,165,233,0.3)]">
                            <path d="M0 10 L10 0 H60 V50 L50 60 H0 V10 Z" fill="#0f172a" stroke="#0ea5e9" strokeWidth="1.5" className="group-hover:stroke-cyan-300 transition-colors" />
                            {/* Blinking Data Strip */}
                            <rect x="10" y="15" width="20" height="3" fill="#0ea5e9" className="animate-pulse" />
                            <rect x="35" y="15" width="5" height="3" fill="#0ea5e9" className="animate-pulse delay-100" />
                            
                            {/* Data Lines */}
                            <rect x="10" y="22" width="40" height="2" fill="#334155" />
                            <rect x="10" y="27" width="30" height="2" fill="#334155" />
                            <rect x="10" y="32" width="35" height="2" fill="#334155" />
                            
                            {/* Warning Light */}
                            <rect x="45" y="45" width="6" height="6" fill="#ef4444" className="animate-[pulse_0.5s_ease-in-out_infinite]" />
                            <text x="8" y="55" fontSize="6" fill="#94a3b8" fontFamily="monospace">SYS.RDY</text>
                        </svg>
                    </div>

                    {/* Center Button Container (Existing) */}
                    <div className="w-80 bg-black/80 backdrop-blur-md rounded-2xl border border-gray-700 p-2 shadow-2xl flex items-center gap-4 transition-all duration-300 relative">
                        {/* Status Indicators - UPDATED FOR 4 DOTS */}
                        <div className="flex gap-1.5 flex-col pl-2">
                            <div className={`w-2 h-2 rounded-full ${isProtagonistValid ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-red-500 animate-pulse'} transition-colors`} title="主角设定"></div>
                            <div className={`w-2 h-2 rounded-full ${isStoryNameValid ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-red-500 animate-pulse'} transition-colors`} title="世界设定"></div>
                            <div className={`w-2 h-2 rounded-full ${hasSupportingChars ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-red-500 animate-pulse'} transition-colors`} title="配角设定"></div>
                            <div className={`w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e] transition-colors`} title="叙事架构 (默认自动)"></div>
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
                            className={`
                                flex-1 h-14 relative overflow-hidden rounded-xl font-bold tracking-[0.2em] transition-all duration-300 border-2
                                ${isReady 
                                    ? 'border-cyan-400 bg-cyan-950/30 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:bg-cyan-400/10 hover:shadow-[0_0_30px_rgba(34,211,238,0.6)]' 
                                    : 'border-gray-800 bg-black/40 text-gray-600 cursor-not-allowed hover:bg-gray-900/50'}
                            `}
                        >
                            {/* Progress Fill - Now subtle and behind */}
                            <div 
                                className={`absolute left-0 top-0 h-full transition-all duration-500 ease-out ${isReady ? 'opacity-0' : 'opacity-100'}`}
                                style={{ width: `${progress}%` }}
                            >
                                <div className="w-full h-full bg-cyan-500/20 backdrop-blur-sm border-r border-cyan-500/30"></div>
                            </div>
                            
                            <div className="relative z-10 flex flex-col items-center justify-center h-full">
                                {isReady ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl animate-pulse text-cyan-400">◈</span>
                                        <span className="text-lg text-shadow-glow">启动体验</span>
                                        <span className="text-xl animate-pulse text-cyan-400">◈</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center opacity-80">
                                        <span className="text-xs font-mono mb-0.5 tracking-widest">SYSTEM CHARGING</span>
                                        <span className="text-xl font-mono text-cyan-600">{progress}%</span>
                                    </div>
                                )}
                            </div>
                        </button>
                    </div>

                    {/* Right Decoration: Flux Capacitor / Reel */}
                    <div 
                        className="hidden md:flex flex-col gap-1 items-start opacity-80 hover:opacity-100 transition-all duration-300 cursor-pointer group active:scale-95"
                        onClick={() => playClickSound?.()}
                        title="磁通量电容器"
                    >
                        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" className="drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                            {/* Outer Casing */}
                            <path d="M10 0 H50 L60 10 V50 L50 60 H10 L0 50 V10 L10 0 Z" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" className="group-hover:stroke-amber-300 transition-colors" />
                            
                            {/* Rotating Reel */}
                            <g className="origin-center animate-[spin_6s_linear_infinite] group-hover:animate-[spin_2s_linear_infinite]">
                                <circle cx="30" cy="30" r="18" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 2" opacity="0.6" />
                                <circle cx="30" cy="30" r="8" stroke="#f59e0b" strokeWidth="2" fill="#1c1917" />
                                <path d="M30 10 V22 M30 50 V38 M10 30 H22 M50 30 H38" stroke="#f59e0b" strokeWidth="2" opacity="0.8" />
                            </g>

                            {/* Corner Accents */}
                            <rect x="5" y="5" width="2" height="2" fill="#f59e0b" />
                            <rect x="53" y="5" width="2" height="2" fill="#f59e0b" />
                            <rect x="5" y="53" width="2" height="2" fill="#f59e0b" />
                            <rect x="53" y="53" width="2" height="2" fill="#f59e0b" />
                            
                            {/* Label */}
                            <text x="40" y="56" fontSize="5" fill="#f59e0b" fontFamily="monospace" textAnchor="end">SYNC</text>
                        </svg>
                    </div>

                </div>
            </div>
        </div>
    );
};
