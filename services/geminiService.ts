
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { StoryGenre, Character, StorySegment, ImageSize, SupportingCharacter, StoryMood, generateUUID, WorldSettings, Skill, AvatarStyle, MemoryState, ImageModel, ShotSize, ScheduledEvent, PlotChapter } from '../types';
import { WULIN_CONTEXT, WESTERN_FANTASY_CONTEXT, NARRATIVE_STRUCTURES, NARRATIVE_TECHNIQUES, CHARACTER_ARCHETYPES } from '../constants';

// Initialize client with the env key.
// Note: We access process.env.API_KEY directly here for the default instance, 
// but functional calls use the dynamic key passed from UI/State.
const getClient = (apiKey?: string) => new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY });

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
  let cleaned = text.replace(/```json\s*|```/gi, '').trim();
  
  // Robustly find the start and end of the JSON structure
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  
  let startIndex = -1;
  let endIndex = -1;
  let isArray = false;

  // Determine if it's an object or an array based on which comes first
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIndex = firstBrace;
      endIndex = cleaned.lastIndexOf('}');
  } else if (firstBracket !== -1) {
      startIndex = firstBracket;
      endIndex = cleaned.lastIndexOf(']');
      isArray = true;
  }
  
  if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
      cleaned = cleaned.substring(startIndex, endIndex + 1);
  } else {
      // Fallback: if structure is broken, try to wrap if it looks like a list
      return "{}"; 
  }
  
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

// --- Helper: Perspective Rules Generation ---
const getPerspectiveInstruction = (perspective: string | undefined, charName: string): string => {
    const p = perspective || 'third';
    let rules = "";
    
    switch (p) {
        case 'first':
            rules = `**STRICT FIRST PERSON (POV: "I" / "我")**. The protagonist refers to themselves as "I". You are the protagonist. Never use "You" to address the protagonist.`;
            break;
        case 'second':
            rules = `**STRICT SECOND PERSON (POV: "You" / "你")**. Address the protagonist as "You". This is a standard interactive fiction style.`;
            break;
        case 'omniscient':
            rules = `**STRICT OMNISCIENT VIEW (God View)**. 
            1. The narrator is a detached, all-knowing observer.
            2. **FORBIDDEN**: Do NOT use "You" (你) or "I" (我) in the narration.
            3. **MANDATORY**: Refer to the protagonist by their Name ("${charName}") or third-person pronouns (He/She).
            4. Focus on the broader scope, world details, and multiple characters' thoughts simultaneously.`;
            break;
        case 'third':
        default:
            rules = `**STRICT THIRD PERSON (POV: "${charName}" / "He" / "She")**.
            1. Refer to the protagonist by Name or He/She.
            2. **FORBIDDEN**: Do NOT use "You" (你) or "I" (我) in the narration (except inside dialogue spoken by characters).`;
            break;
    }

    return `
    [NARRATIVE PERSPECTIVE RULES - CRITICAL]
    ${rules}
    
    [CHOICES STYLE]
    - If First Person: Choices use "I" (e.g., "I attack").
    - If Second Person: Choices use "You" or Imperative (e.g., "Attack").
    - If Third/Omniscient: Choices use the character's Name or descriptive action (e.g., "${charName} attacks").
    `;
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
    plotBlueprint: PlotChapter[] = [],
    apiKey?: string
): Promise<StorySegment> => {
  
  const ai = getClient(apiKey);
  const worldContext = getWorldContext(genre);
  
  const structure = NARRATIVE_STRUCTURES.find(s => s.id === narrativeMode);
  const technique = NARRATIVE_TECHNIQUES.find(t => t.id === narrativeTechnique);
  
  // If a blueprint exists, it defines the structure. Narrative settings become stylistic hints.
  const hasBlueprint = plotBlueprint && plotBlueprint.length > 0;

  const perspectiveInstruction = getPerspectiveInstruction(character.perspective, character.name);

  const narrativeInstruction = `
    [NARRATIVE ARCHITECTURE]
    ${hasBlueprint 
      ? `The story is guided by a plot blueprint. Apply the following as stylistic hints:
      - Structure Style: ${structure ? structure.name : 'Default'}
      - Technique Style: ${technique ? technique.name : 'Default'}`
      : `Apply the following narrative rules:
      - Structure: ${structure ? `${structure.name} - ${structure.description}` : 'Auto-adapt based on genre'}
      - Technique: ${technique ? `${technique.name} - ${technique.description}` : 'Auto-adapt based on context'}`
    }
    
    ${perspectiveInstruction}
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

    [SUPPORTING CHARACTERS / FACTIONS]
    ${supportingCharacters.map(c => {
        const isOrg = c.category === 'other';
        return `- ${c.name} (${isOrg ? 'Organization/Faction' : c.role}): ${c.personality || 'Unknown'}`;
    }).join('\n')}

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
    regenerationMode: 'full' | 'text' | 'choices' = 'full',
    apiKey?: string
): Promise<StorySegment> => {
    
    const ai = getClient(apiKey);
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

    const charListString = relevantChars.map(c => {
        const isOrg = c.category === 'other';
        return `- ${c.name} (${isOrg ? 'Organization/Faction' : c.role}, Aff:${c.affinity||0}, Gender:${c.gender})`;
    }).join('\n');
    
    const structure = NARRATIVE_STRUCTURES.find(s => s.id === narrativeMode);
    const technique = NARRATIVE_TECHNIQUES.find(t => t.id === narrativeTechnique);
    const hasBlueprint = plotBlueprint && plotBlueprint.length > 0;

    const perspectiveInstruction = getPerspectiveInstruction(character.perspective, character.name);

    const narrativeInstruction = `
      [NARRATIVE ARCHITECTURE]
      ${hasBlueprint 
        ? `The story is guided by a plot blueprint. Apply the following as stylistic hints:
        - Structure Style: ${structure ? structure.name : 'Default'}
        - Technique Style: ${technique ? technique.name : 'Default'}`
        : `Apply the following narrative rules:
        - Structure: ${structure ? `${structure.name} - ${structure.description}` : 'Auto-adapt based on genre'}
        - Technique: ${technique ? `${technique.name} - ${technique.description}` : 'Auto-adapt based on context'}`
      }
      
      ${perspectiveInstruction}
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

// ... (rest of the file remains unchanged for auxiliary functions like autoPlanBlueprint etc.) ...

export const autoPlanBlueprint = async (
    genre: StoryGenre,
    character: Character,
    worldSettings: WorldSettings,
    outline: string,
    existingCharacters: SupportingCharacter[] = [],
    existingChapters: PlotChapter[] = [],
    config: { chapterCount: number, wordCountRange: [number, number], newCharCount: number, newOrgCount: number, customGuidance?: string } = { chapterCount: 3, wordCountRange: [3000, 5000], newCharCount: 3, newOrgCount: 1 },
    narrativeMode?: string,
    narrativeTechnique?: string,
    apiKey?: string
): Promise<{ chapters: PlotChapter[], newCharacters: any[] }> => {
    
    const ai = getClient(apiKey);
    // Determine mode: Continuation or Fresh Start
    const isContinuation = existingChapters.length > 0;
    
    // Resolve Narrative Settings
    const structure = NARRATIVE_STRUCTURES.find(s => s.id === narrativeMode);
    const technique = NARRATIVE_TECHNIQUES.find(t => t.id === narrativeTechnique);

    const narrativeInstruction = `
    [NARRATIVE ARCHITECTURE]
    - Structure: ${structure ? `${structure.name} (${structure.description})` : 'Standard Linear'}
    - Technique: ${technique ? `${technique.name} (${technique.description})` : 'Standard'}
    
    **CRITICAL INSTRUCTION**: You MUST structure the plot chapters to reflect the selected Narrative Structure and Technique. 
    - If "Non-linear", the chapter sequence should reflect temporal jumps.
    - If "Parallel Narrative", chapters should alternate between perspectives or storylines.
    - If "Embedded Narrative", plan chapters that serve as frames or nested stories.
    `;

    // Construct Prompt Context
    let contextInstruction = "";
    if (isContinuation) {
        // Optimize Token Usage: Only send last 1-2 chapters summary
        const recentChapters = existingChapters.slice(-2);
        const summaries = recentChapters.map(c => `Chapter [${c.title}]: ${c.summary}`).join('\n');
        
        contextInstruction = `
        [EXISTING PLOT CONTEXT]
        The story is already in progress. 
        Recent Chapters Summary:
        ${summaries}
        
        [TASK]
        Generate ${config.chapterCount} NEW subsequent chapters that naturally continue the story arc from the above point.
        DO NOT regenerate existing chapters. Start from the next logical plot point.
        `;
    } else {
        contextInstruction = `
        [TASK]
        Design a fresh plot blueprint from scratch.
        Generate the first ${config.chapterCount} chapters of the story.
        `;
    }

    const archetypeList = CHARACTER_ARCHETYPES.map(a => a.name).join(', ');

    const prompt = `
    Role: Professional Novel Editor and Plot Architect.
    
    [INPUTS]
    - Genre: ${genre}
    - Protagonist: ${character.name} (${character.gender}, ${character.trait})
    - Tone: ${worldSettings.tone}
    - Outline/Theme: "${outline || 'Standard genre progression'}"
    - Harem: ${worldSettings.isHarem}, System: ${worldSettings.hasSystem}
    
    ${narrativeInstruction}

    ${contextInstruction}

    [CONFIGURATION]
    - Target Word Count per Chapter: ${config.wordCountRange[0]} - ${config.wordCountRange[1]}
    - New Characters needed: Approx ${config.newCharCount} (if story requires)
    - New Organizations/Factions needed: Approx ${config.newOrgCount} (if story requires)

    ${config.customGuidance ? `
    [USER PLOT DIRECTION GUIDANCE]
    **HIGH PRIORITY**: The user has provided specific direction for these chapters. You MUST follow this guidance for the plot flow:
    "${config.customGuidance}"
    ` : ''}

    [EXISTING CHARACTERS]
    The user has already defined these characters. **PRIORITIZE** using them in 'keyCharacters' where appropriate.
    Note: Characters with category='other' represent organizations/factions.
    ${existingCharacters.map(c => `- ${c.name} (${c.category === 'other' ? 'Faction/Org' : c.role})`).join('\n')}

    [STRICT CONSTRAINTS]
    1. **Language**: STRICTLY SIMPLIFIED CHINESE ONLY. No English.
    2. **Conciseness**: Limit summary to ~100 words. Bullet-point style.
    3. **Titles**: Short, punchy (2-6 chars). 4-char idioms preferred for Wuxia/Xianxia.
    4. **Key Characters**: Mix existing characters with new ones.
    5. **New Characters**: If you introduce new key roles not in the existing list, add them to 'newCharacters' output.
       - IMPORTANT: Assign random genders (Male, Female, or Other) to new characters to ensure variety.
       - IMPORTANT: If a new character is actually a Sect, Guild, or Organization, set "category" to "other" and "gender" to "organization".
       
    [ARCHETYPE RULES]
    For the "newCharacters" array:
    - If "category" is 'supporting' or 'villain': The "archetype" field MUST be exactly one of the following Simplified Chinese terms: [${archetypeList}]. Do NOT translate these to English.
    - If "category" is 'other' (Organization): The "archetype" field MUST be null or an empty string.

    Output a JSON object with two fields:
    1. "chapters": Array of PlotChapter objects (size: ${config.chapterCount}).
    2. "newCharacters": Array of objects for NEW characters introduced.
       Schema for newCharacters: { "name": "string", "role": "string", "gender": "male|female|other|organization", "personality": "string", "appearance": "string", "archetype": "string|null", "category": "supporting|villain|other" }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    chapters: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                summary: { type: Type.STRING },
                                targetWordCount: { type: Type.INTEGER },
                                keyEvents: { type: Type.STRING },
                                keyCharacters: { type: Type.ARRAY, items: { type: Type.STRING } },
                                pacing: { type: Type.STRING, enum: ['fast', 'standard', 'slow'] }
                            }
                        }
                    },
                    newCharacters: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                role: { type: Type.STRING },
                                gender: { type: Type.STRING, enum: ['male', 'female', 'other', 'organization'] },
                                personality: { type: Type.STRING },
                                appearance: { type: Type.STRING },
                                archetype: { type: Type.STRING, nullable: true },
                                category: { type: Type.STRING, enum: ['supporting', 'villain', 'other'] }
                            },
                            required: ["name", "role", "gender"]
                        }
                    }
                }
            }
        }
    });

    let rawData;
    try {
        const cleaned = cleanJson(response.text || "{}");
        rawData = JSON.parse(cleaned);
    } catch (e) {
        console.error("JSON parse error:", e);
        throw e;
    }

    // Support both direct array return (legacy/fallback) and object return
    let rawChapters = [];
    let newChars = [];

    if (Array.isArray(rawData)) {
        rawChapters = rawData;
    } else {
        if (rawData.chapters && Array.isArray(rawData.chapters)) {
            rawChapters = rawData.chapters;
        }
        if (rawData.newCharacters && Array.isArray(rawData.newCharacters)) {
            newChars = rawData.newCharacters;
        }
    }

    const processedChapters = rawChapters.map((c: any) => ({
        ...c,
        id: generateUUID(),
        status: 'pending',
        trackedStats: { currentWordCount: 0, eventsTriggered: 0, interactionsCount: 0 },
        completionCriteria: { minKeyEvents: 1, minInteractions: 1 },
        prerequisites: [],
        pacing: c.pacing || 'standard',
        // Ensure word count respects config if model hallucinated
        targetWordCount: Math.max(config.wordCountRange[0], Math.min(c.targetWordCount || 3000, config.wordCountRange[1]))
    }));

    return {
        chapters: processedChapters,
        newCharacters: newChars
    };
};

export const generateNextChapter = async (
    prevChapters: PlotChapter[],
    currentContext: string,
    worldSettings: WorldSettings,
    pendingEvents: ScheduledEvent[],
    apiKey?: string
): Promise<PlotChapter> => {
    const ai = getClient(apiKey);
    const lastChapter = prevChapters[prevChapters.length - 1];
    const pendingEventsText = pendingEvents.filter(e => e.status === 'pending').map(e => `${e.type}: ${e.description}`).join('; ');

    const prompt = `
    Role: Story Director.
    Task: The user has finished the planned chapters. Generate the NEXT chapter blueprint to continue the story infinitely.
    
    [CONTEXT]
    - Previous Chapters: ${prevChapters.map(c => c.title).slice(-3).join(', ')}...
    - Last Chapter Summary: ${lastChapter?.summary}
    - Current Story Context: ${currentContext.substring(0, 500)}...
    - Pending Scheduled Events (MUST incorporate one if possible): ${pendingEventsText}
    - Tone: ${worldSettings.tone}

    [REQUIREMENTS]
    1. **Language**: STRICTLY SIMPLIFIED CHINESE. No English.
    2. **Conciseness**: Keep summaries brief (~100 words).
    3. MAINTAIN CONSISTENCY: The title style must match previous chapters (short, Chinese only).
    4. PLOT PROGRESSION: Introduce a new conflict, journey, or revelation that naturally follows the last chapter.
    5. If there are pending events, ensure the 'keyEvents' of this new chapter provide an opportunity to trigger them.

    Output a SINGLE 'PlotChapter' object JSON.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    targetWordCount: { type: Type.INTEGER },
                    keyEvents: { type: Type.STRING },
                    keyCharacters: { type: Type.ARRAY, items: { type: Type.STRING } },
                    pacing: { type: Type.STRING }
                }
            }
        }
    });

    const rawChapter = JSON.parse(cleanJson(response.text || "{}"));
    return {
        ...rawChapter,
        id: generateUUID(),
        status: 'pending',
        trackedStats: { currentWordCount: 0, eventsTriggered: 0, interactionsCount: 0 },
        completionCriteria: { minKeyEvents: 1, minInteractions: 1 },
        prerequisites: [lastChapter?.title ? `完成章节: ${lastChapter.title}` : ""]
    };
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
    refImageBase64?: string,
    apiKey?: string,
    modelScopeUrl?: string
): Promise<string> => {
    
    // ModelScope Integration
    if (modelScopeKey && (modelName === 'Qwen/Qwen-Image' || modelName === 'MusePublic/FLUX.1')) {
        try {
            const baseUrl = modelScopeUrl || 'https://modelscope.cn/api/v1';
            // Use user/me for validation, but for image gen we need specific endpoints if available. 
            // Assuming standard ModelScope inference endpoint structure or proxy.
            // Note: Direct browser access to modelscope.cn/api/v1 often hits CORS.
            // User must provide a proxy URL in settings if direct access fails.
            
            // Standard inference endpoint for text-to-image usually involves task id polling or direct return.
            // For this demo/template, we simulate a standard synchronous post if possible, 
            // or assume the user has a proxy that handles the complex flow.
            // We'll try a generic inference call pattern.
            
            const response = await fetch(`${baseUrl}/inference/text-to-image`, {
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
            
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.Message || err.message || "ModelScope Error");
            }

            const data = await response.json();
            if (data.output?.img) return data.output.img; // Base64 or URL
        } catch (e: any) {
            console.warn("ModelScope failed, falling back to Gemini", e);
            if (e.name === 'TypeError' && (e.message === 'Failed to fetch' || e.message.includes('NetworkError'))) {
                 throw new Error("连接失败：浏览器阻止了请求 (CORS)。请确保您没有使用代理工具干扰，或者该 API 不支持浏览器直接访问。建议在设置中配置 CORS 代理 URL。");
            }
            throw e;
        }
    }

    // Gemini Image Generation
    return withModelFallback(modelName, IMAGE_MODEL_FALLBACKS, async (model) => {
        const ai = getClient(apiKey);
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
    existingAppearance?: string,
    apiKey?: string
): Promise<{personality: string, appearance: string}> => {
    const ai = getClient(apiKey);

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

    const isOrg = category === 'other';
    const fieldMapping = isOrg 
        ? "For Organizations/Factions: 'personality' = Core Tenets/Motto. 'appearance' = Scale/Base/Visual Style." 
        : "For Characters: 'personality' = Character Traits. 'appearance' = Visual Description.";

    const prompt = `
        You are a creative writer's assistant.
        Task: Create a **very brief and concise** persona/description for a "${category === 'other' ? 'Organization/Faction' : 'Character'}" in a "${genre}" story.
        Name: ${name}, Role: ${role}, Gender: ${gender}, Type: ${category}.
        
        ${instruction}
        ${fieldMapping}

        Rules:
        1.  **Be extremely concise.** Each field should be one or two sentences at most.
        2.  For 'personality', provide a few key descriptive words or a short motto.
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

export const generateSkillDescription = async (genre: StoryGenre, skillName: string, charName: string, apiKey?: string): Promise<string> => {
    const ai = getClient(apiKey);
    const prompt = `Describe the effect of skill "${skillName}" for character "${charName}" in a ${genre} setting. Keep it under 30 words. Chinese.`;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return response.text || "";
};

export const parseStoryOutline = async (outline: string, apiKey?: string): Promise<any> => {
    const ai = getClient(apiKey);
    const prompt = `
        Analyze this story outline: "${outline}".
        Extract the key information into a JSON object. Use Simplified Chinese for all string values (except enum keys).

        [IMPORTANT INSTRUCTION FOR PLOT BLUEPRINT]
        1. **PRIORITY**: If the outline text contains explicit chapter breakdowns, tables of contents, or structured plot points (e.g. "Chapter 1: ...", "Part 1: ...", "First Arc: ..."), you **MUST EXTRACT** these existing chapters exactly as described into the "plotBlueprint" array. Do NOT invent new chapters if the user provided them.
        2. **FALLBACK**: Only if the outline is a general summary without specific chapter structure should you creatively propose a new "plotBlueprint".
        3. Ensure "keyCharacters" in the blueprint match names in "supportingCharacters" or "character".
        4. **PREREQUISITES**: If the outline mentions that a chapter or event depends on something (e.g. "After finding the sword...", "Must defeat X first"), extract these conditions into the "prerequisites" array for that chapter. If no prerequisites are mentioned, leave the array empty. **DO NOT invent prerequisites.**
        
        [ORGANIZATIONS & FACTIONS]
        If the outline mentions specific Organizations, Sects, Guilds, or Factions as key entities (not individual people), include them in "supportingCharacters" but set their "category" to "other". Set "gender" to "other".
        
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

export const summarizeHistory = async (history: StorySegment[], model: string, apiKey?: string): Promise<string> => {
    const ai = getClient(apiKey);
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
    refImage?: string,
    apiKey?: string
): Promise<string> => {
    const visualDesc = char.appearance || char.trait || char.personality || "mysterious figure";
    const subject = `A ${char.gender} character`; 
    
    const prompt = `masterpiece, best quality, close up solo portrait of ${subject}, ${visualDesc}. ${genre} style. ${customStyle}. 参考二次元游戏立绘、Vtuber 皮套设计与插画，形象为日系二次元风，避免美漫风与韩漫“整容感”风格。 pure visual art, no text, no watermark, no signature.`;
    
    return generateSceneImage(prompt, ImageSize.SIZE_1K, style, "", customStyle, modelName, modelScopeKey, ShotSize.CLOSE_UP, refImage, apiKey);
};

export const validateModelScopeConnection = async (key: string, url?: string): Promise<string> => {
    try {
        const baseUrl = url || 'https://modelscope.cn/api/v1';
        const response = await fetch(`${baseUrl}/user/me`, {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        if (response.ok) return "连接成功";
        const err = await response.json().catch(() => ({}));
        throw new Error(err.Message || err.message || "Invalid Key");
    } catch (e: any) {
        // Explicitly check for potential CORS/Network errors to give better feedback
        if (e.name === 'TypeError' && (e.message === 'Failed to fetch' || e.message.includes('NetworkError'))) {
             throw new Error("连接失败：浏览器阻止了请求 (CORS)。请确保您没有使用代理工具干扰，或者该 API 不支持浏览器直接访问。建议在设置中配置 CORS 代理 URL。");
        }
        throw new Error(e.message || "连接失败");
    }
};

export const validateGeminiConnection = async (apiKey: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'test',
        });
        return "连接成功";
    } catch (e: any) {
        throw new Error(e.message || "连接失败: API Key 无效或网络错误");
    }
};

export const fetchOpenAICompatibleModels = async (url: string, apiKey: string): Promise<string[]> => {
    let endpointUrl: string;
    try {
        // Sanitize the base URL more aggressively to handle user input like "https://api.deepseek.com/v1" or "https://api.deepseek.com/"
        let baseUrl = url.trim().replace(/\/$/, ''); // remove trailing slash
        
        // Remove common suffixes to get to the root if the user pasted a full endpoint
        baseUrl = baseUrl.replace(/\/chat\/completions$/, '');
        baseUrl = baseUrl.replace(/\/completions$/, '');
        baseUrl = baseUrl.replace(/\/models$/, '');
        
        // OpenAI compatible endpoints usually follow {base}/v1/models
        // However, some might just be {base}/models. 
        // We will try standard OpenAI format first: /v1/models
        // If the user already included /v1 in the input, avoid doubling it.
        
        if (baseUrl.endsWith('/v1')) {
             endpointUrl = `${baseUrl}/models`;
        } else {
             endpointUrl = `${baseUrl}/v1/models`;
        }

        new URL(endpointUrl); // Validate the constructed URL
    } catch (e) {
        throw new Error("URL 格式无效，请输入正确的 API 基础地址 (如 https://api.deepseek.com)");
    }

    try {
        const response = await fetch(endpointUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                // 'Content-Type' removed to avoid preflight issues on simple GET
            },
        });

        if (!response.ok) {
            let errorMsg = response.statusText;
            try {
                const errorBody = await response.json();
                if (errorBody.error?.message) {
                    errorMsg = errorBody.error.message;
                }
            } catch (e) { /* ignore if response is not json */ }
            throw new Error(`服务器返回错误 (${response.status}): ${errorMsg}`);
        }

        const data = await response.json();
        if (data && Array.isArray(data.data)) {
            // Filter and map to get model IDs
            const modelIds = data.data
                .map((model: any) => model.id)
                .filter((id: string) => id && !id.includes('embed') && !id.includes('vision')); // a simple filter
            return modelIds;
        }
        throw new Error("响应格式无效: 未找到模型列表 (data.data array)");
    } catch (e: any) {
        console.error("Failed to fetch OpenAI compatible models:", e);
        
        // Specific handling for CORS errors which typically manifest as generic TypeErrors in fetch
        if (e.name === 'TypeError' && (e.message === 'Failed to fetch' || e.message.includes('NetworkError'))) {
             throw new Error("连接被浏览器阻止 (CORS 错误)。这通常是因为目标 API 服务器不允许跨域访问。请尝试使用支持 CORS 的代理地址，或检查您的网络连接。");
        }
        
        throw e;
    }
};
