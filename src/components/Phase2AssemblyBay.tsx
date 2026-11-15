import { useState } from 'react';
import {
  BatteryCharging,
  BookOpen,
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Flame,
  Layers,
  MessageSquare,
  Microscope,
  Radio,
  Send,
  Shield,
  Sparkles,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  ADCS_SYSTEMS,
  AVIONICS_SYSTEMS,
  BATTERY_SYSTEMS,
  BUSES,
  COMMS_SYSTEMS,
  INSTRUMENTS,
  POWER_SYSTEMS,
  PROPULSION_SYSTEMS,
  ROLE_META,
  SHIELDING_SYSTEMS,
} from '../data/catalog';
import { getCatalogParts } from '../engine/physics';
import { ResourceFlowMap } from './ResourceFlowMap';
import type {
  BuilderCategory,
  CameraPreset,
  ConstraintStatus,
  EngineeringRole,
  MissionConfig,
  RoomMember,
  RoomMessage,
  TelemetryReport,
  TradeOffPopup,
} from '../types/mission';

interface Phase2AssemblyBayProps {
  config: MissionConfig;
  telemetry: TelemetryReport;
  activeCategory: BuilderCategory;
  collapsed: boolean;
  explodeAmount: number;
  cameraPreset: CameraPreset;
  tradeOffPopup: TradeOffPopup | null;
  roomId: string | null;
  members: RoomMember[];
  messages: RoomMessage[];
  currentUid: string | null;
  onChangeCategory: (cat: BuilderCategory) => void;
  onToggleCollapse: () => void;
  onChangeExplode: (v: number) => void;
  onSelectCamera: (p: CameraPreset) => void;
  onUpdateConfig: (patch: Partial<MissionConfig>, label: string) => void;
  onDismissTradeOff: () => void;
  onChangeRole: (role: EngineeringRole) => void;
  onToggleReady: () => void;
  onSendMessage: (text: string) => void;
  onOpenDictionary: () => void;
  onOpenTeamModal: () => void;
  onProceedToPlanner: () => void;
}

function statusBarColor(status: ConstraintStatus): string {
  if (status === 'Critical') return 'bg-rose-500';
  if (status === 'Tight') return 'bg-amber-400';
  return 'bg-emerald-400';
}

function statusTextColor(status: ConstraintStatus): string {
  if (status === 'Critical') return 'text-rose-400';
  if (status === 'Tight') return 'text-amber-300';
  return 'text-emerald-400';
}

export function Phase2AssemblyBay({
  config,
  telemetry,
  activeCategory,
  collapsed,
  explodeAmount,
  cameraPreset,
  tradeOffPopup,
  roomId,
  members,
  messages,
  currentUid,
  onChangeCategory,
  onToggleCollapse,
  onChangeExplode,
  onSelectCamera,
  onUpdateConfig,
  onDismissTradeOff,
  onChangeRole,
  onToggleReady,
  onSendMessage,
  onOpenDictionary,
  onOpenTeamModal,
  onProceedToPlanner,
}: Phase2AssemblyBayProps) {
  const [chatInput, setChatInput] = useState('');
  const parts = getCatalogParts(config);
  const myMember = members.find((m) => m.uid === currentUid);

  const toggleInstrument = (instId: string) => {
    const exists = config.instrumentIds.includes(instId);
    const inst = INSTRUMENTS.find((i) => i.id === instId);
    if (exists) {
      onUpdateConfig(
        { instrumentIds: config.instrumentIds.filter((id) => id !== instId) },
        inst ? `Removed ${inst.shortName}` : 'Removed instrument',
      );
      return;
    }
    if (config.instrumentIds.length >= parts.bus.maxInstruments) {
      return;
    }
    onUpdateConfig(
      { instrumentIds: [...config.instrumentIds, instId] },
      inst ? `Mounted ${inst.shortName}` : 'Added instrument',
    );
  };

  const budgetPct = Math.min(100, Math.round((telemetry.totalCostM / Math.max(1, telemetry.budgetCapM)) * 100));
  const massPct = Math.min(100, Math.round((telemetry.wetMassKg / Math.max(1, telemetry.payloadCapacityKg)) * 100));
  const powerPct = Math.min(100, Math.round((telemetry.powerPeakDrawW / Math.max(1, telemetry.powerGeneratedW)) * 100));
  const dataPct = Math.min(100, Math.round((telemetry.dataGeneratedGBDay / Math.max(0.5, telemetry.downlinkCapacityGBDay)) * 100));
  const lifePct = Math.min(100, Math.round((telemetry.estimatedLifetimeMonths / Math.max(1, telemetry.requiredLifetimeMonths)) * 100));

  const tabs: { id: BuilderCategory; label: string; icon: typeof Box }[] = [
    { id: 'bus', label: 'Bus & Engine', icon: Box },
    { id: 'power', label: 'Power', icon: Zap },
    { id: 'comms', label: 'Comms & Brain', icon: Radio },
    { id: 'science', label: 'Science', icon: Microscope },
    ...(roomId ? [{ id: 'team' as BuilderCategory, label: 'Team', icon: Users }] : []),
  ];

  return (
    <>
      {/* Left-Side Live Visual Resource HUD */}
      <aside className="pointer-events-auto fixed top-[62px] left-3 z-20 w-[300px] sm:w-[325px] border border-slate-800 bg-[#080c15] p-3.5 shadow-2xl space-y-2.5">
        <div className="border-b border-slate-800 pb-2 space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono-tab uppercase tracking-wider text-cyan-400">
                Phase 2 · Live Resource Gauges
              </div>
              <div className="text-xs font-semibold text-white">
                Science Score Potential: <span className="font-mono-tab text-cyan-300">{telemetry.scienceReturnPotential}/100</span>
              </div>
            </div>
            <span className="font-mono-tab text-[11px] text-slate-400">
              {parts.objective.minScienceValue} min
            </span>
          </div>
          <div className="text-[10px] font-mono-tab text-amber-300/95">
            Critical Here: {parts.objective.criticalResources.join(' · ')}
          </div>
        </div>

        {/* 1. Budget ($M) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-300 font-medium">Budget ($M)</span>
            <span className={`font-mono-tab font-semibold ${statusTextColor(telemetry.budgetStatus)}`}>
              ${telemetry.totalCostM}M / ${telemetry.budgetCapM}M
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-800">
            <div className={`h-1.5 transition-all ${statusBarColor(telemetry.budgetStatus)}`} style={{ width: `${budgetPct}%` }} />
          </div>
        </div>

        {/* 2. Total Mass (kg) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-300 font-medium">Total Mass (kg)</span>
            <span className={`font-mono-tab font-semibold ${statusTextColor(telemetry.massStatus)}`}>
              {telemetry.wetMassKg} / {telemetry.payloadCapacityKg} kg
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-800">
            <div className={`h-1.5 transition-all ${statusBarColor(telemetry.massStatus)}`} style={{ width: `${massPct}%` }} />
          </div>
        </div>

        {/* 3. Power Gen vs Draw (W) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-300 font-medium">Power Gen vs. Draw</span>
            <span className={`font-mono-tab font-semibold ${statusTextColor(telemetry.powerStatus)}`}>
              {telemetry.powerGeneratedW}W gen · {telemetry.powerPeakDrawW}W draw
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-800">
            <div className={`h-1.5 transition-all ${statusBarColor(telemetry.powerStatus)}`} style={{ width: `${powerPct}%` }} />
          </div>
        </div>

        {/* 4. Data Gen vs Downlink (Mbps & GB/d) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-300 font-medium">Data vs. Downlink</span>
            <span className={`font-mono-tab font-semibold ${statusTextColor(telemetry.dataStatus)}`}>
              {telemetry.downlinkMbps} Mbps ({telemetry.downlinkCapacityGBDay}/{telemetry.dataGeneratedGBDay} GB/d)
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-800">
            <div className={`h-1.5 transition-all ${statusBarColor(telemetry.dataStatus)}`} style={{ width: `${dataPct}%` }} />
          </div>
        </div>

        {/* 5. Mission Lifetime (Years) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-300 font-medium">Mission Lifetime</span>
            <span className={`font-mono-tab font-semibold ${statusTextColor(telemetry.lifetimeStatus)}`}>
              {telemetry.estimatedLifetimeYears} yrs ({telemetry.estimatedLifetimeMonths} mo)
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-800">
            <div className={`h-1.5 transition-all ${statusBarColor(telemetry.lifetimeStatus)}`} style={{ width: `${lifePct}%` }} />
          </div>
        </div>

        {/* Active Synergies / Plain-Language Trade-off Notice */}
        {telemetry.synergies.length > 0 && (
          <div className="border border-emerald-500/35 bg-emerald-950/20 px-2.5 py-1.5 text-[11px] text-emerald-200 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{telemetry.synergies[0]}</span>
          </div>
        )}

        {telemetry.advisories.length > 0 && (
          <div className="border border-amber-500/40 bg-amber-950/25 p-2.5 space-y-1.5">
            <div className="text-[11px] font-semibold text-amber-200 leading-snug">
              {telemetry.advisories[0].message}
            </div>
            <p className="text-[10px] text-slate-300 leading-snug">
              Why: {telemetry.advisories[0].plainTerms}
            </p>
            {parts.difficulty.showQuickFixes && telemetry.advisories[0].quickFix && (
              <button
                type="button"
                onClick={() =>
                  onUpdateConfig(
                    telemetry.advisories[0].quickFix!.patch,
                    `Applied fix: ${telemetry.advisories[0].quickFix!.label}`,
                  )
                }
                className="flex items-center gap-1 bg-amber-400 px-2.5 py-1 text-[11px] font-semibold text-slate-950 hover:bg-amber-300 cursor-pointer"
              >
                <Wrench className="h-3 w-3" />
                {telemetry.advisories[0].quickFix.label}
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Top-Center Connected Mission Chain Visualizer (Desktop Hangar) */}
      <div className="pointer-events-auto fixed top-[62px] left-[348px] right-[390px] z-20 hidden xl:block">
        <ResourceFlowMap
          config={config}
          telemetry={telemetry}
          onSelectCategory={onChangeCategory}
          compact
        />
      </div>

      {/* Plain-English Trade-Off Popup (Triggered when player swaps/adds hardware) */}
      {tradeOffPopup && (
        <div className="pointer-events-auto fixed bottom-16 left-1/2 -translate-x-1/2 z-30 w-[92vw] max-w-md border border-cyan-400/70 bg-[#080d18] p-3.5 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[10px] font-mono-tab uppercase tracking-wider text-cyan-400">
                Engineering Trade-Off Impact
              </div>
              <div className="text-sm font-bold text-white">{tradeOffPopup.title}</div>
            </div>
            <button
              type="button"
              onClick={onDismissTradeOff}
              aria-label="Close trade-off popup"
              className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-200">{tradeOffPopup.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tradeOffPopup.deltas.map((d) => (
              <span
                key={d.label}
                className={`px-2 py-0.5 font-mono-tab text-[11px] border ${
                  d.tone === 'good'
                    ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                    : d.tone === 'warn'
                      ? 'border-rose-500/50 bg-rose-950/40 text-rose-300'
                      : 'border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                {d.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bottom-Center 3D Viewport Controls */}
      <div className="pointer-events-auto fixed bottom-3 left-1/2 -translate-x-1/2 z-20 hidden sm:flex items-center gap-2 border border-slate-800 bg-[#080c15] px-3 py-1.5 text-[11px] shadow-xl">
        <span className="font-mono-tab text-slate-400">View:</span>
        {(
          [
            { id: 'hero', label: 'Full Craft' },
            { id: 'payload', label: 'Instruments' },
            { id: 'propulsion', label: 'Engine' },
            { id: 'power', label: 'Wings' },
          ] as { id: CameraPreset; label: string }[]
        ).map((cam) => (
          <button
            key={cam.id}
            type="button"
            onClick={() => onSelectCamera(cam.id)}
            className={`px-2 py-1 border cursor-pointer transition-colors ${
              cameraPreset === cam.id
                ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            {cam.label}
          </button>
        ))}

        <div className="h-4 w-px bg-slate-800 mx-1" />

        <label className="flex items-center gap-1.5 text-slate-300">
          <Layers className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-mono-tab">Explode</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={explodeAmount}
            onChange={(e) => onChangeExplode(parseFloat(e.target.value))}
            className="aero-slider w-16"
          />
        </label>

        <button
          type="button"
          onClick={onOpenDictionary}
          className="ml-1 flex items-center gap-1 border border-slate-700 bg-slate-900 px-2 py-1 text-cyan-300 hover:border-cyan-400 cursor-pointer"
        >
          <BookOpen className="h-3 w-3" />
          <span>Glossary</span>
        </button>
      </div>

      {/* Right-Side Interactive Spacecraft & Payload Builder Dock */}
      {collapsed ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="pointer-events-auto fixed top-[62px] right-3 z-20 flex items-center gap-1.5 border border-slate-700 bg-[#080c15] px-3 py-2 text-xs font-medium text-cyan-300 hover:border-cyan-400 cursor-pointer shadow-xl"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Open Parts Builder</span>
        </button>
      ) : (
        <aside className="pointer-events-auto fixed top-[62px] right-3 bottom-3 z-20 flex w-[360px] max-w-[calc(100vw-24px)] flex-col border border-slate-800 bg-[#080c15] shadow-2xl">
          {/* Header & Category Tabs */}
          <div className="border-b border-slate-800 p-3">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div>
                <div className="text-[10px] font-mono-tab uppercase tracking-wider text-cyan-400">
                  Phase 2 · Spacecraft Assembly Bay
                </div>
                <div className="text-sm font-bold text-white">
                  Click Parts to Build Live in 3D
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateConfig(
                      { modelMode: parts.modelMode === 'simplified' ? 'realistic' : 'simplified' },
                      parts.modelMode === 'simplified' ? 'Realistic Model' : 'Simplified Model',
                    )
                  }
                  className="border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-mono-tab text-cyan-300 hover:border-cyan-400 cursor-pointer whitespace-nowrap"
                  title="Switch between Simplified core components and Realistic full subsystems"
                >
                  {parts.modelMode === 'simplified' ? 'Simplified' : 'Realistic'}
                </button>
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title="Minimize Builder"
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className={`grid gap-1 ${tabs.length === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = activeCategory === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChangeCategory(t.id)}
                    className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 text-[10px] font-medium border cursor-pointer transition-colors ${
                      active
                        ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200'
                        : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate w-full text-center">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Parts List */}
          <div className="aero-scroll flex-1 overflow-y-auto p-3 space-y-4">
            {activeCategory === 'bus' && (
              <>
                <section className="space-y-2">
                  <div className="text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                    1. Bus &amp; Structure
                  </div>
                  {BUSES.map((b) => {
                    const selected = config.busId === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() =>
                          onUpdateConfig(
                            {
                              busId: b.id,
                              instrumentIds: config.instrumentIds.slice(0, b.maxInstruments),
                            },
                            b.shortLabel,
                          )
                        }
                        className={`w-full text-left border p-3 transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35'
                            : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{b.name}</span>
                          <span className="font-mono-tab text-[11px] text-amber-300">${b.costM}M</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 font-mono-tab text-[10px] text-cyan-300">
                          <span>{b.dryMassKg} kg dry</span>
                          <span>· {b.maxInstruments} instrument bays</span>
                          <span>· {b.pointingAccuracyArcsec}&quot; aim</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400 leading-snug">{b.tradeOffTip}</p>
                      </button>
                    );
                  })}
                </section>

                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono-tab uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5 text-amber-400" />
                      2. Propulsion &amp; Fuel Tank
                    </span>
                    <span className="font-mono-tab text-[10px] text-cyan-300">
                      Δv {telemetry.availableDeltaVKms}/{telemetry.requiredDeltaVKms} km/s
                    </span>
                  </div>
                  {PROPULSION_SYSTEMS.map((p) => {
                    const selected = config.propulsionId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onUpdateConfig({ propulsionId: p.id }, p.name)}
                        className={`w-full text-left border p-2.5 transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35'
                            : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-white">
                          <span>{p.name}</span>
                          <span className="font-mono-tab text-[11px] text-amber-300">${p.costM}M</span>
                        </div>
                        <div className="mt-0.5 font-mono-tab text-[10px] text-cyan-300">
                          {p.ispSec}s Isp · {p.dryMassKg} kg · {p.powerDrawW}W draw
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400 leading-snug">{p.description}</p>
                      </button>
                    );
                  })}

                  <div className="border border-slate-800 bg-slate-900/50 p-2.5">
                    <div className="flex justify-between text-[11px] font-mono-tab text-slate-300 mb-1">
                      <span>Fuel Tank Sizing</span>
                      <span className="text-cyan-300">{Math.round(config.propellantRatio * 100)}% ({telemetry.propellantMassKg} kg)</span>
                    </div>
                    <input
                      type="range"
                      min={0.75}
                      max={1.4}
                      step={0.05}
                      value={config.propellantRatio}
                      onChange={(e) =>
                        onUpdateConfig(
                          { propellantRatio: parseFloat(e.target.value) },
                          'Adjusted Propellant Tank',
                        )
                      }
                      className="aero-slider w-full"
                    />
                  </div>
                </section>

                <section className="space-y-2">
                  <div className="text-[11px] font-mono-tab uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-cyan-400" />
                    3. Thermal &amp; Radiation Shielding
                  </div>
                  {SHIELDING_SYSTEMS.map((sh) => {
                    const selected = config.shieldingId === sh.id;
                    return (
                      <button
                        key={sh.id}
                        type="button"
                        onClick={() => onUpdateConfig({ shieldingId: sh.id }, sh.name)}
                        className={`w-full text-left border p-2.5 transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35'
                            : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-white">
                          <span>{sh.name}</span>
                          <span className="font-mono-tab text-[11px] text-amber-300">${sh.costM}M</span>
                        </div>
                        <div className="mt-0.5 font-mono-tab text-[10px] text-cyan-300">
                          {sh.radToleranceKrad} krad armor · {sh.massKg} kg
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400 leading-snug">{sh.description}</p>
                      </button>
                    );
                  })}
                </section>
              </>
            )}

            {activeCategory === 'power' && (
              <>
                <section className="space-y-2">
                  <div className="text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                    1. Primary Power Generation ({parts.orbit.solarDistanceAU} AU)
                  </div>
                  {POWER_SYSTEMS.map((pw) => {
                    const selected = config.powerId === pw.id;
                    return (
                      <button
                        key={pw.id}
                        type="button"
                        onClick={() => onUpdateConfig({ powerId: pw.id }, pw.name)}
                        className={`w-full text-left border p-3 transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35'
                            : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{pw.name}</span>
                          <span className="font-mono-tab text-[11px] text-amber-300">${pw.costM}M</span>
                        </div>
                        <div className="mt-1 font-mono-tab text-[10px] text-cyan-300">
                          {pw.kind === 'solar'
                            ? `${pw.baseOutputWAt1AU}W @ 1AU · ${pw.massKg} kg`
                            : `${pw.baseOutputWAt1AU}W steady anywhere · ${pw.massKg} kg`}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400 leading-snug">{pw.tradeOffTip}</p>
                      </button>
                    );
                  })}

                  {parts.power.kind === 'solar' && parts.modelMode === 'realistic' && (
                    <div className="border border-slate-800 bg-slate-900/50 p-2.5">
                      <div className="flex justify-between text-[11px] font-mono-tab text-slate-300 mb-1">
                        <span>Solar Wing Size</span>
                        <span className="text-cyan-300">{Math.round(config.solarSizing * 100)}% ({telemetry.powerGeneratedW}W)</span>
                      </div>
                      <input
                        type="range"
                        min={0.6}
                        max={2.0}
                        step={0.1}
                        value={config.solarSizing}
                        onChange={(e) =>
                          onUpdateConfig(
                            { solarSizing: parseFloat(e.target.value) },
                            'Resized Solar Wings',
                          )
                        }
                        className="aero-slider w-full"
                      />
                    </div>
                  )}
                </section>

                {parts.modelMode === 'realistic' ? (
                  <section className="space-y-2">
                    <div className="text-[11px] font-mono-tab uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
                      2. Eclipse Batteries
                    </div>
                    {BATTERY_SYSTEMS.map((bt) => {
                      const selected = config.batteryId === bt.id;
                      return (
                        <button
                          key={bt.id}
                          type="button"
                          onClick={() => onUpdateConfig({ batteryId: bt.id }, bt.name)}
                          className={`w-full text-left border p-2.5 transition-colors cursor-pointer ${
                            selected
                              ? 'border-cyan-400 bg-cyan-950/35'
                              : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-white">
                            <span>{bt.name}</span>
                            <span className="font-mono-tab text-[11px] text-amber-300">${bt.costM}M</span>
                          </div>
                          <div className="mt-0.5 font-mono-tab text-[10px] text-cyan-300">
                            {bt.capacityWh} Wh · {bt.massKg} kg
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400 leading-snug">{bt.description}</p>
                        </button>
                      );
                    })}
                  </section>
                ) : (
                  <div className="border border-slate-800 bg-slate-900/40 p-3 text-[11px] text-slate-400">
                    Simplified Mode uses a balanced baseline battery pack. Click <strong className="text-cyan-300">Simplified</strong> above to switch to Realistic Mode and customize battery vaults.
                  </div>
                )}
              </>
            )}

            {activeCategory === 'comms' && (
              <>
                <section className="space-y-2">
                  <div className="text-[11px] font-mono-tab uppercase tracking-wider text-slate-400">
                    1. Communications Antenna
                  </div>
                  {COMMS_SYSTEMS.map((cm) => {
                    const selected = config.commsId === cm.id;
                    return (
                      <button
                        key={cm.id}
                        type="button"
                        onClick={() => onUpdateConfig({ commsId: cm.id }, cm.name)}
                        className={`w-full text-left border p-3 transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-950/35'
                            : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{cm.name}</span>
                          <span className="font-mono-tab text-[11px] text-amber-300">${cm.costM}M</span>
                        </div>
                        <div className="mt-1 font-mono-tab text-[10px] text-cyan-300">
                          {cm.baseRateMbpsAt1AU} Mbps @ 1AU · {cm.powerDrawW}W · {cm.massKg} kg
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400 leading-snug">{cm.tradeOffTip}</p>
                      </button>
                    );
                  })}
                </section>

                {parts.modelMode === 'realistic' ? (
                  <section className="space-y-2">
                    <div className="text-[11px] font-mono-tab uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                      2. Flight Computer &amp; Star Aiming
                    </div>
                    {AVIONICS_SYSTEMS.map((av) => {
                      const selected = config.avionicsId === av.id;
                      return (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => onUpdateConfig({ avionicsId: av.id }, av.name)}
                          className={`w-full text-left border p-2.5 transition-colors cursor-pointer ${
                            selected
                              ? 'border-cyan-400 bg-cyan-950/35'
                              : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-white">
                            <span>{av.name}</span>
                            <span className="font-mono-tab text-[11px] text-amber-300">${av.costM}M</span>
                          </div>
                          <div className="mt-0.5 font-mono-tab text-[10px] text-cyan-300">
                            {av.dataBufferGB} GB Memory · {av.powerDrawW}W · {av.massKg} kg
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400 leading-snug">{av.description}</p>
                        </button>
                      );
                    })}

                    {ADCS_SYSTEMS.map((ad) => {
                      const selected = config.adcsId === ad.id;
                      return (
                        <button
                          key={ad.id}
                          type="button"
                          onClick={() => onUpdateConfig({ adcsId: ad.id }, ad.name)}
                          className={`w-full text-left border p-2.5 transition-colors cursor-pointer ${
                            selected
                              ? 'border-cyan-400 bg-cyan-950/35'
                              : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-white">
                            <span>{ad.name}</span>
                            <span className="font-mono-tab text-[11px] text-amber-300">${ad.costM}M</span>
                          </div>
                          <div className="mt-0.5 font-mono-tab text-[10px] text-cyan-300">
                            {ad.pointingAccuracyArcsec}&quot; Aim · {ad.powerDrawW}W · {ad.massKg} kg
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400 leading-snug">{ad.description}</p>
                        </button>
                      );
                    })}
                  </section>
                ) : (
                  <div className="border border-slate-800 bg-slate-900/40 p-3 text-[11px] text-slate-400">
                    Simplified Mode keeps flight computer memory and star-tracker aiming automatic. Switch to <strong className="text-cyan-300">Realistic</strong> above to tune them directly.
                  </div>
                )}
              </>
            )}

            {activeCategory === 'science' && (
              <section className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono-tab">
                  <span className="uppercase tracking-wider text-slate-400">
                    Science Payload ({config.instrumentIds.length}/{parts.bus.maxInstruments} Bays)
                  </span>
                  <span className="text-cyan-300">Goal: {parts.objective.minScienceValue}+ Sci</span>
                </div>

                {INSTRUMENTS.map((inst) => {
                  const mounted = config.instrumentIds.includes(inst.id);
                  const isPreferred = parts.objective.preferredInstruments.includes(inst.id);
                  const baysFull =
                    !mounted && config.instrumentIds.length >= parts.bus.maxInstruments;

                  return (
                    <button
                      key={inst.id}
                      type="button"
                      disabled={baysFull}
                      onClick={() => toggleInstrument(inst.id)}
                      className={`w-full text-left border p-3 transition-colors ${
                        mounted
                          ? 'border-emerald-400 bg-emerald-950/30 cursor-pointer'
                          : baysFull
                            ? 'border-slate-900 bg-slate-950/60 opacity-50 cursor-not-allowed'
                            : 'border-slate-800 bg-slate-900/60 hover:border-slate-600 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                          {mounted && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                          {inst.name}
                        </span>
                        <span className="font-mono-tab text-[11px] text-amber-300 shrink-0">
                          ${inst.costM}M
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 font-mono-tab text-[10px]">
                        <span className="text-emerald-300">+{inst.scienceBase} Sci</span>
                        <span className="text-slate-300">{inst.massKg} kg</span>
                        <span className="text-slate-300">{inst.powerDrawW}W</span>
                        <span className="text-cyan-300">{inst.dataRateGBPerDay} GB/d</span>
                        {isPreferred && (
                          <span className="border border-cyan-500/40 bg-cyan-950/40 px-1.5 text-cyan-200">
                            Mission Match
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 leading-snug">{inst.tradeOffTip}</p>
                    </button>
                  );
                })}
              </section>
            )}

            {activeCategory === 'team' && (
              <section className="space-y-3">
                {!roomId ? (
                  <div className="border border-slate-800 bg-slate-900/50 p-4 text-center space-y-2">
                    <p className="text-xs text-slate-300">
                      Building in Solo mode. Open a Co-Op Team Room anytime to invite 1–4 teammates.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenTeamModal}
                      className="bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 cursor-pointer"
                    >
                      Open Team Room
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-[11px] font-mono-tab uppercase text-cyan-400">
                      Live Team Checkpoints ({members.length}/4)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['director', 'propulsion', 'power', 'payload'] as EngineeringRole[]).map(
                        (r) => {
                          const meta = ROLE_META[r];
                          const isMine = myMember?.role === r;
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => onChangeRole(r)}
                              className={`border p-2 text-left text-[11px] cursor-pointer ${
                                isMine
                                  ? 'border-cyan-400 bg-cyan-950/40 text-white'
                                  : 'border-slate-800 bg-slate-900/60 text-slate-300'
                              }`}
                            >
                              <div className="font-semibold">{meta.title}</div>
                              <div className="text-[10px] text-slate-400">{meta.badge}</div>
                            </button>
                          );
                        },
                      )}
                    </div>

                    <div className="space-y-1">
                      {members.map((m) => (
                        <div
                          key={m.uid}
                          className="flex items-center justify-between border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs"
                        >
                          <span className="text-white truncate">{m.displayName}</span>
                          <span
                            className={`font-mono-tab text-[10px] ${
                              m.ready ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {ROLE_META[m.role]?.title.split(' ')[0]} · {m.ready ? 'READY' : 'EDITING'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={onToggleReady}
                      className={`w-full py-2 text-xs font-semibold cursor-pointer ${
                        myMember?.ready
                          ? 'border border-amber-400 bg-amber-950/40 text-amber-200'
                          : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                      }`}
                    >
                      {myMember?.ready ? 'Reopen My Subsystem' : 'Sign Off Ready Checkpoint'}
                    </button>

                    <div className="border border-slate-800 bg-slate-950/70 p-2 space-y-2">
                      <div className="flex items-center gap-1 text-[10px] font-mono-tab text-slate-400">
                        <MessageSquare className="h-3 w-3" />
                        Crew Comms
                      </div>
                      <div className="max-h-28 overflow-y-auto aero-scroll space-y-1 text-[11px]">
                        {messages.slice(-12).map((msg) => (
                          <div key={msg.id} className="text-slate-300">
                            <span className="font-semibold text-cyan-300">{msg.senderName}: </span>
                            <span>{msg.text}</span>
                          </div>
                        ))}
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!chatInput.trim()) return;
                          onSendMessage(chatInput.trim());
                          setChatInput('');
                        }}
                        className="flex gap-1.5"
                      >
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Coordinate with crew..."
                          className="flex-1 border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:border-cyan-400 focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="bg-cyan-500 px-2.5 text-slate-950 cursor-pointer"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                  </>
                )}
              </section>
            )}
          </div>

          {/* Footer Next-Phase Button */}
          <div className="border-t border-slate-800 p-3">
            <button
              type="button"
              onClick={onProceedToPlanner}
              className="w-full bg-cyan-500 py-2.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
            >
              Next: Rocket &amp; Orbit Planner (Phase 3) →
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
