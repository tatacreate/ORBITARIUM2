import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  GripHorizontal,
  Palette,
  Radio,
  RotateCcw,
  Shuffle,
  X,
} from 'lucide-react';
import { getCatalogParts } from '../engine/physics';
import type { NasaRocketSpec } from '../engine/orbitalMechanics';
import type { GamePhase, MissionConfig, TelemetryReport } from '../types/mission';
import type {
  ArchitectMode,
  GroundCommState,
  LaunchBurnState,
  NasaInstrument,
  NasaMissionSegment,
  NasaObjectiveSpec,
  OrbitalState,
  PropulsionType,
  SpacecraftOpsState,
  SurfaceLandmark,
  SystemVerificationScorecard,
} from '../types/nasaSegments';
import type { UnifiedGameSnapshot } from '../game/UnifiedMissionCanvas';
import {
  CartoonAstronautFace,
  DEFAULT_ASTRONAUT_APPEARANCE,
  HAIR_COLORS,
  SKIN_TONES,
  SUIT_PALETTES,
  VISOR_TINTS,
  type AstronautAppearance,
  type AstronautMood,
  type ChestPatchId,
  type FaceAccessoryId,
  type HairStyle,
  type SuitColorId,
  type VisorTintId,
} from './CartoonAstronautFace';

const APPEARANCE_STORAGE_KEY = 'orbitarium_astra_appearance_v1';

function loadSavedAppearance(): AstronautAppearance {
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return DEFAULT_ASTRONAUT_APPEARANCE;
    return { ...DEFAULT_ASTRONAUT_APPEARANCE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ASTRONAUT_APPEARANCE;
  }
}

interface AstraAdvisorProps {
  appView: 'title' | 'nasa-architect' | 'classic-hangar';
  // NASA Architect props
  nasaSegment: NasaMissionSegment;
  architectMode: ArchitectMode;
  selectedObjective: NasaObjectiveSpec;
  selectedRocket: NasaRocketSpec;
  selectedPropulsion: PropulsionType;
  propellantBudgetKg: number;
  nasaInstruments: NasaInstrument[];
  burnState: LaunchBurnState;
  orbitState: OrbitalState;
  groundComm: GroundCommState;
  opsState: SpacecraftOpsState;
  landmarks: SurfaceLandmark[];
  verificationScorecard: SystemVerificationScorecard;
  // Classic Hangar props
  classicPhase: GamePhase;
  classicConfig: MissionConfig;
  classicTelemetry: TelemetryReport;
  activeAnomalyTitle?: string | null;
  unifiedSnapshot?: UnifiedGameSnapshot | null;
  onOpenDictionary: () => void;
}

interface NpcDialogueScript {
  mood: AstronautMood;
  stateLabel: string;
  headline: string;
  tips: string[];
}

function buildNpcScript(props: AstraAdvisorProps): NpcDialogueScript {
  const {
    appView,
    nasaSegment,
    architectMode,
    selectedObjective,
    selectedRocket,
    selectedPropulsion,
    propellantBudgetKg,
    nasaInstruments,
    burnState,
    orbitState,
    groundComm,
    opsState,
    landmarks,
    verificationScorecard,
    classicPhase,
    classicConfig,
    classicTelemetry,
    activeAnomalyTitle,
    unifiedSnapshot,
  } = props;

  // 1. HOMEPAGE SCRIPT
  if (appView === 'title') {
    return {
      mood: 'excited',
      stateLabel: 'On Deck',
      headline: 'Crew Chief A.S.T.R.A. Reporting!',
      tips: [
        'Hey Cadet! I am A.S.T.R.A., your mission crewmate. Click "Launch Mission Architect" to fly a continuous mission from liftoff to planet discovery!',
        'Want to team up with friends? Pick "Team Room (1–4)" to assemble a spacecraft together in Co-Op or Competitive mode.',
        'Psst—click the Suit icon at the top of my radio card anytime to customize my spacesuit, hair, visor tint, and mission patch!',
      ],
    };
  }

  // 2. UNIFIED CONTINUOUS MISSION SCRIPT
  if (appView === 'nasa-architect' && unifiedSnapshot) {
    if (unifiedSnapshot.phase === 'briefing') {
      return {
        mood: 'excited',
        stateLabel: 'Briefing',
        headline: 'Pick One Connected Mission!',
        tips: [
          'Every drop of fuel you save in Launch stays in your tank in Orbit, and every Data Orb you collect gets beamed down at the end!',
          'Try Earth Climate Guard for hurricanes, Lunar Gateway Rescue for Canadarm3 grappling, or Mars Water Hunter for Solar Shielding!',
        ],
      };
    }
    if (unifiedSnapshot.phase === 'launch' || unifiedSnapshot.phase === 'transition_orbit') {
      return {
        mood: 'warning',
        stateLabel: 'Ascent',
        headline: 'Ride the Arc & Cut Inside Green Ring!',
        tips: [
          'Use A / D (or drag across the sky) to fly through Gold Rings for +7% bonus fuel!',
          'Press SPACE (or tap CUT ENGINE) when you reach the green Target Orbit Ring at the top—then watch the camera pull back into orbit!',
        ],
      };
    }
    if (unifiedSnapshot.phase === 'orbit') {
      if (unifiedSnapshot.activeThreat === 'debris') {
        return {
          mood: 'alert',
          stateLabel: 'Debris!',
          headline: 'Dodge the Red Trajectory Line!',
          tips: [
            'Use W/S (Up/Down) or A/D (Left/Right) to slip cleanly out of the red dotted meteor lane!',
          ],
        };
      }
      if (unifiedSnapshot.activeThreat === 'solar-wave') {
        return {
          mood: 'alert',
          stateLabel: 'Solar Wave!',
          headline: 'Hold [SHIFT] or [E] for Solar Shield!',
          tips: [
            'A golden solar storm wave is sweeping across space! Hold SHIFT or E (or the SHIELD button) to deflect it cleanly with zero hull damage!',
          ],
        };
      }
      if (unifiedSnapshot.missionId === 'lunar-rescue') {
        return {
          mood: 'nominal',
          stateLabel: 'Canadarm',
          headline: 'Reel In the Gateway Pod!',
          tips: [
            'Use Left/Right to catch up or slow down, Up/Down to match height, then hold SPACE inside the dashed ring to extend Canadarm3!',
          ],
        };
      }
      return {
        mood: 'nominal',
        stateLabel: 'Orbit Ops',
        headline: `Collect ${unifiedSnapshot.orbGoal} Glowing Orbs!`,
        tips: [
          `Fly over pulsing surface landmarks (${unifiedSnapshot.orbsCollected}/${unifiedSnapshot.orbGoal} collected) and hold SPACE to fill the scan ring!`,
          'Tip: Hold A / Left Arrow anytime to brake or hover cleanly over a target!',
        ],
      };
    }
    if (unifiedSnapshot.phase === 'beamdown') {
      return {
        mood: 'excited',
        stateLabel: 'Beam-Down',
        headline: `Aim for the Emerald Dish Cone!`,
        tips: [
          `Steer your ship into the glowing ground dish cone and hold SPACE to beam down your ${unifiedSnapshot.orbGoal} collected orbs (${unifiedSnapshot.orbsBeamed}/${unifiedSnapshot.orbGoal} sent)!`,
        ],
      };
    }
    return {
      mood: 'excited',
      stateLabel: `${unifiedSnapshot.starsEarned} Stars!`,
      headline: 'Mission Accomplished!',
      tips: [
        'Awesome flying! Check your unlocked Discovery Cards and Fuel Bonus—then hit Play Next Mission!',
      ],
    };
  }

  // 2B. FALLBACK NASA 4-SEGMENT ARCADE MISSION SCRIPTS
  if (appView === 'nasa-architect') {
    const activeInstruments = nasaInstruments.filter((i) => i.enabled);
    const totalWetMassKg =
      420 + propellantBudgetKg + activeInstruments.reduce((sum, i) => sum + i.massKg, 0);

    if (nasaSegment === 'setup') {
      if (totalWetMassKg > selectedObjective.maxPayloadMassKg) {
        return {
          mood: 'warning',
          stateLabel: 'Too Heavy',
          headline: 'Lighten Up Before Liftoff!',
          tips: [
            'Whoa—your spacecraft stack is a bit too heavy! Turn off one optional gadget or lower the Fuel Tank slider until the bar shows GOOD FIT!',
            selectedPropulsion === 'chemical'
              ? 'Pro tip: Blue Ion Thrusters are super light and stretch your fuel miles farther!'
              : 'You can also switch to Free Play Sandbox at the top to try any gadget combo with zero limits!',
          ],
        };
      }

      const regimeHint: Record<NasaObjectiveSpec['regime'], string> = {
        leo: 'Arctic Earth Patrol! Pack the Cloud-Piercing Radar so you can peek straight through thick snowstorms!',
        geo: 'Park high above Earth as a weather watcher—grab the Super Planet Camera and Rainbow Scanner!',
        heo: 'Loop high over the North Pole to catch dancing Northern Lights with the Aurora Detector!',
        lunar: 'Moon South Pole Hunt! Pack the Canadarm3 Robot Claw and Radar to hunt hidden crater ice!',
        lagrange: 'Deep-Space Telescope! Switch on your Rainbow Scanner to peek at glowing newborn stars!',
        interplanetary: 'Red Planet Explorer! Blue Ion Thrusters are awesome for the long flight out to Mars!',
      };

      return {
        mood: 'nominal',
        stateLabel: architectMode === 'sandbox' ? 'Free Play' : 'Ready!',
        headline: `Next Stop: ${selectedObjective.targetBody.toUpperCase()}!`,
        tips: [
          regimeHint[selectedObjective.regime],
          `You have ${activeInstruments.length} cool gadgets packed and ready. Hit "1. Blast Off!" when you are set!`,
          'You can drag my radio card anywhere or click the palette icon to customize my spacesuit!',
        ],
      };
    }

    if (nasaSegment === 'launch') {
      if (totalWetMassKg > selectedRocket.maxPayloadKg) {
        return {
          mood: 'alert',
          stateLabel: 'Heavy Rocket',
          headline: `Need a Bigger Rocket!`,
          tips: [
            `Your craft is too chunky for ${selectedRocket.name}! Click a bigger rocket card on the left so we can blast off cleanly.`,
            'Or pop back to Setup and turn off a heavy gadget.',
          ],
        };
      }
      if (burnState.status === 'failed') {
        return {
          mood: 'alert',
          stateLabel: 'Try Again',
          headline: 'Oops—Reset the Launchpad!',
          tips: [
            'Hit "Reset Pad" and ride the glowing green sky tunnel up! Use A/D (or drag on the sky) to dodge red storm clouds and snag gold fuel rings.',
            'Once you reach the green Target Orbit bar at the top, smash DEPLOY SATELLITE!',
          ],
        };
      }
      if (burnState.status === 'burning') {
        return {
          mood: 'warning',
          stateLabel: 'Blasting Off',
          headline: 'Stay Inside the Green Tunnel!',
          tips: [
            'Hold SPACE (or HOLD TO BOOST) to roar upward! Steer Left/Right with A/D to scoop up glowing Gold Fuel Rings!',
            'Dodge those grumpy red storm clouds so your rocket stays steady!',
          ],
        };
      }
      if (burnState.status === 'completed' && burnState.outcomeType === 'nominal') {
        return {
          mood: 'excited',
          stateLabel: 'In Space!',
          headline: 'Woohoo! Clean Orbit Drop!',
          tips: [
            'Awesome flying, Commander! Hit "2. Fly in Space!" to slingshot around the planet and snap discoveries!',
            'Want to beat your Gold Ring score? Hit Reset Pad anytime for another arcade run!',
          ],
        };
      }
      return {
        mood: 'nominal',
        stateLabel: 'Launchpad',
        headline: 'Ready for Arcade Liftoff!',
        tips: [
          'Pick a rocket on the left, then hold SPACE or press HOLD TO BOOST to blast into the sky!',
          'Steer through the glowing green tunnel, grab Gold Fuel Rings, and hit the green Orbit Zone at the top!',
        ],
      };
    }

    if (nasaSegment === 'space') {
      if (opsState.activeHazard) {
        const hz = opsState.activeHazard;
        if (hz.type === 'debris') {
          return {
            mood: 'alert',
            stateLabel: 'Junk Alert!',
            headline: `Dodge That Space Junk! (${Math.max(0, hz.timeRemainingSec).toFixed(0)}s)`,
            tips: [
              'Watch out! Smash DODGE UP or DODGE DOWN on the red alert banner—or fire a quick thruster burn—before time runs out!',
            ],
          };
        }
        if (hz.type === 'solar-flare') {
          return {
            mood: 'alert',
            stateLabel: 'Solar Flare!',
            headline: `Flip the Heat Shield! (${Math.max(0, hz.timeRemainingSec).toFixed(0)}s)`,
            tips: [
              'Sun storm incoming! Smash FLIP HEAT SHIELD on the alert bar and switch off an extra gadget in Gadgets & Solar!',
            ],
          };
        }
        return {
          mood: 'warning',
          stateLabel: 'Low Battery',
          headline: `Save Battery Power! (${Math.max(0, hz.timeRemainingSec).toFixed(0)}s)`,
          tips: [
            'We are cruising through planet shadow! Switch off extra gadgets in the Gadgets & Solar tab until power turns green.',
          ],
        };
      }

      const capturedCount = landmarks.filter((l) => l.captured).length;
      if (opsState.canadarm.completedCount === 0) {
        return {
          mood: 'nominal',
          stateLabel: 'Space Ops',
          headline: 'Slingshot, Snap & Robot Claw!',
          tips: [
            'Drag the glowing Amber Arrow right on the space screen to preview a new orbit—then hit FIRE THRUSTERS!',
            'When your green scanner beam hits a pulsing circle on the planet, smash SNAP PHOTO! to unlock an illustrated discovery!',
            'Don’t miss the Canadarm Claw tab—steer the robot arm over the floating pod and click GRAB POD!',
          ],
        };
      }

      if (capturedCount < 3) {
        return {
          mood: 'excited',
          stateLabel: 'Snapping!',
          headline: `Nice Claw Grab! ${capturedCount}/${landmarks.length} Snapped`,
          tips: [
            'Keep snapping glowing planet targets whenever your green beam sweeps over them!',
            'When you have a few photos saved up, head to Step 3: Signal Link to beam them back to Earth!',
          ],
        };
      }

      return {
        mood: 'excited',
        stateLabel: 'Full Album',
        headline: 'Memory Full of Cool Photos!',
        tips: [
          `Sweet! You snapped ${capturedCount} planet discoveries! Hop over to "3. Signal Link" to aim the laser dish and beam them home!`,
        ],
      };
    }

    if (nasaSegment === 'ground') {
      const pending = landmarks.filter((l) => l.captured && !l.downlinked).length;
      if (!groundComm.hasLineOfSight) {
        return {
          mood: 'warning',
          stateLabel: 'Blocked',
          headline: 'Planet Blocking the Laser!',
          tips: [
            'The planet is in the way right now! Look at the station list on the right and click any dish with a green CLEAR SKY badge!',
            'Arctic Canada Dish catches northern orbits super often!',
          ],
        };
      }
      if (groundComm.dishLockQualityPct < 60) {
        return {
          mood: 'warning',
          stateLabel: 'Aim Dish',
          headline: 'Center the Sky Circle!',
          tips: [
            'Click or drag anywhere in the sky to point your dish beam onto the cute floating satellite!',
            'Or hit "Snap Dish to Satellite" or "Wide Beam (Easy)" right below the sky screen!',
          ],
        };
      }
      return {
        mood: 'excited',
        stateLabel: 'Laser On!',
        headline: 'Data Streaming Home!',
        tips: [
          pending > 0
            ? `Boom! Click "Beam ${pending} Photo(s) Home!" to fire a golden packet burst down the laser beam!`
            : 'Awesome laser link! Click "See My Discoveries!" to open your illustrated gallery and Star Rewards!',
        ],
      };
    }

    if (nasaSegment === 'user') {
      const downlinked = landmarks.filter((l) => l.downlinked).length;
      return {
        mood: downlinked >= 2 ? 'excited' : 'nominal',
        stateLabel: 'Gallery!',
        headline: `${downlinked}/${landmarks.length} Discoveries Unlocked`,
        tips: [
          downlinked >= 3
            ? 'Superstar Commander! Enjoy your illustrated Discovery Cards and Mission Stars—or play a new planet mission anytime!'
            : 'Want to unlock more cards and reach 3 Gold Stars? Jump back to Space to snap more photos, then Beam them in Step 3!',
        ],
      };
    }

    // conops (3D Planet View)
    return {
      mood: 'excited',
      stateLabel: '3D Globe',
      headline: 'Live 3D Planet Explorer',
      tips: [
        'Watch your spacecraft glide around the 3D globe! Try the Craft Cam button at the top right for a close-up!',
        'Click any of the four colorful mission cards above to jump straight back into action.',
      ],
    };
  }

  // 3. CLASSIC TEAM HANGAR SCRIPTS
  const { objective, orbit, power, comms, launchVehicle, instruments } = getCatalogParts(classicConfig);

  if (classicPhase === 'briefing') {
    return {
      mood: 'excited',
      stateLabel: 'Team Brief',
      headline: `Target: ${objective.title}`,
      tips: [
        objective.targetBody === 'europa'
          ? 'Europa orbits 5.2× farther from the Sun than Earth—sunlight is super dim there, so plan for Nuclear RTG power and radiation armor!'
          : objective.targetBody === 'mars'
            ? 'Mars is 1.52 AU away—pack extra solar wings or a High-Gain Dish so rover relays reach Earth cleanly!'
            : objective.targetBody === 'moon'
              ? 'South Pole craters stay in deep shadow! Ice Radar and an Elemental Mapper make a winning combo.'
              : 'Pick your mission scenario, role seat, and difficulty mode—then head into the 3D Assembly Bay!',
        'Co-Op tip: Each teammate can claim a seat (Planner, Spacecraft Engineer, Science Lead, Comms Officer) and vote ready before launch.',
      ],
    };
  }

  if (classicPhase === 'assembly') {
    if (classicTelemetry.powerStatus === 'Critical') {
      return {
        mood: 'alert',
        stateLabel: 'Power Low',
        headline: 'Power Warning — Solar Drop-Off!',
        tips: [
          `Your spacecraft needs ${Math.abs(classicTelemetry.powerMarginW)}W more electricity at ${orbit.solarDistanceAU} AU. Upgrade to Deployable Wings or an RTG Nuclear battery!`,
          `Current power system: ${power.shortLabel}. Watch the live resource bar flip green as soon as you balance watts.`,
        ],
      };
    }
    if (classicTelemetry.dataStatus === 'Critical') {
      return {
        mood: 'warning',
        stateLabel: 'Bottleneck',
        headline: 'Data Bottleneck Alert!',
        tips: [
          `Your ${instruments[0]?.shortName || 'instruments'} generate ${classicTelemetry.dataGeneratedGBDay} GB/day, but ${comms.shortLabel} can only beam ${classicTelemetry.downlinkCapacityGBDay} GB/day. Upgrade to a High-Gain Dish!`,
        ],
      };
    }
    if (classicTelemetry.budgetStatus === 'Critical') {
      return {
        mood: 'warning',
        stateLabel: 'Over Budget',
        headline: 'Over Agency Budget!',
        tips: [
          `Total cost is $${classicTelemetry.totalCostM}M vs your $${classicTelemetry.budgetCapM}M cap. Trim an optional subsystem or test a lighter bus to save millions.`,
        ],
      };
    }
    return {
      mood: classicTelemetry.synergies.length > 0 ? 'excited' : 'nominal',
      stateLabel: 'Assembly',
      headline: classicTelemetry.synergies.length > 0 ? 'Sweet Engineering Synergy!' : '3D Assembly Bay Online',
      tips: [
        classicTelemetry.synergies.length > 0
          ? `${classicTelemetry.synergies[0]}! Watch your live gauges—you are ready to pick your Rocket & Orbit in Phase 3.`
          : `Try swapping parts and watch the 3D spacecraft react! Heavy sensors boost Science, while ${power.shortLabel} keeps systems energized.`,
      ],
    };
  }

  if (classicPhase === 'planner') {
    if (classicTelemetry.massStatus === 'Critical') {
      return {
        mood: 'alert',
        stateLabel: 'Overweight',
        headline: 'Rocket Overload Check!',
        tips: [
          `Your fueled spacecraft (${classicTelemetry.wetMassKg} kg) is too heavy for ${launchVehicle.name} (${classicTelemetry.payloadCapacityKg} kg limit). Upgrade your rocket or try a fuel-saving orbit!`,
        ],
      };
    }
    return {
      mood: classicTelemetry.launchReady ? 'excited' : 'warning',
      stateLabel: classicTelemetry.launchReady ? 'Cleared' : 'Check Flag',
      headline: classicTelemetry.launchReady ? 'Trajectory Cleared for Launch!' : 'Pre-Launch Check Flagged',
      tips: [
        classicTelemetry.launchReady
          ? `${launchVehicle.name} easily carries your ${classicTelemetry.wetMassKg} kg probe into ${orbit.shortName}. Hit Launch when ready!`
          : classicTelemetry.advisories[0]?.plainTerms || 'Check your mass, power, and link margins before launch.',
      ],
    };
  }

  if (classicPhase === 'simulating') {
    if (activeAnomalyTitle) {
      return {
        mood: 'alert',
        stateLabel: 'Crisis',
        headline: 'Live Space Crisis!',
        tips: [
          `Respond to "${activeAnomalyTitle}" carefully—protecting spacecraft margin keeps you alive, while bold science grabs bonus points!`,
        ],
      };
    }
    return {
      mood: 'excited',
      stateLabel: 'Telemetry',
      headline: 'Telemetry Streaming Live',
      tips: [
        'Watch your live power & data lines! Deep-space missions face solar flares, micrometeoroids, and Earth ground-station rainstorms.',
      ],
    };
  }

  // debrief
  return {
    mood: classicTelemetry.launchReady ? 'excited' : 'warning',
    stateLabel: 'Debrief',
    headline: 'Mission Debrief Ready',
    tips: [
      'Check which subsystems drove your score, then click "Modify & Re-Simulate" to beat your personal record!',
    ],
  };
}

export function AstraAdvisor(props: AstraAdvisorProps) {
  const { onOpenDictionary } = props;

  const [appearance, setAppearance] = useState<AstronautAppearance>(loadSavedAppearance);
  const [minimized, setMinimized] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  // Draggable follower offset (defaults to bottom-right dock)
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStateRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  useEffect(() => {
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
    } catch {
      // ignore storage quota errors
    }
  }, [appearance]);

  const script = useMemo(() => buildNpcScript(props), [props]);

  // Reset tip index cleanly when the headline/context changes
  useEffect(() => {
    setTipIndex(0);
  }, [script.headline]);

  const activeTip = script.tips[tipIndex % script.tips.length] ?? script.tips[0];

  const moodAccent: Record<AstronautMood, { border: string; pillText: string }> = {
    nominal: { border: 'border-cyan-500/45', pillText: 'text-cyan-300' },
    excited: { border: 'border-emerald-500/45', pillText: 'text-emerald-300' },
    warning: { border: 'border-amber-500/55', pillText: 'text-amber-300' },
    alert: { border: 'border-rose-500/65', pillText: 'text-rose-300' },
  };
  const palette = moodAccent[script.mood];

  // Drag handlers on header bar so A.S.T.R.A. follows you anywhere on screen
  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragStateRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.dragging) return;
    const dx = e.clientX - dragStateRef.current.startX;
    const dy = e.clientY - dragStateRef.current.startY;
    const maxLeft = -(window.innerWidth - 380);
    const maxUp = -(window.innerHeight - 160);
    setOffset({
      x: Math.max(maxLeft, Math.min(12, dragStateRef.current.origX + dx)),
      y: Math.max(maxUp, Math.min(12, dragStateRef.current.origY + dy)),
    });
  };

  const handleHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.dragging) return;
    dragStateRef.current.dragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore if capture already released
    }
  };

  const handleRandomizeAppearance = () => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    setAppearance({
      skinTone: pick(SKIN_TONES).hex,
      hairStyle: pick<HairStyle>(['spiky', 'bob', 'curly', 'buzz', 'buns', 'none']),
      hairColor: pick(HAIR_COLORS).hex,
      suitColor: pick<SuitColorId>(['white', 'cobalt', 'amber', 'teal', 'mars', 'slate']),
      visorTint: pick<VisorTintId>(['clear', 'cyan', 'gold', 'rose']),
      accessory: pick<FaceAccessoryId>(['none', 'glasses', 'freckles', 'star-cheek', 'headset']),
      patch: pick<ChestPatchId>(['star', 'maple', 'orbit', 'rocket']),
    });
  };

  // Auto-minimize during active flight in Unified Mission view so the full-screen canvas stays 100% clear
  const inActivePlay =
    props.appView === 'nasa-architect' &&
    props.unifiedSnapshot &&
    props.unifiedSnapshot.phase !== 'briefing' &&
    props.unifiedSnapshot.phase !== 'finale';

  useEffect(() => {
    if (inActivePlay) {
      setMinimized(true);
    }
  }, [inActivePlay]);

  const dockClass =
    props.appView === 'nasa-architect' ? 'bottom-20 right-4' : 'bottom-4 right-4';

  // Minimized floating cartoon astronaut badge
  if (minimized) {
    return (
      <div
        style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
        className={`pointer-events-auto fixed ${dockClass} z-50 flex items-center gap-2 border border-slate-700 bg-[#080d19]/95 p-1.5 pr-3 shadow-2xl`}
      >
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2.5 text-left cursor-pointer"
          aria-label="Open A.S.T.R.A. Flight Companion"
        >
          <CartoonAstronautFace appearance={appearance} mood={script.mood} size={42} className="shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-mono-tab text-[10px] font-bold uppercase tracking-wider">
              <span className="text-white">A.S.T.R.A.</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className={palette.pillText}>{script.stateLabel}</span>
            </div>
            <div className="text-[11px] font-medium text-slate-300 truncate max-w-[165px]">
              {script.headline}
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
      className={`pointer-events-auto fixed ${dockClass} z-50 w-[335px] sm:w-[370px] border ${palette.border} bg-[#080d19] shadow-2xl`}
    >
      {/* Draggable NPC Header Bar */}
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerCancel={handleHeaderPointerUp}
        className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2 cursor-grab active:cursor-grabbing select-none"
        title="Drag to move A.S.T.R.A. anywhere on screen"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CartoonAstronautFace appearance={appearance} mood={script.mood} size={46} className="shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-mono-tab text-[10px] font-bold uppercase tracking-wider">
              <span className="text-white">A.S.T.R.A.</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className={palette.pillText}>{script.stateLabel}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-400">Crew NPC</span>
            </div>
            <div className="truncate text-xs font-semibold text-white">{script.headline}</div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <GripHorizontal className="h-3.5 w-3.5 text-slate-600 mr-0.5" aria-hidden="true" />
          {(offset.x !== 0 || offset.y !== 0) && (
            <button
              type="button"
              onClick={() => setOffset({ x: 0, y: 0 })}
              aria-label="Reset companion position"
              title="Dock to bottom right"
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCustomizing((c) => !c)}
            aria-label={customizing ? 'Close astronaut customizer' : 'Customize astronaut appearance'}
            title="Customize Astronaut"
            className={`p-1 transition-colors cursor-pointer ${
              customizing ? 'text-cyan-300 bg-slate-800' : 'text-slate-400 hover:text-cyan-300'
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            aria-label="Minimize A.S.T.R.A. companion"
            title="Minimize"
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Inline Cartoon Astronaut Customizer */}
      {customizing ? (
        <div className="p-3.5 space-y-3 max-h-[390px] overflow-y-auto">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-3">
              <CartoonAstronautFace appearance={appearance} mood="excited" size={64} className="shrink-0" />
              <div>
                <div className="text-xs font-bold text-white">Astronaut Look Studio</div>
                <div className="text-[11px] text-slate-400">
                  Saved automatically across missions
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCustomizing(false)}
              aria-label="Back to mission tips"
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Suit Color */}
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-300">Spacesuit Livery</div>
            <div className="grid grid-cols-6 gap-1.5">
              {(Object.keys(SUIT_PALETTES) as SuitColorId[]).map((id) => {
                const sw = SUIT_PALETTES[id];
                const active = appearance.suitColor === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAppearance((p) => ({ ...p, suitColor: id }))}
                    title={sw.label}
                    aria-label={sw.label}
                    className={`h-7 border flex items-center justify-center cursor-pointer ${
                      active ? 'border-cyan-400 ring-1 ring-cyan-400' : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: sw.shell }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full border border-slate-900" style={{ backgroundColor: sw.trim }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Skin Tone */}
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-300">Skin Tone</div>
            <div className="grid grid-cols-6 gap-1.5">
              {SKIN_TONES.map((tone) => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => setAppearance((p) => ({ ...p, skinTone: tone.hex }))}
                  title={tone.label}
                  aria-label={`Skin tone ${tone.label}`}
                  className={`h-6 border cursor-pointer ${
                    appearance.skinTone === tone.hex ? 'border-cyan-400 ring-1 ring-cyan-400' : 'border-slate-700'
                  }`}
                  style={{ backgroundColor: tone.hex }}
                />
              ))}
            </div>
          </div>

          {/* Hair Style & Color */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-slate-300">Hair Style &amp; Shade</div>
            <div className="grid grid-cols-3 gap-1">
              {(['spiky', 'bob', 'curly', 'buzz', 'buns', 'none'] as HairStyle[]).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setAppearance((p) => ({ ...p, hairStyle: style }))}
                  className={`px-2 py-1 text-[11px] font-medium border capitalize cursor-pointer ${
                    appearance.hairStyle === style
                      ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200'
                      : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:text-white'
                  }`}
                >
                  {style === 'none' ? 'Bald' : style}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-6 gap-1.5 pt-0.5">
              {HAIR_COLORS.map((hc) => (
                <button
                  key={hc.id}
                  type="button"
                  onClick={() => setAppearance((p) => ({ ...p, hairColor: hc.hex }))}
                  title={hc.label}
                  aria-label={`Hair color ${hc.label}`}
                  className={`h-5 border cursor-pointer ${
                    appearance.hairColor === hc.hex ? 'border-cyan-400 ring-1 ring-cyan-400' : 'border-slate-700'
                  }`}
                  style={{ backgroundColor: hc.hex }}
                />
              ))}
            </div>
          </div>

          {/* Visor Tint */}
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-300">Helmet Visor Tint</div>
            <div className="grid grid-cols-4 gap-1">
              {(Object.keys(VISOR_TINTS) as VisorTintId[]).map((vt) => (
                <button
                  key={vt}
                  type="button"
                  onClick={() => setAppearance((p) => ({ ...p, visorTint: vt }))}
                  className={`px-2 py-1 text-[11px] font-medium border capitalize cursor-pointer ${
                    appearance.visorTint === vt
                      ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200'
                      : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:text-white'
                  }`}
                >
                  {vt}
                </button>
              ))}
            </div>
          </div>

          {/* Face Accessory & Chest Patch */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-slate-300">Face Detail</div>
              <select
                value={appearance.accessory}
                onChange={(e) =>
                  setAppearance((p) => ({ ...p, accessory: e.target.value as FaceAccessoryId }))
                }
                aria-label="Face detail"
                className="w-full border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
              >
                <option value="headset">Boom Mic</option>
                <option value="glasses">Flight Glasses</option>
                <option value="freckles">Freckles</option>
                <option value="star-cheek">Star Sticker</option>
                <option value="none">Clean Face</option>
              </select>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-slate-300">Suit Patch</div>
              <select
                value={appearance.patch}
                onChange={(e) =>
                  setAppearance((p) => ({ ...p, patch: e.target.value as ChestPatchId }))
                }
                aria-label="Suit patch"
                className="w-full border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
              >
                <option value="orbit">Orbit Ring</option>
                <option value="maple">CSA Maple</option>
                <option value="star">NASA Star</option>
                <option value="rocket">Rocket</option>
              </select>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleRandomizeAppearance}
                className="inline-flex items-center gap-1 border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:border-cyan-400 cursor-pointer whitespace-nowrap"
              >
                <Shuffle className="h-3 w-3" />
                Randomize
              </button>
              <button
                type="button"
                onClick={() => setAppearance(DEFAULT_ASTRONAUT_APPEARANCE)}
                className="inline-flex items-center gap-1 border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-white cursor-pointer whitespace-nowrap"
              >
                Reset
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCustomizing(false)}
              className="bg-cyan-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-cyan-400 cursor-pointer whitespace-nowrap"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        /* Scripted Mission NPC Dialogue View */
        <div className="p-3 space-y-2.5">
          <p className="text-xs leading-relaxed text-slate-200">{activeTip}</p>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              {script.tips.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setTipIndex((i) => (i + 1) % script.tips.length)}
                  className="inline-flex items-center gap-1 border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:border-cyan-400 hover:text-white cursor-pointer whitespace-nowrap"
                >
                  <span>
                    Next Tip ({(tipIndex % script.tips.length) + 1}/{script.tips.length})
                  </span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono-tab text-slate-400">
                  <Radio className="h-3 w-3 text-cyan-400" />
                  Comms Check
                </span>
              )}

              <button
                type="button"
                onClick={() => setCustomizing(true)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-cyan-300 cursor-pointer whitespace-nowrap"
              >
                <Palette className="h-3 w-3" />
                Customize
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenDictionary}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-cyan-200 cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="h-3 w-3" />
              Terms
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
