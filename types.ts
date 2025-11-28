

export enum Resource {
  Grain = 'Grain',
  Stone = 'Stone',
  Gold = 'Gold',
  Relic = 'Relic' 
}

export enum TileType {
  Plains = 'Plains',       // Produces Grain
  Mountains = 'Mountains', // Produces Stone
  Goldmine = 'Goldmine',   // Produces Gold
  RelicSite = 'RelicSite', // Produces Relic + Triggers Bonus Event on Reveal
  Ruins = 'Ruins',         // Produces Event Card
  Capital = 'Capital'      // Produces Wild Resource
}

export enum CitizenType {
  Merchant = 'Merchant',
  Builder = 'Builder',
  Warrior = 'Warrior',
  Explorer = 'Explorer'
}

export enum Phase {
  Income = 'Income',        // Phase 1
  CitizenChoice = 'CitizenChoice', // Phase 2
  Action = 'Action',        // Phase 3 - Now Cycling
  Events = 'Events',        // Phase 4
  Scoring = 'Scoring',      // Phase 5
  EndGame = 'EndGame'
}

export interface FactionInfo {
  name: string;
  title: string;
  color: string; 
  textColor: string;
  personality: 'AGGRESSIVE' | 'EXPANSIONIST' | 'DEFENSIVE' | 'BALANCED';
}

export interface HexData {
  q: number;
  r: number;
  id: string;
  diceCoords: { col: number; row: number };
  type: TileType;      // The TRUE type (for income)
  publicType: TileType; // The DECLARED type (what others see - for bluffing)
  isRevealed: boolean; // If true, the True Type is visible to all (e.g. after scanning/event)
  ownerId: number | null; 
  fortification: {
    ownerId: number;
    level: number; 
  } | null;
}

export type EventEffectType = 
  | 'RESOURCE_GAIN' 
  | 'RESOURCE_LOSS' 
  | 'FORTIFY_REMOVE' 
  | 'TILE_REMOVE' 
  | 'COMBAT_BONUS' 
  | 'BLOCK_ATTACK' 
  | 'TRADE_FREE'
  | 'PASSIVE_INCOME'   // New
  | 'FREE_FORTIFY'     // New
  | 'DOUBLE_ACTION';   // New

export interface EventCard {
  id: string;
  title: string;
  normalText: string;
  relicText: string;
  
  // Logical definitions for the engine
  normalEffect: { type: EventEffectType; value: number; target?: Resource | 'ALL' | 'ENEMY' | 'SELF' };
  relicEffect: { type: EventEffectType; value: number; target?: Resource | 'ALL' | 'ENEMY' | 'SELF' };
}

export interface SecretObjective {
  id: string;
  name: string;
  description: string;
  vp: number;
  condition: (player: Player, map: Record<string, HexData>) => boolean;
  progress: (player: Player, map: Record<string, HexData>) => string; // Human readable progress
}

export interface PlayerStats {
  battlesWon: number;
  tilesRevealed: number;
  relicEventsTriggered: number;
  maxResourcesHeld: number; // For Merchant Prince
  tilesLost: number; // For Shadow Empire
  attacksMade: number; // For Silent Pactkeeper
  uniquePlayersAttacked: number[]; // For Reaver of Realms (store IDs)
  relicSitesRevealed: number; // For Relic Cartographer
}

export type RelicPowerType = 'PASSIVE_INCOME' | 'FREE_FORTIFY' | 'WARLORD' | 'TRADE_BARON' | 'DOUBLE_TIME' | null;

export interface Player {
  id: number;
  name: string;
  faction: FactionInfo;
  isHuman: boolean;
  
  // Economy (Hidden)
  resources: Record<Resource, number>;
  
  // Relic Power (Engine Building)
  activeRelicPower: RelicPowerType;

  // Phase 2 Choice
  selectedCitizen: CitizenType | null;
  
  // Scoring
  vp: number; // Current calculated VP
  secretObjectives: SecretObjective[];
  
  // Hands
  eventHand: EventCard[];
  
  // Cycling Turn State
  hasActed: boolean; // Used to track if they did something specific this specific turn interaction
  hasPassed: boolean; // If true, they are out of the round until next Phase
  actionsTaken: number; // Track number of actions taken in the current phase (for Fatigue logic)
  isEliminated: boolean; // NEW: If true, player is out of the game.
  
  // Lifetime Stats for Objectives
  stats: PlayerStats;

  // Temporary Statuses (Reset each Eclipse)
  status: {
    canAttack: boolean;
    combatBonus: number;
    fortificationBlocked: boolean;
    incomeMultiplier: number; 
    freeTrades: number; 
    // New Buffs
    passiveIncome: boolean; 
    freeFortify: boolean;
    extraActions: number; // For Forced March
  };
}

export interface LogEntry {
  id: string;
  turn: number;
  text: string;
  type: 'info' | 'combat' | 'event' | 'phase' | 'bluff';
  actorId?: number;
  targetId?: number;
  details?: {
    dice?: { att: number, def: number, attRoll: number, defRoll: number };
    card?: string;
    tileType?: TileType;
    declaredType?: TileType;
  };
}

export type SidebarTab = 'LOG' | 'RIVALS';

export interface GameState {
  phase: Phase;
  round: number; // 1 to 5
  turnOrderIndex: number; // Index in the turnOrder array
  turnOrder: number[]; // Array of player IDs
  turnTrigger: number; // NEW: Counter that increments every step to force effect re-evaluation
  passOrder: number[]; // NEW: Tracks order of passing to determine next round initiative
  players: Player[];
  map: Record<string, HexData>;
  logs: LogEntry[];
  
  uiState: {
    isSelectingTile: boolean;
    isProcessing: boolean; // New: Blocks input during resolution
    actionType: 'CLAIM' | 'ATTACK' | 'FORTIFY' | 'EXPLORE' | 'ACTIVATE' | null;
    selectedHexId: string | null;
    isDeclaring: boolean; // New: is the player choosing what to declare?
    pendingHexId: string | null; // New: which hex are they declaring for?
    activeSidebarTab: SidebarTab;
    isMarketOpen: boolean; // New: is the market modal open?
  };
  
  activeEvent: { card: EventCard; isRelicPowered: boolean } | null;

  // Card Decks
  eventDeck: EventCard[];
  discardPile: EventCard[];

  // Directive System
  objectiveDeck: SecretObjective[]; // The pile of unused objectives
  publicObjectives: SecretObjective[]; // Shared objectives revealed in R2, R3, R4
}