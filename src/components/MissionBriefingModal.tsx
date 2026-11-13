import { ArrowRight, Compass, GitBranch, Layers, ShieldAlert, X } from 'lucide-react';
import { useMemo } from 'react';
import {
  DIFFICULTY_MODES,
  INSTRUMENTS,
  LAUNCH_VEHICLES,
  MISSION_ARCHETYPES,
  OBJECTIVES,
  ORBITS,
  POWER_SYSTEMS,
  PROPULSION_SYSTEMS,
} from '../data/catalog';
import { computeTelemetry } from '../engine/physics';
import type { MissionArchetype, MissionConfig } from '../types/mission';

interface MissionBriefingModalProps {
  config: MissionConfig;
  isInitialBriefing: boolean;
  onSelectObjective: (objectiveId: string) => void;
  onApplyArchetype: (archetype: MissionArchetype) => void;
  onConfirmEnterHangar: () => void;
  onClose?: () => void;
}

export function MissionBriefingModal({
  config,
  isInitialBriefing,
  onSelectObjective,
  onApplyArchetype,
  onConfirmEnterHangar,
  onClose,
}: MissionBriefingModalProps) {
  const objective = OBJECTIVES.find((o) => o.id === config.objectiveId) ?? OBJECTIVES[0];
  const difficulty = DIFFICULTY_MODES[config.difficulty] ?? DIFFICULTY_MODES.engineer;
  const scaledBudgetCap = Math.round(objective.budgetCapM * difficulty.budgetMultiplier);

  const matchingOrbits = useMemo(
    () =>
      ORBITS.filter(
        (o) =>
          o.body === objective.targetBody ||
          (objective.targetBody === 'psyche' &&
            (o.id === 'deep-jovian' || o.id === 'deep-flyby')),
      ),
    [objective.targetBody],
  );

  const archetypes = useMemo(
    () =>
      MISSION_ARCHETYPES.filter((a) => a.objectiveId === objective.id).map((arch) => {
        const merged: MissionConfig = {
          ...config,
          ...arch.patch,
          difficulty: config.difficulty,
        };
        const t = computeTelemetry(merged);
        const orbit = ORBITS.find((o) => o.id === merged.orbitId);
        const rocket = LAUNCH_VEHICLES.find((l) => l.id === merged.launchVehicleId);
        const prop = PROPULSION_SYSTEMS.find((p) => p.id === merged.propulsionId);
        const power = POWER_SYSTEMS.find((p) => p.id === merged.powerId);
        return { arch, telemetry: t, orbit, rocket, prop, power };
      }),
    [objective.id, config],
  );

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/78 p-4 overflow-y-auto">
      <div className="w-full max-w-5xl border border-slate-700 bg-[#080c15] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono-tab uppercase tracking-wider text-cyan-400">
              <Compass className="h-3.5 w-3.5" />
              <span>
                {isInitialBriefing
                  ? 'Step 01 · Define Mission Objective Before Spacecraft Design'
                  : 'Mission Charter & Alternative Solution Pathways'}
              </span>
            </div>
            <h2 className="mt-1 font-display text-2xl font-bold text-white">
              Mission Objective &amp; Requirements Brief
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Select your scientific destination first, review its coupled engineering constraints, and inspect how multiple distinct spacecraft architectures can satisfy the same mission.
            </p>
          </div>
          {!isInitialBriefing && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="border border-slate-700 p-1.5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Choose Objective */}
          <div className="lg:col-span-5 space-y-2">
            <div className="text-[11px] font-mono-tab uppercase tracking-wider text-slate-400 mb-1">
              1. Select Mission Objective ({difficulty.label})
            </div>
            {OBJECTIVES.map((obj) => {
              const selected = obj.id === objective.id;
              const cap = Math.round(obj.budgetCapM * difficulty.budgetMultiplier);
              return (
                <button
                  key={obj.id}
                  type="button"
                  onClick={() => onSelectObjective(obj.id)}
                  className={`w-full text-left border p-3 transition-colors cursor-pointer ${
                    selected
                      ? 'border-cyan-400 bg-cyan-950/35'
                      : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">{obj.title}</span>
                    <span className="font-mono-tab text-[11px] uppercase text-cyan-300 shrink-0">
                      {obj.targetBody}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2">{obj.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono-tab text-slate-300">
                    <span>Budget &le; ${cap}M</span>
                    <span className="text-slate-600">·</span>
                    <span>Science &ge; {obj.minScienceValue}</span>
                    <span className="text-slate-600">·</span>
                    <span>Life &ge; {obj.minLifetimeMonths} mo</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Requirements + Multiple Viable Pathways */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            {/* Requirements Specification */}
            <div className="border border-slate-800 bg-slate-900/55 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-mono-tab uppercase tracking-wider text-cyan-400">
                  2. Target Requirements · {objective.title}
                </div>
                <span className="text-[11px] font-mono-tab text-slate-400">
                  {matchingOrbits.length} Viable Target Orbits
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono-tab">
                <div className="border border-slate-800 bg-slate-950/80 p-2.5">
                  <div className="text-[10px] uppercase text-slate-400">Budget Cap</div>
                  <div className="mt-0.5 text-sm font-semibold text-white">${scaledBudgetCap}M</div>
                </div>
                <div className="border border-slate-800 bg-slate-950/80 p-2.5">
                  <div className="text-[10px] uppercase text-slate-400">Min Science</div>
                  <div className="mt-0.5 text-sm font-semibold text-white">
                    {objective.minScienceValue} / 100
                  </div>
                </div>
                <div className="border border-slate-800 bg-slate-950/80 p-2.5">
                  <div className="text-[10px] uppercase text-slate-400">Min Lifetime</div>
                  <div className="mt-0.5 text-sm font-semibold text-white">
                    {objective.minLifetimeMonths} mo
                  </div>
                </div>
                <div className="border border-slate-800 bg-slate-950/80 p-2.5">
                  <div className="text-[10px] uppercase text-slate-400">Rad Severity</div>
                  <div className="mt-0.5 text-sm font-semibold text-amber-300">
                    {objective.radiationSeverity}x Baseline
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-start gap-2 text-xs text-slate-300">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <span>{objective.constraintsNote}</span>
                  <div className="mt-1 text-[11px] font-mono-tab text-slate-400">
                    Preferred Instruments:{' '}
                    {objective.preferredInstruments
                      .map((id) => INSTRUMENTS.find((i) => i.id === id)?.shortName || id)
                      .join(', ')}
                  </div>
                </div>
              </div>
            </div>

            {/* Multiple Valid Solution Pathways */}
            <div className="border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2 text-[11px] font-mono-tab uppercase tracking-wider text-emerald-400">
                  <GitBranch className="h-3.5 w-3.5" />
                  <span>3. Multiple Viable Engineering Architectures (No Single Perfect Answer)</span>
                </div>
              </div>

              <div className="space-y-2.5">
                {archetypes.map(({ arch, telemetry: t, orbit, rocket, prop, power }) => (
                  <div
                    key={arch.id}
                    className="border border-slate-800 bg-slate-950/80 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-white">{arch.name}</span>
                        <span className="border border-emerald-500/40 bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-mono-tab text-emerald-300">
                          {arch.strategyTag}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">{arch.tradeOffNote}</p>
                      <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] font-mono-tab text-slate-300">
                        <span>{orbit?.name.split('(')[0].trim()}</span>
                        <span className="text-slate-600">·</span>
                        <span>{rocket?.name.split(' ')[0]}</span>
                        <span className="text-slate-600">·</span>
                        <span>{prop?.name.split(' ')[0]}</span>
                        <span className="text-slate-600">·</span>
                        <span>{power?.name.split(' ')[0]}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] font-mono-tab text-cyan-300">
                        <span>${t.totalCostM}M</span>
                        <span>{t.wetMassKg} kg</span>
                        <span>{t.powerMarginW >= 0 ? `+${t.powerMarginW}` : t.powerMarginW}W</span>
                        <span>{t.estimatedLifetimeMonths} mo</span>
                        <span>Sci {t.scienceReturnPotential}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onApplyArchetype(arch)}
                      className="shrink-0 border border-cyan-500/60 bg-cyan-950/40 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition-colors cursor-pointer"
                    >
                      {isInitialBriefing ? 'Launch With This Path' : 'Load Architecture'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Action */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Layers className="h-3.5 w-3.5 text-slate-500" />
                <span>Every part choice updates mass, Δv, power, downlink, and cost live in the Hangar.</span>
              </div>
              <button
                type="button"
                onClick={onConfirmEnterHangar}
                className="flex items-center gap-2 bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
              >
                <span>{isInitialBriefing ? 'Enter Spacecraft Hangar' : 'Return to Hangar'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
