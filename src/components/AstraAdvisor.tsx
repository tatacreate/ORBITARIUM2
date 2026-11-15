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
  } = props;

  // 1. HOMEPAGE SCRIPT
  if (appView === 'title') {
    return {
      mood: 'excited',
      stateLabel: 'On Deck',
      headline: 'Crew Chief A.S.T.R.A. Reporting!',
      tips: [
        'Hey Cadet! I am A.S.T.R.A., your mission crewmate. Click "Launch Mission Architect" to pilot a real 4-segment space mission from liftoff to science downlink!',
        'Want to team up with friends? Pick "Team Room (1–4)" to assemble a spacecraft together in Co-Op or Competitive mode.',
        'Psst—click the Suit icon at the top of my radio card anytime to customize my spacesuit, hair, visor tint, and mission patch!',
      ],
    };
  }

  // 2. NASA 4-SEGMENT MISSION ARCHITECT SCRIPTS
  if (appView === 'nasa-architect') {
    const activeInstruments = nasaInstruments.filter((i) => i.enabled);
    const totalWetMassKg =
      420 + propellantBudgetKg + activeInstruments.reduce((sum, i) => sum + i.massKg, 0);

    if (nasaSegment === 'setup') {
      if (totalWetMassKg > selectedObjective.maxPayloadMassKg) {
        return {
          mood: 'warning',
          stateLabel: 'Mass Alert',
          headline: 'Spacecraft Too Heavy for Envelope',
          tips: [
            `Hold up! Our wet mass is ${totalWetMassKg} kg, above the ${selectedObjective.maxPayloadMassKg} kg target cap. Toggle off an optional sensor or trim propellant a bit.`,
            selectedPropulsion === 'chemical'
              ? 'Tip: Switching to Solar Electric Ion propulsion cuts required fuel mass dramatically for deep-space trajectories.'
              : 'Tip: You can also pick Sandbox Lab at the top if you want to experiment freely without strict mass penalties!',
          ],
        };
      }

      const regimeHint: Record<NasaObjectiveSpec['regime'], string> = {
        leo: 'For Low Earth Orbit climate monitoring, equip RADARSAT-SAR and aim for a high-inclination polar pass so Inuvik catches every orbit!',
        geo: 'Geostationary satellites park 35,786 km above the equator—that takes high Delta-v and clean Ka-band pointing.',
        heo: 'Highly Elliptical (Molniya) orbits hang high over northern skies at 63.4° inclination where Earth’s equator bulge cancels drift.',
        lunar: 'Headed to Lunar Gateway! Equip Canadarm3 and high-sensitivity sensors to inspect Shackleton Crater ice shadows.',
        lagrange: 'Sun-Earth L2 is 1.5 million km behind Earth—keep telescope instruments powered and watch your downlink link budget!',
        interplanetary: 'Mars transfer needs lots of Delta-v! Compare Chemical speed vs. Ion efficiency before you head to the launch pad.',
      };

      return {
        mood: 'nominal',
        stateLabel: architectMode === 'sandbox' ? 'Sandbox' : 'Briefing',
        headline: `Mission Brief: ${selectedObjective.regime.toUpperCase()}`,
        tips: [
          regimeHint[selectedObjective.regime],
          `We have ${activeInstruments.length} instruments powered (${totalWetMassKg} kg total mass). When your manifest looks sharp, hit Segment 1: Launch!`,
          'You can customize my suit or drag my radio card anywhere on your screen if you need room to read telemetry.',
        ],
      };
    }

    if (nasaSegment === 'launch') {
      if (totalWetMassKg > selectedRocket.maxPayloadKg) {
        return {
          mood: 'alert',
          stateLabel: 'Overload',
          headline: `${selectedRocket.name} Overload!`,
          tips: [
            `Whoa—our ${totalWetMassKg} kg stack is heavier than ${selectedRocket.name}'s ${selectedRocket.maxPayloadKg} kg lift limit! Pick a bigger rocket on the left panel before ignition.`,
            'Or head back to Mission Setup and trim propellant or heavy instruments.',
          ],
        };
      }
      if (burnState.status === 'failed') {
        return {
          mood: 'alert',
          stateLabel: 'Abort',
          headline: 'Ascent Missed Orbit — Reset Pad!',
          tips: [
            'Tough break, Flight Director! Hit "Reset Launch Pad" and watch two things: throttle back to ~65% during Max-Q (15–25 km), then press SPACE right inside the green SECO target velocity band.',
            'Need steadier steering? Turn on Cadet SAS Pitch Assist so you can focus purely on throttle and SECO cutoff timing!',
          ],
        };
      }
      if (burnState.status === 'burning') {
        return {
          mood: 'warning',
          stateLabel: 'In Flight',
          headline: 'Keep Eyes on Max-Q & Velocity Gate!',
          tips: [
            'Use W/S to throttle down slightly through Max-Q turbulence, and A/D to follow the dashed gravity-turn curve!',
            'Watch the Velocity progress bar—hit SPACE for Engine Cutoff (SECO) the moment it enters the green target zone!',
          ],
        };
      }
      if (burnState.status === 'completed' && burnState.outcomeType === 'nominal') {
        return {
          mood: 'excited',
          stateLabel: 'Orbit Lock',
          headline: 'Clean SECO! Ready for Space Ops',
          tips: [
            `Awesome piloting! We hit ${burnState.deliveredDeltaVKms} km/s with ${burnState.launchEfficiencyScore ?? 92}% efficiency. Click "Segment 2: Space" to take command in orbit!`,
            'Want to try a tighter manual gravity turn? You can always reset the pad and fly ascent again with SAS Assist switched off.',
          ],
        };
      }
      return {
        mood: 'nominal',
        stateLabel: 'Pad Ready',
        headline: 'T-Zero Launch Checklist',
        tips: [
          'Press IGNITE ENGINES (or SPACE) when ready! Once airborne, steer pitch right (D) along the dashed curve and ease throttle (S) if Max-Q pressure turns amber.',
          'For Lunar or Mars missions, slide the Departure Day Offset in Launch Window Analysis to find the lowest Delta-v day!',
        ],
      };
    }

    if (nasaSegment === 'space') {
      if (opsState.activeHazard) {
        const hz = opsState.activeHazard;
        if (hz.type === 'debris') {
          return {
            mood: 'alert',
            stateLabel: 'Debris Alert',
            headline: `Incoming Debris! T-${Math.max(0, hz.timeRemainingSec).toFixed(1)}s`,
            tips: [
              'Brace! Click "Fire 32 m/s Dodge Burn" on the red alert bar—or execute a ≥ 25 m/s maneuver burn—before the timer hits zero!',
              'Surviving debris conjunctions protects hull integrity and unlocks the CSA Canadarm3 Discovery Card.',
            ],
          };
        }
        if (hz.type === 'solar-flare') {
          return {
            mood: 'alert',
            stateLabel: 'Solar Storm',
            headline: `CME Radiation Surge! T-${Math.max(0, hz.timeRemainingSec).toFixed(1)}s`,
            tips: [
              `Quick! Slew our Radiation Shield to match Sun Vector (${Math.round(opsState.sunAngleDeg)}°) AND click "Shed Payloads" so ≤ 2 instruments stay powered!`,
              'Both actions together shield our optics until the solar storm passes.',
            ],
          };
        }
        return {
          mood: 'warning',
          stateLabel: 'Low Bus',
          headline: `Umbra Power Sag! T-${Math.max(0, hz.timeRemainingSec).toFixed(1)}s`,
          tips: [
            'Battery is dipping in planetary shadow! Hit "Shed Power Load" or align Solar Panels with the Sun Vector as soon as we exit eclipse.',
            'Watch the live bus bar below the orbit view—turn instruments back on once power margin goes positive.',
          ],
        };
      }

      if (opsState.batteryPct < 35) {
        return {
          mood: 'warning',
          stateLabel: 'Low Battery',
          headline: 'Battery Below 35%!',
          tips: [
            `Solar panels are misaligned or payload draw is high. In Maneuvers, align Solar Wing Angle near ${Math.round(opsState.sunAngleDeg)}° or switch off an instrument in Targeting!`,
          ],
        };
      }

      const capturedCount = landmarks.filter((l) => l.captured).length;
      if (opsState.canadarm.completedCount === 0) {
        return {
          mood: 'nominal',
          stateLabel: 'Orbital Ops',
          headline: 'Maneuvers, Canadarm3 & Scanning',
          tips: [
            'Click anywhere on the cyan orbit ring to place a Maneuver Node, drag the amber handle, Warp to Burn Window, and fire IN WINDOW!',
            'Try the Canadarm3 tab: use Q/E, W/S, and A/D to steer the robotic grapple over the drifting amber target ring, then press SPACE to lock it!',
            `Over in the Targeting tab, ${capturedCount}/${landmarks.length} surface landmarks are scanned. Power on each target’s sensor and hit FIRE SCAN!`,
          ],
        };
      }

      if (capturedCount < 3) {
        return {
          mood: 'excited',
          stateLabel: 'Science Ops',
          headline: `Great Robotics! ${capturedCount}/${landmarks.length} Targets Scanned`,
          tips: [
            'Open the Targeting tab to slew our cross-track gimbal and pulse-scan planetary landmarks—every scan queues 8.5 GB into our SSR memory!',
            'When you have captured a few science targets, fly over to Segment 3: Ground Dish to beam them home!',
          ],
        };
      }

      return {
        mood: 'excited',
        stateLabel: 'Ready Downlink',
        headline: 'SSR Loaded With Science Data!',
        tips: [
          `Nice work—${capturedCount}/${landmarks.length} landmarks captured and stored in our Solid-State Recorder! Head to Segment 3: Ground to steer the dish and downlink.`,
          'You can also test your crisis reflexes anytime with "Trigger Space Crisis Drill" at the top right.',
        ],
      };
    }

    if (nasaSegment === 'ground') {
      const pending = landmarks.filter((l) => l.captured && !l.downlinked).length;
      if (!groundComm.hasLineOfSight) {
        return {
          mood: 'warning',
          stateLabel: 'Blackout',
          headline: 'Line-of-Sight Occluded!',
          tips: [
            'The planet is blocking our radio beam right now—classic orbital blackout! Check the Station Handover list on the right and click a station with ONLINE LOS!',
            'For polar Earth missions, CSA Inuvik (68.3° N) catches way more passes than mid-latitude dishes.',
          ],
        };
      }
      if (groundComm.dishLockQualityPct < 60) {
        return {
          mood: 'warning',
          stateLabel: 'Weak Lock',
          headline: `Carrier Lock Only ${groundComm.dishLockQualityPct}%`,
          tips: [
            'Drag or click the dish reticle on the sky dome onto the bright green spacecraft beacon to boost signal lock above 80%!',
            'Struggling with the fast narrow Ka-Band beam? Switch to X-Band for a wider beam or toggle Servo Auto-Track ON.',
          ],
        };
      }
      return {
        mood: 'excited',
        stateLabel: 'Link Locked',
        headline: `Strong ${groundComm.dishLockQualityPct}% Dish Lock!`,
        tips: [
          pending > 0
            ? `Keep holding lock or click "Flush SSR Burst" to stream ${pending} captured landmark dataset(s) down to mission science!`
            : `Telemetry is flowing at ${groundComm.currentDownlinkMbps} Mbps (${Math.round(groundComm.totalDataDownlinkedGB)} GB downlinked). Head to Segment 4: User when ready!`,
          'Notice how Doppler shift swings from positive to negative as the spacecraft flies overhead—that is how DSN tracks orbital speed!',
        ],
      };
    }

    if (nasaSegment === 'user') {
      const failedGate = verificationScorecard.items.find((i) => !i.passed);
      if (verificationScorecard.overallPass) {
        return {
          mood: 'excited',
          stateLabel: 'Certified',
          headline: `${verificationScorecard.flightCertificationGrade.split(' ')[0]} Verification!`,
          tips: [
            `Bravo, ${verificationScorecard.missionRankBadge}! Dynamic Performance Index is ${verificationScorecard.dynamicPerformanceScore}/100. Inspect your reconstructed landmarks on the map!`,
            'Switch between Composite, RADARSAT SAR, and IR/Methane layers above the map, or open ConOps HUD for the full control view.',
          ],
        };
      }
      return {
        mood: 'warning',
        stateLabel: 'Review Gate',
        headline: 'Check Failed SE Requirement!',
        tips: [
          failedGate
            ? `Almost there! "${failedGate.requirementName}" needs work: ${failedGate.consequence}`
            : 'Review the 7-gate Systems Engineering Verification Matrix below to see which segment needs adjustment.',
          'Jump back to Launch, Space, or Ground anytime—your mission updates live without losing progress!',
        ],
      };
    }

    // conops
    return {
      mood: verificationScorecard.overallPass ? 'excited' : 'nominal',
      stateLabel: 'Master HUD',
      headline: 'All Four Segments Synchronized',
      tips: [
        'Welcome to Master ConOps! From here you can watch 3D orbital propagation alongside live power, SSR buffer, Doppler drift, and verification status.',
        'Click any of the four top cards (Launch, Space, Ground, User) to jump straight back to that flight console.',
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

  // Minimized floating cartoon astronaut badge
  if (minimized) {
    return (
      <div
        style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
        className="pointer-events-auto fixed bottom-4 right-4 z-50 flex items-center gap-2 border border-slate-700 bg-[#080d19] p-1.5 pr-3 shadow-2xl"
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
      className={`pointer-events-auto fixed bottom-4 right-4 z-50 w-[335px] sm:w-[370px] border ${palette.border} bg-[#080d19] shadow-2xl`}
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
