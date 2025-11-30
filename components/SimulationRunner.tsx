
import React, { useState } from 'react';
import { GameState, Player, CitizenType } from '../types';
import { generateMap, getNeighbors, getHexId } from '../utils/hexUtils';
import { FACTIONS, TILE_CONFIG, VP_CONFIG, TOTAL_ROUNDS, RESOURCE_COLORS } from '../constants';
import { Sword, Hammer, Scale, Compass, RefreshCcw, Play, X, FlaskConical } from 'lucide-react';
import { Resource, TileType } from '../types';

interface SimulationRunnerProps {
    onClose: () => void;
}

const SIM_COUNT = 200; 
const MAX_ROUNDS = 5;

type Strategy = CitizenType | 'RANDOM';

const SimulationRunner: React.FC<SimulationRunnerProps> = ({ onClose }) => {
  const [results, setResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [strategies, setStrategies] = useState<Strategy[]>(['RANDOM', 'RANDOM', 'RANDOM', 'RANDOM']);

  const applyPreset = (type: string) => {
      switch(type) {
          case 'WAR': setStrategies([CitizenType.Warrior, CitizenType.Warrior, CitizenType.Warrior, CitizenType.Warrior]); break;
          case 'ECO': setStrategies([CitizenType.Merchant, CitizenType.Merchant, CitizenType.Merchant, CitizenType.Merchant]); break;
          case 'BUILD': setStrategies([CitizenType.Builder, CitizenType.Builder, CitizenType.Builder, CitizenType.Builder]); break;
          case 'RACE': setStrategies([CitizenType.Explorer, CitizenType.Explorer, CitizenType.Explorer, CitizenType.Explorer]); break;
          case 'PREDATOR': setStrategies([CitizenType.Warrior, CitizenType.Builder, CitizenType.Builder, CitizenType.Merchant]); break; 
          case 'META': setStrategies([CitizenType.Warrior, CitizenType.Builder, CitizenType.Explorer, CitizenType.Merchant]); break; 
          default: setStrategies(['RANDOM', 'RANDOM', 'RANDOM', 'RANDOM']);
      }
  };

  const runSimulation = async () => {
    setIsRunning(true);
    setResults(null);
    
    const stats = {
        winsByPlayer: [0, 0, 0, 0],
        avgVp: [0, 0, 0, 0],
        roleBreakdown: { [CitizenType.Warrior]: 0, [CitizenType.Builder]: 0, [CitizenType.Merchant]: 0, [CitizenType.Explorer]: 0 }
    };

    for (let i = 0; i < SIM_COUNT; i++) {
        const finalState = runSingleGame();
        
        const ranked = [...finalState.players].sort((a, b) => b.vp - a.vp);
        const winner = ranked[0];
        stats.winsByPlayer[winner.id]++;

        finalState.players.forEach(p => {
            stats.avgVp[p.id] += p.vp;
        });

        if (i % 20 === 0) {
            setProgress(i);
            await new Promise(r => setTimeout(r, 0));
        }
    }

    stats.avgVp = stats.avgVp.map((v: number) => parseFloat((v / SIM_COUNT).toFixed(1)));

    setResults(stats);
    setIsRunning(false);
  };

  // --- MINI ENGINE ---
  const runSingleGame = (): GameState => {
      const playerCount = 4;
      const map = generateMap(playerCount);
      let players: Player[] = [];

      for(let i=0; i<playerCount; i++) {
          players.push({
              id: i, name: FACTIONS[i].name, faction: FACTIONS[i], isHuman: false,
              resources: { Grain: 2, Stone: 1, Gold: 1, Relic: 0 },
              activeRelicPower: null, selectedCitizen: null, vp: 0,
              secretObjectives: [], eventHand: [], hasActed: false, hasPassed: false, actionsTaken: 0, isEliminated: false,
              stats: { battlesWon: 0, tilesRevealed: 0, relicEventsTriggered: 0, maxResourcesHeld: 0, tilesLost: 0, attacksMade: 0, uniquePlayersAttacked: [], relicSitesRevealed: 0 },
              status: { canAttack: true, combatBonus: 0, fortificationBlocked: false, incomeMultiplier: 1, freeTrades: 0, passiveIncome: false, freeFortify: false, extraActions: 0, turnLost: false }
          });
      }
      
      const allIds = Object.keys(map);
      const edgeIds = allIds.filter(id => getNeighbors(map[id].q, map[id].r).filter(n => map[getHexId(n.q, n.r)]).length < 6).slice(0, 4);
      edgeIds.forEach((id, idx) => {
          if (map[id]) {
              map[id].ownerId = idx;
              map[id].type = TileType.Capital;
              map[id].fortification = { ownerId: idx, level: 1 };
          }
      });

      for (let round = 1; round <= MAX_ROUNDS; round++) {
          // INCOME
          players.forEach(p => {
              if (p.isEliminated) return;
              // Capital
              p.resources.Grain++; p.resources.Stone++; p.resources.Gold++; 
              // Tiles + Fortified Industry
              Object.values(map).forEach(h => {
                  if(h.ownerId === p.id) {
                      const bonus = h.fortification ? 1 : 0; // FORTIFIED INDUSTRY
                      if (h.type === TileType.Capital) {
                          p.resources.Grain += bonus;
                          p.resources.Stone += bonus;
                          p.resources.Gold += bonus;
                      } else if (TILE_CONFIG[h.type].resource) {
                          p.resources[TILE_CONFIG[h.type].resource!] += (1 + bonus);
                      }
                  }
              });
          });

          // COUNCIL
          players.forEach((p, idx) => {
              if (p.isEliminated) return;
              const strat = strategies[idx];
              if (strat !== 'RANDOM') {
                  p.selectedCitizen = strat;
              } else {
                  if (p.resources.Grain < 1) p.selectedCitizen = CitizenType.Merchant;
                  else if (round === 1) p.selectedCitizen = CitizenType.Explorer;
                  else p.selectedCitizen = [CitizenType.Warrior, CitizenType.Builder][Math.floor(Math.random()*2)];
              }
          });

          // ACTION PHASE
          let passes = 0;
          players.forEach(p => { p.actionsTaken = 0; p.hasPassed = false; });

          while(passes < playerCount) {
              passes = 0;
              for(let i=0; i<playerCount; i++) {
                  const p = players[i];
                  if (p.hasPassed || p.isEliminated) { passes++; continue; }

                  const role = p.selectedCitizen;
                  let didAction = false;
                  
                  const myTiles = Object.values(map).filter(h => h.ownerId === p.id);
                  const neighborIds = myTiles.flatMap(h => getNeighbors(h.q, h.r)).map(n => getHexId(n.q, n.r));

                  // LOGIC
                  if (role === CitizenType.Warrior) {
                       const cost = p.actionsTaken === 0 ? 1 : 2;
                       if (p.resources.Grain >= cost) {
                           const enemies = neighborIds.filter(nid => map[nid] && map[nid].ownerId !== null && map[nid].ownerId !== p.id);
                           if (enemies.length > 0) {
                               p.resources.Grain -= cost;
                               if (Math.random() > 0.5) { 
                                   p.stats.battlesWon++; 
                                   const targetId = map[enemies[0]].ownerId!;
                                   map[enemies[0]].ownerId = p.id;
                                   map[enemies[0]].fortification = null;
                                   
                                   // PILLAGE MECHANIC
                                   const victim = players[targetId];
                                   if (!victim.isEliminated) {
                                       const stealable = ([Resource.Grain, Resource.Stone, Resource.Gold] as Resource[]).filter(r => victim.resources[r] > 0);
                                       if (stealable.length > 0) {
                                           const loot = stealable[Math.floor(Math.random() * stealable.length)];
                                           victim.resources[loot]--;
                                           p.resources[loot]++;
                                       }
                                   }
                               } 
                               didAction = true;
                           }
                       }
                  } 
                  else if (role === CitizenType.Explorer) {
                       const cost = 1; // Flat 1 Grain
                       if (p.resources.Grain >= cost) {
                           const neutral = neighborIds.filter(nid => map[nid] && map[nid].ownerId === null);
                           if (neutral.length > 0) {
                               if (cost > 0) p.resources.Grain -= cost;
                               map[neutral[0]].ownerId = p.id;
                               didAction = true;
                           }
                       }
                  }
                  else if (role === CitizenType.Builder) {
                       if (p.resources.Stone >= 2) { // 2 Stone Cost
                           const unfortified = myTiles.find(t => !t.fortification);
                           if (unfortified) {
                               p.resources.Stone-=2;
                               unfortified.fortification = { ownerId: p.id, level: 1 };
                               didAction = true;
                           }
                       }
                  }
                  else if (role === CitizenType.Merchant) {
                       if (p.resources.Grain >= 2) {
                           p.resources.Grain -= 2;
                           p.resources.Gold++;
                           didAction = true;
                       }
                  }

                  if (!didAction && p.resources.Grain === 0) {
                      if(p.resources.Gold >= 3) { p.resources.Gold-=3; p.resources.Grain++; didAction=true; }
                      else if(p.resources.Stone >= 3) { p.resources.Stone-=3; p.resources.Grain++; didAction=true; }
                  }

                  if (didAction) p.actionsTaken++;
                  else p.hasPassed = true;
              }
          }
      }
      
      players.forEach(p => {
         const owned = Object.values(map).filter(h => h.ownerId === p.id);
         let tileVp = owned.reduce((sum, h) => sum + (VP_CONFIG[h.type] || 0), 0);
         let fortVp = owned.filter(h => h.fortification).length * VP_CONFIG.Fortification;
         p.vp = tileVp + fortVp + (p.resources.Relic * VP_CONFIG.RelicToken);
      });

      return { players, map } as GameState;
  };

  const getIcon = (s: Strategy) => {
      if (s === CitizenType.Warrior) return <Sword size={16} className="text-red-400"/>;
      if (s === CitizenType.Builder) return <Hammer size={16} className="text-green-400"/>;
      if (s === CitizenType.Merchant) return <Scale size={16} className="text-yellow-400"/>;
      if (s === CitizenType.Explorer) return <Compass size={16} className="text-blue-400"/>;
      return <RefreshCcw size={16} className="text-slate-400"/>;
  };

  return (
      <div className="fixed inset-0 z-[200] bg-[#0b0a14] p-8 overflow-y-auto font-sans text-slate-200 animate-in fade-in">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                <div className="flex items-center gap-3">
                    <FlaskConical className="text-[#fcd34d]" size={32} />
                    <h1 className="text-3xl font-title text-[#fcd34d]">Strategy Lab (Beta)</h1>
                </div>
                <button onClick={onClose} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                    <X size={24} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-slate-900 p-6 rounded-lg border border-slate-700 shadow-lg">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Assign Player Strategies</h3>
                    <div className="space-y-3">
                        {strategies.map((strat, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-slate-800 p-3 rounded border border-slate-600">
                                <span className="font-bold" style={{color: FACTIONS[idx].color}}>{FACTIONS[idx].name}</span>
                                <div className="flex items-center gap-2">
                                    {getIcon(strat)}
                                    <select 
                                        value={strat}
                                        onChange={(e) => {
                                            const newS = [...strategies];
                                            newS[idx] = e.target.value as Strategy;
                                            setStrategies(newS);
                                        }}
                                        className="bg-black text-xs p-2 rounded border border-slate-600 uppercase focus:border-[#fcd34d] outline-none"
                                    >
                                        <option value="RANDOM">Random (AI)</option>
                                        <option value={CitizenType.Warrior}>Force Warrior</option>
                                        <option value={CitizenType.Builder}>Force Builder</option>
                                        <option value={CitizenType.Merchant}>Force Merchant</option>
                                        <option value={CitizenType.Explorer}>Force Explorer</option>
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-lg border border-slate-700 shadow-lg">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Load Preset Matchup</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={()=>applyPreset('WAR')} className="p-3 bg-red-900/30 border border-red-500/50 rounded hover:bg-red-900/50 text-xs font-bold text-red-200 text-left">TOTAL WAR<br/><span className="font-normal opacity-70 text-[10px]">4x Warrior</span></button>
                        <button onClick={()=>applyPreset('ECO')} className="p-3 bg-yellow-900/30 border border-yellow-500/50 rounded hover:bg-yellow-900/50 text-xs font-bold text-yellow-200 text-left">GREED<br/><span className="font-normal opacity-70 text-[10px]">4x Merchant</span></button>
                        <button onClick={()=>applyPreset('PREDATOR')} className="p-3 bg-slate-800 border border-slate-600 rounded hover:bg-slate-700 text-xs font-bold text-white text-left">PREDATOR VS PREY<br/><span className="font-normal opacity-70 text-[10px]">1 Warrior vs 3 Builders</span></button>
                        <button onClick={()=>applyPreset('RACE')} className="p-3 bg-blue-900/30 border border-blue-500/50 rounded hover:bg-blue-900/50 text-xs font-bold text-blue-200 text-left">THE RACE<br/><span className="font-normal opacity-70 text-[10px]">4x Explorer</span></button>
                    </div>
                    
                    <button 
                            onClick={runSimulation}
                            disabled={isRunning}
                            className="w-full mt-6 py-4 bg-[#ca8a04] hover:bg-[#eab308] text-black font-bold uppercase tracking-widest rounded text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                    >
                        {isRunning ? `Simulating ${progress}%...` : <><Play size={20} fill="black"/> Run 200 Games</>}
                    </button>
                </div>
            </div>

            {results && (
                <div className="bg-slate-900 p-6 rounded-lg border border-slate-700 animate-in slide-in-from-bottom-4 shadow-2xl">
                    <h2 className="text-xl font-title text-white mb-6 border-b border-slate-700 pb-2">Match Results</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-4">Win Rates</h3>
                            <div className="space-y-4">
                                {results.winsByPlayer.map((wins: number, idx: number) => (
                                    <div key={idx}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-bold" style={{color: FACTIONS[idx].color}}>{FACTIONS[idx].name}</span>
                                            <span className="text-slate-400 text-xs uppercase">{strategies[idx]}</span>
                                            <span className="text-white font-mono">{((wins/SIM_COUNT)*100).toFixed(1)}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full transition-all duration-1000" style={{width: `${(wins/SIM_COUNT)*100}%`, backgroundColor: FACTIONS[idx].color}}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-4">Average VP Score</h3>
                            <div className="space-y-2">
                                {results.avgVp.map((vp: number, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center p-2 bg-black/20 rounded border border-slate-800">
                                        <span className="text-sm font-bold" style={{color: FACTIONS[idx].color}}>{FACTIONS[idx].name}</span>
                                        <span className="font-mono font-bold text-[#fcd34d]">{vp} VP</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </div>
      </div>
  );
};

export default SimulationRunner;
