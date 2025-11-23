
import React from 'react';
import { Player } from '../types';
import { User, Check } from 'lucide-react';

interface TurnOrderTrackerProps {
  players: Player[];
  turnOrder: number[];
  turnOrderIndex: number;
}

const TurnOrderTracker: React.FC<TurnOrderTrackerProps> = ({ players, turnOrder, turnOrderIndex }) => {
  const activePlayerId = turnOrder[turnOrderIndex];

  return (
    <div className="flex items-center gap-4 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg px-4 py-1.5 shadow-lg">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Turn Order</h3>
      <div className="flex items-center gap-2">
        {turnOrder.map((playerId, index) => {
          const player = players.find(p => p.id === playerId);
          if (!player) return null;

          const isActive = player.id === activePlayerId;
          const isHuman = player.isHuman;
          const initial = player.faction.name.split(' ').map(n => n[0]).join('').substring(0, 2);

          return (
            <React.Fragment key={player.id}>
              <div
                title={player.name}
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm relative transition-all duration-300
                  ${isActive ? 'ring-2 ring-offset-2 ring-offset-[#0f172a] ring-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.7)] scale-110' : 'opacity-60 grayscale-[50%]'}`}
                style={{ 
                  backgroundColor: player.faction.color,
                  color: player.faction.textColor,
                }}
              >
                {isHuman ? <User size={16} /> : initial}
                {player.hasPassed && !isActive && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-800 border border-slate-600 rounded-full flex items-center justify-center text-green-400" title="Passed">
                    <Check size={12} />
                  </div>
                )}
              </div>
              {index < turnOrder.length - 1 && (
                <span className="text-slate-600 text-lg font-thin px-1">→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default TurnOrderTracker;
