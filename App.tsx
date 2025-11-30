

import React, { useState, useEffect, useRef } from 'react';
import { GameState, Phase, Player, Resource, LogEntry, TileType, HexData, CitizenType, EventCard, SecretObjective, RelicPowerType, AiState, PendingChallenge, TraitType } from './types';
import { generateMap, getHexId, getNeighbors, isAdjacent } from './utils/hexUtils';
import { FACTIONS, TOTAL_ROUNDS, EVENTS_DECK, OBJECTIVES_DECK, TILE_CONFIG, VP_CONFIG, FACTION_TRAITS, AI_DIALOGUE, RESOURCE_COLORS } from './constants';
import HexGrid from './components/HexGrid';
import ActionPanel from './components/ActionPanel';
import HelpModal from './components/HelpModal';
import MarketModal from './components/MarketModal';
import ChallengeModal from './components/ChallengeModal';
import DeclarationModal from './components/DeclarationModal';
import TurnOrderTracker from './components/TurnOrderTracker';
import SplashScreen from './components/SplashScreen';
import SimulationOverlay from './components/SimulationOverlay';
import WelcomeModal from './components/WelcomeModal';
import SimulationRunner from './components/SimulationRunner';
import ResourceIcon from './components/ResourceIcon';
import { Eye, Trophy, Target, Zap, X, BookOpen, Info, Sword, Hammer, Beaker, FlaskConical, AlertTriangle, Handshake, Activity, Skull, Crown, Shield, MapPin, Search, Users, VenetianMask, Settings, Sparkles } from 'lucide-react';

// --- HELPER: Deck Management ---

const shuffle = <T,>(array: T[]): T[] => {
    let currentIndex = array.length, randomIndex;
    const newArr = [...array];
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [newArr[currentIndex], newArr[randomIndex]] = [newArr[randomIndex], newArr[currentIndex]];
    }
    return newArr;
};

const drawCard = (deck: EventCard[], discard: EventCard[]) => {
    let newDeck = [...deck];
    let newDiscard = [...discard];
    let reshuffled = false;
    
    if (newDeck.length === 0) {
        if (newDiscard.length === 0) {
            newDeck = shuffle([...EVENTS_DECK]);
            reshuffled = true;
        } else {
            newDeck = shuffle(newDiscard);
            newDiscard = [];
            reshuffled = true;
        }
    }
    
    const card = newDeck.pop();
    const finalCard = card || EVENTS_DECK[0]; 
    newDiscard.push(finalCard);
    
    return { card: finalCard, newDeck, newDiscard, reshuffled };
};

// --- HELPER: Initial Setup ---

const createInitialPlayers = (map: Record<string, HexData>, objectiveDeck: SecretObjective[], playerCount: number, isChallengeMode: boolean): Player[] => {
  const players: Player[] = [];
  
  const allIds = Object.keys(map);
  const edgeIds = allIds.filter(id => {
     const neighbors = getNeighbors(map[id].q, map[id].r).filter(n => map[getHexId(n.q, n.r)]);
     return neighbors.length < 6;
  }).sort(() => Math.random() - 0.5).slice(0, playerCount);

  FACTIONS.slice(0, playerCount).forEach((faction, idx) => {
      const startHexId = edgeIds[idx];
      let startResources = { [Resource.Grain]: 2, [Resource.Stone]: 1, [Resource.Gold]: 1, [Resource.Relic]: 0 };

      if (map[startHexId]) {
          const originalType = map[startHexId].type;
          
          if (originalType === TileType.Plains) startResources[Resource.Grain] += 2;
          else if (originalType === TileType.Mountains) startResources[Resource.Stone] += 2;
          else if (originalType === TileType.Goldmine) startResources[Resource.Gold] += 2;
          else if (originalType === TileType.RelicSite) { startResources[Resource.Gold]++; startResources[Resource.Stone]++; }
          else { startResources[Resource.Grain]++; startResources[Resource.Stone]++; }

          map[startHexId].type = TileType.Capital; 
          map[startHexId].publicType = TileType.Capital; 
          map[startHexId].ownerId = idx; 
          map[startHexId].isRevealed = true; 
          map[startHexId].fortification = { ownerId: idx, level: 1 }; 
      }

      const secretObj = objectiveDeck.pop() || OBJECTIVES_DECK[0];
      
      const aiState: AiState | undefined = idx === 0 ? undefined : {
          fear: isChallengeMode ? 20 : 0, 
          suspicion: isChallengeMode ? 20 : 0,
          diplomaticStance: 'Neutral',
          activeTraits: FACTION_TRAITS[faction.name] || (['Cautious'] as TraitType[]),
          lastDialogue: undefined
      };

      players.push({
          id: idx,
          name: idx === 0 ? "You" : faction.name,
          faction,
          isHuman: idx === 0,
          resources: startResources,
          activeRelicPower: null,
          selectedCitizen: null,
          vp: 0,
          secretObjectives: [secretObj],
          eventHand: [],
          hasActed: false,
          hasPassed: false,
          actionsTaken: 0,
          isEliminated: false,
          aiState,
          stats: {
              battlesWon: 0,
              tilesRevealed: 0, 
              relicEventsTriggered: 0,
              maxResourcesHeld: 4,
              tilesLost: 0,
              attacksMade: 0,
              uniquePlayersAttacked: [],
              relicSitesRevealed: 0
          },
          status: {
              canAttack: true,
              combatBonus: 0,
              fortificationBlocked: false,
              incomeMultiplier: 1,
              freeTrades: 0,
              passiveIncome: false,
              freeFortify: false,
              extraActions: 0,
              turnLost: false
          }
      });
  });
  return players;
};

// --- SCORING & INCOME LOGIC ---

const calculateScore = (player: Player, map: Record<string, HexData>, publicObjectives: SecretObjective[]): { total: number, breakdown: any, objSuccess: boolean } => {
    const ownedTiles = (Object.values(map) as HexData[]).filter(h => h.ownerId === player.id);
    let tileVp = 0;
    ownedTiles.forEach(t => {
        tileVp += VP_CONFIG[t.type] || 0;
    });

    let fortVp = 0;
    (Object.values(map) as HexData[]).forEach(h => {
        if (h.fortification && h.fortification.ownerId === player.id) {
            fortVp += VP_CONFIG.Fortification;
        }
    });

    const relicVp = player.resources[Resource.Relic] * VP_CONFIG.RelicToken;

    let objVp = 0;
    let objSuccess = false;
    player.secretObjectives.forEach(obj => {
        if (obj.condition(player, map)) {
            objVp += obj.vp;
            objSuccess = true;
        }
    });

    let publicObjVp = 0;
    publicObjectives.forEach(obj => {
        if (obj.condition(player, map)) {
            publicObjVp += obj.vp;
        }
    });

    const totalObjVp = objVp + publicObjVp;

    return {
        total: tileVp + fortVp + relicVp + totalObjVp,
        breakdown: { tileVp, fortVp, relicVp, totalObjVp },
        objSuccess
    };
};

const getIncomeRate = (player: Player, map: Record<string, HexData>, usePublicTypes = false) => {
    const rates = { [Resource.Grain]: 0, [Resource.Stone]: 0, [Resource.Gold]: 0, [Resource.Relic]: 0 };
    
    Object.values(map).forEach(hex => {
        if (hex.ownerId === player.id) {
            const typeToCheck = usePublicTypes ? hex.publicType : hex.type;
            const fortificationBonus = hex.fortification ? 1 : 0;

            if (typeToCheck === TileType.Capital) {
                rates[Resource.Grain] += (1 + fortificationBonus);
                rates[Resource.Stone] += (1 + fortificationBonus);
                rates[Resource.Gold] += (1 + fortificationBonus);
            } else {
                const config = TILE_CONFIG[typeToCheck];
                if (config && config.resource) {
                    rates[config.resource] += (1 + fortificationBonus);
                }
            }
        }
    });
    
    if (player.activeRelicPower === 'PASSIVE_INCOME' || player.status.passiveIncome) {
        rates[Resource.Grain]++;
        rates[Resource.Gold]++;
    }

    return rates;
};

const getCoordString = (map: Record<string, HexData>, hexId: string) => {
    const h = map[hexId];
    if (!h) return "Unknown";
    return `${h.diceCoords.col},${h.diceCoords.row}`;
};

const checkForElimination = (players: Player[], map: Record<string, HexData>, round: number): { updatedPlayers: Player[], eliminationLogs: LogEntry[] } => {
    const eliminationLogs: LogEntry[] = [];
    const updatedPlayers = players.map(p => {
        if (p.isEliminated) return p;
        
        const ownedTileCount = Object.values(map).filter(h => h.ownerId === p.id).length;
        if (ownedTileCount === 0) {
            eliminationLogs.push({
                id: `elim-${p.id}-${Date.now()}`,
                turn: round,
                text: `${p.name} has been eliminated from the game!`,
                type: 'combat',
                actorId: p.id
            });
            return { ...p, isEliminated: true, hasPassed: true };
        }
        return p;
    });
    return { updatedPlayers, eliminationLogs };
};


interface ResolvingEvent {
  card: EventCard;
  type: 'CHOICE' | 'INFO';
  amount?: number;
  isRelicPowered: boolean;
  onComplete?: () => void;
}

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [showSim, setShowSim] = useState(false);
  const [showStrategyLab, setShowStrategyLab] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false); 
  const [isChallengeMode, setIsChallengeMode] = useState(false); 
  const [isCasualMode, setIsCasualMode] = useState(false); 
  const [hoveredHexId, setHoveredHexId] = useState<string | null>(null);
  
  const [gameState, setGameState] = useState<GameState>({
    phase: Phase.Income,
    round: 1,
    turnOrderIndex: 0,
    turnOrder: [],
    turnTrigger: 0,
    passOrder: [],
    players: [],
    map: {},
    logs: [],
    uiState: { 
        isSelectingTile: false,
        isProcessing: false, 
        actionType: null, 
        selectedHexId: null, 
        isDeclaring: false, 
        pendingHexId: null, 
        activeSidebarTab: 'LOG', 
        isMarketOpen: false
    },
    activeEvent: null,
    pendingChallenge: null,
    eventDeck: [],
    discardPile: [],
    objectiveDeck: [],
    publicObjectives: []
  });

  const [resolvingEvent, setResolvingEvent] = useState<ResolvingEvent | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (gameState.uiState.activeSidebarTab === 'LOG') {
          logEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
  }, [gameState.logs.length]);

  const startGame = (selectedCount: number) => {
      const playerCount = selectedCount;
      const newMap = generateMap(playerCount);
      const initialEventDeck = shuffle([...EVENTS_DECK]);
      const initialObjectiveDeck = shuffle([...OBJECTIVES_DECK]);
      const initialPlayers = createInitialPlayers(newMap, initialObjectiveDeck, playerCount, isChallengeMode);
      const initialTurnOrder = Array.from({ length: playerCount }, (_, i) => i);
      
      setGameState({
          phase: Phase.Income,
          round: 1,
          turnOrderIndex: 0,
          turnOrder: initialTurnOrder,
          turnTrigger: 0,
          passOrder: [],
          players: initialPlayers,
          map: newMap,
          logs: [{ id: 'init', turn: 1, text: `Eclipse 1 Begins. Rules: ${isCasualMode ? 'Casual' : 'Standard'}. AI: ${isChallengeMode ? 'Hard' : 'Standard'}.`, type: 'phase' }],
          uiState: { 
            isSelectingTile: false,
            isProcessing: false, 
            actionType: null, 
            selectedHexId: null, 
            isDeclaring: false, 
            pendingHexId: null, 
            activeSidebarTab: 'LOG', 
            isMarketOpen: false
          },
          activeEvent: null,
          pendingChallenge: null,
          eventDeck: initialEventDeck,
          discardPile: [],
          objectiveDeck: initialObjectiveDeck,
          publicObjectives: []
      });
      setGameStarted(true);
  };

  const handleSplashStart = () => {
      setShowSplash(false);
  };

  const addLog = (text: string, type: LogEntry['type'] = 'info', details?: LogEntry['details'], actorId?: number, targetId?: number) => {
      setGameState(prev => ({
          ...prev,
          logs: [...prev.logs, { 
              id: Date.now().toString() + Math.random(), 
              turn: prev.round, 
              text, 
              type,
              actorId,
              targetId,
              details
          }]
      }));
  };

  const updatePlayerStat = (player: Player, statKey: keyof Player['stats'], value: any): Player => {
      const newStats = { ...player.stats };
      if (typeof value === 'number' && typeof newStats[statKey] === 'number') {
          (newStats[statKey] as number) += value;
      } else if (Array.isArray(newStats[statKey]) && typeof value === 'number') {
           if (!(newStats[statKey] as number[]).includes(value)) {
               (newStats[statKey] as number[]).push(value);
           }
      }
      return { ...player, stats: newStats };
  };

  const updateMaxResources = (player: Player): Player => {
      const total = Object.values(player.resources).reduce((a: number, b: number) => a + b, 0);
      if (total > player.stats.maxResourcesHeld) {
          return { ...player, stats: { ...player.stats, maxResourcesHeld: total } };
      }
      return player;
  };

  useEffect(() => {
      if (!gameStarted) return;
      
      if (gameState.phase === Phase.CitizenChoice) {
          const aiPlayers = gameState.players.filter(p => !p.isHuman && !p.isEliminated && p.selectedCitizen === null);
          if (aiPlayers.length > 0) {
              setGameState(prev => {
                  const newPlayers = prev.players.map(p => {
                      if (p.isHuman || p.isEliminated || p.selectedCitizen) return p;
                      let choice = CitizenType.Explorer;
                      if (prev.round === 1) {
                          choice = CitizenType.Explorer;
                      } else {
                          const hasGrain = p.resources[Resource.Grain] >= 2;
                          const hasStone = p.resources[Resource.Stone] >= 2;
                          if (p.resources[Resource.Grain] < 1 && p.resources[Resource.Gold] < 2) {
                              choice = CitizenType.Merchant;
                          } else if (hasStone && Math.random() > 0.4) {
                              choice = CitizenType.Builder;
                          } else if (hasGrain && Math.random() > 0.4) {
                              choice = CitizenType.Warrior;
                          } else {
                              choice = CitizenType.Explorer;
                          }
                      }
                      return { ...p, selectedCitizen: choice };
                  });
                  return { ...prev, players: newPlayers };
              });
          }
      }

      if (gameState.phase === Phase.Action) {
          const activeId = gameState.turnOrder[gameState.turnOrderIndex];
          const activePlayer = gameState.players[activeId];
          
          if (!activePlayer) return;

          // If pending challenge exists, do not advance AI.
          if (gameState.pendingChallenge && gameState.pendingChallenge.isActive) return;

          if (!activePlayer.isHuman && !activePlayer.hasPassed && !activePlayer.isEliminated) {
              const timer = setTimeout(() => {
                  executeAiAction(activeId);
              }, 1500); 
              return () => clearTimeout(timer);
          }
      }
  }, [gameState.phase, gameState.turnTrigger, gameStarted, gameState.pendingChallenge?.isActive]);

  const handleChallengeResponse = (doChallenge: boolean) => {
      setGameState(prev => {
          if (!prev.pendingChallenge) return prev;
          
          const challenge = prev.pendingChallenge;
          const map = { ...prev.map };
          const ps = prev.players.map(p => ({...p, status: {...p.status}, resources: {...p.resources}}));
          const logs = [...prev.logs];
          
          let logMsg = "";
          let logType: LogEntry['type'] = 'bluff';
          
          if (!doChallenge) {
               map[challenge.hexId].ownerId = challenge.declarerId;
               map[challenge.hexId].isRevealed = true; 
               map[challenge.hexId].publicType = challenge.declaredType;
               logMsg = `You trusted ${ps[challenge.declarerId].name}'s claim.`;
          } else {
               if (challenge.declaredType !== challenge.realType) {
                   // CAUGHT LYING
                   logMsg = `CHALLENGE SUCCESS! ${ps[challenge.declarerId].name} was lying! (Real: ${TILE_CONFIG[challenge.realType].label})`;
                   ps[0].vp += 1; 
                   map[challenge.hexId].ownerId = null;
                   map[challenge.hexId].isRevealed = true; 
                   map[challenge.hexId].publicType = challenge.realType;
               } else {
                   // FALSE ACCUSATION
                   logMsg = `CHALLENGE FAILED! ${ps[challenge.declarerId].name} told the truth!`;
                   
                   if (isCasualMode) {
                       // Casual: Pay Fine
                       if (ps[0].resources[Resource.Gold] >= 2) {
                           ps[0].resources[Resource.Gold] -= 2;
                           ps[challenge.declarerId].resources[Resource.Gold] += 2;
                           logMsg += " You pay 2 Gold in reparations.";
                       } else {
                           logMsg += " You lose Reputation (VP).";
                           ps[0].vp -= 1;
                       }
                   } else {
                       // Standard: Turn Lost
                       ps[0].status.turnLost = true;
                       logMsg += " Penalty: You lose your next turn!";
                   }

                   map[challenge.hexId].ownerId = challenge.declarerId;
                   map[challenge.hexId].isRevealed = true;
                   map[challenge.hexId].publicType = challenge.realType;
               }
          }
          logs.push({ id: `chall-res-${Date.now()}`, turn: prev.round, text: logMsg, type: logType });
          
          return {
              ...prev,
              pendingChallenge: null, // Clear modal immediately
              players: ps,
              map,
              logs,
              // Do not update turn index here, wait for advanceTurn
          };
      });
      
      // Force turn advance after resolution
      setTimeout(() => advanceTurn(), 100);
  };

  const applyEventToState = (currentState: GameState, card: EventCard, isRelicPowered: boolean, isGlobal: boolean = true): Partial<GameState> => {
      const players = currentState.players.map(p => ({ ...p, resources: { ...p.resources }, status: { ...p.status }, stats: {...p.stats} }));
      const map = { ...currentState.map };
      Object.keys(map).forEach(k => map[k] = { ...map[k] }); 

      let logs: LogEntry[] = [];
      const effect = isRelicPowered ? card.relicEffect : card.normalEffect;
      const text = isRelicPowered ? card.relicText : card.normalText;
      const activePid = currentState.turnOrder[currentState.turnOrderIndex] || 0;

      if (isRelicPowered && !isGlobal) {
          let power: RelicPowerType = 'PASSIVE_INCOME';
          let powerName = "Crown of Prosperity";

          if (card.id === 'e3' || card.id === 'e1') { power = 'PASSIVE_INCOME'; powerName = "Crown of Prosperity (Passive Income)"; } 
          else if (card.id === 'e4' || card.id === 'e99') { power = 'FREE_FORTIFY'; powerName = "Mason's Hammer (Free Fortify)"; } 
          else if (card.id === 'e5' || card.id === 'e98') { power = 'WARLORD'; powerName = "Warlord's Banner (+1 Combat)"; } 
          else if (card.id === 'e8' || card.id === 'e9') {
               if (card.id === 'e9') { power = 'DOUBLE_TIME'; powerName = "Legion's Stride (Double Action)"; } 
               else { power = 'TRADE_BARON'; powerName = "Merchant's Seal (Free Trades)"; }
          }
          players[activePid].activeRelicPower = power;
          logs.push({ id: `relic-power-${Date.now()}`, turn: currentState.round, text: `${players[activePid].name} claims the ${powerName}! (Replaces previous power)`, type: 'event', details: { card: powerName } });
          players[activePid] = updatePlayerStat(players[activePid], 'relicEventsTriggered', 1);
          return { players, map, logs };
      }

      const prefix = isGlobal ? "GLOBAL EVENT" : `RELIC EVENT (${players[activePid].name})`;
      logs.push({ id: `evt-${Date.now()}`, turn: currentState.round, text: `${prefix}: ${card.title} - ${text}`, type: 'event', details: { card: text } });

      if (isRelicPowered && !isGlobal) {
          players[activePid] = updatePlayerStat(players[activePid], 'relicEventsTriggered', 1);
      }

      const targets = effect.target === 'SELF' ? [players[activePid]] 
                    : effect.target === 'ENEMY' ? players.filter(p => p.id !== activePid)
                    : effect.target === 'ALL' ? players
                    : players;

      if (effect.type === 'RESOURCE_GAIN') {
        if (card.id === 'e1') {
            targets.forEach(p => {
                if (p.isHuman) {
                } else {
                    p.resources[Resource.Grain] += Math.floor(effect.value / 2);
                    p.resources[Resource.Gold] += Math.ceil(effect.value / 2);
                    Object.assign(p, updateMaxResources(p));
                }
            });
        } else {
            targets.forEach(p => {
                if (effect.target === Resource.Grain) {
                    p.resources[Resource.Grain] += effect.value;
                    if (card.id === 'e3') p.resources[Resource.Stone] += effect.value;
                } else {
                    p.resources[Resource.Grain] += Math.floor(effect.value / 2);
                    p.resources[Resource.Gold] += Math.ceil(effect.value / 2);
                }
                Object.assign(p, updateMaxResources(p));
            });
        }
      }
      else if (effect.type === 'RESOURCE_LOSS') {
           if (effect.target === 'ENEMY') {
               const victim = targets[Math.floor(Math.random() * targets.length)];
               if (victim) {
                   victim.resources[Resource.Gold] = Math.max(0, victim.resources[Resource.Gold] - effect.value);
                   logs.push({ id: `loss-${Date.now()}`, turn: currentState.round, text: `Sabotage: ${victim.name} lost ${effect.value} Gold!`, type: 'info' });
               }
           }
      }
      else if (effect.type === 'PASSIVE_INCOME') {
          players[activePid].status.passiveIncome = true;
          logs.push({ id: `buff-${Date.now()}`, turn: currentState.round, text: `${players[activePid].name} gains Passive Income.`, type: 'info' });
      }
      else if (effect.type === 'FREE_FORTIFY') {
          players[activePid].status.freeFortify = true;
          logs.push({ id: `buff-${Date.now()}`, turn: currentState.round, text: `${players[activePid].name} can Fortify for free this round.`, type: 'info' });
      }
      else if (effect.type === 'DOUBLE_ACTION') {
          if (players[activePid].resources[Resource.Gold] >= 2) {
              players[activePid].resources[Resource.Gold] -= 2;
              players[activePid].status.extraActions = 1;
              logs.push({ id: `buff-${Date.now()}`, turn: currentState.round, text: `${players[activePid].name} pays 2 Gold for Forced March (Double Action).`, type: 'info' });
          } else {
              logs.push({ id: `buff-${Date.now()}`, turn: currentState.round, text: `${players[activePid].name} could not afford Forced March.`, type: 'info' });
          }
      }
      else if (effect.type === 'FORTIFY_REMOVE') {
           const fortifiedHexIds = Object.keys(map).filter(k => map[k].fortification);
           if (fortifiedHexIds.length > 0) {
               const targetId = fortifiedHexIds[Math.floor(Math.random() * fortifiedHexIds.length)];
               map[targetId].fortification = null;
               logs.push({ id: `dest-${Date.now()}`, turn: currentState.round, text: `Earthquake destroys Fortification at [${getCoordString(map, targetId)}]`, type: 'combat' });
           }
      }
      else if (effect.type === 'BLOCK_ATTACK') {
           players.forEach(p => p.status.canAttack = false);
           if (isRelicPowered) {
               players[activePid].status.canAttack = true;
               logs.push({ id: `blk-${Date.now()}`, turn: currentState.round, text: `Quiet Eclipse: Only ${players[activePid].name} may attack this round!`, type: 'info' });
           } else {
               logs.push({ id: `blk-${Date.now()}`, turn: currentState.round, text: `Quiet Eclipse: All attacks blocked this round.`, type: 'info' });
           }
      }
      else if (effect.type === 'COMBAT_BONUS') {
           players[activePid].status.combatBonus += effect.value;
           logs.push({ id: `buff-${Date.now()}`, turn: currentState.round, text: `${players[activePid].name} gains +${effect.value} Combat Strength.`, type: 'info' });
      }
      else if (effect.type === 'TILE_REMOVE') {
           const revealed = Object.values(map).filter(h => h.isRevealed && h.ownerId !== null);
           if (revealed.length > 0) {
               const target = revealed[Math.floor(Math.random() * revealed.length)];
               const owner = players.find(p => p.id === target.ownerId);
               map[target.id].ownerId = null;
               map[target.id].fortification = null;
               if (target.ownerId !== null) {
                   players[target.ownerId].stats.tilesLost++;
               }
               logs.push({ id: `disaster-${Date.now()}`, turn: currentState.round, text: `Natural Disaster: ${owner?.name}'s tile at [${getCoordString(map, target.id)}] destroyed.`, type: 'combat' });
           }
      }
      else if (effect.type === 'TRADE_FREE') {
           players[activePid].status.freeTrades += effect.value;
           logs.push({ id: `trade-${Date.now()}`, turn: currentState.round, text: `${players[activePid].name} grants ${effect.value} Free Trade actions.`, type: 'info' });
      }

      return { players, map, logs };
  };

  const executeAiAction = (playerId: number) => {
      setGameState(prev => {
          let newPlayers: Player[] = prev.players.map(p => ({...p, resources: {...p.resources}, stats: {...p.stats}, aiState: p.aiState ? {...p.aiState} : undefined }));
          const newMap: Record<string, HexData> = { ...prev.map }; 
          Object.keys(newMap).forEach(k => newMap[k] = { ...newMap[k] }); 

          let ai = newPlayers[playerId];
          const human = newPlayers[0]; 
          
          if (ai.aiState && human) {
              const humanTiles = Object.values(newMap).filter(h => h.ownerId === 0).length;
              const aiTiles = Object.values(newMap).filter(h => h.ownerId === ai.id).length;
              const strengthRatio = (humanTiles + (human.resources.Grain/2)) / (aiTiles + (ai.resources.Grain/2) + 0.1);
              let newFear = ai.aiState.fear;
              if (strengthRatio > 1.2) newFear = Math.min(100, newFear + 5); 
              if (strengthRatio < 0.8) newFear = Math.max(0, newFear - 2); 
              let newSuspicion = ai.aiState.suspicion;
              const hasBeenAttacked = ai.stats.uniquePlayersAttacked.includes(0) === false && human.stats.uniquePlayersAttacked.includes(ai.id);
              if (hasBeenAttacked) newSuspicion = 100;
              else if (strengthRatio > 1.5) newSuspicion = Math.min(100, newSuspicion + 2); 
              
              if (ai.aiState.activeTraits.includes('Paranoid')) newSuspicion = Math.min(100, newSuspicion + 10);
              if (ai.aiState.activeTraits.includes('Cautious')) newFear = Math.min(100, newFear + 5);

              if (isChallengeMode) {
                  // Removed exponential multiplier fix from previous turn
                  newFear = Math.min(100, newFear + 2);
                  newSuspicion = Math.min(100, newSuspicion + 2);
                  
                  if (human.vp > ai.vp + 5 && ai.aiState.diplomaticStance !== 'War') {
                      ai.aiState.diplomaticStance = 'War';
                      ai.aiState.lastDialogue = AI_DIALOGUE.coalition[Math.floor(Math.random() * AI_DIALOGUE.coalition.length)];
                  }
              }

              let newStance = ai.aiState.diplomaticStance;
              if (newStance !== 'War') {
                 if (newFear > 80 && newSuspicion > 80) newStance = 'War'; 
                 else if (hasBeenAttacked) newStance = 'War';
                 else if (newSuspicion > 50) newStance = 'Hostile';
              }
              
              let dialogue = "";
              if (!ai.aiState.lastDialogue) { 
                  if (newStance === 'War' && ai.aiState.diplomaticStance !== 'War') {
                      dialogue = AI_DIALOGUE.fear_attack[Math.floor(Math.random()*AI_DIALOGUE.fear_attack.length)];
                  } else if (newStance === 'War') {
                      dialogue = AI_DIALOGUE.attack[Math.floor(Math.random()*AI_DIALOGUE.attack.length)];
                  } else if (ai.selectedCitizen === CitizenType.Builder && newFear > 50) {
                      dialogue = AI_DIALOGUE.fortify[Math.floor(Math.random()*AI_DIALOGUE.fortify.length)];
                  } else if (ai.selectedCitizen === CitizenType.Explorer) {
                      dialogue = AI_DIALOGUE.expand[Math.floor(Math.random()*AI_DIALOGUE.expand.length)];
                  }
                  if (dialogue) ai.aiState.lastDialogue = dialogue;
              }

              ai.aiState = { ...ai.aiState, fear: newFear, suspicion: newSuspicion, diplomaticStance: newStance };
          }

          const role = ai.selectedCitizen;
          let logText = "";
          let logType: LogEntry['type'] = 'info';
          let logDetails: LogEntry['details'] = undefined;
          let targetId: number | undefined = undefined;
          let actionTaken = false;

          let currentEventDeck = [...prev.eventDeck];
          let currentDiscardPile = [...prev.discardPile];

          const myTiles = (Object.values(newMap) as HexData[]).filter((h) => h.ownerId === ai.id);
          const allNeighbors = myTiles.flatMap(h => getNeighbors(h.q, h.r).map(n => getHexId(n.q, n.r)))
                                      .filter(id => newMap[id]);
          
          const getBluff = (realType: TileType) => {
             if ((realType === TileType.Plains || realType === TileType.Mountains) && Math.random() < 0.4) {
                 return Math.random() > 0.5 ? TileType.Goldmine : TileType.RelicSite;
             }
             return realType;
          };

          const fatigue = ai.actionsTaken > 0 ? 1 : 0;
          let requiredGrain = 0;
          if (role === CitizenType.Warrior) requiredGrain = ai.actionsTaken === 0 ? 1 : 2; // Existing Warrior logic
          if (role === CitizenType.Explorer) requiredGrain = 1 + fatigue; // Updated Explorer Fatigue

          if (!actionTaken && ai.resources[Resource.Grain] < requiredGrain) {
              if (ai.resources[Resource.Gold] >= 3) {
                  ai.resources[Resource.Gold] -= 3;
                  ai.resources[Resource.Grain] += 1;
                  logText = `${ai.name} buys emergency rations (3 Gold -> 1 Grain).`;
                  actionTaken = true;
              } else if (ai.resources[Resource.Stone] >= 3) {
                  ai.resources[Resource.Stone] -= 3;
                  ai.resources[Resource.Grain] += 1;
                  logText = `${ai.name} buys emergency rations (3 Stone -> 1 Grain).`;
                  actionTaken = true;
              }
          }

          const hiddenRelics = myTiles.filter(t => t.type === TileType.RelicSite && t.publicType !== TileType.RelicSite);
          if (!actionTaken && hiddenRelics.length > 0 && Math.random() > 0.7) {
              const relicTile = hiddenRelics[0];
              relicTile.publicType = TileType.RelicSite;
              ai.stats.relicEventsTriggered++;
              
              const drawResult = drawCard(currentEventDeck, currentDiscardPile);
              const evt = drawResult.card;
              currentEventDeck = drawResult.newDeck;
              currentDiscardPile = drawResult.newDiscard;
              
              logText = `${ai.name} unveils a Hidden Relic at [${getCoordString(newMap, relicTile.id)}]!`;
              logType = 'event';

              let powerName = "";
              if (evt.id === 'e3' || evt.id === 'e1') { ai.activeRelicPower = 'PASSIVE_INCOME'; powerName = "Crown of Prosperity"; } 
              else if (evt.id === 'e4' || evt.id === 'e99') { ai.activeRelicPower = 'FREE_FORTIFY'; powerName = "Mason's Hammer"; } 
              else if (evt.id === 'e5' || evt.id === 'e98') { ai.activeRelicPower = 'WARLORD'; powerName = "Warlord's Banner"; } 
              else if (evt.id === 'e8' || evt.id === 'e9') { ai.activeRelicPower = 'TRADE_BARON'; powerName = "Merchant's Seal"; }
              
              logText += ` - Equipped ${powerName}!`;
              actionTaken = true;
          }

          else if (!actionTaken && (role === CitizenType.Merchant || ai.resources[Resource.Grain] > 4)) {
              const freeTradeAvailable = ai.status.freeTrades > 0; 
              const tradeCost = 2 + fatigue;
              
              if (freeTradeAvailable) {
                   ai.status.freeTrades--;
                   ai.resources[Resource.Gold] += 1;
                   logText = `${ai.name} uses Merchant's Seal for free Gold.`;
                   actionTaken = true;
              } else if (ai.resources[Resource.Grain] >= tradeCost) {
                  ai.resources[Resource.Grain] -= tradeCost;
                  ai.resources[Resource.Gold] += 1;
                  logText = `${ai.name} trades ${tradeCost} Grain for 1 Gold.`;
                  actionTaken = true;
              }
          } 

          else if (!actionTaken && role === CitizenType.Builder) {
              const myUnfortified = myTiles.filter(t => !t.fortification);
              const isFree = (ai.activeRelicPower === 'FREE_FORTIFY' && ai.actionsTaken === 0) || ai.status.freeFortify;
              const costStone = isFree ? 0 : (2 + fatigue); 

              if (myUnfortified.length > 0 && ai.resources[Resource.Stone] >= costStone) {
                   const target = myUnfortified[Math.floor(Math.random() * myUnfortified.length)];
                   ai.resources[Resource.Stone] -= costStone;
                   newMap[target.id].fortification = { ownerId: ai.id, level: 1 };
                   logText = `${ai.name} fortifies [${getCoordString(newMap, target.id)}]${isFree ? " (Free - Relic)" : ""}.`;
                   actionTaken = true;
              }
          }

          else if (!actionTaken && role === CitizenType.Warrior && ai.status.canAttack) {
              const attackCost = ai.actionsTaken === 0 ? 1 : 2;
              if (ai.resources[Resource.Grain] >= attackCost) {
                  const enemyIds = allNeighbors.filter(id => {
                      const hex = newMap[id];
                      return hex.ownerId !== null && hex.ownerId !== ai.id;
                  });

                  let targetIdHex = "";
                  if (enemyIds.length > 0) {
                      const humanTargets = enemyIds.filter(id => newMap[id].ownerId === 0);
                      const isAtWarWithHuman = ai.aiState?.diplomaticStance === 'War';
                      const isVengeful = ai.aiState?.activeTraits.includes('Vengeful');

                      if (humanTargets.length > 0 && (isAtWarWithHuman || (isVengeful && Math.random() > 0.3))) {
                          targetIdHex = humanTargets[Math.floor(Math.random() * humanTargets.length)];
                      } else {
                          targetIdHex = enemyIds[Math.floor(Math.random() * enemyIds.length)];
                      }

                      ai.resources[Resource.Grain] -= attackCost;
                      const targetHex = newMap[targetIdHex];
                      const defender = newPlayers[targetHex.ownerId!];
                      targetId = defender.id;
                      
                      ai.stats.attacksMade++;
                      if (!ai.stats.uniquePlayersAttacked.includes(defender.id)) ai.stats.uniquePlayersAttacked.push(defender.id);

                      const attSupport = getNeighbors(targetHex.q, targetHex.r).filter(n => newMap[getHexId(n.q, n.r)]?.ownerId === ai.id).length;
                      const warlordBonus = ai.activeRelicPower === 'WARLORD' ? 1 : 0;
                      const attStr = 1 + 1 + attSupport + ai.status.combatBonus + warlordBonus;

                      const defSupport = getNeighbors(targetHex.q, targetHex.r).filter(n => newMap[getHexId(n.q, n.r)]?.ownerId === defender.id).length;
                      const defStr = 1 + (targetHex.fortification ? 1 : 0) + defSupport;

                      const rollAtt = Math.floor(Math.random() * 6) + 1;
                      const rollDef = Math.floor(Math.random() * 6) + 1;
                      const totalAtt = attStr + rollAtt;
                      const totalDef = defStr + rollDef;

                      if (totalAtt > totalDef) {
                          newMap[targetIdHex].ownerId = ai.id;
                          newMap[targetIdHex].fortification = null;
                          defender.stats.tilesLost++;
                          ai.stats.battlesWon++;
                          logText = `${ai.name} ATTACKS ${defender.name} at [${getCoordString(newMap, targetIdHex)}]!`;
                          logDetails = { dice: { att: attStr, def: defStr, attRoll: rollAtt, defRoll: rollDef } };
                          logType = 'combat';

                          const stealable = [Resource.Grain, Resource.Stone, Resource.Gold].filter(r => defender.resources[r] > 0);
                          if (stealable.length > 0) {
                              const stolenRes = stealable[Math.floor(Math.random() * stealable.length)];
                              defender.resources[stolenRes] = Math.max(0, defender.resources[stolenRes] - 1);
                              ai.resources[stolenRes]++;
                              logText += ` Looted 1 ${stolenRes}!`;
                          }

                      } else {
                          logText = `${ai.name} FAILS attack on ${defender.name} at [${getCoordString(newMap, targetIdHex)}].`;
                          logDetails = { dice: { att: attStr, def: defStr, attRoll: rollAtt, defRoll: rollDef } };
                          logType = 'combat';
                          defender.stats.battlesWon++; 
                      }
                      actionTaken = true;
                  }
              }
          }

          else if (!actionTaken && role === CitizenType.Explorer) {
               const costGrain = 1 + fatigue; // FATIGUE applied to expansion
               
               if (ai.resources[Resource.Grain] >= costGrain) {
                   const ruins = myTiles.filter(h => h.type === TileType.Ruins);
                   if (ruins.length > 0 && Math.random() > 0.4) {
                       const targetRuin = ruins[0];
                       newMap[targetRuin.id].type = TileType.Plains;
                       newMap[targetRuin.id].publicType = TileType.Plains;

                       const drawResult = drawCard(currentEventDeck, currentDiscardPile);
                       const evt = drawResult.card;
                       currentEventDeck = drawResult.newDeck;
                       currentDiscardPile = drawResult.newDiscard;

                       logText = `${ai.name} scavenges Ruins at [${getCoordString(newMap, targetRuin.id)}] (Collapsed) - ${evt.title}`;
                       logDetails = { card: evt.title };
                       actionTaken = true;
                       logType = 'event';
                       ai.resources[Resource.Grain]++; 
                       if (costGrain > 0) ai.resources[Resource.Grain] -= costGrain; 
                   } else {
                       const neutral = allNeighbors.filter(id => newMap[id].ownerId === null);
                       const target = neutral.length > 0 ? neutral[Math.floor(Math.random() * neutral.length)] : null;
                       if (target) {
                           const trueType = newMap[target].type;
                           const declaredType = getBluff(trueType);
                           
                           if (costGrain > 0) ai.resources[Resource.Grain] -= costGrain;
                           ai.actionsTaken++; 

                           // Human Intervention Logic
                           if (!human.isEliminated && !human.hasPassed && !human.status.turnLost) {
                               return {
                                   ...prev,
                                   players: newPlayers,
                                   logs: [...prev.logs, { id: Date.now().toString(), turn: prev.round, text: `${ai.name} is attempting to claim [${getCoordString(newMap, target)}]...`, type: 'info' }],
                                   pendingChallenge: {
                                       declarerId: ai.id,
                                       hexId: target,
                                       declaredType,
                                       realType: trueType,
                                       timer: 5, 
                                       isActive: true
                                   }
                               };
                           } else {
                               // Auto success if human can't challenge
                               newMap[target].ownerId = ai.id;
                               newMap[target].publicType = declaredType;
                               newMap[target].isRevealed = true;
                               ai.stats.tilesRevealed++;
                               logText = `"${getAiDialogue(ai, 'expand')}" - ${ai.name} claims [${getCoordString(newMap, target)}] as ${TILE_CONFIG[declaredType].label}.`;
                               logDetails = { declaredType };
                               logType = 'bluff';
                               
                               if (trueType === TileType.RelicSite) {
                                   ai.resources[Resource.Relic]++;
                                   ai.stats.relicSitesRevealed++;
                               }
                               actionTaken = true;
                           }
                       }
                   }
               }
          }

          if (!actionTaken) {
              logText = `${ai.name} passes.`;
              ai.hasPassed = true;
          } else {
              ai.actionsTaken++;
          }

          ai = updateMaxResources(ai); 
          newPlayers[playerId] = ai;

          if (ai.aiState?.lastDialogue) {
              logText = `"${ai.aiState.lastDialogue}" - ${logText}`;
              ai.aiState.lastDialogue = undefined; 
          }

          const newLogEntry: LogEntry = {
              id: Date.now().toString(), 
              turn: prev.round, 
              text: logText, 
              type: logType,
              actorId: ai.id,
              targetId,
              details: logDetails
          };

          let newPassOrder = [...prev.passOrder];
          if (!actionTaken) {
              if (!newPassOrder.includes(playerId)) newPassOrder.push(playerId);
          }

          const newLogs = [...prev.logs, newLogEntry];
          const finalPlayersState = newPlayers;

          const activePlayers = finalPlayersState.filter(p => !p.isEliminated);
          const allPassed = activePlayers.every(p => p.hasPassed);
          let nextTurnOrderIndex = prev.turnOrderIndex;

          if (!allPassed) {
              let nextIndex = (prev.turnOrderIndex + 1) % prev.turnOrder.length;
              let attempts = 0;
              while ((finalPlayersState[prev.turnOrder[nextIndex]].hasPassed || finalPlayersState[prev.turnOrder[nextIndex]].isEliminated) && attempts < prev.turnOrder.length) {
                  nextIndex = (nextIndex + 1) % prev.turnOrder.length;
                  attempts++;
              }
              nextTurnOrderIndex = nextIndex;
          }
          
          return { 
            ...prev, 
            players: finalPlayersState, 
            map: newMap, 
            logs: newLogs, 
            eventDeck: currentEventDeck, 
            discardPile: currentDiscardPile,
            turnOrderIndex: nextTurnOrderIndex,
            turnTrigger: prev.turnTrigger + 1,
            passOrder: newPassOrder 
          };
      });
  };

  const getAiDialogue = (ai: Player, type: keyof typeof AI_DIALOGUE) => {
       const lines = AI_DIALOGUE[type];
       return lines[Math.floor(Math.random() * lines.length)];
  };

  const advanceTurn = () => {
    setGameState(prev => {
        const activePlayerId = prev.turnOrder[prev.turnOrderIndex];
        const currentPlayer = prev.players[activePlayerId];

        if (currentPlayer && currentPlayer.status.extraActions > 0 && !currentPlayer.hasPassed && !currentPlayer.isEliminated) {
            const ps = prev.players.map(p => p.id === currentPlayer.id ? { 
                ...p, 
                status: { ...p.status, extraActions: p.status.extraActions - 1 } 
            } : p);
            return { ...prev, players: ps, turnTrigger: prev.turnTrigger + 1, uiState: { ...prev.uiState, isProcessing: false } };
        }

        const activePlayers = prev.players.filter(p => !p.isEliminated);
        const allPassed = activePlayers.every(p => p.hasPassed); 
        
        if (allPassed) {
             return { 
                 ...prev, 
                 logs: [...prev.logs, { id: 'end-phase', turn: prev.round, text: "All players passed. Events Phase beginning.", type: 'phase' }],
                 turnTrigger: prev.turnTrigger + 1,
                 uiState: { ...prev.uiState, isProcessing: false }
             };
        }

        let nextIndex = (prev.turnOrderIndex + 1) % prev.turnOrder.length;
        let loop = 0;
        
        while(loop < prev.players.length) {
             const playerToPlay = prev.players[prev.turnOrder[nextIndex]];
             
             if (playerToPlay.isEliminated || playerToPlay.hasPassed) {
                 nextIndex = (nextIndex + 1) % prev.turnOrder.length;
                 loop++;
             } else if (playerToPlay.status.turnLost) {
                 const ps = prev.players.map(p => p.id === playerToPlay.id ? { ...p, status: { ...p.status, turnLost: false }, hasPassed: true } : p);
                 const logs = [...prev.logs, { id: Date.now().toString(), turn: prev.round, text: `${playerToPlay.name} serves Penalty: Turn Lost.`, type: 'alert' as const }];
                 return { ...prev, players: ps, logs, turnOrderIndex: (nextIndex + 1) % prev.turnOrder.length, turnTrigger: prev.turnTrigger + 1, uiState: { ...prev.uiState, isProcessing: false } };
             } else {
                 break;
             }
        }

        // --- SUNSET RULE: LAST STAND ---
        // If the next player found is the SAME as the current player (meaning everyone else passed)
        // AND there are multiple active players in the game...
        // ... then this player has just finished their "Last Stand" turn (or is about to take it if logic differs).
        // Since advanceTurn is called AFTER an action, if we loop back to the same player, it means they just acted while everyone else was passed.
        // We force them to pass now to prevent infinite turns.
        const nextPlayerId = prev.turnOrder[nextIndex];
        const currentId = prev.turnOrder[prev.turnOrderIndex];
        
        if (activePlayers.length > 1 && nextPlayerId === currentId && !prev.players[currentId].hasPassed) {
             const ps = prev.players.map(p => p.id === currentId ? { ...p, hasPassed: true } : p);
             const logs = [...prev.logs, { id: `sunset-${Date.now()}`, turn: prev.round, text: "Sunset Rule: All rivals passed. Round ends.", type: 'phase' as const }];
             return { 
                 ...prev, 
                 players: ps, 
                 logs, 
                 turnTrigger: prev.turnTrigger + 1, 
                 uiState: { ...prev.uiState, isProcessing: false } 
             };
        }

        return { ...prev, turnOrderIndex: nextIndex, turnTrigger: prev.turnTrigger + 1, uiState: { ...prev.uiState, isProcessing: false } };
    });
  };

  useEffect(() => {
      if (gameState.phase === Phase.Action) {
           const activePlayers = gameState.players.filter(p => !p.isEliminated);
           if (activePlayers.length > 0 && activePlayers.every(p => p.hasPassed)) {
               setTimeout(() => handlePhaseTransition(), 500);
           }
      }
  }, [gameState.turnTrigger, gameState.phase]);


  const advanceFromEventsPhase = () => {
    handlePhaseTransition();
  };

  const handlePhaseTransition = () => {
      setGameState(prev => {
          if (prev.phase === Phase.CitizenChoice && !prev.players[0].selectedCitizen) {
               return prev; 
          }
          
          const nextPhaseMap: Record<Phase, Phase> = {
              [Phase.Income]: Phase.CitizenChoice,
              [Phase.CitizenChoice]: Phase.Action,
              [Phase.Action]: Phase.Events,
              [Phase.Events]: Phase.Scoring,
              [Phase.Scoring]: prev.round === TOTAL_ROUNDS ? Phase.EndGame : Phase.Income,
              [Phase.EndGame]: Phase.EndGame
          };
          
          const nextP = nextPhaseMap[prev.phase];
          if (prev.phase === Phase.Action && nextP !== Phase.Events) return prev; 
          
          if (prev.phase === Phase.Events) {
              const { updatedPlayers: playersAfterElimination, eliminationLogs } = checkForElimination(prev.players, prev.map, prev.round);
              return { ...prev, phase: Phase.Scoring, players: playersAfterElimination, logs: [...prev.logs, ...eliminationLogs] };
          }

          let nextRound = prev.round;
          let newActiveEvent = null;
          let partialUpdate: any = { players: prev.players, map: prev.map, passOrder: prev.passOrder };
          let nextTurnOrderIndex = 0;
          let nextTurnOrder = prev.turnOrder;
          let currentEventDeck = prev.eventDeck;
          let currentDiscardPile = prev.discardPile;
          let currentObjectiveDeck = prev.objectiveDeck;
          let newPublicObjectives = [...prev.publicObjectives];
          let logs = [...prev.logs];
          
          if (nextP === Phase.Income) {
              nextRound++;
              const validIndex = nextTurnOrder.findIndex(pid => !prev.players[pid].isEliminated);
              nextTurnOrderIndex = validIndex !== -1 ? validIndex : 0;
          }
          
          if (nextP === Phase.Action) {
            const { updatedPlayers: playersAfterElimination, eliminationLogs } = checkForElimination(prev.players, prev.map, prev.round);
            logs.push(...eliminationLogs);
            partialUpdate.players = playersAfterElimination;

            const activePlayers = playersAfterElimination.filter(p => !p.isEliminated);
            
            if (activePlayers.length > 0) {
                if (nextRound > 1 && prev.passOrder.length > 0) {
                    const validPassOrder = prev.passOrder.filter(id => !playersAfterElimination[id].isEliminated);
                    const missing = activePlayers.map(p => p.id).filter(id => !validPassOrder.includes(id)).sort((a,b) => a - b);
                    nextTurnOrder = [...validPassOrder, ...missing];
                    
                    logs.push({ 
                        id: `order-${nextRound}`, 
                        turn: nextRound, 
                        text: `Turn Order determined by passing: ${nextTurnOrder.map(id => playersAfterElimination[id].name).join(" → ")}`, 
                        type: 'info' 
                    });
                } else {
                    const activePlayerIds = activePlayers.map(p => p.id).sort((a, b) => a - b);
                    const shift = (nextRound - 1) % activePlayers.length;
                    nextTurnOrder = [...activePlayerIds.slice(shift), ...activePlayerIds.slice(0, shift)];
                    
                    const firstPlayerName = playersAfterElimination.find(p => p.id === nextTurnOrder[0])?.name || "Unknown";
                    logs.push({ 
                        id: `init-${nextRound}`, 
                        turn: nextRound, 
                        text: `Turn Order updated. ${firstPlayerName} goes first.`, 
                        type: 'info' 
                    });
                }
                nextTurnOrderIndex = 0;
            } else {
                nextTurnOrder = [];
                nextTurnOrderIndex = 0;
            }
            partialUpdate.passOrder = [];
          }

          if (nextP === Phase.Events) {
            const { updatedPlayers: playersAfterElimination, eliminationLogs } = checkForElimination(prev.players, prev.map, prev.round);
            logs.push(...eliminationLogs);
            partialUpdate.players = playersAfterElimination;

            const drawResult = drawCard(currentEventDeck, currentDiscardPile);
            const card = drawResult.card;
            currentEventDeck = drawResult.newDeck;
            currentDiscardPile = drawResult.newDiscard;
            
            if (drawResult.reshuffled) {
                logs.push({ id: `shuffle-${Date.now()}`, turn: nextRound, text: "Event Deck empty. Discard pile reshuffled.", type: 'info' });
            }
            
            const result = applyEventToState({ ...prev, players: playersAfterElimination, logs }, card, false, true);
            
            partialUpdate.players = result.players || playersAfterElimination;
            partialUpdate.map = result.map || prev.map;
            logs.push(...(result.logs || []));
            newActiveEvent = { card, isRelicPowered: false };

            const humanNeedsChoice = card.id === 'e1' && !playersAfterElimination[0].isEliminated;

            if (humanNeedsChoice) {
                setResolvingEvent({
                    card,
                    type: 'CHOICE',
                    amount: card.normalEffect.value,
                    isRelicPowered: false,
                    onComplete: () => setTimeout(advanceFromEventsPhase, 1000)
                });
            } else {
                setTimeout(advanceFromEventsPhase, 3500);
            }
          }

          let newPlayers = partialUpdate.players.map((p: Player) => {
              const currentScore = calculateScore(p, partialUpdate.map, newPublicObjectives);
              return {
                  ...p,
                  vp: currentScore.total,
                  hasActed: false,
                  hasPassed: p.isEliminated ? true : false,
                  actionsTaken: 0,
                  selectedCitizen: nextP === Phase.CitizenChoice ? null : p.selectedCitizen,
                  status: {
                      ...p.status,
                      canAttack: true,
                      combatBonus: 0,
                      fortificationBlocked: false,
                      freeTrades: 0,
                      freeFortify: false,
                      extraActions: 0,
                      turnLost: false 
                  }
              }
          });
          
          if (nextP === Phase.Income || (prev.phase === Phase.Scoring && nextP !== Phase.EndGame)) {
               logs.push({ id: `round-${nextRound}`, turn: nextRound, text: `Eclipse ${nextRound}`, type: 'phase' });

               if (nextRound >= 2 && nextRound <= 4) {
                   const obj = currentObjectiveDeck.pop();
                   if (obj) {
                       newPublicObjectives.push(obj);
                       logs.push({ id: `pub-obj-${nextRound}`, turn: nextRound, text: `Public Imperative Revealed: ${obj.name}`, type: 'phase' });
                   }
               }

               newPlayers = newPlayers.map((p: Player) => {
                   if (p.isEliminated) return p;

                   if (p.activeRelicPower === 'TRADE_BARON') {
                       p.status.freeTrades = 1;
                   }

                   const rates = getIncomeRate(p, partialUpdate.map, false);
                   p.resources[Resource.Grain] += rates[Resource.Grain];
                   p.resources[Resource.Stone] += rates[Resource.Stone];
                   p.resources[Resource.Gold] += rates[Resource.Gold];
                   p.resources[Resource.Relic] += rates[Resource.Relic];

                   if (!p.isHuman) {
                       const wild = [Resource.Grain, Resource.Stone, Resource.Gold][Math.floor(Math.random()*3)];
                       p.resources[wild]++;
                   }

                   return updateMaxResources(p);
               });
          }

          if (nextP === Phase.Action) {
              logs.push({ id: 'reveal', turn: prev.round, text: "Council Session - Citizens Revealed", type: 'phase' });
              newPlayers.forEach((p: Player) => {
                 if(!p.isHuman && !p.isEliminated) logs.push({id:`rev-${p.id}`, turn:prev.round, text:`${p.name} is a ${p.selectedCitizen}`, type:'info', actorId: p.id});
              });
          }

          return { 
              ...prev, 
              phase: nextP, 
              round: nextRound, 
              logs, 
              players: newPlayers, 
              map: partialUpdate.map,
              turnOrder: nextTurnOrder,
              turnOrderIndex: nextTurnOrderIndex,
              turnTrigger: prev.turnTrigger + 1,
              activeEvent: newActiveEvent,
              eventDeck: currentEventDeck,
              discardPile: currentDiscardPile, 
              objectiveDeck: currentObjectiveDeck,
              publicObjectives: newPublicObjectives,
              uiState: { ...prev.uiState, isProcessing: false },
              passOrder: partialUpdate.passOrder !== undefined ? partialUpdate.passOrder : prev.passOrder
          };
      });
  };

  const handleEventResourceChoice = (res: Resource) => {
      if (!resolvingEvent || !resolvingEvent.amount) return;
      
      setGameState(prev => {
          const ps: Player[] = prev.players.map(p => ({...p, resources: {...p.resources}}));
          ps[0].resources[res]++;
          const updatedP0 = updateMaxResources(ps[0]);
          ps[0] = updatedP0;

          const remaining = (resolvingEvent.amount || 1) - 1;
          const newLog: LogEntry = { id: `choice-${Date.now()}`, turn: prev.round, text: `You chose 1 ${res} from Event.`, type: 'info' };
          const logs = [...prev.logs, newLog];

          if (remaining > 0) {
              setResolvingEvent({ ...resolvingEvent, amount: remaining });
          } else {
              setResolvingEvent(null);
              if (resolvingEvent.onComplete) resolvingEvent.onComplete();
          }
          
          return { ...prev, players: ps, logs };
      });
  };

  const handleCloseMarket = () => {
      setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isMarketOpen: false } }));
  }

  const handleSelectCitizen = (type: CitizenType) => {
      setGameState(prev => {
          const newPlayers = prev.players.map(p => p.id === 0 ? { ...p, selectedCitizen: type } : p);
          return { 
              ...prev, 
              players: newPlayers,
              uiState: { ...prev.uiState, isSelectingTile: false, actionType: null, selectedHexId: null, isDeclaring: false, pendingHexId: null }
          };
      });
  };

  const handleHumanAction = (action: string, payload?: any) => {
      if (gameState.uiState.isProcessing) return; 

      const p = gameState.players[0];
      if (p.isEliminated) return;
      
      if (action === 'PASS') {
           setGameState(prev => {
               const newPlayers = prev.players.map(pl => pl.id === 0 ? { ...pl, hasPassed: true } : pl);
               const activePlayers = newPlayers.filter(p => !p.isEliminated);
               const allPassed = activePlayers.every(p => p.hasPassed);
               
               const newPassOrder = [...prev.passOrder];
               if (!newPassOrder.includes(0)) newPassOrder.push(0);

               if (allPassed) {
                   return {
                       ...prev, players: newPlayers,
                       logs: [...prev.logs, {id: Date.now().toString(), turn:prev.round, text: "You pass. All players passed. Events Phase beginning.", type:'phase', actorId: 0}],
                       turnTrigger: prev.turnTrigger + 1, uiState: { ...prev.uiState, isProcessing: false }, passOrder: newPassOrder
                   };
               } else {
                   // Manual advance logic for pass since advanceTurn handles active players
                   let nextIndex = (prev.turnOrderIndex + 1) % prev.turnOrder.length;
                   let attempts = 0;
                   while ((newPlayers[prev.turnOrder[nextIndex]].hasPassed || newPlayers[prev.turnOrder[nextIndex]].isEliminated) && attempts < prev.turnOrder.length) {
                       nextIndex = (nextIndex + 1) % prev.turnOrder.length;
                       attempts++;
                   }
                   return { 
                       ...prev, players: newPlayers, turnOrderIndex: nextIndex, turnTrigger: prev.turnTrigger + 1,
                       logs: [...prev.logs, {id: Date.now().toString(), turn:prev.round, text: "You pass for this Eclipse.", type:'info', actorId: 0}],
                       uiState: { ...prev.uiState, isProcessing: false }, passOrder: newPassOrder
                   };
               }
           });
           return;
      }
      
      // FATIGUE CALCULATION: +1 Cost per action taken this round
      const fatigue = p.actionsTaken > 0 ? 1 : 0;

      if (action === 'TRADE_BANK') {
          const isFree = p.status.freeTrades > 0 || p.activeRelicPower === 'TRADE_BARON'; 
          const tradeCost = 2 + fatigue; // Base 2 + Fatigue

          if (isFree || p.resources[Resource.Grain] >= tradeCost) {
               setGameState(prev => {
                   const currentP = prev.players[0];
                   let newRes = { ...currentP.resources };
                   let newStatus = { ...currentP.status };
                   const usedFree = currentP.status.freeTrades > 0;

                   if (usedFree) { newStatus.freeTrades--; } 
                   else { newRes[Resource.Grain] -= tradeCost; }
                   
                   newRes[Resource.Gold] += 1;
                   
                   const ps = prev.players.map(pl => pl.id === 0 ? { ...pl, resources: newRes, status: newStatus, actionsTaken: pl.actionsTaken + 1 } : pl);
                   const txt = usedFree ? "Used Free Trade: +1 Gold." : `Traded ${tradeCost} Grain for 1 Gold.`;

                   return { ...prev, players: ps, logs: [...prev.logs, {id: Date.now().toString(), turn:prev.round, text: txt, type:'info', actorId: 0}] };
               });
               advanceTurn();
          } else addLog(`Need ${tradeCost} Grain.`, 'info');
          return;
      }

      if (action === 'OPEN_MARKET') {
          setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isMarketOpen: true } }));
          return;
      }

      if (action === 'TRADE_MARKET') {
          const costRes = payload?.cost;
          const targetRes = payload?.target;
          
          if (costRes && targetRes && p.resources[costRes] >= 3) {
              setGameState(prev => {
                   const currentP = prev.players[0];
                   let newRes = { ...currentP.resources };
                   newRes[costRes] -= 3;
                   newRes[targetRes] += 1; 
                   
                   const ps = prev.players.map(pl => pl.id === 0 ? { ...pl, resources: newRes, actionsTaken: pl.actionsTaken + 1 } : pl);
                   return { 
                       ...prev, players: ps, 
                       logs: [...prev.logs, {id: Date.now().toString(), turn:prev.round, text: `Emergency Market: 3 ${costRes} -> 1 ${targetRes}.`, type:'info', actorId: 0}],
                       uiState: { ...prev.uiState, isMarketOpen: false }
                   };
              });
              advanceTurn();
          } else {
              addLog("Trade failed. Insufficient resources.", 'info');
              handleCloseMarket();
          }
          return;
      }

      if (action === 'EXPLORE_RUIN') {
          const myRuins = (Object.values(gameState.map) as HexData[]).filter((h) => h.ownerId === 0 && h.type === TileType.Ruins);
          if (myRuins.length > 0) {
               const targetRuin = myRuins[0];
               const hasRelic = (Object.values(gameState.map) as HexData[]).some(h => h.ownerId === 0 && h.type === TileType.RelicSite && h.isRevealed);
               const { card: evt, newDeck, newDiscard, reshuffled } = drawCard(gameState.eventDeck, gameState.discardPile);

               setGameState(prev => {
                    const ps = prev.players.map(pl => pl.id === 0 ? { ...pl, actionsTaken: pl.actionsTaken + 1 } : pl);
                    const nm = { ...prev.map };
                    if (nm[targetRuin.id]) { nm[targetRuin.id] = { ...nm[targetRuin.id], type: TileType.Plains, publicType: TileType.Plains, isRevealed: true }; }
                    
                    const logs = [...prev.logs, { 
                        id: `ruin-collapse-${Date.now()}`, 
                        turn: prev.round, 
                        text: `The Ruins at [${getCoordString(nm, targetRuin.id)}] collapse after your search. Found: ${evt.title}`, 
                        type: 'event' as const, 
                        details: { card: evt.title } 
                    }];
                    if (reshuffled) logs.push({ id: `shuffle-${Date.now()}`, turn: prev.round, text: "Event Deck empty. Discard pile reshuffled.", type: 'info' });

                    return { ...prev, players: ps, map: nm, logs, eventDeck: newDeck, discardPile: newDiscard };
               });

               setResolvingEvent({
                   card: evt,
                   type: evt.id === 'e1' ? 'CHOICE' : 'INFO',
                   amount: hasRelic ? 4 : 2,
                   isRelicPowered: hasRelic,
                   onComplete: () => setTimeout(() => advanceTurn(), 100)
               });
          } else addLog("You do not control any Ruins.", 'info');
          return;
      }

      let valid = false;
      
      if (action === 'BUILD_FORTIFY') {
          const isRelicFree = p.activeRelicPower === 'FREE_FORTIFY' && p.actionsTaken === 0;
          const isFree = p.status.freeFortify || isRelicFree;
          const fortifyCost = 2 + fatigue; 

          if (isFree) { valid = true; } 
          else { valid = p.resources[Resource.Stone] >= fortifyCost; if (!valid) addLog(`Need ${fortifyCost} Stone.`, 'info'); }
      }
      else if (action === 'WARRIOR_ATTACK') {
          const attackCost = 1 + fatigue;
          if (p.status.canAttack) { valid = p.resources[Resource.Grain] >= attackCost; if (!valid) addLog(`Commander, we need ${attackCost} Grain to supply the troops!`, 'info'); }
      }
      else if (action === 'EXPLORE_CLAIM') {
          const cost = 1 + fatigue; 
          valid = p.resources[Resource.Grain] >= cost;
          if (!valid) addLog(`Exploration costs ${cost} Grain (Fatigue +1).`, 'info');
      }
      else if (action === 'ACTIVATE_RELIC') valid = true;

      if (valid) {
          setGameState(prev => ({ 
              ...prev, 
              uiState: { 
                  ...prev.uiState, isSelectingTile: true, 
                  actionType: action === 'ACTIVATE_RELIC' ? 'ACTIVATE' : (action === 'WARRIOR_ATTACK' ? 'ATTACK' : action.split('_')[1]) as any, 
                  selectedHexId: null, isDeclaring: false, pendingHexId: null
              } 
          }));
          const msg = action === 'ACTIVATE_RELIC' ? "Select a hidden Relic to unveil." : "Select a target tile.";
          addLog(msg, 'info');
      }
  };

  const handleCancelDeclaration = () => {
    setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isDeclaring: false, pendingHexId: null, isSelectingTile: true } }));
  };

  const handleHexClick = (hexId: string) => {
      if (gameState.uiState.isProcessing) return;
      const { isSelectingTile, actionType } = gameState.uiState;
      if (!isSelectingTile) return;

      const hex = gameState.map[hexId];
      const myTiles = (Object.values(gameState.map) as HexData[]).filter((h) => h.ownerId === 0);
      const isAdj = myTiles.some(h => isAdjacent(h, hex));
      
      const p = gameState.players[0];
      const fatigue = p.actionsTaken > 0 ? 1 : 0;

      if (actionType === 'ACTIVATE') {
          if (hex.ownerId === 0 && hex.type === TileType.RelicSite && hex.publicType !== TileType.RelicSite) {
              setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isProcessing: true } }));
              const { card: evt, newDeck, newDiscard, reshuffled } = drawCard(gameState.eventDeck, gameState.discardPile);
              
              setGameState(prev => {
                  const nm = { ...prev.map };
                  nm[hexId].publicType = TileType.RelicSite; 
                  const ps = prev.players.map(p => p.id === 0 ? {...p, actionsTaken: p.actionsTaken + 1 } : p);
                  ps[0] = updatePlayerStat(ps[0], 'relicSitesRevealed', 1);

                  const logs = [...prev.logs];
                  if (reshuffled) logs.push({ id: `shuffle-${Date.now()}`, turn: prev.round, text: "Event Deck empty. Discard pile reshuffled.", type: 'info' });

                  return { ...prev, players: ps, map: nm, logs, eventDeck: newDeck, discardPile: newDiscard, uiState: { ...prev.uiState, isSelectingTile: false, actionType: null, selectedHexId: null } };
              });

              setResolvingEvent({ card: evt, type: 'INFO', amount: 0, isRelicPowered: true, onComplete: () => setTimeout(() => advanceTurn(), 100) });
          } else {
              addLog("That is not a hidden Relic site you control.", 'info');
          }
          return;
      }

      if ((actionType === 'CLAIM' || actionType === 'EXPLORE') && hex.ownerId === null && isAdj) {
           // RUINS CHECK
           if (hex.type === TileType.Ruins) {
               const cost = 1 + fatigue;
               if (gameState.players[0].resources.Grain < cost) {
                   addLog(`Insufficient Grain (${cost}) to explore Ruins.`, 'alert');
                   return;
               }

               setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isProcessing: true } }));
               
               const { card: evt, newDeck, newDiscard, reshuffled } = drawCard(gameState.eventDeck, gameState.discardPile);
               
               setGameState(prev => {
                   const ps = prev.players.map(p => p.id === 0 ? { ...p, resources: { ...p.resources, Grain: p.resources.Grain - cost }, actionsTaken: p.actionsTaken + 1 } : p);
                   const nm = { ...prev.map };
                   // Ruin collapses to Plains immediately
                   nm[hexId] = { ...nm[hexId], type: TileType.Plains, publicType: TileType.Plains, isRevealed: true };
                   
                   const logs = [...prev.logs, { 
                       id: `ruin-collapse-${Date.now()}`, 
                       turn: prev.round, 
                       text: `You explore the Ruins at [${getCoordString(nm, hexId)}]. They collapse into Plains. Found: ${evt.title}`, 
                       type: 'event' as const, 
                       details: { card: evt.title } 
                   }];
                   
                   if (reshuffled) logs.push({ id: `shuff-${Date.now()}`, turn: prev.round, text: "Event Deck reshuffled.", type: 'info' });

                   return { 
                       ...prev, players: ps, map: nm, logs, 
                       eventDeck: newDeck, discardPile: newDiscard,
                       uiState: { ...prev.uiState, isSelectingTile: false, actionType: null, selectedHexId: null, isProcessing: true } 
                   };
               });

               setResolvingEvent({ 
                   card: evt, 
                   type: evt.id === 'e1' ? 'CHOICE' : 'INFO', 
                   amount: evt.id === 'e1' ? 2 : 0, 
                   isRelicPowered: false, 
                   onComplete: () => setTimeout(() => advanceTurn(), 100) 
               });
               return;
           }

           setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isSelectingTile: false, isDeclaring: true, pendingHexId: hexId } }));
           return; 
      }
      
      else if (actionType === 'FORTIFY' && hex.ownerId === 0 && !hex.fortification) {
           setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isProcessing: true } }));
           setGameState(prev => {
               const player = prev.players[0];
               const newRes = { ...player.resources };
               
               const isRelicFree = player.activeRelicPower === 'FREE_FORTIFY' && player.actionsTaken === 0;
               const isFree = player.status.freeFortify || isRelicFree;
               const cost = 2 + fatigue;

               if (!isFree) { newRes[Resource.Stone] -= cost; }

               const ps = prev.players.map(p => p.id === 0 ? {...p, resources: newRes, actionsTaken: p.actionsTaken + 1} : p);
               const nm = { ...prev.map };
               nm[hexId] = { ...nm[hexId], fortification: { ownerId: 0, level: 1 } };
               
               return { ...prev, players: ps, map: nm, logs: [...prev.logs, {id:Date.now().toString(), turn:prev.round, text:`Fortification Built at [${getCoordString(nm, hexId)}]${isFree ? " (Free)" : ""}.`, type:'info', actorId: 0}], uiState: { ...prev.uiState, isSelectingTile: false, actionType: null, selectedHexId: null, isDeclaring: false, pendingHexId: null } };
           });
           setTimeout(() => advanceTurn(), 200);
      }

      else if (actionType === 'ATTACK' && hex.ownerId !== null && hex.ownerId !== 0 && isAdj) {
           setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isProcessing: true } }));
           const defender = gameState.players[hex.ownerId];
           
           let attStr = 1; 
           if (gameState.players[0].selectedCitizen === CitizenType.Warrior) attStr += 1;
           const attSupport = getNeighbors(hex.q, hex.r).filter(n => gameState.map[getHexId(n.q, n.r)]?.ownerId === 0).length;
           const warlordBonus = gameState.players[0].activeRelicPower === 'WARLORD' ? 1 : 0;
           attStr += attSupport + gameState.players[0].status.combatBonus + warlordBonus;

           let defStr = 1; 
           if (hex.fortification) defStr += 1;
           const defSupport = getNeighbors(hex.q, hex.r).filter(n => gameState.map[getHexId(n.q, n.r)]?.ownerId === hex.ownerId).length;
           defStr += defSupport;

           const rollAtt = Math.floor(Math.random() * 6) + 1;
           const rollDef = Math.floor(Math.random() * 6) + 1;
           const totalAtt = attStr + rollAtt;
           const totalDef = defStr + rollDef;
           const won = totalAtt > totalDef;
           
           setGameState(prev => {
               let ps = prev.players.map(p => p.id === 0 ? {...p, actionsTaken: p.actionsTaken + 1 } : p);
               const attackCost = 1 + fatigue;
               ps[0].resources[Resource.Grain] -= attackCost;
               ps[0] = updateMaxResources(ps[0]);

               ps[0] = updatePlayerStat(ps[0], 'attacksMade', 1);
               if (!ps[0].stats.uniquePlayersAttacked.includes(defender.id)) { ps[0] = updatePlayerStat(ps[0], 'uniquePlayersAttacked', defender.id); }

               const nm = { ...prev.map };
               nm[hexId] = { ...nm[hexId] };
               let logMsg = "";
               let logType: LogEntry['type'] = 'combat';

               if (won) {
                   nm[hexId].ownerId = 0;
                   nm[hexId].fortification = null; 
                   nm[hexId].isRevealed = true; 
                   logMsg = `Victory against ${defender.name} at [${getCoordString(nm, hexId)}]!`;
                   ps[0] = updatePlayerStat(ps[0], 'battlesWon', 1);
                   ps[defender.id] = updatePlayerStat(ps[defender.id], 'tilesLost', 1);

                   const attacker = { ...ps[0] };
                   const victim = { ...prev.players[defender.id] };
                   
                   const stealable = ([Resource.Grain, Resource.Stone, Resource.Gold] as Resource[]).filter(r => victim.resources[r] > 0);
                   if (stealable.length > 0) {
                       const stolenRes = stealable[Math.floor(Math.random() * stealable.length)];
                       victim.resources[stolenRes] = Math.max(0, victim.resources[stolenRes] - 1);
                       attacker.resources[stolenRes]++;
                       logMsg += ` Looted 1 ${stolenRes}!`;
                   }
                   ps = ps.map(p => { if (p.id === attacker.id) return attacker; if (p.id === victim.id) return victim; return p; });

               } else {
                   logMsg = `Defeat against ${defender.name} at [${getCoordString(nm, hexId)}].`;
                   ps[defender.id] = updatePlayerStat(ps[defender.id], 'battlesWon', 1);
               }

               return { 
                   ...prev, players: ps, map: nm, 
                   logs: [...prev.logs, {
                       id:Date.now().toString(), turn:prev.round, text:logMsg, type:logType, actorId: 0, targetId: defender.id,
                       details: { dice: { att: attStr, def: defStr, attRoll: rollAtt, defRoll: rollDef } }
                    }], 
                   uiState: { ...prev.uiState, isSelectingTile: false, actionType: null, selectedHexId: null, isDeclaring: false, pendingHexId: null } 
               };
           });
           setTimeout(() => advanceTurn(), 200);
      }
      else {
          addLog("Invalid Target.", 'info');
      }
  };

  const handleDeclarationFixed = (declaredType: TileType) => {
      if (gameState.uiState.isProcessing) return;
      const { pendingHexId } = gameState.uiState;
      if (!pendingHexId) return;

      setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isProcessing: true } }));

      // --- NPC INTERCEPTION CHECK ---
      const trueType = gameState.map[pendingHexId].type;
      const isBluffing = declaredType !== trueType;
      const isGenuineRelic = trueType === TileType.RelicSite && declaredType === TileType.RelicSite;

      const npcs = gameState.players.filter(p => !p.isHuman && !p.isEliminated);
      let challengerId: number | null = null;
      let dialogue = "";

      for (const npc of npcs) {
          if (!npc.aiState) continue;
          if (npc.status.turnLost) continue; // Skip penalized NPCs

          let challengeChance = 0.05; 
          if (npc.aiState.suspicion > 60) challengeChance += 0.3;
          if (npc.aiState.activeTraits.includes('Paranoid')) challengeChance += 0.3;
          if (npc.aiState.activeTraits.includes('Greedy')) challengeChance += 0.1; 
          if (isChallengeMode) challengeChance += 0.2;
          
          if (Math.random() < challengeChance) {
              challengerId = npc.id;
              dialogue = "I don't believe you, human!";
              break;
          }
      }

      if (challengerId !== null) {
           let evt: EventCard | null = null;
           let newDeck = gameState.eventDeck;
           let newDiscard = gameState.discardPile;
           let reshuffled = false;

           // If we are telling the truth about a relic, we need a card ready
           if (!isBluffing && isGenuineRelic) {
               const drawResult = drawCard(gameState.eventDeck, gameState.discardPile);
               evt = drawResult.card;
               newDeck = drawResult.newDeck;
               newDiscard = drawResult.newDiscard;
               reshuffled = drawResult.reshuffled;
           }

           setGameState(prev => {
               const ps = prev.players.map(p => ({...p}));
               const map = { ...prev.map };
               let logMsg = `CHALLENGE! ${ps[challengerId!].name} calls your bluff!`;
               let logType: LogEntry['type'] = 'combat';

               if (isBluffing) {
                    logMsg += " You were caught lying! Tile neutralized.";
                    ps[challengerId!].vp += 1;
                    ps[0].vp = Math.max(0, ps[0].vp - 1);
                    ps[0].resources[Resource.Grain] -= 1;
                    ps[0].actionsTaken++;

                    map[pendingHexId].isRevealed = true;
                    map[pendingHexId].publicType = trueType;
                    map[pendingHexId].ownerId = null;

               } else {
                    logMsg += " But you told the truth!";
                    
                    if (isCasualMode) {
                        // AI Pays fine
                        if (ps[challengerId!].resources[Resource.Gold] >= 2) {
                            ps[challengerId!].resources[Resource.Gold] -= 2;
                            ps[0].resources[Resource.Gold] += 2;
                            logMsg += " AI pays reparations.";
                        } else {
                            ps[challengerId!].vp -= 1;
                            logMsg += " AI loses Rep.";
                        }
                    } else {
                        // AI loses turn
                        ps[challengerId!].status.turnLost = true;
                        logMsg += " AI receives Penalty: Turn Lost.";
                    }
                    
                    map[pendingHexId].ownerId = 0;
                    map[pendingHexId].isRevealed = true;
                    map[pendingHexId].publicType = trueType;
                    ps[0].resources[Resource.Grain] -= 1;
                    ps[0].actionsTaken++;

                    if (isGenuineRelic) {
                        ps[0].resources[Resource.Relic]++;
                        ps[0] = updatePlayerStat(ps[0], 'relicSitesRevealed', 1);
                        logMsg += " Relic Site Secured!";
                    }
               }

               const logs = [...prev.logs, { id: Date.now().toString(), turn: prev.round, text: logMsg, type: logType }];
               if (reshuffled) logs.push({ id: `shuffle-${Date.now()}`, turn: prev.round, text: "Event Deck empty.", type: 'info' });

               return {
                   ...prev, players: ps, map,
                   logs,
                   eventDeck: newDeck, discardPile: newDiscard, // Update decks
                   uiState: { ...prev.uiState, isSelectingTile: false, actionType: null, selectedHexId: null, isDeclaring: false, pendingHexId: null }
               };
           });
           
           if (!isBluffing && isGenuineRelic && evt) {
                setResolvingEvent({ card: evt, type: 'INFO', amount: 0, isRelicPowered: true, onComplete: () => setTimeout(() => advanceTurn(), 100) });
           } else {
                setTimeout(() => advanceTurn(), 1000);
           }
           return;
      }
      
      const isRelicDiscovery = trueType === TileType.RelicSite && declaredType === TileType.RelicSite;
      let evt: EventCard | null = null;
      let newDeck = gameState.eventDeck;
      let newDiscard = gameState.discardPile;
      let reshuffled = false;

      if (isRelicDiscovery) {
          const drawResult = drawCard(gameState.eventDeck, gameState.discardPile);
          evt = drawResult.card;
          newDeck = drawResult.newDeck;
          newDiscard = drawResult.newDiscard;
          reshuffled = drawResult.reshuffled;
      }

      setGameState(prev => {
          let players = prev.players.map(p => ({ ...p, stats: {...p.stats}, resources: {...p.resources} }));
          const map = { ...prev.map };
          const logs = [...prev.logs];
          const myPlayerIndex = players.findIndex(p => p.id === 0);
          
          map[pendingHexId] = { ...map[pendingHexId], ownerId: 0, isRevealed: true, publicType: declaredType };
          players[myPlayerIndex] = updatePlayerStat(players[myPlayerIndex], 'tilesRevealed', 1);
          
          const fatigue = players[myPlayerIndex].actionsTaken > 0 ? 1 : 0;
          const cost = 1 + fatigue; 
          
          if (cost > 0) { players[myPlayerIndex].resources[Resource.Grain] -= cost; }
          players[myPlayerIndex].actionsTaken++;

          let logMsg = `You claim tile [${getCoordString(map, pendingHexId)}] as ${TILE_CONFIG[declaredType].label}.`;
          
          if (isRelicDiscovery) {
              players[myPlayerIndex].resources[Resource.Relic]++;
              players[myPlayerIndex] = updatePlayerStat(players[myPlayerIndex], 'relicSitesRevealed', 1);
          }

          logs.push({id:Date.now().toString(), turn:prev.round, text:logMsg, type:'bluff', actorId: 0, details: { declaredType } });
          if (reshuffled) logs.push({ id: `shuffle-${Date.now()}`, turn: prev.round, text: "Event Deck empty. Discard pile reshuffled.", type: 'info' });

          return { 
              ...prev, players, map, logs, eventDeck: newDeck, discardPile: newDiscard,
              uiState: { ...prev.uiState, isSelectingTile: false, actionType: null, selectedHexId: null, isDeclaring: false, pendingHexId: null } 
          };
      });

      if (isRelicDiscovery && evt) {
           setResolvingEvent({ card: evt, type: 'INFO', amount: 0, isRelicPowered: true, onComplete: () => setTimeout(() => advanceTurn(), 100) });
      } else {
           setTimeout(() => advanceTurn(), 100);
      }
  }

  // --- NEW: Render Tooltip for Fog of War ---
  const renderTileTooltip = () => {
    if (!hoveredHexId || !gameState.map[hoveredHexId]) return null;
    const hex = gameState.map[hoveredHexId];
    const owner = hex.ownerId !== null ? gameState.players[hex.ownerId] : null;
    
    const isUnknown = hex.ownerId === null && !hex.isRevealed;
    const typeLabel = isUnknown ? "Unexplored Sector" : TILE_CONFIG[hex.publicType].label;
    const showTrueType = hex.ownerId === 0 || gameState.players[0].isEliminated;

    return (
        <div className="absolute top-4 left-4 z-50 bg-slate-900/95 border border-slate-600 p-3 rounded-lg shadow-xl backdrop-blur pointer-events-none animate-in fade-in slide-in-from-left-2 w-64">
            <div className="flex items-center gap-2 mb-2 border-b border-slate-700 pb-2">
                <MapPin size={16} className="text-[#fcd34d]" />
                <span className="font-bold text-slate-200 text-sm">Sector [{hex.diceCoords.col}, {hex.diceCoords.row}]</span>
            </div>
            <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                    <span className="text-slate-400 flex items-center gap-1"><Users size={12}/> Owner:</span>
                    {owner ? <span className="font-bold" style={{ color: owner.faction.color }}>{owner.name}</span> : <span className="text-slate-500 italic">Unclaimed</span>}
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-slate-400 flex items-center gap-1"><Search size={12}/> Terrain:</span>
                    <div className="text-right">
                        <div className={`font-bold ${isUnknown ? 'text-slate-500 italic' : 'text-white'}`}>{typeLabel}</div>
                        {showTrueType && !isUnknown && hex.publicType !== hex.type && (
                            <div className="text-[10px] text-purple-400 flex items-center gap-1 justify-end"><VenetianMask size={10}/> (Real: {TILE_CONFIG[hex.type].label})</div>
                        )}
                    </div>
                </div>
                {hex.fortification && (
                    <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-800">
                        <span className="text-green-400 flex items-center gap-1"><Shield size={12}/> Fortified</span>
                        <span className="text-green-400 font-bold">Lvl {hex.fortification.level}</span>
                    </div>
                )}
            </div>
        </div>
    );
  };

  const humanPlayer = gameState.players[0];
  const isHumanEliminated = humanPlayer?.isEliminated;
  const realIncome = humanPlayer ? getIncomeRate(humanPlayer, gameState.map, false) : null;
  const publicIncome = humanPlayer ? getIncomeRate(humanPlayer, gameState.map, true) : null;

  const SidebarContent = () => (
       <div className="h-full flex flex-col bg-[#0f172a] border-l border-slate-700">
           <div className="flex border-b border-slate-700 shrink-0">
                  <button onClick={() => setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, activeSidebarTab: 'LOG' } }))} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${gameState.uiState.activeSidebarTab === 'LOG' ? 'bg-[#1e293b] text-[#fcd34d] border-b-2 border-[#fcd34d]' : 'text-slate-500 hover:text-slate-300'}`}><BookOpen size={14}/> Log</button>
                  <button onClick={() => setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, activeSidebarTab: 'RIVALS' } }))} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${gameState.uiState.activeSidebarTab === 'RIVALS' ? 'bg-[#1e293b] text-[#fcd34d] border-b-2 border-[#fcd34d]' : 'text-slate-500 hover:text-slate-300'}`}><Eye size={14}/> Intel</button>
              </div>
              <div className="flex-1 overflow-y-auto p-0 bg-[#0f172a] custom-scrollbar">
                  {gameState.uiState.activeSidebarTab === 'LOG' ? (
                      <div className="p-3 space-y-2">
                          {gameState.logs.map(log => {
                               const actor = log.actorId !== undefined ? gameState.players[log.actorId] : null;
                               const dice = log.details?.dice;
                               return (
                                   <div key={log.id} className={`text-xs p-3 rounded border-l-2 transition-all animate-in fade-in slide-in-from-left-2 ${log.type === 'combat' ? 'border-red-500 bg-red-900/10' : log.type === 'bluff' ? 'border-purple-500 bg-purple-900/10' : log.type === 'event' ? 'border-blue-500 bg-blue-900/10' : log.type === 'phase' ? 'border-[#fcd34d] bg-yellow-900/10 text-[#fcd34d] font-bold text-center py-2' : 'border-slate-600 bg-slate-800/30 text-slate-400'}`}>
                                       {log.type === 'phase' ? ( log.text ) : (
                                           <>
                                               <div className="flex items-center gap-2 mb-1">
                                                   {actor && <span className="font-bold" style={{ color: actor.faction.color }}>{actor.name}</span>}
                                                   {!actor && <span className="font-bold text-slate-400">System</span>}
                                                   <span className="ml-auto opacity-50 text-[10px]">R{log.turn}</span>
                                               </div>
                                               <div className="text-slate-200 mb-1 leading-relaxed">{log.text}</div>
                                               {dice && (
                                                   <div className="mt-2 p-1.5 bg-black/40 rounded flex justify-between items-center text-[11px] font-mono text-slate-300">
                                                       <div className="flex items-center gap-1"><Sword size={12} className="text-slate-400"/><span className="text-white font-bold">{dice.att + dice.attRoll}</span><span className="text-slate-500">({dice.att}+{dice.attRoll})</span></div>
                                                       <span className="text-slate-600">vs</span>
                                                       <div className="flex items-center gap-1"><span className="text-white font-bold">{dice.def + dice.defRoll}</span><span className="text-slate-500">({dice.def}+{dice.defRoll})</span><Hammer size={12} className="text-slate-400"/></div>
                                                   </div>
                                               )}
                                               {log.details?.declaredType && (
                                                   <div className="mt-1 flex items-center gap-1 text-[10px]"><VenetianMask size={10} className="text-purple-400" /><span className="text-purple-300">Declared: {TILE_CONFIG[log.details.declaredType].label}</span></div>
                                               )}
                                           </>
                                       )}
                                   </div>
                               );
                          })}
                          <div ref={logEndRef} />
                      </div>
                  ) : (
                      <div className="p-4 space-y-4">
                          {humanPlayer && (
                              <div className="bg-slate-800 border border-[#ca8a04]/30 rounded p-3 mb-4">
                                  <div className="text-[10px] text-[#fcd34d] uppercase tracking-widest mb-2 flex items-center gap-2"><Target size={12} /> Secret Directives ({humanPlayer.secretObjectives.length})</div>
                                  <div className="space-y-3">
                                      {humanPlayer.secretObjectives.map((obj, idx) => (
                                          <div key={idx} className="border-l-2 border-[#fcd34d] pl-2 pb-1">
                                              <div className="font-bold text-white text-xs">{obj.name}</div>
                                              <div className="text-[10px] text-slate-400 mb-1">{obj.description}</div>
                                              <div className="text-xs text-emerald-400 font-mono">{obj.progress(humanPlayer, gameState.map)}</div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}
                          <div className="bg-slate-800 border border-blue-500/30 rounded p-3 mb-4">
                              <div className="text-[10px] text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Crown size={12} /> Public Imperatives</div>
                              {gameState.publicObjectives.length === 0 ? ( <div className="text-xs text-slate-500 italic">No public edicts revealed yet...</div> ) : (
                                  <div className="space-y-3">
                                      {gameState.publicObjectives.map((obj, idx) => (
                                          <div key={idx} className="border-l-2 border-blue-500 pl-2 pb-1 bg-blue-900/10">
                                              <div className="font-bold text-white text-xs">{obj.name} <span className="text-blue-300">({obj.vp} VP)</span></div>
                                              <div className="text-[10px] text-slate-400 mb-1">{obj.description}</div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest text-center mb-2">Rival Civilizations</p>
                          {gameState.players.filter(p => !p.isHuman).map(rival => {
                              const rivalScore = calculateScore(rival, gameState.map, gameState.publicObjectives);
                              return (
                                  <div key={rival.id} className="bg-slate-900 border border-slate-700 rounded p-3 mb-3">
                                      <div className="flex justify-between items-center mb-2">
                                          <span className="font-bold text-sm" style={{ color: rival.faction.color }}>{rival.name}</span>
                                          <div className={`text-xs px-2 py-0.5 rounded border ${rival.aiState?.diplomaticStance === 'War' ? 'bg-red-900/50 text-red-400 border-red-500/50' : rival.aiState?.diplomaticStance === 'Hostile' ? 'bg-orange-900/50 text-orange-400 border-orange-500/50' : rival.aiState?.diplomaticStance === 'Ally' ? 'bg-green-900/50 text-green-400 border-green-500/50' : 'bg-slate-800 text-slate-400 border-slate-600'} flex items-center gap-1`}>
                                              {rival.aiState?.diplomaticStance === 'War' && <Sword size={10} />}
                                              {rival.aiState?.diplomaticStance === 'Ally' && <Handshake size={10} />}
                                              {rival.aiState?.diplomaticStance || 'Neutral'}
                                          </div>
                                      </div>
                                      <div className="flex justify-between items-center text-xs mb-3 text-slate-500">
                                          <span>VP: <span className="text-white">{rivalScore.total}</span></span>
                                          {rival.isEliminated && <span className="text-red-500 font-bold uppercase">Eliminated</span>}
                                      </div>
                                      {rival.aiState && !rival.isEliminated && (
                                          <div className="space-y-2 mb-3 bg-black/20 p-2 rounded">
                                              <div><div className="flex justify-between text-[9px] text-slate-400 mb-0.5"><span className="flex items-center gap-1"><AlertTriangle size={8} /> Fear</span><span>{Math.round(rival.aiState.fear)}%</span></div><div className="h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full transition-all ${rival.aiState.fear > 70 ? 'bg-red-500' : 'bg-slate-500'}`} style={{ width: `${rival.aiState.fear}%` }} /></div></div>
                                              <div><div className="flex justify-between text-[9px] text-slate-400 mb-0.5"><span className="flex items-center gap-1"><Eye size={8} /> Suspicion</span><span>{Math.round(rival.aiState.suspicion)}%</span></div><div className="h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full transition-all ${rival.aiState.suspicion > 70 ? 'bg-orange-500' : 'bg-slate-500'}`} style={{ width: `${rival.aiState.suspicion}%` }} /></div></div>
                                          </div>
                                      )}
                                      {rival.aiState && (
                                          <div className="flex flex-wrap gap-1">
                                              {rival.aiState.activeTraits.map(t => (
                                                  <span key={t} className="text-[9px] px-1.5 py-0.5 bg-slate-800 border border-slate-600 text-slate-300 rounded flex items-center gap-1">
                                                      {(t === 'Aggressive' || t === 'Vengeful') && <Zap size={8} className="text-red-400"/>}
                                                      {(t === 'Paranoid' || t === 'Treacherous') && <Skull size={8} className="text-purple-400"/>}
                                                      {(t === 'Greedy' || t === 'Expansionist') && <Activity size={8} className="text-green-400"/>}
                                                      {t}
                                                  </span>
                                              ))}
                                          </div>
                                      )}
                                  </div>
                              );
                          })}
                      </div>
                  )}
              </div>
       </div>
  );

  const activeId = gameState.turnOrder[gameState.turnOrderIndex];
  const activePlayer = gameState.players[activeId];
  const activePlayersList = gameState.players.filter(p => !p.isEliminated && !p.hasPassed);
  const isLastStand = activePlayersList.length === 1 && activePlayersList[0].id === 0 && gameState.players.filter(p => !p.isEliminated).length > 1;

  if (showSplash) return <SplashScreen onStart={handleSplashStart} onOpenSim={() => setShowSim(true)} onOpenStrategyLab={() => setShowStrategyLab(true)} />;
  if (showSim) return <SimulationOverlay onClose={() => setShowSim(false)} />;
  if (showStrategyLab) return <SimulationRunner onClose={() => setShowStrategyLab(false)} />;

  if (!gameStarted) {
    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden p-4 animate-in fade-in">
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#0f0c29] to-black" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,_rgba(180,83,9,0.15),_transparent_70%)]" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90" />
            </div>
            <div className="relative z-10 text-center max-w-2xl w-full bg-black/60 backdrop-blur-md border border-[#ca8a04]/30 p-8 md:p-12 rounded-lg">
                 <h1 className="text-4xl md:text-5xl font-title text-[#fcd34d] mb-4">Select Game Mode</h1>
                 <p className="text-slate-400 mb-8">Choose your ruleset and conflict scale.</p>
                 
                 {/* RULES SELECTOR */}
                 <div className="flex justify-center mb-6 gap-4">
                     <button onClick={() => setIsCasualMode(false)} className={`p-4 border rounded w-40 flex flex-col items-center gap-2 transition-all ${!isCasualMode ? 'bg-[#ca8a04]/20 border-[#ca8a04] text-[#fcd34d]' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                         <Sword size={24} />
                         <span className="font-bold">Standard</span>
                         <span className="text-[10px]">Penalty: Turn Lost</span>
                     </button>
                     <button onClick={() => setIsCasualMode(true)} className={`p-4 border rounded w-40 flex flex-col items-center gap-2 transition-all ${isCasualMode ? 'bg-blue-900/20 border-blue-400 text-blue-200' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                         <Handshake size={24} />
                         <span className="font-bold">Casual</span>
                         <span className="text-[10px]">Penalty: Pay Fine</span>
                     </button>
                 </div>

                 {/* AI DIFFICULTY */}
                 <div className="flex justify-center mb-8">
                    <div className="inline-flex bg-slate-900 border border-slate-700 rounded-lg p-1">
                        <button onClick={() => setIsChallengeMode(false)} className={`px-4 py-2 rounded text-sm font-bold uppercase transition-all flex items-center gap-2 ${!isChallengeMode ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}><Shield size={16} /> Standard AI</button>
                        <button onClick={() => setIsChallengeMode(true)} className={`px-4 py-2 rounded text-sm font-bold uppercase transition-all flex items-center gap-2 ${isChallengeMode ? 'bg-red-900 text-red-100 shadow' : 'text-slate-500 hover:text-red-400'}`}><Skull size={16} /> Hard AI</button>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <button onClick={() => startGame(2)} className="p-6 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 hover:border-[#ca8a04] transition-all group"><h2 className="text-xl font-bold text-white mb-1">2 Players</h2><p className="text-xs text-[#ca8a04] uppercase tracking-widest group-hover:text-white">Duel</p></button>
                     <button onClick={() => startGame(3)} className="p-6 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 hover:border-[#ca8a04] transition-all group"><h2 className="text-xl font-bold text-white mb-1">3 Players</h2><p className="text-xs text-[#ca8a04] uppercase tracking-widest group-hover:text-white">Skirmish</p></button>
                     <button onClick={() => startGame(4)} className="p-6 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 hover:border-[#ca8a04] transition-all group"><h2 className="text-xl font-bold text-white mb-1">4 Players</h2><p className="text-xs text-[#ca8a04] uppercase tracking-widest group-hover:text-white">Total War</p></button>
                 </div>
            </div>
        </div>
    );
  }

  if (gameState.phase === Phase.EndGame) {
    const rankedPlayers = gameState.players.map(p => {
        const scoreData = calculateScore(p, gameState.map, gameState.publicObjectives);
        const bluffCount = (Object.values(gameState.map) as HexData[]).filter(h => h.ownerId === p.id && h.type !== h.publicType).length;
        const totalResources = Object.values(p.resources).reduce((a: number, b: number)=>a+b,0);
        const totalTiles = (Object.values(gameState.map) as HexData[]).filter(h => h.ownerId === p.id).length;
        return { ...p, scoreData, bluffCount, totalResources, totalTiles };
    }).sort((a,b) => {
        if (b.scoreData.total !== a.scoreData.total) return b.scoreData.total - a.scoreData.total;
        if (b.totalTiles !== a.totalTiles) return b.totalTiles - a.totalTiles;
        return b.totalResources - a.totalResources;
    });
    const winner = rankedPlayers[0];
    const isWinner = winner && winner.id === 0;

    return (
        <div className="h-screen w-full bg-[#0b0a14] text-[#e2d9c5] font-sans flex overflow-hidden relative">
            <div className="flex-1 relative bg-black border-r border-[#ca8a04]/30">
                <HexGrid map={gameState.map} players={gameState.players} humanPlayerId={0} onHexClick={()=>{}} onHexHover={()=>{}} uiState={gameState.uiState} revealAll={true} playerCount={gameState.players.length} />
            </div>
            <div className="w-full max-w-md md:max-w-lg bg-[#1e293b] flex flex-col border-l border-slate-700 shadow-2xl z-30">
                <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar">
                    <h1 className="text-4xl font-title text-[#fcd34d] text-center mb-2">{isWinner ? "VICTORY" : "DEFEAT"}</h1>
                    <div className="space-y-4 mt-6">
                        {rankedPlayers.map((p, idx) => (
                            <div key={p.id} className={`p-4 rounded border ${p.id === 0 ? 'bg-slate-800 border-[#fcd34d]' : 'bg-slate-900 border-slate-700'}`}>
                                 <div className="flex items-center gap-3">
                                     <span className="text-xl font-bold w-6 text-slate-500">#{idx + 1}</span>
                                     <div className="flex-1">
                                        <div className="font-bold text-lg" style={{ color: p.faction.color }}>{p.name}</div>
                                     </div>
                                     <div className="text-3xl font-bold text-white">{p.scoreData.total} VP</div>
                                 </div>
                                 <div className="mt-2 text-[10px] text-slate-400 flex justify-between px-2 pt-2 border-t border-slate-700/50">
                                    <span>Tiles: {p.scoreData.breakdown.tileVp}</span>
                                    <span>Forts: {p.scoreData.breakdown.fortVp}</span>
                                    <span>Relics: {p.scoreData.breakdown.relicVp}</span>
                                    <span>Objectives: {p.scoreData.breakdown.totalObjVp}</span>
                                    <span className="text-purple-400 font-bold uppercase tracking-widest">Bluffs: {p.bluffCount}</span>
                                 </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-8 border-t border-slate-700 pt-4">
                        <h3 className="text-center text-blue-400 font-bold uppercase text-xs tracking-widest mb-2">Public Imperatives Scored</h3>
                        {gameState.publicObjectives.map((obj, i) => ( <div key={i} className="text-xs text-center text-slate-400 mb-1">{obj.name} ({obj.vp} VP)</div> ))}
                    </div>
                </div>
                <div className="p-6 bg-[#0f172a] border-t border-slate-700 text-center shrink-0">
                    <button onClick={() => { setGameStarted(false); startGame(gameState.players.length); }} className="w-full px-8 py-4 bg-[#ca8a04] text-black font-bold text-lg rounded hover:bg-[#eab308]">Play Again</button>
                </div>
            </div>
        </div>
      );
  }

  const isMyTurn = gameState.phase === Phase.Action && gameState.turnOrder[gameState.turnOrderIndex] === 0 && !isHumanEliminated;
  const isActionPhaseDone = gameState.phase === Phase.Events;
  const activePlayerName = gameState.players[activeId]?.name;

  return (
    <div className="h-screen bg-[#0b0a14] text-[#e2d9c5] font-sans flex flex-col overflow-hidden relative">
      
      {/* --- RESTORED HEADER --- */}
      <header className="bg-[#0f172a] border-b border-[#ca8a04] p-3 flex justify-between items-center shadow-lg z-20 shrink-0">
         <div className="flex items-center gap-4">
             <div className="flex flex-col">
                 <h1 className="text-lg md:text-xl font-bold font-title tracking-widest text-[#fcd34d]">ECLIPSE OF EMPIRES</h1>
                 <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-wider">
                     <span>Eclipse {gameState.round}/{TOTAL_ROUNDS}</span>
                     <span className="text-slate-600">|</span>
                     <span>{gameState.phase}</span>
                     <span className="text-slate-600">|</span>
                     <span className={isChallengeMode ? 'text-red-500 font-bold' : 'text-slate-500'}>{isChallengeMode ? 'CHALLENGE MODE' : 'STANDARD'}</span>
                 </div>
             </div>
             
             {/* Turn Tracker */}
             <div className="hidden md:block ml-4">
                 <TurnOrderTracker players={gameState.players} turnOrder={gameState.turnOrder} turnOrderIndex={gameState.turnOrderIndex} />
             </div>
         </div>

         {/* Resources (Human) */}
         <div className="flex items-center gap-4">
             {Object.values(Resource).map(r => (
                 <div key={r} className="flex flex-col items-center">
                     <ResourceIcon resource={r} size={18} />
                     <span className="text-xs font-bold font-mono" style={{color: RESOURCE_COLORS[r]}}>{gameState.players[0].resources[r]}</span>
                 </div>
             ))}
             <div className="w-px h-8 bg-slate-700 mx-2"></div>
             <div className="flex flex-col items-center" title="Victory Points">
                 <Trophy size={18} className="text-purple-400" />
                 <span className="text-xs font-bold font-mono text-purple-200">{gameState.players[0].vp}</span>
             </div>
             
             <button onClick={() => setShowHelpModal(true)} className="ml-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
                 <BookOpen size={18} className="text-slate-400" />
             </button>
         </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
          <div className="flex-1 relative bg-[#050505] flex flex-col overflow-hidden">
               {/* Tooltip Overlay */}
               {renderTileTooltip()}

               {/* Center the grid properly */}
               <div className="flex-1 relative flex items-center justify-center overflow-hidden pt-4 pb-0">
                   <HexGrid 
                       map={gameState.map} 
                       players={gameState.players} 
                       humanPlayerId={0} 
                       onHexClick={handleHexClick}
                       onHexHover={setHoveredHexId}
                       uiState={gameState.uiState}
                       playerCount={gameState.players.length}
                   />
               </div>
               
               <div className="absolute bottom-0 left-0 right-0 z-40">
                   <ActionPanel 
                       phase={gameState.phase}
                       player={gameState.players[0]}
                       isMyTurn={gameState.turnOrder[gameState.turnOrderIndex] === 0}
                       activePlayerName={gameState.players[gameState.turnOrder[gameState.turnOrderIndex]]?.name}
                       onSelectCitizen={(c) => setGameState(prev => {
                           const ps = [...prev.players]; ps[0].selectedCitizen = c; return { ...prev, players: ps };
                       })}
                       onAction={handleHumanAction}
                       onEndPhase={handlePhaseTransition}
                       map={gameState.map}
                       isEliminated={gameState.players[0].isEliminated}
                       isLastStand={isLastStand}
                       uiState={gameState.uiState}
                   />
               </div>
          </div>
          {/* Sidebar */}
          <div className="hidden md:block w-80 shrink-0 relative z-10 border-l border-slate-800">
              <SidebarContent />
          </div>
      </div>

      <WelcomeModal onClose={() => {}} forceShow={false} />
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
      <MarketModal 
          isOpen={gameState.uiState.isMarketOpen} 
          onClose={() => setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isMarketOpen: false } }))}
          onConfirm={(resource) => handleHumanAction('TRADE_MARKET', { cost: resource, target: Resource.Grain })}
          playerResources={gameState.players[0].resources}
      />
      {gameState.pendingChallenge && (
          <ChallengeModal 
              challenge={gameState.pendingChallenge} 
              declarer={gameState.players[gameState.pendingChallenge.declarerId]} 
              onResolve={handleChallengeResponse} 
          />
      )}
      
      {resolvingEvent && (
          <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-[#0f172a] border-2 border-blue-500 w-full max-w-lg rounded-xl shadow-2xl p-6 relative animate-in zoom-in-95">
                  <h2 className="text-blue-400 font-title text-xl uppercase tracking-widest text-center mb-4 flex items-center justify-center gap-2">
                      <Sparkles size={24}/> Event Triggered
                  </h2>
                  <div className="bg-slate-900 border border-slate-700 p-4 rounded mb-6 text-center">
                      <h3 className="text-white font-bold text-lg mb-1">{resolvingEvent.card.title}</h3>
                      <p className="text-slate-400 text-sm italic">{resolvingEvent.isRelicPowered ? resolvingEvent.card.relicText : resolvingEvent.card.normalText}</p>
                  </div>
                  
                  {resolvingEvent.type === 'CHOICE' ? (
                      <div className="space-y-3">
                          <p className="text-center text-sm text-slate-300 mb-2">Choose a resource ({resolvingEvent.amount} remaining):</p>
                          <div className="grid grid-cols-4 gap-2">
                              {Object.values(Resource).map(r => (
                                  <button key={r} onClick={() => handleEventResourceChoice(r)} className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded flex flex-col items-center gap-1 transition-colors">
                                      <ResourceIcon resource={r} size={20}/>
                                      <span className="text-[10px] uppercase font-bold text-slate-400">{r}</span>
                                  </button>
                              ))}
                          </div>
                      </div>
                  ) : (
                      <button onClick={() => {
                          setResolvingEvent(null);
                          if(resolvingEvent.onComplete) resolvingEvent.onComplete();
                      }} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest rounded transition-colors">
                          Continue
                      </button>
                  )}
              </div>
          </div>
      )}

      <DeclarationModal 
          isOpen={gameState.uiState.isDeclaring}
          trueType={gameState.uiState.pendingHexId ? gameState.map[gameState.uiState.pendingHexId].type : TileType.Plains}
          onConfirm={handleDeclarationFixed}
          onCancel={() => setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isDeclaring: false, pendingHexId: null } }))}
      />
      
      {showSim && <SimulationOverlay onClose={() => setShowSim(false)} />}
      {showStrategyLab && <SimulationRunner onClose={() => setShowStrategyLab(false)} />}
    </div>
  );
}

export default App;