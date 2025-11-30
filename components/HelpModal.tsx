
import React, { useState } from 'react';
import { X, BookOpen, Trophy, Map, Users, Target, Zap, Crown, Settings, Box, Sword, Info, Scroll, ShieldAlert, HelpCircle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Section {
  heading: string;
  content?: string | string[];
  tableData?: { label: string; value: string; href?: string }[];
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
            "Resource Cap: Actions are limited by Resources. If you run out of Grain/Gold, you must Pass.",
            "Initiative (Strategic Passing): The Turn Order for the NEXT Eclipse is determined by the order in which players Pass. The first player to Pass becomes the First Player next round."
          ]
        },
        {
          heading: "Fatigue System (New)",
          content: [
            "Taking multiple actions in a single round becomes exhausting.",
            "Action 1: Standard Cost.",
            "Action 2+: Standard Cost + 1 Resource.",
            "Action 3+: Standard Cost + 1 Resource (Fatigue caps at +1 currently).",
            "This applies to ALL actions (Attacking, Expanding, Trading, Fortifying)."
          ]
        },
        {
          heading: "The Sunset Rule (Last Stand)",
          content: "If ALL your rivals have Passed, you are granted exactly ONE final 'Last Stand' action. After this action, the Eclipse ends automatically, regardless of your remaining resources."
        }
      ]
    },
    {
      id: "bluffing",
      title: "Bluffing & Challenges",
      icon: <ShieldAlert size={18} />,
      sections: [
        {
          heading: "Declarations",
          content: "When you Expand, you must publicly Declare what type of land you found. You may lie (e.g., claim a Goldmine is Plains). Private Truth is visible only to you."
        },
        {
          heading: "Interception (Challenging)",
          content: "When a rival expands, a 'Challenge Alert' appears for 5 seconds. You may interrupt their turn to Challenge their claim.",
          tableData: [
            { label: "Trust", value: "The rival keeps the tile. If they lied, they get away with it." },
            { label: "Challenge", value: "The tile is revealed immediately." }
          ]
        },
        {
          heading: "Outcomes & Penalties",
          content: "Penalties depend on the selected Ruleset (Standard vs Casual).",
          tableData: [
            { label: "Caught Lying", value: "The Bluffer loses the tile and Reputation/VP." },
            { label: "False Accusation (Standard)", value: "You receive a 'Turn Lost' penalty and must Pass immediately next turn." },
            { label: "False Accusation (Casual)", value: "You pay a fine of 2 Gold to the accused." }
          ]
        },
        {
          heading: "Strategic Warning (Standard Mode)",
          content: "Strategic Note: This means a failed challenge is extremely risky if you haven't taken your main action for the round yet, as the 'Turn Lost' penalty effectively ends your round instantly."
        }
      ]
    },
    {
      id: "modes",
      title: "Game Modes & AI",
      icon: <Users size={18} />,
      sections: [
        {
          heading: "AI Psychology (Challenge Mode)",
          content: [
            "Rivals track 'Fear' (your military capability) and 'Suspicion' (your intent).",
            "Coalitions: If you lead by too much VP, rivals may form an alliance and focus attacks on you.",
            "Paranoia: High suspicion makes AI more likely to Challenge your bluffs."
          ]
        },
        {
          heading: "Rulesets",
          tableData: [
            { label: "Standard", value: "Hardcore. False Accusations = Turn Lost. Recommended for strategy veterans." },
            { label: "Casual", value: "Forgiving. False Accusations = Gold Fine. Recommended for learning." }
          ]
        }
      ]
    },
    {
      id: "classes",
      title: "The Council (Classes)",
      icon: <Crown size={18} />,
      sections: [
        {
          heading: "Citizen Roles",
          content: "Chosen secretly at the start of Phase II. Costs increase with Fatigue.",
          tableData: [
            { label: "Warrior", value: "Action: Attack. Loot 1 Resource on win. Base Cost: 1 Grain." },
            { label: "Builder", value: "Action: Fortify. +1 Defense/Production. Base Cost: 2 Stone." },
            { label: "Merchant", value: "Action: Trade. 2 Grain -> 1 Gold. Base Cost: 2 Grain." },
            { label: "Explorer", value: "Action: Expand. Claim Neutral/Fog tiles. Base Cost: 1 Grain." }
          ]
        }
      ]
    },
    {
      id: "relics",
      title: "Relic Powers",
      icon: <Zap size={18} />,
      sections: [
        {
          heading: "The 'One Crown' Rule",
          content: "You may only hold ONE active Relic Power. Finding a new one replaces the old."
        },
        {
          heading: "Power List",
          tableData: [
            { label: "Crown of Prosperity", value: "Passive Income: +1 Grain & +1 Gold every round." },
            { label: "Mason's Hammer", value: "Free Fortify: First Fortify each round is free." },
            { label: "Warlord's Banner", value: "+1 Combat Strength (Permanent)." },
            { label: "Merchant's Seal", value: "Free Trade: First Trade each round is free." },
            { label: "Legion's Stride", value: "Double Time: Pay 2 Gold to take 2 Actions." }
          ]
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
            "Loss/Tie: Nothing changes. Attacker still pays cost."
          ]
        }
      ]
    },
    {
      id: "map",
      title: "Map & Events",
      icon: <Map size={18} />,
      sections: [
        {
          heading: "Tile Types",
          tableData: [
            { label: "Plains", value: "Produces Grain (Food/Fuel)" },
            { label: "Mountains", value: "Produces Stone (Building)" },
            { label: "Goldmine", value: "Produces Gold (Wildcard/VP)" },
            { label: "Ruins", value: "One-time scavenge for Event Cards." },
            { label: "Relic Sites", value: "Grants Relic Token + Power. (Rare)" }
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
          heading: "Scoring",
          tableData: [
            { label: "Territory", value: "1 VP per Tile (Relic Sites = 2 VP)" },
            { label: "Fortifications", value: "+1 VP per Fort" },
            { label: "Relic Tokens", value: "2 VP per Token" },
            { label: "Secret Directives", value: "Variable VP (Check Sidebar)" },
            { label: "Public Imperatives", value: "Variable VP (Revealed Rounds 2-4)" }
          ]
        }
      ]
    },
    {
      id: "faq",
      title: "FAQ & Errata",
      icon: <HelpCircle size={18} />,
      sections: [
        {
          heading: "Q: What is the difference between a Ruin and a Relic Site?",
          content: "A: Ruins are temporary. When you enter them, you immediately draw a card (Scavenge) and the tile becomes a Plains. You do not keep the \"Ruin\" tile. Relic Sites are permanent territory. You claim them like any other land. They produce Relic resources and, if revealed, upgrade your future Event Cards."
        },
        {
          heading: "Q: If I claim a Relic Site, do I draw a card immediately?",
          content: "A: No. Relic Sites are territory. You only draw cards during the Events Phase (Phase V). Faking a Relic Site is a safe bluff because you don't have to perform any special action (like drawing a card) when you claim it."
        },
        {
          heading: "Q: What happens if we run out of Resource Tokens?",
          content: "A: Unlimited Components. Use a substitute (coin, dice). Your wealth is not capped by the limit of the physical components."
        },
        {
          heading: "Q: If I end with 5 Gold, do I get the Treasurer VP?",
          content: "A: No. You need 6 Gold or more. 5 Gold scores 0 VP for that specific objective."
        },
        {
          heading: "Advanced Strategy: The Art of Bluffing",
          content: [
            "Q: Why would I fake having a Relic?",
            "• To Hide Economy: If you claim a Relic but the tile is actually Gold, you secretly collect Gold while opponents think you are poor.",
            "• To Deter Attacks: Opponents hunting for Gold may ignore a 'Relic Site.' Conversely, opponents hunting for Relics might walk into a trap.",
            "• To Feint Strength: Controlling Relics implies you might have powerful Event Card abilities. Faking this might make enemies hesitate to attack you.",
            " ",
            "Q: Is it suspicious if I claim a Relic but don't pick up an Event Card immediately?",
            "• A: NO. This is the key to the bluff.",
            "• Ruins: You must pick up a card immediately.",
            "• Relic Sites: You do NOT pick up a card when claiming. You only use the power later.",
            "• The Bluff: Because there is no 'card drawing' action required, faking a Relic looks exactly the same physically as claiming a real one. There is no 'tell'.",
            " ",
            "Q: Can I show my cards or treasury to prove I'm telling the truth?",
            "• A: No. You may say anything you want ('I really have 10 Gold!'), but you may never reveal hidden components to prove it. The only way to verify truth is through game mechanics like Espionage or the End Game Audit."
          ]
        }
      ]
    },
    {
      id: "log",
      title: "The Strategos' Log",
      icon: <Scroll size={18} />,
      sections: [
        {
          heading: "Entry I: Arrival in the Mist (Setup)",
          content: "The Twin Suns aligned at dawn. As the prophecy foretold, the Great Eclipse fell across the land, shrouding the borders of the known world in mist. Our maps are useless now. I have ordered the establishment of our Capital on the northern ridge. The men believe we are isolated, but I know the truth of this land: trust is a currency more volatile than gold. We must paint this map in our colors before the light returns."
        },
        {
          heading: "Imperial Directive: The World",
          content: [
            "The Map: The world is built from a grid of face-down hexagonal tiles (5x5 or 7x7) representing the Fog of War.",
            "The Capital: Players draft a faction and place 1 Control Marker on any face-down tile on the map's outer edge to begin their empire.",
            "The Treasury: You begin with a secret stash of 2 Grain, 1 Stone, and 1 Gold hidden in your Imperial Treasury Box.",
            "The Objective: The goal is to have the most Victory Points (VP) after the 5th Eclipse."
          ]
        },
        {
          heading: "Entry II: The First Lie (Fog of War & Intel)",
          content: "I have inspected our new territory personally. It is a rocky wasteland, rich in Stone but poor in food. However, if the Verdant Keepers knew we were starving, they would attack immediately. So, I have ordered the banners raised claiming this land is fertile farmland. Let them think we are farmers. We shall build walls while they sleep."
        },
        {
          heading: "Imperial Directive: Deception & Truth",
          content: [
            "Private Intel: You may privately peek at any tile you stand on or control. You know the truth; opponents only know what you tell them.",
            "The Declaration: When you claim a tile, you must place a Resource Token on top of it. This is your \"Public Declaration\".",
            "The Lie: You are allowed to lie. For example, you may place a Gold token on a Plains tile.",
            "The Capital Exception: You must tell the truth about your starting Capital tile."
          ]
        },
        {
          heading: "Entry III: The Harvest (Income Phase)",
          content: "The Eclipse darkens the sky, marking the start of our cycle. We tallied our resources in the dark, away from prying eyes. As expected, the \"farmland\" produced nothing, but our stone quarries are full. We took what the land truly gave us, not what the banners claimed."
        },
        {
          heading: "Imperial Directive: Phase II (Income)",
          content: [
            "Secret Income: Players simultaneously take resources from the supply corresponding to the TRUE type of their tiles, not the tokens on top.",
            "Production Base: Gain 1 Resource per tile matching its true type (Grain/Stone/Gold/Relic).",
            "Fortified: Gain +1 extra Resource if the tile has a Fortification.",
            "Capital: Produces 1 Grain, 1 Stone, and 1 Gold.",
            "The Ledger: Use your Imperial Ledger to track income without lifting tiles, which would reveal your secrets."
          ]
        },
        {
          heading: "Entry IV: The Council (Role Selection)",
          content: "The Senate demanded we focus on trade to fix our grain shortage, but I overruled them. We need stone for the walls first. I sent for the Architects. The Merchant guild will have to wait until the walls are high enough to protect their gold."
        },
        {
          heading: "Imperial Directive: Phase III (The Council)",
          content: [
            "Selection: Secretly choose ONE Citizen Card from your hand and place it face-down.",
            "Builder: Pay 2 Stone to place a Fortification Token (+1 Defense, +1 Income).",
            "Merchant: Trade 2 Grain with the bank to gain 1 Gold.",
            "Explorer: Pay 1 Grain to move to and claim a new tile.",
            "Warrior: Pay 1 Grain to attack an enemy tile."
          ]
        },
        {
          heading: "Entry V: Expansion (Action Cycle)",
          content: "With our walls secure, I deployed the Explorer corps. They pushed into the eastern ruins. It was a dangerous gamble—the ancient structures collapsed upon entry, but we scavenged valuable technology from the debris. We now hold the eastern flank, though our supplies are running low. I had to barter our last gold reserves for emergency grain just to keep the troops moving."
        },
        {
          heading: "Imperial Directive: Phase IV (Action)",
          content: [
            "Taking Turns: Starting with the 1st player, take turns performing one action until everyone passes.",
            "Ruins (Special Case): If you expand into a Ruins tile, you do not claim it. Instead, draw an Event Card immediately, resolve it, and then turn the tile into a standard Plains tile (Grain).",
            "Emergency Market: At any time during your turn, you may trade 3 of ANY resource to gain 1 Grain. This is vital if you are stuck.",
            "Maneuver: You may move one of your control markers to an adjacent tile you already control for free."
          ]
        },
        {
          heading: "Entry VI: Contact (Combat & Challenge)",
          content: "The Aurelian Dynasty spotted our movement. They claimed a nearby ridge was a \"Goldmine.\" I knew it was a lie—geographically impossible. I shouted my challenge across the valley. They faltered, their deception exposed. We seized the ridge without drawing a sword. Emboldened, I ordered the Warriors to breach their main lines. Their soldiers were strong, but our fortifications held. We drove them back and seized their supply trains in the confusion."
        },
        {
          heading: "Imperial Directive: Combat & Challenges",
          content: [
            "The Challenge: If you suspect a lie when a token is placed, shout \"Challenge!\"",
            "If They Lied: You gain +1 VP, and they lose the tile immediately.",
            "If They Told Truth: You receive a \"Turn Lost\" Penalty Token and must skip your next turn.",
            "Combat Roll: Attacker and Defender each roll 1d6.",
            "Modifiers: Attacker gets +1 (Warrior Bonus). Defender gets +1 if Fortified.",
            "Victory: High total wins. Defenders win ties.",
            "Spoils: If Attacker wins, they displace the defender, destroy any fort, and blindly steal 1 Resource from the Defender's box (Pillage)."
          ]
        },
        {
          heading: "Entry VII: The Twin Suns Return (End Game)",
          content: "Five Eclipses have passed. The light is returning. The \"Fog of War\" is lifting, and the grand audit has begun. The Aurelian Dynasty claimed to hold vast gold mines to the south, but the light revealed only barren rocks. Their empire crumbled under the weight of their perjury as the auditors stripped them of their lands. We, however, stood tall. Our walls are real. Our gold is real. The throne is ours."
        },
        {
          heading: "Imperial Directive: The Audit (End Game)",
          content: [
            "Reveal: At the end of Round 5, flip ALL map tiles face-up.",
            "Judgment: Compare every Declaration Token to the actual tile art. If they do not match, the owner loses the tile and its VP immediately. Lies crumble in the light.",
            "Final Scoring: +1 VP per Controlled Tile.",
            "+1 VP per Fortification.",
            "+1 VP per 3 Resources held in Treasury.",
            "Score Secret Directives and Public Imperatives."
          ]
        }
      ]
    },
    {
      id: "credits",
      title: "Credits & Acknowledgments",
      icon: <Info size={18} />,
      sections: [
        {
          heading: "ECLIPSE OF EMPIRES II Prototype Edition v2.4",
          content: [
            "Game Design & Concept: Peter Loizou",
            "Playtesting & Development: Tested in Bridport, UK.",
            "Status: Work in Progress. Not for resale."
          ]
        },
        {
          heading: "Special Thanks",
          content: "To the strategists at Julian's Monday Night Chess Club for their invaluable feedback, tactical insight, and patience in the fog of war."
        },
        {
          heading: "Contact & Feedback",
          tableData: [
              { label: "Feedback", value: "Email Designer", href: "mailto:peterloizou@gmail.com" }
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
    <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
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
            <span className="text-[10px] text-slate-500 uppercase tracking-widest hidden md:block">Ver 2.4-Dev</span>
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

                          {section.tableData && (
                              <div className="grid gap-2">
                                  {section.tableData.map((row, i) => (
                                      <div key={i} className="flex flex-col md:flex-row md:items-center justify-between bg-black/20 p-3 rounded border border-slate-700/50 hover:border-slate-600 transition-colors">
                                          <span className="font-bold text-slate-200 text-sm mb-1 md:mb-0 w-1/3">{row.label}</span>
                                          {row.href ? (
                                              <a href={row.href} className="text-[#fcd34d] hover:underline hover:text-yellow-300 text-xs md:text-sm md:text-right flex-1 transition-colors">
                                                  {row.value}
                                              </a>
                                          ) : row.value.includes('@') ? (
                                              <a href={`mailto:${row.value}`} className="text-[#fcd34d] hover:underline hover:text-yellow-300 text-xs md:text-sm md:text-right flex-1 transition-colors font-mono">
                                                  {row.value}
                                              </a>
                                          ) : (
                                              <span className="text-slate-400 text-xs md:text-sm md:text-right flex-1">{row.value}</span>
                                          )}
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  ))}
              </div>

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
