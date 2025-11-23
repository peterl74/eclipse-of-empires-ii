
import { HexData, TileType } from '../types';
import { TILE_COUNTS } from '../constants';

export const getHexId = (q: number, r: number) => `${q},${r}`;

export const generateMap = (playerCount: number = 4): Record<string, HexData> => {
  const map: Record<string, HexData> = {};
  
  // Dynamic Map Size Logic
  // 2 players = 5x5 (25 tiles)
  // 4 players = 7x7 (49 tiles)
  const baseSize = playerCount === 2 ? 5 : 7;
  
  const width = baseSize;
  const height = baseSize;
  const qOffset = Math.floor(width / 2);
  
  // SCALE THE DECK:
  // If the map is bigger, we need more tiles in the deck!
  const totalTiles = width * height;
  const fullDeck: TileType[] = [];
  
  // Multiplier ensures we have enough specific tiles for larger maps
  // 25 tiles (base) -> x1
  // 49 tiles -> x2 (approx)
  const multiplier = Math.ceil(totalTiles / 25); 
  
  Object.entries(TILE_COUNTS).forEach(([type, count]) => {
      fullDeck.push(...Array(count * multiplier).fill(type as TileType));
  });

  // Shuffle
  for (let i = fullDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fullDeck[i], fullDeck[j]] = [fullDeck[j], fullDeck[i]];
  }

  let idx = 0;

  for (let col = 0; col < width; col++) {
      for (let row = 0; row < height; row++) {
          // Axial coordinate calculation for a pointy-topped hex grid stored in a rectangular array
          // The offset shift depends on the column
          const q_calc = col - qOffset;
          const r_final = (row - Math.floor(height / 2)) - Math.floor(col / 2);

          const diceCol = col + 1;
          const diceRow = row + 1;

          const tType = fullDeck[idx] || TileType.Plains;
          
          const id = getHexId(q_calc, r_final);
          map[id] = {
            q: q_calc,
            r: r_final,
            id,
            diceCoords: { col: diceCol, row: diceRow },
            type: tType,
            publicType: tType, // Initially looks like what it is until someone claims/bluffs
            isRevealed: false, 
            ownerId: null,
            fortification: null
          };
          idx++;
      }
  }
  return map;
};

export const hexPixelCoordinates = (q: number, r: number, size: number) => {
  const x = size * (3 / 2 * q);
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
};

export const getNeighbors = (q: number, r: number): {q: number, r: number}[] => {
  return [
    { q: q + 1, r: r }, { q: q + 1, r: r - 1 }, { q: q, r: r - 1 },
    { q: q - 1, r: r }, { q: q - 1, r: r + 1 }, { q: q, r: r + 1 }
  ];
};

export const isAdjacent = (h1: HexData, h2: HexData): boolean => {
    if (!h1 || !h2) return false;
    const dq = h1.q - h2.q;
    const dr = h1.r - h2.r;
    return (
       (Math.abs(dq) === 1 && dr === 0) ||
       (Math.abs(dr) === 1 && dq === 0) ||
       (dq === 1 && dr === -1) ||
       (dq === -1 && dr === 1)
    );
}

// For Border Baron Objective: Check if a set of hexes contains 3 in a line
export const hasStraightLineOfThree = (hexes: HexData[]): boolean => {
    if (hexes.length < 3) return false;
    
    // Convert to Set for O(1) lookup
    const qSet: Record<number, number[]> = {};
    const rSet: Record<number, number[]> = {};
    const sSet: Record<number, number[]> = {}; // s = -q-r

    hexes.forEach(h => {
        const s = -h.q - h.r;
        if (!qSet[h.q]) qSet[h.q] = []; qSet[h.q].push(h.r);
        if (!rSet[h.r]) rSet[h.r] = []; rSet[h.r].push(h.q);
        if (!sSet[s]) sSet[s] = []; sSet[s].push(h.q);
    });

    const checkContinuity = (arr: number[]) => {
        if (arr.length < 3) return false;
        arr.sort((a,b) => a - b);
        let streak = 1;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] === arr[i-1] + 1) {
                streak++;
                if (streak >= 3) return true;
            } else {
                streak = 1;
            }
        }
        return false;
    };

    if (Object.values(qSet).some(checkContinuity)) return true;
    if (Object.values(rSet).some(checkContinuity)) return true;
    if (Object.values(sSet).some(checkContinuity)) return true;

    return false;
};
