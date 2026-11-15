import { useState } from 'react';
import {
  ArrowRight,
  Compass,
  Cpu,
  Radio,
  Rocket,
  Shield,
  Shuffle,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import {
  DIFFICULTY_MODES,
  MISSION_ARCHETYPES,
  OBJECTIVES,
  RANDOM_CONSTRAINTS,
  ROLE_META,
} from '../data/catalog';
import type {
  DifficultyLevel,
  EngineeringRole,
  MissionArchetype,
  MissionConfig,
  SpacecraftModelMode,
} from '../types/mission';

interface Phase1BriefingProps {
  config: MissionConfig;
  roomId: string | null;
  selectedSoloRole: EngineeringRole;
  onSelectSoloRole: (role: EngineeringRole) => void;
  onSelectDifficulty: (d: DifficultyLevel) => void;
  onSelectModelMode: (mode: SpacecraftModelMode) => void;
  onSelectObjective: (objectiveId: string) => void;
  onSelectConstraint: (constraintId: string) => void;
  onApplyArchetype: (arch: MissionArchetype) => void;
  onOpenTeamRoomModal: () => void;
  onEnterAssemblyBay: () => void;
}

export function Phase1Briefing({
  config,
  roomId,
  selectedSoloRole,
  onSelectSoloRole,
  onSelectDifficulty,
  onSelectModelMode,
  onSelectObjective,
  onSelectConstraint,
  onApplyArchetype,
  onOpenTeamRoomModal,
  onEnterAssemblyBay,
}: Phase1BriefingProps) {
  const [teamModeChoice, setTeamModeChoice] = useState<'solo' | 'coop'>(
    roomId ? 'coop' : 'solo',
  );

  const selectedObjective =
    OBJECTIVES.find((o) => o.id === config.objectiveId) ?? OBJECTIVES[0];
  const matchingArchetypes = MISSION_ARCHETYPES.filter(
    (a) => a.objectiveId === selectedObjective.id,
  );

  const roleIcons: Record<EngineeringRole, typeof Compass> = {
    director: Compass,
    propulsion: Rocket,
    power: Radio,
    payload: Cpu,
  };

  return (
    <div className="pointer-events-auto fixed inset-0 top-[52px] z-20 overflow-y-auto bg-[#050811]/95 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6 pb-20">
        {/* Phase Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-800 bg-[#090f1d] p-5">
          <div>
            <div className="text-[11px] font-mono-tab uppercase tracking-widest text-cyan-400">
              Phase 1 of 5 · Mission Briefing &amp; Crew Setup
            </div>
            <h1 className="mt-1 font-display text-2xl md:text-3xl font-bold text-white">
              Prepare Your Space Mission
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Choose your crew setup, difficulty level, and target destination before entering the 3D Spacecraft Assembly Bay.
            </p>
          </div>

          <button
            type="button"
            onClick={onEnterAssemblyBay}
            className="flex items-center gap-2 bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer shrink-0"
          >
            <span>Build Spacecraft (Phase 2)</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Row 1: Mode (Solo vs Co-Op 4 Roles) & Difficulty Mode */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Crew & Mode Setup */}
          <div className="lg:col-span-7 border border-slate-800 bg-[#080d19] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-mono-tab uppercase tracking-wider text-slate-300">
                1. Choose Single-Player or Co-Op Team Mode (Up to 4 Players)
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setTeamModeChoice('solo')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border cursor-pointer transition-colors ${
                    teamModeChoice === 'solo'
                      ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  Single-Player
                </button>
                <button
                  type="button"
                  onClick={() => setTeamModeChoice('coop')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border cursor-pointer transition-colors ${
                    teamModeChoice === 'coop'
                      ? 'border-emerald-400 bg-emerald-950/50 text-emerald-200'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Co-Op Team (1–4)
                </button>
              </div>
            </div>

            {teamModeChoice === 'coop' && (
              <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-500/40 bg-emerald-950/20 px-3.5 py-2.5 text-xs">
                <span className="text-emerald-200">
                  {roomId
                    ? `Connected to live Co-Op Room ${roomId}! Share this code with up to 3 teammates.`
                    : 'Host or join a live multi-player Team Room so up to 4 friends collaborate in real time.'}
                </span>
                <button
                  type="button"
                  onClick={onOpenTeamRoomModal}
                  className="bg-emerald-500 px-3.5 py-1.5 font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer shrink-0"
                >
                  {roomId ? `Manage Room (${roomId})` : 'Open Team Room'}
                </button>
              </div>
            )}

            <div className="text-[11px] text-slate-400">
              {teamModeChoice === 'solo'
                ? 'In Single-Player, you command all 4 NASA engineering roles—pick your primary focus badge below:'
                : 'In Co-Op Team Mode, teammates split these 4 specialized roles and sign off at shared checkpoints:'}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(['director', 'propulsion', 'power', 'payload'] as EngineeringRole[]).map((role) => {
                const meta = ROLE_META[role];
                const Icon = roleIcons[role];
                const active = selectedSoloRole === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => onSelectSoloRole(role)}
                    className={`text-left border p-3 transition-colors cursor-pointer ${
                      active
                        ? 'border-cyan-400 bg-cyan-950/35'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <Icon className="h-3.5 w-3.5 text-cyan-400" />
                        {meta.title}
                      </span>
                      <span className="font-mono-tab text-[10px] text-cyan-300">
                        {meta.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{meta.scope}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty Selector */}
          <div className="lg:col-span-5 border border-slate-800 bg-[#080d19] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-mono-tab uppercase tracking-wider text-slate-300">
                2. Select Difficulty Mode
              </div>
              <Shield className="h-4 w-4 text-amber-400" />
            </div>

            <div className="space-y-2">
              {(['cadet', 'engineer', 'director', 'sandbox'] as DifficultyLevel[]).map((level) => {
                const spec = DIFFICULTY_MODES[level];
                const active =
                  config.difficulty === level ||
                  (level === 'cadet' && config.difficulty === 'junior');
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => onSelectDifficulty(level)}
                    className={`w-full text-left border p-3 transition-colors cursor-pointer ${
                      active
                        ? 'border-cyan-400 bg-cyan-950/40'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{spec.label}</span>
                      <span className="font-mono-tab text-[10px] text-cyan-300">
                        {spec.isSandbox
                          ? 'No Limits'
                          : `${Math.round(spec.budgetMultiplier * 100)}% Budget`}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                      {spec.tagline}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="text-[11px] font-mono-tab uppercase tracking-wider text-slate-300">
                Spacecraft Model Detail
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: 'simplified' as SpacecraftModelMode,
                      title: 'Simplified Model',
                      desc: 'Core bus, power, comms & shield choices.',
                    },
                    {
                      id: 'realistic' as SpacecraftModelMode,
                      title: 'Realistic Model',
                      desc: 'Adds batteries, flight computer memory & star aiming.',
                    },
                  ]
                ).map((modeOpt) => {
                  const active = (config.modelMode ?? 'realistic') === modeOpt.id;
                  return (
                    <button
                      key={modeOpt.id}
                      type="button"
                      onClick={() => onSelectModelMode(modeOpt.id)}
                      className={`text-left border p-2.5 transition-colors cursor-pointer ${
                        active
                          ? 'border-cyan-400 bg-cyan-950/40'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">{modeOpt.title}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400 leading-snug">
                        {modeOpt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Mission Scenario Cards */}
        <div className="border border-slate-800 bg-[#080d19] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-mono-tab uppercase tracking-wider text-slate-300">
                3. Select Your Mission Scenario
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Each world imposes distinct critical resource bottlenecks—there is never just one winning design.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">Mission Constraint:</span>
              <select
                value={config.constraintEventId || 'none'}
                onChange={(e) => onSelectConstraint(e.target.value)}
                className="border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
              >
                {RANDOM_CONSTRAINTS.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.title} ({evt.impactSummary})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const pool = RANDOM_CONSTRAINTS.filter((c) => c.id !== 'none');
                  const pick = pool[Math.floor(Math.random() * pool.length)];
                  if (pick) onSelectConstraint(pick.id);
                }}
                className="inline-flex items-center gap-1 border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:border-amber-400 cursor-pointer whitespace-nowrap"
                title="Roll an unexpected mission constraint event"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Surprise Event
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {OBJECTIVES.map((obj) => {
              const selected = obj.id === selectedObjective.id;
              return (
                <button
                  key={obj.id}
                  type="button"
                  onClick={() => onSelectObjective(obj.id)}
                  className={`flex flex-col justify-between text-left border p-4 transition-colors cursor-pointer ${
                    selected
                      ? 'border-cyan-400 bg-cyan-950/35'
                      : 'border-slate-800 bg-slate-900/55 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-tab text-[10px] uppercase tracking-wider text-cyan-400">
                        {obj.badgeLabel}
                      </span>
                      <span className="font-mono-tab text-[11px] font-semibold text-amber-300">
                        Cap ${obj.budgetCapM}M
                      </span>
                    </div>
                    <h3 className="mt-1.5 font-display text-base font-bold text-white">
                      {obj.title}
                    </h3>
                    <div className="mt-1 font-mono-tab text-[10px] text-amber-300/95">
                      Critical: {obj.criticalResources.join(' · ')}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-cyan-100/90">
                      {obj.storyHook}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                      {obj.summary}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono-tab text-slate-400">
                    <span>Min Science: {obj.minScienceValue}</span>
                    <span>Goal: {Math.round(obj.minLifetimeMonths / 12)} Yrs</span>
                    <span>Rad: {obj.radiationSeverity}×</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Quick Starter Templates + Bottom CTA */}
        <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-800 bg-[#080d19] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono-tab text-slate-400 mr-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Quick Blueprints for {selectedObjective.targetBody.toUpperCase()}:
            </span>
            {matchingArchetypes.map((arch) => (
              <button
                key={arch.id}
                type="button"
                onClick={() => onApplyArchetype(arch)}
                className="border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-400 hover:text-cyan-200 cursor-pointer"
              >
                {arch.name} ({arch.strategyTag})
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onEnterAssemblyBay}
            className="flex items-center gap-2 bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer shrink-0"
          >
            <span>Enter 3D Assembly Bay</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
