

export enum GameState {
  LANDING = 'LANDING',
  SETUP = 'SETUP',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  LOAD_GAME = 'LOAD_GAME',
  GAME_OVER = 'GAME_OVER'
}

export enum StoryGenre {
  XIANXIA = '修仙 - 逆天改命',
  WUXIA = '武侠 - 快意恩仇',
  ROMANCE = '都市 - 完美邂逅',
  SUPERHERO = '异能 - 觉醒时刻',
  CYBERPUNK = '赛博 - 霓虹暗影',
  FANTASY = '奇幻 - 龙与地下城',
  CUSTOM = '自定义 - 独家定制'
}

export enum StoryMood {
  PEACEFUL = 'PEACEFUL',     // 平静/日常
  BATTLE = 'BATTLE',         // 战斗/激烈
  TENSE = 'TENSE',           // 紧张/悬疑
  EMOTIONAL = 'EMOTIONAL',   // 感动/悲伤
  MYSTERIOUS = 'MYSTERIOUS', // 神秘/探索
  VICTORY = 'VICTORY'        // 胜利/高光
}

export const MOOD_LABELS: Record<StoryMood, string> = {
  [StoryMood.PEACEFUL]: "平静 / 日常",
  [StoryMood.BATTLE]: "战斗 / 激烈",
  [StoryMood.TENSE]: "紧张 / 悬疑",
  [StoryMood.EMOTIONAL]: "感动 / 悲伤",
  [StoryMood.MYSTERIOUS]: "神秘 / 探索",
  [StoryMood.VICTORY]: "胜利 / 高光"
};

export enum ImageSize {
  SIZE_1K = '1K',
  SIZE_2K = '2K',
  SIZE_4K = '4K'
}

// Cinematography Shot Sizes
export enum ShotSize {
  EXTREME_LONG_SHOT = 'EXTREME_LONG_SHOT', // 远景 (Establishing Shot)
  LONG_SHOT = 'LONG_SHOT',                 // 全景 (Full Body)
  MEDIUM_SHOT = 'MEDIUM_SHOT',             // 中景 (Waist Up)
  CLOSE_UP = 'CLOSE_UP',                   // 近景 (Shoulder Up)
  EXTREME_CLOSE_UP = 'EXTREME_CLOSE_UP',   // 特写 (Detail/Eyes)
  DYNAMIC_PERSPECTIVE = 'DYNAMIC_PERSPECTIVE' // 大透视 (Dynamic/Fisheye)
}

export type AvatarStyle = 'anime' | 'realistic' | '3d' | 'ink';
export type BackgroundStyle = 'anime' | 'realistic';
export type InputMode = 'choice' | 'text';
export type ImageModel = 
  | 'gemini-2.5-flash-image' 
  | 'gemini-2.5-flash-image-preview'
  | 'Qwen/Qwen-Image'
  | 'MusePublic/FLUX.1';

// New: Visual Effect Types
export type VisualEffectType = 'none' | 'fire' | 'thunder' | 'heal' | 'darkness' | 'ice' | 'gold';

export interface Skill {
  id: string;
  name: string;
  description: string;
  level: number;
  type: 'active' | 'passive'; // Added active/passive type
}

export interface Character {
  name: string;
  trait: string;
  gender: 'male' | 'female' | 'other';
  avatar?: string; // Base64 image
  skills: Skill[]; // Added Skills
}

export interface SupportingCharacter {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other'; 
  category: 'protagonist' | 'supporting' | 'villain' | 'other'; // Added category
  role: string; // e.g., "青梅竹马", "师父"
  personality?: string; // New: Personality description
  appearance?: string; // New: Appearance description
  avatar?: string; // Base64 or color code
  affinity?: number; // Relationship score, default 0
  initialAffinity?: number; // Initial relationship score
  archetype?: string; // New: Archetype Name (e.g., "信使原型")
  archetypeDescription?: string; // New: Archetype Description
}

export interface WorldSettings {
  isHarem: boolean; // 后宫
  isAdult: boolean; // 成年内容
  hasSystem: boolean; // 系统加持
  tone: StoryMood; // 整体基调
}

export interface MemoryState {
  memoryZone: string;       // 记忆区 (scratchpad/immediate context)
  storyMemory: string;      // 剧情记忆 (recent plot summary)
  longTermMemory: string;   // 长期剧情记忆 (archived key plot points)
  coreMemory: string;       // 核心剧情记忆 (immutable facts/goals)
  characterRecord: string;  // 出场角色记录 (active characters status)
  inventory: string;        // 背包/物品记录 (items, props, key objects)
}

export interface ScheduledEvent {
  id: string;
  type: string; // e.g. "Meeting", "Travel", "Battle"
  time?: string;
  location?: string;
  characters?: string;
  description: string;
  status: 'pending' | 'completed';
  createdTurn: number; // The turn index when this was added
  triggeredTurn?: number; // The turn index when this happened
}

export interface StorySegmentVersion {
  text: string;
  choices: string[];
  visualPrompt: string;
  mood: StoryMood;
  location?: string;
}

export interface StorySegment {
  id: string;
  text: string;
  choices: string[];
  visualPrompt: string; // Internal prompt for image generation
  backgroundImage?: string; // Base64 or URL
  activeCharacterName?: string; // Who is the focus?
  mood: StoryMood; // Background music mood
  location?: string; // Specific location name
  storyName?: string; // New: Optional Story Title returned by AI
  affinityChanges?: Record<string, number>; // Map of character names to affinity delta
  newMemories?: MemoryState; // Updated memories from this turn
  causedBy?: string; // New: The user choice/input that triggered this segment
  triggeredEventId?: string; // New: ID of the scheduled event that was realized in this segment
  
  // Versioning
  versions?: StorySegmentVersion[];
  currentVersionIndex?: number;
}

export interface GameContext {
  sessionId: string; // Unique ID for save slots
  storyName?: string; // New: The title of the story
  genre: StoryGenre;
  customGenre?: string; // New: User defined genre details
  character: Character;
  supportingCharacters: SupportingCharacter[];
  worldSettings: WorldSettings;
  history: StorySegment[]; // Track the story flow
  currentSegment: StorySegment | null;
  lastUpdated: number; // Timestamp
  lastChoiceIdx?: number; // Index of the choice that led to current state (0-based)
  memories: MemoryState; // Current active memory state
  narrativeMode?: string; // Narrative structure ID (e.g. 'auto', 'structure-1')
  narrativeTechnique?: string; // New: Narrative technique ID (e.g. 'auto', 'tech-1')
  scheduledEvents: ScheduledEvent[]; // New: List of future/past events
}

export enum SaveType {
  MANUAL = 'MANUAL',
  AUTO = 'AUTO',
  SETUP = 'SETUP' // Configuration draft
}

export interface SavedGame {
  id: string; // Unique ID for the specific save instance
  sessionId: string;
  storyName?: string; // New: The title of the story
  storyId?: string; // ID of the specific story segment
  parentId?: string; // ID of the parent story segment (for branching tree)
  timestamp: number;
  genre: StoryGenre;
  characterName: string;
  summary: string;
  context: GameContext;
  type: SaveType;
  location?: string; // New: Extracted location name
  choiceLabel?: string; // Visual label for the choice taken (e.g. "1", "2")
  choiceText?: string; // Text content of the choice taken
  metaData?: {       // New: Rich metadata for UI
      highestAffinityNPC?: string;
      totalSkillLevel?: number;
      turnCount?: number;
  };
}

export interface GalleryItem {
  id: string;
  timestamp: number;
  base64: string;
  prompt: string;
  style: string;
}

export interface APIKeyError {
  message: string;
}

// Helper for safe UUID generation in all environments
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {
      console.warn('crypto.randomUUID failed, falling back');
    }
  }
  
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};