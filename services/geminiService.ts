
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { StoryGenre, Character, StorySegment, ImageSize, SupportingCharacter, StoryMood, generateUUID, WorldSettings, Skill, AvatarStyle, MemoryState, ImageModel, ShotSize, ScheduledEvent } from '../types';
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
    narrativeTechnique?: string
): Promise<StorySegment> => {
  
  const worldContext = getWorldContext(genre);
  
  const structure = NARRATIVE_STRUCTURES.find(s => s.id === narrativeMode);
  const technique = NARRATIVE_TECHNIQUES.find(t => t.id === narrativeTechnique);
  
  const narrativeInstruction = `
    [NARRATIVE CONFIGURATION]
    Structure: ${structure ? `${structure.name} - ${structure.description}` : 'Auto-adapt based on genre'}
    Technique: ${technique ? `${technique.name} - ${technique.description}` : 'Auto-adapt based on context'}
    Make sure the opening reflects this narrative style immediately.
  `;

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
    narrativeTechnique?: string
): Promise<StorySegment> => {
    
    const recentHistory = history.slice(-5); // Provide context window
    const worldContext = getWorldContext(genre);
    
    // Narrative Config
    const structure = NARRATIVE_STRUCTURES.find(s => s.id === narrativeMode);
    const technique = NARRATIVE_TECHNIQUES.find(t => t.id === narrativeTechnique);
    
    const narrativeInstruction = `
      [NARRATIVE STYLE]
      Structure: ${structure ? structure.name : 'Standard'}
      Technique: ${technique ? technique.name : 'Standard'}
      Instruction: Maintain the story flow according to this structure. Use the technique to enhance the narrative depth (e.g. if 'Non-linear', you can use flashbacks; if 'Multiple Perspectives', you can shift focus).
    `;

    // Filter Pending Events
    const pendingEvents = scheduledEvents.filter(e => e.status === 'pending');
    let eventsInstruction = "";
    if (pendingEvents.length > 0) {
        eventsInstruction = `
        [PRESET EVENTS / PLOT POINTS (HIGHEST PRIORITY)]
        The user has scheduled specific future events. You are the Director (DM).
        
        PENDING EVENTS:
        ${pendingEvents.map(e => `- ID: "${e.id}" | Type: ${e.type} | Details: ${e.description}`).join('\n')}

        CRITICAL INSTRUCTION FOR EVENTS:
        1. You MUST try to weave these events into the story naturally.
        2. **COMBINE with Narrative Style**: Do not just insert the event bluntly. 
           - If using 'Symbolism', make the event metaphorical. 
           - If 'Non-linear', maybe the event is a premonition or memory. 
           - If 'Parallel Narrative', the event might happen elsewhere while the protagonist is busy.
        3. If you successfully incorporate/trigger a specific event in THIS segment, you MUST include its ID in the "triggeredEventId" field.
        4. Do NOT force it if it breaks logical consistency, but steer the plot towards it.
        `;
    }

    const prompt = `
      Role: You are an advanced interactive fiction engine.
      Task: Continue the story based on the user's choice.
      Language: Simplified Chinese (简体中文).

      [WORLD SETTING]
      ${worldContext}
      ${customGenre ? `Context: ${customGenre}` : ''}
      Tone: ${worldSettings.tone}
      System: ${worldSettings.hasSystem ? 'On' : 'Off'}

      [CHARACTERS]
      Protagonist: ${character.name} (${character.gender})
      Skills: ${character.skills.map(s => s.name).join(', ')}
      Key NPCs: ${supportingCharacters.map(c => `${c.name}(${c.role}, Affinity:${c.affinity || 0})`).join(', ')}

      [CURRENT STATE]
      Location: ${history[history.length - 1].location}
      Mood: ${history[history.length - 1].mood}
      
      [MEMORIES]
      Zone: ${memories.memoryZone}
      Recent Story: ${memories.storyMemory}
      Core Info: ${memories.coreMemory}
      Items: ${memories.inventory}

      [RECENT HISTORY]
      ${recentHistory.map((h, i) => `Turn ${i}: ${h.text.substring(0, 100)}... Choice: ${h.causedBy}`).join('\n')}

      [USER INPUT]
      "${userChoice}"

      ${narrativeInstruction}
      ${eventsInstruction}

      [CUSTOM RULES]
      ${customPrompt || ""}

      Ensure a high ratio of dialogue. Include at least 5 lines of dialogue in this segment to reveal character personalities and relationships.

      [OUTPUT REQUIREMENTS]
      1. text: Continue the story (200-300 words). React to user input logically.
      2. choices: 2-4 meaningful options.
      3. visualPrompt: English prompt for image generation.
      4. mood: [PEACEFUL, BATTLE, TENSE, EMOTIONAL, MYSTERIOUS, VICTORY].
      5. activeCharacterName: Who is speaking/acting?
      6. location: Current location name.
      7. affinityUpdates: Array of {characterName, change} (e.g. +5, -10) if relationships change.
      8. memoryUpdate: Update all memory fields based on new events. 'storyMemory' should append key points. 'inventory' should update if items gained/lost.
      9. triggeredEventId: The ID of the scheduled event that was completed/triggered in this turn (or null).

      Response must be valid JSON.
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
            triggeredEventId: json.triggeredEventId
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
            // NOTE: This fetch call assumes a proxy or backend if CORS is an issue, 
            // but for a purely frontend demo we attempt direct call or assume the user has a proxy.
            // ModelScope API structure varies; this is a generic implementation assumption.
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
        // Strong negative prompting to prevent text
        const negativeConstraints = "NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY, NO WATERMARKS, NO SIGNATURES, NO LABELS, NO HUD, NO UI, NO SPEECH BUBBLES.";
        
        const finalPrompt = `${shotPrompt}, ${prompt}, style of ${style}, ${customStyle}. ${characterInfo ? `Visual details: ${characterInfo}` : ''}. High quality, detailed, 8k. ${negativeConstraints}`;
        
        // Note: Reference image logic for Gemini is conceptual here as the API shape for image-to-image 
        // via `generateContent` with image output is specific. 
        // We use the text-to-image specialized model usually, but `generateContent` on Flash 2.0+ supports inputs.
        
        // For 'gemini-2.5-flash-image' specifically:
        const response = await ai.models.generateContent({
            model: model,
            contents: {
                parts: [
                    { text: finalPrompt },
                    // If we had a reference image for style transfer, we would add it here:
                    // ...(refImageBase64 ? [{ inlineData: { mimeType: 'image/jpeg', data: refImageBase64.split(',')[1] } }] : [])
                ]
            },
            config: {
                // responseMimeType is NOT supported for image models in this SDK version usually, 
                // but we rely on the response structure.
            }
        });

        // Parse response for image
        // Iterate through parts to find the image
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
        Extract the key information into a JSON object with the following structure. Use Simplified Chinese for all string values (except enum keys).

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
          ]
        }

        Requirements:
        - Determine the most fitting "genre" from the enum list based on keywords. If unsure, use "FANTASY".
        - "trait" should be a concise summary of the protagonist's personality and appearance.
        - Extract any mention of skills or abilities into "skills". If none mentioned, return empty array.
        - The 'category' for supporting characters must be one of 'supporting', 'villain', 'protagonist', or 'other'.
        - The 'tone' must be exactly one of: 'PEACEFUL', 'BATTLE', 'TENSE', 'EMOTIONAL', 'MYSTERIOUS', 'VICTORY'.
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
    
    // KEY FIX: Do NOT include character name in the prompt to avoid text generation.
    // Use generic descriptors instead.
    const subject = `A ${char.gender} character`; 
    
    // "Solo portrait" ensures no other characters. "Pure visual art" discourages text layouts.
    const prompt = `Solo portrait of ${subject}, ${visualDesc}. ${genre} style. Close up, masterpiece, best quality, pure visual art, no text, no watermark, no signature.`;
    
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
