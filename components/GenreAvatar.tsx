
import React from 'react';
import { StoryGenre } from '../types';

interface GenreAvatarProps {
    avatar?: string;
    name: string;
    genre: StoryGenre;
    isProtagonist: boolean;
    onClick?: (e: React.MouseEvent) => void;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export const GenreAvatar: React.FC<GenreAvatarProps> = ({ 
    avatar, 
    name, 
    genre, 
    isProtagonist, 
    onClick, 
    size = 'md',
    className = ''
}) => {
    // Size Classes
    // sm: Small tree nodes (Load Screen)
    // md: Text Mode (Chat style)
    // lg: Novel Mode (Panel style)
    // xl: Large Profile
    const sizeClasses = {
        sm: 'w-12 h-12 text-xs',
        md: 'w-[4.5rem] h-[4.5rem] md:w-20 md:h-20 text-sm',
        lg: 'w-20 h-20 md:w-24 md:h-24 text-2xl',
        xl: 'w-32 h-32 text-4xl'
    }[size];
    
    // Placeholder if no image
    const Placeholder = () => (
        <div className={`w-full h-full flex items-center justify-center font-bold ${isProtagonist ? 'bg-purple-900 text-purple-200' : 'bg-blue-900 text-blue-200'}`}>
            {name.charAt(0)}
        </div>
    );

    const baseClasses = `relative shrink-0 cursor-pointer group hover:scale-110 transition-transform z-20 ${sizeClasses} ${className}`;

    // Render Logic based on Genre
    if (genre === StoryGenre.CYBERPUNK) {
        // Hexagon using Clip Path + Border Trick
        return (
             <div 
                className={baseClasses}
                onClick={onClick} 
                title={name}
            >
                 {/* Border/Glow Layer */}
                 <div className="absolute inset-0 bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)]" style={{ clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)" }}></div>
                 
                 {/* Image Layer */}
                 <div className="absolute inset-[1px] bg-black z-10" style={{ clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)" }}>
                    {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <Placeholder />}
                 </div>
             </div>
        );
    } 
    
    if (genre === StoryGenre.SUPERHERO) {
        // Skewed Box
        return (
            <div 
                className={baseClasses}
                onClick={onClick} 
                title={name}
            >
                <div className="absolute inset-0 bg-blue-500 transform -skew-x-12 rounded-lg shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                <div className="absolute inset-[1px] bg-black transform -skew-x-12 rounded-lg overflow-hidden border border-blue-300/50 z-10">
                    {avatar ? <img src={avatar} className="w-full h-full object-cover transform skew-x-12 scale-110" /> : <Placeholder />}
                </div>
            </div>
        );
    }

    if (genre === StoryGenre.WUXIA || genre === StoryGenre.XIANXIA) {
        // Rustic Circle with Wooden/Gold Border
        return (
             <div 
                className={baseClasses}
                onClick={onClick} 
                title={name}
            >
                <div className="absolute inset-0 rounded-full border-2 md:border-4 border-[#a16207] bg-[#1c1917] shadow-lg"></div>
                <div className="absolute inset-[2px] rounded-full overflow-hidden z-10 border border-yellow-900/50">
                     {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <Placeholder />}
                </div>
            </div>
        );
    }

    if (genre === StoryGenre.ROMANCE) {
        // Soft Rounded Square
        return (
             <div 
                className={baseClasses}
                onClick={onClick} 
                title={name}
            >
                <div className="absolute inset-0 rounded-2xl bg-pink-300 shadow-[0_0_15px_rgba(249,168,212,0.6)]"></div>
                <div className="absolute inset-[1px] rounded-xl overflow-hidden bg-white z-10">
                     {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <Placeholder />}
                </div>
            </div>
        );
    }

    // Default (Fantasy, Custom, etc)
    const ringClass = "ring-2 md:ring-4 ring-gray-400 ring-offset-2 ring-offset-black";
    const shadowClass = "shadow-[0_0_15px_rgba(255,255,255,0.2)]";

    return (
        <div 
            className={`${baseClasses} rounded-full overflow-hidden ${ringClass} ${shadowClass}`}
            onClick={onClick} 
            title={name}
        >
            {avatar ? <img src={avatar} className="w-full h-full object-cover z-10 relative" /> : <Placeholder />}
            {/* Gloss Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/20 pointer-events-none rounded-full z-20"></div>
        </div>
    );
};
