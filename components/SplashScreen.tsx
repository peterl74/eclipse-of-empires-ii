
import React, { useState } from 'react';
import { Play, Sparkles, Map, Users, EyeOff, Crown } from 'lucide-react';

interface SplashScreenProps {
  onStart: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onStart }) => {
  const [isLeaving, setIsLeaving] = useState(false);

  const handleStart = () => {
    setIsLeaving(true);
    // Delay actual start slightly to allow exit animation
    setTimeout(onStart, 800);
  };

  return (
    <div className={`fixed inset-0 z-[100] bg-black flex flex-col items-center justify-between overflow-hidden transition-opacity duration-1000 ${isLeaving ? 'opacity-0' : 'opacity-100'}`}>
      
      {/* 1. BACKGROUND LAYER (CSS Only - No Image) */}
      <div className="absolute inset-0 z-0">
        {/* Deep Space Gradient Base */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#0f0c29] to-black" />
        
        {/* Subtle Radial Highlight for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,_rgba(180,83,9,0.15),_transparent_70%)] animate-pulse" style={{ animationDuration: '4s' }} />
        
        {/* Cinematic Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90" />
      </div>

      {/* 2. TOP SECTION: TITLE */}
      <div className="relative z-10 pt-16 md:pt-24 text-center animate-in slide-in-from-top-10 fade-in duration-1000">
        <div className="mb-4">
            <div className="inline-block p-1 border border-[#ca8a04]/50 rounded-full mb-4 bg-black/50 backdrop-blur">
                <Crown size={32} className="text-[#fcd34d]" />
            </div>
        </div>
        <h1 className="text-5xl md:text-7xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-b from-[#fcd34d] to-[#b45309] tracking-widest drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]" style={{ fontFamily: 'Cinzel, serif' }}>
          ECLIPSE OF EMPIRES II
        </h1>
        <p className="mt-4 text-slate-300 text-sm md:text-lg tracking-[0.3em] uppercase font-light opacity-80">
          The Truth is Revealed in Shadow
        </p>
      </div>

      {/* 3. MIDDLE SPACER */}
      <div className="flex-1"></div>

      {/* 4. BOTTOM SECTION: BRIEF & BUTTON */}
      <div className="relative z-10 w-full max-w-4xl px-6 pb-12 md:pb-16 flex flex-col items-center animate-in slide-in-from-bottom-10 fade-in duration-1000 delay-300">
        
        {/* The "Hook" - Quick Rules */}
        <div className="w-full bg-black/60 backdrop-blur-md border-t border-b border-[#ca8a04]/30 p-6 md:p-8 mb-8 text-center">
            <h3 className="text-[#fcd34d] text-xs font-bold uppercase tracking-widest mb-4 border-b border-white/10 pb-2 inline-block">
                Command The Cycle
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm text-slate-300">
                <div className="flex flex-col items-center gap-2">
                    <Users className="text-blue-400" size={20} />
                    <span className="font-bold text-white">CHOOSE</span>
                    <span className="text-xs text-slate-400">your Role each Eclipse</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Map className="text-emerald-400" size={20} />
                    <span className="font-bold text-white">EXPAND</span>
                    <span className="text-xs text-slate-400">across the fractured void</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <EyeOff className="text-purple-400" size={20} />
                    <span className="font-bold text-white">BLUFF</span>
                    <span className="text-xs text-slate-400">your true riches</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Sparkles className="text-amber-400" size={20} />
                    <span className="font-bold text-white">SEIZE</span>
                    <span className="text-xs text-slate-400">Relics of power</span>
                </div>
            </div>
        </div>

        {/* The Button */}
        <button 
          onClick={handleStart}
          className="group relative px-12 py-4 bg-gradient-to-r from-[#b45309] to-[#ca8a04] hover:from-[#d97706] hover:to-[#f59e0b] text-black font-bold text-xl uppercase tracking-widest rounded shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:shadow-[0_0_40px_rgba(234,179,8,0.6)] hover:scale-105 transition-all duration-300"
        >
          <div className="flex items-center gap-3">
             <span className="font-serif">Initialize Conquest</span>
             <Play size={20} fill="currentColor" className="group-hover:translate-x-1 transition-transform"/>
          </div>
          
          {/* Shine Effect */}
          <div className="absolute inset-0 rounded overflow-hidden">
             <div className="absolute top-0 left-[-100%] w-[50%] h-full bg-white/20 -skew-x-12 group-hover:left-[200%] transition-all duration-700 ease-in-out" />
          </div>
        </button>

        <div className="mt-4 text-[10px] text-slate-500 uppercase tracking-widest">
            Alpha Build 2.0 • System Ready
        </div>

      </div>
    </div>
  );
};

export default SplashScreen;
