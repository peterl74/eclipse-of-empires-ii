
import React from 'react';
import { HexData, Player, TileType, Resource } from '../types';
import { HEX_SIZE, TILE_CONFIG } from '../constants';
import { hexPixelCoordinates, isAdjacent } from '../utils/hexUtils';
import { Hexagon, TowerControl, Flag, VenetianMask, Amphora } from 'lucide-react';
import ResourceIcon from './ResourceIcon';

interface HexGridProps {
  map: Record<string, HexData>;
  players: Player[];
  humanPlayerId: number;
  onHexClick: (hexId: string) => void;
  onHexHover: (hexId: string | null) => void;
  uiState: { isSelectingTile: boolean; actionType: string | null; selectedHexId: string | null };
  revealAll?: boolean; // NEW: For end game summary
  playerCount: number; // NEW: For dynamic zoom
}

const HexGrid: React.FC<HexGridProps> = ({ map, players, humanPlayerId, onHexClick, onHexHover, uiState, revealAll = false, playerCount }) => {
  const hexPoints = (size: number) => {
    const angles = [0, 60, 120, 180, 240, 300];
    return angles.map((deg) => {
        const rad = (Math.PI / 180) * deg;
        return `${Math.cos(rad) * size},${Math.sin(rad) * size}`;
    }).join(' ');
  };

  // Slightly inset points for a clean grid look
  const points = hexPoints(HEX_SIZE - 1); 

  const myTiles = (Object.values(map) as HexData[]).filter((h) => h.ownerId === humanPlayerId);
  
  // Dynamic Zoom based on map size
  const viewBox = playerCount === 2 ? "-300 -300 600 600" : "-425 -425 850 850";

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#050505] overflow-hidden">
      <svg viewBox={viewBox} className="w-full h-full pointer-events-auto filter drop-shadow-2xl touch-manipulation">
        {(Object.values(map) as HexData[]).map((hex) => {
          const { x, y } = hexPixelCoordinates(hex.q, hex.r, HEX_SIZE);
          
          const isOwnedByHuman = hex.ownerId === humanPlayerId;
          const isOwnedByRival = hex.ownerId !== null && !isOwnedByHuman;
          
          // VISIBILITY LOGIC
          let displayedType = hex.type; 
          let isVisible = isOwnedByHuman || isOwnedByRival || hex.isRevealed;

          if (revealAll) {
             // END GAME: Show True Type always
             displayedType = hex.type;
             isVisible = true;
          } else {
             // DURING GAME
             if (isOwnedByRival) {
                  displayedType = hex.publicType;
             } else if (hex.ownerId === null && hex.isRevealed) {
                  displayedType = hex.publicType;
             }
          }
          
          const isAdjacentToOwned = myTiles.some(t => isAdjacent(t, hex));
          
          // Interaction Logic
          let isValidTarget = false;
          let strokeColor = 'rgba(51, 65, 85, 0.5)'; // Default Slate 700
          let strokeWidth = 1;
          let fillColor = '#1e293b'; // Fog color
          
          if (isVisible) {
              fillColor = TILE_CONFIG[displayedType].color;
          }

          if (uiState.isSelectingTile) {
              if (uiState.actionType === 'ATTACK' && isOwnedByRival && isAdjacentToOwned) {
                  isValidTarget = true;
                  strokeColor = '#ef4444'; // Red
              } else if ((uiState.actionType === 'CLAIM' || uiState.actionType === 'EXPLORE') && hex.ownerId === null && isAdjacentToOwned) {
                  isValidTarget = true;
                  strokeColor = '#3b82f6'; // Blue
              } else if (uiState.actionType === 'FORTIFY' && isOwnedByHuman && !hex.fortification) {
                  isValidTarget = true;
                  strokeColor = '#22c55e'; // Green
              } else if (uiState.actionType === 'ACTIVATE' && hex.ownerId === humanPlayerId && hex.type === TileType.RelicSite) {
                  isValidTarget = true;
                  strokeColor = '#34d399'; // Emerald
              }
          }
          
          // Border styling
          if (!isVisible && isAdjacentToOwned) {
              strokeColor = '#64748b'; 
              strokeWidth = 1.5;
          }
          if (hex.ownerId !== null) {
               strokeColor = players.find(p=>p.id===hex.ownerId)?.faction.color || '#fff';
               strokeWidth = 3;
          }

          // Check for bluff
          const isBluffed = hex.type !== hex.publicType;
          const showBluffIndicator = (isOwnedByHuman && !revealAll && isBluffed); // During game: remind human they are lying
          const showExposedBluff = revealAll && isBluffed && hex.ownerId !== null; // End game: show everyone who lied

          return (
            <g 
              key={hex.id} 
              transform={`translate(${x},${y})`} 
              onClick={() => !revealAll && onHexClick(hex.id)} 
              onMouseEnter={() => onHexHover(hex.id)}
              onMouseLeave={() => onHexHover(null)}
              className={`group ${revealAll ? 'cursor-default' : 'cursor-pointer'} transition-opacity duration-300`}
              style={{ opacity: uiState.isSelectingTile && !isValidTarget ? 0.3 : 1 }}
            >
              <polygon
                points={points}
                fill={fillColor}
                stroke={isValidTarget ? strokeColor : strokeColor}
                strokeWidth={isValidTarget ? 4 : strokeWidth}
                className={`transition-all duration-200 ${
                  isValidTarget 
                    ? 'filter drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] brightness-110' 
                    : (!revealAll ? 'hover:brightness-110' : '')
                }`}
              />

              {isVisible && (
                 <g className="pointer-events-none">
                     {displayedType === TileType.Ruins && <Amphora size={18} x={-9} y={-9} stroke="#e2e8f0" strokeWidth={2} className="drop-shadow-md"/>}
                     
                     {TILE_CONFIG[displayedType].resource && (
                         <g transform="translate(-8, -8)">
                             <ResourceIcon resource={TILE_CONFIG[displayedType].resource!} size={16} />
                         </g>
                     )}

                     {hex.fortification && (
                         <g transform="translate(4, -10)">
                             <TowerControl size={16} className="text-white drop-shadow-md" fill={players.find(p=>p.id===hex.fortification?.ownerId)?.faction.color} />
                         </g>
                     )}
                     
                     {/* Capital Icon Overlay */}
                     {displayedType === TileType.Capital && (
                         <g transform="translate(-8, 2)">
                             <Hexagon size={16} fill={players.find(p=>p.id===hex.ownerId)?.faction.color} stroke="white" />
                         </g>
                     )}

                     {/* Rival Owner Flag - only in game or if not showing bluff */}
                     {isOwnedByRival && !showExposedBluff && (
                         <Flag 
                            size={14} 
                            x={-7} 
                            y={2} 
                            fill={players.find(p=>p.id===hex.ownerId)?.faction.color} 
                            stroke="white" 
                            strokeWidth={1.5}
                            className="drop-shadow-md"
                         />
                     )}
                 </g>
              )}
              
              {/* Bluff Indicator (Private for Human) */}
              {showBluffIndicator && (
                 <g transform="translate(0, 8)">
                    <circle cx="5" cy="5" r="7" fill="black" opacity="0.7" />
                    <VenetianMask size={12} className="text-purple-400" fill="currentColor" />
                 </g>
              )}

              {/* End Game: Exposed Bluff */}
              {showExposedBluff && (
                 <g transform="translate(-8, 6)">
                    <circle cx="8" cy="8" r="9" fill="#7f1d1d" stroke="#ef4444" strokeWidth="1" />
                    <VenetianMask size={14} className="text-white" />
                    <line x1="2" y1="2" x2="14" y2="14" stroke="#ef4444" strokeWidth="2" />
                 </g>
              )}

              {/* Fog Indicator */}
              {!isVisible && (
                  <text x="0" y="4" textAnchor="middle" className="fill-slate-700 font-serif text-[10px] select-none opacity-30">?</text>
              )}

               {/* Coordinates - Very Small */}
               <text x="0" y="12" textAnchor="middle" className="fill-white/30 text-[6px] font-mono pointer-events-none select-none">
                  {hex.diceCoords.col},{hex.diceCoords.row}
               </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default HexGrid;
