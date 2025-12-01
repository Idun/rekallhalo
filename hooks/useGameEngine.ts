
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
    GameState, GameContext, SavedGame, StoryGenre, StoryMood, 
    generateUUID, SaveType, ImageSize, ShotSize, SupportingCharacter, 
    Character, WorldSettings, ScheduledEvent, PlotChapter,
    ImageModel, AvatarStyle, InputMode, VisualEffectType, GalleryItem,
    MemoryState
} from '../types';
import * as GeminiService from '../services/geminiService';
import { getRandomBackground } from '../components/SmoothBackground';
import { CHARACTER_ARCHETYPES } from '../constants';

const DEFAULT_MEMORY: MemoryState = {
    memoryZone: "",
    storyMemory: "",
    longTermMemory: "",
    coreMemory: "",
    characterRecord: "",
    inventory: "暂无物品"
};

const DEFAULT_CONTEXT: GameContext = {
    sessionId: '',
    genre: StoryGenre.FANTASY,
    character: { name: '', gender: 'male', trait: '', skills: [] },
    supportingCharacters: [],
    worldSettings: { tone: StoryMood.PEACEFUL, isHarem: false, isAdult: false, hasSystem: false },
    history: [],
    currentSegment: null,
    lastUpdated: 0,
    memories: DEFAULT_MEMORY,
    scheduledEvents: [],
    plotBlueprint: []
};

export const useGameEngine = () => {
    // --- State: System ---
    const [gameState, setGameState] = useState<GameState>(GameState.LANDING);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [modals, setModals] = useState<Record<string, boolean>>({});
    
    // --- State: Game Data ---
    const [context, setContext] = useState<GameContext>(DEFAULT_CONTEXT);
    const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
    const [currentLoadedSaveId, setCurrentLoadedSaveId] = useState<string | null>(null);
    const [setupTempData, setSetupTempData] = useState<any>(null); // For preserving setup form state

    // --- State: Media & Visuals ---
    const [bgImage, setBgImage] = useState<string>('');
    const [gallery, setGallery] = useState<GalleryItem[]>([]);
    const [viewingImage, setViewingImage] = useState<GalleryItem | null>(null);
    const [visualEffect, setVisualEffect] = useState<VisualEffectType>('none');
    const [battleAnim, setBattleAnim] = useState<string | null>(null);
    const [generatingImage, setGeneratingImage] = useState(false);
    const [isUiVisible, setIsUiVisible] = useState(true);
    const [isCurrentBgFavorited, setIsCurrentBgFavorited] = useState(false);

    // --- State: Settings ---
    const [aiModel, setAiModel] = useState<string>('gemini-2.5-pro');
    const [imageModel, setImageModel] = useState<ImageModel>('gemini-2.5-flash-image');
    const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>('anime');
    const [customAvatarStyle, setCustomAvatarStyle] = useState('');
    const [avatarRefImage, setAvatarRefImage] = useState('');
    const [backgroundStyle, setBackgroundStyle] = useState<'anime'|'realistic'>('anime');
    const [inputMode, setInputMode] = useState<InputMode>('choice');
    const [modelScopeApiKey, setModelScopeApiKey] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [showStoryPanelBackground, setShowStoryPanelBackground] = useState(true);
    const [historyFontSize, setHistoryFontSize] = useState(14);
    const [storyFontSize, setStoryFontSize] = useState(18);
    const [storyFontFamily, setStoryFontFamily] = useState("'Noto Serif SC', serif");
    const [autoSaveGallery, setAutoSaveGallery] = useState(false);

    // --- State: Gameplay Control ---
    const [textTypingComplete, setTextTypingComplete] = useState(false);
    const [typingSpeed, setTypingSpeed] = useState(30);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
    const [autoSaveState, setAutoSaveState] = useState<'saving' | 'complete' | null>(null);
    
    // --- State: Image Gen Modal ---
    const [selectedImageStyle, setSelectedImageStyle] = useState<string>('anime');
    const [customImageStyle, setCustomImageStyle] = useState<string>('');

    // --- Refs ---
    const abortControllerRef = useRef<AbortController | null>(null);
    const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // --- Sound Effects ---
    const playSound = (type: 'click' | 'hover' | 'progress' | 'confirm') => {
        if (isMuted) return;
        // Placeholder implementation
    };
    const playClickSound = () => playSound('click');
    const playHoverSound = () => playSound('hover');
    const playProgressSound = () => playSound('progress');
    const playConfirmSound = () => playSound('confirm');

    // --- Initialization ---
    useEffect(() => {
        // Load settings and saves from localStorage
        const loadedSaves = localStorage.getItem('protagonist_saves');
        if (loadedSaves) setSavedGames(JSON.parse(loadedSaves));
        
        const loadedGallery = localStorage.getItem('protagonist_gallery');
        if (loadedGallery) setGallery(JSON.parse(loadedGallery));

        const loadedSettings = localStorage.getItem('protagonist_settings');
        if (loadedSettings) {
            const s = JSON.parse(loadedSettings);
            setAiModel(s.aiModel || 'gemini-2.5-pro');
            setImageModel(s.imageModel || 'gemini-2.5-flash-image');
            setAvatarStyle(s.avatarStyle || 'anime');
            setBackgroundStyle(s.backgroundStyle || 'anime');
            if (s.volume !== undefined) setVolume(s.volume);
            if (s.isMuted !== undefined) setIsMuted(s.isMuted);
        }

        // Initial Background
        setBgImage(getRandomBackground(backgroundStyle));
    }, []);

    // Save Settings Effect
    useEffect(() => {
        localStorage.setItem('protagonist_settings', JSON.stringify({
            aiModel, imageModel, avatarStyle, backgroundStyle, volume, isMuted
        }));
    }, [aiModel, imageModel, avatarStyle, backgroundStyle, volume, isMuted]);

    // --- Actions ---

    const toggleModal = (modal: string, show: boolean) => {
        setModals(prev => ({ ...prev, [modal]: show }));
    };

    const handleStartNewGameSetup = () => {
        setContext(DEFAULT_CONTEXT);
        setSetupTempData(null);
        setGameState(GameState.SETUP);
        setBgImage(getRandomBackground(backgroundStyle));
    };

    const handleSaveSetup = () => {
        const save: SavedGame = {
            id: generateUUID(),
            sessionId: generateUUID(),
            timestamp: Date.now(),
            storyName: context.storyName,
            characterName: context.character.name,
            genre: context.genre,
            summary: "自定义初始设定",
            context: context,
            type: SaveType.SETUP
        };
        const newSaves = [save, ...savedGames];
        setSavedGames(newSaves);
        localStorage.setItem('protagonist_saves', JSON.stringify(newSaves));
        toggleModal('saveNotification', true);
        setTimeout(() => toggleModal('saveNotification', false), 2000);
    };

    const addToGallery = (base64: string, prompt: string, style: string) => {
        const newItem: GalleryItem = {
            id: generateUUID(),
            timestamp: Date.now(),
            base64,
            prompt,
            style
        };
        const newGallery = [newItem, ...gallery];
        setGallery(newGallery);
        localStorage.setItem('protagonist_gallery', JSON.stringify(newGallery));
    };

    const deleteFromGallery = (id: string) => {
        const newGallery = gallery.filter(i => i.id !== id);
        setGallery(newGallery);
        localStorage.setItem('protagonist_gallery', JSON.stringify(newGallery));
    };

    const deleteSaveGame = (id: string) => {
        const newSaves = savedGames.filter(s => s.id !== id);
        setSavedGames(newSaves);
        localStorage.setItem('protagonist_saves', JSON.stringify(newSaves));
    };

    const deleteSession = (sessionId: string) => {
        const newSaves = savedGames.filter(s => s.sessionId !== sessionId);
        setSavedGames(newSaves);
        localStorage.setItem('protagonist_saves', JSON.stringify(newSaves));
    };

    const importSaveGame = (saves: SavedGame | SavedGame[]) => {
        const toImport = Array.isArray(saves) ? saves : [saves];
        let count = 0;
        const newSaves = [...savedGames];
        toImport.forEach(s => {
            if (!newSaves.some(exist => exist.id === s.id)) {
                newSaves.push(s);
                count++;
            }
        });
        setSavedGames(newSaves);
        localStorage.setItem('protagonist_saves', JSON.stringify(newSaves));
        return count;
    };

    const handleLoadGame = (save: SavedGame, forceSetup = false) => {
        // Safe merge to prevent crashes on old saves missing new fields
        const safeContext = {
            ...save.context,
            scheduledEvents: save.context.scheduledEvents || [],
            plotBlueprint: save.context.plotBlueprint || []
        };

        setContext(safeContext);
        if (save.context.currentSegment?.backgroundImage) {
            setBgImage(save.context.currentSegment.backgroundImage);
        }
        if (forceSetup || save.type === SaveType.SETUP) {
            setGameState(GameState.SETUP);
        } else {
            setGameState(GameState.PLAYING);
        }
        setCurrentLoadedSaveId(save.id);
    };

    const handleAbortGame = () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        setGameState(GameState.LANDING);
    };

    const handleAutoPlanBlueprint = async (config?: { chapterCount: number, wordCountRange: [number, number], newCharCount: number }) => {
        if (!context.character.name) {
            setError("请先在「主角档案」中填写主角姓名");
            setTimeout(() => setError(null), 3000);
            return;
        }
        if (!context.genre) {
            setError("请先选择故事类型");
            setTimeout(() => setError(null), 3000);
            return;
        }
        
        setIsLoading(true);
        setError(null);
        try {
            const { chapters, newCharacters } = await GeminiService.autoPlanBlueprint(
                context.genre,
                context.character,
                context.worldSettings,
                context.customGenre || '',
                context.supportingCharacters, // Pass existing characters
                context.plotBlueprint || [], // Pass existing chapters for context
                config, // Pass the configuration
                context.narrativeMode, // Pass Narrative Structure
                context.narrativeTechnique // Pass Narrative Technique
            );
            
            // Map raw new characters to SupportingCharacter type
            const mappedNewChars: SupportingCharacter[] = newCharacters.map((nc: any) => {
                // User requirement: Affinity -10 to 10 (same as SetupScreen default)
                const randomAffinity = Math.floor(Math.random() * 21) - 10; 
                
                // Random archetype if not present from AI
                const randomArchetypeObj = CHARACTER_ARCHETYPES[Math.floor(Math.random() * CHARACTER_ARCHETYPES.length)];
                const archetype = nc.archetype || randomArchetypeObj.name;
                const archetypeDesc = nc.archetypeDescription || randomArchetypeObj.description;

                return {
                    id: generateUUID(),
                    name: nc.name,
                    role: nc.role,
                    gender: nc.gender || 'other',
                    category: 'supporting',
                    affinity: randomAffinity,
                    initialAffinity: randomAffinity,
                    personality: nc.personality || "AI 自动生成",
                    appearance: nc.appearance || "AI 自动生成",
                    archetype: archetype,
                    archetypeDescription: archetypeDesc
                };
            });

            setContext(prev => ({
                ...prev,
                plotBlueprint: config && prev.plotBlueprint?.length > 0 ? [...prev.plotBlueprint, ...chapters] : chapters, // Append if continuing, replace if fresh
                // Merge new characters with existing ones, avoiding duplicates by name
                supportingCharacters: [
                    ...prev.supportingCharacters,
                    ...mappedNewChars.filter(nc => !prev.supportingCharacters.some(ec => ec.name === nc.name))
                ]
            }));
            playConfirmSound();
        } catch (e: any) {
            console.error("Auto plan failed", e);
            setError(e.message || "规划失败，请检查网络或稍后重试");
            setTimeout(() => setError(null), 3000);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartGame = async () => {
        playClickSound();
        if (!context.character.name || !context.character.trait) { setError("请输入角色姓名和性格关键词"); return; }
        setError(null); setCurrentLoadedSaveId(null);
        abortControllerRef.current = new AbortController();
        const initialBlueprint = context.plotBlueprint ? context.plotBlueprint.map((c, i) => i === 0 ? { ...c, status: 'active' as const } : c) : [];
        setContext(prev => ({ ...prev, sessionId: prev.sessionId || generateUUID(), scheduledEvents: prev.scheduledEvents || [], plotBlueprint: initialBlueprint }));
        
        setGameState(GameState.LOADING); 
        setLoadingProgress(0);
        
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        progressTimerRef.current = setInterval(() => { 
            setLoadingProgress(prev => { 
                if (prev >= 95) return prev; 
                return Math.min(prev + (prev < 50 ? Math.random() * 5 + 2 : Math.random() + 0.5), 95); 
            }); 
        }, 200);

        try {
            const opening = await GeminiService.generateOpening(
                context.genre, 
                context.character, 
                context.supportingCharacters, 
                context.worldSettings, 
                aiModel, 
                context.customGenre, 
                context.storyName, 
                customPrompt, 
                context.narrativeMode, 
                context.narrativeTechnique, 
                initialBlueprint
            );
            
            if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
            setLoadingProgress(prev => Math.max(prev, 40));
            
            const avatarPromise = GeminiService.generateCharacterAvatar(context.genre, context.character, avatarStyle, imageModel, customAvatarStyle, modelScopeApiKey, avatarRefImage);
            const sceneImagePromise = GeminiService.generateSceneImage(opening.visualPrompt + ", no humans, nobody, scenery only, landscape, architecture, environment", ImageSize.SIZE_1K, backgroundStyle, "", customAvatarStyle, imageModel, modelScopeApiKey, ShotSize.EXTREME_LONG_SHOT);
            
            const supportingCharPromises = context.supportingCharacters.map(async (sc) => { 
                if (sc.avatar) return sc; 
                try { 
                    const scAvatar = await GeminiService.generateCharacterAvatar(context.genre, sc, avatarStyle, imageModel, customAvatarStyle, modelScopeApiKey, avatarRefImage); 
                    return { ...sc, avatar: scAvatar }; 
                } catch (e) { return sc; } 
            });
            
            const [avatarBase64, sceneBase64, updatedSupportingChars] = await Promise.all([avatarPromise, sceneImagePromise, Promise.all(supportingCharPromises)]);
            
            if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
            setLoadingProgress(100);
            
            await new Promise(resolve => setTimeout(resolve, 300));
            if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
            
            const openingSegment = { ...opening, id: opening.id || generateUUID(), backgroundImage: sceneBase64 }; 
            if (sceneBase64) { 
                setBgImage(sceneBase64); 
                if (autoSaveGallery) addToGallery(sceneBase64, opening.visualPrompt, avatarStyle);
            }
            
            setContext(prev => ({ 
                ...prev, 
                sessionId: prev.sessionId || generateUUID(), 
                storyName: opening.storyName || prev.storyName || "未命名故事", 
                character: { ...prev.character, avatar: avatarBase64 }, 
                supportingCharacters: updatedSupportingChars, 
                history: [openingSegment], 
                currentSegment: openingSegment, 
                lastUpdated: Date.now(), 
                memories: opening.newMemories || DEFAULT_MEMORY 
            }));
            
            setGameState(GameState.PLAYING); 
            playProgressSound();
        } catch (err: any) { 
            if (err.message === "Aborted") return; 
            if (progressTimerRef.current) clearInterval(progressTimerRef.current); 
            setGameState(GameState.SETUP); 
            setError(err.message || "AI响应异常，请重试。"); 
        }
    };

    const handleChoice = async (choice: string, fromIndex?: number) => {
        if (isLoading) return;
        
        let history = context.history;
        if (fromIndex !== undefined && fromIndex < context.history.length - 1) {
            history = context.history.slice(0, fromIndex + 1);
        }

        setIsLoading(true);
        setTextTypingComplete(false);
        try {
            const nextSegment = await GeminiService.advanceStory(
                history,
                choice,
                context.genre,
                context.character,
                context.supportingCharacters,
                context.worldSettings,
                context.memories,
                aiModel,
                context.customGenre,
                customPrompt,
                context.scheduledEvents || [],
                context.narrativeMode,
                context.narrativeTechnique,
                context.plotBlueprint || [],
                'full'
            );

            let updatedSupportingChars = [...context.supportingCharacters];
            if (nextSegment.affinityChanges) {
                updatedSupportingChars = updatedSupportingChars.map(c => {
                    if (nextSegment.affinityChanges![c.name]) {
                        return { ...c, affinity: (c.affinity || 0) + nextSegment.affinityChanges![c.name] };
                    }
                    return c;
                });
            }

            let updatedEvents = [...(context.scheduledEvents || [])];
            if (nextSegment.triggeredEventId) {
                updatedEvents = updatedEvents.map(e => e.id === nextSegment.triggeredEventId ? { ...e, status: 'completed' } : e);
            }

            setGeneratingImage(true);
            GeminiService.generateSceneImage(
                nextSegment.visualPrompt, 
                ImageSize.SIZE_1K, 
                backgroundStyle, 
                "", 
                customAvatarStyle, 
                imageModel, 
                modelScopeApiKey
            ).then(img => {
                setContext(prev => {
                    const newHistory = prev.history.map(h => h.id === nextSegment.id ? { ...h, backgroundImage: img } : h);
                    const newCurrent = prev.currentSegment?.id === nextSegment.id ? { ...prev.currentSegment, backgroundImage: img } : prev.currentSegment;
                    return { ...prev, history: newHistory, currentSegment: newCurrent as any };
                });
                setBgImage(img);
                if (autoSaveGallery) addToGallery(img, nextSegment.visualPrompt, backgroundStyle);
                setGeneratingImage(false);
            }).catch(() => setGeneratingImage(false));

            const segmentWithChoice = { ...nextSegment, causedBy: choice };
            
            setContext(prev => ({
                ...prev,
                history: [...history, segmentWithChoice],
                currentSegment: segmentWithChoice,
                supportingCharacters: updatedSupportingChars,
                memories: nextSegment.newMemories || prev.memories,
                scheduledEvents: updatedEvents,
                lastUpdated: Date.now()
            }));

            setAutoSaveState('saving');
            setTimeout(() => setAutoSaveState('complete'), 1000);
            setTimeout(() => setAutoSaveState(null), 3000);

        } catch (e) {
            console.error(e);
            setError("推进剧情失败");
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualSave = () => {
        if (!context.currentSegment) return;
        const save: SavedGame = {
            id: generateUUID(),
            sessionId: context.sessionId,
            storyName: context.storyName,
            storyId: context.currentSegment.id,
            parentId: context.history.length > 1 ? context.history[context.history.length - 2].id : undefined,
            timestamp: Date.now(),
            genre: context.genre,
            characterName: context.character.name,
            summary: context.currentSegment.text.substring(0, 50) + "...",
            location: context.currentSegment.location,
            context: context,
            type: SaveType.MANUAL,
            choiceText: context.currentSegment.causedBy
        };
        const newSaves = [save, ...savedGames];
        setSavedGames(newSaves);
        localStorage.setItem('protagonist_saves', JSON.stringify(newSaves));
        toggleModal('saveNotification', true);
        setTimeout(() => toggleModal('saveNotification', false), 2000);
    };

    const handleBackToHome = () => {
        handleManualSave();
        setGameState(GameState.LANDING);
    };

    const handleGenerateImage = () => {
        if (!context.currentSegment) return;
        setGeneratingImage(true);
        GeminiService.generateSceneImage(
            context.currentSegment.visualPrompt, 
            ImageSize.SIZE_1K, 
            selectedImageStyle, 
            "", 
            customImageStyle, 
            imageModel, 
            modelScopeApiKey
        ).then(img => {
            setBgImage(img);
            if (context.currentSegment) {
                setContext(prev => ({
                    ...prev,
                    currentSegment: { ...prev.currentSegment!, backgroundImage: img },
                    history: prev.history.map(h => h.id === prev.currentSegment!.id ? { ...h, backgroundImage: img } : h)
                }));
            }
            if (autoSaveGallery) addToGallery(img, context.currentSegment.visualPrompt, selectedImageStyle);
            setGeneratingImage(false);
        }).catch(() => setGeneratingImage(false));
    };

    const handleRegenerateAvatar = () => {
        if (!selectedCharacterId) return;
        setGeneratingImage(true);
        const char = context.supportingCharacters.find(c => c.id === selectedCharacterId) || context.character;
        GeminiService.generateCharacterAvatar(context.genre, char as any, selectedImageStyle, imageModel, customImageStyle, modelScopeApiKey, avatarRefImage)
            .then(img => {
                if (char === context.character) {
                    setContext(prev => ({ ...prev, character: { ...prev.character, avatar: img } }));
                } else {
                    setContext(prev => ({
                        ...prev,
                        supportingCharacters: prev.supportingCharacters.map(c => c.id === selectedCharacterId ? { ...c, avatar: img } : c)
                    }));
                }
                setGeneratingImage(false);
            }).catch(() => setGeneratingImage(false));
    };

    const handleUseSkill = (skill: any) => {};
    const handleSummarizeMemory = () => {};
    const handleRegenerate = (mode: 'full' | 'text' | 'choices') => {};
    const handleSwitchVersion = (id: string, dir: 'prev' | 'next') => {};
    const handleGlobalReplace = (find: string, replace: string) => 0;
    const handleAddScheduledEvent = (e: any) => {};
    const handleUpdateScheduledEvent = (e: any) => {};
    const handleDeleteScheduledEvent = (id: string) => {};
    const toggleCurrentBgFavorite = () => setIsCurrentBgFavorited(!isCurrentBgFavorited);
    const handleTestModelScope = async (key: string) => GeminiService.validateModelScopeConnection(key);
    const handleUpgradeSkill = (id: string) => {};

    // Settings Setters
    const handleSetAiModel = (m: string) => setAiModel(m);
    const handleSetImageModel = (m: ImageModel) => setImageModel(m);
    const handleSetAvatarStyle = (s: AvatarStyle) => setAvatarStyle(s);
    const handleSetCustomAvatarStyle = (s: string) => setCustomAvatarStyle(s);
    const handleSetAvatarRefImage = (s: string) => setAvatarRefImage(s);
    const handleSetBackgroundStyle = (s: any) => setBackgroundStyle(s);
    const handleSetInputMode = (m: InputMode) => setInputMode(m);
    const handleSetModelScopeApiKey = (k: string) => setModelScopeApiKey(k);
    const handleSetCustomPrompt = (s: string) => setCustomPrompt(s);
    const handleSetShowStoryPanelBackground = (b: boolean) => setShowStoryPanelBackground(b);
    const handleSetHistoryFontSize = (n: number) => setHistoryFontSize(n);
    const handleSetStoryFontSize = (n: number) => setStoryFontSize(n);
    const handleSetStoryFontFamily = (s: string) => setStoryFontFamily(s);
    const handleSetAutoSaveGallery = (b: boolean) => setAutoSaveGallery(b);

    return {
        gameState, setGameState,
        context, setContext,
        bgImage, setBgImage,
        isLoading, loadingProgress, error,
        modals, toggleModal,
        savedGames, handleLoadGame, deleteSaveGame, deleteSession, importSaveGame,
        gallery, viewingImage, setViewingImage, deleteFromGallery,
        aiModel, handleSetAiModel,
        imageModel, handleSetImageModel,
        avatarStyle, handleSetAvatarStyle,
        customAvatarStyle, handleSetCustomAvatarStyle,
        avatarRefImage, handleSetAvatarRefImage,
        backgroundStyle, handleSetBackgroundStyle,
        inputMode, handleSetInputMode,
        modelScopeApiKey, handleSetModelScopeApiKey, handleTestModelScope,
        customPrompt, handleSetCustomPrompt,
        isMuted, setIsMuted, volume, setVolume,
        showStoryPanelBackground, handleSetShowStoryPanelBackground,
        historyFontSize, handleSetHistoryFontSize,
        storyFontSize, handleSetStoryFontSize,
        storyFontFamily, handleSetStoryFontFamily,
        autoSaveGallery, handleSetAutoSaveGallery,
        playClickSound, playHoverSound, playConfirmSound,
        setupTempData, setSetupTempData,
        handleStartNewGameSetup, handleStartGame, handleSaveSetup, handleAutoPlanBlueprint, handleAbortGame,
        handleBackToHome, handleManualSave, handleChoice, handleUseSkill, handleSummarizeMemory,
        handleRegenerate, handleSwitchVersion, handleGlobalReplace,
        handleAddScheduledEvent, handleUpdateScheduledEvent, handleDeleteScheduledEvent,
        textTypingComplete, setTextTypingComplete,
        typingSpeed, setTypingSpeed,
        isUiVisible, setIsUiVisible,
        battleAnim,
        generatingImage, handleGenerateImage,
        isSummarizing,
        visualEffect, setVisualEffect,
        autoSaveState,
        selectedCharacterId, setSelectedCharacterId,
        isCurrentBgFavorited, toggleCurrentBgFavorite,
        handleRegenerateAvatar,
        selectedImageStyle, setSelectedImageStyle,
        customImageStyle, setCustomImageStyle,
        handleUpgradeSkill
    };
};
