
import React, { useState } from 'react';
import { runSimulationGame } from '../utils/simulationEngine';
import { X, Play, RefreshCcw, PieChart, Users } from 'lucide-react';
import { FACTIONS } from '../constants';

interface SimulationOverlayProps {
  onClose: () => void;
}

const SimulationOverlay: React.FC<SimulationOverlayProps> = ({ onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [simPlayerCount, setSimPlayerCount] = useState(4);

  const runSims = async () => {
      setIsRunning(true);
      setResults([]);
      setProgress(0);
      setStats(null); // Clear previous stats

      const TOTAL_GAMES = 1000;
      const BATCH_SIZE = 50;
      const tempResults: any[] = [];

      // Run in batches to allow UI updates
      for (let i = 0; i < TOTAL_GAMES; i += BATCH_SIZE) {
          await new Promise(resolve => setTimeout(resolve, 10)); // Yield to UI
          
          for (let j = 0; j < BATCH_SIZE && i + j < TOTAL_GAMES; j++) {
              tempResults.push(runSimulationGame(simPlayerCount));
          }
          setProgress(Math.min(100, Math.round(((i + BATCH_SIZE) / TOTAL_GAMES) * 100)));
      }

      setResults(tempResults);
      calculateStats(tempResults);
      setIsRunning(false);
  };

  const calculateStats = (data: any[]) => {
      const wins: Record<string, number> = {};
      const avgScore: Record<string, number> = {};
      const avgRes: Record<string, number> = {};

      const activeFactions = FACTIONS.slice(0, simPlayerCount);

      activeFactions.forEach(f => {
          wins[f.name] = 0;
          avgScore[f.name] = 0;
          avgRes[f.name] = 0;
      });

      data.forEach(game => {
          wins[game.winnerFaction] = (wins[game.winnerFaction] || 0) + 1;
          
          activeFactions.forEach((f, idx) => {
              if (game.scores[idx] !== undefined) {
                  avgScore[f.name] += game.scores[idx];
                  avgRes[f.name] += game.resources[idx];
              }
          });
      });

      // Average out
      Object.keys(avgScore).forEach(k => {
          avgScore[k] = parseFloat((avgScore[k] / data.length).toFixed(1));
          avgRes[k] = parseFloat((avgRes[k] / data.length).toFixed(1));
      });

      setStats({ wins, avgScore, avgRes, total: data.length });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in">
        <div className="w-full max-w-4xl bg-[#0f172a] border border-[#ca8a04] rounded-lg shadow-2xl flex flex-col h-[80vh]">
            {/* Header */}
            <div className="p-4 border-b border-slate-700 flex flex-col md:flex-row justify-between items-center bg-[#1e293b] gap-4">
                <div className="flex items-center gap-3">
                    <PieChart className="text-[#fcd34d]" size={24} />
                    <h2 className="text-[#fcd34d] font-title text-xl uppercase tracking-widest">Balance Simulator (v11)</h2>
                </div>

                {/* Player Count Selector */}
                <div className="flex bg-slate-900 rounded p-1 border border-slate-700">
                    {[2, 3, 4].map(count => (
                        <button
                            key={count}
                            onClick={() => !isRunning && setSimPlayerCount(count)}
                            disabled={isRunning}
                            className={`px-4 py-1.5 text-xs font-bold uppercase rounded transition-all flex items-center gap-2
                                ${simPlayerCount === count 
                                    ? 'bg-[#ca8a04] text-black shadow-lg' 
                                    : 'text-slate-500 hover:text-slate-300'}
                            `}
                        >
                            <Users size={12} /> {count}P
                        </button>
                    ))}
                </div>

                <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24}/></button>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                
                {!stats && !isRunning && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                        <Play size={64} className="text-slate-600 mb-4"/>
                        <p className="text-slate-400 uppercase tracking-widest">Ready to initialize simulation sequence</p>
                        <p className="text-slate-500 text-xs mt-2">Selected Mode: {simPlayerCount} Players</p>
                    </div>
                )}

                {isRunning && (
                    <div className="h-full flex flex-col items-center justify-center">
                        <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
                            <div className="h-full bg-[#ca8a04] transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                        <p className="text-[#fcd34d] font-mono text-lg">Simulating Warfare ({simPlayerCount}P)... {progress}%</p>
                    </div>
                )}

                {stats && !isRunning && (
                    <div className="animate-in slide-in-from-bottom-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                             {/* Win Rate Chart */}
                             <div className="bg-slate-900 p-4 rounded border border-slate-700">
                                 <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-4">Victory Distribution</h3>
                                 <div className="space-y-3">
                                     {FACTIONS.slice(0, simPlayerCount).map(f => {
                                         const rate = stats.wins[f.name];
                                         const percent = ((rate / stats.total) * 100).toFixed(1);
                                         return (
                                             <div key={f.name}>
                                                 <div className="flex justify-between text-xs mb-1">
                                                     <span style={{color: f.color}} className="font-bold">{f.name}</span>
                                                     <span className="text-white font-mono">{percent}% ({rate} wins)</span>
                                                 </div>
                                                 <div className="w-full h-1.5 bg-slate-800 rounded-full">
                                                     <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: f.color }}></div>
                                                 </div>
                                             </div>
                                         )
                                     })}
                                 </div>
                             </div>

                             {/* Averages */}
                             <div className="bg-slate-900 p-4 rounded border border-slate-700">
                                 <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-4">Average Performance</h3>
                                 <div className="space-y-4">
                                     <div className="grid grid-cols-3 text-[10px] text-slate-500 uppercase border-b border-slate-800 pb-2">
                                         <span>Faction</span>
                                         <span className="text-right">Avg VP</span>
                                         <span className="text-right">Avg Wealth</span>
                                     </div>
                                     {FACTIONS.slice(0, simPlayerCount).map(f => (
                                         <div key={f.name} className="grid grid-cols-3 text-sm font-mono items-center">
                                             <span style={{color: f.color}} className="font-bold truncate">{f.name}</span>
                                             <span className="text-right text-white">{stats.avgScore[f.name]}</span>
                                             <span className="text-right text-slate-400">{stats.avgRes[f.name]}</span>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                        </div>
                        
                        <div className="text-center text-xs text-slate-500">
                            Simulated {stats.total} games on {simPlayerCount}-Player Map.
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700 bg-[#1e293b] flex justify-between items-center">
                 <div className="text-xs text-slate-500">
                    {stats ? "Analysis Complete" : "System Standby"}
                 </div>
                <button 
                    onClick={runSims} 
                    disabled={isRunning}
                    className="flex items-center gap-2 px-6 py-3 bg-[#ca8a04] hover:bg-[#eab308] text-black font-bold uppercase tracking-widest rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {stats ? <><RefreshCcw size={18}/> Re-Run ({simPlayerCount}P)</> : <><Play size={18}/> Run 1000 Games</>}
                </button>
            </div>
        </div>
    </div>
  );
};

export default SimulationOverlay;
