

import React from 'react';
import { MenuButton } from '../MenuButton';
import { SmoothBackground } from '../SmoothBackground';
import { GameState } from '../../types';

interface LandingScreenProps {
    bgImage: string;
    shouldBlur: boolean;
    setGameState: (state: GameState) => void;
    onStartNewGame: () => void;
    onOpenLoad: () => void;
    onOpenGallery: () => void;
    onOpenSettings: () => void;
    playClickSound: () => void;
    playHoverSound?: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
    bgImage, shouldBlur, setGameState, onStartNewGame, onOpenLoad, onOpenGallery, onOpenSettings, playClickSound, playHoverSound
}) => {
    return (
        <div className="flex flex-col justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-center px-4 md:px-8 relative overflow-hidden">
             {/* Font Face Definition for specific user-requested handwriting font */}
             <style>{`
                @font-face {
                    font-family: 'CustomHandwriting';
                    src: url('/font/handwriting.ttf') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
            `}</style>
            
            <SmoothBackground src={bgImage} shouldBlur={shouldBlur} />
            {/* Darker gradient on left to make text pop */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />

            <div className="z-10 w-full max-w-7xl mx-auto flex flex-col justify-center h-full px-4">
                
                {/* Title Row - Separated to allow grid below to center align */}
                {/* REMOVED animate-idle from here to separate logo motion from text motion */}
                {/* Moved down by 10px using translate-y-[10px] per user request */}
                <div className="mb-20 pl-4 md:pl-16 text-left relative translate-y-[10px]">
                    <h1 className="flex items-center justify-start gap-2 md:gap-3 text-7xl md:text-9xl mb-4 font-['ZCOOL_XiaoWei'] font-bold tracking-wide select-none relative">
                        
                        {/* Custom Tech Triangle Logo - Cassette Futurism Style */}
                        {/* Static Position (No breathe animation), Color updated to Dark Charcoal (#e2e1e4) for contrast */}
                        <div className="relative mr-2 md:mr-6 w-16 h-16 md:w-24 md:h-24 shrink-0 group">
                            {/* Flowing Light Effect behind the logo - White */}
                            <div className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(255,255,255,0.5)_360deg)] animate-[spin_4s_linear_infinite] opacity-60 blur-xl rounded-full"></div>
                            <div className="absolute inset-0 bg-white/20 blur-md rounded-full animate-pulse"></div>

                            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] opacity-90 relative z-10 transform group-hover:scale-110 transition-transform duration-500">
                                {/* 1. Main Triangle Structure - Thicker Industrial Frame - Dark Gray #e2e1e4 */}
                                <path d="M50 10 L92 88 H8 L50 10 Z" fill="none" stroke="#e2e1e4" strokeWidth="6" strokeLinejoin="round" />
                                
                                {/* 2. Reinforced Corners (Cassette Futurism Plates) */}
                                {/* Top Plate */}
                                <path d="M44 12 H56 L50 4 Z" fill="#e2e1e4" />
                                {/* Left Bottom Plate */}
                                <path d="M6 88 L14 74 H22 L14 88 Z" fill="#e2e1e4" />
                                {/* Right Bottom Plate */}
                                <path d="M94 88 L86 74 H78 L86 88 Z" fill="#e2e1e4" />

                                {/* 3. Internal Mechanics Background (Grid) */}
                                <path d="M30 50 H70 M25 60 H75 M20 70 H80" stroke="#e2e1e4" strokeWidth="0.5" opacity="0.5" />

                                {/* 4. Top Core: Large Turbine - Thicker Design */}
                                <g transform="translate(50, 42)">
                                    {/* Outer Ring */}
                                    <circle r="14" fill="none" stroke="#e2e1e4" strokeWidth="3" />
                                    {/* Hub */}
                                    <circle r="5" fill="#e2e1e4" />
                                    {/* Blades - Chunky Rectangles */}
                                    <g className="animate-[spin_6s_linear_infinite]">
                                        <rect x="-3" y="-12" width="6" height="24" rx="1" fill="#e2e1e4" opacity="0.9" />
                                        <rect x="-3" y="-12" width="6" height="24" rx="1" fill="#e2e1e4" opacity="0.9" transform="rotate(60)" />
                                        <rect x="-3" y="-12" width="6" height="24" rx="1" fill="#e2e1e4" opacity="0.9" transform="rotate(120)" />
                                    </g>
                                </g>

                                {/* 5. Bottom Left Core: Small Fan - Thicker Design */}
                                <g transform="translate(32, 70)">
                                    <circle r="10" fill="none" stroke="#e2e1e4" strokeWidth="3" />
                                    <g className="animate-[spin_2s_linear_infinite_reverse]">
                                        <path d="M0 -8 L3 -3 L8 0 L3 3 L0 8 L-3 3 L-8 0 L-3 -3 Z" fill="#e2e1e4" />
                                        <circle r="3" fill="#1a1a1a" />
                                    </g>
                                </g>

                                {/* 6. Heavy Circuit Connections (Pipes) */}
                                {/* Connecting Top to Bottom Left */}
                                <path d="M42 53 L35 62" stroke="#e2e1e4" strokeWidth="4" strokeLinecap="round" />
                                
                                {/* Connecting Top to Right Data Port */}
                                <path d="M58 50 H70 L75 58" fill="none" stroke="#e2e1e4" strokeWidth="3" strokeLinecap="round" />
                                
                                {/* 7. Right Side Data Elements (Cassette Tape Reels feel) */}
                                <g transform="translate(70, 70)">
                                    <rect x="0" y="-5" width="8" height="8" fill="#e2e1e4" className="animate-pulse" />
                                    <rect x="10" y="-5" width="8" height="8" fill="#e2e1e4" opacity="0.7" />
                                    <rect x="0" y="5" width="18" height="3" fill="#e2e1e4" />
                                </g>
                            </svg>
                        </div>

                        {/* Title Text */}
                        {/* ADDED animate-idle here so ONLY text breathes, creating visual parallax with static logo */}
                        {/* UPDATE: Text Color changed to Beige (Off-White) #fdfbf7, removed gradient, kept blocks */}
                        <div className="flex relative z-20 animate-idle items-baseline">
                            
                            {/* 主 - Cyan Theme Block */}
                            <span className="relative px-2 mx-1">
                                {/* Cyan Block Layer */}
                                <div className="absolute bottom-[10%] left-[-5%] w-[110%] h-[35%] -z-10 flex flex-col justify-end">
                                    <div 
                                        className="w-full h-full bg-[#06b6d4] shadow-[4px_4px_0px_rgba(0,0,0,0.5)] relative overflow-hidden border-t border-white/20"
                                        style={{ maskImage: 'linear-gradient(to right, transparent, black 20%)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 20%)' }}
                                    >
                                            <div className="absolute top-0 left-0 w-full h-[1px] bg-black/10"></div>
                                            <div className="absolute bottom-1 right-0 w-[40%] h-[3px] bg-black/20"></div>
                                            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:4px_4px]"></div>
                                    </div>
                                </div>
                                {/* Solid Beige Text */}
                                <span className="text-[#fdfbf7] drop-shadow-[0_0_20px_rgba(255,255,255,0.9)] filter">
                                    主
                                </span>
                            </span>

                            {/* 角 - Cyan Theme Block (Staggered) */}
                            <span className="relative -translate-y-6 px-2 mx-1">
                                {/* Cyan Block Layer */}
                                <div className="absolute bottom-[10%] left-[-5%] w-[110%] h-[35%] -z-10 flex flex-col justify-end">
                                    <div 
                                        className="w-full h-full bg-[#06b6d4] shadow-[4px_4px_0px_rgba(0,0,0,0.5)] relative overflow-hidden border-t border-white/20"
                                        style={{ maskImage: 'linear-gradient(to left, transparent, black 20%)', WebkitMaskImage: 'linear-gradient(to left, transparent, black 20%)' }}
                                    >
                                            <div className="absolute top-0 left-0 w-full h-[1px] bg-black/10"></div>
                                            <div className="absolute bottom-1 right-0 w-[40%] h-[3px] bg-black/20"></div>
                                            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:4px_4px]"></div>
                                    </div>
                                </div>
                                {/* Solid Beige Text */}
                                <span className="text-[#fdfbf7] drop-shadow-[0_0_20px_rgba(255,255,255,0.9)] filter">
                                    角
                                </span>
                            </span>
                            
                            {/* 光 - Yellow/Red Theme Block */}
                            <span className="relative px-2 mx-1">
                                {/* Yellow Block Layer */}
                                <div className="absolute bottom-[10%] left-[-5%] w-[110%] h-[40%] -z-10 flex flex-col justify-end">
                                    {/* MASK APPLIED: Left side fade out */}
                                    <div 
                                        className="w-full h-full bg-[#facc15] shadow-[4px_4px_0px_rgba(0,0,0,0.5)] relative overflow-hidden border-t border-white/20"
                                        style={{ maskImage: 'linear-gradient(to right, transparent, black 20%)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 20%)' }}
                                    >
                                         {/* Cassette Deco: Stripes */}
                                         <div className="absolute top-0 left-0 w-full h-[1px] bg-black/10"></div>
                                         <div className="absolute bottom-1 right-0 w-[40%] h-[3px] bg-black/20"></div>
                                         {/* Scanline texture */}
                                         <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:4px_4px]"></div>
                                    </div>
                                </div>
                                {/* Solid Beige Text */}
                                <span className="text-[#fdfbf7] drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] filter">
                                    光
                                </span>
                            </span>
                            
                            {/* 环 - Yellow/Red Theme Block (Staggered) */}
                            <span className="relative -translate-y-6 px-2 mx-1">
                                {/* Yellow Block Layer */}
                                <div className="absolute bottom-[10%] left-[-5%] w-[110%] h-[40%] -z-10 flex flex-col justify-end">
                                    {/* MASK APPLIED: Right side fade out */}
                                    <div 
                                        className="w-full h-full bg-[#facc15] shadow-[4px_4px_0px_rgba(0,0,0,0.5)] relative overflow-hidden border-t border-white/20"
                                        style={{ maskImage: 'linear-gradient(to left, transparent, black 20%)', WebkitMaskImage: 'linear-gradient(to left, transparent, black 20%)' }}
                                    >
                                         <div className="absolute top-0 left-0 w-full h-[1px] bg-black/10"></div>
                                         <div className="absolute bottom-1 right-0 w-[40%] h-[3px] bg-black/20"></div>
                                         <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:4px_4px]"></div>
                                    </div>
                                </div>
                                {/* Solid Beige Text */}
                                <span className="text-[#fdfbf7] drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] filter">
                                    环
                                </span>
                            </span>
                        </div>
                    </h1>
                    <div className="flex items-center gap-3 ml-2 mt-2 animate-idle delay-100">
                        <p className="text-xl font-bold tracking-[0.4em] uppercase font-mono text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
                            Protagonist Halo
                        </p>
                        <span className="w-3 h-6 bg-white animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.8)] translate-y-[-2px]"></span>
                    </div>
                </div>

                {/* Content Grid: Buttons vs Description */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                    
                    {/* Left Column: Buttons */}
                    <div className="lg:col-span-4 flex flex-col items-start pl-4 md:pl-16">
                        <div className="flex flex-col gap-6 w-full items-start border-l border-white/10 pl-6 py-4">
                            <MenuButton
                                label="开启新剧情"
                                subLabel="Start New Game"
                                color="yellow"
                                onClick={onStartNewGame}
                                onHover={playHoverSound}
                            />

                            <MenuButton
                                label="读取存档"
                                subLabel="Load Game"
                                color="purple"
                                onClick={() => { playClickSound(); onOpenLoad(); }}
                                onHover={playHoverSound}
                            />

                            <MenuButton
                                label="艺术画廊"
                                subLabel="Gallery"
                                color="pink"
                                onClick={() => { playClickSound(); onOpenGallery(); }}
                                onHover={playHoverSound}
                            />

                            <MenuButton
                                label="系统设置"
                                subLabel="System Config"
                                color="gray"
                                onClick={() => { playClickSound(); onOpenSettings(); }}
                                onHover={playHoverSound}
                            />
                        </div>
                    </div>

                    {/* Right Column: System Log & Project Brief (Side by Side) */}
                    {/* Changed items-start to items-stretch to force equal height, added min-h to match buttons */}
                    <div className="lg:col-span-8 flex flex-col md:flex-row gap-8 items-stretch lg:pl-12 mt-4">
                        
                        {/* System Log Panel */}
                        <div className="flex-1 w-full min-h-[310px] bg-black/30 backdrop-blur-sm p-8 rounded-none border-t-2 border-orange-500/50 animate-fade-in-right delay-200 opacity-0 hover:bg-black/50 transition-colors duration-500 group flex flex-col">
                            <h3 className="text-xl font-bold text-orange-200/90 mb-6 font-mono tracking-widest flex items-center gap-2 uppercase">
                                <span className="w-2 h-2 bg-orange-500 animate-pulse"></span>
                                系统日志
                            </h3>
                            <div className="text-sm font-mono text-gray-400 space-y-4 group-hover:text-gray-300 transition-colors flex-1 flex flex-col justify-start">
                                <p>{'>'} 连接至核心生成引擎... <span className="text-green-500 float-right">Success</span></p>
                                <p>{'>'} 多模态交互模块... <span className="text-green-500 float-right">Ready</span></p>
                                <p>{'>'} 平行宇宙时间线... <span className="text-green-500 float-right">Synced</span></p>
                                <p>{'>'} 情感羁绊系统... <span className="text-green-500 float-right">Active</span></p>
                                <div className="mt-auto pt-4 border-t border-white/5">
                                    <p className="animate-pulse text-orange-400">{'>'} 等待指令输入_</p>
                                </div>
                            </div>
                        </div>

                        {/* Project Brief Panel */}
                        <div className="flex-1 w-full min-h-[310px] bg-white/5 backdrop-blur-sm p-8 rounded-none border-t-2 border-cyan-500/50 animate-fade-in-right delay-300 opacity-0 hover:bg-white/10 transition-colors duration-500 flex flex-col">
                             <h3 className="text-xl font-bold text-cyan-200/90 mb-6 font-mono tracking-widest flex items-center gap-2 uppercase">
                                <span className="w-2 h-2 bg-cyan-500"></span>
                                项目简报
                            </h3>
                            <div className="flex-1 flex flex-col">
                                <p 
                                    className="text-gray-300 text-xl leading-8 tracking-wide"
                                    style={{ fontFamily: "'Long Cang', cursive" }}
                                >
                                    <strong className="text-cyan-400 font-bold" style={{ fontFamily: 'inherit' }}>主角光环</strong> 是一款基于 Google Gemini 模型的沉浸式互动小说生成引擎。
                                    <br/><br/>
                                    融合<span className="text-amber-400 font-bold mx-1">多模态交互</span>、<span className="text-purple-400 font-bold mx-1">情感羁绊</span>与<span className="text-red-400 font-bold mx-1">无限流剧情</span>，为您打造独一无二的主角体验。
                                </p>
                                <div className="mt-auto text-[10px] text-gray-500 font-mono pt-4 text-right">
                                    VERSION: 2.5.0_BETA
                                </div>
                            </div>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    );
};
