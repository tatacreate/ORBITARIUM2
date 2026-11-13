import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GitBranch,
  HelpCircle,
  Layers,
  Send,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  ADCS_SYSTEMS,
  AVIONICS_SYSTEMS,
  BATTERY_SYSTEMS,
  BUSES,
  COMMS_SYSTEMS,
  DIFFICULTY_MODES,
  INSTRUMENTS,
  LAUNCH_VEHICLES,
  OBJECTIVES,
  ORBITS,
  POWER_SYSTEMS,
  PROPULSION_SYSTEMS,
  RANDOM_CONSTRAINTS,
  ROLE_META,
  SHIELDING_SYSTEMS,
} from '../data/catalog';
import { computeTelemetry, getCatalogParts } from '../engine/physics';
import type {
  CameraPreset,
  DifficultyLevel,
  EngineeringRole,
  MissionConfig,
  RoomMember,
  RoomMessage,
  SubsystemTab,
  TelemetryReport,
} from '../types/mission';

interface EngineeringDockProps {
  config: MissionConfig;
  telemetry: TelemetryReport;
  activeTab: SubsystemTab;
  collapsed: boolean;
  explodeAmount: number;
  cameraPreset: CameraPreset;
  roomId: string | null;
  members: RoomMember[];
  messages: RoomMessage[];
  currentUid: string | null;
  onChangeTab: (tab: SubsystemTab) => void;
  onToggleCollapse: () => void;
  onChangeExplode: (val: number) => void;
  onSelectCamera: (preset: CameraPreset) => void;
  onUpdateConfig: (patch: Partial<MissionConfig>, changeSummary?: string) => void;
  onChangeRole: (role: EngineeringRole) => void;
  onToggleReady: () => void;
  onSendMessage: (text: string) => void;
  onOpenTeamModal: () => void;
  onOpenBriefing: () => void;
  onOpenDictionary: () => void;
}

const TABS: { id: SubsystemTab; label: string }[] = [
  { id: 'mission', label: '01. Mission & Orbit' },
  { id: 'bus', label: '02. Bus & Propulsion' },
  { id: 'power', label: '03. Power & Comms' },
  { id: 'payload', label: '04. Science Payload' },
  { id: 'team', label: '05. Team & Sign-Off' },
];

function formatDelta(val: number, unit: string, invertGood = false): { text: string; tone: string } | null {
  if (Math.abs(val) < 0.05) return null;
  const rounded = Number.isInteger(val) ? val : Number(val.toFixed(1));
  const sign = rounded > 0 ? '+' : '';
  const positiveGood = !invertGood;
  const isGood = positiveGood ? rounded > 0 : rounded < 0;
  return {
    text: `${sign}${rounded}${unit}`,
    tone: isGood ? 'text-emerald-400' : 'text-amber-300',
  };
}

const TUTORIAL_STEPS: {
  step: number;
  tab: SubsystemTab;
  title: string;
  explanation: string;
}[] = [
  {
    step: 1,
    tab: 'mission',
    title: 'Step 1 · Pick Your Target, Orbit & Rocket',
    explanation:
      'Lower orbital altitudes give sharper science photos but require more fuel (Δv) and face longer shadow eclipses. Make sure your rocket’s payload capacity is larger than your spacecraft’s wet mass.',
  },
  {
    step: 2,
    tab: 'bus',
    title: 'Step 2 · Build Body, Engine, Brain & Shielding',
    explanation:
      'Electric Ion engines slash fuel weight but use lots of electricity; Avionics stores daily photos; ADCS keeps cameras & lasers aimed steady; Shielding protects electronics from space radiation.',
  },
  {
    step: 3,
    tab: 'power',
    title: 'Step 3 · Balance Power & Deep-Space Antenna',
    explanation:
      'Sunlight fades rapidly far from the Sun (1/r² law), so distant missions need bigger Mega-Flex wings or nuclear MMRTG power plus a Ka-Band dish or Optical Laser to send data home.',
  },
  {
    step: 4,
    tab: 'payload',
    title: 'Step 4 · Choose Science Tools & Test Launch',
    explanation:
      'Every camera or radar adds science points—but also adds weight, power draw, and daily GB data rate. Watch the top bars stay Nominal, then hit Simulate Launch!',
  },
];

function explainCandidateImpact(
  patch: Partial<MissionConfig>,
  currentTel: TelemetryReport,
  nextTel: TelemetryReport,
): string {
  if (patch.objectiveId) {
    return 'Changing your objective updates your budget cap, minimum science target, and preferred instruments.';
  }
  if (patch.orbitId) {
    const dvDiff = nextTel.requiredDeltaVKms - currentTel.requiredDeltaVKms;
    const capDiff = nextTel.payloadCapacityKg - currentTel.payloadCapacityKg;
    if (dvDiff < -0.1) {
      return `Higher/elliptical orbit saves ${Math.abs(dvDiff).toFixed(2)} km/s fuel and boosts rocket lift by +${capDiff} kg.`;
    }
    if (dvDiff > 0.1) {
      return `Tighter/farther orbit needs +${dvDiff.toFixed(2)} km/s fuel, reducing rocket lift by ${Math.abs(capDiff)} kg.`;
    }
    return 'Shifts orbital environment (sunlight, eclipses, radiation) and rocket payload limit.';
  }
  if (patch.launchVehicleId) {
    const capDiff = nextTel.payloadCapacityKg - currentTel.payloadCapacityKg;
    return capDiff > 0
      ? `Larger rocket adds +${capDiff} kg payload capacity so heavier instruments and fuel fit safely.`
      : `Smaller rocket saves launch budget, but shrinks maximum payload capacity by ${Math.abs(capDiff)} kg.`;
  }
  if (patch.propulsionId) {
    const fuelDiff = nextTel.propellantMassKg - currentTel.propellantMassKg;
    return fuelDiff < -30
      ? `Higher engine efficiency (Isp) cuts fuel weight by ${Math.abs(fuelDiff)} kg, though electric drives consume extra watts.`
      : `Chemical thruster avoids high electric draw, at the cost of +${fuelDiff} kg extra propellant.`;
  }
  if (patch.powerId) {
    const pDiff = nextTel.powerMarginW - currentTel.powerMarginW;
    return pDiff >= 0
      ? `Boosts electrical power margin by +${pDiff}W to run more sensors and heaters simultaneously.`
      : `Changes power output by ${pDiff}W—check that net power margin stays above 0W.`;
  }
  if (patch.commsId) {
    const linkDiff = nextTel.downlinkCapacityGBDay - currentTel.downlinkCapacityGBDay;
    return linkDiff >= 0
      ? `Increases daily downlink speed by +${linkDiff.toFixed(1)} GB/day so science buffers never overflow.`
      : `Reduces downlink capacity by ${Math.abs(linkDiff).toFixed(1)} GB/day, saving power and cost.`;
  }
  if (patch.shieldingId) {
    const lifeDiff = nextTel.estimatedLifetimeMonths - currentTel.estimatedLifetimeMonths;
    return lifeDiff >= 0
      ? `Stronger armor extends projected mission lifetime by +${lifeDiff} months against radiation.`
      : `Lighter thermal blanket trims spacecraft weight while supporting shorter or lower-radiation flights.`;
  }
  if (patch.instrumentIds) {
    const dataDiff = nextTel.dataGeneratedGBDay - currentTel.dataGeneratedGBDay;
    const sciDiff = nextTel.scienceReturnPotential - currentTel.scienceReturnPotential;
    return sciDiff >= 0
      ? `Adds +${sciDiff} science points, while increasing mass, power draw, and +${dataDiff.toFixed(1)} GB/day data.`
      : `Removing this sensor frees weight, watts, and ${Math.abs(dataDiff).toFixed(1)} GB/day of antenna bandwidth.`;
  }
  if (patch.adcsId) {
    return 'Sharper attitude pointing stabilizes optical lasers and cameras, at slightly higher power and mass.';
  }
  if (patch.avionicsId) {
    return 'Upgraded onboard computer expands fault tolerance and data memory buffer between Earth passes.';
  }
  if (patch.batteryId) {
    return 'Larger battery stores more energy to power instruments during planetary shadow eclipses.';
  }
  return 'Updates spacecraft mass, power, data rate, and mission lifetime across connected subsystems.';
}

export function EngineeringDock({
  config,
  telemetry,
  activeTab,
  collapsed,
  explodeAmount,
  cameraPreset,
  roomId,
  members,
  messages,
  currentUid,
  onChangeTab,
  onToggleCollapse,
  onChangeExplode,
  onSelectCamera,
  onUpdateConfig,
  onChangeRole,
  onToggleReady,
  onSendMessage,
  onOpenTeamModal,
  onOpenBriefing,
  onOpenDictionary,
}: EngineeringDockProps) {
  const [chatInput, setChatInput] = useState('');
  const [showPlainWhy, setShowPlainWhy] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [hoveredCandidate, setHoveredCandidate] = useState<{
    label: string;
    patch: Partial<MissionConfig>;
  } | null>(null);

  const { difficulty, constraintEvent, modelMode, bus, power, orbit, objective, instruments, launchVehicle } =
    getCatalogParts(config);
  const isSimplified = modelMode === 'simplified';
  const mySeat = members.find((m) => m.uid === currentUid);
  const myPrimaryTab = mySeat ? ROLE_META[mySeat.role].primaryTab : null;
  const topAdvisory = telemetry.advisories[0];

  const handleRollConstraint = () => {
    const pool = RANDOM_CONSTRAINTS.filter((c) => c.id !== 'none' && c.id !== constraintEvent.id);
    const chosen = pool[Math.floor(Math.random() * pool.length)] ?? RANDOM_CONSTRAINTS[1];
    onUpdateConfig(
      { constraintEventId: chosen.id },
      `Rolled random mission event: ${chosen.title} (${chosen.impactSummary})`,
    );
  };

  const getInstrumentTogglePatch = (instId: string): Partial<MissionConfig> => {
    const exists = config.instrumentIds.includes(instId);
    let next: string[];
    if (exists) {
      next = config.instrumentIds.filter((id) => id !== instId);
    } else if (config.instrumentIds.length >= bus.maxInstruments) {
      next = [...config.instrumentIds.slice(1), instId];
    } else {
      next = [...config.instrumentIds, instId];
    }
    return { instrumentIds: next };
  };

  const handleToggleInstrument = (instId: string) => {
    const exists = config.instrumentIds.includes(instId);
    const patch = getInstrumentTogglePatch(instId);
    const instName = INSTRUMENTS.find((i) => i.id === instId)?.shortName || instId;
    onUpdateConfig(patch, `${exists ? 'Removed' : 'Mounted'} ${instName}`);
  };

  const handleSelectObjective = (objectiveId: string) => {
    const obj = OBJECTIVES.find((o) => o.id === objectiveId);
    if (!obj) return;
    onUpdateConfig(
      {
        objectiveId: obj.id,
        orbitId: obj.recommendedOrbitId,
      },
      `Set objective to ${obj.title}`,
    );
  };

  const handleSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setChatInput('');
  };

  const candidateDeltas = useMemo(() => {
    if (!hoveredCandidate) return null;
    const nextConfig: MissionConfig = { ...config, ...hoveredCandidate.patch };
    const nextTel = computeTelemetry(nextConfig);
    const items = [
      formatDelta(nextTel.totalCostM - telemetry.totalCostM, 'M Cost', true),
      formatDelta(nextTel.wetMassKg - telemetry.wetMassKg, ' kg Wet Mass', true),
      formatDelta(nextTel.powerMarginW - telemetry.powerMarginW, 'W Margin', false),
      formatDelta(nextTel.availableDeltaVKms - telemetry.availableDeltaVKms, ' km/s Δv', false),
      formatDelta(nextTel.dataGeneratedGBDay - telemetry.dataGeneratedGBDay, ' GB/d Data', true),
      formatDelta(nextTel.downlinkCapacityGBDay - telemetry.downlinkCapacityGBDay, ' GB/d Link', false),
      formatDelta(nextTel.estimatedLifetimeMonths - telemetry.estimatedLifetimeMonths, ' mo Life', false),
      formatDelta(nextTel.scienceReturnPotential - telemetry.scienceReturnPotential, ' Sci', false),
    ].filter((x): x is { text: string; tone: string } => x !== null);
    const why = explainCandidateImpact(hoveredCandidate.patch, telemetry, nextTel);
    return { label: hoveredCandidate.label, items, why };
  }, [hoveredCandidate, config, telemetry]);

  const dryPayloadMassKg = instruments.reduce((sum, i) => sum + i.massKg, 0);
  const instrumentPowerW = instruments.reduce((sum, i) => sum + i.powerDrawW, 0);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center transition-transform duration-200 ease-out ${
        collapsed ? 'translate-y-[calc(100%-38px)]' : 'translate-y-0'
      }`}
    >
      {/* Top Handle + Camera & Exploded View Bar */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 border border-b-0 border-slate-700/90 bg-[#090d16]/95 px-3 py-1.5 text-xs">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-1.5 font-medium text-cyan-300 hover:text-cyan-200 transition-colors whitespace-nowrap cursor-pointer"
        >
          {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {collapsed ? 'Show Engineering Console (H)' : 'Hide Controls (H)'}
        </button>

        {!collapsed && (
          <>
            <span className="text-slate-700" aria-hidden="true">|</span>
            <div className="flex items-center gap-1">
              {(['hero', 'payload', 'propulsion', 'power'] as CameraPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onSelectCamera(preset)}
                  className={`px-2 py-0.5 text-[11px] capitalize transition-colors cursor-pointer ${
                    cameraPreset === preset
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {preset === 'hero' ? '3/4 View' : preset}
                </button>
              ))}
            </div>

            <span className="text-slate-700 hidden sm:inline" aria-hidden="true">|</span>
            <label className="hidden sm:flex items-center gap-2 text-[11px] font-mono-tab text-slate-300">
              <Layers className="h-3.5 w-3.5 text-slate-400" />
              <span>Explode</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={explodeAmount}
                onChange={(e) => onChangeExplode(parseFloat(e.target.value))}
                className="aero-slider w-20"
              />
            </label>
          </>
        )}
      </div>

      {/* Main Engineering Dock Surface */}
      <div className="pointer-events-auto w-full max-w-[1060px] border border-b-0 border-slate-700/90 bg-[#080c15]/96 shadow-2xl">
        {/* Advisory Banner with Plain-English Explanation & Guided Quick-Fix */}
        {topAdvisory && (
          <div className="border-b border-slate-800 bg-rose-950/35 px-4 py-1.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-200 min-w-0">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span className="truncate">{topAdvisory.message}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPlainWhy((v) => !v)}
                  className="inline-flex items-center gap-1 border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                >
                  <HelpCircle className="h-3 w-3" />
                  {showPlainWhy ? 'Hide Why' : 'Why?'}
                </button>
                {difficulty.showQuickFixes && topAdvisory.quickFix && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateConfig(
                        topAdvisory.quickFix!.patch,
                        `Applied fix: ${topAdvisory.quickFix!.label}`,
                      )
                    }
                    className="inline-flex items-center gap-1 bg-amber-400 px-2.5 py-0.5 text-[11px] font-semibold text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer"
                  >
                    <Wrench className="h-3 w-3" />
                    {topAdvisory.quickFix.label}
                  </button>
                )}
                {telemetry.advisories.length > 1 && (
                  <span className="font-mono-tab text-[11px] text-amber-400">
                    +{telemetry.advisories.length - 1} more
                  </span>
                )}
              </div>
            </div>
            {showPlainWhy && (
              <div className="mt-1.5 border-t border-rose-500/20 pt-1.5 text-[11px] text-slate-300">
                {topAdvisory.plainTerms}
              </div>
            )}
          </div>
        )}

        {telemetry.advisories.length === 0 && telemetry.synergies.length > 0 && (
          <div className="flex items-center gap-2 border-b border-slate-800 bg-emerald-950/25 px-4 py-1.5 text-xs text-emerald-300">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="truncate">Synergy Active: {telemetry.synergies.join(' · ')}</span>
          </div>
        )}

        {/* Tab Bar */}
        <div className="flex items-center overflow-x-auto border-b border-slate-800 bg-[#060911]">
          {TABS.map((t) => {
            const active = activeTab === t.id;
            const hasWarning = telemetry.advisories.some((a) => a.subsystem === t.id);
            const isMyConsole = roomId && myPrimaryTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                  active
                    ? 'border-cyan-400 bg-[#0b111e] text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{t.label}</span>
                {isMyConsole && (
                  <span className="text-[10px] font-mono-tab text-cyan-400">· Lead</span>
                )}
                {hasWarning && (
                  <span className="text-[10px] font-mono-tab text-amber-400">!</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Live Coupled Consequence Strip */}
        <div className="border-b border-slate-800/90 bg-[#070b14] px-4 py-1.5 text-[11px] font-mono-tab">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {candidateDeltas ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                <span className="inline-flex items-center gap-1.5 text-cyan-300 font-semibold shrink-0">
                  <Activity className="h-3 w-3" />
                  Impact ({candidateDeltas.label}):
                </span>
                {candidateDeltas.items.length === 0 ? (
                  <span className="text-slate-400">Currently equipped (no delta)</span>
                ) : (
                  candidateDeltas.items.map((item) => (
                    <span key={item.text} className={item.tone}>
                      {item.text}
                    </span>
                  ))
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400 min-w-0">
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <Activity className="h-3 w-3 text-cyan-400" />
                  Coupled Ripple:
                </span>
                <span>
                  Dry {telemetry.dryMassKg} kg + Fuel {telemetry.propellantMassKg} kg ={' '}
                  <strong className="text-white">{telemetry.wetMassKg} kg</strong>
                </span>
                <span className="text-slate-600">·</span>
                <span>
                  Payload Draw: <strong className="text-white">{dryPayloadMassKg} kg</strong> /{' '}
                  <strong className="text-white">{instrumentPowerW}W</strong> /{' '}
                  <strong className="text-white">{telemetry.dataGeneratedGBDay} GB/d</strong>
                </span>
                <span className="text-slate-600 hidden md:inline">·</span>
                <span className="hidden md:inline text-slate-500">
                  Hover any option to learn why it changes performance
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setTutorialStep((s) => (s === null ? 0 : null))}
                className={`inline-flex items-center gap-1 cursor-pointer font-medium ${
                  tutorialStep !== null ? 'text-amber-300' : 'text-slate-300 hover:text-white'
                }`}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>{tutorialStep !== null ? 'Close Tutorial' : 'Step-by-Step Tutorial'}</span>
              </button>
              <button
                type="button"
                onClick={onOpenDictionary}
                className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 cursor-pointer font-medium"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Mission Dictionary</span>
              </button>
              <button
                type="button"
                onClick={onOpenBriefing}
                className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 cursor-pointer"
              >
                <GitBranch className="h-3 w-3" />
                <span>Compare Viable Paths</span>
              </button>
            </div>
          </div>

          {candidateDeltas && (
            <div className="mt-1 font-sans text-[11px] text-slate-300">
              <span className="font-semibold text-cyan-400 mr-1.5">Why:</span>
              {candidateDeltas.why}
            </div>
          )}
        </div>

        {/* Optional Guided 4-Step Mission Tutorial Bar */}
        {tutorialStep !== null && (
          <div className="border-b border-cyan-500/40 bg-cyan-950/30 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-cyan-200">
                {TUTORIAL_STEPS[tutorialStep].title}
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">
                {TUTORIAL_STEPS[tutorialStep].explanation}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeTab !== TUTORIAL_STEPS[tutorialStep].tab && (
                <button
                  type="button"
                  onClick={() => onChangeTab(TUTORIAL_STEPS[tutorialStep].tab)}
                  className="border border-cyan-400/70 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-950 cursor-pointer"
                >
                  Open Tab
                </button>
              )}
              {tutorialStep > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const prev = tutorialStep - 1;
                    setTutorialStep(prev);
                    onChangeTab(TUTORIAL_STEPS[prev].tab);
                  }}
                  className="border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                >
                  Back
                </button>
              )}
              {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = tutorialStep + 1;
                    setTutorialStep(next);
                    onChangeTab(TUTORIAL_STEPS[next].tab);
                  }}
                  className="bg-cyan-500 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer"
                >
                  Next Step ({tutorialStep + 2}/{TUTORIAL_STEPS.length})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setTutorialStep(null)}
                  className="bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  Finish Tutorial
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab Body */}
        <div
          className="aero-scroll max-h-[250px] overflow-y-auto p-4"
          onMouseLeave={() => setHoveredCandidate(null)}
        >
          {activeTab === 'mission' && (
            <div className="space-y-4">
              {/* Inline Difficulty, Spacecraft Model Mode & Random Constraint Strip */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border border-slate-800 bg-slate-900/50 px-3 py-2">
                  <div className="text-xs text-slate-300">
                    <span className="font-mono-tab uppercase text-slate-400 mr-2">Difficulty:</span>
                    <span>{difficulty.tagline}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {(['junior', 'cadet', 'engineer', 'director', 'sandbox'] as DifficultyLevel[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() =>
                          onUpdateConfig(
                            { difficulty: level },
                            `Changed difficulty to ${DIFFICULTY_MODES[level].label}`,
                          )
                        }
                        className={`px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer ${
                          config.difficulty === level
                            ? 'border-cyan-400 bg-cyan-950/45 text-cyan-200'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                        }`}
                      >
                        {level === 'junior' ? 'Junior (5-13)' : DIFFICULTY_MODES[level].label.split(' ')[0]}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateConfig(
                          {
                            difficulty: 'junior',
                            modelMode: 'simplified',
                            objectiveId: 'lunar-ice',
                            orbitId: 'lunar-polar',
                            launchVehicleId: 'falcon-med',
                            busId: 'octa-probe',
                            propulsionId: 'biprop-hyper',
                            powerId: 'gaas-solar',
                            batteryId: 'batt-simple-li',
                            commsId: 'kaband-hga',
                            avionicsId: 'avionics-advanced',
                            adcsId: 'adcs-advanced',
                            shieldingId: 'aerogel-rad',
                            instrumentIds: ['multispec-cam', 'sar-radar'],
                            solarSizing: 1.2,
                            propellantRatio: 1.1,
                          },
                          'Built Quick-Start Lunar Explorer! Ready for launch.',
                        )
                      }
                      className="ml-auto px-3 py-1 text-[11px] font-semibold border border-emerald-400/70 bg-emerald-950/50 text-emerald-300 hover:bg-emerald-900/50 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Quick-Start Explorer
                    </button>
                  </div>
                </div>

                {/* Spacecraft Model Detail + Random Mission Events */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border border-slate-800 bg-slate-900/45 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                      <span>
                        <strong className="text-white">Spacecraft Model:</strong>{' '}
                        {isSimplified
                          ? 'Simplified (Core 3 subsystems & cleaner 3D)'
                          : 'Realistic (Full 6 subsystems, RCS, & fine-tuning)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {(['simplified', 'realistic'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() =>
                            onUpdateConfig(
                              { modelMode: m },
                              `Switched spacecraft model to ${m}`,
                            )
                          }
                          className={`px-2.5 py-1 text-[11px] capitalize border cursor-pointer transition-colors ${
                            modelMode === m
                              ? 'border-cyan-400 bg-cyan-950/45 text-cyan-200'
                              : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border border-slate-800 bg-slate-900/45 px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Shuffle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span className="font-semibold text-white truncate">{constraintEvent.title}</span>
                        <span className="font-mono-tab text-[11px] text-amber-300 shrink-0">
                          · {constraintEvent.impactSummary}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{constraintEvent.description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={handleRollConstraint}
                        className="border border-amber-500/60 bg-amber-950/35 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-900/50 cursor-pointer"
                      >
                        Roll Event
                      </button>
                      {constraintEvent.id !== 'none' && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateConfig(
                              { constraintEventId: 'none' },
                              'Cleared unexpected mission constraint',
                            )
                          }
                          className="border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Objective */}
              <div>
                <div className="mb-2 text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                  Mission Objective
                </div>
                <div className="space-y-1.5">
                  {OBJECTIVES.map((obj) => {
                    const selected = config.objectiveId === obj.id;
                    return (
                      <button
                        key={obj.id}
                        type="button"
                        onClick={() => handleSelectObjective(obj.id)}
                        onMouseEnter={() =>
                          setHoveredCandidate({
                            label: obj.title,
                            patch: { objectiveId: obj.id, orbitId: obj.recommendedOrbitId },
                          })
                        }
                        onFocus={() =>
                          setHoveredCandidate({
                            label: obj.title,
                            patch: { objectiveId: obj.id, orbitId: obj.recommendedOrbitId },
                          })
                        }
                        className={`w-full text-left px-3 py-2 border transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="text-xs font-semibold">{obj.title}</div>
                        <div className="mt-0.5 text-[11px] font-mono-tab text-slate-400">
                          Cap ${Math.round(obj.budgetCapM * difficulty.budgetMultiplier)}M · Min {obj.minLifetimeMonths} mo · Sci &ge;{obj.minScienceValue}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Orbit */}
              <div>
                <div className="mb-2 text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                  Target Orbit &amp; Environment
                </div>
                <div className="space-y-1.5">
                  {ORBITS.map((orb) => {
                    const selected = config.orbitId === orb.id;
                    const recommended = objective.recommendedOrbitId === orb.id;
                    const viableAlt =
                      !recommended &&
                      (orb.body === objective.targetBody ||
                        (objective.targetBody === 'psyche' &&
                          (orb.id === 'deep-jovian' || orb.id === 'deep-flyby')));
                    return (
                      <button
                        key={orb.id}
                        type="button"
                        onClick={() =>
                          onUpdateConfig({ orbitId: orb.id }, `Selected orbit ${orb.name}`)
                        }
                        onMouseEnter={() =>
                          setHoveredCandidate({
                            label: orb.name.split('(')[0].trim(),
                            patch: { orbitId: orb.id },
                          })
                        }
                        onFocus={() =>
                          setHoveredCandidate({
                            label: orb.name.split('(')[0].trim(),
                            patch: { orbitId: orb.id },
                          })
                        }
                        className={`w-full text-left px-3 py-2 border transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                          <span className="truncate">{orb.name}</span>
                          {recommended && (
                            <span className="text-[10px] font-mono-tab text-emerald-400 shrink-0">
                              Primary
                            </span>
                          )}
                          {viableAlt && (
                            <span className="text-[10px] font-mono-tab text-cyan-300 shrink-0">
                              Viable Alt
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] font-mono-tab text-slate-400">
                          Δv {orb.requiredDeltaVKms} km/s · {orb.solarDistanceAU} AU · Rad {orb.radiationDoseRate} krad/y
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Launch Vehicle */}
              <div>
                <div className="mb-2 text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                  Launch Vehicle
                </div>
                <div className="space-y-1.5">
                  {LAUNCH_VEHICLES.map((lv) => {
                    const selected = config.launchVehicleId === lv.id;
                    const orbitCap = Math.round(
                      lv.leoCapacityKg * orbit.payloadMultiplier * difficulty.payloadMultiplier,
                    );
                    return (
                      <button
                        key={lv.id}
                        type="button"
                        onClick={() =>
                          onUpdateConfig({ launchVehicleId: lv.id }, `Selected ${lv.name}`)
                        }
                        onMouseEnter={() =>
                          setHoveredCandidate({
                            label: lv.name,
                            patch: { launchVehicleId: lv.id },
                          })
                        }
                        onFocus={() =>
                          setHoveredCandidate({
                            label: lv.name,
                            patch: { launchVehicleId: lv.id },
                          })
                        }
                        className={`w-full text-left px-3 py-2 border transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{lv.name}</span>
                          <span className="font-mono-tab text-cyan-300">${lv.costM}M</span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-mono-tab text-slate-400">
                          Orbit Cap {orbitCap} kg · Fairing {lv.fairingDiameterM}m · {(lv.reliability * 100).toFixed(0)}% Rel
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              </div>

              {/* Orbit & Launch Characteristics & Compatibility Intelligence Panel */}
              <div className="mt-4 p-4 rounded-xl border border-slate-800 bg-slate-950/70 text-slate-300">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                  <div className="text-xs font-mono-tab uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Orbit &amp; Launch Compatibility Breakdown
                  </div>
                  <div className="text-[11px] font-mono-tab text-slate-400">
                    Body: <span className="text-white uppercase">{orbit.body}</span> · Target Body Req: <span className="text-white uppercase">{objective.targetBody}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Selected Orbit Breakdown */}
                  <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                    <div className="font-semibold text-white flex items-center justify-between">
                      <span>{orbit.name}</span>
                      <span className="font-mono-tab text-emerald-400">Δv {orbit.requiredDeltaVKms} km/s</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">{orbit.description}</p>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 font-mono-tab text-[11px] text-slate-400">
                      <div>Solar: <span className="text-white">{orbit.solarDistanceAU} AU</span></div>
                      <div>Eclipse: <span className="text-white">{(orbit.eclipseFraction * 100).toFixed(0)}%</span></div>
                      <div>Radiation: <span className="text-white">{orbit.radiationDoseRate} krad/y</span></div>
                    </div>
                  </div>

                  {/* Launch Vehicle Compatibility */}
                  <div className={`p-3 border ${telemetry.massStatus === 'Critical' ? 'bg-rose-950/20 border-rose-900/60' : 'bg-slate-900/60 border-slate-800'}`}>
                    <div className="font-semibold text-white flex items-center justify-between">
                      <span>{launchVehicle.name}</span>
                      <span className="font-mono-tab text-cyan-300">${launchVehicle.costM}M</span>
                    </div>
                    <div className="mt-1.5 text-[11px] font-mono-tab flex items-center justify-between text-slate-300">
                      <span>Spacecraft Wet Mass: <strong className="text-white">{telemetry.wetMassKg} kg</strong></span>
                      <span>Rocket Capacity: <strong className={telemetry.wetMassKg > telemetry.payloadCapacityKg ? 'text-rose-400' : 'text-emerald-400'}>{telemetry.payloadCapacityKg} kg</strong></span>
                    </div>
                    <div className="mt-1.5 h-2 w-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-2 transition-all ${
                          telemetry.wetMassKg > telemetry.payloadCapacityKg
                            ? 'bg-rose-400'
                            : telemetry.massStatus === 'Tight'
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((telemetry.wetMassKg / Math.max(1, telemetry.payloadCapacityKg)) * 100),
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 text-[11px] leading-relaxed text-slate-400">
                      {telemetry.wetMassKg > telemetry.payloadCapacityKg ? (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Overweight for this orbit! Reaching farther or lower orbits reduces rocket lift capacity—pick a larger booster or lighter engine/instruments.
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Compatible ({Math.round((telemetry.wetMassKg / Math.max(1, telemetry.payloadCapacityKg)) * 100)}% of rocket lift used).
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bus' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Structure / Bus */}
              <div>
                <div className="mb-2 text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                  1. Structure &amp; Bus Frame
                </div>
                <div className="space-y-1.5">
                  {BUSES.map((b) => {
                    const selected = config.busId === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => onUpdateConfig({ busId: b.id }, `Switched bus to ${b.name}`)}
                        onMouseEnter={() => setHoveredCandidate({ label: b.name, patch: { busId: b.id } })}
                        onFocus={() => setHoveredCandidate({ label: b.name, patch: { busId: b.id } })}
                        className={`w-full text-left px-3 py-2 border transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{b.name}</span>
                          <span className="font-mono-tab text-cyan-300">${b.costM}M</span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-mono-tab text-slate-400">
                          {b.dryMassKg} kg · {b.maxInstruments} Bays · {b.dataBufferGB}GB Buffer
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Propulsion & Fuel */}
              <div>
                <div className="mb-2 text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                  2. Propulsion &amp; Tanks
                </div>
                <div className="space-y-1.5">
                  {PROPULSION_SYSTEMS.map((p) => {
                    const selected = config.propulsionId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          onUpdateConfig({ propulsionId: p.id }, `Installed ${p.name}`)
                        }
                        onMouseEnter={() =>
                          setHoveredCandidate({ label: p.name, patch: { propulsionId: p.id } })
                        }
                        onFocus={() =>
                          setHoveredCandidate({ label: p.name, patch: { propulsionId: p.id } })
                        }
                        className={`w-full text-left px-3 py-2 border transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{p.name}</span>
                          <span className="font-mono-tab text-cyan-300">${p.costM}M</span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-mono-tab text-slate-400">
                          Isp {p.ispSec}s · {p.dryMassKg} kg · {p.powerDrawW}W
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!isSimplified && (
                  <div className="mt-2.5 border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="flex items-center justify-between text-[11px] font-mono-tab text-slate-300">
                      <span>Propellant Sizing</span>
                      <span className="text-cyan-300">
                        {(config.propellantRatio * 100).toFixed(0)}% ({telemetry.propellantMassKg} kg)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.6}
                      max={1.45}
                      step={0.05}
                      value={config.propellantRatio}
                      onChange={(e) =>
                        onUpdateConfig({ propellantRatio: parseFloat(e.target.value) })
                      }
                      className="aero-slider mt-2 w-full"
                    />
                  </div>
                )}
              </div>

              {!isSimplified && (
                <>
                  {/* Onboard Computers (Avionics) */}
                  <div>
                    <div className="mb-2 text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                      3. Onboard Computers (Avionics)
                    </div>
                <div className="space-y-1.5">
                  {AVIONICS_SYSTEMS.map((av) => {
                    const selected = config.avionicsId === av.id;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() =>
                          onUpdateConfig({ avionicsId: av.id }, `Selected ${av.name}`)
                        }
                        onMouseEnter={() =>
                          setHoveredCandidate({ label: av.name, patch: { avionicsId: av.id } })
                        }
                        onFocus={() =>
                          setHoveredCandidate({ label: av.name, patch: { avionicsId: av.id } })
                        }
                        className={`w-full text-left px-3 py-2 border transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{av.name}</span>
                          <span className="font-mono-tab text-cyan-300">${av.costM}M</span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-mono-tab text-slate-400">
                          {av.massKg} kg · {av.powerDrawW}W · {av.dataBufferGB} GB Buffer ({av.complexity})
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Attitude Control (ADCS) */}
              <div>
                <div className="mb-2 text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                  4. Attitude Control (ADCS)
                </div>
                <div className="space-y-1.5">
                  {ADCS_SYSTEMS.map((adcs) => {
                    const selected = config.adcsId === adcs.id;
                    return (
                      <button
                        key={adcs.id}
                        type="button"
                        onClick={() =>
                          onUpdateConfig({ adcsId: adcs.id }, `Installed ${adcs.name}`)
                        }
                        onMouseEnter={() =>
                          setHoveredCandidate({ label: adcs.name, patch: { adcsId: adcs.id } })
                        }
                        onFocus={() =>
                          setHoveredCandidate({ label: adcs.name, patch: { adcsId: adcs.id } })
                        }
                        className={`w-full text-left px-3 py-2 border transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{adcs.name}</span>
                          <span className="font-mono-tab text-cyan-300">${adcs.costM}M</span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-mono-tab text-slate-400">
                          {adcs.massKg} kg · {adcs.powerDrawW}W · {adcs.pointingAccuracyArcsec}&quot; Pointing
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Power Batteries */}
              <div>
                <div className="mb-2 text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                  5. Power Storage (Batteries)
                </div>
                <div className="space-y-1.5">
                  {BATTERY_SYSTEMS.map((batt) => {
                    const selected = config.batteryId === batt.id;
                    return (
                      <button
                        key={batt.id}
                        type="button"
                        onClick={() =>
                          onUpdateConfig({ batteryId: batt.id }, `Selected ${batt.name}`)
                        }
                        onMouseEnter={() =>
                          setHoveredCandidate({ label: batt.name, patch: { batteryId: batt.id } })
                        }
                        onFocus={() =>
                          setHoveredCandidate({ label: batt.name, patch: { batteryId: batt.id } })
                        }
                        className={`w-full text-left px-3 py-2 border transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{batt.name}</span>
                          <span className="font-mono-tab text-cyan-300">${batt.costM}M</span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-mono-tab text-slate-400">
                          {batt.massKg} kg · {batt.capacityWh} Wh Capacity ({batt.complexity})
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
                </>
              )}

              {/* Thermal & Radiation Shielding */}
              <div>
                <div className="mb-2 text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                  {isSimplified ? '3. Thermal & Radiation Shielding' : '6. Thermal & Radiation Shielding'}
                </div>
                <div className="space-y-1.5">
                  {SHIELDING_SYSTEMS.map((s) => {
                    const selected = config.shieldingId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          onUpdateConfig({ shieldingId: s.id }, `Equipped ${s.name}`)
                        }
                        onMouseEnter={() =>
                          setHoveredCandidate({ label: s.name, patch: { shieldingId: s.id } })
                        }
                        onFocus={() =>
                          setHoveredCandidate({ label: s.name, patch: { shieldingId: s.id } })
                        }
                        className={`w-full text-left px-3 py-2 border transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{s.name}</span>
                          <span className="font-mono-tab text-cyan-300">${s.costM}M</span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-mono-tab text-slate-400">
                          {s.radToleranceKrad} krad Tolerance · {s.massKg} kg
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'power' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Power Source */}
              <div>
                <div className="mb-2 text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                  Electrical Power Generation
                </div>
                <div className="space-y-1.5">
                  {POWER_SYSTEMS.map((pw) => {
                    const selected = config.powerId === pw.id;
                    return (
                      <button
                        key={pw.id}
                        type="button"
                        onClick={() =>
                          onUpdateConfig({ powerId: pw.id }, `Selected ${pw.name}`)
                        }
                        onMouseEnter={() =>
                          setHoveredCandidate({ label: pw.name, patch: { powerId: pw.id } })
                        }
                        onFocus={() =>
                          setHoveredCandidate({ label: pw.name, patch: { powerId: pw.id } })
                        }
                        className={`w-full text-left px-3 py-2 border transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{pw.name}</span>
                          <span className="font-mono-tab text-cyan-300">${pw.costM}M</span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-mono-tab text-slate-400">
                          {pw.baseOutputWAt1AU}W @1AU · {pw.massKg} kg ·{' '}
                          {pw.kind === 'nuclear' ? 'Distance Independent' : '1/r² Solar'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {power.kind === 'solar' && !isSimplified && (
                  <div className="mt-3 border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="flex items-center justify-between text-[11px] font-mono-tab text-slate-300">
                      <span>Solar Wing Span Multiplier</span>
                      <span className="text-cyan-300">
                        {(config.solarSizing * 100).toFixed(0)}% ({telemetry.powerGeneratedW}W Gen)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={config.solarSizing}
                      onChange={(e) =>
                        onUpdateConfig({ solarSizing: parseFloat(e.target.value) })
                      }
                      className="aero-slider mt-2 w-full"
                    />
                  </div>
                )}
              </div>

              {/* Comms */}
              <div>
                <div className="mb-2 text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                  Deep-Space Communications
                </div>
                <div className="space-y-1.5">
                  {COMMS_SYSTEMS.map((cm) => {
                    const selected = config.commsId === cm.id;
                    return (
                      <button
                        key={cm.id}
                        type="button"
                        onClick={() =>
                          onUpdateConfig({ commsId: cm.id }, `Equipped ${cm.name}`)
                        }
                        onMouseEnter={() =>
                          setHoveredCandidate({ label: cm.name, patch: { commsId: cm.id } })
                        }
                        onFocus={() =>
                          setHoveredCandidate({ label: cm.name, patch: { commsId: cm.id } })
                        }
                        className={`w-full text-left px-3 py-2 border transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>{cm.name}</span>
                          <span className="font-mono-tab text-cyan-300">${cm.costM}M</span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-mono-tab text-slate-400">
                          {cm.gainDb} dB Gain · {cm.powerDrawW}W · {cm.massKg} kg
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Power & Link Balance Breakdown with Visual Indicators */}
              <div className="border border-slate-800 bg-slate-900/50 p-3.5 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                    Coupled Energy &amp; Link Budget
                  </div>
                  <div className="mt-3 space-y-2.5 text-xs font-mono-tab">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Solar Flux @ {orbit.solarDistanceAU} AU</span>
                      <span className="text-white">{(telemetry.solarFluxFactor * 100).toFixed(1)}%</span>
                    </div>

                    {/* Visual Power Bar */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">Power Gen vs. Draw</span>
                        <span
                          className={
                            telemetry.powerMarginW >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'
                          }
                        >
                          {telemetry.powerGeneratedW}W / {telemetry.powerPeakDrawW}W ({telemetry.powerStatus})
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-2 transition-all ${telemetry.powerMarginW >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (telemetry.powerPeakDrawW / Math.max(1, telemetry.powerGeneratedW)) * 100,
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Visual Data vs Downlink Bar */}
                    <div className="border-t border-slate-800 pt-2">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">Data Rate vs. Antenna</span>
                        <span className={telemetry.dataStatus === 'Nominal' ? 'text-cyan-300' : 'text-amber-300'}>
                          {telemetry.dataGeneratedGBDay} / {telemetry.downlinkCapacityGBDay} GB/d
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-2 transition-all ${
                            telemetry.dataStatus === 'Critical'
                              ? 'bg-rose-400'
                              : telemetry.dataStatus === 'Tight'
                                ? 'bg-amber-400'
                                : 'bg-cyan-400'
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (telemetry.dataGeneratedGBDay / Math.max(0.1, telemetry.downlinkCapacityGBDay)) *
                                  100,
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between border-t border-slate-800 pt-2">
                      <span className="text-slate-400">RF/Optical Link Margin</span>
                      <span className={telemetry.linkMarginDb >= 2 ? 'text-cyan-300' : 'text-rose-400'}>
                        {telemetry.linkMarginDb} dB
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payload' && (
            <div>
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="font-mono-tab uppercase tracking-wider text-slate-400">
                  Science Payload Deck ({config.instrumentIds.length}/{bus.maxInstruments} Bays Occupied)
                </div>
                <div className="font-mono-tab text-slate-300">
                  Daily Output: <span className="text-cyan-300">{telemetry.dataGeneratedGBDay} GB/day</span>
                  <span aria-hidden="true" className="mx-2 text-slate-600">·</span>
                  Downlink Cap: <span className="text-emerald-400">{telemetry.downlinkCapacityGBDay} GB/day</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {INSTRUMENTS.map((inst) => {
                  const active = config.instrumentIds.includes(inst.id);
                  const preferred = objective.preferredInstruments.includes(inst.id);
                  return (
                    <button
                      key={inst.id}
                      type="button"
                      onClick={() => handleToggleInstrument(inst.id)}
                      onMouseEnter={() =>
                        setHoveredCandidate({
                          label: `${active ? 'Remove' : 'Mount'} ${inst.shortName}`,
                          patch: getInstrumentTogglePatch(inst.id),
                        })
                      }
                      onFocus={() =>
                        setHoveredCandidate({
                          label: `${active ? 'Remove' : 'Mount'} ${inst.shortName}`,
                          patch: getInstrumentTogglePatch(inst.id),
                        })
                      }
                      className={`text-left p-3 border transition-colors cursor-pointer ${
                        active
                          ? 'border-cyan-400 bg-cyan-950/35 text-white'
                          : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold truncate">{inst.name}</span>
                        <span className="font-mono-tab text-xs text-cyan-300 shrink-0">${inst.costM}M</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{inst.description}</p>
                      <div className="mt-2 flex items-center justify-between text-[11px] font-mono-tab">
                        <span className="text-slate-400">
                          {inst.massKg}kg · {inst.powerDrawW}W · {inst.dataRateGBPerDay}GB/d
                        </span>
                        {preferred && (
                          <span className="text-emerald-400">Primary Target</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roomId ? (
                <>
                  {/* Left: 4 Engineering Seats */}
                  <div>
                    <div className="mb-2 flex items-center justify-between text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                      <span>Mission Control Roster ({members.length}/4 Engineers)</span>
                      <button
                        type="button"
                        onClick={onToggleReady}
                        className={`px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors ${
                          mySeat?.ready
                            ? 'bg-emerald-500 text-slate-950'
                            : 'border border-cyan-500/60 text-cyan-300 hover:bg-cyan-950/50'
                        }`}
                      >
                        {mySeat?.ready ? 'Signed Off (Ready)' : 'Sign Off Subsystem'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(['director', 'propulsion', 'power', 'payload'] as EngineeringRole[]).map((roleKey) => {
                        const meta = ROLE_META[roleKey];
                        const occupant = members.find((m) => m.role === roleKey);
                        const isMine = mySeat?.role === roleKey;
                        return (
                          <div
                            key={roleKey}
                            className={`border p-2.5 ${
                              isMine
                                ? 'border-cyan-400 bg-cyan-950/25'
                                : 'border-slate-800 bg-slate-900/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-white">{meta.title}</span>
                              {occupant ? (
                                <span
                                  className={`text-[10px] font-mono-tab ${
                                    occupant.ready ? 'text-emerald-400' : 'text-amber-300'
                                  }`}
                                >
                                  {occupant.ready ? 'Ready' : 'Reviewing'}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onChangeRole(roleKey)}
                                  className="text-[10px] font-mono-tab text-cyan-400 hover:underline cursor-pointer"
                                >
                                  Claim Role
                                </button>
                              )}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400">{meta.scope}</div>
                            <div className="mt-1.5 text-xs font-mono-tab text-slate-200 truncate">
                              {occupant ? occupant.displayName : 'Unassigned'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: Live Engineering Feed & Chat */}
                  <div className="flex flex-col border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-[11px] font-mono-tab uppercase tracking-wider text-slate-400 mb-2">
                      Engineering Comms &amp; Change Log
                    </div>
                    <div className="aero-scroll flex-1 max-h-[120px] overflow-y-auto space-y-1.5 text-xs">
                      {messages.length === 0 && (
                        <div className="text-slate-500">
                          Coordinate subsystem trade-offs with your team here.
                        </div>
                      )}
                      {messages.map((msg) => (
                        <div key={msg.id} className="leading-snug">
                          <span className="font-semibold text-cyan-300">{msg.senderName}</span>
                          <span className="text-slate-500 mx-1">·</span>
                          <span className="text-slate-200">{msg.text}</span>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleSubmitChat} className="mt-2.5 flex gap-2">
                      <input
                        type="text"
                        maxLength={240}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Send engineering note..."
                        className="flex-1 border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="flex items-center gap-1 bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <>
                  {/* Solo Mode Pre-Flight Checklist */}
                  <div className="border border-slate-800 bg-slate-900/50 p-3.5">
                    <div className="text-[11px] font-mono-tab uppercase tracking-wider text-slate-400 mb-2.5">
                      Solo Flight Readiness Verification
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono-tab">
                      {[
                        { label: 'Program Budget', status: telemetry.budgetStatus },
                        { label: 'Launcher Mass Cap', status: telemetry.massStatus },
                        { label: 'Orbital Δv Reserve', status: telemetry.deltaVStatus },
                        { label: 'Power Margin', status: telemetry.powerStatus },
                        { label: 'Telemetry Downlink', status: telemetry.dataStatus },
                        { label: 'Radiation Lifetime', status: telemetry.lifetimeStatus },
                      ].map((row) => (
                        <div
                          key={row.label}
                          className="flex items-center justify-between border border-slate-800 bg-slate-950/70 px-2.5 py-1.5"
                        >
                          <span className="text-slate-300">{row.label}</span>
                          <span
                            className={
                              row.status === 'Nominal'
                                ? 'text-emerald-400'
                                : row.status === 'Tight'
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                            }
                          >
                            {row.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-slate-800 bg-slate-900/50 p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-display font-semibold text-white">
                        <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                        Collaborate with up to 4 Engineers
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                        Open a shared Firestore Mission Room to invite up to three teammates. Each participant claims an engineering console, debates mass/power trade-offs live, and signs off before launch.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenTeamModal}
                      className="mt-3 w-full border border-cyan-500/60 bg-cyan-950/40 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition-colors cursor-pointer"
                    >
                      Launch or Join 4-Player Team Room
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
