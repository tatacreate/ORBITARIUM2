import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  GripHorizontal,
  HelpCircle,
  Lightbulb,
  Palette,
  RotateCcw,
  Shuffle,
  X,
} from 'lucide-react';
import { OFFICIAL_REFERENCES } from '../data/references';
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
  // Legacy architect props retained for type safety
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
  // Active Mission Architect props
  classicPhase: GamePhase;
  classicConfig: MissionConfig;
  classicTelemetry: TelemetryReport;
  activeAnomalyTitle?: string | null;
  liveFlightSummary?: string | null;
  lastOutcomeSummary?: string | null;
  unifiedSnapshot?: UnifiedGameSnapshot | null;
  onOpenDictionary: () => void;
}

interface NpcDialogueScript {
  mood: AstronautMood;
  stateLabel: string;
  headline: string;
  whatNow: string;
  whyThis: string;
  nextMove: string;
}

const EXPLAIN_TOPICS: { id: string; label: string; title: string; body: string }[] = [
  {
    id: 'sun',
    label: '1/r² Sun',
    title: 'Why Sunlight Collapses Far From Earth',
    body: 'Sunlight spreads out in a sphere, shrinking by 1 ÷ distance². At Mars (1.52 AU) solar panels only make 43% power; at Jupiter/Europa (5.2 AU) they drop to just 3.7%, so deep-space probes need an RTG Nuclear Battery.',
  },
  {
    id: 'dv',
    label: 'Mass & Δv',
    title: 'Why Weight & Fuel Fight Each Other',
    body: 'Rockets can carry far less weight to distant planets than to Low Earth Orbit. Adding heavy armor or cameras lowers your speed-change budget (Δv) unless you add fuel or switch to a high-efficiency Ion Drive.',
  },
  {
    id: 'data',
    label: 'Data Link',
    title: 'Why Cameras Cause Data Overflows',
    body: 'Every camera or radar fills onboard computer memory daily. Across millions of km, weak S-Band antennas cannot empty the memory fast enough—so you must upgrade to Ka-Band/Laser or flush passes in flight.',
  },
  {
    id: 'fail',
    label: 'Why Fails',
    title: 'Why Missions Fail (And How To Fix)',
    body: 'Missions fail if your craft exceeds Rocket Lift on Day 1, lacks Δv to enter orbit on Day 42, browns out in shadow, overflows memory, or takes fatal Hull Damage from reckless flight commands. Always check the red node on the Mission Chain!',
  },
  {
    id: 'team',
    label: '1–4 Co-Op',
    title: 'How 4-Player Teams Work',
    body: 'Up to 4 engineers share one live 3D spacecraft in a Team Room: Mission Planner, Spacecraft Engineer, Science Lead, and Power/Comms Officer. Negotiate trade-offs and sign off Ready together—or compete on the Leaderboard!',
  },
];

function buildNpcScript(props: AstraAdvisorProps): NpcDialogueScript {
  const {
    appView,
    classicPhase,
    classicConfig,
    classicTelemetry,
    activeAnomalyTitle,
    liveFlightSummary,
    lastOutcomeSummary,
  } = props;

  // 1. HOMEPAGE SCRIPT
  if (appView === 'title') {
    return {
      mood: 'excited',
      stateLabel: 'Mission Tutor',
      headline: 'Crew Chief A.S.T.R.A. — Here to Explain!',
      whatNow:
        'You are on the Orbitarium Launchpad. Choose the interactive HTML5 Canvas Flight Loop (Launch → Space → Ground), or open the 3D Systems Designer.',
      whyThis:
        'Space missions connect every phase together: fuel saved on launch powers orbital maneuvers, scans become orbiting data orbs, and ground dishes beam them home.',
      nextMove:
        'Click "Fly Interactive Mission" to pilot Earth, Moon, or Mars live—or click "3D Systems Designer" to engineer spacecraft trade-offs.',
    };
  }

  // 1B. CONTINUOUS HTML5 CANVAS FLIGHT SIMULATOR SCRIPT
  if (appView === 'nasa-architect') {
    const snap = props.unifiedSnapshot;
    if (!snap || snap.phase === 'briefing') {
      return {
        mood: 'excited',
        stateLabel: 'Canvas Briefing',
        headline: 'Choose Earth, Moon, or Mars Flight!',
        whatNow:
          'Pick one of the three end-to-end orbital missions: Earth Hurricane Watch, Lunar Gateway Canadarm Rescue, or Mars Ice-Cap Explorer.',
        whyThis:
          'Your exact fuel tank and hull shield carry continuously from rocket liftoff all the way through orbital operations and ground-station downlink.',
        nextMove:
          'Click a mission card, then hit the gold "LAUNCH" button to take the stick!',
      };
    }

    if (snap.phase === 'launch') {
      return {
        mood: 'excited',
        stateLabel: 'Launch Segment',
        headline: 'Steer Ascent & Cut Engines in Green Ring!',
        whatNow:
          `You are steering your rocket up through the atmosphere (${snap.fuelPct}% fuel left). Fly through amber booster rings and hold W for turbo.`,
        whyThis:
          'Every drop of fuel you save during ascent stays in your tank for orbital maneuvers around your destination planet!',
        nextMove:
          'Keep inside the glowing trajectory corridor with A/D (or drag) and tap SPACE right inside the green orbit insertion ring!',
      };
    }

    if (snap.phase === 'transition_orbit') {
      return {
        mood: 'nominal',
        stateLabel: 'Orbit Entry',
        headline: 'Establishing Stable Parking Orbit...',
        whatNow:
          `Your spacecraft separated cleanly from the booster with ${snap.fuelPct}% fuel and ${snap.hullPct}% hull shield remaining.`,
        whyThis:
          'Switching into orbital reference frame lets you raise/lower altitude (W/S) and speed up or slow down along the orbital track (A/D).',
        nextMove:
          'Get ready to scan surface targets or align the Canadarm3 grapple!',
      };
    }

    if (snap.phase === 'orbit') {
      if (snap.activeThreat === 'debris') {
        return {
          mood: 'alert',
          stateLabel: 'Debris Alert!',
          headline: 'Incoming Orbital Debris Conjunction!',
          whatNow:
            'A red warning corridor appeared across your orbital path! High-speed space junk is crossing your altitude band.',
          whyThis:
            'Staying on the same orbit ring leads to a kinetic impact that drains Hull Shield—just like real NASA/CSA conjunction avoidance burns.',
          nextMove:
            'Press W or S immediately to change your orbital altitude out of the red danger lane!',
        };
      }
      if (snap.activeThreat === 'solar-wave') {
        return {
          mood: 'alert',
          stateLabel: 'Solar Wave!',
          headline: 'Coronal Mass Ejection Incoming!',
          whatNow:
            'A high-energy solar radiation wave is sweeping across your Mars orbit right now.',
          whyThis:
            'Without magnetic shielding active, charged solar protons damage delicate optics and drain hull protection.',
          nextMove:
            'Hold [SHIFT] (or press the HOLD SHIELD button) until the glowing radiation wave passes safely!',
        };
      }
      const isArm = snap.missionId === 'lunar-rescue';
      return {
        mood: 'nominal',
        stateLabel: 'Space Segment',
        headline: isArm
          ? `Lunar Canadarm Ops (${snap.orbsCollected}/${snap.orbGoal} Pods)`
          : `Orbital Science Pass (${snap.orbsCollected}/${snap.orbGoal} Orbs)`,
        whatNow: isArm
          ? 'Match altitude and phase with the drifting Lunar Gateway supply pod using W/A/S/D.'
          : 'Adjust your orbital altitude (W/S) and phase (A/D) to fly into the glowing cyan science target cones.',
        whyThis:
          'Changing orbital height also changes orbital speed (Kepler’s Third Law)—lower orbits move faster around the planet than higher ones!',
        nextMove: isArm
          ? 'Hover close to the supply pod and hold [SPACE] to lock the CSA Canadarm3 grapple!'
          : 'Enter a highlighted surface target zone and hold [SPACE] to capture a glowing science data orb.',
      };
    }

    if (snap.phase === 'beamdown') {
      return {
        mood: 'excited',
        stateLabel: 'Ground Segment',
        headline: `Ground-Station Pass (${snap.orbsBeamed}/${snap.orbGoal} Beamed)`,
        whatNow:
          `You collected ${snap.orbsCollected} data orbs! Now wait or maneuver into the golden ground-station antenna cone.`,
        whyThis:
          'Satellites cannot transmit continuously when a planet blocks line-of-sight—ground antennas can only receive bursts during clean pass windows.',
        nextMove:
          'Fly into the golden dish cone on the planet’s horizon and hold [SPACE] to beam your science data home!',
      };
    }

    return {
      mood: 'excited',
      stateLabel: 'User Segment',
      headline: `Mission Complete! (${snap.starsEarned}/3 Stars)`,
      whatNow:
        `All ${snap.orbGoal} discoveries beamed to Earth with ${snap.fuelPct}% fuel and ${snap.hullPct}% hull shield!`,
      whyThis:
        'You just experienced the full NASA Systems Engineering loop: Launch constraints, orbital maneuvering, hazard defense, and Ground downlink.',
      nextMove:
        'Click "Next Mission" to continue to the next planet in the loop, or "Replay Mission" to beat your time and star score!',
    };
  }

  // 2. UNIFIED 5-PHASE MISSION ARCHITECT SCRIPTS
  const { objective, orbit, power, comms, launchVehicle, instruments, bus, shielding, difficulty } =
    getCatalogParts(classicConfig);

  if (classicPhase === 'briefing') {
    return {
      mood: 'excited',
      stateLabel: 'Phase 1 · Brief',
      headline: `Mission: ${objective.title}`,
      whatNow:
        'Phase 1 sets your scientific goal, target world, crew role, difficulty, and spacecraft detail level before you build.',
      whyThis:
        objective.targetBody === 'europa'
          ? 'Europa sits at 5.2 AU inside Jupiter’s radiation belts: sunlight is only 3.7%, so solar panels starve and thin foil electronics fry early.'
          : objective.targetBody === 'mars'
            ? 'Mars is 1.52 AU away with a 13-minute radio lag and dust storms—requiring strong downlink dishes and autonomous pointing.'
            : objective.targetBody === 'moon'
              ? 'Lunar polar orbits spend up to 38% of every lap in freezing darkness, taxing battery storage and survival heaters.'
              : objective.targetBody === 'psyche'
                ? 'Asteroid Psyche orbits at 2.1 AU with lumpy gravity—rewarding Ion propulsion and steady attitude control.'
                : 'Earth LEO missions face crowded space debris and intense daily gigabytes from Hurricane/Climate radars.',
      nextMove:
        'Pick one of the 5 worlds below, pick Simplified or Realistic parts, then click "Build Spacecraft (Phase 2)".',
    };
  }

  if (classicPhase === 'assembly') {
    if (classicTelemetry.powerStatus === 'Critical') {
      return {
        mood: 'alert',
        stateLabel: 'Power Deficit',
        headline: `Brownout Risk: ${classicTelemetry.powerMarginW}W Margin`,
        whatNow:
          'You are in the 3D Spacecraft Hangar. Look at the red Power gauge on the left and the Mission Chain bar at the top.',
        whyThis: `Your instruments and ${comms.shortLabel} draw ${classicTelemetry.powerPeakDrawW}W, but ${power.shortLabel} only generates ${classicTelemetry.powerGeneratedW}W at ${orbit.solarDistanceAU} AU (sunlight drops by 1/r²).`,
        nextMove:
          orbit.solarDistanceAU >= 2.5
            ? 'Open the "Power" tab on the right and switch to the MMRTG Nuclear Battery!'
            : 'Open the "Power" tab on the right and pick bigger Solar Wings or increase wing size.',
      };
    }
    if (classicTelemetry.dataStatus === 'Critical') {
      return {
        mood: 'warning',
        stateLabel: 'Data Bottleneck',
        headline: `Link Jam: ${classicTelemetry.dataGeneratedGBDay} GB/d > ${classicTelemetry.downlinkCapacityGBDay} GB/d`,
        whatNow:
          'Your mounted science sensors create more gigabytes per day than your current radio antenna can transmit home.',
        whyThis: `Across ${orbit.commsDistanceAU} AU, ${comms.shortLabel} only clears ${classicTelemetry.downlinkCapacityGBDay} GB/day (${classicTelemetry.linkMarginDb} dB link margin). Unbeamed data overflows onboard memory!`,
        nextMove:
          'Open the "Comms & Brain" tab on the right and upgrade to a Ka-Band High-Gain Dish or Optical Laser (and check your 512 GB Computer).',
      };
    }
    if (classicTelemetry.budgetStatus === 'Critical') {
      return {
        mood: 'warning',
        stateLabel: 'Over Budget',
        headline: `Cost $${classicTelemetry.totalCostM}M > $${classicTelemetry.budgetCapM}M Cap`,
        whatNow:
          'Total mission cost (rocket + frame + subsystems + sensors) went past your agency budget limit.',
        whyThis:
          'Over-budget missions get canceled on Day 1 unless you play Sandbox mode or trim non-essential luxury parts.',
        nextMove:
          'Swap an oversized subsystem for a leaner option, or remove an extra instrument that is not preferred for this world.',
      };
    }
    if (instruments.length === 0) {
      return {
        mood: 'alert',
        stateLabel: 'No Sensors',
        headline: 'No Science Instruments Mounted!',
        whatNow: 'Your spacecraft bus has power and radio, but zero cameras or radars to study the target world.',
        whyThis: 'Without scientific instruments, the mission gathers zero science return and fails objectives.',
        nextMove: 'Open the "Science" tab on the right and mount at least 1–2 preferred instruments.',
      };
    }
    return {
      mood: classicTelemetry.synergies.length > 0 ? 'excited' : 'nominal',
      stateLabel: 'Phase 2 · Build',
      headline:
        classicTelemetry.synergies.length > 0
          ? `Synergy Active: ${classicTelemetry.synergies[0]}`
          : '3D Assembly Bay — Watch Every Ripple',
      whatNow:
        'Click tabs on the right (Bus & Engine, Power, Comms & Brain, Science) to swap parts on your live 3D probe.',
      whyThis: `Right now you have ${instruments.length} instrument(s) on a ${bus.shortLabel} frame, ${classicTelemetry.powerMarginW >= 0 ? `+${classicTelemetry.powerMarginW}W` : `${classicTelemetry.powerMarginW}W`} power spare, and ${classicTelemetry.estimatedLifetimeYears} yrs radiation lifetime (${shielding.name}).`,
      nextMove:
        'When your 6 Mission Chain bars look healthy, click "Next: Rocket & Orbit Planner (Phase 3)" at bottom-right.',
    };
  }

  if (classicPhase === 'planner') {
    if (classicTelemetry.massStatus === 'Critical') {
      return {
        mood: 'alert',
        stateLabel: 'Too Heavy!',
        headline: `${classicTelemetry.wetMassKg} kg > ${launchVehicle.name} Limit`,
        whatNow:
          'You are choosing which Rocket launches your probe and which Orbit it enters around the target world.',
        whyThis: `Going all the way to ${orbit.shortName} shrinks ${launchVehicle.name}'s lift limit down to ${classicTelemetry.payloadCapacityKg} kg—and your fueled craft weighs ${classicTelemetry.wetMassKg} kg (or the ${bus.shortLabel} frame is too wide for its fairing).`,
        nextMove:
          'Click a larger green "Compatible" Rocket on the left, OR pick a higher/elliptical orbit on the right that needs less braking fuel.',
      };
    }
    if (classicTelemetry.deltaVStatus === 'Critical') {
      return {
        mood: 'alert',
        stateLabel: 'Low Fuel Δv',
        headline: `Need ${classicTelemetry.requiredDeltaVKms} km/s Δv (Have ${classicTelemetry.availableDeltaVKms})`,
        whatNow:
          'Your spacecraft engine does not pack enough total speed-change (Δv) to brake into the selected orbit.',
        whyThis:
          'Without enough Δv, a probe flies straight past its planet or moon on Day 42!',
        nextMove:
          'Pick an elliptical orbit on the right (requires less braking Δv), OR go back to Phase 2 and switch to an Ion Drive / larger fuel tank.',
      };
    }
    return {
      mood: classicTelemetry.launchReady ? 'excited' : 'warning',
      stateLabel: classicTelemetry.launchReady ? 'Go For Launch' : 'Flagged Risk',
      headline: classicTelemetry.launchReady
        ? `${launchVehicle.name} Cleared for ${orbit.shortName}`
        : 'Test Launch Warning — Flaw Detected',
      whatNow:
        'Left side picks your Rocket lift capacity; right side picks your exact Orbit ring around the target world.',
      whyThis: classicTelemetry.launchReady
        ? `${launchVehicle.name} lifts your ${classicTelemetry.wetMassKg} kg craft with ${classicTelemetry.availableDeltaVKms} km/s Δv and ${classicTelemetry.commsDelaySec}s Earth signal delay.`
        : classicTelemetry.criticalFailureReason || 'One of your 6 resources is over its critical limit—launching now runs a Test Flight so you can watch where it fails.',
      nextMove: classicTelemetry.launchReady
        ? 'Click green "Launch Mission Simulation →" to fly and manage your craft live!'
        : 'Fix the red card above, OR click "Test Launch Anyway" to observe the exact in-flight failure.',
    };
  }

  if (classicPhase === 'simulating') {
    if (activeAnomalyTitle) {
      return {
        mood: 'alert',
        stateLabel: 'Emergency!',
        headline: activeAnomalyTitle,
        whatNow:
          'A real orbital emergency paused flight! Read your spacecraft’s Equipped/Missing hardware tags carefully.',
        whyThis:
          'Not all commands are safe! Trying a maneuver that requires hardware you DID NOT build—or ignoring a physical hazard—will damage Hull Health and wipe science.',
        nextMove:
          'Pick a command whose hardware requirement you actually have equipped, OR pick the conservative safety option.',
      };
    }
    return {
      mood: 'excited',
      stateLabel: 'In Flight',
      headline: 'Live Flight Operations Console',
      whatNow:
        'Don’t just watch! Use the bottom console to manage Power Bus Mode during Shadow Eclipses and click "Flush to Earth" when Memory fills up.',
      whyThis:
        liveFlightSummary ||
        'In Planet Shadow, solar power drops—leaving "Full Science" on drains your Battery toward 0%. During Earth Passes, flushing keeps onboard memory from overflowing!',
      nextMove:
        'Watch the Sun/Eclipse and Earth Link badges at top-right: switch to "Balanced/Safe" in shadow and "Flush to Earth" when Memory turns amber.',
    };
  }

  // debrief
  return {
    mood: lastOutcomeSummary?.includes('Failed') || lastOutcomeSummary?.includes('Lost') ? 'warning' : 'excited',
    stateLabel: 'Phase 5 · Debrief',
    headline: lastOutcomeSummary ? 'Flight Result & Cause Analysis' : 'Mission Debrief Ready',
    whatNow:
      'Phase 5 shows your Grade, 5-axis performance radar, and the exact 7-point cause-and-effect checklist from your run.',
    whyThis:
      lastOutcomeSummary ||
      `Difficulty "${difficulty.label}" scored Science, Margins, Budget, Synergy, and Flight Ops. Every failed or tight check tells you which subsystem caused it.`,
    nextMove:
      'Read "How Your Design Choices Shaped This Run", then click "Modify Spacecraft" or "Change Rocket / Orbit" to beat your score!',
  };
}

export function AstraAdvisor(props: AstraAdvisorProps) {
  const { onOpenDictionary } = props;

  const [appearance, setAppearance] = useState<AstronautAppearance>(loadSavedAppearance);
  const [minimized, setMinimized] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [activeTab, setActiveTab] = useState<'guide' | 'explain' | 'refs'>('guide');
  const [selectedTopicId, setSelectedTopicId] = useState<string>(EXPLAIN_TOPICS[0].id);

  // Draggable follower offset
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

  // Switch back to live Guide automatically whenever an emergency or new phase triggers
  useEffect(() => {
    if (props.activeAnomalyTitle) {
      setActiveTab('guide');
    }
  }, [props.activeAnomalyTitle, props.classicPhase]);

  const activeExplain =
    EXPLAIN_TOPICS.find((t) => t.id === selectedTopicId) ?? EXPLAIN_TOPICS[0];

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

  // Smart non-overlapping dock positioning per screen
  const dockClass =
    props.appView === 'nasa-architect'
      ? 'bottom-24 right-4'
      : props.appView === 'classic-hangar' && props.classicPhase === 'assembly'
        ? 'bottom-3 left-3'
        : props.appView === 'classic-hangar' && props.classicPhase === 'simulating'
          ? 'bottom-[190px] right-4'
          : 'bottom-4 right-4';

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
        /* Interactive Scripted Mission Tutor View */
        <div className="p-3 space-y-2.5">
          {/* 3-Tab Sub-Navigation inside A.S.T.R.A. */}
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                { id: 'guide', label: 'Live Guide', icon: Lightbulb },
                { id: 'explain', label: 'Why Physics?', icon: HelpCircle },
                { id: 'refs', label: 'NASA / CSA', icon: ExternalLink },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center justify-center gap-1 border px-1.5 py-1 text-[10px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                    active
                      ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200'
                      : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab === 'guide' && (
            <div className="space-y-2 text-[11px] leading-relaxed">
              <div className="border border-slate-800 bg-slate-900/70 px-2.5 py-1.5">
                <div className="font-mono-tab text-[9px] uppercase tracking-wider text-cyan-400">
                  What&apos;s Happening Now
                </div>
                <p className="text-slate-200 mt-0.5">{script.whatNow}</p>
              </div>
              <div className="border border-slate-800 bg-slate-900/70 px-2.5 py-1.5">
                <div className="font-mono-tab text-[9px] uppercase tracking-wider text-amber-300">
                  Why Your Craft Reacts This Way
                </div>
                <p className="text-slate-200 mt-0.5">{script.whyThis}</p>
              </div>
              <div className="border border-emerald-500/35 bg-emerald-950/25 px-2.5 py-1.5">
                <div className="font-mono-tab text-[9px] uppercase tracking-wider text-emerald-300">
                  Recommended Next Step
                </div>
                <p className="text-emerald-100 mt-0.5">{script.nextMove}</p>
              </div>
            </div>
          )}

          {activeTab === 'explain' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {EXPLAIN_TOPICS.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={`px-2 py-1 text-[10px] font-medium border cursor-pointer whitespace-nowrap ${
                      selectedTopicId === topic.id
                        ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {topic.label}
                  </button>
                ))}
              </div>
              <div className="border border-slate-800 bg-slate-900/75 p-2.5">
                <div className="text-xs font-bold text-cyan-300">{activeExplain.title}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-200">
                  {activeExplain.body}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'refs' && (
            <div className="space-y-1.5">
              {OFFICIAL_REFERENCES.map((ref) => (
                <a
                  key={ref.id}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 border border-slate-800 bg-slate-900/80 px-2.5 py-2 text-[11px] text-slate-200 hover:border-cyan-400 hover:text-white transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {ref.agency}: {ref.title}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{ref.subtitle}</div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                </a>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setCustomizing(true)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-cyan-300 cursor-pointer whitespace-nowrap"
            >
              <Palette className="h-3 w-3" />
              Customize Suit
            </button>

            <button
              type="button"
              onClick={onOpenDictionary}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-cyan-200 cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="h-3 w-3" />
              Space Dictionary
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
