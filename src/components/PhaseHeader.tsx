import { BookOpen, History, Rocket, Users, Volume2, VolumeX } from 'lucide-react';
import { getCatalogParts } from '../engine/physics';
import type { GamePhase, MissionConfig, TelemetryReport } from '../types/mission';

interface PhaseHeaderProps {
  phase: GamePhase;
  config: MissionConfig;
  telemetry: TelemetryReport;
  roomId: string | null;
  memberCount: number;
  runCount: number;
  muted: boolean;
  onNavigatePhase: (target: GamePhase) => void;
  onToggleMute: () => void;
  onOpenDictionary: () => void;
  onOpenTeamModal: () => void;
  onOpenArchive: () => void;
  onLaunchMission: () => void;
}

const STEPS: { id: GamePhase; num: number; label: string }[] = [
  { id: 'briefing', num: 1, label: 'Briefing' },
  { id: 'assembly', num: 2, label: 'Spacecraft' },
  { id: 'planner', num: 3, label: 'Rocket & Orbit' },
  { id: 'simulating', num: 4, label: 'Flight Sim' },
  { id: 'debrief', num: 5, label: 'Debrief' },
];

export function PhaseHeader({
  phase,
  config,
  telemetry,
  roomId,
  memberCount,
  runCount,
  muted,
  onNavigatePhase,
  onToggleMute,
  onOpenDictionary,
  onOpenTeamModal,
  onOpenArchive,
  onLaunchMission,
}: PhaseHeaderProps) {
  const { objective, difficulty } = getCatalogParts(config);
  const currentIdx = STEPS.findIndex((s) => s.id === phase);

  return (
    <header className="pointer-events-auto fixed top-0 left-0 right-0 z-30 flex items-center justify-between gap-2 border-b border-slate-800/95 bg-[#080c15] px-3 py-2 md:px-5">
      {/* Left: Brand & Active Mission Tag */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => onNavigatePhase('title')}
          className="flex items-center gap-2 text-left hover:opacity-85 transition-opacity cursor-pointer shrink-0"
        >
          <svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <circle cx="20" cy="20" r="16" stroke="#1e293b" strokeWidth="2" />
            <ellipse
              cx="20"
              cy="20"
              rx="15"
              ry="6"
              transform="rotate(-28 20 20)"
              stroke="#06b6d4"
              strokeWidth="2"
            />
            <circle cx="20" cy="20" r="4" fill="#f59e0b" />
          </svg>
          <span className="font-display text-sm font-bold tracking-wide text-white">
            ORBITARIUM
          </span>
        </button>

        <div className="hidden xl:flex items-center gap-2 border-l border-slate-800 pl-3 text-xs min-w-0">
          <span className="truncate max-w-[200px] font-medium text-slate-200">
            {objective.title}
          </span>
          <span className="font-mono-tab text-[11px] text-cyan-400 shrink-0">
            {difficulty.shortLabel} · Run #{runCount}
          </span>
          {roomId && (
            <span className="font-mono-tab text-[11px] text-emerald-400 shrink-0">
              · Room {roomId} ({memberCount}/4)
            </span>
          )}
        </div>
      </div>

      {/* Center: Interactive 5-Phase Stepper */}
      <nav aria-label="Mission Phases" className="hidden md:flex items-center gap-1">
        {STEPS.map((step, idx) => {
          const isCurrent = step.id === phase;
          const isReachable =
            step.id === 'briefing' ||
            step.id === 'assembly' ||
            step.id === 'planner' ||
            (step.id === 'simulating' && phase === 'simulating') ||
            (step.id === 'debrief' && phase === 'debrief');
          const isCompleted = idx < currentIdx;

          return (
            <button
              key={step.id}
              type="button"
              disabled={!isReachable || phase === 'simulating'}
              onClick={() => {
                if (isReachable && phase !== 'simulating') {
                  onNavigatePhase(step.id);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium border transition-colors whitespace-nowrap ${
                isCurrent
                  ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 cursor-default'
                  : isCompleted && isReachable && phase !== 'simulating'
                    ? 'border-emerald-500/40 bg-emerald-950/25 text-emerald-300 hover:border-cyan-400 cursor-pointer'
                    : isReachable && phase !== 'simulating'
                      ? 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600 cursor-pointer'
                      : 'border-slate-900 bg-slate-950 text-slate-600 cursor-not-allowed'
              }`}
            >
              <span className="font-mono-tab font-bold">{step.num}.</span>
              <span>{step.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right: Utilities & Primary Phase CTA */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenDictionary}
          title="Mission Dictionary"
          className="flex items-center gap-1 border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-200 hover:border-cyan-400 cursor-pointer"
        >
          <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
          <span className="hidden lg:inline">Terms</span>
        </button>

        <button
          type="button"
          onClick={onOpenTeamModal}
          title="Co-Op Team Room"
          className="flex items-center gap-1 border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-200 hover:border-cyan-400 cursor-pointer"
        >
          <Users className="h-3.5 w-3.5 text-cyan-400" />
          <span className="hidden lg:inline">{roomId ? roomId : 'Team'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenArchive}
          title="Mission Rankings & Archive"
          className="flex items-center gap-1 border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-200 hover:border-cyan-400 cursor-pointer"
        >
          <History className="h-3.5 w-3.5 text-amber-400" />
          <span className="hidden lg:inline">Rankings</span>
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          title={muted ? 'Unmute Sound' : 'Mute Sound'}
          className="border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:border-cyan-400 cursor-pointer"
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>

        {phase === 'assembly' && (
          <button
            type="button"
            onClick={() => onNavigatePhase('planner')}
            className="flex items-center gap-1.5 bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>Rocket &amp; Orbit →</span>
          </button>
        )}

        {phase === 'planner' && (
          <button
            type="button"
            onClick={onLaunchMission}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              telemetry.launchReady
                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                : 'border border-amber-400/80 bg-amber-950/60 text-amber-200 hover:bg-amber-900/60'
            }`}
          >
            <Rocket className="h-3.5 w-3.5" />
            <span>{telemetry.launchReady ? 'Launch Mission' : 'Test Launch (Flagged)'}</span>
          </button>
        )}
      </div>
    </header>
  );
}
