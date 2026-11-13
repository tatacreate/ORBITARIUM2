import { ArrowLeft, BookOpen, Check, Compass, Copy, History, Play, Users, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { DIFFICULTY_MODES, OBJECTIVES } from '../data/catalog';
import type { ConstraintStatus, MissionConfig, TelemetryReport } from '../types/mission';

interface TopTelemetryBarProps {
  config: MissionConfig;
  telemetry: TelemetryReport;
  roomId: string | null;
  memberCount: number;
  runCount: number;
  muted: boolean;
  onToggleMute: () => void;
  onBackToTitle: () => void;
  onOpenTeamModal: () => void;
  onOpenArchive: () => void;
  onOpenGuide: () => void;
  onOpenBriefing: () => void;
  onStartSimulation: () => void;
}

function statusTone(status: ConstraintStatus): string {
  if (status === 'Nominal') return 'text-emerald-400';
  if (status === 'Tight') return 'text-amber-400';
  return 'text-rose-400';
}

export function TopTelemetryBar({
  config,
  telemetry,
  roomId,
  memberCount,
  runCount,
  muted,
  onToggleMute,
  onBackToTitle,
  onOpenTeamModal,
  onOpenArchive,
  onOpenGuide,
  onOpenBriefing,
  onStartSimulation,
}: TopTelemetryBarProps) {
  const [copied, setCopied] = useState(false);
  const objective = OBJECTIVES.find((o) => o.id === config.objectiveId) ?? OBJECTIVES[0];
  const diffLabel = DIFFICULTY_MODES[config.difficulty]?.label.split(' ')[0] ?? 'Engineer';

  const handleCopyCode = () => {
    if (!roomId) return;
    void navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <header className="pointer-events-auto relative z-20 border-b border-slate-800 bg-[#080c15]/95 px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Zone 1: Back + Clickable Mission Objective */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToTitle}
            title="Return to Title Screen"
            className="flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-500 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Menu
          </button>

          <div className="min-w-0">
            <button
              type="button"
              onClick={onOpenBriefing}
              title="Review Mission Objective & Alternative Solutions"
              className="group flex items-center gap-1.5 text-sm font-display font-semibold text-white hover:text-cyan-300 transition-colors truncate cursor-pointer"
            >
              <Compass className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">{objective.title}</span>
            </button>
            <div className="flex items-center gap-2 text-[11px] font-mono-tab text-slate-400">
              <span>{diffLabel}</span>
              <span aria-hidden="true">·</span>
              <span>Run #{runCount}</span>
              <span aria-hidden="true">·</span>
              <span>
                Sci {telemetry.scienceReturnPotential}/{objective.minScienceValue}
              </span>
              {roomId && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    Room {roomId} ({memberCount}/4)
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Zone 2: Live Coupled Constraint Readouts (Desktop) */}
        <div className="hidden xl:flex items-center gap-4 font-mono-tab text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Budget</div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-white">${telemetry.totalCostM}M</span>
              <span className="text-slate-500">/ ${telemetry.budgetCapM}M</span>
              <span className={statusTone(telemetry.budgetStatus)}>{telemetry.budgetStatus}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Wet Mass</div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-white">{telemetry.wetMassKg}</span>
              <span className="text-slate-500">/ {telemetry.payloadCapacityKg} kg</span>
              <span className={statusTone(telemetry.massStatus)}>{telemetry.massStatus}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Orbital Δv</div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-white">{telemetry.availableDeltaVKms}</span>
              <span className="text-slate-500">/ {telemetry.requiredDeltaVKms} km/s</span>
              <span className={statusTone(telemetry.deltaVStatus)}>{telemetry.deltaVStatus}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Power Margin</div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-white">
                {telemetry.powerMarginW >= 0 ? `+${telemetry.powerMarginW}` : telemetry.powerMarginW} W
              </span>
              <span className={statusTone(telemetry.powerStatus)}>{telemetry.powerStatus}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Downlink</div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-white">{telemetry.downlinkCapacityGBDay}</span>
              <span className="text-slate-500">/ {telemetry.dataGeneratedGBDay} GB/d</span>
              <span className={statusTone(telemetry.dataStatus)}>{telemetry.dataStatus}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Lifetime</div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-white">{telemetry.estimatedLifetimeMonths}</span>
              <span className="text-slate-500">/ {telemetry.requiredLifetimeMonths} mo</span>
              <span className={statusTone(telemetry.lifetimeStatus)}>{telemetry.lifetimeStatus}</span>
            </div>
          </div>
        </div>

        {/* Zone 3: Primary Simulation Action & Utilities */}
        <div className="flex items-center gap-2 shrink-0">
          {!roomId && (
            <button
              type="button"
              onClick={onOpenTeamModal}
              className="hidden sm:flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Users className="h-3.5 w-3.5" />
              Team Mode
            </button>
          )}

          <button
            type="button"
            onClick={onOpenGuide}
            title="Field Guide & Difficulty"
            className="flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Guide</span>
          </button>

          <button
            type="button"
            onClick={onOpenArchive}
            title="Mission Leaderboard, Saved Log & Design Compare"
            className="flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Rank &amp; Log</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
            className="border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onStartSimulation}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              telemetry.launchReady
                ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
            }`}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {telemetry.launchReady ? 'Simulate Launch' : 'Test Launch (Warnings)'}
          </button>
        </div>
      </div>

      {/* Compact Constraint Strip for Laptop / Tablet Viewports */}
      <div className="mt-1.5 flex xl:hidden flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800/70 pt-1.5 font-mono-tab text-[11px]">
        <span>
          <span className="text-slate-400">Budget: </span>
          <span className={statusTone(telemetry.budgetStatus)}>
            ${telemetry.totalCostM}M/${telemetry.budgetCapM}M
          </span>
        </span>
        <span>
          <span className="text-slate-400">Mass: </span>
          <span className={statusTone(telemetry.massStatus)}>
            {telemetry.wetMassKg}/{telemetry.payloadCapacityKg}kg
          </span>
        </span>
        <span>
          <span className="text-slate-400">Δv: </span>
          <span className={statusTone(telemetry.deltaVStatus)}>
            {telemetry.availableDeltaVKms}/{telemetry.requiredDeltaVKms}km/s
          </span>
        </span>
        <span>
          <span className="text-slate-400">Power: </span>
          <span className={statusTone(telemetry.powerStatus)}>
            {telemetry.powerMarginW >= 0 ? `+${telemetry.powerMarginW}` : telemetry.powerMarginW}W
          </span>
        </span>
        <span>
          <span className="text-slate-400">Link: </span>
          <span className={statusTone(telemetry.dataStatus)}>
            {telemetry.downlinkCapacityGBDay}/{telemetry.dataGeneratedGBDay}GB/d
          </span>
        </span>
        <span>
          <span className="text-slate-400">Life: </span>
          <span className={statusTone(telemetry.lifetimeStatus)}>
            {telemetry.estimatedLifetimeMonths}/{telemetry.requiredLifetimeMonths}mo
          </span>
        </span>
      </div>
    </header>
  );
}
