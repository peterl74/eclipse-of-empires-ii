
import React from 'react';
import { Player } from '../types';
import { User, Check, XCircle, ArrowRight, Skull } from 'lucide-react';

interface TurnOrderTrackerProps {
  players: Player[];
  turnOrder: number[];
  turnOrderIndex: number;
}

const TurnOrderTracker: React.FC<TurnOrderTrackerProps> = ({ players, turnOrder, turnOrderIndex }) => {
  const activePlayerId = turnOrder[turnOrderIndex];

  return (
    <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-full px-4 py-2 shadow-lg">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mr-2 border-r border-slate-700 pr-4">TURN</h3>
      <div className="flex items-center gap-2">
        {turnOrder.map((playerId, index) => {
          const player = players.find(p => p.id === playerId);
          if (!player) return null;

          const isActive = player.id === activePlayerId;
          const isHuman = player.isHuman;
          const isPassed = player.hasPassed;
          const isEliminated = player.isEliminated;
          const initial = player.faction.name.split(' ').map(n => n[0]).join('').substring(0, 2);

          return (
            <React.Fragment key={player.id}>
              <div 
                className="flex flex-col items-center gap-1 relative"
                title={isEliminated ? `${player.name} (Eliminated)` : isPassed ? `${player.name} (Passed)` : player.name}
              >
                  {/* Avatar Circle */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm relative transition-all duration-300 border-2
                      ${isActive 
                        ? 'border-yellow-400 ring-4 ring-yellow-400/20 scale-110 z-10 shadow-[0_0_15px_rgba(250,204,21,0.5)]' 
                        : isEliminated
                           ? 'border-red-800 bg-black scale-90'
                           : isPassed 
                               ? 'border-slate-700 bg-slate-800 scale-90' 
                               : 'border-slate-600 opacity-80'
                      }`}
                    style={{ 
                      backgroundColor: isActive ? player.faction.color : (isEliminated ? '#111827' : isPassed ? '#1e293b' : player.faction.color),
                      color: isEliminated ? '#ef4444' : (isPassed ? '#64748b' : player.faction.textColor),
                    }}
                  >
                    {isHuman ? <User size={18} /> : initial}
                    
                    {/* Status Indicators */}
                    {isEliminated ? (
                       <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full">
                         <Skull size={20} className="text-red-500" />
                       </div>
                    ) : isPassed && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                         <XCircle size={20} className="text-slate-500" />
                      </div>
                    )}
                  </div>

                  {/* Order Label */}
                  <span className={`text-[9px] font-mono font-bold uppercase tracking-wider
                     ${isActive ? 'text-yellow-400 animate-pulse' : isEliminated ? 'text-red-500' : isPassed ? 'text-slate-600' : 'text-slate-400'}
                  `}>
                      {isActive ? 'ACTIVE' : (isEliminated ? 'ELIMINATED' : isPassed ? 'PASSED' : `#${index + 1}`)}
                  </span>
              </div>

              {index < turnOrder.length - 1 && (
                <ArrowRight size={16} className={`mx-1 ${isActive ? 'text-yellow-500' : 'text-slate-700'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default TurnOrderTracker;