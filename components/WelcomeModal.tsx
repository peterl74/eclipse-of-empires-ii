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
      <div className="bg-[#0f172a] border border-[#ca8a04] w-full max-w-2xl rounded-lg shadow-2xl relative flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
        
        {/* Header */}
        <div className="bg-[#1e293b] p-6 border-b border-slate-700 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(202,138,4,0.15),_transparent_70%)]" />
            <h2 className="text-[#fcd34d] font-title text-3xl font-bold uppercase tracking-widest relative z-10">
                Welcome to the Eclipse
            </h2>
            <p className="text-slate-400 text-xs uppercase tracking-wide mt-2 relative z-10">
                Digital Companion Edition
            </p>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 bg-[#0b0a14] space-y-6 text-[#e2d9c5]">
            <p className="text-sm leading-relaxed text-slate-300 text-center">
                While this App faithfully recreates the empire building of <b>Eclipse of Empires II</b>, it handles the "Fog of War" differently than the physical board game.
            </p>

            <div className="grid grid-cols-1 gap-4">
                <div className="flex gap-4 p-3 bg-slate-900/50 border border-slate-800 rounded-lg items-start">
                    <div className="p-2 bg-blue-900/20 rounded border border-blue-500/30 shrink-0">
                        <ShieldCheck className="text-blue-400" size={20} />
                    </div>
                    <div>
                        <h4 className="text-blue-200 font-bold text-sm uppercase mb-1">The Code is the Banker</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Income is calculated automatically based on the <b>True Type</b> of your tiles. It is impossible to "cheat the bank" or commit tax fraud in this version.
                        </p>
                    </div>
                </div>

                <div className="flex gap-4 p-3 bg-slate-900/50 border border-slate-800 rounded-lg items-start">
                    <div className="p-2 bg-emerald-900/20 rounded border border-emerald-500/30 shrink-0">
                        <Zap className="text-emerald-400" size={20} />
                    </div>
                    <div>
                        <h4 className="text-emerald-200 font-bold text-sm uppercase mb-1">No Challenges Required</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Since the App handles math honestly, the <b>"Challenge"</b> mechanic—used to catch liars in the tabletop game—has been removed to streamline play.
                        </p>
                    </div>
                </div>

                <div className="flex gap-4 p-3 bg-slate-900/50 border border-slate-800 rounded-lg items-start">
                    <div className="p-2 bg-purple-900/20 rounded border border-purple-500/30 shrink-0">
                        <BrainCircuit className="text-purple-400" size={20} />
                    </div>
                    <div>
                        <h4 className="text-purple-200 font-bold text-sm uppercase mb-1">Pure Strategy</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Your deception here comes from <b>Hidden Information</b>—bluffing about what your face-down tiles are to entice or repel enemies.
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabletop Plug */}
            <div className="mt-4 p-4 border border-[#ca8a04]/30 bg-[#ca8a04]/10 rounded flex items-center gap-4">
                <Box size={32} className="text-[#fcd34d]" />
                <div className="text-xs">
                    <span className="text-[#fcd34d] font-bold uppercase block mb-1">Want the full psychological experience?</span>
                    <span className="text-slate-300">
                        In the <b>Tabletop Edition</b>, players physically draw tokens, allowing for "Financial Fraud." If you want to look your friends in the eye and lie to their faces, play the board game!
                    </span>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="bg-[#1e293b] p-4 border-t border-slate-700 flex justify-center">
             <button 
                onClick={handleClose}
                className="w-full md:w-auto px-12 py-3 bg-[#ca8a04] hover:bg-[#eab308] text-black font-bold uppercase tracking-widest rounded shadow-lg transition-transform hover:scale-105"
             >
                 Enter the Eclipse
             </button>
        </div>

      </div>
    </div>
  );
};

export default WelcomeModal;