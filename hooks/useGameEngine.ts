
import { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, StoryGenre, GameContext, StorySegment, ImageSize, SavedGame, StoryMood, generateUUID, SaveType, Skill, AvatarStyle, BackgroundStyle, GalleryItem, MOOD_LABELS, InputMode, MemoryState, ImageModel, SupportingCharacter, VisualEffectType, ShotSize, ScheduledEvent } from '../types';
import * as GeminiService from '../services/geminiService';
import { getRandomBackground, getSmartBackground } from '../components/SmoothBackground';

// --- Extended Audio Library (Royalty Free / Demo Assets) ---
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

const DEFAULT_MEMORY: MemoryState = {
    memoryZone: "",
    storyMemory: "",
    longTermMemory: "",
    coreMemory: "",
    characterRecord: "",
    inventory: "暂无物品" // Default inventory
};

const DEFAULT_CUSTOM_PROMPT = "请始终保持小说叙述风格，熟练运用“五感写作法”（视觉、听觉、嗅觉、触觉、味觉）和“冰山理论写法”（只描写行动和感官细节，避免直接描写情绪和说教）。采用简洁、自然的口语化表达，使整体叙事更符合现代汉语习惯。多加入人物对话和心理刻画，减少华丽辞藻和纯粹的叙述。避免过于直白的系统提示音，将系统机制自然巧妙地融入世界观中。";

const getInitialContext = (): GameContext => ({
    sessionId: generateUUID(),
    storyName: '',
    genre: StoryGenre.XIANXIA,
    customGenre: '',
    character: { name: '', trait: '', gender: 'male', skills: [] },
    supportingCharacters: [],
    worldSettings: { isHarem: false, isAdult: false, hasSystem: false, tone: StoryMood.PEACEFUL },
    history: [],
    currentSegment: null,
    lastUpdated: Date.now(),
    memories: JSON.parse(JSON.stringify(DEFAULT_MEMORY)),
    narrativeMode: 'auto',
    narrativeTechnique: 'auto',
    scheduledEvents: [] // Initial empty list
});

export const useGameEngine = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>(GameState.LANDING);
  const [context, setContext] = useState<GameContext>(getInitialContext());

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Modals State
  const [modals, setModals] = useState({
      image: false,
      load: false,
      history: false,
      exitConfirm: false,
      skill: false,
      character: false,
      regenConfirm: false,
      settings: false,
      gallery: false,
      saveNotification: false
  });
  
  // Settings State
  const [aiModel, setAiModel] = useState<string>('gemini-2.5-pro');
  const [imageModel, setImageModel] = useState<ImageModel>('gemini-2.5-flash-image-preview');
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>('anime');
  const [customAvatarStyle, setCustomAvatarStyle] = useState<string>('');
  const [backgroundStyle, setBackgroundStyle] = useState<BackgroundStyle>('anime');
  const [inputMode, setInputMode] = useState<InputMode>('choice');
  const [modelScopeApiKey, setModelScopeApiKey] = useState<string>('');
  const [avatarRefImage, setAvatarRefImage] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>(DEFAULT_CUSTOM_PROMPT);
  const [showStoryPanelBackground, setShowStoryPanelBackground] = useState(true);
  const [historyFontSize, setHistoryFontSize] = useState<number>(15);
  const [storyFontSize, setStoryFontSize] = useState<number>(18);
  const [storyFontFamily, setStoryFontFamily] = useState<string>("'Noto Serif SC', serif");
  const [autoSaveGallery, setAutoSaveGallery] = useState(false);

  // Image Generation State
  const [selectedImageStyle, setSelectedImageStyle] = useState<string>('anime');
  const [customImageStyle, setCustomImageStyle] = useState<string>('');

  // Gallery State
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [viewingImage, setViewingImage] = useState<GalleryItem | null>(null);

  // Load Game Preview State
  const [previewSaveId, setPreviewSaveId] = useState<string | null>(null);
  const [currentLoadedSaveId, setCurrentLoadedSaveId] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  // Save & Dirty State Logic
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [lastSavedTime, setLastSavedTime] = useState<number>(0);
  const [autoSaveState, setAutoSaveState] = useState<'saving' | 'complete' | null>(null);
  const [lastAutoSaveId, setLastAutoSaveId] = useState<string | null>(null);

  const [generatingImage, setGeneratingImage] = useState(false);
  const [bgImage, setBgImage] = useState<string>("");
  const [textTypingComplete, setTextTypingComplete] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState<number>(30); 
  const [isUiVisible, setIsUiVisible] = useState(true);
  
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.4);

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [visualEffect, setVisualEffect] = useState<VisualEffectType>('none');
  
  const [setupTempData, setSetupTempData] = useState({
      skill: { name: '', description: '' }
  });

  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackUrlRef = useRef<string | null>(null);
  const latestContextRef = useRef(context);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [battleAnim, setBattleAnim] = useState<string | null>(null);

  const toggleModal = (modalName: keyof typeof modals, value: boolean) => {
      setModals(prev => ({ ...prev, [modalName]: value }));
  };

  const playBeep = (freq = 440, duration = 0.1, type: OscillatorType = 'sine') => {
    if (isMuted || volume <= 0) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      const effectiveVolume = volume * 0.5;
      gain.gain.setValueAtTime(effectiveVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
      osc.stop(ctx.currentTime + duration);
    } catch (e) { console.warn('Audio playback failed', e); }
  };

  const playClickSound = () => playBeep(600, 0.05, 'triangle');
  const playHoverSound = () => playBeep(800, 0.03, 'sine');
  const playProgressSound = () => playBeep(300, 0.3, 'sine');
  const playConfirmSound = () => playBeep(880, 0.1, 'square');

  // --- Effects ---
  useEffect(() => {
    // ... Load Logic ...
    let avatarDict: Record<string, string> = {};
    try {
        const storedAvatars = localStorage.getItem('protagonist_avatars');
        if (storedAvatars) avatarDict = JSON.parse(storedAvatars);
    } catch (e) { console.error(e); }

    const saves = localStorage.getItem('protagonist_saves');
    if (saves) {
        try { 
            const parsedSaves: SavedGame[] = JSON.parse(saves);
            const hydratedSaves = parsedSaves.map(s => {
                if (!s.context.character.avatar && avatarDict[s.sessionId]) {
                    s.context.character.avatar = avatarDict[s.sessionId];
                }
                if (!s.context.scheduledEvents) s.context.scheduledEvents = [];
                return s;
            });
            setSavedGames(hydratedSaves); 
        } catch (e) { console.error(e); }
    }
    
    // ... (Loading other settings) ...
    const savedModel = localStorage.getItem('protagonist_ai_model');
    if (savedModel) setAiModel(savedModel);
    const savedImageModel = localStorage.getItem('protagonist_image_model') as ImageModel;
    if (savedImageModel) setImageModel(savedImageModel);
    const savedAvatarStyle = localStorage.getItem('protagonist_avatar_style') as AvatarStyle;
    if (savedAvatarStyle) setAvatarStyle(savedAvatarStyle);
    const savedCustomAvatarStyle = localStorage.getItem('protagonist_custom_avatar_style');
    if (savedCustomAvatarStyle) setCustomAvatarStyle(savedCustomAvatarStyle);
    const savedAvatarRef = localStorage.getItem('protagonist_avatar_ref');
    if (savedAvatarRef) setAvatarRefImage(savedAvatarRef);
    const savedInputMode = localStorage.getItem('protagonist_input_mode') as InputMode;
    if (savedInputMode) setInputMode(savedInputMode);
    const savedModelScopeKey = localStorage.getItem('protagonist_modelscope_key');
    if (savedModelScopeKey) setModelScopeApiKey(savedModelScopeKey);
    const savedCustomPrompt = localStorage.getItem('protagonist_custom_prompt');
    if (savedCustomPrompt) setCustomPrompt(savedCustomPrompt);
    const savedShowStoryPanelBackground = localStorage.getItem('protagonist_show_panel_bg');
    if (savedShowStoryPanelBackground !== null) setShowStoryPanelBackground(savedShowStoryPanelBackground === 'true');
    const savedHistoryFS = localStorage.getItem('protagonist_history_font_size');
    if (savedHistoryFS) setHistoryFontSize(parseInt(savedHistoryFS));
    const savedStoryFS = localStorage.getItem('protagonist_story_font_size');
    if (savedStoryFS) setStoryFontSize(parseInt(savedStoryFS));
    const savedStoryFF = localStorage.getItem('protagonist_story_font_family');
    if (savedStoryFF) setStoryFontFamily(savedStoryFF);
    const savedGallery = localStorage.getItem('protagonist_gallery');
    if (savedGallery) try { setGallery(JSON.parse(savedGallery)); } catch (e) { }
    const savedBgStyle = localStorage.getItem('protagonist_bg_style') as BackgroundStyle;
    if (savedBgStyle) setBackgroundStyle(savedBgStyle);
    const savedAutoSaveGallery = localStorage.getItem('protagonist_auto_save_gallery');
    if (savedAutoSaveGallery !== null) setAutoSaveGallery(savedAutoSaveGallery === 'true');
  }, []);

  useEffect(() => {
      if (gameState === GameState.LANDING || gameState === GameState.SETUP) {
          if (!bgImage || bgImage.startsWith('data:image')) {
               setBgImage(getSmartBackground(StoryGenre.CUSTOM, StoryMood.PEACEFUL, backgroundStyle));
               setCurrentLoadedSaveId(null);
          }
      }
  }, [gameState, backgroundStyle, bgImage]);

  useEffect(() => { latestContextRef.current = context; }, [context]);

  // Save Logic
  const saveGameToStorage = useCallback((currentContext: GameContext, type: SaveType) => {
    const now = Date.now();
    setLastSavedTime(now);

    if (type === SaveType.MANUAL || type === SaveType.SETUP) {
        toggleModal('saveNotification', true);
        setTimeout(() => toggleModal('saveNotification', false), 2000);
    } else if (type === SaveType.AUTO) {
        setAutoSaveState('saving');
        if (currentContext.currentSegment?.id) {
             setLastAutoSaveId(currentContext.currentSegment.id);
        }
    }

    setTimeout(() => {
        const avatarToKeep = currentContext.character.avatar;
        if (avatarToKeep) {
            try {
                let avatars = {};
                const storedAvatars = localStorage.getItem('protagonist_avatars');
                if (storedAvatars) avatars = JSON.parse(storedAvatars);
                // @ts-ignore
                avatars[currentContext.sessionId] = avatarToKeep;
                localStorage.setItem('protagonist_avatars', JSON.stringify(avatars));
            } catch (e) { console.warn("Avatar storage failed", e); }
        }

        const contextToSave: GameContext = JSON.parse(JSON.stringify(currentContext));
        contextToSave.character.avatar = undefined;
        if (contextToSave.history) {
            contextToSave.history = contextToSave.history.map(h => ({
                ...h,
                backgroundImage: (h.backgroundImage && h.backgroundImage.length < 500) ? h.backgroundImage : undefined 
            }));
        }

        let highestAffinityNPC = undefined;
        if (currentContext.supportingCharacters.length > 0) {
            const bestNPC = [...currentContext.supportingCharacters].sort((a, b) => (b.affinity || 0) - (a.affinity || 0))[0];
            if (bestNPC) highestAffinityNPC = `${bestNPC.name} (♥${bestNPC.affinity || 0})`;
        }

        const totalSkillLevel = currentContext.character.skills.reduce((acc, s) => acc + s.level, 0);
        let locationName = currentContext.currentSegment?.location || "冒险旅途中";
        
        const newSave: SavedGame = {
            id: generateUUID(), 
            sessionId: currentContext.sessionId,
            storyName: currentContext.storyName,
            storyId: currentContext.currentSegment?.id,
            parentId: currentContext.history.length > 1 ? currentContext.history[currentContext.history.length - 2].id : undefined,
            timestamp: now,
            genre: currentContext.genre,
            characterName: currentContext.character.name,
            summary: currentContext.currentSegment?.text || (type === SaveType.SETUP ? "初始设定档案" : "New Game"),
            context: contextToSave,
            type: type,
            location: locationName,
            choiceLabel: (currentContext.lastChoiceIdx !== undefined && currentContext.lastChoiceIdx !== -1) ? (currentContext.lastChoiceIdx + 1).toString() : "",
            choiceText: currentContext.currentSegment?.causedBy ?? (currentContext.history.length >= 2 ? currentContext.history[currentContext.history.length - 2].choices[currentContext.lastChoiceIdx || 0] : ""),
            metaData: { highestAffinityNPC, totalSkillLevel, turnCount: currentContext.history.length }
        };

        if (avatarToKeep) newSave.context.character.avatar = avatarToKeep;

        setSavedGames(prev => {
            let newSaves = [...prev];
            let existingIndex = -1;
            existingIndex = newSaves.findIndex(s => s.sessionId === currentContext.sessionId && s.storyId === newSave.storyId);
            if (type === SaveType.SETUP) existingIndex = newSaves.findIndex(s => s.sessionId === currentContext.sessionId && s.type === SaveType.SETUP);
            if (existingIndex === -1 && currentLoadedSaveId) {
                const loadedSave = newSaves.find(s => s.id === currentLoadedSaveId);
                if (loadedSave && loadedSave.storyId === newSave.storyId) existingIndex = newSaves.findIndex(s => s.id === currentLoadedSaveId);
            }
            
            if (existingIndex !== -1) {
                const existingSave = newSaves[existingIndex];
                newSave.id = existingSave.id; 
                if (type === SaveType.MANUAL || type === SaveType.SETUP) {
                     newSaves[existingIndex] = newSave;
                     if (currentLoadedSaveId !== newSave.id) setCurrentLoadedSaveId(newSave.id);
                } else if (type === SaveType.AUTO) {
                     if (existingSave.type === SaveType.MANUAL) return prev;
                     else newSaves[existingIndex] = newSave;
                }
            } else {
                newSaves.unshift(newSave);
                if (type === SaveType.MANUAL || type === SaveType.SETUP) setCurrentLoadedSaveId(newSave.id);
            }

            let limitedSaves = newSaves.slice(0, 20); 
            const savesForStorage = limitedSaves.map(s => {
                if (s.context.character.avatar) return { ...s, context: { ...s.context, character: { ...s.context.character, avatar: undefined } } };
                return s;
            });
            try { localStorage.setItem('protagonist_saves', JSON.stringify(savesForStorage)); } catch (e) {}
            return limitedSaves;
        });

        if (type === SaveType.AUTO) {
            setAutoSaveState('complete');
            setTimeout(() => setAutoSaveState(null), 2000);
        }
    }, 0);
  }, [currentLoadedSaveId, bgImage, backgroundStyle]);

  // ... (Auto Save, Audio Effects, BGM Effects same as original) ...
  useEffect(() => {
    if (gameState === GameState.PLAYING && textTypingComplete && !isLoading) {
       if (context.currentSegment?.id && context.currentSegment.id === lastAutoSaveId) return;
       const autoSaveTimer = setTimeout(() => {
          const currentCtx = latestContextRef.current;
          if (currentCtx.sessionId && currentCtx.history.length > 0) {
              if (currentCtx.currentSegment?.id !== lastAutoSaveId) {
                  saveGameToStorage(currentCtx, SaveType.AUTO);
              }
          }
       }, 3000); 
       return () => clearTimeout(autoSaveTimer);
    }
  }, [textTypingComplete, gameState, isLoading, context.currentSegment?.id, lastAutoSaveId, saveGameToStorage]);

  useEffect(() => {
      if (gameState === GameState.PLAYING && context.currentSegment) {
          const mood = context.currentSegment.mood;
          if (mood === StoryMood.BATTLE) {
             setBattleAnim('animate-shake');
             playBeep(150, 0.3, 'sawtooth');
             setTimeout(() => setBattleAnim(null), 500);
          } else if (mood === StoryMood.TENSE) {
             playBeep(100, 0.5, 'square');
          } else if (mood === StoryMood.VICTORY) { 
             playBeep(600, 0.1, 'sine'); 
             setTimeout(() => playBeep(800, 0.2, 'sine'), 100); 
          }
      }
  }, [context.currentSegment?.id]);

  const playRandomTrack = useCallback((mood: StoryMood) => {
      if (!bgmAudioRef.current) return;
      const playlist = EXTENDED_PLAYLISTS[mood] || EXTENDED_PLAYLISTS[StoryMood.PEACEFUL];
      let availableTracks = playlist.filter(t => t !== currentTrackUrlRef.current);
      if (availableTracks.length === 0) availableTracks = playlist;
      const randomTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
      currentTrackUrlRef.current = randomTrack;
      bgmAudioRef.current.src = randomTrack;
      bgmAudioRef.current.play().catch(e => console.log("Audio play failed:", e));
  }, []);

  useEffect(() => {
    if (!bgmAudioRef.current) {
      bgmAudioRef.current = new Audio();
      bgmAudioRef.current.loop = false;
      bgmAudioRef.current.addEventListener('ended', () => {
           const currentMood = latestContextRef.current.currentSegment?.mood || StoryMood.PEACEFUL;
           playRandomTrack(currentMood);
      });
      bgmAudioRef.current.addEventListener('error', (e) => {
          const currentMood = latestContextRef.current.currentSegment?.mood || StoryMood.PEACEFUL;
          playRandomTrack(currentMood);
      });
    }
    const audio = bgmAudioRef.current;
    audio.volume = isMuted ? 0 : volume;

    if (gameState === GameState.PLAYING && context.currentSegment) {
      const currentMood = context.currentSegment.mood || StoryMood.PEACEFUL;
      const playlist = EXTENDED_PLAYLISTS[currentMood] || EXTENDED_PLAYLISTS[StoryMood.PEACEFUL];
      const isCurrentTrackInMood = currentTrackUrlRef.current && playlist.includes(currentTrackUrlRef.current);
      if (!isCurrentTrackInMood || audio.paused) {
          playRandomTrack(currentMood);
      }
    } else if (gameState === GameState.LANDING || gameState === GameState.LOAD_GAME) {
      audio.pause();
      currentTrackUrlRef.current = null;
    }
  }, [gameState, context.currentSegment?.id, isMuted, volume, playRandomTrack]);

  // --- Handlers ---

  const handleStartNewGameSetup = () => {
    playClickSound();
    setContext(getInitialContext());
    setSetupTempData({ skill: { name: '', description: '' } });
    setBgImage(getSmartBackground(StoryGenre.CUSTOM, StoryMood.PEACEFUL, 'anime'));
    setCurrentLoadedSaveId(null);
    setGameState(GameState.SETUP);
  };

  const handleSetAiModel = (m: string) => { setAiModel(m); localStorage.setItem('protagonist_ai_model', m); };
  const handleSetImageModel = (m: ImageModel) => { setImageModel(m); localStorage.setItem('protagonist_image_model', m); };
  const handleSetAvatarStyle = (s: AvatarStyle) => { setAvatarStyle(s); localStorage.setItem('protagonist_avatar_style', s); };
  const handleSetCustomAvatarStyle = (s: string) => { setCustomAvatarStyle(s); localStorage.setItem('protagonist_custom_avatar_style', s); };
  const handleSetAvatarRefImage = (b: string) => { setAvatarRefImage(b); if (!b) localStorage.removeItem('protagonist_avatar_ref'); else try { localStorage.setItem('protagonist_avatar_ref', b); } catch (e) {} };
  const handleSetInputMode = (m: InputMode) => { setInputMode(m); localStorage.setItem('protagonist_input_mode', m); };
  const handleSetModelScopeApiKey = (k: string) => { setModelScopeApiKey(k); localStorage.setItem('protagonist_modelscope_key', k); };
  const handleTestModelScope = async (key: string) => GeminiService.validateModelScopeConnection(key);
  const handleSetCustomPrompt = (p: string) => { setCustomPrompt(p); localStorage.setItem('protagonist_custom_prompt', p); };
  const handleSetBackgroundStyle = (s: BackgroundStyle) => { setBackgroundStyle(s); localStorage.setItem('protagonist_bg_style', s); if (gameState === GameState.LANDING || gameState === GameState.SETUP) setBgImage(getSmartBackground(StoryGenre.CUSTOM, StoryMood.PEACEFUL, s)); setSelectedImageStyle(s === 'realistic' ? 'realistic' : 'anime'); };
  const handleSetShowStoryPanelBackground = (s: boolean) => { setShowStoryPanelBackground(s); localStorage.setItem('protagonist_show_panel_bg', s.toString()); };
  const handleSetHistoryFontSize = (s: number) => { setHistoryFontSize(s); localStorage.setItem('protagonist_history_font_size', s.toString()); };
  const handleSetStoryFontSize = (s: number) => { setStoryFontSize(s); localStorage.setItem('protagonist_story_font_size', s.toString()); };
  const handleSetStoryFontFamily = (f: string) => { setStoryFontFamily(f); localStorage.setItem('protagonist_story_font_family', f); };
  
  const handleSetAutoSaveGallery = (val: boolean) => {
      setAutoSaveGallery(val);
      localStorage.setItem('protagonist_auto_save_gallery', val.toString());
  };

  const addToGallery = (base64: string, prompt: string, style: string) => { 
      setGallery(prev => { 
          if (prev.some(item => item.base64 === base64)) return prev;
          const newItem: GalleryItem = { id: generateUUID(), timestamp: Date.now(), base64, prompt, style }; 
          const updated = [newItem, ...prev].slice(0, 12); 
          try { localStorage.setItem('protagonist_gallery', JSON.stringify(updated)); } catch (e) {} 
          return updated; 
      }); 
  };
  
  const importSaveGame = (save: SavedGame | SavedGame[]) => {
      let savesToImport = Array.isArray(save) ? save : [save];
      let successCount = 0;
      const updates = [...savedGames];
      savesToImport.forEach(s => {
          const isDuplicate = updates.some(existing => existing.id === s.id || (existing.sessionId === s.sessionId && existing.storyId === s.storyId));
          if (!isDuplicate) {
              updates.push(s);
              successCount++;
              if (s.context.character.avatar) {
                  try {
                      let avatars: Record<string, string> = {};
                      const storedAvatars = localStorage.getItem('protagonist_avatars');
                      if (storedAvatars) avatars = JSON.parse(storedAvatars);
                      avatars[s.sessionId] = s.context.character.avatar;
                      localStorage.setItem('protagonist_avatars', JSON.stringify(avatars));
                  } catch (e) {}
              }
              // Scan all segments in the imported save for images and add them to the gallery
              const allSegments = [...(s.context.history || [])];
              if (s.context.currentSegment && !allSegments.find(seg => seg.id === s.context.currentSegment!.id)) {
                  allSegments.push(s.context.currentSegment);
              }
      
              allSegments.forEach(seg => {
                  if (seg.backgroundImage && seg.backgroundImage.startsWith('data:image')) {
                      addToGallery(seg.backgroundImage, seg.visualPrompt || "Imported Image", s.genre);
                  }
              });
          }
      });
      if (successCount > 0) {
          updates.sort((a, b) => b.timestamp - a.timestamp);
          const savesForStorage = updates.map(s => { if (s.context.character.avatar) return { ...s, context: { ...s.context, character: { ...s.context.character, avatar: undefined } } }; return s; });
          setSavedGames(updates);
          try { localStorage.setItem('protagonist_saves', JSON.stringify(savesForStorage)); } catch (e) {}
      }
      return successCount;
  };
  
  const deleteFromGallery = (id: string) => { setGallery(prev => { const updated = prev.filter(item => item.id !== id); localStorage.setItem('protagonist_gallery', JSON.stringify(updated)); return updated; }); if (viewingImage?.id === id) setViewingImage(null); };
  
  // Calculate if current BG is favorited
  const isCurrentBgFavorited = gallery.some(item => item.base64 === bgImage);

  const toggleCurrentBgFavorite = () => {
      if (isCurrentBgFavorited) {
          const item = gallery.find(i => i.base64 === bgImage);
          if (item) deleteFromGallery(item.id);
      } else {
          // Use current visual prompt as title, fallback to text
          const prompt = context.currentSegment?.visualPrompt || context.currentSegment?.text || "Saved Moment";
          addToGallery(bgImage, prompt, backgroundStyle);
      }
  };

  const handleManualSave = () => { playClickSound(); saveGameToStorage(latestContextRef.current, SaveType.MANUAL); };
  const handleSaveSetup = () => { playClickSound(); if (!context.character.name || !context.character.trait) { setError("请至少填写主角姓名和特质才能保存档案"); return; } saveGameToStorage(context, SaveType.SETUP); };
  const handleBackToHome = () => { playClickSound(); const isDirty = context.lastUpdated > lastSavedTime; if (isDirty && context.history.length > 1) { toggleModal('exitConfirm', true); } else { setGameState(GameState.LANDING); setCurrentLoadedSaveId(null); } };
  
  const deleteSession = (sessionId: string) => {
    setSavedGames(prev => {
        const updatedSaves = prev.filter(s => s.sessionId !== sessionId);
        const savesForStorage = updatedSaves.map(s => {
            if (s.context.character.avatar) {
                return { ...s, context: { ...s.context, character: { ...s.context.character, avatar: undefined } } };
            }
            return s;
        });
        try {
            localStorage.setItem('protagonist_saves', JSON.stringify(savesForStorage));
        } catch (e) {
            console.error("Failed to update saves in localStorage after session deletion", e);
        }
        return updatedSaves;
    });

    if (previewSaveId && savedGames.find(s => s.id === previewSaveId)?.sessionId === sessionId) {
        setPreviewSaveId(null);
    }
  };

  const deleteSaveGame = (saveId: string, e?: React.MouseEvent) => {
      if(e) e.stopPropagation();
      setSavedGames(prev => {
          const updatedSaves = prev.filter(s => s.id !== saveId);
          const savesForStorage = updatedSaves.map(s => {
              if (s.context.character.avatar) {
                  return { ...s, context: { ...s.context, character: { ...s.context.character, avatar: undefined } } };
              }
              return s;
          });
          try {
              localStorage.setItem('protagonist_saves', JSON.stringify(savesForStorage));
          } catch (e) {}
          return updatedSaves;
      });
      if (previewSaveId === saveId) setPreviewSaveId(null);
  };
  
  const handleAddScheduledEvent = (event: Omit<ScheduledEvent, 'id' | 'createdTurn' | 'status'>) => {
      const newEvent: ScheduledEvent = {
          ...event,
          id: generateUUID(),
          createdTurn: context.history.length,
          status: 'pending'
      };
      setContext(prev => ({
          ...prev,
          scheduledEvents: [...(prev.scheduledEvents || []), newEvent]
      }));
      playConfirmSound();
  };

  const handleUpdateScheduledEvent = (updatedEvent: ScheduledEvent) => {
      setContext(prev => ({
          ...prev,
          scheduledEvents: (prev.scheduledEvents || []).map(e => e.id === updatedEvent.id ? updatedEvent : e)
      }));
      playConfirmSound();
  };

  const handleDeleteScheduledEvent = (id: string) => {
      setContext(prev => ({
          ...prev,
          scheduledEvents: (prev.scheduledEvents || []).filter(e => e.id !== id)
      }));
      playClickSound();
  };

  const handleStartGame = async () => {
    playClickSound();
    if (!context.character.name || !context.character.trait) { setError("请输入角色姓名和性格关键词"); return; }
    setError(null); setCurrentLoadedSaveId(null);
    abortControllerRef.current = new AbortController();
    setContext(prev => ({ ...prev, sessionId: prev.sessionId || generateUUID(), scheduledEvents: [] }));
    setGameState(GameState.LOADING); setLoadingProgress(0);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => { setLoadingProgress(prev => { if (prev >= 95) return prev; return Math.min(prev + (prev < 50 ? Math.random() * 5 + 2 : Math.random() + 0.5), 95); }); }, 200);

    try {
      const opening = await GeminiService.generateOpening(context.genre, context.character, context.supportingCharacters, context.worldSettings, aiModel, context.customGenre, context.storyName, customPrompt, context.narrativeMode, context.narrativeTechnique);
      if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
      setLoadingProgress(prev => Math.max(prev, 40));
      const avatarPromise = GeminiService.generateCharacterAvatar(context.genre, context.character, avatarStyle, imageModel, customAvatarStyle, modelScopeApiKey, avatarRefImage);
      // Forced Scenery Prompt for Opening: STRICT no humans/characters policy for the FIRST image
      const sceneImagePromise = GeminiService.generateSceneImage(opening.visualPrompt + ", no humans, nobody, scenery only, landscape, architecture, environment", ImageSize.SIZE_1K, avatarStyle, "", customAvatarStyle, imageModel, modelScopeApiKey, ShotSize.EXTREME_LONG_SHOT);
      const supportingCharPromises = context.supportingCharacters.map(async (sc) => { if (sc.avatar) return sc; try { const scAvatar = await GeminiService.generateCharacterAvatar(context.genre, sc, avatarStyle, imageModel, customAvatarStyle, modelScopeApiKey, avatarRefImage); return { ...sc, avatar: scAvatar }; } catch (e) { return sc; } });
      const [avatarBase64, sceneBase64, updatedSupportingChars] = await Promise.all([avatarPromise, sceneImagePromise, Promise.all(supportingCharPromises)]);
      if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setLoadingProgress(100);
      await new Promise(resolve => setTimeout(resolve, 300));
      if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
      const openingSegment = { ...opening, id: opening.id || generateUUID(), backgroundImage: sceneBase64 }; 
      if (sceneBase64) { 
          setBgImage(sceneBase64); 
          if (autoSaveGallery) {
              addToGallery(sceneBase64, opening.visualPrompt, avatarStyle);
          }
      }
      setContext(prev => ({ ...prev, sessionId: prev.sessionId || generateUUID(), storyName: opening.storyName || prev.storyName || "未命名故事", character: { ...prev.character, avatar: avatarBase64 }, supportingCharacters: updatedSupportingChars, history: [openingSegment], currentSegment: openingSegment, lastUpdated: Date.now(), memories: opening.newMemories || DEFAULT_MEMORY }));
      setLastSavedTime(0); setGameState(GameState.PLAYING); playProgressSound();
    } catch (err: any) { if (err.message === "Aborted") return; if (progressTimerRef.current) clearInterval(progressTimerRef.current); setGameState(GameState.SETUP); setError(err.message || "AI响应异常，请重试。"); }
  };

  const handleLoadGame = (save: SavedGame, forceSetup: boolean = false) => {
    playClickSound();
    const ctx = JSON.parse(JSON.stringify(save.context));
    ctx.sessionId = save.sessionId;
    setCurrentLoadedSaveId(save.id);
    if (!ctx.scheduledEvents) ctx.scheduledEvents = []; // Ensure scheduledEvents exists
    if (!ctx.storyName && save.storyName) ctx.storyName = save.storyName; else if (save.storyName) ctx.storyName = save.storyName;
    if (!ctx.character.avatar) { try { const storedAvatars = localStorage.getItem('protagonist_avatars'); if (storedAvatars) { const dict = JSON.parse(storedAvatars); if (dict[save.sessionId]) ctx.character.avatar = dict[save.sessionId]; } } catch (e) {} }
    if (ctx.currentSegment && !ctx.currentSegment.backgroundImage) { let curr: SavedGame | undefined = save; let resolvedBg: string | undefined = undefined; while (curr && !resolvedBg) { if (curr.context.currentSegment?.backgroundImage) { resolvedBg = curr.context.currentSegment.backgroundImage; } else if (curr.parentId) { const pid = curr.parentId; curr = savedGames.find(s => s.storyId === pid); } else { break; } } if (resolvedBg) ctx.currentSegment.backgroundImage = resolvedBg; }
    if (!ctx.memories) ctx.memories = DEFAULT_MEMORY; if (ctx.memories && !ctx.memories.inventory) ctx.memories.inventory = "暂无物品";
    setContext(ctx); setLastSavedTime(save.timestamp || Date.now());
    if (forceSetup || save.type === SaveType.SETUP || ctx.history.length === 0) { setBgImage(getSmartBackground(StoryGenre.CUSTOM, StoryMood.PEACEFUL, 'anime')); setGameState(GameState.SETUP); } else { if (ctx.currentSegment?.backgroundImage) { setBgImage(ctx.currentSegment.backgroundImage); } else { setBgImage(getSmartBackground(ctx.genre, ctx.currentSegment?.mood || StoryMood.PEACEFUL, backgroundStyle)); } setGameState(GameState.PLAYING); }
  };

  const handleChoice = async (choice: string, fromIndex?: number) => {
    playConfirmSound(); setError(null); setIsLoading(true); setTextTypingComplete(false); setCurrentLoadedSaveId(null);
    let choiceIdx = -1;
    if (context.currentSegment && context.currentSegment.choices) { choiceIdx = context.currentSegment.choices.findIndex(c => c === choice); if (choiceIdx === -1) choiceIdx = context.currentSegment.choices.findIndex(c => choice.includes(c) || c.includes(choice)); }
    let actualChoice = choice;
    if (choice.startsWith("(发动技能)")) { const lowerChoice = choice.toLowerCase(); if (lowerChoice.includes("火") || lowerChoice.includes("炎") || lowerChoice.includes("爆")) setVisualEffect('fire'); else if (lowerChoice.includes("雷") || lowerChoice.includes("电")) setVisualEffect('thunder'); else if (lowerChoice.includes("光") || lowerChoice.includes("圣") || lowerChoice.includes("愈")) setVisualEffect('heal'); else if (lowerChoice.includes("暗") || lowerChoice.includes("影") || lowerChoice.includes("杀")) setVisualEffect('darkness'); else if (lowerChoice.includes("冰") || lowerChoice.includes("雪")) setVisualEffect('ice'); else if (lowerChoice.includes("金") || lowerChoice.includes("钱")) setVisualEffect('gold'); }

    try {
      const historyToUse = (fromIndex !== undefined && fromIndex < context.history.length - 1) ? context.history.slice(0, fromIndex + 1) : context.history;
      
      const nextSegment = await GeminiService.advanceStory(
          historyToUse, 
          actualChoice, 
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
          context.narrativeTechnique
      );
      nextSegment.causedBy = choice;

      // Check for Triggered Event
      let updatedEvents = context.scheduledEvents ? [...context.scheduledEvents] : [];
      if (nextSegment.triggeredEventId) {
          const eventIndex = updatedEvents.findIndex(e => e.id === nextSegment.triggeredEventId);
          if (eventIndex !== -1 && updatedEvents[eventIndex].status === 'pending') {
              updatedEvents[eventIndex] = {
                  ...updatedEvents[eventIndex],
                  status: 'completed',
                  triggeredTurn: historyToUse.length + 1
              };
              playBeep(1000, 0.5, 'sine'); // Success ping for event triggering
          }
      }

      const affinityUpdates = nextSegment.affinityChanges || {};
      const hasMajorPositiveBond = Object.values(affinityUpdates).some(val => val >= 3);
      const hasMajorNegativeBond = Object.values(affinityUpdates).some(val => val <= -3);
      if (hasMajorPositiveBond) { setVisualEffect('heal'); playBeep(880, 0.4, 'sine'); } 
      else if (hasMajorNegativeBond) { setVisualEffect('darkness'); playBeep(150, 0.5, 'sawtooth'); }

      setContext(prev => {
        let updatedChars = prev.supportingCharacters;
        if (nextSegment.affinityChanges) { updatedChars = updatedChars.map(c => { const change = nextSegment.affinityChanges?.[c.name]; if (change) return { ...c, affinity: (c.affinity || 0) + change }; return c; }); }
        if (!nextSegment.backgroundImage) nextSegment.backgroundImage = bgImage; else setBgImage(nextSegment.backgroundImage);
        return { ...prev, supportingCharacters: updatedChars, history: [...historyToUse, nextSegment], currentSegment: nextSegment, lastUpdated: Date.now(), lastChoiceIdx: choiceIdx, memories: nextSegment.newMemories || prev.memories, scheduledEvents: updatedEvents };
      });
      playProgressSound(); setIsLoading(false);
    } catch (err) { setError("剧情推进失败，请重试。"); setIsLoading(false); }
  };

  const triggerManualImageGeneration = async (visualPrompt: string, targetSegmentId: string, style: string = 'anime', characterInfo: string = '', customStyle: string = '', referenceImage?: string) => { if (!visualPrompt) return; setGeneratingImage(true); try { const randomShot = [ShotSize.MEDIUM_SHOT, ShotSize.CLOSE_UP, ShotSize.LONG_SHOT, ShotSize.EXTREME_CLOSE_UP, ShotSize.DYNAMIC_PERSPECTIVE][Math.floor(Math.random() * 5)]; const imageBase64 = await GeminiService.generateSceneImage(visualPrompt, ImageSize.SIZE_1K, style, characterInfo, customStyle, imageModel, modelScopeApiKey, randomShot, referenceImage); if (!imageBase64 || !imageBase64.startsWith('data:image')) throw new Error("Invalid image"); 
  
  if (autoSaveGallery) {
      addToGallery(imageBase64, visualPrompt, style); 
  }
  
  setContext(prev => { const segmentIndex = prev.history.findIndex(h => h.id === targetSegmentId); if (segmentIndex === -1) return prev; const updatedHistory = [...prev.history]; updatedHistory[segmentIndex] = { ...updatedHistory[segmentIndex], backgroundImage: imageBase64 }; const updatedCurrent = prev.currentSegment?.id === targetSegmentId ? updatedHistory[segmentIndex] : prev.currentSegment; return { ...prev, history: updatedHistory, currentSegment: updatedCurrent, lastUpdated: Date.now() }; }); setBgImage(imageBase64); } catch (e: any) { console.warn("Image generation failed", e); } finally { setGeneratingImage(false); } };
  
  const handleSummarizeMemory = async () => { playClickSound(); if (context.history.length < 2) return; setIsSummarizing(true); try { const summary = await GeminiService.summarizeHistory(context.history, aiModel); setContext(prev => ({ ...prev, memories: { ...prev.memories, storyMemory: summary } })); playProgressSound(); } catch(e) { console.error("Summarize failed", e); } finally { setIsSummarizing(false); } };
  const handleGlobalReplace = (findText: string, replaceText: string): number => { if (!findText || !replaceText) return 0; const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const regex = new RegExp(escapeRegExp(findText), 'g'); let count = 0; const countIn = (s: string | undefined) => s ? (s.match(regex) || []).length : 0; Object.values(context.memories).forEach(val => { if (typeof val === 'string') count += countIn(val); }); const limit = 5; const startIndex = Math.max(0, context.history.length - limit); for (let i = startIndex; i < context.history.length; i++) { const seg = context.history[i]; count += countIn(seg.text); seg.choices.forEach(c => count += countIn(c)); } if (context.currentSegment && !context.history.find(h => h.id === context.currentSegment?.id)) { count += countIn(context.currentSegment.text); } if (count === 0) return 0; setContext(prev => { const newMemories = { ...prev.memories }; (Object.keys(newMemories) as (keyof MemoryState)[]).forEach(k => { if (typeof newMemories[k] === 'string') newMemories[k] = newMemories[k].replace(regex, replaceText); }); const newHistory = [...prev.history]; const start = Math.max(0, newHistory.length - limit); for (let i = start; i < newHistory.length; i++) { let updatedText = newHistory[i].text.replace(regex, replaceText); let updatedChoices = newHistory[i].choices.map(c => c.replace(regex, replaceText)); newHistory[i] = { ...newHistory[i], text: updatedText, choices: updatedChoices }; } let newCurrent = prev.currentSegment ? { ...prev.currentSegment } : null; if (newCurrent) { newCurrent.text = newCurrent.text.replace(regex, replaceText); newCurrent.choices = newCurrent.choices.map(c => c.replace(regex, replaceText)); } return { ...prev, memories: newMemories, history: newHistory, currentSegment: newCurrent, lastUpdated: Date.now() }; }); return count; };
  const handleUpgradeSkill = (skillId: string) => { setContext(prev => ({ ...prev, character: { ...prev.character, skills: prev.character.skills.map(s => s.id === skillId ? { ...s, level: (s.level || 1) + 1 } : s ) } })); playProgressSound(); };
  const handleAbortGame = () => { if (abortControllerRef.current) abortControllerRef.current.abort(); if (progressTimerRef.current) clearInterval(progressTimerRef.current); setGameState(GameState.SETUP); setError("已终止世界生成。"); playClickSound(); };
  const handleRegenerate = async () => { playClickSound(); const lastIdx = context.history.length - 1; if (lastIdx < 0) return; const lastSegment = context.history[lastIdx]; if (lastIdx > 0 && !lastSegment.causedBy) { setError("无法重新生成此节点"); return; } setIsLoading(true); setError(null); try { let newSegment: StorySegment; const historyContext = context.history.slice(0, lastIdx); if (lastIdx === 0) { newSegment = await GeminiService.generateOpening(context.genre, context.character, context.supportingCharacters, context.worldSettings, aiModel, context.customGenre, context.storyName, customPrompt, context.narrativeMode, context.narrativeTechnique); } else { const causedBy = lastSegment.causedBy || ""; newSegment = await GeminiService.advanceStory(historyContext, causedBy, context.genre, context.character, context.supportingCharacters, context.worldSettings, context.memories, aiModel, context.customGenre, customPrompt, context.scheduledEvents || [], context.narrativeMode, context.narrativeTechnique); newSegment.causedBy = causedBy; } setContext(prev => { const history = [...prev.history]; const currentSeg = { ...history[lastIdx] }; if (!currentSeg.versions) { currentSeg.versions = [{ text: currentSeg.text, choices: currentSeg.choices, visualPrompt: currentSeg.visualPrompt, mood: currentSeg.mood }]; currentSeg.currentVersionIndex = 0; } const newVersion = { text: newSegment.text, choices: newSegment.choices, visualPrompt: newSegment.visualPrompt, mood: newSegment.mood, location: newSegment.location }; currentSeg.versions.push(newVersion); const newIdx = currentSeg.versions.length - 1; currentSeg.currentVersionIndex = newIdx; currentSeg.text = newVersion.text; currentSeg.choices = newVersion.choices; currentSeg.visualPrompt = newVersion.visualPrompt; currentSeg.mood = newVersion.mood; currentSeg.location = newVersion.location; history[lastIdx] = currentSeg; return { ...prev, history, currentSegment: currentSeg, memories: newSegment.newMemories || prev.memories, lastUpdated: Date.now() }; }); playProgressSound(); } catch (e) { console.error("Regenerate failed", e); setError("重新生成失败"); } finally { setIsLoading(false); } };
  const handleSwitchVersion = (segmentId: string, direction: 'prev' | 'next') => { playClickSound(); setContext(prev => { const history = [...prev.history]; const idx = history.findIndex(h => h.id === segmentId); if (idx === -1) return prev; const seg = { ...history[idx] }; if (!seg.versions || seg.versions.length < 2) return prev; let newIdx = (seg.currentVersionIndex || 0) + (direction === 'next' ? 1 : -1); if (newIdx < 0) newIdx = seg.versions.length - 1; if (newIdx >= seg.versions.length) newIdx = 0; if (newIdx === seg.currentVersionIndex) return prev; const v = seg.versions[newIdx]; seg.currentVersionIndex = newIdx; seg.text = v.text; seg.choices = v.choices; seg.visualPrompt = v.visualPrompt; seg.mood = v.mood; seg.location = v.location; history[idx] = seg; const isCurrent = prev.currentSegment?.id === segmentId; return { ...prev, history, currentSegment: isCurrent ? seg : prev.currentSegment, lastUpdated: Date.now() }; }); };
  const handleGenerateImage = async () => { playClickSound(); if (!context.currentSegment?.visualPrompt || !context.currentSegment?.id) return; toggleModal('image', false); const characterInfo = `Character Name: ${context.character.name}, Gender: ${context.character.gender}, Appearance: ${context.character.trait}`; triggerManualImageGeneration(context.currentSegment.visualPrompt, context.currentSegment.id, selectedImageStyle, characterInfo, customImageStyle, context.character.avatar); };

  return {
    gameState, setGameState, context, setContext, isLoading, loadingProgress, error, setError, modals, toggleModal,
    aiModel, handleSetAiModel, imageModel, handleSetImageModel, avatarStyle, handleSetAvatarStyle, customAvatarStyle, handleSetCustomAvatarStyle,
    avatarRefImage, handleSetAvatarRefImage, backgroundStyle, handleSetBackgroundStyle, inputMode, handleSetInputMode,
    modelScopeApiKey, handleSetModelScopeApiKey, handleTestModelScope, customPrompt, handleSetCustomPrompt, gallery, viewingImage, setViewingImage,
    savedGames, previewSaveId, setPreviewSaveId, generatingImage, bgImage, setBgImage, textTypingComplete, setTextTypingComplete,
    isUiVisible, setIsUiVisible, isMuted, setIsMuted, volume, setVolume, battleAnim, visualEffect, setVisualEffect, 
    selectedImageStyle, setSelectedImageStyle, customImageStyle, setCustomImageStyle, typingSpeed, setTypingSpeed, autoSaveState,
    isSummarizing, selectedCharacterId, setSelectedCharacterId, setupTempData, setSetupTempData, showStoryPanelBackground, handleSetShowStoryPanelBackground,
    handleStartGame, handleLoadGame, handleStartNewGameSetup, handleChoice, handleManualSave, handleSaveSetup, importSaveGame,
    handleBackToHome, handleGenerateImage, deleteFromGallery, deleteSaveGame, deleteSession, playClickSound, playHoverSound, handleSummarizeMemory,
    handleRegenerate, handleSwitchVersion, handleGlobalReplace, handleAbortGame, handleUpgradeSkill,
    historyFontSize, handleSetHistoryFontSize, storyFontSize, handleSetStoryFontSize, storyFontFamily, handleSetStoryFontFamily,
    handleAddScheduledEvent, handleUpdateScheduledEvent, handleDeleteScheduledEvent,
    autoSaveGallery, handleSetAutoSaveGallery, isCurrentBgFavorited, toggleCurrentBgFavorite
  };
};
