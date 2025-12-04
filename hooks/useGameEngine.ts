
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
    GameState, GameContext, SavedGame, StoryGenre, StoryMood, 
    generateUUID, SaveType, ImageSize, ShotSize, SupportingCharacter, 
    Character, WorldSettings, ScheduledEvent, PlotChapter,
    ImageModel, AvatarStyle, InputMode, VisualEffectType, GalleryItem,
    MemoryState, StorySegment, TextModelProvider
} from '../types';
import * as GeminiService from '../services/geminiService';
import { StorageService } from '../services/storageService';
import { getRandomBackground, getSmartBackground } from '../components/SmoothBackground';
import { CHARACTER_ARCHETYPES } from '../constants';

// ... (retain all constants and imports up to useGameEngine) ...

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

const DEFAULT_WRITING_RULES = "请始终保持小说叙述风格，熟练运用“五感写作法”（视觉、听觉、嗅觉、触觉、味觉）和“冰山理论写法”（只描写行动和感官细节，避免直接描写情绪和说教）。采用简洁、自然的口语化表达，使整体叙事更符合现代汉语习惯。多加入人物对话和心理刻画，减少华丽辞藻和纯粹的叙述。避免过于直白的系统提示音，将系统机制自然巧妙地融入世界观中。";

// --- Extended Audio Playlists (Reliable Sources) ---
const EXTENDED_PLAYLISTS: Record<StoryMood, string[]> = {
  [StoryMood.PEACEFUL]: [
      "https://commondatastorage.googleapis.com/codeskulptor-demos/pyman_assets/intromusic.ogg",
      "https://commondatastorage.googleapis.com/codeskulptor-assets/Epoq-Lepidoptera.ogg",
      "https://commondatastorage.googleapis.com/codeskulptor-demos/pyman_assets/ateapill.ogg",
      "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3", // Relaxing
      "https://cdn.pixabay.com/download/audio/2022/02/07/audio_84530b196d.mp3"  // Ambient
  ],
  [StoryMood.BATTLE]: [
      "https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/race1.ogg",
      "https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/race2.ogg",
      "https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/start.ogg",
      "https://cdn.pixabay.com/download/audio/2022/03/09/audio_c8c8a73467.mp3", // Epic Battle
      "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3"  // Action
  ],
  [StoryMood.TENSE]: [
      "https://commondatastorage.googleapis.com/codeskulptor-assets/sounddogs/thrust.mp3",
      "https://commondatastorage.googleapis.com/codeskulptor-assets/week7-brrring.m4a", 
      "https://cdn.pixabay.com/download/audio/2022/10/25/audio_5145b23d57.mp3", // Suspense
      "https://cdn.pixabay.com/download/audio/2021/11/25/audio_915835b674.mp3"  // Dark Drone
  ],
  [StoryMood.EMOTIONAL]: [
      "https://commondatastorage.googleapis.com/codeskulptor-demos/pyman_assets/ateapill.ogg",
      "https://cdn.pixabay.com/download/audio/2022/02/10/audio_fc8c83a779.mp3", // Sad Piano
      "https://cdn.pixabay.com/download/audio/2022/03/24/audio_3335555d49.mp3"  // Emotional
  ],
  [StoryMood.MYSTERIOUS]: [
      "https://commondatastorage.googleapis.com/codeskulptor-assets/Epoq-Lepidoptera.ogg",
      "https://cdn.pixabay.com/download/audio/2022/04/27/audio_65b3234976.mp3", // Mystery
      "https://cdn.pixabay.com/download/audio/2022/05/16/audio_db65d1b61c.mp3"  // Space
  ],
  [StoryMood.VICTORY]: [
      "https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/win.ogg",
      "https://cdn.pixabay.com/download/audio/2022/01/26/audio_d14f631163.mp3", // Success
      "https://cdn.pixabay.com/download/audio/2022/10/24/audio_55a29737b6.mp3"  // Uplifting
  ]
};

// --- Embedded Base64 Sound Effects (Soft & Gentle Suite) ---
// Retaining original SFX as requested
const SFX_DATA = {
    // Soft Tap (Low frequency, short decay) - For general UI clicks
    click: "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAAAAAgICAgIAAAACAAIA=",
    // Very Soft Air/Bubble Pop - For Hover
    hover: "data:audio/wav;base64,UklGRjoAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4AAACAgICAgICAAAAAgIA=",
    // Gentle Chime - For progress/success
    progress: "data:audio/wav;base64,UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAEA//8AAP//AAAA//8AAAD//wAA",
    // Soft Confirm
    confirm: "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAAAAAgICAgIAAAACAAIA="
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
    const [deletedSavesStack, setDeletedSavesStack] = useState<SavedGame[][]>([]); // Undo stack

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
    const [textModelProvider, setTextModelProvider] = useState<TextModelProvider>('gemini');
    const [aiModel, setAiModel] = useState<string>('gemini-2.5-pro');
    const [imageModel, setImageModel] = useState<ImageModel>('gemini-2.5-flash-image-preview');
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [customApiUrl, setCustomApiUrl] = useState('');
    const [customApiKey, setCustomApiKey] = useState('');
    const [availableCustomModels, setAvailableCustomModels] = useState<string[]>([]);
    const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>('anime');
    const [customAvatarStyle, setCustomAvatarStyle] = useState('');
    const [avatarRefImage, setAvatarRefImage] = useState('');
    const [backgroundStyle, setBackgroundStyle] = useState<'anime'|'realistic'>('anime');
    const [inputMode, setInputMode] = useState<InputMode>('choice');
    const [modelScopeApiKey, setModelScopeApiKey] = useState('');
    const [modelScopeApiUrl, setModelScopeApiUrl] = useState('https://modelscope.cn/api/v1');
    const [customPrompt, setCustomPrompt] = useState(DEFAULT_WRITING_RULES);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0.4); // Lower default volume
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
    const [lastAutoSaveId, setLastAutoSaveId] = useState<string | null>(null);
    
    // --- State: Image Gen Modal ---
    const [selectedImageStyle, setSelectedImageStyle] = useState<string>('anime');
    const [customImageStyle, setCustomImageStyle] = useState<string>('');

    // --- Refs ---
    const abortControllerRef = useRef<AbortController | null>(null);
    const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    
    // Audio Refs
    const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
    const currentTrackUrlRef = useRef<string | null>(null);
    const latestContextRef = useRef(context);
    // BGM Bug Fix: Ref to track current GameState inside audio callbacks
    const gameStateRef = useRef(gameState);

    // --- Sound Effects Logic ---
    const soundsRef = useRef<Record<string, HTMLAudioElement>>({});

    useEffect(() => {
        soundsRef.current = {
            click: new Audio(SFX_DATA.click),
            hover: new Audio(SFX_DATA.hover),
            progress: new Audio(SFX_DATA.progress),
            confirm: new Audio(SFX_DATA.confirm),
        };
        // Pre-load and set gentle volume
        Object.values(soundsRef.current).forEach(audio => {
            audio.load();
            // SFX volume relative to master, but generally softer
            audio.volume = Math.min(volume * 0.8, 1); 
        });
    }, [volume]);

    const playSound = useCallback((type: keyof typeof SFX_DATA) => {
        if (isMuted || volume === 0) return;
        
        const sound = soundsRef.current[type];
        if (sound) {
            const clone = sound.cloneNode() as HTMLAudioElement;
            clone.volume = Math.min(volume * 0.8, 1); 
            clone.play().catch(() => {});
        }
    }, [isMuted, volume]);

    const playClickSound = useCallback(() => playSound('click'), [playSound]);
    const playHoverSound = useCallback(() => playSound('hover'), [playSound]);
    const playProgressSound = useCallback(() => playSound('progress'), [playSound]);
    const playConfirmSound = useCallback(() => playSound('confirm'), [playSound]);

    // --- Initialization ---
    useEffect(() => {
        const init = async () => {
            // Load settings from localStorage
            const loadedSettings = localStorage.getItem('protagonist_settings');
            if (loadedSettings) {
                const s = JSON.parse(loadedSettings);
                setTextModelProvider(s.textModelProvider || 'gemini');
                setAiModel(s.aiModel || 'gemini-2.5-pro');
                setImageModel(s.imageModel || 'gemini-2.5-flash-image-preview');
                setGeminiApiKey(s.geminiApiKey || '');
                setCustomApiUrl(s.customApiUrl || '');
                setCustomApiKey(s.customApiKey || '');
                setAvatarStyle(s.avatarStyle || 'anime');
                setBackgroundStyle(s.backgroundStyle || 'anime');
                if (s.volume !== undefined) setVolume(s.volume);
                if (s.isMuted !== undefined) setIsMuted(s.isMuted);
                if (s.modelScopeApiKey !== undefined) setModelScopeApiKey(s.modelScopeApiKey);
                if (s.modelScopeApiUrl !== undefined) setModelScopeApiUrl(s.modelScopeApiUrl);
                // Load other settings...
                if (s.customPrompt !== undefined) setCustomPrompt(s.customPrompt);
                if (s.showStoryPanelBackground !== undefined) setShowStoryPanelBackground(s.showStoryPanelBackground);
                if (s.autoSaveGallery !== undefined) setAutoSaveGallery(s.autoSaveGallery);
            }

            await StorageService.migrateFromLocalStorage();

            try {
                const saves = await StorageService.getAllSaves();
                saves.sort((a, b) => b.timestamp - a.timestamp);
                setSavedGames(saves);

                const galleryItems = await StorageService.getAllGallery();
                galleryItems.sort((a, b) => b.timestamp - a.timestamp);
                setGallery(galleryItems);
            } catch (e) {
                console.error("Failed to load data from storage", e);
                setError("无法加载存档数据，请检查浏览器存储权限");
            }
        };

        init();
        setBgImage(getRandomBackground(backgroundStyle));
    }, []);

    // Save Settings Effect
    useEffect(() => {
        localStorage.setItem('protagonist_settings', JSON.stringify({
            textModelProvider, aiModel, imageModel, geminiApiKey, customApiUrl, customApiKey,
            avatarStyle, backgroundStyle, volume, isMuted, showStoryPanelBackground, autoSaveGallery,
            modelScopeApiKey, modelScopeApiUrl, customPrompt
        }));
    }, [textModelProvider, aiModel, imageModel, geminiApiKey, customApiUrl, customApiKey, avatarStyle, backgroundStyle, volume, isMuted, showStoryPanelBackground, autoSaveGallery, modelScopeApiKey, modelScopeApiUrl, customPrompt]);

    // Update Refs for Audio Callbacks
    useEffect(() => { latestContextRef.current = context; }, [context]);
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

    // --- BGM Logic (Refactored) ---
    const playRandomTrack = useCallback((mood: StoryMood) => {
        // BGM Bug Fix: Strictly check state before playing new track
        if (gameStateRef.current !== GameState.PLAYING) return;

        if (!bgmAudioRef.current) return;
        const playlist = EXTENDED_PLAYLISTS[mood] || EXTENDED_PLAYLISTS[StoryMood.PEACEFUL];
        let availableTracks = playlist.filter(t => t !== currentTrackUrlRef.current);
        
        // If playlist only has 1 track or we filtered everything out, reset
        if (availableTracks.length === 0) availableTracks = playlist;
        
        const randomTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
        currentTrackUrlRef.current = randomTrack;
        
        bgmAudioRef.current.src = randomTrack;
        bgmAudioRef.current.play().catch(e => console.log("Audio play failed (interaction needed?):", e));
    }, []);

    useEffect(() => {
        // Initialize Audio Object once
        if (!bgmAudioRef.current) {
            bgmAudioRef.current = new Audio();
            bgmAudioRef.current.loop = false; // We handle looping manually via playlist
            bgmAudioRef.current.preload = 'auto';
            bgmAudioRef.current.crossOrigin = "anonymous";
            
            // Auto-play next track when ended
            bgmAudioRef.current.addEventListener('ended', () => {
                // Ensure we are still playing before starting next track
                if (gameStateRef.current !== GameState.PLAYING) return;
                
                const currentMood = latestContextRef.current.currentSegment?.mood || StoryMood.PEACEFUL;
                playRandomTrack(currentMood);
            });
            
            // Handle loading errors by skipping track
            bgmAudioRef.current.addEventListener('error', (e) => {
                if (gameStateRef.current !== GameState.PLAYING) return;
                console.warn("Audio error, skipping track", e);
                const currentMood = latestContextRef.current.currentSegment?.mood || StoryMood.PEACEFUL;
                playRandomTrack(currentMood);
            });
        }
        
        const audio = bgmAudioRef.current;
        // BGM volume is slightly lower than master volume to allow SFX to pop
        audio.volume = isMuted ? 0 : volume * 0.6;

        // Play music ONLY in PLAYING state (Game Main Interface)
        if (gameState === GameState.PLAYING) {
             const currentMood = context.currentSegment?.mood || StoryMood.PEACEFUL;
             const playlist = EXTENDED_PLAYLISTS[currentMood] || EXTENDED_PLAYLISTS[StoryMood.PEACEFUL];
             
             // Check if current track is valid for current mood
             const isCurrentTrackInMood = currentTrackUrlRef.current && playlist.includes(currentTrackUrlRef.current);
             
             // If track mismatch or stopped, play new
             if (!isCurrentTrackInMood || audio.paused) {
                 playRandomTrack(currentMood);
             }
        } else {
            // Pause in ALL other screens (Landing, Setup, Loading, LoadGame)
            audio.pause();
            // Reset track ref so it refreshes when entering game next time
            currentTrackUrlRef.current = null;
        }
        
    }, [gameState, context.currentSegment?.id, isMuted, volume, playRandomTrack]); 
    // ^ Key Fix: Added context.currentSegment?.id to dependency to ensure check runs on every new segment

    // --- Mood-based Visual Effects Trigger ---
    useEffect(() => {
        if (gameState === GameState.PLAYING && context.currentSegment) {
            const mood = context.currentSegment.mood;
            if (mood === StoryMood.BATTLE) {
                setBattleAnim('animate-shake');
                setTimeout(() => setBattleAnim(null), 500);
            } else if (mood === StoryMood.VICTORY) { 
                // Could trigger confetti or similar if available
            }
        }
    }, [context.currentSegment?.id]); // Trigger once per segment

    // --- Actions ---

    const toggleModal = (modal: string, show: boolean) => {
        setModals(prev => ({ ...prev, [modal]: show }));
    };

    const handleStartNewGameSetup = () => {
        playClickSound();
        setContext(DEFAULT_CONTEXT);
        setSetupTempData(null);
        setGameState(GameState.SETUP);
        setBgImage(getRandomBackground(backgroundStyle));
    };

    const handleSaveSetup = () => {
        playClickSound();
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
        
        StorageService.saveGame(save).catch(e => {
            console.error("Save setup failed", e);
            setError("保存失败: " + e.message);
        });

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
        StorageService.saveGalleryItem(newItem).catch(console.error);
    };

    const deleteFromGallery = (id: string) => {
        playClickSound();
        const newGallery = gallery.filter(i => i.id !== id);
        setGallery(newGallery);
        StorageService.deleteGalleryItem(id).catch(console.error);
    };

    const deleteSaveGame = (id: string) => {
        playClickSound();
        const saveToDelete = savedGames.find(s => s.id === id);
        if (saveToDelete) {
            setDeletedSavesStack(prev => [...prev, [saveToDelete]]); // Push to stack
            const newSaves = savedGames.filter(s => s.id !== id);
            setSavedGames(newSaves);
            StorageService.deleteGame(id).catch(console.error);
        }
    };

    const deleteSession = (sessionId: string) => {
        playClickSound();
        const sessionSaves = savedGames.filter(s => s.sessionId === sessionId);
        if (sessionSaves.length > 0) {
            setDeletedSavesStack(prev => [...prev, sessionSaves]); // Push all to stack
            const idsToDelete = sessionSaves.map(s => s.id);
            const newSaves = savedGames.filter(s => s.sessionId !== sessionId);
            setSavedGames(newSaves);
            StorageService.deleteGames(idsToDelete).catch(console.error);
        }
    };

    const handleUndoDelete = () => {
        if (deletedSavesStack.length === 0) return;
        const lastDeletedGroup = deletedSavesStack[deletedSavesStack.length - 1];
        setDeletedSavesStack(prev => prev.slice(0, -1));

        setSavedGames(prev => [...prev, ...lastDeletedGroup]); // Optimistic update
        StorageService.saveGames(lastDeletedGroup).catch(console.error); // Restore to DB
        playClickSound(); // Reuse sound
    };

    const importSaveGame = (saves: SavedGame | SavedGame[]) => {
        const toImport = Array.isArray(saves) ? saves : [saves];
        let count = 0;
        const newSaves = [...savedGames];
        const savesToAdd: SavedGame[] = [];

        toImport.forEach(s => {
            if (!newSaves.some(exist => exist.id === s.id)) {
                newSaves.push(s);
                savesToAdd.push(s);
                count++;
            }
        });
        
        if (count > 0) {
            setSavedGames(newSaves);
            StorageService.saveGames(savesToAdd).catch(console.error);
        }
        return count;
    };

    const handleLoadGame = (save: SavedGame, forceSetup = false) => {
        playClickSound();
        const safeContext = {
            ...save.context,
            scheduledEvents: save.context.scheduledEvents || [],
            plotBlueprint: save.context.plotBlueprint || []
        };

        setContext(safeContext);
        
        // Smart Background Resolution to prevent Black Screen Flash
        let resolvedBg = save.context.currentSegment?.backgroundImage;
        if (!resolvedBg && save.context.history && save.context.history.length > 0) {
             // If current segment has no BG (e.g. text only update), traverse back to find last valid one
             for (let i = save.context.history.length - 1; i >= 0; i--) {
                 if (save.context.history[i].backgroundImage) {
                     resolvedBg = save.context.history[i].backgroundImage;
                     break;
                 }
             }
        }
        if (resolvedBg) {
            setBgImage(resolvedBg);
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

    // ... (autoPlanBlueprint, handleStartGame, etc. remain the same) ...
    const handleAutoPlanBlueprint = async (config?: { chapterCount: number, wordCountRange: [number, number], newCharCount: number, newOrgCount: number, customGuidance?: string }) => {
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
                context.supportingCharacters, 
                context.plotBlueprint || [], 
                config, 
                context.narrativeMode, 
                context.narrativeTechnique,
                geminiApiKey 
            );
            
            const mappedNewChars: SupportingCharacter[] = newCharacters.map((nc: any) => {
                const randomAffinity = Math.floor(Math.random() * 21) - 10; 
                let archetype = nc.archetype;
                let archetypeDesc = nc.archetypeDescription;

                if (nc.category === 'other' || nc.gender === 'organization') {
                    archetype = undefined;
                    archetypeDesc = undefined;
                } else {
                    const isValidArchetype = CHARACTER_ARCHETYPES.some(a => a.name === archetype);
                    if (!isValidArchetype) {
                        const randomArchetypeObj = CHARACTER_ARCHETYPES[Math.floor(Math.random() * CHARACTER_ARCHETYPES.length)];
                        archetype = randomArchetypeObj.name;
                        if (!archetypeDesc) {
                            archetypeDesc = randomArchetypeObj.description;
                        }
                    } else if (!archetypeDesc) {
                        const found = CHARACTER_ARCHETYPES.find(a => a.name === archetype);
                        if (found) archetypeDesc = found.description;
                    }
                }

                return {
                    id: generateUUID(),
                    name: nc.name,
                    role: nc.role,
                    gender: nc.gender || 'other',
                    category: nc.category || 'supporting',
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
                plotBlueprint: config && prev.plotBlueprint?.length > 0 ? [...prev.plotBlueprint, ...chapters] : chapters,
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
        
        // 1. Prepare initial state locally
        const newSessionId = context.sessionId || generateUUID();
        const initialBlueprint = context.plotBlueprint ? context.plotBlueprint.map((c, i) => i === 0 ? { ...c, status: 'active' as const } : c) : [];
        
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
                initialBlueprint,
                geminiApiKey
            );
            
            if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
            setLoadingProgress(prev => Math.max(prev, 40));
            
            const avatarPromise = GeminiService.generateCharacterAvatar(context.genre, context.character, avatarStyle, imageModel, customAvatarStyle, modelScopeApiKey, avatarRefImage, geminiApiKey);
            const sceneImagePromise = GeminiService.generateSceneImage(
                opening.visualPrompt + ", no humans, nobody, scenery only, landscape, architecture, environment", 
                ImageSize.SIZE_1K, 
                backgroundStyle, 
                "", 
                customAvatarStyle, 
                imageModel, 
                modelScopeApiKey, 
                ShotSize.EXTREME_LONG_SHOT, 
                undefined, 
                geminiApiKey,
                modelScopeApiUrl // Pass the URL here
            );
            
            const supportingCharPromises = context.supportingCharacters.map(async (sc) => { 
                if (sc.avatar) return sc; 
                try { 
                    const scAvatar = await GeminiService.generateCharacterAvatar(context.genre, sc, avatarStyle, imageModel, customAvatarStyle, modelScopeApiKey, avatarRefImage, geminiApiKey); 
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
            
            // CONSTRUCT FINAL CONTEXT
            const newContext: GameContext = { 
                ...context, 
                sessionId: newSessionId, 
                storyName: opening.storyName || context.storyName || "未命名故事", 
                character: { ...context.character, avatar: avatarBase64 }, 
                supportingCharacters: updatedSupportingChars, 
                history: [openingSegment], 
                currentSegment: openingSegment, 
                lastUpdated: Date.now(), 
                memories: opening.newMemories || DEFAULT_MEMORY,
                plotBlueprint: initialBlueprint, 
                scheduledEvents: context.scheduledEvents || []
            };
            
            // CONSTRUCT SAVE OBJECT FOR INITIAL NODE
            const saveObj: SavedGame = {
                id: generateUUID(),
                sessionId: newSessionId,
                storyName: newContext.storyName,
                storyId: openingSegment.id,
                parentId: undefined, 
                timestamp: Date.now(),
                genre: newContext.genre,
                characterName: newContext.character.name,
                summary: openingSegment.text.substring(0, 50) + "...",
                location: openingSegment.location,
                context: newContext,
                type: SaveType.AUTO,
                choiceText: "开启旅程",
                metaData: {
                    turnCount: 1,
                    totalSkillLevel: newContext.character.skills.reduce((acc, s) => acc + s.level, 0),
                }
            };
            
            // UPDATE STATES
            setContext(newContext);
            setGameState(GameState.PLAYING); 
            
            // PERSIST SAVE
            setSavedGames(prev => [saveObj, ...prev]);
            StorageService.saveGame(saveObj).catch(console.error);

            // TRIGGER NOTIFICATION
            setAutoSaveState('saving');
            setTimeout(() => setAutoSaveState('complete'), 1000);
            setTimeout(() => setAutoSaveState(null), 3000);

            playProgressSound();
        } catch (err: any) { 
            if (err.message === "Aborted") return; 
            if (progressTimerRef.current) clearInterval(progressTimerRef.current); 
            setGameState(GameState.SETUP); 
            setError(err.message || "AI响应异常，请重试。"); 
        }
    };

    const handleChoice = async (choice: string, fromIndex?: number) => {
        playConfirmSound();
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
                'full',
                geminiApiKey
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
            
            const segmentWithChoice = { ...nextSegment, causedBy: choice };

            // Visual/Sound Effects for Affinity (Kept logic but removed playBeep to preserve non-online audio)
            const affinityUpdates = nextSegment.affinityChanges || {};
            const hasMajorPositiveBond = Object.values(affinityUpdates).some(val => val >= 3);
            const hasMajorNegativeBond = Object.values(affinityUpdates).some(val => val <= -3);
            
            if (hasMajorPositiveBond) { 
                setVisualEffect('heal'); 
                playProgressSound(); // Use existing sound
            } else if (hasMajorNegativeBond) { 
                setVisualEffect('darkness'); 
                // No specific sound mapping for negative in standard set, skip sound
            }

            // --- Updated State Management & Auto-Save Logic (Sequential Execution) ---
            const newContext: GameContext = {
                ...context, 
                history: [...history, segmentWithChoice],
                currentSegment: segmentWithChoice,
                supportingCharacters: updatedSupportingChars,
                memories: nextSegment.newMemories || context.memories,
                scheduledEvents: updatedEvents,
                lastUpdated: Date.now(),
                // Safety fallback for sessionId
                sessionId: context.sessionId || generateUUID() 
            };

            // 1. Prepare Save Object synchronously with the new context data
            let saveObj: SavedGame | null = null;
            if (newContext.currentSegment) {
                saveObj = {
                    id: generateUUID(),
                    sessionId: newContext.sessionId,
                    storyName: newContext.storyName,
                    storyId: newContext.currentSegment.id,
                    parentId: history.length > 0 ? history[history.length - 1].id : undefined,
                    timestamp: Date.now(),
                    genre: newContext.genre,
                    characterName: newContext.character.name,
                    summary: newContext.currentSegment.text.substring(0, 50) + "...",
                    location: newContext.currentSegment.location,
                    context: newContext,
                    type: SaveType.AUTO,
                    choiceText: choice,
                    metaData: {
                        turnCount: newContext.history.length,
                        totalSkillLevel: newContext.character.skills.reduce((acc, s) => acc + s.level, 0),
                    }
                };
            }

            // 2. Update React State for Game Context
            setContext(newContext);

            // 3. Persist Save (DB & State)
            if (saveObj) {
                const finalSaveObj = saveObj; // Capture for closure
                // Ensure state update happens
                setSavedGames(prevSaves => {
                    const alreadySaved = prevSaves.some(s => s.storyId === finalSaveObj.storyId && s.sessionId === finalSaveObj.sessionId);
                    if (alreadySaved) return prevSaves;
                    return [finalSaveObj, ...prevSaves];
                });

                setLastAutoSaveId(finalSaveObj.storyId || null);

                // Persist to Storage asynchronously
                StorageService.saveGame(finalSaveObj).catch(e => {
                    console.error("Auto-save persisted failure", e);
                });

                // Trigger UI Notification
                setAutoSaveState('saving');
                setTimeout(() => setAutoSaveState('complete'), 1000);
                setTimeout(() => setAutoSaveState(null), 3000);
            }
            
            playProgressSound();

        } catch (e) {
            console.error(e);
            setError("推进剧情失败");
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualSave = () => {
        playClickSound();
        if (!context.currentSegment) return;

        const alreadySaved = savedGames.some(s => 
            s.sessionId === context.sessionId && 
            s.storyId === context.currentSegment?.id
        );

        if (alreadySaved) {
            toggleModal('saveExistingNotification', true);
            setTimeout(() => toggleModal('saveExistingNotification', false), 2000);
            return; 
        }

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
            choiceText: context.currentSegment.causedBy,
            metaData: {
                turnCount: context.history.length,
                totalSkillLevel: context.character.skills.reduce((acc, s) => acc + s.level, 0),
            }
        };
        const newSaves = [save, ...savedGames];
        setSavedGames(newSaves);
        
        StorageService.saveGame(save).catch(e => {
            console.error("Save failed", e);
            setError("存档失败，可能是存储空间已满");
        });

        toggleModal('saveNotification', true);
        setTimeout(() => toggleModal('saveNotification', false), 2000);
    };

    const handleBackToHome = () => {
        playClickSound();
        setGameState(GameState.LANDING);
    };

    // Update segment text manually
    const handleUpdateSegmentText = (segmentId: string, newText: string) => {
        setContext(prev => {
            const newHistory = prev.history.map(seg => 
                seg.id === segmentId ? { ...seg, text: newText } : seg
            );
            
            // Also sync current segment if valid
            const newCurrent = prev.currentSegment?.id === segmentId 
                ? { ...prev.currentSegment, text: newText } 
                : prev.currentSegment;

            return {
                ...prev,
                history: newHistory,
                currentSegment: newCurrent,
                lastUpdated: Date.now()
            };
        });
        
        // Also update save if needed (Optional: auto-save on edit?)
        // For now, we update in-memory context only.
    };

    const handleGenerateImage = () => {
        if (!context.currentSegment) return;
        playClickSound();
        setGeneratingImage(true);
        GeminiService.generateSceneImage(
            context.currentSegment.visualPrompt, 
            ImageSize.SIZE_1K, 
            selectedImageStyle, 
            "", 
            customImageStyle, 
            imageModel, 
            modelScopeApiKey,
            undefined,
            undefined,
            geminiApiKey,
            modelScopeApiUrl // Pass the URL here
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
        GeminiService.generateCharacterAvatar(context.genre, char as any, selectedImageStyle, imageModel, customImageStyle, modelScopeApiKey, avatarRefImage, geminiApiKey)
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

    // Placeholders for features handled by UI components but passed to GameScreen
    const handleUseSkill = (skill: any) => {};
    const handleSummarizeMemory = async () => {
        playClickSound();
        if (context.history.length < 2) return;
        setIsSummarizing(true);
        try {
            const summary = await GeminiService.summarizeHistory(context.history, aiModel, geminiApiKey);
            setContext(prev => ({ ...prev, memories: { ...prev.memories, storyMemory: summary } }));
            playProgressSound();
        } catch(e) { console.error("Summarize failed", e); } finally { setIsSummarizing(false); }
    };
    
    const handleRegenerate = async (mode: 'full' | 'text' | 'choices') => {
        playClickSound();
        const lastIdx = context.history.length - 1;
        if (lastIdx < 0) return;
        const lastSegment = context.history[lastIdx];
        
        if (mode !== 'choices' && lastIdx > 0 && !lastSegment.causedBy) { setError("无法重新生成此节点"); return; }
        
        setIsLoading(true);
        setError(null);
        
        try {
            let newSegment: StorySegment;
            if (mode === 'choices') {
                const historyContext = context.history; 
                newSegment = await GeminiService.advanceStory(
                    historyContext, "", context.genre, context.character, context.supportingCharacters, context.worldSettings, context.memories, aiModel, context.customGenre, customPrompt, context.scheduledEvents || [], context.narrativeMode, context.narrativeTechnique, context.plotBlueprint, 'choices', geminiApiKey
                );
                setContext(prev => {
                    const history = [...prev.history];
                    history[lastIdx] = { ...history[lastIdx], choices: newSegment.choices };
                    return { ...prev, history, currentSegment: history[lastIdx], lastUpdated: Date.now() };
                });
            } else {
                const historyContext = context.history.slice(0, lastIdx);
                const causedBy = lastSegment.causedBy || "";
                newSegment = await GeminiService.advanceStory(
                    historyContext, causedBy, context.genre, context.character, context.supportingCharacters, context.worldSettings, context.memories, aiModel, context.customGenre, customPrompt, context.scheduledEvents || [], context.narrativeMode, context.narrativeTechnique, context.plotBlueprint, mode, geminiApiKey
                );
                newSegment.causedBy = causedBy;
                
                setContext(prev => {
                    const history = [...prev.history];
                    const currentSeg = { ...history[lastIdx] };
                    if (!currentSeg.versions) { currentSeg.versions = [{ text: currentSeg.text, choices: currentSeg.choices, visualPrompt: currentSeg.visualPrompt, mood: currentSeg.mood }]; currentSeg.currentVersionIndex = 0; }
                    const newVersion = { text: newSegment.text, choices: newSegment.choices, visualPrompt: newSegment.visualPrompt, mood: newSegment.mood, location: newSegment.location };
                    currentSeg.versions.push(newVersion);
                    const newIdx = currentSeg.versions.length - 1;
                    currentSeg.currentVersionIndex = newIdx;
                    // Update fields
                    currentSeg.text = newVersion.text; currentSeg.choices = newVersion.choices; currentSeg.visualPrompt = newVersion.visualPrompt; currentSeg.mood = newVersion.mood; currentSeg.location = newVersion.location;
                    history[lastIdx] = currentSeg;
                    return { ...prev, history, currentSegment: currentSeg, memories: newSegment.newMemories || prev.memories, lastUpdated: Date.now() };
                });
            }
            playProgressSound();
        } catch (e) { console.error("Regenerate failed", e); setError("重新生成失败"); } finally { setIsLoading(false); }
    };

    const handleSwitchVersion = (segmentId: string, direction: 'prev' | 'next') => {
        playClickSound();
        setContext(prev => {
            const history = [...prev.history];
            const idx = history.findIndex(h => h.id === segmentId);
            if (idx === -1) return prev;
            const seg = { ...history[idx] };
            if (!seg.versions || seg.versions.length < 2) return prev;
            let newIdx = (seg.currentVersionIndex || 0) + (direction === 'next' ? 1 : -1);
            if (newIdx < 0) newIdx = seg.versions.length - 1;
            if (newIdx >= seg.versions.length) newIdx = 0;
            if (newIdx === seg.currentVersionIndex) return prev;
            const v = seg.versions[newIdx];
            seg.currentVersionIndex = newIdx;
            seg.text = v.text; seg.choices = v.choices; seg.visualPrompt = v.visualPrompt; seg.mood = v.mood; seg.location = v.location;
            history[idx] = seg;
            const isCurrent = prev.currentSegment?.id === segmentId;
            return { ...prev, history, currentSegment: isCurrent ? seg : prev.currentSegment, lastUpdated: Date.now() };
        });
    };

    const handleGlobalReplace = (findText: string, replaceText: string): number => {
        if (!findText || !replaceText) return 0;
        const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapeRegExp(findText), 'g');
        let count = 0;
        const countIn = (s: string | undefined) => s ? (s.match(regex) || []).length : 0;
        
        // Check memories
        Object.values(context.memories).forEach(val => { if (typeof val === 'string') count += countIn(val); });
        
        // Check history (last 5)
        const limit = 5;
        const startIndex = Math.max(0, context.history.length - limit);
        for (let i = startIndex; i < context.history.length; i++) {
            const seg = context.history[i];
            count += countIn(seg.text);
            seg.choices.forEach(c => count += countIn(c));
        }
        
        if (count === 0) return 0;
        
        setContext(prev => {
            const newMemories = { ...prev.memories };
            (Object.keys(newMemories) as (keyof MemoryState)[]).forEach(k => { if (typeof newMemories[k] === 'string') newMemories[k] = newMemories[k].replace(regex, replaceText); });
            const newHistory = [...prev.history];
            const start = Math.max(0, newHistory.length - limit);
            for (let i = start; i < newHistory.length; i++) {
                let updatedText = newHistory[i].text.replace(regex, replaceText);
                let updatedChoices = newHistory[i].choices.map(c => c.replace(regex, replaceText));
                newHistory[i] = { ...newHistory[i], text: updatedText, choices: updatedChoices };
            }
            let newCurrent = prev.currentSegment ? { ...prev.currentSegment } : null;
            if (newCurrent) {
                newCurrent.text = newCurrent.text.replace(regex, replaceText);
                newCurrent.choices = newCurrent.choices.map(c => c.replace(regex, replaceText));
            }
            return { ...prev, memories: newMemories, history: newHistory, currentSegment: newCurrent, lastUpdated: Date.now() };
        });
        return count;
    };

    const handleAddScheduledEvent = (event: Omit<ScheduledEvent, 'id' | 'createdTurn' | 'status'>) => {
        const newEvent: ScheduledEvent = { ...event, id: generateUUID(), createdTurn: context.history.length, status: 'pending' };
        setContext(prev => ({ ...prev, scheduledEvents: [...(prev.scheduledEvents || []), newEvent] }));
        playConfirmSound();
    };

    const handleUpdateScheduledEvent = (updatedEvent: ScheduledEvent) => {
        setContext(prev => ({ ...prev, scheduledEvents: (prev.scheduledEvents || []).map(e => e.id === updatedEvent.id ? updatedEvent : e) }));
        playConfirmSound();
    };

    const handleDeleteScheduledEvent = (id: string) => {
        setContext(prev => ({ ...prev, scheduledEvents: (prev.scheduledEvents || []).filter(e => e.id !== id) }));
        playClickSound();
    };

    const toggleCurrentBgFavorite = () => {
        playClickSound();
        if (isCurrentBgFavorited) {
            const item = gallery.find(i => i.base64 === bgImage);
            if (item) deleteFromGallery(item.id);
        } else {
            const prompt = context.currentSegment?.visualPrompt || context.currentSegment?.text || "Saved Moment";
            addToGallery(bgImage, prompt, backgroundStyle);
        }
        setIsCurrentBgFavorited(!isCurrentBgFavorited);
    };

    const handleUpgradeSkill = (skillId: string) => {
        setContext(prev => ({ ...prev, character: { ...prev.character, skills: prev.character.skills.map(s => s.id === skillId ? { ...s, level: (s.level || 1) + 1 } : s ) } }));
        playProgressSound();
    };

    // Settings Setters
    const handleSetTextModelProvider = (p: TextModelProvider) => setTextModelProvider(p);
    const handleSetAiModel = (m: string) => setAiModel(m);
    const handleSetImageModel = (m: ImageModel) => setImageModel(m);
    const handleSetCustomApiUrl = (s: string) => setCustomApiUrl(s);
    const handleSetCustomApiKey = (s: string) => setCustomApiKey(s);
    const handleSetGeminiApiKey = (s: string) => setGeminiApiKey(s);
    const handleSetAvatarStyle = (s: AvatarStyle) => setAvatarStyle(s);
    const handleSetCustomAvatarStyle = (s: string) => setCustomAvatarStyle(s);
    const handleSetAvatarRefImage = (s: string) => setAvatarRefImage(s);
    const handleSetBackgroundStyle = (s: any) => setBackgroundStyle(s);
    const handleSetInputMode = (m: InputMode) => setInputMode(m);
    const handleSetModelScopeApiKey = (k: string) => setModelScopeApiKey(k);
    const handleSetModelScopeApiUrl = (u: string) => setModelScopeApiUrl(u);
    const handleSetCustomPrompt = (s: string) => setCustomPrompt(s);
    const handleSetShowStoryPanelBackground = (b: boolean) => setShowStoryPanelBackground(b);
    const handleSetHistoryFontSize = (n: number) => setHistoryFontSize(n);
    const handleSetStoryFontSize = (n: number) => setStoryFontSize(n);
    const handleSetStoryFontFamily = (s: string) => setStoryFontFamily(s);
    const handleSetAutoSaveGallery = (b: boolean) => setAutoSaveGallery(b);
    const handleTestModelScope = async (key: string) => GeminiService.validateModelScopeConnection(key, modelScopeApiUrl);
    const handleTestGeminiConnection = async (key: string) => GeminiService.validateGeminiConnection(key);
    const handleTestCustomConnection = async (url: string, key: string) => {
        try {
            const models = await GeminiService.fetchOpenAICompatibleModels(url, key);
            setAvailableCustomModels(models);
            if (models.length > 0 && (textModelProvider === 'gemini' || !availableCustomModels.includes(aiModel))) {
                setAiModel(models[0]);
            }
            return `连接成功, 找到 ${models.length} 个模型。`;
        } catch (e) {
            setAvailableCustomModels([]);
            throw e;
        }
    };

    return {
        gameState, setGameState,
        context, setContext,
        bgImage, setBgImage,
        isLoading, loadingProgress, error,
        modals, toggleModal,
        savedGames, handleLoadGame, deleteSaveGame, deleteSession, importSaveGame, handleUndoDelete, deletedSavesStack,
        gallery, viewingImage, setViewingImage, deleteFromGallery,
        textModelProvider, handleSetTextModelProvider,
        aiModel, handleSetAiModel,
        imageModel, handleSetImageModel,
        geminiApiKey, handleSetGeminiApiKey,
        customApiUrl, handleSetCustomApiUrl,
        customApiKey, handleSetCustomApiKey,
        availableCustomModels,
        setAvailableCustomModels,
        handleTestCustomConnection,
        avatarStyle, handleSetAvatarStyle,
        customAvatarStyle, handleSetCustomAvatarStyle,
        avatarRefImage, handleSetAvatarRefImage,
        backgroundStyle, handleSetBackgroundStyle,
        inputMode, handleSetInputMode,
        modelScopeApiKey, handleSetModelScopeApiKey, handleTestModelScope,
        modelScopeApiUrl, handleSetModelScopeApiUrl,
        customPrompt, handleSetCustomPrompt,
        isMuted, setIsMuted, volume, setVolume,
        showStoryPanelBackground, handleSetShowStoryPanelBackground,
        historyFontSize, handleSetHistoryFontSize,
        storyFontSize, handleSetStoryFontSize,
        storyFontFamily, handleSetStoryFontFamily,
        autoSaveGallery, handleSetAutoSaveGallery,
        playClickSound, playHoverSound, playConfirmSound, playProgressSound,
        setupTempData, setSetupTempData,
        handleStartNewGameSetup, handleStartGame, handleSaveSetup, handleAutoPlanBlueprint, handleAbortGame,
        handleBackToHome, handleManualSave, handleChoice, handleUseSkill, handleSummarizeMemory,
        handleRegenerate, handleSwitchVersion, handleGlobalReplace, handleUpdateSegmentText,
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
        handleUpgradeSkill,
        handleTestGeminiConnection
    };
};
