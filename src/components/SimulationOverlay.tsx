import { AlertOctagon, Radio, ShieldAlert } from 'lucide-react';
import { ROLE_META } from '../data/catalog';
import { getCatalogParts } from '../engine/physics';
import type { AnomalyChoice, FlightAnomaly, MissionConfig, TelemetryReport } from '../types/mission';

interface SimulationOverlayProps {
  config: MissionConfig;
  telemetry: TelemetryReport;
  simProgress: number; // 0..1
  currentPhaseIndex: number; // 0..3
  activeAnomaly: FlightAnomaly | null;
  onResolveAnomaly: (choice: AnomalyChoice) => void;
  onAbortSimulation: () => void;
}

const PHASES = [
  '01. Launch & Escape Injection',
  '02. Interplanetary Cruise',
  '03. Orbit Insertion Burn',
  '04. Science & Downlink Ops',
];

export function SimulationOverlay({
  config,
  telemetry,
  simProgress,
  currentPhaseIndex,
  activeAnomaly,
  onResolveAnomaly,
  onAbortSimulation,
}: SimulationOverlayProps) {
  const { objective, orbit } = getCatalogParts(config);
  const pct = Math.round(simProgress * 100);
  const metDays = Math.round(simProgress * telemetry.estimatedLifetimeMonths * 30);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 md:p-6">
      {/* Top Flight Phase Ribbon */}
      <div className="pointer-events-auto mx-auto w-full max-w-4xl border border-slate-700/90 bg-[#080c15]/95 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono-tab uppercase tracking-wider text-cyan-400">
              Live Orbital Telemetry · {objective.title}
            </div>
            <div className="mt-0.5 font-display text-base font-semibold text-white">
              {PHASES[currentPhaseIndex]}
            </div>
          </div>

          <div className="flex items-center gap-4 font-mono-tab text-xs">
            <div>
              <span className="text-slate-400">MET </span>
              <span className="text-white font-semibold">Day {metDays}</span>
            </div>
            <div>
              <span className="text-slate-400">Progress </span>
              <span className="text-cyan-300 font-semibold">{pct}%</span>
            </div>
            <button
              type="button"
              onClick={onAbortSimulation}
              className="border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300 hover:text-white hover:border-slate-500 transition-colors cursor-pointer"
            >
              Return to Hangar
            </button>
          </div>
        </div>

        {/* 4-Phase Stepper */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {PHASES.map((label, idx) => {
            const done = idx < currentPhaseIndex;
            const current = idx === currentPhaseIndex;
            return (
              <div key={label} className="space-y-1">
                <div
                  className={`h-1.5 w-full ${
                    done
                      ? 'bg-emerald-400'
                      : current
                        ? 'bg-cyan-400'
                        : 'bg-slate-800'
                  }`}
                />
                <div
                  className={`text-[10px] font-mono-tab truncate ${
                    current ? 'text-cyan-300' : done ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center Anomaly Decision Modal (only when paused for flight crisis) */}
      {activeAnomaly && (
        <div className="pointer-events-auto mx-auto w-full max-w-xl border border-amber-500/70 bg-[#090d16]/98 p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 text-amber-400">
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 shrink-0" />
              <span className="text-xs font-mono-tab uppercase tracking-wider font-semibold">
                In-Flight Anomaly · Decision Required
              </span>
            </div>
            <span className="text-[11px] font-mono-tab text-cyan-300">
              Lead: {ROLE_META[activeAnomaly.leadRole].title}
            </span>
          </div>
          <h3 className="mt-2 font-display text-xl font-bold text-white">
            {activeAnomaly.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {activeAnomaly.description}
          </p>

          <div className="mt-5 space-y-2.5">
            {activeAnomaly.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => onResolveAnomaly(choice)}
                className="w-full text-left border border-slate-700 bg-slate-900/90 p-3.5 hover:border-cyan-400 hover:bg-cyan-950/35 transition-colors cursor-pointer"
              >
                <div className="text-sm font-semibold text-white">{choice.label}</div>
                <div className="mt-1 text-xs font-mono-tab text-cyan-300">{choice.detail}</div>
                {choice.whyItMatters && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
                    Why: {choice.whyItMatters}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Compact Telemetry Strip */}
      <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-5 border border-slate-800 bg-[#080c15]/95 px-5 py-2.5 text-xs font-mono-tab">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-slate-400">Target:</span>
          <span className="text-white">{orbit.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-slate-400">Power Margin:</span>
          <span className={telemetry.powerMarginW >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {telemetry.powerMarginW >= 0 ? '+' : ''}
            {telemetry.powerMarginW} W
          </span>
        </div>
        <div>
          <span className="text-slate-400">Link:</span>{' '}
          <span className="text-cyan-300">{telemetry.downlinkCapacityGBDay} GB/day</span>
        </div>
        <div>
          <span className="text-slate-400">Δv:</span>{' '}
          <span className="text-white">{telemetry.availableDeltaVKms} km/s</span>
        </div>
      </div>
    </div>
  );
}
