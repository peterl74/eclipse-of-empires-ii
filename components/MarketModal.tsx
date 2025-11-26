import React from 'react';
import { Resource } from '../types';
import { X, ArrowRight, RefreshCcw } from 'lucide-react';
import ResourceIcon from './ResourceIcon';
import { RESOURCE_COLORS } from '../constants';

interface MarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (resource: Resource) => void;
  playerResources: Record<Resource, number>;
}

const MarketModal: React.FC<MarketModalProps> = ({ isOpen, onClose, onConfirm, playerResources }) => {
  if (!isOpen) return null;

  const tradeOptions = [
    { resource: Resource.Stone, bg: 'bg-slate-900', border: 'border-slate-600' },
    { resource: Resource.Gold, bg: 'bg-amber-950', border: 'border-amber-600' },
    { resource: Resource.Relic, bg: 'bg-emerald-950', border: 'border-emerald-600' }
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-[#ca8a04] w-full max-w-2xl rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] relative flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="bg-[#1e293b] p-4 border-b border-slate-700 flex justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#ca8a04]"></div>
            <div className="flex items-center gap-3 relative z-10">
                <div className="p-2 bg-slate-800 rounded border border-slate-600">
                    <RefreshCcw className="text-[#fcd34d]" size={20} />
                </div>
                <div>
                    <h2 className="text-[#fcd34d] font-title text-xl uppercase tracking-widest font-bold leading-none">Emergency Market</h2>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wide mt-1">Exchange excess goods for supplies</p>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-full"
            >
                <X size={24} />
            </button>
        </div>

        {/* Body */}
        <div className="p-6 md:p-8 bg-[#0b0a14]">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {tradeOptions.map((opt) => {
                     const currentAmount = playerResources[opt.resource];
                     const canAfford = currentAmount >= 3;
                     const color = RESOURCE_COLORS[opt.resource];
                     
                     return (
                         <button
                            key={opt.resource}
                            onClick={() => canAfford && onConfirm(opt.resource)}
                            disabled={!canAfford}
                            className={`group relative p-4 rounded-lg border-2 transition-all duration-300 flex flex-col items-center gap-4 text-center
                                ${canAfford 
                                    ? `${opt.bg} ${opt.border} hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] cursor-pointer` 
                                    : 'bg-slate-900 border-slate-800 opacity-40 cursor-not-allowed grayscale'}
                            `}
                         >
                             {/* Header of Card */}
                             <div className="text-xs uppercase font-bold tracking-widest text-slate-400">Trade {opt.resource}</div>
                             
                             {/* Icon Visual */}
                             <div className="flex items-center gap-3">
                                 <div className="flex flex-col items-center">
                                     <ResourceIcon resource={opt.resource} size={32} />
                                     <span className={`text-lg font-bold mt-1`} style={{ color }}>3</span>
                                 </div>
                                 <ArrowRight size={20} className="text-slate-500 group-hover:text-white transition-colors" />
                                 <div className="flex flex-col items-center">
                                     <ResourceIcon resource={Resource.Grain} size={32} />
                                     <span className="text-lg font-bold text-yellow-500 mt-1">1</span>
                                 </div>
                             </div>

                             {/* Footer of Card */}
                             <div className={`w-full py-2 rounded text-xs font-bold uppercase tracking-widest mt-auto
                                 ${canAfford ? 'bg-slate-800 text-white group-hover:bg-[#ca8a04] group-hover:text-black' : 'bg-slate-800 text-slate-500'}
                             `}>
                                 {canAfford ? 'Confirm Trade' : `Need 3 (${currentAmount}/3)`}
                             </div>
                         </button>
                     );
                 })}
             </div>
        </div>

        {/* Footer */}
        <div className="bg-[#1e293b] p-4 border-t border-slate-700 flex justify-center">
             <button 
                onClick={onClose}
                className="px-8 py-2 text-slate-400 hover:text-white text-sm uppercase tracking-widest font-bold transition-colors"
             >
                 Cancel
             </button>
        </div>

      </div>
    </div>
  );
};

export default MarketModal;