
import React, { useState } from 'react';
import { Phase, Player, CitizenType, HexData, TileType, Resource } from '../types';
import { CITIZEN_INFO } from '../constants';
import { Scale, Hammer, Sword, Compass, Lock, Play, Sparkles, Check, Eye, RotateCcw, X, SkipForward, Hourglass, User, Crown, RefreshCcw, Amphora, AlertTriangle } from 'lucide-react';

interface ActionPanelProps {
  phase: Phase;
  player: Player;
  isMyTurn: boolean;
  activePlayerName?: string;
  onSelectCitizen: (c: CitizenType) => void;
  onAction: (action: string, payload?: any) => void;
  onEndPhase: () => void;
  map?: Record<string, HexData>; 
  isActionPhaseDone?: boolean;
  isEliminated?: boolean;
  isLastStand?: boolean; // NEW: Sunset Rule Indicator
  uiState: {
    isSelectingTile: boolean;
    isDeclaring: boolean;
    isProcessing: boolean;
  };
}

const ActionPanel: React.FC<ActionPanelProps> = ({ phase, player, isMyTurn, activePlayerName, onSelectCitizen, onAction, onEndPhase, map, isActionPhaseDone, isEliminated, isLastStand, uiState }) => {
  
  const [isReselecting, setIsReselecting] = useState(false);
  const hasRuins = map ? Object.values(map).some((h: HexData) => h.ownerId === player.id && h.type === TileType.Ruins) : false;
  const hasHiddenRelic = map ? Object.values(map).some((h: HexData) => h.ownerId === player.id && h.type === TileType.RelicSite && h.publicType !== TileType.RelicSite) : false;

  const renderCitizenSelection = (title: string, btnLabel: string, onConfirm: () => void) => (
      <div className="w-full bg-[#0f172a] border-t border-[#ca8a04] p-3 shadow-[0_-5px_15px_rgba(0,0,0,0.5)] shrink-0 animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-[#fcd34d] font-bold font-title text-sm uppercase tracking-widest w-full text-center relative">
                {title}
                {phase === Phase.Action && (
                    <button onClick={onConfirm} className="absolute right-0 top-0 text-slate-500 hover:text-white p-1">
                        <X size={16}/>
                    </button>
                )}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
             {Object.values(CitizenType).map((cType) => {
                 const info = CITIZEN_INFO[cType];
                 const isSelected = player.selectedCitizen === cType;
                 let Icon = Scale;
                 if(cType === CitizenType.Builder) Icon = Hammer;
                 if(cType === CitizenType.Warrior) Icon = Sword;
                 if(cType === CitizenType.Explorer) Icon = Compass;

                 return (
                     <button 
                        key={cType}
                        onClick={() => onSelectCitizen(cType)}
                        title={info.description}
                        className={`p-2 rounded border flex flex-col items-center justify-center gap-1 transition-all ${isSelected ? 'border-[#fcd34d] bg-slate-800 ring-1 ring-[#fcd34d]/50 shadow-lg' : 'border-slate-700 bg-slate-900 hover:bg-slate-800'}`}
                     >
                         <div className="flex items-center gap-1.5">
                            <Icon size={15} color={info.color} />
                            <span className="font-bold text-white text-xs md:text-sm leading-none uppercase tracking-wide">{cType}</span>
                         </div>
                         <span className="text-[9px] md:text-[10px] text-slate-400 text-center leading-tight px-1 line-clamp-2">{info.description}</span>
                     </button>
                 )
             })}
          </div>
          <div className="flex justify-center">
              <button 
                onClick={onConfirm} 
                disabled={!player.selectedCitizen}
                className={`w-full md:w-auto px-12 py-2 rounded font-bold text-black transition-all text-sm ${player.selectedCitizen ? 'bg-[#ca8a04] hover:bg-[#eab308] shadow-lg hover:scale-105' : 'bg-slate-700 cursor-not-allowed opacity-50'}`}
              >
                {btnLabel}
              </button>
          </div>
      </div>
  );

  if (phase === Phase.Income) {
      return (
          <div className={`w-full ${isEliminated ? 'bg-red-950 border-red-500' : 'bg-[#0f172a] border-[#ca8a04]'} border-t p-2 flex items-center justify-between shadow-[0_-5px_15px_rgba(0,0,0,0.5)] shrink-0`}>
             <div>
               <h2 className={`${isEliminated ? 'text-red-400' : 'text-[#fcd34d]'} font-bold text-sm font-title`}>
                   {isEliminated ? "Eliminated - Phase I: Income" : "Phase I: Income"}
               </h2>
               <p className="text-slate-400 text-[10px]">Resources collected.</p>
             </div>
             <button onClick={onEndPhase} className={`${isEliminated ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-[#ca8a04] hover:bg-[#eab308] text-black'} font-bold px-4 py-1 rounded flex items-center gap-2 text-xs`}>
                 <span>Next</span> <Play size={14}/>
             </button>
          </div>
      );
  }

  if (phase === Phase.CitizenChoice) {
      if (isEliminated) {
           return (
              <div className="w-full bg-red-950 border-t border-red-500 p-3 flex items-center justify-between shadow-[0_-5px_15px_rgba(0,0,0,0.5)] shrink-0">
                 <div>
                   <h2 className="text-red-400 font-bold text-sm font-title">Eliminated</h2>
                   <p className="text-slate-400 text-[10px]">The Council gathers without you.</p>
                 </div>
                 <button onClick={onEndPhase} className="bg-red-600 text-white font-bold px-4 py-1 rounded hover:bg-red-500 flex items-center gap-2 text-xs">
                     <span>Proceed as Spectator</span> <Play size={14}/>
                 </button>
              </div>
           );
      }
      return renderCitizenSelection("Phase II: The Council", "Confirm Selection", onEndPhase);
  }

  if (phase === Phase.Action) {
      if (isEliminated) {
         return (
             <div className="w-full bg-red-950 border-t border-red-500 p-3 flex items-center justify-between shadow-[0_-5px_15px_rgba(0,0,0,0.5)] shrink-0">
                 <div className="flex flex-col">
                    <span className="text-red-400 font-bold text-sm uppercase tracking-widest block">Eliminated</span>
                    <span className="text-xs text-red-300/60">Spectator Mode Active</span>
                 </div>
                 <div className="text-xs text-red-300 animate-pulse">Observing Action Phase...</div>
             </div>
         );
      }
      
      if (player.hasPassed) {
         return (
             <div className="w-full bg-[#0f172a] border-t border-[#ca8a04] p-3 flex items-center justify-between shadow-[0_-5px_15px_rgba(0,0,0,0.5)] shrink-0">
                 <span className="text-slate-500 font-bold italic">You have passed for this Eclipse.</span>
                 <div className="text-xs text-slate-600 animate-pulse">Waiting for Eclipse to end...</div>
             </div>
         );
      }
      
      if (isReselecting) {
        return renderCitizenSelection("Change Council", "Confirm & Continue", () => setIsReselecting(false));
      }

      const role = player.selectedCitizen;
      const fatigue = player.actionsTaken > 0 ? 1 : 0; // FATIGUE: +1 Cost to ALL actions after the first
      
      // -- DYNAMIC COST CALCULATIONS --
      
      // Trade: Base 2 Grain -> 1 Gold. Fatigue: 3 Grain.
      const tradeCost = 2 + fatigue;
      const canTrade = player.status.freeTrades > 0 || player.activeRelicPower === 'TRADE_BARON' || player.resources.Grain >= tradeCost;
      
      // Fortify: Base 2 Stone. Fatigue: 3 Stone.
      const fortifyCost = 2 + fatigue;
      const isRelicFortifyFree = player.activeRelicPower === 'FREE_FORTIFY' && player.actionsTaken === 0;
      const canFortify = isRelicFortifyFree || player.status.freeFortify || (player.resources.Stone >= fortifyCost);
      
      // Expand: Base 1 Grain. Fatigue: 2 Grain.
      const expandCost = 1 + fatigue;
      const canExpand = player.resources.Grain >= expandCost;
      
      // Attack: Base 1 Grain. Fatigue: 2 Grain.
      const attackCost = 1 + fatigue;
      const canAttack = player.status.canAttack && player.resources.Grain >= attackCost;

      const roleColor = role === CitizenType.Warrior ? '#ef4444' : role === CitizenType.Builder ? '#22c55e' : role === CitizenType.Merchant ? '#eab308' : '#3b82f6';
      
      const getPowerLabel = () => {
          switch(player.activeRelicPower) {
              case 'PASSIVE_INCOME': return "Crown of Prosperity";
              case 'FREE_FORTIFY': return "Mason's Hammer";
              case 'WARLORD': return "Warlord's Banner";
              case 'TRADE_BARON': return "Merchant's Seal";
              case 'DOUBLE_TIME': return "Legion's Stride";
              default: return null;
          }
      };
      const powerLabel = getPowerLabel();

      return (
          <div className="w-full bg-[#0f172a] border-t border-[#ca8a04] flex flex-col shadow-[0_-5px_15px_rgba(0,0,0,0.5)] shrink-0">
              
              {/* TURN INDICATOR HEADER */}
              <div className={`w-full py-2 px-4 flex items-center justify-between text-sm font-bold uppercase tracking-widest border-b transition-colors duration-500 ${isMyTurn ? 'bg-gradient-to-r from-[#ca8a04] to-[#eab308] text-black border-[#fcd34d]' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>
                  <div className="flex items-center gap-2">
                      <Hourglass size={14} className={isMyTurn ? "animate-spin" : ""}/>
                      <span>Phase III: Action Phase</span>
                  </div>
                  <div className="flex items-center gap-2">
                       {isMyTurn ? (
                           isLastStand ? (
                               <span className="animate-pulse text-red-600 font-black flex items-center gap-1"><AlertTriangle size={14}/> LAST STAND: FINAL ACTION</span>
                           ) : (
                               <span className="animate-pulse">YOUR TURN TO ACT</span>
                           )
                       ) : (
                           <span>Turn: <span className="text-white">{activePlayerName || "Opponent"}</span></span>
                       )}
                  </div>
              </div>

              {/* RELIC POWER INDICATOR */}
              {powerLabel && (
                  <div className="w-full bg-[#1e293b] border-b border-slate-700 px-4 py-1 flex items-center justify-center gap-2 text-[10px] uppercase font-bold tracking-widest text-emerald-400 shadow-inner">
                      <Crown size={12} className="text-[#ca8a04]" />
                      <span>Active Power: {powerLabel}</span>
                  </div>
              )}

              <div className="p-3">
                  {/* Council Selection Header */}
                  <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold uppercase tracking-widest" style={{color: roleColor}}>Active Council: <span className="text-white">{role}</span></h3>
                      <div className="flex gap-2">
                         <button
                            onClick={() => onAction('OPEN_MARKET')}
                            disabled={!isMyTurn}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors ${isMyTurn ? 'border-orange-500 bg-orange-900/30 text-orange-200 hover:bg-orange-900/50' : 'border-slate-700 bg-slate-800 text-slate-500 opacity-50 grayscale'}`}
                            title="Open Market Exchange"
                         >
                            <RefreshCcw size={12}/>
                            <span>Market</span>
                         </button>
                         <button 
                              onClick={() => setIsReselecting(true)}
                              disabled={!isMyTurn || uiState.isSelectingTile || uiState.isDeclaring || uiState.isProcessing}
                              title={(uiState.isSelectingTile || uiState.isDeclaring) ? "Finish current action first" : "Change Council"}
                              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                              <RotateCcw size={12}/>
                              <span>Change</span>
                          </button>
                      </div>
                  </div>
                  {/* MAIN ACTIONS ROW */}
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide justify-center md:justify-start">
                      
                      {role === CitizenType.Merchant && (
                          <button 
                            onClick={() => onAction('TRADE_BANK')}
                            disabled={!isMyTurn || !canTrade}
                            className={`flex flex-col items-center justify-center p-3 rounded border w-24 shrink-0 transition-all ${isMyTurn && canTrade ? 'bg-amber-900/40 border-amber-500 hover:bg-amber-900/60' : 'bg-slate-800/50 border-slate-700 opacity-50 grayscale'}`}
                          >
                             <Scale size={20} className="text-amber-400 mb-1"/>
                             <span className="text-[10px] font-bold text-amber-100 uppercase">Trade</span>
                             <span className="text-[8px] text-amber-200/60">
                                 {player.status.freeTrades > 0 || player.activeRelicPower === 'TRADE_BARON' ? "Free (Relic)" : `${tradeCost} Grain -> 1 Gold`}
                             </span>
                          </button>
                      )}

                      {role === CitizenType.Builder && (
                          <button 
                            onClick={() => onAction('BUILD_FORTIFY')}
                            disabled={!isMyTurn || !canFortify}
                            className={`flex flex-col items-center justify-center p-3 rounded border w-24 shrink-0 transition-all ${isMyTurn && canFortify ? 'bg-green-900/40 border-green-500 hover:bg-green-900/60' : 'bg-slate-800/50 border-slate-700 opacity-50 grayscale'}`}
                          >
                             <Hammer size={20} className="text-green-400 mb-1"/>
                             <span className="text-[10px] font-bold text-green-100 uppercase">Fortify</span>
                             <span className="text-[8px] text-green-200/60">
                                 {isRelicFortifyFree || player.status.freeFortify ? "Free (Relic/1st)" : `${fortifyCost} Stone`}
                             </span>
                          </button>
                      )}

                      {role === CitizenType.Warrior && (
                          <button 
                            onClick={() => onAction('WARRIOR_ATTACK')}
                            disabled={!isMyTurn || !canAttack}
                            className={`flex flex-col items-center justify-center p-3 rounded border w-24 shrink-0 transition-all ${isMyTurn && canAttack ? 'bg-red-900/40 border-red-500 hover:bg-red-900/60' : 'bg-slate-800/50 border-slate-700 opacity-50 grayscale'}`}
                          >
                             <Sword size={20} className="text-red-400 mb-1"/>
                             <span className="text-[10px] font-bold text-red-100 uppercase">Attack</span>
                             <span className="text-[8px] text-red-200/60">
                                 Cost: {attackCost} Grain
                             </span>
                          </button>
                      )}

                      {role === CitizenType.Explorer && (
                          <>
                            <button 
                                onClick={() => onAction('EXPLORE_CLAIM')}
                                disabled={!isMyTurn || !canExpand}
                                className={`flex flex-col items-center justify-center p-3 rounded border w-24 shrink-0 transition-all ${isMyTurn && canExpand ? 'bg-blue-900/40 border-blue-500 hover:bg-blue-900/60' : 'bg-slate-800/50 border-slate-700 opacity-50 grayscale'}`}
                            >
                                <Compass size={20} className="text-blue-400 mb-1"/>
                                <span className="text-[10px] font-bold text-blue-100 uppercase">Expand</span>
                                <span className="text-[8px] text-blue-200/60">Cost: {expandCost} Grain</span>
                            </button>
                            <button 
                                onClick={() => onAction('EXPLORE_RUIN')}
                                disabled={!isMyTurn || !hasRuins}
                                className={`flex flex-col items-center justify-center p-3 rounded border w-24 shrink-0 transition-all ${isMyTurn && hasRuins ? 'bg-purple-900/40 border-purple-500 hover:bg-purple-900/60' : 'bg-slate-800/50 border-slate-700 opacity-50 grayscale'}`}
                            >
                                <Amphora size={20} className="text-purple-400 mb-1"/>
                                <span className="text-[10px] font-bold text-purple-100 uppercase">Scavenge</span>
                                <span className="text-[8px] text-purple-200/60">Ruins Only</span>
                            </button>
                          </>
                      )}
                      
                      {/* GENERAL ACTIONS */}
                      {hasHiddenRelic && (
                          <button 
                             onClick={() => onAction('ACTIVATE_RELIC')}
                             disabled={!isMyTurn}
                             className={`flex flex-col items-center justify-center p-3 rounded border w-24 shrink-0 transition-all ${isMyTurn ? 'bg-emerald-900/40 border-emerald-500 hover:bg-emerald-900/60' : 'bg-slate-800/50 border-slate-700 opacity-50 grayscale'}`}
                          >
                             <Eye size={20} className="text-emerald-400 mb-1"/>
                             <span className="text-[10px] font-bold text-emerald-100 uppercase">Unveil</span>
                             <span className="text-[8px] text-emerald-200/60">Relic Site</span>
                          </button>
                      )}
                      
                      {/* PASS BUTTON */}
                      <button 
                        onClick={() => onAction('PASS')}
                        disabled={!isMyTurn}
                        className={`flex flex-col items-center justify-center p-3 rounded border w-24 shrink-0 ml-auto transition-all ${isMyTurn ? 'bg-slate-700 border-slate-500 hover:bg-slate-600' : 'bg-slate-800 border-slate-700 opacity-50'}`}
                      >
                         <SkipForward size={20} className="text-white mb-1"/>
                         <span className="text-[10px] font-bold text-white uppercase">Pass</span>
                         <span className="text-[8px] text-slate-400">End Round</span>
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  if (phase === Phase.Events) {
     return (
          <div className="w-full bg-[#0f172a] border-t border-[#ca8a04] p-3 flex items-center justify-between shadow-[0_-5px_15px_rgba(0,0,0,0.5)] shrink-0">
             <div>
               <h2 className="text-[#fcd34d] font-bold text-sm font-title">Phase IV: Events</h2>
               <p className="text-slate-400 text-[10px]">Resolving Global Events...</p>
             </div>
             <div className="flex gap-2">
                 <Hourglass className="animate-spin text-[#ca8a04]" size={20} />
             </div>
          </div>
     );
  }
  
  if (phase === Phase.Scoring) {
     return (
          <div className={`w-full ${isEliminated ? 'bg-red-950 border-red-500' : 'bg-[#0f172a] border-[#ca8a04]'} border-t p-3 flex items-center justify-between shadow-[0_-5px_15px_rgba(0,0,0,0.5)] shrink-0`}>
             <div>
               <h2 className={`${isEliminated ? 'text-red-400' : 'text-[#fcd34d]'} font-bold text-sm font-title`}>Phase V: Scoring</h2>
               <p className="text-slate-400 text-[10px]">Tallying Victory Points...</p>
             </div>
             <button onClick={onEndPhase} className={`${isEliminated ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-[#ca8a04] hover:bg-[#eab308] text-black'} font-bold px-4 py-1 rounded flex items-center gap-2 text-xs`}>
                 <span>Next Eclipse</span> <RotateCcw size={14}/>
             </button>
          </div>
     );
  }

  return null;
};

export default ActionPanel;
