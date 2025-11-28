
import React, { useState } from 'react';
import { Play, Crown, Beaker, FlaskConical } from 'lucide-react';

interface SplashScreenProps {
  onStart: () => void;
  onOpenSim: () => void;
  onOpenStrategyLab: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onStart, onOpenSim, onOpenStrategyLab }) => {
  const [isLeaving, setIsLeaving] = useState(false);

  const handleStart = () => {
    setIsLeaving(true);
    setTimeout(onStart, 800);
  };

  return (
    <div className={`fixed inset-0 z-[100] bg-black flex flex-col items-center justify-between overflow-hidden transition-opacity duration-1000 ${isLeaving ? 'opacity-0' : 'opacity-100'}`}>
      
      {/* 1. BACKGROUND LAYER */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#0f0c29] to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,_rgba(180,83,9,0.15),_transparent_70%)] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90" />
      </div>

      {/* 2. TOP SECTION */}
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

      {/* 3. SPACER */}
      <div className="flex-1"></div>

      {/* 4. BOTTOM SECTION */}
      <div className="relative z-10 w-full max-w-4xl px-6 pb-12 md:pb-16 flex flex-col items-center animate-in slide-in-from-bottom-10 fade-in duration-1000 delay-300">
        
        {/* Main Action Button */}
        <button 
          onClick={handleStart}
          className="group relative w-full max-w-md px-12 py-6 mb-8 bg-gradient-to-r from-[#b45309] to-[#ca8a04] hover:from-[#d97706] hover:to-[#f59e0b] text-black font-bold text-2xl uppercase tracking-widest rounded shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:shadow-[0_0_40px_rgba(234,179,8,0.6)] hover:scale-105 transition-all duration-300"
        >
          <div className="flex items-center justify-center gap-4">
             <span className="font-serif">Initialize Conquest</span>
             <Play size={24} fill="currentColor" className="group-hover:translate-x-1 transition-transform"/>
          </div>
          <div className="absolute inset-0 rounded overflow-hidden">
             <div className="absolute top-0 left-[-100%] w-[50%] h-full bg-white/20 -skew-x-12 group-hover:left-[200%] transition-all duration-700 ease-in-out" />
          </div>
        </button>

        {/* Simulation Grid */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            <button 
                onClick={onOpenSim} 
                className="flex flex-col items-center justify-center p-4 bg-slate-900/80 border border-slate-700 rounded hover:bg-slate-800 hover:border-slate-500 transition-all group"
            >
                <Beaker size={20} className="text-slate-400 group-hover:text-white mb-2" />
                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest group-hover:text-white">Balance Sim</span>
            </button>
            <button 
                onClick={onOpenStrategyLab} 
                className="flex flex-col items-center justify-center p-4 bg-slate-900/80 border border-slate-700 rounded hover:bg-slate-800 hover:border-[#fcd34d] transition-all group"
            >
                <FlaskConical size={20} className="text-[#fcd34d] mb-2" />
                <span className="text-xs text-[#fcd34d] font-bold uppercase tracking-widest">Strategy Lab</span>
            </button>
        </div>

        <div className="mt-6 text-[9px] text-slate-600 uppercase tracking-widest">Alpha Build 2.0</div>

      </div>
    </div>
  );
};

export default SplashScreen;
