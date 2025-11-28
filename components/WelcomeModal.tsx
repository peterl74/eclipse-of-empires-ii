import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Zap, BrainCircuit, Box } from 'lucide-react';

interface WelcomeModalProps {
  onClose: () => void;
  forceShow?: boolean; // NEW PROP: Allow parent to force it open
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ onClose, forceShow = false }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // If forceShow is true, ignore localStorage and show it
    if (forceShow) {
      setIsVisible(true);
      return;
    }

    // Otherwise, check localStorage
    const hasSeen = localStorage.getItem('eoe_welcome_seen');
    if (!hasSeen) {
      setIsVisible(true);
    }
  }, [forceShow]);

  const handleClose = () => {
    localStorage.setItem('eoe_welcome_seen', 'true');
    setIsVisible(false);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="bg-[#0f172a] border border-[#ca8a04] w-full max-w-2xl max-h-[90vh] rounded-lg shadow-2xl relative flex flex-col animate-in slide-in-from-bottom-10">
        
        {/* Close X Button */}
        <button 
            onClick={handleClose}
            className="absolute top-2 right-2 z-50 p-2 bg-black/50 hover:bg-black/80 text-slate-400 hover:text-white rounded-full transition-colors"
        >
            <X size={20} />
        </button>

        {/* Header */}
        <div className="bg-[#1e293b] p-4 md:p-6 border-b border-slate-700 text-center relative shrink-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(202,138,4,0.15),_transparent_70%)]" />
            <h2 className="text-[#fcd34d] font-title text-2xl md:text-3xl font-bold uppercase tracking-widest relative z-10">
                Welcome to the Eclipse
            </h2>
            <p className="text-slate-400 text-[10px] md:text-xs uppercase tracking-wide mt-1 md:mt-2 relative z-10">
                Digital Companion Edition
            </p>
        </div>

        {/* Content - Scrollable */}
        <div className="p-4 md:p-8 bg-[#0b0a14] space-y-4 md:space-y-6 text-[#e2d9c5] overflow-y-auto custom-scrollbar flex-1">
            <p className="text-sm leading-relaxed text-slate-300 text-center">
                While this App faithfully recreates the empire building of <b>Eclipse of Empires II</b>, it handles the "Fog of War" differently than the physical board game.
            </p>

            <div className="grid grid-cols-1 gap-3 md:gap-4">
                <div className="flex gap-3 md:gap-4 p-3 bg-slate-900/50 border border-slate-800 rounded-lg items-start">
                    <div className="p-2 bg-blue-900/20 rounded border border-blue-500/30 shrink-0">
                        <ShieldCheck className="text-blue-400" size={18} />
                    </div>
                    <div>
                        <h4 className="text-blue-200 font-bold text-xs md:text-sm uppercase mb-1">The Code is the Banker</h4>
                        <p className="text-[10px] md:text-xs text-slate-400 leading-relaxed">
                            Income is calculated automatically based on the <b>True Type</b> of your tiles. It is impossible to "cheat the bank" or commit tax fraud in this version.
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 md:gap-4 p-3 bg-slate-900/50 border border-slate-800 rounded-lg items-start">
                    <div className="p-2 bg-emerald-900/20 rounded border border-emerald-500/30 shrink-0">
                        <Zap className="text-emerald-400" size={18} />
                    </div>
                    <div>
                        <h4 className="text-emerald-200 font-bold text-xs md:text-sm uppercase mb-1">No Challenges Required</h4>
                        <p className="text-[10px] md:text-xs text-slate-400 leading-relaxed">
                            Since the App handles math honestly, the <b>"Challenge"</b> mechanic—used to catch liars in the tabletop game—has been removed to streamline play.
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 md:gap-4 p-3 bg-slate-900/50 border border-slate-800 rounded-lg items-start">
                    <div className="p-2 bg-purple-900/20 rounded border border-purple-500/30 shrink-0">
                        <BrainCircuit className="text-purple-400" size={18} />
                    </div>
                    <div>
                        <h4 className="text-purple-200 font-bold text-xs md:text-sm uppercase mb-1">Pure Strategy</h4>
                        <p className="text-[10px] md:text-xs text-slate-400 leading-relaxed">
                            Your deception here comes from <b>Hidden Information</b>—bluffing about what your face-down tiles are to entice or repel enemies.
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabletop Plug */}
            <div className="mt-4 p-3 md:p-4 border border-[#ca8a04]/30 bg-[#ca8a04]/10 rounded flex items-center gap-3 md:gap-4">
                <Box size={24} className="text-[#fcd34d] shrink-0" />
                <div className="text-[10px] md:text-xs">
                    <span className="text-[#fcd34d] font-bold uppercase block mb-1">Want the full psychological experience?</span>
                    <span className="text-slate-300">
                        In the <b>Tabletop Edition</b>, players physically draw tokens, allowing for "Financial Fraud." If you want to look your friends in the eye and lie to their faces, play the board game!
                    </span>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="bg-[#1e293b] p-4 border-t border-slate-700 flex justify-center shrink-0">
             <button 
                onClick={handleClose}
                className="w-full md:w-auto px-8 md:px-12 py-3 bg-[#ca8a04] hover:bg-[#eab308] text-black font-bold uppercase tracking-widest rounded shadow-lg transition-transform hover:scale-105 text-sm md:text-base"
             >
                 Enter the Eclipse
             </button>
        </div>

      </div>
    </div>
  );
};

export default WelcomeModal;