
import React, { useState, useEffect } from 'react';
import { generateUUID, BackgroundStyle, StoryGenre, StoryMood, ShotSize } from '../types';

// --- Dynamic Background Generator ---

const GENRE_PROMPTS: Record<StoryGenre, string> = {
    [StoryGenre.XIANXIA]: "empty scenery, landscape, chinese traditional fantasy mountains, clouds, ancient temples, ethereal, wuxia, no humans",
    [StoryGenre.WUXIA]: "empty scenery, landscape, ancient chinese martial arts atmosphere, bamboo forest, old tavern, misty mountains, ink wash style, no humans",
    [StoryGenre.ROMANCE]: "empty scenery, landscape, romantic city street, cherry blossoms, cafe, sunset, soft lighting, dreamy atmosphere, shoujo manga style, no humans",
    [StoryGenre.SUPERHERO]: "empty scenery, landscape, futuristic metropolis, high tech city, dynamic angles, comic book style, vibrant colors, no humans",
    [StoryGenre.CYBERPUNK]: "empty scenery, landscape, cyberpunk city, neon lights, rain, night, futuristic skyscrapers, high tech, blade runner vibe, no humans",
    [StoryGenre.FANTASY]: "empty scenery, landscape, medieval fantasy kingdom, castle, magic forest, epic landscape, dungeons and dragons style, no humans",
    [StoryGenre.CUSTOM]: "empty scenery, landscape, cinematic landscape, atmospheric, detailed, concept art, no humans"
};

const MOOD_MODIFIERS: Record<StoryMood, string> = {
    [StoryMood.PEACEFUL]: "calm, peaceful, daylight, serene, relaxing",
    [StoryMood.BATTLE]: "battlefield, destruction, fire, smoke, intense, dynamic, action",
    [StoryMood.TENSE]: "dark, ominous, foggy, mysterious, suspenseful, shadows",
    [StoryMood.EMOTIONAL]: "sunset, rain, nostalgic, emotional, soft light, sentimental",
    [StoryMood.MYSTERIOUS]: "mystical, glowing, strange, unknown, starry night, galaxy",
    [StoryMood.VICTORY]: "sunrise, golden hour, triumphant, glorious, bright, majestic"
};

/**
 * Generates a dynamic background URL using Pollinations.ai
 * This ensures infinite variety ("Bing-like") based on context.
 */
export const getSmartBackground = (genre: StoryGenre, mood: StoryMood, style: BackgroundStyle): string => {
    const basePrompt = GENRE_PROMPTS[genre] || GENRE_PROMPTS[StoryGenre.CUSTOM];
    const moodMod = MOOD_MODIFIERS[mood] || MOOD_MODIFIERS[StoryMood.PEACEFUL];
    const styleMod = style === 'realistic' 
        ? "photorealistic, 8k, cinematic lighting, unreal engine 5 render, photography" 
        : "anime style, makoto shinkai style, high quality 2d art, illustration";

    // Random seed to ensure unique image every time
    const seed = Math.floor(Math.random() * 1000000);
    
    // Strengthen negative prompts to ensure scenery only
    const finalPrompt = encodeURIComponent(`${basePrompt}, ${moodMod}, ${styleMod}, scenery, no characters, no humans, nobody, environment only, landscape`);
    
    // Pollinations API: faster and free for dynamic placeholders
    return `https://image.pollinations.ai/prompt/${finalPrompt}?width=1920&height=1080&seed=${seed}&nologo=true&model=flux`;
};

// Fallback for initial load
export const getRandomBackground = (style: BackgroundStyle = 'anime') => {
    return getSmartBackground(StoryGenre.CUSTOM, StoryMood.PEACEFUL, style);
};

interface SmoothBackgroundProps {
    src: string;
    shouldBlur: boolean;
    brightness?: number;
    position?: string;
    shotType?: ShotSize | null; // New prop for camera movement
}

// Cinematic Animation Styles
const getCameraStyle = (shotType?: ShotSize | null) => {
    switch (shotType) {
        case ShotSize.EXTREME_CLOSE_UP:
            // Intense Zoom In
            return {
                transform: 'scale(1.25)',
                transition: 'transform 20s ease-out'
            };
        case ShotSize.CLOSE_UP:
            // Gentle Zoom In
            return {
                transform: 'scale(1.15)',
                transition: 'transform 15s ease-out'
            };
        case ShotSize.EXTREME_LONG_SHOT:
            // Slow Pan / Zoom Out (Ken Burns)
            return {
                transform: 'scale(1.1)',
                transition: 'transform 30s linear' 
            };
        case ShotSize.LONG_SHOT:
             // Slight movement
             return {
                transform: 'scale(1.05)',
                transition: 'transform 20s ease-in-out'
            };
        case ShotSize.MEDIUM_SHOT:
        default:
            // Standard Idle Breathe
            return {
                transform: 'scale(1.02)',
                transition: 'transform 10s ease-in-out'
            };
    }
};

export const SmoothBackground = ({ src, shouldBlur, brightness = 0.6, position = 'center', shotType }: SmoothBackgroundProps) => {
    // Initialize layers immediately with the prop if available
    const [layers, setLayers] = useState<{id: string, src: string, shotType?: ShotSize | null}[]>(src ? [{id: 'init', src, shotType}] : []);
    
    useEffect(() => {
        if (!src) return;

        let isMounted = true;
        
        // Preload image before setting state to avoid flicker
        const img = new Image();
        img.src = src;
        img.onload = () => {
            if (!isMounted) return;
            setLayers(prev => {
                const lastLayer = prev[prev.length - 1];
                // Only update if the source URL has actually changed OR the shotType has changed
                // This ensures cinematic camera moves can trigger even on same background
                if (!lastLayer || lastLayer.src !== src || lastLayer.shotType !== shotType) {
                    const newId = generateUUID();
                    // Keep at most 2 layers to manage memory and transition
                    return [...prev, {id: newId, src, shotType}].slice(-2);
                }
                return prev;
            });
        };

        return () => { isMounted = false; };
    }, [src, shotType]);

    // Define animation styles for fade in
    const fadeInStyle = {
        animation: 'fadeIn 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards', // Slower fade for better immersion
    };

    return (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black pointer-events-none overflow-hidden z-0">
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
            {layers.map((layer, index) => {
                const isTopLayer = index === layers.length - 1;
                
                // Base filter style
                const filterStyle = shouldBlur ? 'blur(12px)' : `brightness(${brightness})`;
                
                // Get cinematic transform based on the shot type of this specific layer
                const cameraStyle = getCameraStyle(layer.shotType);

                return (
                    <div
                        key={layer.id}
                        className="absolute inset-0 w-full h-full overflow-hidden"
                        style={{
                            zIndex: index,
                            ...(isTopLayer && layers.length > 1 ? fadeInStyle : { opacity: 1 }),
                        }}
                    >
                         <div 
                            className="absolute inset-0 bg-cover bg-no-repeat"
                            style={{
                                backgroundImage: `url(${layer.src})`,
                                backgroundPosition: position,
                                filter: filterStyle,
                                // Combine camera style with blur scale fix (blur needs slight scale up to hide edges)
                                transform: shouldBlur ? 'scale(1.1)' : cameraStyle.transform,
                                transition: `filter 1s ease, ${cameraStyle.transition}`,
                                transformOrigin: 'center center'
                            }}
                         />
                    </div>
                );
            })}
        </div>
    );
};
