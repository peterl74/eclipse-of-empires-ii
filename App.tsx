import React, { useState, useEffect, useRef } from 'react';
import { GameState, Phase, Player, Resource, LogEntry, TileType, HexData, CitizenType, EventCard, SecretObjective, RelicPowerType } from './types';
import { generateMap, getHexId, getNeighbors, isAdjacent } from './utils/hexUtils';
import { FACTIONS, TOTAL_ROUNDS, EVENTS_DECK, OBJECTIVES_DECK, TILE_CONFIG, VP_CONFIG } from './constants';
import HexGrid from './components/HexGrid';
import ActionPanel from './components/ActionPanel';
import HelpModal from './components/HelpModal';
import MarketModal from './components/MarketModal';
import TurnOrderTracker from './components/TurnOrderTracker';
import SplashScreen from './components/SplashScreen';
import { Eye, EyeOff, Trophy, Scroll, Target, Zap, X, Users, BookOpen, Info, Sword, Hammer, Coins, Crown, VenetianMask } from 'lucide-react';

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
            // Emergency reset if both empty
            newDeck = shuffle([...EVENTS_DECK]);
            reshuffled = true;
        } else {
            newDeck = shuffle(newDiscard);
            newDiscard = [];
            reshuffled = true;
        }
    }
    
    const card = newDeck.pop();
    const finalCard = card || EVENTS_DECK[0]; // Fallback
    
    newDiscard.push(finalCard);
    
    return { card: finalCard, newDeck, newDiscard, reshuffled };
};

// --- HELPER: Initial Setup ---

const createInitialPlayers = (map: Record<string, HexData>, objectiveDeck: SecretObjective[]): Player[] => {
  const players: Player[] = [];
  
  // Find corner/edge positions for 4 players
  const allIds = Object.keys(map);
  const edgeIds = allIds.filter(id => {
     const neighbors = getNeighbors(map[id].q, map[id].r).filter(n => map[getHexId(n.q, n.r)]);
     return neighbors.length < 6;
  }).sort(() => Math.random() - 0.5).slice(0, 4);

  FACTIONS.forEach((faction, idx) => {
      const startHexId = edgeIds[idx];
      let startResources = { [Resource.Grain]: 2, [Resource.Stone]: 1, [Resource.Gold]: 1, [Resource.Relic]: 0 };

      // Setup starting tile & Grant Resources based on Terrain
      if (map[startHexId]) {
          const originalType = map[startHexId].type;
          
          // Resource Bonus based on Start Terrain
          if (originalType === TileType.Plains) startResources[Resource.Grain] += 2;
          else if (originalType === TileType.Mountains) startResources[Resource.Stone] += 2;
          else if (originalType === TileType.Goldmine) startResources[Resource.Gold] += 2;
          else if (originalType === TileType.RelicSite) { startResources[Resource.Gold]++; startResources[Resource.Stone]++; }
          else { startResources[Resource.Grain]++; startResources[Resource.Stone]++; } // Ruins or default

          // Convert to Capital
          map[startHexId].type = TileType.Capital; 
          map[startHexId].publicType = TileType.Capital; 
          map[startHexId].ownerId = idx; 
          map[startHexId].isRevealed = true; 
          map[startHexId].fortification = { ownerId: idx, level: 1 }; 
      }

      // Deal 1 Secret Objective (Grand Ambition)
      const secretObj = objectiveDeck.pop() || OBJECTIVES_DECK[0];

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
              extraActions: 0
          }
      });
  });
  return players;
};

// --- SCORING & INCOME LOGIC ---

const calculateScore = (player: Player, map: Record<string, HexData>, publicObjectives: SecretObjective[]): { total: number, breakdown: any, objSuccess: boolean } => {
    // 1. Tile VP
    // Iterate over map to ensure we only count tiles strictly owned by the player
    const ownedTiles = (Object.values(map) as HexData[]).filter(h => h.ownerId === player.id);
    let tileVp = 0;
    ownedTiles.forEach(t => {
        tileVp += VP_CONFIG[t.type] || 0;
    });

    // 2. Fortification VP
    // STRICT CHECK: Iterate over ALL map tiles to find active fortifications owned by this player.
    // This prevents sync issues where a player object might have stale stats.
    let fortVp = 0;
    (Object.values(map) as HexData[]).forEach(h => {
        if (h.fortification && h.fortification.ownerId === player.id) {
            fortVp += VP_CONFIG.Fortification;
        }
    });

    // 3. Relic VP
    const relicVp = player.resources[Resource.Relic] * VP_CONFIG.RelicToken;

    // 4. Secret Objective VP
    let objVp = 0;
    let objSuccess = false;
    player.secretObjectives.forEach(obj => {
        if (obj.condition(player, map)) {
            objVp += obj.vp;
            objSuccess = true;
        }
    });

    // 5. Public Objective VP
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
            
            // Auto-Income for Capital (Replaces Manual Choice)
            if (typeToCheck === TileType.Capital) {
                rates[Resource.Grain]++;
                rates[Resource.Stone]++;
                rates[Resource.Gold]++;
            } else {
                const config = TILE_CONFIG[typeToCheck];
                if (config && config.resource) {
                    rates[config.resource]++;
                }
            }
        }
    });
    
    // Add Relic Power: PASSIVE_INCOME
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
        if (p.isEliminated) return p; // Already eliminated, skip check.
        
        // A player is eliminated if they have 0 tiles AND are not the human player who might have a capital at the start
        const ownedTileCount = Object.values(map).filter(h => h.ownerId === p.id).length;
        if (ownedTileCount === 0) {
            eliminationLogs.push({
                id: `elim-${p.id}-${Date.now()}`,
                turn: round,
                text: `${p.name} has been eliminated from the game!`,
                type: 'combat',
                actorId: p.id
            });
            return { ...p, isEliminated: true, hasPassed: true }; // Mark as eliminated and passed
        }
        return p;
    });
    return { updatedPlayers, eliminationLogs };
};


interface ResolvingEvent {
  card: EventCard;
  type: 'CHOICE' | 'INFO';
  amount?: number; // For choice
  isRelicPowered: boolean;
  onComplete?: () => void;
}

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false); 
  
  const [gameState, setGameState] = useState<GameState>({
    phase: Phase.Income,
    round: 1,
    turnOrderIndex: 0,
    turnOrder: [0, 1, 2, 3],
    turnTrigger: 0,
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
    eventDeck: [],
    discardPile: [],
    objectiveDeck: [],
    publicObjectives: []
  });

  const [resolvingEvent, setResolvingEvent] = useState<ResolvingEvent | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);

  // Only scroll when logs length changes
  useEffect(() => {
      if (gameState.uiState.activeSidebarTab === 'LOG') {
          logEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
  }, [gameState.logs.length]);

  // --- INITIALIZATION ---
  const startGame = () => {
      const playerCount = 4; 
      const newMap = generateMap(playerCount); // Use dynamic map scaling
      const initialEventDeck = shuffle([...EVENTS_DECK]);
      const initialObjectiveDeck = shuffle([...OBJECTIVES_DECK]);
      const initialPlayers = createInitialPlayers(newMap, initialObjectiveDeck);
      
      setGameState({
          phase: Phase.Income,
          round: 1,
          turnOrderIndex: 0,
          turnOrder: [0, 1, 2, 3],
          turnTrigger: 0,
          players: initialPlayers,
          map: newMap,
          logs: [{ id: 'init', turn: 1, text: 'Eclipse 1 Begins. Secret Directives Assigned.', type: 'phase' }],
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
          eventDeck: initialEventDeck,
          discardPile: [],
          objectiveDeck: initialObjectiveDeck,
          publicObjectives: []
      });
      setGameStarted(true);
  };

  const handleSplashStart = () => {
      startGame();
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

  // --- STAT UPDATER ---
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
      const total = Object.values(player.resources).reduce((a,b) => a+b, 0);
      if (total > player.stats.maxResourcesHeld) {
          return { ...player, stats: { ...player.stats, maxResourcesHeld: total } };
      }
      return player;
  };

  // --- AI LOGIC LOOP ---
  useEffect(() => {
      if (!gameStarted) return;
      
      // Citizen Choice Phase AI
      if (gameState.phase === Phase.CitizenChoice) {
          const aiPlayers = gameState.players.filter(p => !p.isHuman && !p.isEliminated && p.selectedCitizen === null);
          if (aiPlayers.length > 0) {
              setGameState(prev => {
                  const newPlayers = prev.players.map(p => {
                      if (p.isHuman || p.isEliminated || p.selectedCitizen) return p;
                      let choice = CitizenType.Explorer;
                      if (p.resources[Resource.Grain] < 1) choice = CitizenType.Merchant;
                      else if (Math.random() > 0.6) choice = CitizenType.Builder;
                      else if (Math.random() > 0.5) choice = CitizenType.Warrior;
                      return { ...p, selectedCitizen: choice };
                  });
                  return { ...prev, players: newPlayers };
              });
          }
      }

      // Action Phase AI
      if (gameState.phase === Phase.Action) {
          const activeId = gameState.turnOrder[gameState.turnOrderIndex];
          const activePlayer = gameState.players[activeId];
          
          if (!activePlayer) return;

          // IMPORTANT: AI only acts if it's their turn, they haven't passed, and they aren't eliminated.
          if (!activePlayer.isHuman && !activePlayer.hasPassed && !activePlayer.isEliminated) {
              const timer = setTimeout(() => {
                  executeAiAction(activeId);
              }, 1500); 
              return () => clearTimeout(timer);
          }
      }
  }, [gameState.phase, gameState.turnTrigger, gameStarted]); // Changed dependency to turnTrigger

  // --- EVENT RESOLUTION HELPERS ---
  const applyEventToState = (currentState: GameState, card: EventCard, isRelicPowered: boolean, isGlobal: boolean = true): Partial<GameState> => {
      const players = currentState.players.map(p => ({ ...p, resources: { ...p.resources }, status: { ...p.status }, stats: {...p.stats} }));
      const map = { ...currentState.map };
      Object.keys(map).forEach(k => map[k] = { ...map[k] }); 

      let logs: LogEntry[] = [];
      const effect = isRelicPowered ? card.relicEffect : card.normalEffect;
      const text = isRelicPowered ? card.relicText : card.normalText;
      const activePid = currentState.turnOrder[currentState.turnOrderIndex] || 0;

      // Special Handling for Relic Power Granting (Permanent Powers)
      if (isRelicPowered && !isGlobal) {
          // Map Card to Power
          let power: RelicPowerType = 'PASSIVE_INCOME'; // Default fallback
          let powerName = "Crown of Prosperity";

          if (card.id === 'e3' || card.id === 'e1') { // Supply Drop, Resource Boom
              power = 'PASSIVE_INCOME';
              powerName = "Crown of Prosperity (Passive Income)";
          } else if (card.id === 'e4' || card.id === 'e99') { // Earthquake, Fog
              power = 'FREE_FORTIFY';
              powerName = "Mason's Hammer (Free Fortify)";
          } else if (card.id === 'e5' || card.id === 'e98') { // Sudden Reinforcements
               power = 'WARLORD';
               powerName = "Warlord's Banner (+1 Combat)";
          } else if (card.id === 'e8' || card.id === 'e9') { // Merchant Windfall, Forced March
               if (card.id === 'e9') {
                  power = 'DOUBLE_TIME';
                  powerName = "Legion's Stride (Double Action)";
               } else {
                  power = 'TRADE_BARON';
                  powerName = "Merchant's Seal (Free Trades)";
               }
          }

          // Apply Power (Overwrite old one)
          players[activePid].activeRelicPower = power;
          
          // Log specific message
          logs.push({ 
              id: `relic-power-${Date.now()}`, 
              turn: currentState.round, 
              text: `${players[activePid].name} claims the ${powerName}! (Replaces previous power)`, 
              type: 'event',
              details: { card: powerName } 
          });

          players[activePid] = updatePlayerStat(players[activePid], 'relicEventsTriggered', 1);

          // Return EARLY - Do NOT execute the one-time effect
          return { players, map, logs };
      }

      // --- STANDARD EVENT LOGIC (Global or Non-Powered) ---

      const prefix = isGlobal ? "GLOBAL EVENT" : `RELIC EVENT (${players[activePid].name})`;
      logs.push({ 
          id: `evt-${Date.now()}`, 
          turn: currentState.round, 
          text: `${prefix}: ${card.title} - ${text}`, 
          type: 'event',
          details: { card: text } 
      });

      if (isRelicPowered && !isGlobal) {
          players[activePid] = updatePlayerStat(players[activePid], 'relicEventsTriggered', 1);
      }

      // --- SPECIFIC LOGIC ---
      const targets = effect.target === 'SELF' ? [players[activePid]] 
                    : effect.target === 'ENEMY' ? players.filter(p => p.id !== activePid)
                    : effect.target === 'ALL' ? players
                    : players; // Default

      if (effect.type === 'RESOURCE_GAIN') {
        if (card.id === 'e1') { // Special handling for Resource Boom
            targets.forEach(p => {
                if (p.isHuman) {
                    // This is handled by the resolution modal, do nothing here.
                } else {
                    // AI gets a random split of resources.
                    p.resources[Resource.Grain] += Math.floor(effect.value / 2);
                    p.resources[Resource.Gold] += Math.ceil(effect.value / 2);
                    Object.assign(p, updateMaxResources(p));
                }
            });
        } else { // Handle all other resource gain events
            targets.forEach(p => {
                if (effect.target === Resource.Grain) {
                    p.resources[Resource.Grain] += effect.value;
                    if (card.id === 'e3') p.resources[Resource.Stone] += effect.value;
                } else { // Default for 'ALL' and 'SELF'
                    p.resources[Resource.Grain] += Math.floor(effect.value / 2);
                    p.resources[Resource.Gold] += Math.ceil(effect.value / 2);
                }
                Object.assign(p, updateMaxResources(p));
            });
        }
    }
      else if (effect.type === 'RESOURCE_LOSS') {
           // Sabotage
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
              players[activePid].status.extraActions = 1; // Grants 1 extra action (Total 2)
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

  // --- AI ACTIONS ---

  const executeAiAction = (playerId: number) => {
      setGameState(prev => {
          let newPlayers = prev.players.map(p => ({...p, resources: {...p.resources}, stats: {...p.stats}}));
          const newMap = { ...prev.map }; 
          Object.keys(newMap).forEach(k => newMap[k] = { ...newMap[k] }); 

          let ai = newPlayers[playerId];
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

          // 0. EMERGENCY MARKET (If broke and wants to fight/build)
          // Condition: Low Grain (<1), Has Excess Wealth (Stone/Gold >= 3)
          if (!actionTaken && ai.resources[Resource.Grain] < 1) {
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

          // 1. Unveil Relic (Priority)
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

              // Apply Power Logic Manually for AI
              let powerName = "";
              if (evt.id === 'e3' || evt.id === 'e1') {
                   ai.activeRelicPower = 'PASSIVE_INCOME'; powerName = "Crown of Prosperity";
              } else if (evt.id === 'e4' || evt.id === 'e99') {
                   ai.activeRelicPower = 'FREE_FORTIFY'; powerName = "Mason's Hammer";
              } else if (evt.id === 'e5' || evt.id === 'e98') {
                   ai.activeRelicPower = 'WARLORD'; powerName = "Warlord's Banner";
              } else if (evt.id === 'e8' || evt.id === 'e9') {
                   ai.activeRelicPower = 'TRADE_BARON'; powerName = "Merchant's Seal";
              }
              
              logText += ` - Equipped ${powerName}!`;
              actionTaken = true;
          }

          // 2. Trade if poor (Merchant or Desperate)
          else if (!actionTaken && (role === CitizenType.Merchant || ai.resources[Resource.Grain] > 4)) {
              // Trade Baron Check
              const freeTradeAvailable = ai.status.freeTrades > 0; 
              
              if (freeTradeAvailable) {
                   ai.status.freeTrades--;
                   ai.resources[Resource.Gold] += 1;
                   logText = `${ai.name} uses Merchant's Seal for free Gold.`;
                   actionTaken = true;
              } else if (ai.resources[Resource.Grain] >= 2) {
                  ai.resources[Resource.Grain] -= 2;
                  ai.resources[Resource.Gold] += 1;
                  logText = `${ai.name} trades 2 Grain for 1 Gold.`;
                  actionTaken = true;
              }
          } 

          // 3. Fortify (Builder Priority)
          else if (!actionTaken && role === CitizenType.Builder) {
              const myUnfortified = myTiles.filter(t => !t.fortification);
              // Builder Fatigue + Power Logic
              // Free if activeRelicPower === FREE_FORTIFY AND actionsTaken === 0
              const isFree = (ai.activeRelicPower === 'FREE_FORTIFY' && ai.actionsTaken === 0) || ai.status.freeFortify;
              const costStone = isFree ? 0 : 1;
              const costGold = isFree ? 0 : 1;

              if (myUnfortified.length > 0 && ai.resources[Resource.Stone] >= costStone && ai.resources[Resource.Gold] >= costGold) {
                   const target = myUnfortified[Math.floor(Math.random() * myUnfortified.length)];
                   ai.resources[Resource.Stone] -= costStone;
                   ai.resources[Resource.Gold] -= costGold;
                   newMap[target.id].fortification = { ownerId: ai.id, level: 1 };
                   logText = `${ai.name} fortifies [${getCoordString(newMap, target.id)}]${isFree ? " (Free - Relic)" : ""}.`;
                   actionTaken = true;
              }
          }

          // 4. Attack (Warrior)
          else if (!actionTaken && role === CitizenType.Warrior && ai.status.canAttack) {
              // Cost Check: Dynamic Fatigue
              const attackCost = ai.actionsTaken === 0 ? 1 : 2;

              if (ai.resources[Resource.Grain] >= attackCost) {
                  const enemyIds = allNeighbors.filter(id => {
                      const hex = newMap[id];
                      return hex.ownerId !== null && hex.ownerId !== ai.id;
                  });

                  if (enemyIds.length > 0) {
                      ai.resources[Resource.Grain] -= attackCost; // Pay cost

                      const targetIdHex = enemyIds[Math.floor(Math.random() * enemyIds.length)];
                      const targetHex = newMap[targetIdHex];
                      const defender = newPlayers[targetHex.ownerId!];
                      targetId = defender.id;
                      
                      ai.stats.attacksMade++;
                      if (!ai.stats.uniquePlayersAttacked.includes(defender.id)) ai.stats.uniquePlayersAttacked.push(defender.id);

                      const attSupport = getNeighbors(targetHex.q, targetHex.r).filter(n => newMap[getHexId(n.q, n.r)]?.ownerId === ai.id).length;
                      // Warlord Bonus Check
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

          // 5. Expand (Explorer) with Fatigue
          else if (!actionTaken && role === CitizenType.Explorer) {
               // Cost Calculation: Free then 2
               const costGrain = ai.actionsTaken === 0 ? 0 : 2;
               
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
                           newMap[target].ownerId = ai.id;
                           newMap[target].publicType = getBluff(newMap[target].type);
                           newMap[target].isRevealed = true; 
                           ai.stats.tilesRevealed++;
                           logText = `${ai.name} expands to [${getCoordString(newMap, target)}].`;
                           logDetails = { declaredType: newMap[target].publicType };
                           logType = 'bluff';
                           actionTaken = true;
                           if (costGrain > 0) {
                               ai.resources[Resource.Grain] -= costGrain;
                               logText += ` (Paid ${costGrain} Grain)`;
                           }

                           if (newMap[target].type === TileType.RelicSite) {
                               ai.resources[Resource.Relic]++;
                               ai.stats.relicSitesRevealed++;
                           }
                       }
                   }
               }
          }

          // PASS LOGIC
          if (!actionTaken) {
              logText = `${ai.name} passes.`;
              ai.hasPassed = true;
          } else {
              ai.actionsTaken++;
          }

          ai = updateMaxResources(ai); 
          newPlayers[playerId] = ai;

          const newLogEntry: LogEntry = {
              id: Date.now().toString(), 
              turn: prev.round, 
              text: logText, 
              type: logType,
              actorId: ai.id,
              targetId,
              details: logDetails
          };

          const newLogs = [...prev.logs, newLogEntry];
          const finalPlayersState = newPlayers;

          // --- ATOMIC TURN ADVANCEMENT (RACE CONDITION FIX) ---
          const activePlayers = finalPlayersState.filter(p => !p.isEliminated);
          const allPassed = activePlayers.every(p => p.hasPassed);
          let nextTurnOrderIndex = prev.turnOrderIndex;

          if (!allPassed) {
              let nextIndex = (prev.turnOrderIndex + 1) % prev.players.length;
              let attempts = 0;
              while ((finalPlayersState[prev.turnOrder[nextIndex]].hasPassed || finalPlayersState[prev.turnOrder[nextIndex]].isEliminated) && attempts < prev.players.length) {
                  nextIndex = (nextIndex + 1) % prev.players.length;
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
            turnTrigger: prev.turnTrigger + 1
          };
      });
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

        let nextIndex = (prev.turnOrderIndex + 1) % prev.players.length;
        
        let attempts = 0;
        
        while ((prev.players[prev.turnOrder[nextIndex]].hasPassed || prev.players[prev.turnOrder[nextIndex]].isEliminated) && attempts < prev.players.length) {
            nextIndex = (nextIndex + 1) % prev.players.length;
            attempts++;
        }

        return { ...prev, turnOrderIndex: nextIndex, turnTrigger: prev.turnTrigger + 1, uiState: { ...prev.uiState, isProcessing: false } };
    });
  };

  // Watch for Phase Change trigger from advanceTurn
  useEffect(() => {
      if (gameState.phase === Phase.Action) {
           const activePlayers = gameState.players.filter(p => !p.isEliminated);
           const allPassed = activePlayers.every(p => p.hasPassed);
           if (allPassed && activePlayers.length > 0) { // Ensure game doesn't hang if all are eliminated
               // Need to delay slightly to allow logs to render
               setTimeout(() => handlePhaseTransition(), 500);
           }
      }
  }, [gameState.turnTrigger, gameState.phase]); // Dependency is now turnTrigger to catch all turn updates


  // --- PHASE MANAGEMENT ---
  const advanceFromEventsPhase = () => {
    // This is called after an event is resolved (either by modal or timeout)
    // It triggers the transition from Events -> Scoring
    handlePhaseTransition();
  };


  const handlePhaseTransition = () => {
      setGameState(prev => {
          
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
          
          // If we are currently in the Events phase, calling this will advance to scoring.
          if (prev.phase === Phase.Events) {
              const { updatedPlayers: playersAfterElimination, eliminationLogs } = checkForElimination(prev.players, prev.map, prev.round);
              return { ...prev, phase: Phase.Scoring, players: playersAfterElimination, logs: [...prev.logs, ...eliminationLogs] };
          }

          let nextRound = prev.round;
          let newActiveEvent = null;
          let partialUpdate = { players: prev.players, map: prev.map };
          let nextTurnOrderIndex = 0;
          let nextTurnOrder = prev.turnOrder;
          let currentEventDeck = prev.eventDeck;
          let currentDiscardPile = prev.discardPile;
          let currentObjectiveDeck = prev.objectiveDeck;
          let newPublicObjectives = [...prev.publicObjectives];
          let logs = [...prev.logs];
          
          if (nextP === Phase.Income) nextRound++;
          
          // ELIMINATION & TURN ORDER LOGIC (CRITICAL ORDER OF OPERATIONS)
          if (nextP === Phase.Action) {
            const { updatedPlayers: playersAfterElimination, eliminationLogs } = checkForElimination(prev.players, prev.map, prev.round);
            logs.push(...eliminationLogs);
            partialUpdate.players = playersAfterElimination;

            const activePlayers = playersAfterElimination.filter(p => !p.isEliminated);
            if (activePlayers.length > 0) {
                const activePlayerIds = activePlayers.map(p => p.id).sort((a, b) => a - b);
                const shift = (nextRound - 1) % activePlayers.length;
                nextTurnOrder = [...activePlayerIds.slice(shift), ...activePlayerIds.slice(0, shift)];
                nextTurnOrderIndex = 0;
                
                const firstPlayerName = playersAfterElimination.find(p => p.id === nextTurnOrder[0])?.name || "Unknown";

                logs.push({ 
                    id: `init-${nextRound}`, 
                    turn: nextRound, 
                    text: `Turn Order updated. ${firstPlayerName} goes first.`, 
                    type: 'info' 
                });
            } else {
                nextTurnOrder = [];
                nextTurnOrderIndex = 0;
            }
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

          let newPlayers = partialUpdate.players.map(p => {
              const currentScore = calculateScore(p, partialUpdate.map, newPublicObjectives);
              return {
                  ...p,
                  vp: currentScore.total,
                  hasActed: false,
                  hasPassed: p.isEliminated ? true : false, // Eliminated players are always "passed"
                  actionsTaken: 0,
                  selectedCitizen: nextP === Phase.CitizenChoice ? null : p.selectedCitizen,
                  status: {
                      ...p.status,
                      canAttack: true,
                      combatBonus: 0,
                      fortificationBlocked: false,
                      freeTrades: 0,
                      freeFortify: false,
                      extraActions: 0
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

               newPlayers = newPlayers.map(p => {
                   if (p.isEliminated) return p; // No income for the dead

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
              newPlayers.forEach(p => {
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
              uiState: { ...prev.uiState } 
          };
      });
  };

  const handleEventResourceChoice = (res: Resource) => {
      if (!resolvingEvent || !resolvingEvent.amount) return;
      
      setGameState(prev => {
          const ps = prev.players.map(p => ({...p, resources: {...p.resources}}));
          ps[0].resources[res]++;
          const updatedP0 = updateMaxResources(ps[0]);
          ps[0] = updatedP0;

          const remaining = (resolvingEvent.amount || 1) - 1;
          
          const newLog: LogEntry = { 
              id: `choice-${Date.now()}`, 
              turn: prev.round, 
              text: `You chose 1 ${res} from Event.`, 
              type: 'info' 
          };
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

  const handleEventConfirm = () => {
      if (!resolvingEvent) return;

      setGameState(prev => {
           let partial: Partial<GameState> = {};
           if (resolvingEvent.isRelicPowered && resolvingEvent.type === 'INFO') {
              partial = applyEventToState(prev, resolvingEvent.card, true, false); // False = Not Global, it's Personal
           }
           
           const logs = [...(partial.logs || [])];
           return { ...prev, ...partial, players: partial.players || prev.players, logs: [...prev.logs, ...logs] };
      });

      const callback = resolvingEvent.onComplete;
      setResolvingEvent(null);
      if (callback) callback();
  };

  const handleCloseMarket = () => {
      setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isMarketOpen: false } }));
  }

  // --- HUMAN INPUT HANDLERS ---

  const handleSelectCitizen = (type: CitizenType) => {
      setGameState(prev => {
          const newPlayers = prev.players.map(p => p.id === 0 ? { ...p, selectedCitizen: type } : p);
          return { 
              ...prev, 
              players: newPlayers,
              uiState: {
                  ...prev.uiState,
                  isSelectingTile: false,
                  actionType: null,
                  selectedHexId: null,
                  isDeclaring: false,
                  pendingHexId: null
              }
          };
      });
  };

  const handleHumanAction = (action: string, payload?: any) => {
      const p = gameState.players[0];
      if (p.isEliminated) return; // Eliminated players cannot act.
      
      if (action === 'PASS') {
           setGameState(prev => {
               const newPlayers = prev.players.map(pl => pl.id === 0 ? { ...pl, hasPassed: true } : pl);
               const activePlayers = newPlayers.filter(p => !p.isEliminated);
               const allPassed = activePlayers.every(p => p.hasPassed);
               
               if (allPassed) {
                   return {
                       ...prev,
                       players: newPlayers,
                       logs: [...prev.logs, {id: Date.now().toString(), turn:prev.round, text: "You pass. All players passed. Events Phase beginning.", type:'phase', actorId: 0}],
                       turnTrigger: prev.turnTrigger + 1,
                       uiState: { ...prev.uiState, isProcessing: false }
                   };
               } else {
                   let nextIndex = (prev.turnOrderIndex + 1) % prev.players.length;
                   let attempts = 0;
                   while ((newPlayers[prev.turnOrder[nextIndex]].hasPassed || newPlayers[prev.turnOrder[nextIndex]].isEliminated) && attempts < prev.players.length) {
                       nextIndex = (nextIndex + 1) % prev.players.length;
                       attempts++;
                   }
                   
                   return { 
                       ...prev, 
                       players: newPlayers, 
                       turnOrderIndex: nextIndex,
                       turnTrigger: prev.turnTrigger + 1,
                       logs: [...prev.logs, {id: Date.now().toString(), turn:prev.round, text: "You pass for this Eclipse.", type:'info', actorId: 0}],
                       uiState: { ...prev.uiState, isProcessing: false }
                   };
               }
           });
           return;
      }
      
      if (action === 'TRADE_BANK') {
          const isFree = p.status.freeTrades > 0 || p.activeRelicPower === 'TRADE_BARON'; 
          if (p.status.freeTrades > 0 || p.resources[Resource.Grain] >= 2) {
               setGameState(prev => {
                   const currentP = prev.players[0];
                   let newRes = { ...currentP.resources };
                   let newStatus = { ...currentP.status };
                   const usedFree = currentP.status.freeTrades > 0;

                   if (usedFree) {
                       newStatus.freeTrades--;
                   } else {
                       newRes[Resource.Grain] -= 2;
                   }
                   newRes[Resource.Gold] += 1;
                   
                   const ps = prev.players.map(pl => pl.id === 0 ? { ...pl, resources: newRes, status: newStatus, actionsTaken: pl.actionsTaken + 1 } : pl);
                   const txt = usedFree ? "Used Free Trade: +1 Gold." : "Traded 2 Grain for 1 Gold.";

                   return { ...prev, players: ps, logs: [...prev.logs, {id: Date.now().toString(), turn:prev.round, text: txt, type:'info', actorId: 0}] };
               });
               advanceTurn();
          } else addLog("Need 2 Grain.", 'info');
          return;
      }

      if (action === 'OPEN_MARKET') {
          setGameState(prev => ({
              ...prev,
              uiState: { ...prev.uiState, isMarketOpen: true }
          }));
          return;
      }

      if (action === 'TRADE_MARKET') {
          const costRes = payload?.resource;
          
          if (costRes && p.resources[costRes] >= 3) {
              setGameState(prev => {
                   const currentP = prev.players[0];
                   let newRes = { ...currentP.resources };
                   newRes[costRes] -= 3;
                   newRes[Resource.Grain] += 1;
                   
                   const ps = prev.players.map(pl => pl.id === 0 ? { ...pl, resources: newRes, actionsTaken: pl.actionsTaken + 1 } : pl);
                   return { 
                       ...prev, 
                       players: ps, 
                       logs: [...prev.logs, {id: Date.now().toString(), turn:prev.round, text: `Emergency Market: 3 ${costRes} -> 1 Grain.`, type:'info', actorId: 0}],
                       uiState: { ...prev.uiState, isMarketOpen: false } // Close modal
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
                    if (nm[targetRuin.id]) {
                        nm[targetRuin.id] = { ...nm[targetRuin.id], type: TileType.Plains, publicType: TileType.Plains };
                    }
                    
                    const logs = [...prev.logs, { 
                        id: `ruin-collapse-${Date.now()}`, 
                        turn: prev.round, 
                        text: `The Ruins at [${getCoordString(nm, targetRuin.id)}] collapse after your search.`, 
                        type: 'info' as const 
                    }];
                    
                    if (reshuffled) {
                        logs.push({ id: `shuffle-${Date.now()}`, turn: prev.round, text: "Event Deck empty. Discard pile reshuffled.", type: 'info' });
                    }

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

      // Action Costs and Validity
      let valid = false;
      
      if (action === 'BUILD_FORTIFY') {
          // Relic Power Logic: Free only if actionsTaken === 0 (First action of the phase)
          const isRelicFree = p.activeRelicPower === 'FREE_FORTIFY' && p.actionsTaken === 0;
          const isFree = p.status.freeFortify || isRelicFree;
          
          if (isFree) {
              valid = true;
          } else {
              valid = p.resources[Resource.Stone] >= 1 && p.resources[Resource.Gold] >= 1;
              if (!valid) addLog("Need 1 Stone + 1 Gold.", 'info');
          }
      }
      else if (action === 'WARRIOR_ATTACK') {
          // COST FIX: Dynamic Fatigue
          const attackCost = p.actionsTaken === 0 ? 1 : 2;
          if (p.status.canAttack) {
              valid = p.resources[Resource.Grain] >= attackCost;
              if (!valid) addLog(`Commander, we need ${attackCost} Grain to supply the troops!`, 'info');
          }
      }
      else if (action === 'EXPLORE_CLAIM') {
          // Explorer Fatigue: First is free, subsequent cost is 2 Fixed
          const cost = p.actionsTaken === 0 ? 0 : 2;
          valid = p.resources[Resource.Grain] >= cost;
          if (!valid) addLog(`Fatigue: Next expansion costs ${cost} Grain.`, 'info');
      }
      else if (action === 'ACTIVATE_RELIC') valid = true;

      if (valid) {
          setGameState(prev => ({ 
              ...prev, 
              uiState: { 
                  ...prev.uiState,
                  isSelectingTile: true, 
                  actionType: action === 'ACTIVATE_RELIC' ? 'ACTIVATE' : (action === 'WARRIOR_ATTACK' ? 'ATTACK' : action.split('_')[1]) as any, 
                  selectedHexId: null,
                  isDeclaring: false,
                  pendingHexId: null
              } 
          }));
          const msg = action === 'ACTIVATE_RELIC' ? "Select a hidden Relic to unveil." : "Select a target tile.";
          addLog(msg, 'info');
      }
  };

  const handleHexClick = (hexId: string) => {
      // CLICK-SPAM PREVENTION
      if (gameState.uiState.isProcessing) return;

      const { isSelectingTile, actionType } = gameState.uiState;
      if (!isSelectingTile) return;

      const hex = gameState.map[hexId];
      const myTiles = (Object.values(gameState.map) as HexData[]).filter((h) => h.ownerId === 0);
      const isAdj = myTiles.some(h => isAdjacent(h, hex));
      
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

                  return { 
                      ...prev, 
                      players: ps, 
                      map: nm, 
                      logs,
                      eventDeck: newDeck,
                      discardPile: newDiscard,
                      uiState: { ...prev.uiState, isSelectingTile: false, actionType: null, selectedHexId: null } 
                  };
              });

              setResolvingEvent({
                  card: evt,
                  type: 'INFO', 
                  amount: 0, 
                  isRelicPowered: true,
                  onComplete: () => setTimeout(() => advanceTurn(), 100)
              });

          } else {
              addLog("That is not a hidden Relic site you control.", 'info');
          }
          return;
      }

      if ((actionType === 'CLAIM' || actionType === 'EXPLORE') && hex.ownerId === null && isAdj) {
           setGameState(prev => ({
               ...prev,
               uiState: {
                   ...prev.uiState,
                   isSelectingTile: false, 
                   isDeclaring: true,      
                   pendingHexId: hexId     
               }
           }));
           return; 
      }
      
      else if (actionType === 'FORTIFY' && hex.ownerId === 0 && !hex.fortification) {
           setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, isProcessing: true } }));

           setGameState(prev => {
               // Apply Cost
               const player = prev.players[0];
               const newRes = { ...player.resources };
               
               // Relic Fatigue Logic Check
               const isRelicFree = player.activeRelicPower === 'FREE_FORTIFY' && player.actionsTaken === 0;
               const isFree = player.status.freeFortify || isRelicFree;
               
               if (!isFree) {
                   newRes[Resource.Stone] -= 1;
                   newRes[Resource.Gold] -= 1;
               }

               const ps = prev.players.map(p => p.id === 0 ? {...p, resources: newRes, actionsTaken: p.actionsTaken + 1} : p);
               const nm = { ...prev.map };
               nm[hexId] = { ...nm[hexId], fortification: { ownerId: 0, level: 1 } };
               
               return { 
                   ...prev, 
                   players: ps, 
                   map: nm, 
                   logs: [...prev.logs, {id:Date.now().toString(), turn:prev.round, text:`Fortification Built at [${getCoordString(nm, hexId)}]${isFree ? " (Free)" : ""}.`, type:'info', actorId: 0}], 
                   uiState: { ...prev.uiState, isSelectingTile: false, actionType: null, selectedHexId: null, isDeclaring: false, pendingHexId: null } 
               };
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
               
               // COST DEDUCTION
               const attackCost = prev.players[0].actionsTaken === 0 ? 1 : 2;
               ps[0].resources[Resource.Grain] -= attackCost;
               ps[0] = updateMaxResources(ps[0]);

               ps[0] = updatePlayerStat(ps[0], 'attacksMade', 1);
               if (!ps[0].stats.uniquePlayersAttacked.includes(defender.id)) {
                   ps[0] = updatePlayerStat(ps[0], 'uniquePlayersAttacked', defender.id);
               }

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

               } else {
                   logMsg = `Defeat against ${defender.name} at [${getCoordString(nm, hexId)}].`;
                   ps[defender.id] = updatePlayerStat(ps[defender.id], 'battlesWon', 1);
               }

               return { 
                   ...prev, 
                   players: ps, 
                   map: nm, 
                   logs: [...prev.logs, {
                       id:Date.now().toString(), 
                       turn:prev.round, 
                       text:logMsg, 
                       type:logType, 
                       actorId: 0, 
                       targetId: defender.id,
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

      const trueType = gameState.map[pendingHexId].type;
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
          
          map[pendingHexId] = { 
              ...map[pendingHexId],
              ownerId: 0,
              isRevealed: true, 
              publicType: declaredType 
          };

          players[myPlayerIndex] = updatePlayerStat(players[myPlayerIndex], 'tilesRevealed', 1);
          
          const cost = players[myPlayerIndex].actionsTaken === 0 ? 0 : 2;
          if (cost > 0) {
              players[myPlayerIndex].resources[Resource.Grain] -= cost;
          }
          players[myPlayerIndex].actionsTaken++;

          let logMsg = `You claim tile [${getCoordString(map, pendingHexId)}] as ${TILE_CONFIG[declaredType].label}.`;
          
          // Only grant Relic resource and objective progress if declared truthfully.
          // Bluffing forgoes the immediate reward for the sake of secrecy.
          if (isRelicDiscovery) {
              players[myPlayerIndex].resources[Resource.Relic]++;
              players[myPlayerIndex] = updatePlayerStat(players[myPlayerIndex], 'relicSitesRevealed', 1);
          }

          logs.push({id:Date.now().toString(), turn:prev.round, text:logMsg, type:'bluff', actorId: 0, details: { declaredType } });
          
          if (reshuffled) logs.push({ id: `shuffle-${Date.now()}`, turn: prev.round, text: "Event Deck empty. Discard pile reshuffled.", type: 'info' });

          return { 
              ...prev, 
              players, 
              map, 
              logs, 
              eventDeck: newDeck,
              discardPile: newDiscard,
              uiState: { ...prev.uiState, isSelectingTile: false, actionType: null, selectedHexId: null, isDeclaring: false, pendingHexId: null } 
          };
      });

      if (isRelicDiscovery && evt) {
           setResolvingEvent({
              card: evt,
              type: 'INFO', 
              amount: 0, 
              isRelicPowered: true,
              onComplete: () => setTimeout(() => advanceTurn(), 100)
           });
      } else {
           setTimeout(() => advanceTurn(), 100);
      }
  }

  const humanPlayer = gameState.players[0];
  const isHumanEliminated = humanPlayer?.isEliminated;
  const realIncome = humanPlayer ? getIncomeRate(humanPlayer, gameState.map, false) : null;
  const publicIncome = humanPlayer ? getIncomeRate(humanPlayer, gameState.map, true) : null;

  const SidebarContent = () => (
       <div className="h-full flex flex-col bg-[#0f172a] border-l border-slate-700">
           {/* Sidebar Tabs */}
           <div className="flex border-b border-slate-700 shrink-0">
                  <button 
                      onClick={() => setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, activeSidebarTab: 'LOG' } }))}
                      className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${gameState.uiState.activeSidebarTab === 'LOG' ? 'bg-[#1e293b] text-[#fcd34d] border-b-2 border-[#fcd34d]' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                      <BookOpen size={14}/> Log
                  </button>
                  <button 
                      onClick={() => setGameState(prev => ({ ...prev, uiState: { ...prev.uiState, activeSidebarTab: 'RIVALS' } }))}
                      className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${gameState.uiState.activeSidebarTab === 'RIVALS' ? 'bg-[#1e293b] text-[#fcd34d] border-b-2 border-[#fcd34d]' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                      <Eye size={14}/> Intel
                  </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto p-0 bg-[#0f172a] custom-scrollbar">
                  {gameState.uiState.activeSidebarTab === 'LOG' ? (
                      <div className="p-3 space-y-2">
                          {gameState.logs.map(log => {
                               const actor = log.actorId !== undefined ? gameState.players[log.actorId] : null;
                               
                               return (
                                   <div key={log.id} className={`text-xs p-3 rounded border-l-2 transition-all animate-in fade-in slide-in-from-left-2 ${
                                       log.type === 'combat' ? 'border-red-500 bg-red-900/10' :
                                       log.type === 'bluff' ? 'border-purple-500 bg-purple-900/10' :
                                       log.type === 'event' ? 'border-blue-500 bg-blue-900/10' :
                                       log.type === 'phase' ? 'border-[#fcd34d] bg-yellow-900/10 text-[#fcd34d] font-bold text-center py-2' :
                                       'border-slate-600 bg-slate-800/30 text-slate-400'
                                   }`}>
                                       {log.type === 'phase' ? (
                                           log.text
                                       ) : (
                                           <>
                                               <div className="flex items-center gap-2 mb-1">
                                                   {actor && <span className="font-bold" style={{ color: actor.faction.color }}>{actor.name}</span>}
                                                   {!actor && <span className="font-bold text-slate-400">System</span>}
                                                   <span className="ml-auto opacity-50 text-[10px]">R{log.turn}</span>
                                               </div>
                                               <div className="text-slate-200 mb-1 leading-relaxed">{log.text}</div>
                                               
                                               {/* Dice Details */}
                                               {log.details?.dice && (
                                                   <div className="mt-2 p-1.5 bg-black/40 rounded flex justify-between items-center text-[11px] font-mono text-slate-300">
                                                       <div className="flex items-center gap-1">
                                                            <Sword size={12} className="text-slate-400"/>
                                                            <span className="text-white font-bold">{log.details.dice.att + log.details.dice.attRoll}</span>
                                                            <span className="text-slate-500">({log.details.dice.att}+{log.details.dice.attRoll})</span>
                                                       </div>
                                                       <span className="text-slate-600">vs</span>
                                                       <div className="flex items-center gap-1">
                                                            <span className="text-white font-bold">{log.details.dice.def + log.details.dice.defRoll}</span>
                                                            <span className="text-slate-500">({log.details.dice.def}+{log.details.dice.defRoll})</span>
                                                            <Hammer size={12} className="text-slate-400"/>
                                                       </div>
                                                   </div>
                                               )}

                                               {/* Bluff Details */}
                                               {log.details?.declaredType && (
                                                   <div className="mt-1 flex items-center gap-1 text-[10px]">
                                                       <VenetianMask size={10} className="text-purple-400" />
                                                       <span className="text-purple-300">Declared: {TILE_CONFIG[log.details.declaredType].label}</span>
                                                   </div>
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
                          {/* Active Objectives ALWAYS Visible Here */}
                          {humanPlayer && (
                              <div className="bg-slate-800 border border-[#ca8a04]/30 rounded p-3 mb-4">
                                  <div className="text-[10px] text-[#fcd34d] uppercase tracking-widest mb-2 flex items-center gap-2">
                                      <Target size={12} /> Secret Directives ({humanPlayer.secretObjectives.length})
                                  </div>
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
                          
                          {/* PUBLIC OBJECTIVES DISPLAY */}
                          <div className="bg-slate-800 border border-blue-500/30 rounded p-3 mb-4">
                              <div className="text-[10px] text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <Crown size={12} /> Public Imperatives
                              </div>
                              {gameState.publicObjectives.length === 0 ? (
                                  <div className="text-xs text-slate-500 italic">No public edicts revealed yet...</div>
                              ) : (
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

                          <p className="text-[10px] text-slate-500 uppercase tracking-widest text-center mb-2">Known Rival Intelligence</p>
                          {gameState.players.filter(p => !p.isHuman).map(rival => {
                              const rivalScore = calculateScore(rival, gameState.map, gameState.publicObjectives);
                              const rivalPublicIncome = getIncomeRate(rival, gameState.map, true);

                              return (
                                  <div key={rival.id} className="bg-slate-900 border border-slate-700 rounded p-3">
                                      <div className="flex justify-between items-center mb-2">
                                          <span className="font-bold text-sm" style={{ color: rival.faction.color }}>{rival.name}</span>
                                          <span className={`text-xs px-2 py-1 rounded ${rival.isEliminated ? 'bg-red-900 text-red-300' : 'bg-slate-800 text-slate-400'}`}>{rival.isEliminated ? 'ELIMINATED' : `${rivalScore.total} VP`}</span>
                                      </div>
                                      {!rival.isEliminated && (
                                        <div className="space-y-1">
                                            <div className="text-[10px] text-slate-500 uppercase">Public Production</div>
                                            <div className="flex gap-2 text-xs font-mono">
                                                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>+{rivalPublicIncome[Resource.Grain]}</div>
                                                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>+{rivalPublicIncome[Resource.Stone]}</div>
                                                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>+{rivalPublicIncome[Resource.Gold]}</div>
                                            </div>
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

  if (showSplash) {
      return <SplashScreen onStart={handleSplashStart} />;
  }

  if (gameState.phase === Phase.EndGame) {
    const rankedPlayers = gameState.players.map(p => {
        // Calculate Score strictly from current map state
        const scoreData = calculateScore(p, gameState.map, gameState.publicObjectives);
        
        // Calculate Bluff Count: Active tiles owned by player where type != publicType
        const bluffCount = (Object.values(gameState.map) as HexData[]).filter(h => 
            h.ownerId === p.id && h.type !== h.publicType
        ).length;

        return {
          ...p,
          scoreData,
          bluffCount
        };
    }).sort((a,b) => b.scoreData.total - a.scoreData.total);
    
    const winner = rankedPlayers[0];
    const isWinner = winner?.id === 0;

    return (
        <div className="h-screen w-full bg-[#0b0a14] text-[#e2d9c5] font-sans flex overflow-hidden relative">
            <div className="flex-1 relative bg-black border-r border-[#ca8a04]/30">
                <HexGrid map={gameState.map} players={gameState.players} humanPlayerId={0} onHexClick={()=>{}} onHexHover={()=>{}} uiState={gameState.uiState} revealAll={true} />
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
                                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider">
                                            <span className="text-purple-400">Bluffs: {p.bluffCount}</span>
                                        </div>
                                     </div>
                                     <div className="text-3xl font-bold text-white">{p.scoreData.total} VP</div>
                                 </div>
                                 {/* Breakdown */}
                                 <div className="mt-2 text-[10px] text-slate-400 flex justify-between px-2 pt-2 border-t border-slate-700/50">
                                    <span>Tiles: {p.scoreData.breakdown.tileVp}</span>
                                    <span>Forts: {p.scoreData.breakdown.fortVp}</span>
                                    <span>Relics: {p.scoreData.breakdown.relicVp}</span>
                                    <span>Objectives: {p.scoreData.breakdown.totalObjVp}</span>
                                 </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-8 border-t border-slate-700 pt-4">
                        <h3 className="text-center text-blue-400 font-bold uppercase text-xs tracking-widest mb-2">Public Imperatives Scored</h3>
                        {gameState.publicObjectives.map((obj, i) => (
                            <div key={i} className="text-xs text-center text-slate-400 mb-1">
                                {obj.name} ({obj.vp} VP)
                            </div>
                        ))}
                    </div>

                </div>
                <div className="p-6 bg-[#0f172a] border-t border-slate-700 text-center shrink-0">
                    <button onClick={startGame} className="w-full px-8 py-4 bg-[#ca8a04] text-black font-bold text-lg rounded hover:bg-[#eab308]">Play Again</button>
                </div>
            </div>
        </div>
      );
  }

  const isMyTurn = gameState.phase === Phase.Action && gameState.turnOrder[gameState.turnOrderIndex] === 0 && !isHumanEliminated;
  const isActionPhaseDone = gameState.phase === Phase.Events;
  const activeId = gameState.turnOrder[gameState.turnOrderIndex];
  const activePlayerName = gameState.players[activeId]?.name;

  return (
    <div className="h-screen bg-[#0b0a14] text-[#e2d9c5] font-sans flex flex-col overflow-hidden relative">
      <header className="bg-[#0f172a] border-b border-[#ca8a04]/30 px-2 md:px-4 py-2 flex justify-between items-center shadow-md z-20 shrink-0 select-none relative">
          <div className="flex items-center gap-2 md:gap-4">
              <div className="flex flex-col leading-none">
                  <span className="font-bold text-[#fcd34d] tracking-widest text-base md:text-lg font-title">ECLIPSE II</span>
                  <div className="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-wide flex items-center">
                    <span>R{gameState.round}/{TOTAL_ROUNDS} • {gameState.phase}</span>
                    {gameState.phase === Phase.Action && activePlayerName && (
                        <span className="text-white font-semibold ml-2 pl-2 border-l border-slate-600"> {activePlayerName}'s Turn</span>
                    )}
                  </div>
              </div>
              <div className="flex gap-1 md:gap-2">
                <button onClick={() => setShowHelpModal(true)} className="flex items-center gap-2 px-2 md:px-3 py-1 bg-slate-800 border border-slate-600 rounded hover:bg-slate-700 transition-colors text-slate-300 text-xs font-bold uppercase"><Info size={14}/> Help</button>
                <button onClick={() => setShowLogModal(true)} className="md:hidden flex items-center gap-2 px-2 py-1 bg-slate-800 border border-slate-600 rounded hover:bg-slate-700 transition-colors text-slate-300 text-xs font-bold uppercase"><BookOpen size={14}/></button>
              </div>
          </div>
          
          <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2">
            {gameState.phase === Phase.Action && (
                <TurnOrderTracker 
                    players={gameState.players} 
                    turnOrder={gameState.turnOrder} 
                    turnOrderIndex={gameState.turnOrderIndex} 
                />
            )}
          </div>

          <div className="hidden md:flex gap-6 text-sm font-mono">
              {realIncome && publicIncome && Object.entries(gameState.players[0].resources).map(([res, val]) => {
                  const rKey = res as Resource;
                  const rIncome = realIncome[rKey];
                  return (
                      <div key={res} className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${res === 'Grain' ? 'bg-yellow-500' : res === 'Stone' ? 'bg-slate-400' : res === 'Gold' ? 'bg-amber-400' : 'bg-emerald-500'}`}></div>
                          <div className="flex flex-col items-end leading-none">
                              <span className="text-white font-bold">{val}</span>
                              <span className={`text-[10px] ${rIncome > 0 ? 'text-green-400' : 'text-slate-600'}`}>+{rIncome}</span>
                          </div>
                      </div>
                  );
              })}
              <div className="border-l border-slate-700 pl-4 flex items-center gap-2">
                  <Trophy size={16} className="text-purple-400"/>
                  <span className="text-white font-bold">{gameState.players[0].vp}</span>
              </div>
          </div>
      </header>

      {/* Mobile Resources Bar */}
      <div className="md:hidden bg-[#0f172a] border-b border-slate-800 p-1.5 flex justify-around text-xs font-mono shrink-0 z-10">
          {realIncome && Object.entries(gameState.players[0].resources).map(([res, val]) => {
              const rKey = res as Resource;
              const rIncome = realIncome[rKey];
              return (
                  <div key={res} className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${res === 'Grain' ? 'bg-yellow-500' : res === 'Stone' ? 'bg-slate-400' : res === 'Gold' ? 'bg-amber-400' : 'bg-emerald-500'}`}></div>
                      <span className="text-white font-bold">{val}</span>
                      <span className={`text-[9px] ${rIncome > 0 ? 'text-green-400' : 'text-slate-600'}`}>+{rIncome}</span>
                  </div>
              );
          })}
      </div>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          <div className="flex-1 relative bg-[#050505] flex items-center justify-center overflow-hidden">
              <HexGrid map={gameState.map} players={gameState.players} humanPlayerId={0} onHexClick={handleHexClick} onHexHover={() => {}} uiState={gameState.uiState} />
              {gameState.uiState.isSelectingTile && (
                  <div className="absolute top-4 md:top-8 bg-black/80 backdrop-blur px-4 md:px-6 py-2 rounded-full border border-white/20 text-white animate-pulse z-30 pointer-events-none shadow-lg text-center text-xs md:text-sm mx-4">
                      {gameState.uiState.actionType === 'ACTIVATE' ? <span>Select a <span className="font-bold text-emerald-400">Hidden Relic</span></span> : <span>Select Target for <span className="font-bold text-[#fcd34d]">{gameState.uiState.actionType}</span></span>}
                  </div>
              )}
          </div>
          <div className="hidden md:block w-80 shrink-0 relative z-10">
              <SidebarContent />
          </div>
          {showLogModal && (
              <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center md:hidden">
                  <div className="bg-[#0f172a] w-full h-[60vh] rounded-t-2xl border-t border-[#ca8a04] flex flex-col overflow-hidden animate-in slide-in-from-bottom">
                      <div className="flex justify-between items-center p-4 border-b border-slate-700">
                          <h3 className="font-title text-[#fcd34d]">Intel & Log</h3>
                          <button onClick={() => setShowLogModal(false)}><X size={20}/></button>
                      </div>
                      <div className="flex-1 overflow-hidden relative">
                          <SidebarContent />
                      </div>
                  </div>
              </div>
          )}
          <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
          <MarketModal 
                isOpen={gameState.uiState.isMarketOpen} 
                onClose={handleCloseMarket} 
                onConfirm={(resource) => handleHumanAction('TRADE_MARKET', { resource })}
                playerResources={humanPlayer ? humanPlayer.resources : { Grain: 0, Stone: 0, Gold: 0, Relic: 0 }}
          />
          {gameState.uiState.isDeclaring && gameState.uiState.pendingHexId && (
              <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-[#1e293b] border border-[#fcd34d] shadow-2xl p-6 rounded-lg max-w-lg w-full transform transition-all animate-pop">
                       <h2 className="text-2xl font-title text-[#fcd34d] mb-2 flex items-center gap-2"><Eye size={24}/> Scout Report</h2>
                       <div className="bg-slate-900/50 p-4 rounded mb-6 text-center border border-slate-700">
                           <p className="text-slate-400 text-sm uppercase mb-1">True Tile Nature</p>
                           <div className="text-3xl font-bold text-white mb-2" style={{ color: TILE_CONFIG[gameState.map[gameState.uiState.pendingHexId].type].color }}>{TILE_CONFIG[gameState.map[gameState.uiState.pendingHexId].type].label}</div>
                           <p className="text-xs text-slate-500">Only you know this truth. What will you tell the world?</p>
                       </div>
                       <h3 className="text-white font-bold mb-4 border-b border-slate-700 pb-2">Broadcast Claim:</h3>
                       <div className="grid grid-cols-2 gap-3">
                           {[TileType.Plains, TileType.Mountains, TileType.Goldmine, TileType.RelicSite].map((type) => {
                               const isTruth = type === gameState.map[gameState.uiState.pendingHexId!].type;
                               const config = TILE_CONFIG[type];
                               return (
                                   <button key={type} onClick={() => handleDeclarationFixed(type)} className={`p-3 rounded border text-left transition-all flex items-center justify-between group ${isTruth ? 'border-green-500/50 hover:bg-green-900/20' : 'border-purple-500/50 hover:bg-purple-900/20'} hover:scale-[1.02] active:scale-95`}>
                                       <div><span className="block font-bold" style={{ color: config.color }}>{config.label}</span><span className="text-xs text-slate-400">{isTruth ? '(Truth)' : '(Bluff)'}</span></div>
                                       {isTruth ? <Eye size={16} className="text-green-500"/> : <EyeOff size={16} className="text-purple-500 opacity-0 group-hover:opacity-100"/>}
                                   </button>
                               )
                           })}
                       </div>
                  </div>
              </div>
          )}
          {resolvingEvent && (
              <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
                  <div className="text-center max-w-lg w-full bg-[#1e293b] p-6 rounded-lg border border-blue-500 shadow-2xl">
                       <div className="flex justify-between items-start mb-4">
                           <div className="flex flex-col items-start">
                                <h2 className="text-2xl md:text-3xl font-title text-blue-400 mb-1">{resolvingEvent.card.title}</h2>
                                {resolvingEvent.isRelicPowered && <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold uppercase border border-emerald-500/30 bg-emerald-900/20 px-2 py-0.5 rounded"><Zap size={12}/> Personal Relic Event</div>}
                                {!resolvingEvent.isRelicPowered && <div className="flex items-center gap-1 text-blue-400 text-xs font-bold uppercase border border-blue-500/30 bg-blue-900/20 px-2 py-0.5 rounded">Global Event</div>}
                           </div>
                       </div>
                       <div className="bg-black/30 p-4 rounded border border-slate-700 mb-6 text-left">
                            {resolvingEvent.isRelicPowered ? <p className="text-emerald-100 italic">"You feel a surge of power... A new permanent ability has been unlocked for your empire!"</p> : <p className="text-slate-200">"{resolvingEvent.card.normalText}"</p>}
                       </div>
                       {resolvingEvent.type === 'CHOICE' ? (
                           <div>
                               <p className="text-white text-lg mb-6">Choose <b>{resolvingEvent.amount}</b> more resource{resolvingEvent.amount! > 1 ? 's' : ''}.</p>
                               <div className="flex gap-4 justify-center">
                                   <button onClick={()=>handleEventResourceChoice(Resource.Grain)} className="w-20 p-3 bg-yellow-900/40 border border-yellow-500 rounded hover:bg-yellow-900/80 flex flex-col items-center gap-2 transition-transform hover:-translate-y-1"><div className="w-6 h-6 rounded-full bg-yellow-500 shadow-[0_0_15px_#eab308]"></div><span className="font-bold text-yellow-100 text-xs">Grain</span></button>
                                   <button onClick={()=>handleEventResourceChoice(Resource.Stone)} className="w-20 p-3 bg-slate-800/40 border border-slate-400 rounded hover:bg-slate-700/80 flex flex-col items-center gap-2 transition-transform hover:-translate-y-1"><div className="w-6 h-6 rounded-full bg-slate-400 shadow-[0_0_15px_#94a3b8]"></div><span className="font-bold text-slate-100 text-xs">Stone</span></button>
                                   <button onClick={()=>handleEventResourceChoice(Resource.Gold)} className="w-20 p-3 bg-amber-900/40 border border-amber-500 rounded hover:bg-amber-900/80 flex flex-col items-center gap-2 transition-transform hover:-translate-y-1"><div className="w-6 h-6 rounded-full bg-amber-400 shadow-[0_0_15px_#f59e0b]"></div><span className="font-bold text-amber-100 text-xs">Gold</span></button>
                               </div>
                           </div>
                       ) : <button onClick={handleEventConfirm} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded uppercase tracking-widest transition-all">{resolvingEvent.isRelicPowered ? "Claim Power" : "Collect & Proceed"}</button>}
                  </div>
              </div>
          )}
      </main>
      <div className="shrink-0">
          <ActionPanel 
            phase={gameState.phase} 
            player={gameState.players[0]} 
            isMyTurn={isMyTurn} 
            activePlayerName={activePlayerName} 
            onSelectCitizen={handleSelectCitizen} 
            onAction={handleHumanAction} 
            onEndPhase={handlePhaseTransition} 
            map={gameState.map} 
            isActionPhaseDone={isActionPhaseDone}
            isEliminated={isHumanEliminated}
          />
      </div>
    </div>
  );
};

export default App;