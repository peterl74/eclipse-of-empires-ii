
import React from 'react';
import { TileType } from '../types';
import { TILE_CONFIG } from '../constants';
import { VenetianMask, CheckCircle } from 'lucide-react';

interface DeclarationModalProps {
  isOpen: boolean;
  onConfirm: (type: TileType) => void;
  onCancel: () => void;
  trueType: TileType; // NEW PROP
}

const DeclarationModal: React.FC<DeclarationModalProps> = ({ isOpen, onConfirm, onCancel, trueType }) => {
  if (!isOpen) return null;

  const options = [TileType.Plains, TileType.Mountains, TileType.Goldmine, TileType.RelicSite];

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-[#0f172a] border border-purple-500 w-full max-w-lg rounded-xl shadow-2xl p-6 relative animate-in zoom-in-95">
            <h2 className="text-purple-400 font-title text-xl uppercase tracking-widest text-center mb-2 flex items-center justify-center gap-2">
                <VenetianMask size={24}/> Declare Territory
            </h2>
            <p className="text-slate-400 text-center text-sm mb-6">
                Publicly announce the type of this land. <br/>
                <span className="text-xs opacity-50">Truth: {TILE_CONFIG[trueType].label}</span>
            </p>
            
            <div className="grid grid-cols-2 gap-3">
                {options.map((type) => {
                    const isGenuine = type === trueType;
                    return (
                        <button 
                            key={type}
                            onClick={() => onConfirm(type)}
                            className={`p-4 rounded border flex flex-col items-center gap-2 transition-all hover:scale-105 active:scale-95 relative overflow-hidden
                                ${isGenuine ? 'ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'hover:brightness-110'}
                            `}
                            style={{ 
                                backgroundColor: `${TILE_CONFIG[type].color}20`, 
                                borderColor: isGenuine ? '#10b981' : TILE_CONFIG[type].color 
                            }}
                        >
                            {isGenuine && (
                                <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] px-2 py-0.5 rounded-bl font-bold uppercase tracking-wider flex items-center gap-1">
                                    <CheckCircle size={8} /> Genuine
                                </div>
                            )}
                            {!isGenuine && (
                                <div className="absolute top-0 left-0 bg-purple-600/50 text-purple-100 text-[9px] px-2 py-0.5 rounded-br font-bold uppercase tracking-wider opacity-0 hover:opacity-100 transition-opacity">
                                    Bluff
                                </div>
                            )}
                            
                            <div className="font-bold uppercase tracking-wider text-sm text-white">{TILE_CONFIG[type].label}</div>
                        </button>
                    );
                })}
            </div>
            
            <button 
                onClick={onCancel} 
                className="mt-6 w-full py-3 text-slate-500 hover:text-white uppercase text-xs font-bold transition-colors"
            >
                Cancel
            </button>
        </div>
    </div>
  );
};

export default DeclarationModal;
