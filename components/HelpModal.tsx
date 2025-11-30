
import React, { useState } from 'react';
import { X, BookOpen, Trophy, Map, Users, Target, Zap, Crown, Settings, Box, Sword, Info, Scroll } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Section {
  heading: string;
  content?: string | string[];
  tableData?: { label: string; value: string }[];
}

interface Category {
  id: string;
  title: string;
  icon: React.ReactNode;
  sections: Section[];
}

const GUIDE_DATA: Category[] = [
    {
      id: "mechanics",
      title: "Core Rules & Engine",
      icon: <Settings size={18} />,
      sections: [
        {
          heading: "The Turn Cycle (Cycling Actions)",
          content: [
            "The Action Phase uses a 'Cycle until Pass' system.",
            "Turn Order: Players act in sequence (1 → 2 → 3 → 4 → 1...) indefinitely.",
            "Ending the Round: The phase only ends when ALL players have passed.",
            "Resource Cap: Actions are limited by Resources, not slots. If you run out of Grain/Gold, you must Pass.",
            "Initiative: The 'First Player' token rotates clockwise at the start of every new Eclipse."
          ]
        },
        {
          heading: "Action Costs & Fatigue",
          tableData: [
            { label: "Warrior Attack", value: "Costs 1 Grain per attack. No Grain = No Fighting." },
            { label: "Explorer Expand", value: "1st Expansion is Free. Subsequent expansions in the same round cost 1 Grain." },
            { label: "Builder Fortify", value: "Costs 2 Stone. (Unless you have the 'Free Fortify' Relic Power)." }
          ]
        },
        {
          heading: "Bluffing & Challenging",
          content: [
            "Private Truth: You see the true type of your tiles.",
            "Public Lie: You declare a tile type to rivals.",
            "HOW TO CHALLENGE: There is no 'Call Bluff' button. You challenge a claim by ATTACKING the territory. If you conquer it, the true nature is revealed to all."
          ]
        }
      ]
    },
    {
      id: "classes",
      title: "The Council (Classes)",
      icon: <Users size={18} />,
      sections: [
        {
          heading: "Citizen Roles",
          content: "Chosen secretly at the start of Phase II. Your role defines your primary action for the round.",
          tableData: [
            { label: "Warrior", value: "Action: Attack. Effect: Conquer tile & Loot 1 Resource on win. Cost: 1 Grain." },
            { label: "Builder", value: "Action: Fortify. Effect: +1 Defense AND +1 Resource Production. Cost: 2 Stone." },
            { label: "Merchant", value: "Action: Trade. Effect: Exchange 2 Grain -> 1 Gold (Better ratio than Market)." },
            { label: "Explorer", value: "Action: Expand. Effect: Claim Neutral/Fog tiles. Cost: 1 Grain (Flat)." }
          ]
        }
      ]
    },
    {
      id: "relics",
      title: "Relic Powers (Option B)",
      icon: <Zap size={18} />,
      sections: [
        {
          heading: "Engine Building Rules",
          content: [
            "Relics now grant Permanent Powers instead of one-time loot.",
            "The 'One Crown' Rule: You may only hold ONE active power at a time. Finding a new Relic forces a swap choice."
          ]
        },
        {
          heading: "Power List",
          tableData: [
            { label: "Passive Income", value: "Auto-gain +1 Grain & +1 Gold every round start." },
            { label: "Free Fortify", value: "Your first Fortify action each round costs 0 resources." },
            { label: "Warlord", value: "Permanent +1 Combat Strength (Stacks with Warrior)." },
            { label: "Trade Baron", value: "Start every round with 1 Free Trade action." },
            { label: "Double Time", value: "Pay 2 Gold to take 2 Actions immediately." }
          ]
        },
        {
          heading: "Probability",
          content: "Map contains approx 2 Relic Sites total. Probability of finding one is ~4% per tile. 50% of players will likely not get a Relic."
        }
      ]
    },
    {
      id: "combat",
      title: "Warfare Math",
      icon: <Sword size={18} />,
      sections: [
        {
          heading: "Combat Formulas",
          content: [
            "Attacker Strength = Base(1) + Warrior(1) + Relic(1) + Support(Adj Friends) + d6",
            "Defender Strength = Base(1) + Fort(1) + Support(Adj Friends) + d6"
          ]
        },
        {
          heading: "Outcomes",
          content: [
            "Win: Defender loses tile. Fortification destroyed. Attacker occupies and LOOTS 1 Resource.",
            "Loss/Tie: Nothing changes. Attacker still pays 1 Grain cost."
          ]
        }
      ]
    },
    {
      id: "map",
      title: "Map Data",
      icon: <Map size={18} />,
      sections: [
        {
          heading: "Tile Distributions (4 Players)",
          tableData: [
            { label: "Plains (Grain)", value: "~32% (Primary Food Source)" },
            { label: "Mountains (Stone)", value: "~20% (Build Material)" },
            { label: "Goldmines (Gold)", value: "~8% (1 VP + Currency)" },
            { label: "Ruins (Loot)", value: "~8% (One-time Scavenge)" },
            { label: "Relic Sites", value: "~4% (2 VP + Power)" },
            { label: "Capital", value: "1 per player (Produces 1 of each)" }
          ]
        }
      ]
    },
    {
      id: "events",
      title: "Event Database",
      icon: <BookOpen size={18} />,
      sections: [
        {
          heading: "Relic Power Mappings",
          content: "These cards grant a Permanent Power if found via a Relic Site.",
          tableData: [
            { label: "Supply Drop", value: "Power: Passive Income" },
            { label: "Resource Boom", value: "Power: Passive Income" },
            { label: "Blessing of Prosperity", value: "Power: Passive Income" },
            { label: "Earthquake", value: "Power: Free Fortify" },
            { label: "Fog of War", value: "Power: Free Fortify" },
            { label: "Sudden Reinforcements", value: "Power: Warlord" },
            { label: "Diplomatic Envoys", value: "Power: Warlord" },
            { label: "Merchant Windfall", value: "Power: Trade Baron" },
            { label: "Forced March", value: "Power: Double Time" }
          ]
        },
        {
          heading: "Standard Events",
          content: "These cards have instant effects when drawn from the Global Event Deck.",
          tableData: [
            { label: "Sabotage", value: "Opponent loses resource." },
            { label: "Bandit Raid", value: "Steal 1 resource." },
            { label: "Natural Disaster", value: "Destroy 1 tile." },
            { label: "Collapsed Mine", value: "Mines produce 0." },
            { label: "Ancient Knowledge", value: "Draw extra event." }
          ]
        }
      ]
    },
    {
      id: "objectives",
      title: "Objectives (VP)",
      icon: <Target size={18} />,
      sections: [
        {
          heading: "Economic Goals",
          tableData: [
            { label: "Keeper of the Harvest", value: "Control 3 Plains (3 VP)" },
            { label: "Master of the Forge", value: "Collect 8 Stone (2 VP)" },
            { label: "Merchant Prince", value: "Hold 12 Resources at once (3 VP)" },
            { label: "Treasurer of Empires", value: "End with 6 Gold (2 VP)" },
            { label: "Golden Triad", value: "End with 1 Grain, 1 Stone, 1 Gold, 1 Relic (2 VP)" }
          ]
        },
        {
          heading: "Military Goals",
          tableData: [
            { label: "Warlord's Dominion", value: "Win 3 Battles (3 VP)" },
            { label: "Reaver of Realms", value: "Attack 2 different players (4 VP)" },
            { label: "Shadow Empire", value: "Lose 0 tiles after Round 3 (4 VP)" },
            { label: "Silent Pactkeeper", value: "Do not attack anyone (3 VP)" }
          ]
        },
        {
          heading: "Exploration Goals",
          tableData: [
            { label: "Architect of Ages", value: "Build 3 Forts (3 VP)" },
            { label: "Pathfinder's Legacy", value: "Reveal 5 tiles (3 VP)" },
            { label: "Border Baron", value: "Control 3 tiles in a line (3 VP)" },
            { label: "Tri-Lord", value: "Control 1 Plain, 1 Mountain, 1 Goldmine, 1 Relic (4 VP)" }
          ]
        },
        {
          heading: "Relic Goals",
          tableData: [
            { label: "Relic Hoarder", value: "End with 3 Relic Tokens (4 VP)" },
            { label: "Prophet of the Eclipse", value: "Trigger a Relic Event (2 VP)" },
            { label: "Relic Cartographer", value: "Reveal 2 Relic Sites (3 VP)" }
          ]
        }
      ]
    },
    {
      id: "components",
      title: "Inventory",
      icon: <Box size={18} />,
      sections: [
        {
          heading: "Digital Assets",
          tableData: [
            { label: "Game Board", value: "7x7 Hex Grid (49 Tiles)" },
            { label: "Faction Decks", value: "4 Sets of Citizen Cards" },
            { label: "Cards", value: "20 Events, 16 Secret Objectives, Public Objective Deck" }
          ]
        }
      ]
    }
];

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('mechanics');

  if (!isOpen) return null;

  const activeCategory = GUIDE_DATA.find(c => c.id === activeTab);

  return (
    <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#0f172a] border border-[#ca8a04] w-full max-w-5xl h-[85vh] rounded-lg shadow-2xl flex overflow-hidden relative">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white z-10 p-2 bg-slate-800 rounded-full transition-colors hover:bg-slate-700"
        >
          <X size={20} />
        </button>

        {/* Sidebar */}
        <div className="w-16 md:w-64 bg-[#1e293b] border-r border-slate-700 flex flex-col shrink-0">
          <div className="p-4 md:p-6 border-b border-slate-700">
            <h2 className="text-[#fcd34d] font-title text-xl leading-none hidden md:block">Field Manual</h2>
            <h2 className="text-[#fcd34d] font-title text-xl leading-none md:hidden text-center">FM</h2>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest hidden md:block">Ver 2.0-Beta</span>
          </div>
          <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
            {GUIDE_DATA.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveTab(category.id)}
                title={category.title}
                className={`w-full px-2 md:px-6 py-4 flex items-center justify-center md:justify-start gap-3 text-sm font-bold uppercase tracking-wide transition-colors
                  ${activeTab === category.id 
                    ? 'bg-[#ca8a04]/10 text-[#fcd34d] border-r-2 border-[#fcd34d]' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-r-2 border-transparent'}
                `}
              >
                {category.icon}
                <span className="hidden md:block">{category.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#0b0a14] text-[#e2d9c5] custom-scrollbar scroll-smooth">
          {activeCategory && (
            <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-2 fade-in duration-300">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-6">
                 <div className="p-2 bg-slate-800 rounded-lg">
                    {React.cloneElement(activeCategory.icon as React.ReactElement<any>, { size: 28, className: "text-[#ca8a04]" })}
                 </div>
                 <h2 className="text-3xl font-title text-white">{activeCategory.title}</h2>
              </div>

              <div className="space-y-8">
                  {activeCategory.sections.map((section, idx) => (
                      <div key={idx} className="bg-[#1e293b]/50 rounded-lg p-5 border border-slate-800">
                          <h3 className="text-[#fcd34d] font-bold text-lg mb-3 flex items-center gap-2">
                             <div className="w-1.5 h-4 bg-[#fcd34d] rounded-sm"></div>
                             {section.heading}
                          </h3>
                          
                          {/* Render Content Text */}
                          {section.content && (
                              <div className="text-slate-300 text-sm leading-relaxed mb-4">
                                  {Array.isArray(section.content) ? (
                                      <ul className="space-y-2">
                                          {section.content.map((line, i) => (
                                              <li key={i} className="flex items-start gap-2">
                                                  <div className="w-1 h-1 bg-slate-500 rounded-full mt-2 shrink-0"></div>
                                                  <span>{line}</span>
                                              </li>
                                          ))}
                                      </ul>
                                  ) : (
                                      <p>{section.content}</p>
                                  )}
                              </div>
                          )}

                          {/* Render Table Data */}
                          {section.tableData && (
                              <div className="grid gap-2">
                                  {section.tableData.map((row, i) => (
                                      <div key={i} className="flex flex-col md:flex-row md:items-center justify-between bg-black/20 p-3 rounded border border-slate-700/50 hover:border-slate-600 transition-colors">
                                          <span className="font-bold text-slate-200 text-sm mb-1 md:mb-0 w-1/3">{row.label}</span>
                                          <span className="text-slate-400 text-xs md:text-sm md:text-right flex-1">{row.value}</span>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  ))}
              </div>

              {/* Footer Note */}
              <div className="mt-12 text-center text-slate-600 text-[10px] uppercase tracking-widest">
                  Eclipse of Empires II • Strategic Archives
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
