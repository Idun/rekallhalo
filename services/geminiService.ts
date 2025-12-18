
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { StoryGenre, Character, StorySegment, ImageSize, SupportingCharacter, StoryMood, generateUUID, WorldSettings, Skill, AvatarStyle, MemoryState, ImageModel, ShotSize, ScheduledEvent, PlotChapter } from '../types';
import { WULIN_CONTEXT, WESTERN_FANTASY_CONTEXT, NARRATIVE_STRUCTURES, NARRATIVE_TECHNIQUES, CHARACTER_ARCHETYPES } from '../constants';

const getClient = (apiKey?: string) => new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY });

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
];

const TEXT_MODEL_FALLBACKS: Record<string, string[]> = {
    'gemini-2.5-pro': ['gemini-2.5-flash'],
    'gemini-3-pro-preview': ['gemini-2.5-flash'],
    'gemini-2.5-flash': ['gemini-flash-lite-latest'],
};

const IMAGE_MODEL_FALLBACKS: Record<string, string[]> = {
    'gemini-2.5-flash-image-preview': ['gemini-2.5-flash-image'],
};

async function withModelFallback<T>(
    primaryModel: string, 
    fallbacksMap: Record<string, string[]>, 
    operation: (model: string) => Promise<T>
): Promise<T> {
    const fallbacks = fallbacksMap[primaryModel] || [];
    const modelsToTry = [primaryModel, ...fallbacks];
    let lastError: any = null;
    for (const model of modelsToTry) {
        try {
            return await operation(model);
        } catch (error: any) {
            console.warn(`Model ${model} failed. Trying fallback. Error:`, error);
            lastError = error;
        }
    }
    throw lastError || new Error(`All models failed for ${primaryModel}`);
}

const getWorldContext = (genre: StoryGenre): string => {
  if (genre === StoryGenre.XIANXIA || genre === StoryGenre.WUXIA) return WULIN_CONTEXT;
  if (genre === StoryGenre.FANTASY) return WESTERN_FANTASY_CONTEXT;
  return ""; 
};

const cleanJson = (text: string): string => {
  if (!text) return "{}";
  let cleaned = text.replace(/```json\s*|```/gi, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIndex = -1;
  let endIndex = -1;
  let isArray = false;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIndex = firstBrace;
      endIndex = cleaned.lastIndexOf('}');
  } else if (firstBracket !== -1) {
      startIndex = firstBracket;
      endIndex = cleaned.lastIndexOf(']');
      isArray = true;
  }
  if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) cleaned = cleaned.substring(startIndex, endIndex + 1);
  else return "{}"; 
  cleaned = cleaned.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');
  return cleaned.trim() || (isArray ? "[]" : "{}");
};

const storyResponseSchema = {
  type: Type.OBJECT,
  properties: {
    storyName: { type: Type.STRING, nullable: true },
    text: { type: Type.STRING },
    choices: { type: Type.ARRAY, items: { type: Type.STRING } },
    visualPrompt: { type: Type.STRING },
    activeCharacterName: { type: Type.STRING },
    location: { type: Type.STRING },
    mood: { type: Type.STRING, enum: Object.values(StoryMood) },
    triggeredEventId: { type: Type.STRING, nullable: true },
    affinityUpdates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { characterName: { type: Type.STRING }, change: { type: Type.INTEGER } },
        required: ["characterName", "change"]
      },
      nullable: true
    },
    memoryUpdate: {
        type: Type.OBJECT,
        properties: {
            memoryZone: { type: Type.STRING }, storyMemory: { type: Type.STRING },
            longTermMemory: { type: Type.STRING }, coreMemory: { type: Type.STRING },
            characterRecord: { type: Type.STRING }, inventory: { type: Type.STRING }
        },
        required: ["memoryZone", "storyMemory", "longTermMemory", "coreMemory", "characterRecord", "inventory"]
    }
  },
  required: ["text", "choices", "visualPrompt", "mood", "memoryUpdate"]
};

const getPerspectiveInstruction = (perspective: string | undefined, charName: string): string => {
    const p = perspective || 'third';
    let rules = "";
    switch (p) {
        case 'first': rules = `**STRICT FIRST PERSON (POV: "I" / "我")**.`; break;
        case 'second': rules = `**STRICT SECOND PERSON (POV: "You" / "你")**.`; break;
        case 'omniscient': rules = `**STRICT OMNISCIENT VIEW (God View)**. Refer to the protagonist by Name ("${charName}").`; break;
        case 'third': default: rules = `**STRICT THIRD PERSON (POV: "${charName}" / "He" / "She")**.`; break;
    }
    return `[NARRATIVE PERSPECTIVE RULES] ${rules}`;
};

export const generateOpening = async (
    genre: StoryGenre, character: Character, supportingCharacters: SupportingCharacter[], worldSettings: WorldSettings, modelName: string, customGenre?: string, storyName?: string, customPrompt?: string, narrativeMode?: string, narrativeTechnique?: string, plotBlueprint: PlotChapter[] = [], apiKey?: string
): Promise<StorySegment> => {
  const ai = getClient(apiKey);
  const worldContext = getWorldContext(genre);
  const structure = NARRATIVE_STRUCTURES.find(s => s.id === narrativeMode);
  const technique = NARRATIVE_TECHNIQUES.find(t => t.id === narrativeTechnique);
  const hasBlueprint = plotBlueprint && plotBlueprint.length > 0;
  const perspectiveInstruction = getPerspectiveInstruction(character.perspective, character.name);
  const narrativeInstruction = `[NARRATIVE ARCHITECTURE] ${hasBlueprint ? `Guided by blueprint. Style: ${structure?.name || 'Default'}, ${technique?.name || 'Default'}` : `Structure: ${structure?.name || 'Auto'}, Tech: ${technique?.name || 'Auto'}`} ${perspectiveInstruction}`;
  let blueprintInstruction = "";
  const chapter1 = plotBlueprint.length > 0 ? plotBlueprint[0] : undefined;
  if (chapter1) {
      blueprintInstruction = `[CURRENT CHAPTER OBJECTIVE] Title: ${chapter1.title}\nContext: ${chapter1.summary}\nEvents: ${chapter1.keyEvents}\nCharacters: ${chapter1.keyCharacters.join(', ')}`;
  }
  const prompt = `Role: Interactive fiction engine. Task: OPENING segment for "${genre}". Lang: Simplified Chinese. [SETTING] ${worldContext} ${customGenre || ''} ${storyName ? `Title: ${storyName}` : ''} Tone: ${worldSettings.tone}. [PROTAGONIST] Name: ${character.name}, Traits: ${character.trait}. [NPCs] ${supportingCharacters.map(c => `- ${c.name}: ${c.personality}`).join('\n')} ${narrativeInstruction} ${blueprintInstruction} [CUSTOM] ${customPrompt || ""} Output requirements: valid JSON schema.`;
  return withModelFallback(modelName, TEXT_MODEL_FALLBACKS, async (model) => {
      const response = await ai.models.generateContent({
        model: model, contents: prompt, config: { responseMimeType: "application/json", responseSchema: storyResponseSchema, safetySettings: SAFETY_SETTINGS }
      });
      const json = JSON.parse(cleanJson(response.text || "{}"));
      return { id: generateUUID(), text: json.text, choices: json.choices, visualPrompt: json.visualPrompt, mood: json.mood, activeCharacterName: json.activeCharacterName, location: json.location, newMemories: json.memoryUpdate, chapterId: chapter1?.id, storyName: json.storyName };
  });
};

export const advanceStory = async (
    history: StorySegment[], userChoice: string, genre: StoryGenre, character: Character, supportingCharacters: SupportingCharacter[], worldSettings: WorldSettings, memories: MemoryState, modelName: string, customGenre?: string, customPrompt?: string, scheduledEvents: ScheduledEvent[] = [], narrativeMode?: string, narrativeTechnique?: string, plotBlueprint: PlotChapter[] = [], regenerationMode: 'full' | 'text' | 'choices' = 'full', apiKey?: string
): Promise<StorySegment> => {
    const ai = getClient(apiKey);
    const lastTurnIndex = history.length - 1;
    const historyWindow = [];
    if (lastTurnIndex > 0) historyWindow.push(`Turn ${lastTurnIndex - 1}: ${history[lastTurnIndex - 1].text.substring(0, 150)}... Choice: ${history[lastTurnIndex - 1].causedBy}`);
    if (lastTurnIndex >= 0) historyWindow.push(`Turn ${lastTurnIndex}: ${history[lastTurnIndex].text} \nUser Choice: ${history[lastTurnIndex].causedBy}`);
    const charListString = supportingCharacters.slice(0, 8).map(c => `- ${c.name} (${c.role}, Aff:${c.affinity||0})`).join('\n');
    const structure = NARRATIVE_STRUCTURES.find(s => s.id === narrativeMode);
    const technique = NARRATIVE_TECHNIQUES.find(t => t.id === narrativeTechnique);
    const perspectiveInstruction = getPerspectiveInstruction(character.perspective, character.name);
    const narrativeInstruction = `[NARRATIVE] ${structure?.name || 'Linear'}, ${technique?.name || 'Default'} ${perspectiveInstruction}`;
    const pendingEvents = scheduledEvents.filter(e => e.status === 'pending');
    let eventsInstruction = pendingEvents.length > 0 ? `[PENDING EVENTS] ${pendingEvents.map(e => `(ID:${e.id}) ${e.description}`).join('\n')}` : "";
    let blueprintInstruction = "";
    let pacingAndWordCountInstruction = "Segment: 250-350 words.";
    let activeChapter = plotBlueprint.find(c => c.status === 'active');
    if (activeChapter) {
        const stats = activeChapter.trackedStats || { currentWordCount: 0, eventsTriggered: 0, interactionsCount: 0 };
        const criteria = activeChapter.completionCriteria || { minKeyEvents: 1, minInteractions: 1 };
        blueprintInstruction = `[CURRENT CHAPTER: ${activeChapter.title}] Objective: ${activeChapter.summary}. Key Events: ${activeChapter.keyEvents}. Key NPCs: ${activeChapter.keyCharacters.join(', ')}. PROGRESS: Word(${stats.currentWordCount}/${activeChapter.targetWordCount}), Event(${stats.eventsTriggered}/${criteria.minKeyEvents}), Interact(${stats.interactionsCount}/${criteria.minInteractions}). **IMPORTANT**: If progress is near 100%, start wrapping up this chapter's specific conflicts to prepare for a transition.`;
        if (activeChapter.pacing === 'fast') pacingAndWordCountInstruction = "PACING: FAST. 200-250 words.";
        else if (activeChapter.pacing === 'slow') pacingAndWordCountInstruction = "PACING: SLOW. 350-450 words.";
    }
    const prompt = `Role: Interactive fiction engine. Task: ${regenerationMode}. Lang: Simplified Chinese. [SETTING] ${genre}, Tone: ${worldSettings.tone}. [CHARACTERS] Protagonist: ${character.name}, Key NPCs: ${charListString}. [HISTORY] ${historyWindow.join('\n\n')} [USER INPUT] "${userChoice}" ${narrativeInstruction} ${blueprintInstruction} ${eventsInstruction} [RULES] ${pacingAndWordCountInstruction} ${customPrompt || ""} 1. High dialogue ratio. 2. Update memory. 3. Output choices that advance the blueprint goals. Return JSON.`;
    return withModelFallback(modelName, TEXT_MODEL_FALLBACKS, async (model) => {
        const response = await ai.models.generateContent({
            model: model, contents: prompt, config: { responseMimeType: "application/json", responseSchema: storyResponseSchema, safetySettings: SAFETY_SETTINGS }
        });
        const json = JSON.parse(cleanJson(response.text || "{}"));
        return { id: generateUUID(), text: json.text, choices: json.choices, visualPrompt: json.visualPrompt, mood: json.mood, activeCharacterName: json.activeCharacterName, location: json.location, affinityChanges: json.affinityUpdates ? json.affinityUpdates.reduce((acc: any, curr: any) => ({...acc, [curr.characterName]: curr.change}), {}) : undefined, newMemories: json.memoryUpdate, triggeredEventId: json.triggeredEventId, chapterId: activeChapter?.id };
    });
};

export const autoPlanBlueprint = async (
    genre: StoryGenre, character: Character, worldSettings: WorldSettings, outline: string, existingCharacters: SupportingCharacter[] = [], existingChapters: PlotChapter[] = [], config: { chapterCount: number, wordCountRange: [number, number], newCharCount: number, newOrgCount: number, customGuidance?: string } = { chapterCount: 3, wordCountRange: [3000, 5000], newCharCount: 3, newOrgCount: 1 }, narrativeMode?: string, narrativeTechnique?: string, apiKey?: string
): Promise<{ chapters: PlotChapter[], newCharacters: any[] }> => {
    const ai = getClient(apiKey);
    const isContinuation = existingChapters.length > 0;
    const structure = NARRATIVE_STRUCTURES.find(s => s.id === narrativeMode);
    const technique = NARRATIVE_TECHNIQUES.find(t => t.id === narrativeTechnique);
    const archetypeList = CHARACTER_ARCHETYPES.map(a => a.name).join(', ');
    const prompt = `Role: Plot Architect. Task: Generate ${config.chapterCount} chapters. Genre: ${genre}, Protagonist: ${character.name}, Tone: ${worldSettings.tone}. Architecture: ${structure?.name || 'Linear'}, ${technique?.name || 'Standard'}. [INPUT] ${outline || 'Standard progression'}. Configuration: Word count ${config.wordCountRange[0]}-${config.wordCountRange[1]}. ${config.customGuidance ? `Guidance: ${config.customGuidance}` : ''} [EXISTING] ${existingCharacters.map(c => c.name).join(', ')}. Language: Simplified Chinese. Output JSON with "chapters" and "newCharacters".`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', contents: prompt, config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    chapters: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: { title: { type: Type.STRING }, summary: { type: Type.STRING }, targetWordCount: { type: Type.INTEGER }, keyEvents: { type: Type.STRING }, keyCharacters: { type: Type.ARRAY, items: { type: Type.STRING } }, pacing: { type: Type.STRING, enum: ['fast', 'standard', 'slow'] } }
                        }
                    },
                    newCharacters: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: { name: { type: Type.STRING }, role: { type: Type.STRING }, gender: { type: Type.STRING, enum: ['male', 'female', 'other', 'organization'] }, personality: { type: Type.STRING }, appearance: { type: Type.STRING }, archetype: { type: Type.STRING, nullable: true }, category: { type: Type.STRING, enum: ['supporting', 'villain', 'other'] } },
                            required: ["name", "role", "gender"]
                        }
                    }
                }
            }
        }
    });
    let rawData = JSON.parse(cleanJson(response.text || "{}"));
    let rawChapters = Array.isArray(rawData) ? rawData : (rawData.chapters || []);
    let newChars = rawData.newCharacters || [];
    const processedChapters = rawChapters.map((c: any) => ({
        ...c, id: generateUUID(), status: 'pending', trackedStats: { currentWordCount: 0, eventsTriggered: 0, interactionsCount: 0 }, completionCriteria: { minKeyEvents: 1, minInteractions: 1 }, prerequisites: [], pacing: c.pacing || 'standard', targetWordCount: Math.max(config.wordCountRange[0], Math.min(c.targetWordCount || 3000, config.wordCountRange[1]))
    }));
    return { chapters: processedChapters, newCharacters: newChars };
};

export const generateNextChapter = async (prevChapters: PlotChapter[], currentContext: string, worldSettings: WorldSettings, pendingEvents: ScheduledEvent[], apiKey?: string): Promise<PlotChapter> => {
    const ai = getClient(apiKey);
    const prompt = `Task: Generate NEXT chapter. Context: ${currentContext.substring(0, 500)}. Events: ${pendingEvents.filter(e => e.status === 'pending').map(e => e.description).join('; ')}. Output JSON PlotChapter.`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', contents: prompt, config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: { title: { type: Type.STRING }, summary: { type: Type.STRING }, targetWordCount: { type: Type.INTEGER }, keyEvents: { type: Type.STRING }, keyCharacters: { type: Type.ARRAY, items: { type: Type.STRING } }, pacing: { type: Type.STRING } }
            }
        }
    });
    const rawChapter = JSON.parse(cleanJson(response.text || "{}"));
    return { ...rawChapter, id: generateUUID(), status: 'pending', trackedStats: { currentWordCount: 0, eventsTriggered: 0, interactionsCount: 0 }, completionCriteria: { minKeyEvents: 1, minInteractions: 1 }, prerequisites: [prevChapters[prevChapters.length-1]?.title ? `完成章节: ${prevChapters[prevChapters.length-1].title}` : ""] };
};

export const generateSceneImage = async (prompt: string, size: ImageSize, style: string, characterInfo: string, customStyle: string = '', modelName: string = 'gemini-2.5-flash-image-preview', modelScopeKey?: string, shotSize?: ShotSize, refImageBase64?: string, apiKey?: string, modelScopeUrl?: string): Promise<string> => {
    if (modelScopeKey && (modelName === 'Qwen/Qwen-Image' || modelName === 'MusePublic/FLUX.1')) {
        try {
            const baseUrl = modelScopeUrl || 'https://modelscope.cn/api/v1';
            const response = await fetch(`${baseUrl}/inference/text-to-image`, {
                method: 'POST', headers: { 'Authorization': `Bearer ${modelScopeKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelName, input: { prompt: `${prompt}, ${style}, ${customStyle}` }, parameters: { size: "1024x1024" } })
            });
            if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.Message || err.message || "ModelScope Error"); }
            const data = await response.json();
            if (data.output?.img) return data.output.img;
        } catch (e: any) {
            console.warn("ModelScope failed", e);
            if (e.name === 'TypeError') throw new Error("CORS Error");
            throw e;
        }
    }
    return withModelFallback(modelName, IMAGE_MODEL_FALLBACKS, async (model) => {
        const ai = getClient(apiKey);
        const shotPrompt = shotSize ? shotSize.replace(/_/g, ' ').toLowerCase() : 'cinematic shot';
        const finalPrompt = `${shotPrompt}, ${prompt}, style of ${style}, ${customStyle}. ${characterInfo}. 8k, no text.`;
        const response = await ai.models.generateContent({ model: model, contents: { parts: [{ text: finalPrompt }] } });
        for (const candidate of response.candidates || []) {
            for (const part of candidate.content.parts) {
                if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        throw new Error("No image generated");
    });
};

export const generateCharacterDetails = async (genre: StoryGenre, name: string, role: string, gender: string, category: string, existingPersonality?: string, existingAppearance?: string, apiKey?: string): Promise<{personality: string, appearance: string}> => {
    const ai = getClient(apiKey);
    const prompt = `Task: Brief persona for ${name} (${role}) in ${genre}. Personality: ${existingPersonality || 'New'}, Appearance: ${existingAppearance || 'New'}. Simplified Chinese. Output JSON.`;
    try {
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json" } });
        return JSON.parse(cleanJson(response.text || "{}"));
    } catch (e) { return { personality: "神秘", appearance: "面容模糊" }; }
};

export const generateSkillDescription = async (genre: StoryGenre, skillName: string, charName: string, apiKey?: string): Promise<string> => {
    const ai = getClient(apiKey);
    const prompt = `Skill ${skillName} for ${charName} in ${genre}. Under 30 words. Chinese.`;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return response.text || "";
};

export const parseStoryOutline = async (outline: string, apiKey?: string): Promise<any> => {
    const ai = getClient(apiKey);
    const prompt = `Analyze: "${outline}". Extract to JSON. Simplified Chinese. Schema: genre, character, worldSettings, supportingCharacters, plotBlueprint (extract explicit chapters if present).`;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json" } });
    return JSON.parse(cleanJson(response.text || "{}"));
};

export const summarizeHistory = async (history: StorySegment[], model: string, apiKey?: string): Promise<string> => {
    const ai = getClient(apiKey);
    const prompt = `Summarize story. Max 200 words. Chinese.\n\n${history.map(h => h.text).join('\n')}`;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return response.text || "";
};

export const generateCharacterAvatar = async (genre: StoryGenre, char: {name: string, gender: string, trait?: string, personality?: string, appearance?: string}, style: string, modelName: string, customStyle: string = '', modelScopeKey?: string, refImage?: string, apiKey?: string): Promise<string> => {
    const prompt = `Portrait of ${char.gender} character, ${char.appearance || char.trait || char.personality}. ${genre} style. VTuber/Anime style. No text.`;
    return generateSceneImage(prompt, ImageSize.SIZE_1K, style, "", customStyle, modelName, modelScopeKey, ShotSize.CLOSE_UP, refImage, apiKey);
};

export const validateModelScopeConnection = async (key: string, url?: string): Promise<string> => {
    try {
        const baseUrl = url || 'https://modelscope.cn/api/v1';
        const response = await fetch(`${baseUrl}/user/me`, { headers: { 'Authorization': `Bearer ${key}` } });
        if (response.ok) return "连接成功";
        throw new Error("Invalid Key");
    } catch (e: any) { throw new Error(e.message || "连接失败"); }
};

export const validateGeminiConnection = async (apiKey: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'test' });
        return "连接成功";
    } catch (e: any) { throw new Error("连接失败: API Key 无效"); }
};

export const fetchOpenAICompatibleModels = async (url: string, apiKey: string): Promise<string[]> => {
    let baseUrl = url.trim().replace(/\/$/, '').replace(/\/(chat\/completions|completions|models)$/, '');
    const endpointUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`;
    try {
        const response = await fetch(endpointUrl, { method: 'GET', headers: { 'Authorization': `Bearer ${apiKey}` } });
        if (!response.ok) throw new Error(`Error ${response.status}`);
        const data = await response.json();
        return data.data?.map((m: any) => m.id).filter((id: string) => id && !id.includes('embed')) || [];
    } catch (e: any) { throw e; }
};
