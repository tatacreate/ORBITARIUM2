import { AlertTriangle, FastForward, PauseCircle, Radio, ShieldAlert, Zap } from 'lucide-react';
import { ROLE_META } from '../data/catalog';
import { getCatalogParts } from '../engine/physics';
import type { AnomalyChoice, FlightAnomaly, MissionConfig, TelemetryReport } from '../types/mission';

export interface SimTelemetrySample {
  progress: number;
  powerPct: number;
  dataPct: number;
  sciencePct: number;
}

interface Phase4SimulationProps {
  config: MissionConfig;
  telemetry: TelemetryReport;
  simProgress: number;
  simSpeed: 1 | 2;
  currentPhaseIndex: number;
  samples: SimTelemetrySample[];
  activeAnomaly: FlightAnomaly | null;
  resolvedCount: number;
  totalAnomalies: number;
  onToggleSpeed: () => void;
  onResolveAnomaly: (choice: AnomalyChoice) => void;
  onAbortSimulation: () => void;
}

const FLIGHT_STAGES = [
  { name: 'Liftoff & Fairing Sep', desc: 'Main booster ascent and protective nose cone jettison' },
  { name: 'Interplanetary Cruise', desc: 'Solar / RTG stabilization & deep-space trajectory burn' },
  { name: 'Orbit Insertion Burn', desc: 'Propulsion braking into target science orbit' },
  { name: 'Science & Downlink', desc: 'Mapping target world & beaming discoveries to Earth' },
];

export function Phase4Simulation({
  config,
  telemetry,
  simProgress,
  simSpeed,
  currentPhaseIndex,
  samples,
  activeAnomaly,
  resolvedCount,
  totalAnomalies,
  onToggleSpeed,
  onResolveAnomaly,
  onAbortSimulation,
}: Phase4SimulationProps) {
  const { objective, launchVehicle, comms, orbit } = getCatalogParts(config);
  const pct = Math.min(100, Math.round(simProgress * 100));

  const totalMissionDays = Math.max(180, telemetry.requiredLifetimeMonths * 30);
  const currentDay = Math.max(1, Math.round(simProgress * totalMissionDays));
  const currentYear = (currentDay / 365).toFixed(1);

  const latestSample = samples[samples.length - 1] ?? {
    progress: simProgress,
    powerPct: Math.max(15, Math.min(100, 75 + (telemetry.powerMarginW / 500) * 20)),
    dataPct: Math.min(100, Math.round((telemetry.dataGeneratedGBDay / Math.max(1, telemetry.downlinkCapacityGBDay)) * 65)),
    sciencePct: pct,
  };

  // Build SVG polyline points for live resource graph
  const buildLine = (getter: (s: SimTelemetrySample) => number) => {
    if (samples.length < 2) {
      const y = 76 - (getter(latestSample) / 100) * 64;
      return `0,${y} 280,${y}`;
    }
    return samples
      .map((s, idx) => {
        const x = (idx / Math.max(1, samples.length - 1)) * 280;
        const val = Math.max(5, Math.min(98, getter(s)));
        const y = 78 - (val / 100) * 66;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 pt-[62px]">
      {/* Top Flight Timeline & Live Telemetry Strip */}
      <div className="pointer-events-auto mx-auto w-full max-w-5xl border border-slate-700/90 bg-[#080c15] p-3.5 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono-tab uppercase tracking-widest text-cyan-400">
              Phase 4 of 5 · Live Orbital Flight Simulation · {objective.title}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 font-display text-base font-bold text-white">
              <span>{FLIGHT_STAGES[currentPhaseIndex]?.name}</span>
              <span className="font-mono-tab text-xs font-normal text-cyan-300">
                — Day {currentDay} (Year {currentYear}) · {pct}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleSpeed}
              className={`flex items-center gap-1 border px-2.5 py-1.5 font-mono-tab text-xs cursor-pointer transition-colors ${
                simSpeed === 2
                  ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-400'
              }`}
            >
              <FastForward className="h-3.5 w-3.5" />
              {simSpeed}× Speed
            </button>
            <button
              type="button"
              onClick={onAbortSimulation}
              className="flex items-center gap-1 border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-rose-400 hover:text-rose-200 cursor-pointer"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              Return to Planner
            </button>
          </div>
        </div>

        {/* 4-Stage Progress Bar */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {FLIGHT_STAGES.map((st, idx) => {
            const done = idx < currentPhaseIndex;
            const active = idx === currentPhaseIndex;
            return (
              <div
                key={st.name}
                className={`border px-2.5 py-1.5 text-[11px] ${
                  active
                    ? 'border-cyan-400 bg-cyan-950/40 text-white'
                    : done
                      ? 'border-emerald-500/45 bg-emerald-950/25 text-emerald-300'
                      : 'border-slate-800 bg-slate-950 text-slate-500'
                }`}
              >
                <div className="font-mono-tab font-semibold truncate">
                  {idx + 1}. {st.name}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2.5 h-2 w-full bg-slate-900">
          <div
            className="h-2 bg-cyan-400 transition-all duration-100"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Center Modal for Interactive Random Space Crisis */}
      {activeAnomaly && (
        <div className="pointer-events-auto mx-auto my-auto w-full max-w-xl border border-amber-400 bg-[#090d16] p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <div className="font-mono-tab text-[10px] uppercase tracking-wider text-amber-300">
                  Space Crisis {resolvedCount + 1} of {totalAnomalies} · Day {currentDay} · Lead:{' '}
                  {ROLE_META[activeAnomaly.leadRole].title}
                </div>
                <h3 className="font-display text-lg font-bold text-white">
                  {activeAnomaly.title}
                </h3>
              </div>
            </div>
            <span className="border border-amber-500/40 bg-amber-950/30 px-2 py-0.5 font-mono-tab text-[10px] text-amber-200">
              PAUSED
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-slate-200">
            {activeAnomaly.description}
          </p>

          <div className="mt-4 space-y-2.5">
            {activeAnomaly.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => onResolveAnomaly(choice)}
                className="w-full text-left border border-slate-700 bg-slate-900/80 p-3.5 hover:border-cyan-400 hover:bg-cyan-950/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white">{choice.label}</span>
                  <span className="font-mono-tab text-[11px] text-cyan-300 shrink-0">
                    {choice.scienceDelta >= 0 ? `+${choice.scienceDelta}` : choice.scienceDelta} Sci ·{' '}
                    {choice.marginDelta >= 0 ? `+${choice.marginDelta}` : choice.marginDelta} Margin
                  </span>
                </div>
                <div className="mt-1 text-xs text-amber-200/90">{choice.detail}</div>
                {choice.whyItMatters && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                    Why it matters: {choice.whyItMatters}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom-Right Live Resource Consumption Graph */}
      <div className="pointer-events-auto ml-auto w-full max-w-md border border-slate-800 bg-[#080c15] p-3.5 shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-mono-tab uppercase tracking-wider text-slate-300">
            Real-Time Resource Telemetry
          </div>
          <div className="flex items-center gap-3 font-mono-tab text-[10px]">
            <span className="text-emerald-400">● Power {Math.round(latestSample.powerPct)}%</span>
            <span className="text-amber-300">● Data Load {Math.round(latestSample.dataPct)}%</span>
            <span className="text-cyan-300">● Science {pct}%</span>
          </div>
        </div>

        <svg
          viewBox="0 0 280 84"
          className="w-full h-[78px] border border-slate-800/80 bg-[#040710]"
          aria-label="Live Resource Consumption Graph"
        >
          <line x1="0" y1="22" x2="280" y2="22" stroke="#1e293b" strokeDasharray="3 3" />
          <line x1="0" y1="50" x2="280" y2="50" stroke="#1e293b" strokeDasharray="3 3" />
          <polyline
            fill="none"
            stroke="#34d399"
            strokeWidth="2"
            points={buildLine((s) => s.powerPct)}
          />
          <polyline
            fill="none"
            stroke="#fbbf24"
            strokeWidth="1.8"
            points={buildLine((s) => s.dataPct)}
          />
          <polyline
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2"
            points={buildLine((s) => s.sciencePct)}
          />
        </svg>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tab text-slate-400">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-emerald-400" />
            {telemetry.powerMarginW >= 0 ? `+${telemetry.powerMarginW}W` : `${telemetry.powerMarginW}W`}
          </span>
          <span className="flex items-center gap-1">
            <Radio className="h-3 w-3 text-cyan-400" />
            {comms.shortLabel} · {telemetry.downlinkMbps} Mbps
          </span>
          <span className="flex items-center gap-1">
            {telemetry.dataStatus === 'Critical' && <AlertTriangle className="h-3 w-3 text-rose-400" />}
            {launchVehicle.name} → {orbit.shortName}
          </span>
        </div>
      </div>
    </div>
  );
}
