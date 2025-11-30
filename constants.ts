
import { Resource, TileType, CitizenType, FactionInfo, EventCard, SecretObjective, HexData } from './types';

export const TOTAL_ROUNDS = 5;
export const HEX_SIZE = 45;

export const RESOURCE_COLORS: Record<Resource, string> = {
  [Resource.Grain]: '#fbbf24', // Amber 400
  [Resource.Stone]: '#94a3b8', // Slate 400
  [Resource.Gold]: '#fcd34d', // Amber 300
  [Resource.Relic]: '#10b981', // Emerald 500
};

export const FACTIONS: FactionInfo[] = [
  { name: "Terran Republic", title: "The United Colonies", color: "#3b82f6", textColor: "#eff6ff", personality: 'BALANCED' },
  { name: "Mars Confederacy", title: "Red Dust Raiders", color: "#ef4444", textColor: "#fef2f2", personality: 'AGGRESSIVE' },
  { name: "Venusian Syndicate", title: "Cloud City Trade", color: "#eab308", textColor: "#fffbeb", personality: 'EXPANSIONIST' },
  { name: "Jovian Empire", title: "Gas Giant Kings", color: "#a855f7", textColor: "#faf5ff", personality: 'DEFENSIVE' }
];

export const TILE_COUNTS: Record<TileType, number> = {
  [TileType.Plains]: 16,
  [TileType.Mountains]: 10,
  [TileType.Goldmine]: 4,
  [TileType.Ruins]: 4,
  [TileType.RelicSite]: 2,
  [TileType.Capital]: 0 // Handled separately
};

export const TILE_CONFIG: Record<TileType, { label: string; color: string; resource?: Resource }> = {
  [TileType.Plains]: { label: "Fertile Plains", color: "#166534", resource: Resource.Grain },
  [TileType.Mountains]: { label: "Iron Mountains", color: "#475569", resource: Resource.Stone },
  [TileType.Goldmine]: { label: "Rich Goldmine", color: "#854d0e", resource: Resource.Gold },
  [TileType.RelicSite]: { label: "Ancient Relic", color: "#064e3b", resource: Resource.Relic },
  [TileType.Ruins]: { label: "Precursor Ruins", color: "#581c87" },
  [TileType.Capital]: { label: "Capital City", color: "#ffffff" } // Color overridden by player color
};

export const VP_CONFIG = {
  [TileType.Plains]: 1,
  [TileType.Mountains]: 1,
  [TileType.Goldmine]: 1,
  [TileType.RelicSite]: 2,
  [TileType.Ruins]: 0,
  [TileType.Capital]: 2,
  Fortification: 1,
  RelicToken: 2
};

export const CITIZEN_INFO: Record<CitizenType, { description: string; color: string }> = {
  [CitizenType.Warrior]: { description: "Attack rivals to seize land and loot resources.", color: "#ef4444" },
  [CitizenType.Builder]: { description: "Fortify lands for defense and extra production.", color: "#22c55e" },
  [CitizenType.Merchant]: { description: "Trade Grain for Gold efficiently.", color: "#eab308" },
  [CitizenType.Explorer]: { description: "Claim new lands cheaply.", color: "#3b82f6" }
};

export const EVENTS_DECK: EventCard[] = [
    { id: 'e1', title: "Supply Drop", normalText: "Gain 2 Grain", relicText: "Gain 4 Grain", normalEffect: { type: 'RESOURCE_GAIN', value: 2, target: Resource.Grain }, relicEffect: { type: 'RESOURCE_GAIN', value: 4, target: Resource.Grain } },
    { id: 'e2', title: "Bandit Raid", normalText: "Lose 1 Gold", relicText: "Enemy loses 2 Gold", normalEffect: { type: 'RESOURCE_LOSS', value: 1, target: 'SELF' }, relicEffect: { type: 'RESOURCE_LOSS', value: 2, target: 'ENEMY' } },
    { id: 'e3', title: "Blessing of Prosperity", normalText: "Gain 1 Grain, 1 Stone", relicText: "Gain Passive Income Power", normalEffect: { type: 'RESOURCE_GAIN', value: 1, target: Resource.Grain }, relicEffect: { type: 'PASSIVE_INCOME', value: 0, target: 'SELF' } },
    { id: 'e4', title: "Earthquake", normalText: "Destroy 1 Fortification", relicText: "Gain Free Fortify Power", normalEffect: { type: 'FORTIFY_REMOVE', value: 1, target: 'ALL' }, relicEffect: { type: 'FREE_FORTIFY', value: 0, target: 'SELF' } },
    { id: 'e5', title: "Sudden Reinforcements", normalText: "+1 Combat Strength (This Round)", relicText: "Gain Warlord Power", normalEffect: { type: 'COMBAT_BONUS', value: 1, target: 'SELF' }, relicEffect: { type: 'WARLORD', value: 0, target: 'SELF' } },
    { id: 'e6', title: "Merchant Windfall", normalText: "Gain 2 Gold", relicText: "Gain Trade Baron Power", normalEffect: { type: 'RESOURCE_GAIN', value: 2, target: Resource.Gold }, relicEffect: { type: 'TRADE_BARON', value: 0, target: 'SELF' } },
    { id: 'e99', title: "Fog of War", normalText: "Attacks Blocked", relicText: "Free Fortify Power", normalEffect: { type: 'BLOCK_ATTACK', value: 0, target: 'ALL' }, relicEffect: { type: 'FREE_FORTIFY', value: 0, target: 'SELF' } },
    { id: 'e98', title: "Diplomatic Envoys", normalText: "+1 Combat Strength", relicText: "Gain Warlord Power", normalEffect: { type: 'COMBAT_BONUS', value: 1, target: 'SELF' }, relicEffect: { type: 'WARLORD', value: 0, target: 'SELF' } },
    { id: 'e9', title: "Forced March", normalText: "Double Action (Cost 2 Gold)", relicText: "Gain Double Time Power", normalEffect: { type: 'DOUBLE_ACTION', value: 0, target: 'SELF' }, relicEffect: { type: 'DOUBLE_TIME', value: 0, target: 'SELF' } },
    { id: 'e8', title: "Golden Age", normalText: "Gain 2 Gold", relicText: "Gain Trade Baron Power", normalEffect: { type: 'RESOURCE_GAIN', value: 2, target: Resource.Gold }, relicEffect: { type: 'TRADE_BARON', value: 0, target: 'SELF' } },
];

export const OBJECTIVES_DECK: SecretObjective[] = [
    { id: 'o1', name: "Keeper of the Harvest", description: "Control 3 Plains", vp: 3, condition: (p, m) => Object.values(m).filter(h => h.ownerId === p.id && h.type === TileType.Plains).length >= 3, progress: (p, m) => `${Object.values(m).filter(h => h.ownerId === p.id && h.type === TileType.Plains).length}/3` },
    { id: 'o2', name: "Master of the Forge", description: "Collect 5 Stone", vp: 2, condition: (p) => p.resources[Resource.Stone] >= 5, progress: (p) => `${p.resources[Resource.Stone]}/5` },
    { id: 'o3', name: "Warlord's Dominion", description: "Win 3 Battles", vp: 3, condition: (p) => p.stats.battlesWon >= 3, progress: (p) => `${p.stats.battlesWon}/3` },
    { id: 'o4', name: "Architect of Ages", description: "Build 3 Forts", vp: 3, condition: (p, m) => Object.values(m).filter(h => h.fortification?.ownerId === p.id).length >= 3, progress: (p, m) => `${Object.values(m).filter(h => h.fortification?.ownerId === p.id).length}/3` },
    { id: 'o5', name: "Merchant Prince", description: "Hold 12 Resources", vp: 3, condition: (p) => Object.values(p.resources).reduce((a,b) => a+b,0) >= 12, progress: (p) => `${Object.values(p.resources).reduce((a,b) => a+b,0)}/12` },
    { id: 'o6', name: "Treasurer of Empires", description: "Hold 6 Gold", vp: 2, condition: (p) => p.resources[Resource.Gold] >= 6, progress: (p) => `${p.resources[Resource.Gold]}/6` },
    { id: 'o7', name: "Reaver of Realms", description: "Attack 2 different players", vp: 4, condition: (p) => p.stats.uniquePlayersAttacked.length >= 2, progress: (p) => `${p.stats.uniquePlayersAttacked.length}/2` },
    { id: 'o8', name: "Shadow Empire", description: "Lose 0 tiles", vp: 4, condition: (p) => p.stats.tilesLost === 0, progress: (p) => p.stats.tilesLost === 0 ? "Safe" : "Failed" },
    { id: 'o9', name: "Silent Pactkeeper", description: "Make 0 Attacks", vp: 3, condition: (p) => p.stats.attacksMade === 0, progress: (p) => p.stats.attacksMade === 0 ? "Peaceful" : "Failed" },
    { id: 'o10', name: "Pathfinder's Legacy", description: "Reveal 5 Tiles", vp: 3, condition: (p) => p.stats.tilesRevealed >= 5, progress: (p) => `${p.stats.tilesRevealed}/5` },
    { id: 'o11', name: "Relic Hoarder", description: "Hold 3 Relics", vp: 4, condition: (p) => p.resources[Resource.Relic] >= 3, progress: (p) => `${p.resources[Resource.Relic]}/3` },
    { id: 'o12', name: "Prophet of the Eclipse", description: "Trigger 1 Relic Event", vp: 2, condition: (p) => p.stats.relicEventsTriggered >= 1, progress: (p) => `${p.stats.relicEventsTriggered}/1` },
    { id: 'o13', name: "Relic Cartographer", description: "Reveal 2 Relic Sites", vp: 3, condition: (p) => p.stats.relicSitesRevealed >= 2, progress: (p) => `${p.stats.relicSitesRevealed}/2` }
];

export const FACTION_TRAITS: Record<string, string[]> = {
    "Terran Republic": ["Expansionist", "Cautious"],
    "Mars Confederacy": ["Aggressive", "Vengeful"],
    "Venusian Syndicate": ["Greedy", "Treacherous"],
    "Jovian Empire": ["Paranoid", "Defensive"]
};

export const AI_DIALOGUE = {
    coalition: ["We must unite against the leader.", "They are too strong to ignore.", "An alliance of necessity."],
    fear_attack: ["I strike out of fear!", "Don't come any closer!", "Pre-emptive defense!"],
    attack: ["This territory is mine!", "Yield or perish.", "Your weakness is my opportunity."],
    fortify: ["Defense is the best offense.", "Safe behind walls.", "Try to breach this."],
    expand: ["New horizons.", "Claiming this for the glory of the faction.", "Manifest destiny."]
};
