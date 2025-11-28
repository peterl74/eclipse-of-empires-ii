
import { GameState, Player, Phase, TileType, Resource, CitizenType, HexData, SecretObjective } from '../types';
import { generateMap, getNeighbors, getHexId } from './hexUtils';
import { FACTIONS, VP_CONFIG, TOTAL_ROUNDS, OBJECTIVES_DECK, EVENTS_DECK, TILE_CONFIG } from '../constants';

interface SimResult {
  winnerId: number;
  winnerFaction: string;
  roundWon: number;
  scores: Record<number, number>;
  resources: Record<number, number>;
}

const createSimPlayers = (map: Record<string, HexData>, playerCount: number): Player[] => {
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
             const t = map[startHexId].type;
             if (t === TileType.Plains) startResources[Resource.Grain] += 2;
             else if (t === TileType.Mountains) startResources[Resource.Stone] += 2;
             else if (t === TileType.Goldmine) startResources[Resource.Gold] += 2;
             else { startResources[Resource.Grain]++; startResources[Resource.Stone]++; }
             
             map[startHexId].ownerId = idx;
             map[startHexId].type = TileType.Capital;
             map[startHexId].fortification = { ownerId: idx, level: 1 };
        }

        players.push({
            id: idx,
            name: faction.name,
            faction,
            isHuman: false,
            resources: startResources,
            activeRelicPower: null,
            selectedCitizen: null,
            vp: 0,
            secretObjectives: [],
            eventHand: [],
            hasActed: false,
            hasPassed: false,
            actionsTaken: 0,
            isEliminated: false,
            stats: { battlesWon: 0, tilesRevealed: 0, relicEventsTriggered: 0, maxResourcesHeld: 0, tilesLost: 0, attacksMade: 0, uniquePlayersAttacked: [], relicSitesRevealed: 0 },
            status: { canAttack: true, combatBonus: 0, fortificationBlocked: false, incomeMultiplier: 1, freeTrades: 0, passiveIncome: false, freeFortify: false, extraActions: 0 }
        });
    });
    return players;
};

const calcSimScore = (p: Player, map: Record<string, HexData>): number => {
    const owned = Object.values(map).filter(h => h.ownerId === p.id);
    let score = owned.reduce((sum, h) => sum + (VP_CONFIG[h.type] || 0), 0);
    score += Object.values(map).filter(h => h.fortification?.ownerId === p.id).length * VP_CONFIG.Fortification;
    score += p.resources[Resource.Relic] * VP_CONFIG.RelicToken;
    return score;
};

export const runSimulationGame = (playerCount: number): SimResult => {
    let map = generateMap(playerCount);
    let players = createSimPlayers(map, playerCount);
    let round = 1;

    while (round <= TOTAL_ROUNDS) {
        players.forEach(p => {
             const tiles = Object.values(map).filter(h => h.ownerId === p.id).length;
             if (tiles === 0) p.isEliminated = true;
        });
        
        // INCOME WITH FORTIFIED INDUSTRY
        players.filter(p => !p.isEliminated).forEach(p => {
             Object.values(map).forEach(h => {
                 if (h.ownerId === p.id) {
                     const bonus = h.fortification ? 1 : 0; // FORTIFIED INDUSTRY
                     if (h.type === TileType.Capital) { 
                         p.resources.Grain += (1 + bonus); 
                         p.resources.Stone += (1 + bonus); 
                         p.resources.Gold += (1 + bonus); 
                     } else if (TILE_CONFIG[h.type].resource) {
                         p.resources[TILE_CONFIG[h.type].resource!] += (1 + bonus);
                     }
                 }
             });
             if (p.activeRelicPower === 'PASSIVE_INCOME') { p.resources[Resource.Grain]++; p.resources[Resource.Gold]++; }
        });

        players.filter(p => !p.isEliminated).forEach(p => {
             if (p.resources[Resource.Grain] < 2) p.selectedCitizen = CitizenType.Merchant;
             else if (Math.random() > 0.5) p.selectedCitizen = CitizenType.Warrior;
             else p.selectedCitizen = CitizenType.Builder;
        });

        let allPassed = false;
        while (!allPassed) {
             let actedThisCycle = false;
             players.filter(p => !p.isEliminated && !p.hasPassed).forEach(ai => {
                  let actionTaken = false;
                  const myTiles = Object.values(map).filter(h => h.ownerId === ai.id);
                  const neighbors = myTiles.flatMap(h => getNeighbors(h.q, h.r)).map(n => getHexId(n.q, n.r));
                  
                  if (ai.resources[Resource.Grain] === 0) {
                      if (ai.resources[Resource.Gold] >= 3) { ai.resources[Resource.Gold] -= 3; ai.resources[Resource.Grain]++; actionTaken = true; }
                      else if (ai.resources[Resource.Stone] >= 3) { ai.resources[Resource.Stone] -= 3; ai.resources[Resource.Grain]++; actionTaken = true; }
                  }

                  if (!actionTaken && ai.selectedCitizen === CitizenType.Warrior) {
                       const enemies = neighbors.filter(id => map[id] && map[id].ownerId !== null && map[id].ownerId !== ai.id);
                       const cost = ai.actionsTaken === 0 ? 1 : 2;
                       if (enemies.length > 0 && ai.resources[Resource.Grain] >= cost) {
                           const target = enemies[0];
                           ai.resources[Resource.Grain] -= cost;
                           if (Math.random() > 0.4) {
                               const victimId = map[target].ownerId!;
                               map[target].ownerId = ai.id;
                               map[target].fortification = null;
                               
                               // PILLAGE MECHANIC
                               const victim = players[victimId];
                               if (victim && !victim.isEliminated) {
                                   const stealable = ([Resource.Grain, Resource.Stone, Resource.Gold] as Resource[]).filter(r => victim.resources[r] > 0);
                                   if (stealable.length > 0) {
                                       const loot = stealable[Math.floor(Math.random() * stealable.length)];
                                       victim.resources[loot]--;
                                       ai.resources[loot]++;
                                   }
                               }
                           }
                           actionTaken = true;
                       }
                  } else if (!actionTaken && ai.selectedCitizen === CitizenType.Builder) {
                       if (ai.resources[Resource.Stone] >= 2) {
                           const unfortified = myTiles.find(t => !t.fortification);
                           if (unfortified) {
                               ai.resources[Resource.Stone] -= 2;
                               unfortified.fortification = { ownerId: ai.id, level: 1 };
                               actionTaken = true;
                           }
                       }
                  }

                  if (!actionTaken && ai.resources[Resource.Grain] >= 1) {
                       const neutral = neighbors.filter(id => map[id] && map[id].ownerId === null);
                       if (neutral.length > 0) {
                           const target = neutral[0];
                           ai.resources[Resource.Grain]--; 
                           map[target].ownerId = ai.id;
                           actionTaken = true;
                       }
                  }

                  if (actionTaken) {
                      ai.actionsTaken++;
                      actedThisCycle = true;
                  } else {
                      ai.hasPassed = true;
                  }
             });
             
             if (!actedThisCycle) allPassed = true;
        }

        players.forEach(p => { p.hasPassed = false; p.actionsTaken = 0; p.selectedCitizen = null; });
        round++;
    }

    const scores: Record<number, number> = {};
    const resources: Record<number, number> = {};
    players.forEach(p => {
        scores[p.id] = calcSimScore(p, map);
        resources[p.id] = p.resources[Resource.Grain] + p.resources[Resource.Stone] + p.resources[Resource.Gold];
    });

    const winner = players.reduce((prev, current) => (calcSimScore(current, map) > calcSimScore(prev, map) ? current : prev));

    return {
        winnerId: winner.id,
        winnerFaction: winner.faction.name,
        roundWon: round,
        scores,
        resources
    };
};
