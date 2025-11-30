
import React, { useEffect, useState } from 'react';
import { PendingChallenge, Player, TileType } from '../types';
import { TILE_CONFIG } from '../constants';
import { AlertTriangle, CheckCircle, ShieldAlert, Timer } from 'lucide-react';

interface ChallengeModalProps {
    challenge: PendingChallenge;
    declarer: Player;
    onResolve: (doChallenge: boolean) => void;
}

const ChallengeModal: React.FC<ChallengeModalProps> = ({ challenge, declarer, onResolve }) => {
    const [timeLeft, setTimeLeft] = useState(challenge.timer);

    useEffect(() => {
        if (!challenge.isActive) return;
        
        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    onResolve(false); // Auto-decline if time runs out
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [challenge.isActive, onResolve]);

    if (!challenge.isActive) return null;

    const declaredConfig = TILE_CONFIG[challenge.declaredType];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" />
            
            <div className="relative bg-[#0f172a] border-2 border-[#ca8a04] w-full max-w-lg rounded-xl shadow-[0_0_50px_rgba(202,138,4,0.3)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-5">
                
                {/* Header */}
                <div className="bg-[#1e293b] p-4 flex justify-between items-center border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <ShieldAlert className="text-[#fcd34d] animate-pulse" size={24} />
                        <div>
                            <h2 className="text-[#fcd34d] font-title text-xl uppercase font-bold tracking-widest leading-none">Declaration Alert</h2>
                            <p className="text-slate-400 text-[10px] uppercase mt-1">Expansion Detected</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-full border border-slate-600">
                        <Timer size={14} className="text-white"/>
                        <span className="text-white font-mono font-bold">{timeLeft}s</span>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8 bg-[#0b0a14] text-center">
                    <div className="mb-6">
                        <span className="font-bold text-lg" style={{ color: declarer.faction.color }}>{declarer.name}</span>
                        <span className="text-slate-300 mx-2">claims the new territory is:</span>
                    </div>

                    <div className="inline-flex flex-col items-center justify-center p-6 bg-slate-900 border border-slate-700 rounded-lg mb-8 min-w-[160px]">
                        <div className="text-2xl font-bold mb-1" style={{ color: declaredConfig.color }}>{declaredConfig.label}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-widest">Declared Type</div>
                    </div>

                    <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
                        Do you believe them? <br/>
                        <span className="text-xs opacity-70">
                            Challenging costs nothing but Reputation.
                            <br/>Wrong accusations cost <b>2 Gold</b>.
                            <br/>Correct challenges award <b>1 VP</b> & remove the tile.
                        </span>
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => onResolve(false)}
                            className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-widest rounded transition-colors flex items-center justify-center gap-2 border border-slate-600"
                        >
                            <CheckCircle size={18} />
                            Trust (Allow)
                        </button>
                        <button 
                            onClick={() => onResolve(true)}
                            className="py-3 bg-red-900 hover:bg-red-800 text-red-100 font-bold uppercase tracking-widest rounded transition-colors flex items-center justify-center gap-2 border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)]"
                        >
                            <AlertTriangle size={18} />
                            Challenge!
                        </button>
                    </div>
                </div>
                
                {/* Progress Bar for Timer */}
                <div className="h-1 bg-slate-800 w-full">
                    <div 
                        className="h-full bg-[#ca8a04] transition-all duration-1000 ease-linear"
                        style={{ width: `${(timeLeft / 5) * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default ChallengeModal;
