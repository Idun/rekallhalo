import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { StoryGenre, Character, StorySegment, ImageSize, SupportingCharacter, StoryMood, generateUUID, WorldSettings, Skill, AvatarStyle, MemoryState, ImageModel, ShotSize, ScheduledEvent, PlotChapter } from '../types';
// FIX: Corrected typo from NATIVE_STRUCTURES to NARRATIVE_STRUCTURES
import { WULIN_CONTEXT, WESTERN_FANTASY_CONTEXT, NARRATIVE_STRUCTURES, NARRATIVE_TECHNIQUES } from '../constants';

// Initialize client with the env key.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Safety Settings ---
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
];

// --- Fallback Configuration ---
const TEXT_MODEL_FALLBACKS: Record<string, string[]> = {
    'gemini-2.5-pro': ['gemini-2.5-flash'],
    'gemini-3-pro-preview': ['gemini-2.5-flash'],
    'gemini-2.5-flash': ['gemini-flash-lite-latest'],
};

const IMAGE_MODEL_FALLBACKS: Record<string, string[]> = {
    'gemini-2.5-flash-image-preview': ['gemini-2.5-flash-image'],
};

// Generic Retry Helper
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
            console.warn(`Model ${model} failed. Trying fallback if available. Error:`, error);
            lastError = error;
        }
    }
    throw lastError || new Error(`All models failed for ${primaryModel}`);
}

// --- World Building Contexts ---
const getWorldContext = (genre: StoryGenre): string => {
  if (genre === StoryGenre.XIANXIA || genre === StoryGenre.WUXIA) {
    return WULIN_CONTEXT;
  }
  if (genre === StoryGenre.FANTASY) {
    return WESTERN_FANTASY_CONTEXT;
  }
  return ""; 
};

// --- Helper Functions ---

const cleanJson = (text: string): string => {
  if (!text) return "{}";
  let cleaned = text;
  cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*$/g, '');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  cleaned = cleaned.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');
  return cleaned.trim();
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
    triggeredEventId: { type: Type.STRING, nullable: true, description: "If a specific pending scheduled event was successfully realized or completed in this scene, return its ID here." },
    affinityUpdates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
            characterName: { type: Type.STRING },
            change: { type: Type.INTEGER }
        },
        required: ["characterName", "change"]
      },
      nullable: true
    },
    memoryUpdate: {
        type: Type.OBJECT,
        properties: {
            memoryZone: { type: Type.STRING },
            storyMemory: { type: Type.STRING },
            longTermMemory: { type: Type.STRING },
            coreMemory: { type: Type.STRING },
            characterRecord: { type: Type.STRING },
            inventory: { type: Type.STRING }
        },
        required: ["memoryZone", "storyMemory", "longTermMemory", "coreMemory", "characterRecord", "inventory"]
    }
  },
  required: ["text", "choices", "visualPrompt", "mood", "memoryUpdate"]
};

// --- Main AI Functions ---

export const generateOpening = async (
    genre: StoryGenre, 
    character: Character, 
    supportingCharacters: SupportingCharacter[],
    worldSettings: WorldSettings,
    modelName: string,
    customGenre?: string,
    storyName?: string,
    customPrompt?: string,
    narrativeMode?: string,
    narrativeTechnique?: string,
    plotBlueprint: PlotChapter[] = []
): Promise<StorySegment> => {
  
  const worldContext = getWorldContext(genre);
  
  const structure = NARRATIVE_STRUCTURES.find(s => s.id === narrativeMode);
  const technique = NARRATIVE_TECHNIQUES.find(t => t.id === narrativeTechnique);
  
  // If a blueprint exists, it defines the structure. Narrative settings become stylistic hints.
  const hasBlueprint = plotBlueprint && plotBlueprint.length > 0;

  const narrativeInstruction = `
    [NARRATIVE STYLE]
    ${hasBlueprint 
      ? `The story is guided by a plot blueprint. Apply the following as stylistic hints:
      - Structure Style: ${structure ? structure.name : 'Default'}
      - Technique Style: ${technique ? technique.name : 'Default'}`
      : `Apply the following narrative rules:
      - Structure: ${structure ? `${structure.name} - ${structure.description}` : 'Auto-adapt based on genre'}
      - Technique: ${technique ? `${technique.name} - ${technique.description}` : 'Auto-adapt based on context'}`
    }
    - Perspective: ${character.perspective === 'first' ? "FIRST PERSON ('I'/'我')" : character.perspective === 'second' ? "SECOND PERSON ('You'/'你')" : character.perspective === 'omniscient' ? "OMNISCIENT (All-knowing)" : "THIRD PERSON (Standard Novel)"}

    [CHOICES PERSPECTIVE RULE - CRITICAL]
    The text content of the 'choices' MUST match the selected perspective:
    - If 'first' ('I'): Choices should use "I" or imply self-action. e.g., "I draw my sword." or "Ask him about the map."
    - If 'second' ('You'): Choices should use "You" or Imperative. e.g., "Draw your sword."
    - If 'third' ('He/She/Name'): Choices should use the character's name or He/She. e.g., "${character.name} draws his sword."
    - If 'omniscient': Choices should describe the plot direction. e.g., "The hero draws his sword."
  `;

  let blueprintInstruction = "";
  const chapter1 = plotBlueprint.length > 0 ? plotBlueprint[0] : undefined;
  if (chapter1) {
      const pacingInstruction = chapter1.pacing === 'fast' 
          ? "PACING: FAST. Jump straight into action. Minimize heavy exposition. High stakes immediately."
          : chapter1.pacing === 'slow' 
          ? "PACING: SLOW. Focus on atmosphere, sensory details, and character introspection. Build the world slowly."
          : "PACING: STANDARD. Balanced progression.";

      blueprintInstruction = `
      [CURRENT CHAPTER OBJECTIVE]
      Title: ${chapter1.title}
      Context: ${chapter1.summary}
      Mandatory Key Events for this chapter: ${chapter1.keyEvents}
      Characters Involved: ${chapter1.keyCharacters.join(', ')}
      ${pacingInstruction}
      `;
  }

  const prompt = `
    Role: You are an advanced interactive fiction engine.
    Task: Generate the OPENING segment of a "${genre}" story.
    Language: Simplified Chinese (简体中文).
    
    [WORLD SETTING]
    ${worldContext}
    ${customGenre ? `Additional Context: ${customGenre}` : ''}
    ${storyName ? `Story Title: ${storyName}` : 'Please generate a creative title.'}
    Tone: ${worldSettings.tone}
    Harem Mode: ${worldSettings.isHarem ? 'Enabled' : 'Disabled'}
    Adult Themes: ${worldSettings.isAdult ? 'Allowed (Implicit)' : 'Disabled'}
    System Mechanics: ${worldSettings.hasSystem ? 'Enabled' : 'Disabled'}

    [PROTAGONIST]
    Name: ${character.name}
    Gender: ${character.gender}
    Traits: ${character.trait}
    Skills: ${character.skills.map(s => `${s.name} (${s.type})`).join(', ')}

    [SUPPORTING CHARACTERS]
    ${supportingCharacters.map(c => `- ${c.name} (${c.role}): ${c.personality || 'Unknown'}`).join('\n')}

    ${narrativeInstruction}
    ${blueprintInstruction}

    [CUSTOM INSTRUCTIONS]
    ${customPrompt || "Focus on immersive storytelling."}

    Ensure a high ratio of dialogue. Include at least 5 lines of dialogue in this opening segment to establish character voices.

    [OUTPUT REQUIREMENTS]
    1. text: The story content (approx 200-300 words). Highly engaging, "Golden 3 Chapters" rule.
    2. choices: 2-4 distinct options for the player.
    3. visualPrompt: A detailed English prompt for an image generator (Stable Diffusion/Midjourney style) describing the current scene. **CRITICAL: Describe SCENERY ONLY. Do NOT include characters, people, or the protagonist. Pure landscape/architecture/atmosphere.**
    4. mood: Select best fit from [PEACEFUL, BATTLE, TENSE, EMOTIONAL, MYSTERIOUS, VICTORY].
    5. activeCharacterName: Who is the main focus of this scene?
    6. location: Where does this take place?
    7. memoryUpdate: Initialize the memory zones. 'inventory' starts empty or with basic items.
    8. storyName: If not provided, generate a cool title.

    Response must be valid JSON matching the schema.
  `;

  return withModelFallback(modelName, TEXT_MODEL_FALLBACKS, async (model) => {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: storyResponseSchema,
            safetySettings: SAFETY_SETTINGS
        }
      });
      
      const json = JSON.parse(cleanJson(response.text || "{}"));
      return {
          id: generateUUID(),
          text: json.text,
          choices: json.choices,
          visualPrompt: json.visualPrompt,
          mood: json.mood,
          activeCharacterName: json.activeCharacterName,
          location: json.location,
          newMemories: json.memoryUpdate,
          chapterId: chapter1?.id,
          storyName: json.storyName
      };
  });
};

export const advanceStory = async (
    history: StorySegment[],
    userChoice: string,
    genre: StoryGenre,
    character: Character,
    supportingCharacters: SupportingCharacter[],
    worldSettings: WorldSettings,
    memories: MemoryState,
    modelName: string,
    customGenre?: string,
    customPrompt?: string,
    scheduledEvents: ScheduledEvent[] = [],
    narrativeMode?: string,
    narrativeTechnique?: string,
    plotBlueprint: PlotChapter[] = [],
    regenerationMode: 'full' | 'text' | 'choices' = 'full'
): Promise<StorySegment> => {
    
    const lastTurnIndex = history.length - 1;
    const historyWindow = [];
    
    if (lastTurnIndex > 0) {
        const prev = history[lastTurnIndex - 1];
        historyWindow.push(`Turn ${lastTurnIndex - 1}: ${prev.text.substring(0, 150)}... Choice: ${prev.causedBy}`);
    }
    if (lastTurnIndex >= 0) {
        const curr = history[lastTurnIndex];
        historyWindow.push(`Turn ${lastTurnIndex} (IMMEDIATE PAST): ${curr.text} \nUser Choice/Input: ${curr.causedBy}`);
    }

    const shouldInjectFullContext = history.length < 3;
    const worldContext = shouldInjectFullContext ? getWorldContext(genre) : `[Genre: ${genre}]`;

    const lastActiveName = history[lastTurnIndex]?.activeCharacterName || "";
    const sortedChars = [...supportingCharacters].sort((a, b) => 
        ((b.affinity || 0) - (a.affinity || 0)) 
    );
    
    const relevantChars = sortedChars.filter((c, idx) => {
        const isKey = idx < 5; 
        const isActive = lastActiveName.includes(c.name);
        return isKey || isActive;
    }).slice(0, 8); 

    const charListString = relevantChars.map(c => 
        `- ${c.name} (${c.role}, Aff:${c.affinity||0}, Gender:${c.gender})`
    ).join('\n');
    
    const structure = NARRATIVE_STRUCTURES.find(s => s.id === narrativeMode);
    const technique = NARRATIVE_TECHNIQUES.find(t => t.id === narrativeTechnique);
    const hasBlueprint = plotBlueprint && plotBlueprint.length > 0;

    const narrativeInstruction = `
      [NARRATIVE STYLE]
      ${hasBlueprint 
        ? `The story is guided by a plot blueprint. Apply the following as stylistic hints:
        - Structure Style: ${structure ? structure.name : 'Default'}
        - Technique Style: ${technique ? technique.name : 'Default'}`
        : `Apply the following narrative rules:
        - Structure: ${structure ? `${structure.name} - ${structure.description}` : 'Auto-adapt based on genre'}
        - Technique: ${technique ? `${technique.name} - ${technique.description}` : 'Auto-adapt based on context'}`
      }
      - Perspective: ${character.perspective === 'first' ? "FIRST PERSON ('I'/'我')" : character.perspective === 'second' ? "SECOND PERSON ('You'/'你')" : character.perspective === 'omniscient' ? "OMNISCIENT" : "THIRD PERSON"}

      [CHOICES PERSPECTIVE RULE - CRITICAL]
      The text content of the 'choices' MUST match the selected perspective:
      - If 'first' ('I'): Choices should use "I" or imply self-action. e.g., "I draw my sword." or "Ask him about the map."
      - If 'second' ('You'): Choices should use "You" or Imperative. e.g., "Draw your sword."
      - If 'third' ('He/She/Name'): Choices should use the character's name or He/She. e.g., "${character.name} draws his sword."
      - If 'omniscient': Choices should describe the plot direction. e.g., "The hero draws his sword."
    `;

    const pendingEvents = scheduledEvents.filter(e => e.status === 'pending');
    let eventsInstruction = "";
    if (pendingEvents.length > 0) {
        eventsInstruction = `
        [PENDING GLOBAL EVENTS]
        The user has these floating plot points waiting to happen. If appropriate, weave ONE into the story naturally.
        ${pendingEvents.map(e => `(ID:${e.id}) ${e.type}: ${e.description}`).join('\n')}
        **CRITICAL**: Only return a 'triggeredEventId' if the event, as described, has been **fully and explicitly completed** within the generated 'text'. A partial match (like matching a keyword) is NOT sufficient. If no event is fully completed, return 'null' for 'triggeredEventId'.
        `;
    }

    let blueprintInstruction = "";
    let pacingAndWordCountInstruction = "Write a story segment of about 250-350 words.";
    let activeChapter = plotBlueprint.find(c => c.status === 'active');
    if (plotBlueprint.length > 0) {
        let activeChapterIndex = activeChapter ? plotBlueprint.findIndex(c => c.id === activeChapter!.id) : -1;

        if (!activeChapter) {
            activeChapterIndex = plotBlueprint.findIndex(c => c.status !== 'completed');
            if (activeChapterIndex === -1) { // all completed
                activeChapterIndex = plotBlueprint.length - 1;
            }
            activeChapter = plotBlueprint[activeChapterIndex];
        }

        if (activeChapter) {
            const pacing = activeChapter.pacing || 'standard';
            if (pacing === 'slow') {
                pacingAndWordCountInstruction = "Pacing is SLOW. Focus on rich descriptions, character thoughts, and atmosphere. Generate a longer segment, around 350-450 words.";
            } else if (pacing === 'fast') {
                pacingAndWordCountInstruction = "Pacing is FAST. Focus on action, direct dialogue, and moving the plot forward. Generate a concise segment, around 200-250 words.";
            }

            const pastChapters = plotBlueprint.slice(0, activeChapterIndex);
            const pastChaptersSummary = pastChapters.length > 0 ? `PAST (Completed Chapters):\n- ${pastChapters.map(c => c.title).join('\n- ')}\n` : 'PAST (Completed Chapters): None.\n';

            const completionStatus = activeChapter.trackedStats ? `Progress: Words(${activeChapter.trackedStats.currentWordCount}/${activeChapter.targetWordCount}), Events(${activeChapter.trackedStats.eventsTriggered}), Interactions(${activeChapter.trackedStats.interactionsCount})` : "";
            
            const presentChapterDetails = `
PRESENT (Current Chapter: ${activeChapter.title}):
Context: ${activeChapter.summary}
MANDATORY KEY EVENTS: ${activeChapter.keyEvents}
Key Characters to include: ${activeChapter.keyCharacters.join(', ')}
${pacingAndWordCountInstruction}
${completionStatus}
Focus on progressing towards these Key Events.
`;

            const futureChapters = plotBlueprint.slice(activeChapterIndex + 1, activeChapterIndex + 3);
            const futureChaptersSummary = futureChapters.length > 0 ? `FUTURE (Upcoming Chapters Preview):\n${futureChapters.map(c => `- ${c.title}: ${c.summary}`).join('\n')}\n` : 'FUTURE (Upcoming Chapters Preview): This is the final chapter.\n';

            blueprintInstruction = `
[PLOT BLUEPRINT OVERVIEW]
This provides the overarching narrative structure. Use this context to guide the story, create foreshadowing, and ensure smooth transitions between chapters.

${pastChaptersSummary}
${presentChapterDetails}
${futureChaptersSummary}
            `;
        }
    }

    let regenInstruction = "";
    if (regenerationMode === 'choices') {
        regenInstruction = `
        [TASK: REGENERATE CHOICES ONLY]
        The user is happy with the story context but dislikes the available options.
        1. Keep the 'text' field roughly the same as the context (or a concise summary of it), or output an empty string if not changing.
        2. Focus entirely on generating 4 NEW, DISTINCT, and CREATIVE 'choices' that fit the current situation.
        3. Ensure choices align with the Plot Blueprint and any Pending Events if possible.
        `;
    } else if (regenerationMode === 'text') {
        regenInstruction = `
        [TASK: REWRITE STORY TEXT]
        The user wants the narrative description rewritten (better style, more detail, or different tone).
        1. Keep the plot outcome effectively the same as before, but change the prose/wording.
        2. Generate choices that fit this new text version.
        `;
    } else {
        regenInstruction = `
        [TASK: CONTINUE STORY]
        Generate the next segment of the story based on the user's choice.
        `;
    }

    const prompt = `
      Role: Interactive fiction engine.
      Task: ${regenerationMode === 'choices' ? 'Generate new choices' : 'Continue the story'}.
      Language: Simplified Chinese.

      [SETTING]
      ${worldContext}
      ${customGenre ? `Context: ${customGenre}` : ''}
      Tone: ${worldSettings.tone}
      System: ${worldSettings.hasSystem ? 'On' : 'Off'}

      [CHARACTERS]
      Protagonist: ${character.name}
      Key NPCs:
      ${charListString}

      [STATE]
      Location: ${history[lastTurnIndex].location}
      Mood: ${history[lastTurnIndex].mood}
      
      [MEMORIES]
      Recent: ${memories.storyMemory}
      Core: ${memories.coreMemory}
      Items: ${memories.inventory}

      [RECENT HISTORY]
      ${historyWindow.join('\n\n')}

      [USER INPUT]
      "${userChoice}"

      ${narrativeInstruction}
      ${blueprintInstruction}
      ${eventsInstruction}
      ${regenInstruction}

      [RULES]
      ${pacingAndWordCountInstruction}
      ${customPrompt || ""}
      1. High dialogue ratio.
      2. If 'Recent Story' memory is getting too long (>500 words), SUMMARIZE older events into it and compress.
      3. VISUAL PROMPT: Keep it concise. Scenery only. No humans.

      [OUTPUT REQUIREMENTS]
      1. triggeredEventId: ID of event completed this turn (or null).
      2. memoryUpdate: Update all fields. CRITICAL: Compress 'storyMemory' if needed.
      3. **CHOICES GENERATION (CRITICAL)**:
         - Provide 2-4 distinct options.
         - **PLOT ALIGNMENT**: At least one choice MUST specifically attempt to advance the '[CURRENT CHAPTER]' objectives or trigger a '[PENDING GLOBAL EVENT]'.
         - Do not make choices generic. Make them specific to the current context and plot goals.
         - Avoid generic options like 'wait and see' or 'look around'. All choices must be proactive and specific to the scene. The primary goal is to provide options that move the story towards the goals outlined in the Plot Blueprint.

      Return valid JSON matching the schema.
    `;

    return withModelFallback(modelName, TEXT_MODEL_FALLBACKS, async (model) => {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: storyResponseSchema,
                safetySettings: SAFETY_SETTINGS
            }
        });

        const json = JSON.parse(cleanJson(response.text || "{}"));
        return {
            id: generateUUID(),
            text: json.text,
            choices: json.choices,
            visualPrompt: json.visualPrompt,
            mood: json.mood,
            activeCharacterName: json.activeCharacterName,
            location: json.location,
            affinityChanges: json.affinityUpdates ? 
                json.affinityUpdates.reduce((acc: any, curr: any) => ({...acc, [curr.characterName]: curr.change}), {}) 
                : undefined,
            newMemories: json.memoryUpdate,
            triggeredEventId: json.triggeredEventId,
            chapterId: activeChapter?.id
        };
    });
};

// --- Other AI Services ---

export const generateSceneImage = async (
    prompt: string, 
    size: ImageSize, 
    style: string, 
    characterInfo: string, 
    customStyle: string = '',
    modelName: string = 'gemini-2.5-flash-image-preview',
    modelScopeKey?: string,
    shotSize?: ShotSize,
    refImageBase64?: string
): Promise<string> => {
    
    // ModelScope Integration
    if (modelScopeKey && (modelName === 'Qwen/Qwen-Image' || modelName === 'MusePublic/FLUX.1')) {
        try {
            const response = await fetch(`https://modelscope.cn/api/v1/inference/text-to-image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${modelScopeKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelName,
                    input: { prompt: `${prompt}, ${style}, ${customStyle}` },
                    parameters: { size: "1024x1024" }
                })
            });
            const data = await response.json();
            if (data.output?.img) return data.output.img; // Base64 or URL
        } catch (e) {
            console.warn("ModelScope failed, falling back to Gemini", e);
        }
    }

    // Gemini Image Generation
    return withModelFallback(modelName, IMAGE_MODEL_FALLBACKS, async (model) => {
        const shotPrompt = shotSize ? shotSize.replace(/_/g, ' ').toLowerCase() : 'cinematic shot';
        const negativeConstraints = "NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY, NO WATERMARKS, NO SIGNATURES, NO LABELS, NO HUD, NO UI, NO SPEECH BUBBLES.";
        
        const finalPrompt = `${shotPrompt}, ${prompt}, style of ${style}, ${customStyle}. ${characterInfo ? `Visual details: ${characterInfo}` : ''}. High quality, detailed, 8k. ${negativeConstraints}`;
        
        const response = await ai.models.generateContent({
            model: model,
            contents: {
                parts: [
                    { text: finalPrompt }
                ]
            }
        });

        for (const candidate of response.candidates || []) {
            for (const part of candidate.content.parts) {
                if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        throw new Error("No image generated");
    });
};

export const generateCharacterDetails = async (
    genre: StoryGenre, 
    name: string, 
    role: string, 
    gender: string, 
    category: string,
    existingPersonality?: string,
    existingAppearance?: string
): Promise<{personality: string, appearance: string}> => {

    let instruction = "";
    if (existingPersonality || existingAppearance) {
        instruction = `
        User has provided some starting ideas. Your task is to **refine and summarize** these into a polished, concise description.
        - ${existingPersonality ? `Personality to refine: "${existingPersonality}"` : 'Generate "personality" from scratch.'}
        - ${existingAppearance ? `Appearance to refine: "${existingAppearance}"` : 'Generate "appearance" from scratch.'}
        
        Capture the core essence of the provided details. **Do not expand or add excessive detail.**
        `;
    } else {
        instruction = "Generate the 'personality' and 'appearance' from scratch based on the character's role. Be brief and impactful.";
    }

    const prompt = `
        You are a creative writer's assistant.
        Task: Create a **very brief and concise** persona for a character in a "${genre}" story.
        Name: ${name}, Role: ${role}, Gender: ${gender}, Type: ${category}.
        
        ${instruction}

        Rules:
        1.  **Be extremely concise.** Each field should be one or two sentences at most.
        2.  For 'personality', provide a few key descriptive words.
        3.  For 'appearance', provide a short, evocative visual description.
        4.  Language: Simplified Chinese.

        Output JSON with 'personality' and 'appearance'. Example:
        {
          "personality": "傲娇, 毒舌",
          "appearance": "银色短发，眼角下有一颗泪痣，总是穿着不合身的旧夹克。"
        }
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJson(response.text || "{}"));
    } catch (e) {
        return { personality: "神秘", appearance: "面容模糊" };
    }
};

export const generateSkillDescription = async (genre: StoryGenre, skillName: string, charName: string): Promise<string> => {
    const prompt = `Describe the effect of skill "${skillName}" for character "${charName}" in a ${genre} setting. Keep it under 30 words. Chinese.`;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return response.text || "";
};

export const parseStoryOutline = async (outline: string): Promise<any> => {
    const prompt = `
        Analyze this story outline: "${outline}".
        Extract the key information into a JSON object. Use Simplified Chinese for all string values (except enum keys).

        [IMPORTANT INSTRUCTION FOR PLOT BLUEPRINT]
        1. **PRIORITY**: If the outline text contains explicit chapter breakdowns, tables of contents, or structured plot points (e.g. "Chapter 1: ...", "Part 1: ...", "First Arc: ..."), you **MUST EXTRACT** these existing chapters exactly as described into the "plotBlueprint" array. Do NOT invent new chapters if the user provided them.
        2. **FALLBACK**: Only if the outline is a general summary without specific chapter structure should you creatively propose a new "plotBlueprint".
        3. Ensure "keyCharacters" in the blueprint match names in "supportingCharacters" or "character".
        4. **PREREQUISITES**: If the outline mentions that a chapter or event depends on something (e.g. "After finding the sword...", "Must defeat X first"), extract these conditions into the "prerequisites" array for that chapter. If no prerequisites are mentioned, leave the array empty. **DO NOT invent prerequisites.**
        
        Output JSON Format:
        {
          "genre": "XIANXIA | WUXIA | ROMANCE | SUPERHERO | CYBERPUNK | FANTASY",
          "character": { 
              "name": "string", 
              "gender": "male | female | other", 
              "trait": "string",
              "skills": [
                  { "name": "string", "description": "string", "type": "active | passive" }
              ]
          },
          "worldSettings": { "tone": "PEACEFUL | BATTLE | TENSE | EMOTIONAL | MYSTERIOUS | VICTORY", "isHarem": "boolean", "isAdult": "boolean", "hasSystem": "boolean" },
          "supportingCharacters": [
            { "name": "string", "role": "string", "gender": "male | female | other", "personality": "string", "appearance": "string", "category": "protagonist | supporting | villain | other" }
          ],
          "plotBlueprint": [
             {
               "title": "string",
               "summary": "string",
               "targetWordCount": "integer (approx 3000-5000)",
               "keyEvents": "string (comma separated list of events)",
               "keyCharacters": ["string (names of characters involved)"],
               "pacing": "fast | standard | slow",
               "prerequisites": ["string (optional conditions)"]
             }
          ]
        }

        Requirements:
        - Determine the most fitting "genre". If unsure, use "FANTASY".
        - "trait" should be a concise summary of the protagonist's personality and appearance.
        - Extract any mention of skills into "skills".
        - Identify key supporting characters.
        - Return ONLY the valid JSON object.
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJson(response.text || "{}"));
};

export const summarizeHistory = async (history: StorySegment[], model: string): Promise<string> => {
    const fullText = history.map(h => h.text).join('\n');
    const prompt = `Summarize the following story so far into a concise paragraph (max 200 words) for memory retention. Keep key plot points and status. Chinese.\n\n${fullText}`;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return response.text || "";
};

export const generateCharacterAvatar = async (
    genre: StoryGenre, 
    char: {name: string, gender: string, trait?: string, personality?: string, appearance?: string}, 
    style: string, 
    modelName: string,
    customStyle: string = '',
    modelScopeKey?: string,
    refImage?: string
): Promise<string> => {
    const visualDesc = char.appearance || char.trait || char.personality || "mysterious figure";
    const subject = `A ${char.gender} character`; 
    
    const prompt = `masterpiece, best quality, close up solo portrait of ${subject}, ${visualDesc}. ${genre} style. ${customStyle}. 参考二次元游戏立绘、Vtuber 皮套设计与插画，形象为日系二次元风，避免美漫风与韩漫“整容感”风格。 pure visual art, no text, no watermark, no signature.`;
    
    return generateSceneImage(prompt, ImageSize.SIZE_1K, style, "", customStyle, modelName, modelScopeKey, ShotSize.CLOSE_UP, refImage);
};

export const validateModelScopeConnection = async (key: string): Promise<string> => {
    try {
        const response = await fetch(`https://modelscope.cn/api/v1/user/me`, {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        if (response.ok) return "连接成功";
        throw new Error("Invalid Key");
    } catch (e) {
        return "连接失败（注意：CORS 可能阻止浏览器请求）";
    }
};