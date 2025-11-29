
import React from 'react';

interface MenuButtonProps {
    onClick: () => void;
    label: string;
    subLabel?: string;
    // Color prop is kept for API compatibility but used for hover accents now
    color?: 'yellow' | 'purple' | 'pink' | 'gray'; 
    onHover?: () => void;
}

export const MenuButton: React.FC<MenuButtonProps> = ({ onClick, label, subLabel, color = 'yellow', onHover }) => {
    
    const hoverColorClass = {
        yellow: "group-hover:text-amber-300 group-hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]",
        purple: "group-hover:text-purple-300 group-hover:drop-shadow-[0_0_8px_rgba(216,180,254,0.8)]",
        pink: "group-hover:text-pink-300 group-hover:drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]",
        gray: "group-hover:text-gray-100 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
    }[color];

    const hoverIndicatorColor = {
        yellow: "bg-amber-400",
        purple: "bg-purple-400",
        pink: "bg-pink-400",
        gray: "bg-gray-200"
    }[color];

    return (
      <button 
          onClick={onClick}
          onMouseEnter={onHover}
          className="group relative w-full text-left py-2 px-4 transition-all duration-300 flex items-center"
      >
          {/* Hover Indicator Line */}
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 transition-all duration-300 group-hover:h-full group-hover:w-1 ${hoverIndicatorColor} opacity-0 group-hover:opacity-100 shadow-[0_0_10px_rgba(255,255,255,0.5)]`} />
          
          <div className="flex flex-col gap-0.5 transform transition-transform duration-300 group-hover:translate-x-4">
              <span className={`text-2xl font-serif text-gray-400 transition-all duration-300 tracking-[0.1em] ${hoverColorClass} group-hover:scale-105 origin-left`}>
                  {label}
              </span>
              {subLabel && (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600 group-hover:text-gray-400 transition-colors">
                      {subLabel}
                  </span>
              )}
          </div>
      </button>
    );
};
