
import React, { useEffect, useRef } from 'react';
import { SmoothBackground } from '../SmoothBackground';

interface LoadingScreenProps {
    progress: number;
    bgImage: string;
    onAbort?: () => void;
}

const LOADING_MSGS = [
  "正在构建世界法则...",
  "同步主角光环数据...",
  "生成二次元化身...",
  "加载因果律武器...",
  "命运节点演算中...",
  "渲染位面纹理...",
  "正在穿越时空裂缝..."
];

const MatrixRain = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;
        
        const columns = Math.floor(width / 20);
        const drops: number[] = [];
        for (let i = 0; i < columns; i++) {
            drops[i] = Math.random() * -100; // Start at random heights above screen
        }

        const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        const draw = () => {
            // Semi-transparent black to create trail effect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#06b6d4'; // Cyan-500 text color
            ctx.font = '15px monospace';

            for (let i = 0; i < drops.length; i++) {
                const text = chars[Math.floor(Math.random() * chars.length)];
                const x = i * 20;
                const y = drops[i] * 20;

                ctx.fillText(text, x, y);

                if (y > height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        };

        const interval = setInterval(draw, 50);

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 z-10 opacity-30 pointer-events-none" />;
};

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress, bgImage, onAbort }) => {
    return (
        <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white z-50 overflow-hidden font-mono">
            {/* Background with Blur and Pulse Overlay */}
            <div className="absolute inset-0 z-0">
                 <SmoothBackground src={bgImage} shouldBlur={true} />
                 <div className="absolute inset-0 bg-black/80" />
                 <MatrixRain />
                 {/* Scanline Effect */}
                 <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_2px,3px_100%] pointer-events-none" />
            </div>
    
            <div className="relative z-30 w-full max-w-lg px-8 flex flex-col items-center">
                <div className="mb-6 flex flex-col items-start w-full">
                    {/* Retro Terminal Text Style - Cyan Theme */}
                    <h2 className="text-2xl font-bold text-cyan-400 tracking-[0.2em] mb-2 animate-pulse flex items-center gap-2">
                        <span className="w-3 h-6 bg-cyan-400 block animate-ping"></span>
                        正在穿越...
                    </h2>
                    
                    <div className="flex justify-between w-full items-end">
                        <p className="text-cyan-200/80 text-xs h-4">{LOADING_MSGS[Math.floor((progress / 100) * LOADING_MSGS.length)] || "数据同步中..."}</p>
                        <span className="text-4xl font-bold text-cyan-400">{progress}%</span>
                    </div>
                </div>

                {/* Cassette Futurism Progress Bar: Sharp edges, solid blocks, Cyan Theme */}
                <div className="h-6 w-full bg-black border-2 border-cyan-900/50 p-1 relative shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                    <div 
                        className="h-full bg-cyan-500 transition-all duration-300 ease-linear shadow-[0_0_10px_rgba(6,182,212,0.5)]" 
                        style={{ width: `${progress}%` }}
                    >
                        {/* Striped Pattern Overlay */}
                        <div className="absolute inset-0 w-full h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.2)_10px,rgba(0,0,0,0.2)_20px)] opacity-50"></div>
                    </div>
                </div>
                
                {/* Decorative Bottom Text */}
                <div className="mt-2 w-full flex justify-between text-[10px] text-cyan-700/60 uppercase tracking-widest">
                    <span>SYS_TRANSFER_V2</span>
                    <span>NO_SIGNAL_LOSS</span>
                </div>

                {/* Abort Button */}
                {onAbort && (
                    <button
                        onClick={onAbort}
                        className="mt-12 px-6 py-3 border-2 border-red-500/50 bg-red-950/30 text-red-500 hover:text-red-300 hover:bg-red-900/50 hover:border-red-400 hover:shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all duration-300 rounded font-bold tracking-widest text-xs flex items-center gap-2 uppercase group"
                    >
                        <span className="text-lg group-hover:animate-pulse">⚠</span>
                        <span>终止生成</span>
                    </button>
                )}
            </div>
        </div>
      );
};
