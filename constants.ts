
import { Resource, TileType, FactionInfo, EventCard, SecretObjective, CitizenType, HexData } from './types';
import { hasStraightLineOfThree } from './utils/hexUtils';

export const HEX_SIZE = 35;
export const TOTAL_ROUNDS = 5;

// Scoring Config
export const VP_CONFIG = {
  [TileType.Plains]: 0,
  [TileType.Mountains]: 0,
  [TileType.Goldmine]: 1,
  [TileType.RelicSite]: 2,
  [TileType.Ruins]: 2,
  [TileType.Capital]: 1,
  Fortification: 1,
  RelicToken: 1,
};

export const TILE_COUNTS = {
  [TileType.Plains]: 9, 
  [TileType.Mountains]: 6,
  [TileType.Goldmine]: 4,
  [TileType.RelicSite]: 3,
  [TileType.Ruins]: 3,
  [TileType.Capital]: 0 // Capitals are placed manually at start
};

export const TILE_CONFIG: Record<TileType, { color: string; label: string; iconColor: string; resource?: Resource }> = {
  [TileType.Plains]: { color: '#d97706', label: 'Plains', iconColor: '#fcd34d', resource: Resource.Grain }, 
  [TileType.Mountains]: { color: '#475569', label: 'Mountains', iconColor: '#94a3b8', resource: Resource.Stone }, 
  [TileType.Goldmine]: { color: '#b45309', label: 'Goldmine', iconColor: '#fcd34d', resource: Resource.Gold },
  [TileType.RelicSite]: { color: '#064e3b', label: 'Relic Site', iconColor: '#34d399', resource: Resource.Relic },
  [TileType.Ruins]: { color: '#4c1d95', label: 'Ruins', iconColor: '#a78bfa' },
  [TileType.Capital]: { color: '#be123c', label: 'Capital', iconColor: '#ffffff' }, // Wild Resource
};

export const TILE_IMAGES: Record<TileType, string> = {
  [TileType.Plains]: '/assets/tiles/plain.png',
  [TileType.Mountains]: '/assets/tiles/mountain.png',
  [TileType.Goldmine]: '/assets/tiles/goldmine.png',
  [TileType.RelicSite]: '/assets/tiles/relic.png',
  [TileType.Ruins]: '/assets/tiles/ruin.png',
  [TileType.Capital]: '/assets/tiles/plain.png', // Capital uses Plain base, overlay handles the rest
};

export const FOG_IMAGE = '/assets/tiles/fog.png';

export const RESOURCE_COLORS: Record<Resource, string> = {
  [Resource.Grain]: '#fbbf24', 
  [Resource.Stone]: '#94a3b8', 
  [Resource.Gold]: '#eab308', 
  [Resource.Relic]: '#34d399', 
};

export const CITIZEN_INFO: Record<CitizenType, { description: string; color: string; icon: string }> = {
  [CitizenType.Merchant]: { description: "Trade 2 Grain -> 1 Gold. Fix economy.", color: "#eab308", icon: "Scale" },
  [CitizenType.Builder]: { description: "Fortify: +1 Defense & +1 Income.", color: "#22c55e", icon: "Hammer" },
  [CitizenType.Warrior]: { description: "Attack: +1 Str. Win = Steal Loot.", color: "#ef4444", icon: "Sword" },
  [CitizenType.Explorer]: { description: "Claim & Reveal. Cost: 1 Grain.", color: "#3b82f6", icon: "Compass" }
};

export const FACTIONS: FactionInfo[] = [
  { name: "Aurelian Dynasty", title: "The Golden Sun", color: '#fbbf24', textColor: '#422006', personality: 'BALANCED' },
  { name: "Iron Legion", title: "Forged in Fire", color: '#b91c1c', textColor: '#fef2f2', personality: 'AGGRESSIVE' },
  { name: "Verdant Keepers", title: "Root & Stem", color: '#15803d', textColor: '#f0fdf4', personality: 'EXPANSIONIST' },
  { name: "Void Walkers", title: "Shadow Pact", color: '#7e22ce', textColor: '#faf5ff', personality: 'DEFENSIVE' },
];

export const EVENTS_DECK: EventCard[] = [
    { 
        id: 'e1', title: 'Resource Boom', 
        normalText: 'Gain 2 resources of your choice.', 
        relicText: 'Gain 4 resources.',
        normalEffect: { type: 'RESOURCE_GAIN', value: 2, target: 'ALL' },
        relicEffect: { type: 'RESOURCE_GAIN', value: 4, target: 'SELF' }
    },
    { 
        id: 'e2', title: 'Sabotage', 
        normalText: 'Opponent loses 1 random resource.', 
        relicText: 'Opponent loses 2 random resources & cannot Fortify.',
        normalEffect: { type: 'RESOURCE_LOSS', value: 1, target: 'ENEMY' },
        relicEffect: { type: 'RESOURCE_LOSS', value: 2, target: 'ENEMY' }
    },
    { 
        id: 'e3', title: 'Supply Drop', 
        normalText: 'Gain 1 Grain + 1 Stone.', 
        relicText: 'Power: Gain 1 Grain & 1 Gold at the start of every future round (Passive Income).',
        normalEffect: { type: 'RESOURCE_GAIN', value: 1, target: Resource.Grain },
        relicEffect: { type: 'PASSIVE_INCOME', value: 1, target: 'SELF' }
    },
    { 
        id: 'e4', title: 'Earthquake', 
        normalText: 'Remove 1 Fortification from any tile.', 
        relicText: 'Power: Your Fortify action is Free this round (Cost: 0).',
        normalEffect: { type: 'FORTIFY_REMOVE', value: 1 },
        relicEffect: { type: 'FREE_FORTIFY', value: 1, target: 'SELF' }
    },
    { 
        id: 'e5', title: 'Sudden Reinforcements', 
        normalText: 'Gain +1 Combat Strength next battle.', 
        relicText: 'Gain +2 Combat Strength & ignore Forts.',
        normalEffect: { type: 'COMBAT_BONUS', value: 1 },
        relicEffect: { type: 'COMBAT_BONUS', value: 2 }
    },
    { 
        id: 'e6', title: 'Quiet Eclipse', 
        normalText: 'No attacks this Eclipse.', 
        relicText: 'You may attack once; others cannot.',
        normalEffect: { type: 'BLOCK_ATTACK', value: 1 },
        relicEffect: { type: 'BLOCK_ATTACK', value: 0 }
    },
    { 
        id: 'e7', title: 'Natural Disaster', 
        normalText: 'Remove 1 revealed tile (neutralize).', 
        relicText: 'Remove 1 tile AND 1 fortification.',
        normalEffect: { type: 'TILE_REMOVE', value: 1 },
        relicEffect: { type: 'TILE_REMOVE', value: 2 }
    },
    { 
        id: 'e8', title: 'Merchant Windfall', 
        normalText: 'Perform 1 Bank Trade for free.', 
        relicText: 'Perform 2 Bank Trades for free.',
        normalEffect: { type: 'TRADE_FREE', value: 1 },
        relicEffect: { type: 'TRADE_FREE', value: 2 }
    },
    {
        id: 'e9', title: 'Forced March',
        normalText: 'Move armies swiftly. Gain +1 Strength this turn.',
        relicText: 'Power: You may take 2 Actions this turn immediately (Cost: 2 Gold).',
        normalEffect: { type: 'COMBAT_BONUS', value: 1 },
        relicEffect: { type: 'DOUBLE_ACTION', value: 2, target: 'SELF' }
    }
];

export const OBJECTIVES_DECK: SecretObjective[] = [
    { 
        id: 'o1', name: 'Keeper of the Harvest',
        description: 'Control 3 Grain-producing tiles (Plains) at end.', 
        vp: 3, 
        condition: (p, map) => Object.values(map).filter(h => h.ownerId === p.id && h.type === TileType.Plains).length >= 3,
        progress: (p, map) => `${Object.values(map).filter(h => h.ownerId === p.id && h.type === TileType.Plains).length} / 3 Plains`
    },
    { 
        id: 'o2', name: 'Master of the Forge',
        description: 'Accumulate 8 Stone total (checked as "Have 8 Stone").', 
        vp: 2, 
        condition: (p) => p.resources[Resource.Stone] >= 8,
        progress: (p) => `${p.resources[Resource.Stone]} / 8 Stone`
    },
    { 
        id: 'o3', name: 'Merchant Prince',
        description: 'Hold 12 total resources of any type at once.', 
        vp: 3, 
        condition: (p) => p.stats.maxResourcesHeld >= 12,
        progress: (p) => `Max Held: ${p.stats.maxResourcesHeld} / 12`
    },
    { 
        id: 'o4', name: 'Relic Hoarder',
        description: 'End the game with 3 or more Relics.', 
        vp: 4, 
        condition: (p) => p.resources[Resource.Relic] >= 3,
        progress: (p) => `${p.resources[Resource.Relic]} / 3 Relics`
    },
    { 
        id: 'o5', name: 'Warlord\'s Dominion',
        description: 'Win 3 battles (attacking or defending).', 
        vp: 3, 
        condition: (p) => p.stats.battlesWon >= 3,
        progress: (p) => `${p.stats.battlesWon} / 3 Wins`
    },
    { 
        id: 'o6', name: 'Architect of Ages',
        description: 'Build 3 Fortifications across different tiles.', 
        vp: 3, 
        condition: (p, map) => Object.values(map).filter(h => h.fortification?.ownerId === p.id).length >= 3,
        progress: (p, map) => `${Object.values(map).filter(h => h.fortification?.ownerId === p.id).length} / 3 Forts`
    },
    { 
        id: 'o7', name: 'Pathfinder\'s Legacy',
        description: 'Personally reveal 5 tiles during exploration.', 
        vp: 3, 
        condition: (p) => p.stats.tilesRevealed >= 5,
        progress: (p) => `${p.stats.tilesRevealed} / 5 Revealed`
    },
    { 
        id: 'o8', name: 'Treasurer of Empires',
        description: 'End the game with 6 Gold or more.', 
        vp: 2, 
        condition: (p) => p.resources[Resource.Gold] >= 6,
        progress: (p) => `${p.resources[Resource.Gold]} / 6 Gold`
    },
    { 
        id: 'o9', name: 'Prophet of the Eclipse',
        description: 'Trigger 1 Relic-Enhanced Event.', 
        vp: 2, 
        condition: (p) => p.stats.relicEventsTriggered >= 1,
        progress: (p) => `${p.stats.relicEventsTriggered} / 1 Triggered`
    },
    { 
        id: 'o10', name: 'Tri-Lord',
        description: 'Control 1 Plain, 1 Mtn, 1 Goldmine, 1 Special (Ruin/Relic).', 
        vp: 4, 
        condition: (p, map) => {
            const owned = Object.values(map).filter(h => h.ownerId === p.id);
            const hasPlain = owned.some(h => h.type === TileType.Plains);
            const hasMtn = owned.some(h => h.type === TileType.Mountains);
            const hasGold = owned.some(h => h.type === TileType.Goldmine);
            const hasSpecial = owned.some(h => h.type === TileType.Ruins || h.type === TileType.RelicSite);
            return hasPlain && hasMtn && hasGold && hasSpecial;
        },
        progress: (p, map) => {
            const owned = Object.values(map).filter(h => h.ownerId === p.id);
            const c = (t: boolean) => t ? "✓" : "✗";
            return `${c(owned.some(h=>h.type===TileType.Plains))}Pl ${c(owned.some(h=>h.type===TileType.Mountains))}Mt ${c(owned.some(h=>h.type===TileType.Goldmine))}Gd ${c(owned.some(h=>h.type===TileType.Ruins||h.type===TileType.RelicSite))}Sp`;
        }
    },
    { 
        id: 'o11', name: 'Border Baron',
        description: 'Control 3 adjacent tiles in a straight line.', 
        vp: 3, 
        condition: (p, map) => {
            const owned = Object.values(map).filter(h => h.ownerId === p.id);
            return hasStraightLineOfThree(owned);
        },
        progress: (p, map) => hasStraightLineOfThree(Object.values(map).filter(h => h.ownerId === p.id)) ? "Complete" : "Not Met"
    },
    { 
        id: 'o12', name: 'Shadow Empire',
        description: 'End the game without losing any tile you controlled.', 
        vp: 4, 
        condition: (p) => p.stats.tilesLost === 0,
        progress: (p) => p.stats.tilesLost === 0 ? "Intact" : "Failed"
    },
    { 
        id: 'o13', name: 'Silent Pactkeeper',
        description: 'Do not attack anyone for the entire game.', 
        vp: 3, 
        condition: (p) => p.stats.attacksMade === 0,
        progress: (p) => p.stats.attacksMade === 0 ? "Peaceful" : "Failed"
    },
    { 
        id: 'o14', name: 'Reaver of Realms',
        description: 'Successfully attack two different players.', 
        vp: 4, 
        condition: (p) => new Set(p.stats.uniquePlayersAttacked).size >= 2,
        progress: (p) => `${new Set(p.stats.uniquePlayersAttacked).size} / 2 Rivals`
    },
    { 
        id: 'o15', name: 'Relic Cartographer',
        description: 'Reveal 2 Relic Sites (need not control).', 
        vp: 3, 
        condition: (p) => p.stats.relicSitesRevealed >= 2,
        progress: (p) => `${p.stats.relicSitesRevealed} / 2 Relics`
    },
    { 
        id: 'o16', name: 'The Golden Triad',
        description: 'End with one of each resource type.', 
        vp: 2, 
        condition: (p) => 
            p.resources[Resource.Grain] >= 1 && 
            p.resources[Resource.Stone] >= 1 && 
            p.resources[Resource.Gold] >= 1 && 
            p.resources[Resource.Relic] >= 1,
        progress: (p) => {
            const count = [p.resources[Resource.Grain], p.resources[Resource.Stone], p.resources[Resource.Gold], p.resources[Resource.Relic]].filter(r => r > 0).length;
            return `${count} / 4 Types`;
        }
    }
];
