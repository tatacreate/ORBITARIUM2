import {
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  Database,
  FastForward,
  Moon,
  PauseCircle,
  Radio,
  Shield,
  ShieldAlert,
  Sun,
  Zap,
} from 'lucide-react';
import { ROLE_META } from '../data/catalog';
import { getCatalogParts } from '../engine/physics';
import type { AnomalyChoice, FlightAnomaly, MissionConfig, TelemetryReport } from '../types/mission';

export interface SimTelemetrySample {
  progress: number;
  powerPct: number;
  dataPct: number;
  sciencePct: number;
}

export type SimPowerMode = 'full' | 'balanced' | 'safe';

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
  hullPct: number;
  batteryPct: number;
  bufferUsedGB: number;
  bufferCapGB: number;
  inEclipse: boolean;
  earthPassOpen: boolean;
  powerMode: SimPowerMode;
  compressionOn: boolean;
  lastEventSummary: string | null;
  onChangePowerMode: (mode: SimPowerMode) => void;
  onToggleCompression: () => void;
  onFlushBuffer: () => void;
  onToggleSpeed: () => void;
  onResolveAnomaly: (choice: AnomalyChoice) => void;
  onAbortSimulation: () => void;
}

const FLIGHT_STAGES = [
  { name: 'Liftoff & Fairing Sep', desc: 'Booster ascent and nose cone jettison' },
  { name: 'Interplanetary Cruise', desc: 'Solar / RTG stabilization & deep-space burn' },
  { name: 'Orbit Insertion Burn', desc: 'Propulsion braking into target science orbit' },
  { name: 'Science & Downlink', desc: 'Live mapping & beaming discoveries to Earth' },
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
  hullPct,
  batteryPct,
  bufferUsedGB,
  bufferCapGB,
  inEclipse,
  earthPassOpen,
  powerMode,
  compressionOn,
  lastEventSummary,
  onChangePowerMode,
  onToggleCompression,
  onFlushBuffer,
  onToggleSpeed,
  onResolveAnomaly,
  onAbortSimulation,
}: Phase4SimulationProps) {
  const { objective, launchVehicle, comms, orbit } = getCatalogParts(config);
  const pct = Math.min(100, Math.round(simProgress * 100));

  const totalMissionDays = Math.max(180, telemetry.requiredLifetimeMonths * 30);
  const currentDay = Math.max(1, Math.round(simProgress * totalMissionDays));
  const currentYear = (currentDay / 365).toFixed(1);

  const bufferPct = Math.min(100, Math.round((bufferUsedGB / Math.max(1, bufferCapGB)) * 100));

  const latestSample = samples[samples.length - 1] ?? {
    progress: simProgress,
    powerPct: batteryPct,
    dataPct: bufferPct,
    sciencePct: pct,
  };

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
      {/* Top Flight Timeline & Environment Status */}
      <div className="pointer-events-auto mx-auto w-full max-w-5xl border border-slate-700/90 bg-[#080c15] p-3.5 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono-tab uppercase tracking-widest text-cyan-400">
              Phase 4 of 5 · Live Flight Operations · {objective.title}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 font-display text-base font-bold text-white">
              <span>{FLIGHT_STAGES[currentPhaseIndex]?.name}</span>
              <span className="font-mono-tab text-xs font-normal text-cyan-300">
                — Day {currentDay} (Year {currentYear}) · {pct}%
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Orbital Sun / Eclipse Badge */}
            <span
              className={`inline-flex items-center gap-1 border px-2 py-1 font-mono-tab text-[11px] whitespace-nowrap ${
                inEclipse
                  ? 'border-amber-500/60 bg-amber-950/50 text-amber-200'
                  : 'border-emerald-500/45 bg-emerald-950/35 text-emerald-300'
              }`}
            >
              {inEclipse ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
              {inEclipse ? 'Planet Shadow (Eclipse)' : 'Sunlit Orbit'}
            </span>

            {/* Earth Pass Window Badge */}
            <span
              className={`inline-flex items-center gap-1 border px-2 py-1 font-mono-tab text-[11px] whitespace-nowrap ${
                earthPassOpen
                  ? 'border-cyan-400/60 bg-cyan-950/50 text-cyan-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              <Radio className="h-3 w-3" />
              {earthPassOpen ? 'Earth Link Open' : 'Orbiting Far Side'}
            </span>

            <button
              type="button"
              onClick={onToggleSpeed}
              className={`flex items-center gap-1 border px-2.5 py-1.5 font-mono-tab text-xs cursor-pointer transition-colors whitespace-nowrap ${
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
              className="flex items-center gap-1 border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:border-rose-400 hover:text-rose-200 cursor-pointer whitespace-nowrap"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              Return to Planner
            </button>
          </div>
        </div>

        {!telemetry.launchReady && (
          <div className="mt-2.5 flex items-center gap-2 border border-amber-500/45 bg-amber-950/35 px-3 py-1.5 text-xs text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>
              <strong>Test Flight — Monitoring Flagged Resource Limit:</strong>{' '}
              {telemetry.criticalFailureReason || 'Observing how resource shortages affect flight margins.'}
            </span>
          </div>
        )}

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

      {/* Center High-Stakes Flight Crisis Intervention (Real Hardware Risks & Wrong Answers) */}
      {activeAnomaly && (
        <div className="pointer-events-auto mx-auto my-auto w-full max-w-xl border border-amber-400 bg-[#090d16] p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <div className="font-mono-tab text-[10px] uppercase tracking-wider text-amber-300">
                  Flight Emergency {resolvedCount + 1} of {totalAnomalies} · Day {currentDay} · Lead:{' '}
                  {ROLE_META[activeAnomaly.leadRole].title}
                </div>
                <h3 className="font-display text-lg font-bold text-white">
                  {activeAnomaly.title}
                </h3>
              </div>
            </div>
            <span className="border border-amber-500/40 bg-amber-950/30 px-2 py-0.5 font-mono-tab text-[10px] text-amber-200 whitespace-nowrap">
              ACTION REQUIRED
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
                className="w-full text-left border border-slate-700 bg-slate-900/85 p-3.5 hover:border-cyan-400 hover:bg-cyan-950/30 transition-colors cursor-pointer"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white">{choice.label}</span>
                  {choice.requiresHardwareLabel && (
                    <span
                      className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono-tab text-[10px] whitespace-nowrap ${
                        choice.hardwareMet
                          ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                          : 'border-rose-500/50 bg-rose-950/40 text-rose-300'
                      }`}
                    >
                      {choice.hardwareMet ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {choice.hardwareMet
                        ? `Equipped: ${choice.requiresHardwareLabel}`
                        : `Missing: ${choice.requiresHardwareLabel}`}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-300">{choice.riskNote}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Interactive Flight Control Deck + Live Telemetry Graph */}
      <div className="pointer-events-auto mx-auto w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left/Center: Live Interactive Spacecraft Operations Console */}
        <div className="lg:col-span-7 border border-slate-800 bg-[#080c15]/95 p-3.5 shadow-2xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] font-mono-tab uppercase tracking-wider text-cyan-300">
              Live Spacecraft Controls (Actively Manage Your Craft!)
            </div>
            {lastEventSummary && (
              <span className="text-[11px] text-amber-200 truncate max-w-full">
                {lastEventSummary}
              </span>
            )}
          </div>

          {/* 3 Live Physical Resource Meters: Hull, Battery, Memory */}
          <div className="grid grid-cols-3 gap-2.5 text-[11px] font-mono-tab">
            <div className="border border-slate-800 bg-slate-950/80 p-2">
              <div className="flex items-center justify-between text-slate-300 mb-1">
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3 text-cyan-400" />
                  Hull Health
                </span>
                <span className={hullPct <= 45 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {Math.round(hullPct)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-800">
                <div
                  className={`h-1.5 transition-all ${hullPct <= 45 ? 'bg-rose-500' : hullPct <= 75 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  style={{ width: `${Math.max(0, Math.min(100, hullPct))}%` }}
                />
              </div>
            </div>

            <div className="border border-slate-800 bg-slate-950/80 p-2">
              <div className="flex items-center justify-between text-slate-300 mb-1">
                <span className="flex items-center gap-1">
                  <BatteryCharging className="h-3 w-3 text-amber-400" />
                  Battery
                </span>
                <span className={batteryPct <= 25 ? 'text-rose-400 font-bold' : 'text-amber-300 font-bold'}>
                  {Math.round(batteryPct)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-800">
                <div
                  className={`h-1.5 transition-all ${batteryPct <= 25 ? 'bg-rose-500' : batteryPct <= 55 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  style={{ width: `${Math.max(0, Math.min(100, batteryPct))}%` }}
                />
              </div>
            </div>

            <div className="border border-slate-800 bg-slate-950/80 p-2">
              <div className="flex items-center justify-between text-slate-300 mb-1">
                <span className="flex items-center gap-1">
                  <Database className="h-3 w-3 text-cyan-400" />
                  Memory
                </span>
                <span className={bufferPct >= 85 ? 'text-rose-400 font-bold' : 'text-cyan-300 font-bold'}>
                  {bufferUsedGB.toFixed(0)}/{bufferCapGB} GB
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-800">
                <div
                  className={`h-1.5 transition-all ${bufferPct >= 85 ? 'bg-rose-500' : bufferPct >= 65 ? 'bg-amber-400' : 'bg-cyan-400'}`}
                  style={{ width: `${bufferPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Interactive Power Bus & Downlink Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono-tab uppercase text-slate-400 mr-1">
                Power Bus:
              </span>
              {(
                [
                  { id: 'full', label: 'Full Science' },
                  { id: 'balanced', label: 'Balanced' },
                  { id: 'safe', label: 'Safe (Shadow)' },
                ] as { id: SimPowerMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangePowerMode(m.id)}
                  className={`px-2 py-1 text-[11px] font-medium border cursor-pointer whitespace-nowrap transition-colors ${
                    powerMode === m.id
                      ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleCompression}
                className={`px-2.5 py-1 text-[11px] font-medium border cursor-pointer whitespace-nowrap transition-colors ${
                  compressionOn
                    ? 'border-emerald-400 bg-emerald-950/50 text-emerald-200'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-400'
                }`}
              >
                {compressionOn ? 'Compress: ON' : 'Compress Data'}
              </button>
              <button
                type="button"
                disabled={!earthPassOpen || bufferUsedGB < 2}
                onClick={onFlushBuffer}
                className={`px-3 py-1 text-[11px] font-semibold border whitespace-nowrap transition-colors ${
                  earthPassOpen && bufferUsedGB >= 2
                    ? 'border-cyan-400 bg-cyan-500 text-slate-950 hover:bg-cyan-400 cursor-pointer'
                    : 'border-slate-800 bg-slate-900/60 text-slate-500 cursor-not-allowed'
                }`}
              >
                {earthPassOpen ? 'Flush to Earth' : 'Wait for Earth Pass'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Resource Consumption Graph */}
        <div className="lg:col-span-5 border border-slate-800 bg-[#080c15]/95 p-3.5 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-mono-tab uppercase tracking-wider text-slate-300">
              Real-Time Telemetry
            </div>
            <div className="flex items-center gap-2.5 font-mono-tab text-[10px]">
              <span className="text-emerald-400">● Batt {Math.round(batteryPct)}%</span>
              <span className="text-amber-300">● Mem {bufferPct}%</span>
              <span className="text-cyan-300">● Trip {pct}%</span>
            </div>
          </div>

          <svg
            viewBox="0 0 280 84"
            className="w-full h-[74px] border border-slate-800/80 bg-[#040710]"
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
            <span>
              {launchVehicle.name} → {orbit.shortName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
