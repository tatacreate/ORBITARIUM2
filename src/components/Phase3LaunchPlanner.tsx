import { AlertTriangle, ArrowLeft, CheckCircle2, Compass, Rocket, ShieldAlert, Wrench } from 'lucide-react';
import { LAUNCH_VEHICLES, ORBITS } from '../data/catalog';
import { getCatalogParts } from '../engine/physics';
import type { LaunchVehicleSpec, MissionConfig, OrbitSpec, TelemetryReport } from '../types/mission';
import { ResourceFlowMap } from './ResourceFlowMap';

interface Phase3LaunchPlannerProps {
  config: MissionConfig;
  telemetry: TelemetryReport;
  onUpdateConfig: (patch: Partial<MissionConfig>, label: string) => void;
  onBackToAssembly: () => void;
  onLaunchSimulation: () => void;
}

function RocketSilhouette({ vehicle, active }: { vehicle: LaunchVehicleSpec; active: boolean }) {
  const heightPct =
    vehicle.id === 'electron-light'
      ? 48
      : vehicle.id === 'falcon-med'
        ? 68
        : vehicle.id === 'vulcan-heavy'
          ? 80
          : 96;
  const stroke = active ? '#22d3ee' : vehicle.accentColor;

  return (
    <svg
      width="44"
      height="78"
      viewBox="0 0 44 78"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Fairing Nosecone */}
      <path
        d={`M22 ${76 - heightPct * 0.72} L29 ${76 - heightPct * 0.56} L29 66 L15 66 L15 ${76 - heightPct * 0.56} Z`}
        fill="#0f172a"
        stroke={stroke}
        strokeWidth="1.6"
      />
      {/* Side boosters for Heavy Lift */}
      {vehicle.id === 'vulcan-heavy' && (
        <>
          <rect x="8" y="38" width="5" height="28" rx="2" fill="#1e293b" stroke={stroke} strokeWidth="1.2" />
          <rect x="31" y="38" width="5" height="28" rx="2" fill="#1e293b" stroke={stroke} strokeWidth="1.2" />
        </>
      )}
      {/* Super-heavy wide hull */}
      {vehicle.id === 'starship-super' && (
        <rect x="13" y="16" width="18" height="50" rx="4" fill="#1e293b" stroke={stroke} strokeWidth="1.6" />
      )}
      {/* Exhaust Fins & Plume */}
      <path d="M15 66 L11 72 L16 70 Z" fill={stroke} />
      <path d="M29 66 L33 72 L28 70 Z" fill={stroke} />
      <path d="M19 67 L22 76 L25 67 Z" fill="#f59e0b" />
    </svg>
  );
}

export function Phase3LaunchPlanner({
  config,
  telemetry,
  onUpdateConfig,
  onBackToAssembly,
  onLaunchSimulation,
}: Phase3LaunchPlannerProps) {
  const parts = getCatalogParts(config);

  const planetColors: Record<string, { fill: string; ring: string; label: string }> = {
    earth: { fill: '#2563eb', ring: '#38bdf8', label: 'EARTH' },
    moon: { fill: '#94a3b8', ring: '#cbd5e1', label: 'MOON' },
    mars: { fill: '#ea580c', ring: '#fb923c', label: 'MARS' },
    psyche: { fill: '#64748b', ring: '#eab308', label: 'ASTEROID PSYCHE' },
    europa: { fill: '#7dd3fc', ring: '#a78bfa', label: 'EUROPA / JUPITER' },
  };
  const worldVisual = planetColors[parts.objective.targetBody] ?? planetColors.earth;

  const selectedOrbit = ORBITS.find((o) => o.id === config.orbitId) ?? ORBITS[0];
  const targetOrbits: OrbitSpec[] = ORBITS.filter(
    (o) => o.body === parts.objective.targetBody,
  );
  const otherOrbits = ORBITS.filter(
    (o) => o.body !== parts.objective.targetBody && o.id !== config.orbitId,
  );
  const visibleOrbits: OrbitSpec[] = [
    ...targetOrbits,
    ...(targetOrbits.some((o) => o.id === config.orbitId) ? [] : [selectedOrbit]),
    ...otherOrbits,
  ].slice(0, 5);

  const fairingFits = parts.bus.tier <= parts.launchVehicle.maxBusTier;
  const massFits = telemetry.wetMassKg <= telemetry.payloadCapacityKg;

  return (
    <div className="pointer-events-auto fixed inset-0 top-[52px] z-20 overflow-y-auto bg-[#050811]/90 px-4 py-5 md:px-8">
      <div className="mx-auto max-w-6xl space-y-5 pb-20">
        {/* Top Phase Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-800 bg-[#080d19] p-4">
          <div>
            <div className="text-[11px] font-mono-tab uppercase tracking-widest text-cyan-400">
              Phase 3 of 5 · Launch Vehicle &amp; Orbit Planner
            </div>
            <h1 className="mt-0.5 font-display text-2xl font-bold text-white">
              Pick Your Rocket &amp; Flight Path to {parts.objective.targetBody.toUpperCase()}
            </h1>
            <p className="mt-0.5 text-xs text-slate-300">
              Your assembled spacecraft weighs <span className="font-mono-tab font-semibold text-white">{telemetry.wetMassKg} kg</span> (fueled) and uses a <span className="font-semibold text-cyan-300">{parts.bus.shortLabel}</span> frame.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBackToAssembly}
              className="flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-medium text-slate-200 hover:border-cyan-400 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Edit Spacecraft
            </button>
            <button
              type="button"
              onClick={onLaunchSimulation}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                telemetry.launchReady
                  ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                  : 'border border-amber-400/80 bg-amber-950/60 text-amber-200 hover:bg-amber-900/60'
              }`}
            >
              <Rocket className="h-4 w-4" />
              <span>
                {telemetry.launchReady
                  ? 'Launch Mission Simulation →'
                  : 'Test Launch Anyway (Expect Failure) →'}
              </span>
            </button>
          </div>
        </div>

        {/* Connected 6-Resource Mission Chain */}
        <ResourceFlowMap config={config} telemetry={telemetry} />

        {/* Main 2-Column Planner */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT: Visual Launch Vehicle Fleet & Live Compatibility Check */}
          <div className="lg:col-span-6 space-y-4">
            <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono-tab uppercase tracking-wider text-slate-300">
                  1. Select Launch Vehicle
                </div>
                <span className="font-mono-tab text-[11px] text-slate-400">
                  Orbit Lift Factor: {Math.round(parts.orbit.payloadMultiplier * 100)}% of LEO
                </span>
              </div>

              <div className="space-y-2.5">
                {LAUNCH_VEHICLES.map((lv) => {
                  const active = config.launchVehicleId === lv.id;
                  const liftAtOrbit = Math.round(
                    lv.leoCapacityKg *
                      parts.orbit.payloadMultiplier *
                      parts.difficulty.payloadMultiplier *
                      parts.constraintEvent.payloadMult,
                  );
                  const fitsMass = telemetry.wetMassKg <= liftAtOrbit;
                  const fitsFairing = parts.bus.tier <= lv.maxBusTier;
                  const compatible = fitsMass && fitsFairing;

                  return (
                    <button
                      key={lv.id}
                      type="button"
                      onClick={() => onUpdateConfig({ launchVehicleId: lv.id }, lv.name)}
                      className={`w-full flex items-center gap-4 text-left border p-3 transition-colors cursor-pointer ${
                        active
                          ? 'border-cyan-400 bg-cyan-950/35'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                      }`}
                    >
                      <RocketSilhouette vehicle={lv} active={active} />

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-mono-tab uppercase tracking-wider text-cyan-400">
                              {lv.tierLabel}
                            </span>
                            <div className="text-sm font-bold text-white">{lv.name}</div>
                          </div>
                          <div className="text-right font-mono-tab">
                            <div className="text-xs font-bold text-amber-300">${lv.costM}M</div>
                            <div className="text-[10px] text-slate-400">{lv.heightMeters}m tall</div>
                          </div>
                        </div>

                        <p className="mt-1 text-[11px] text-slate-400">{lv.description}</p>

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tab">
                          <span className="text-slate-300">
                            Max to {parts.orbit.shortName}:{' '}
                            <strong className="text-white">{liftAtOrbit.toLocaleString()} kg</strong>
                          </span>
                          <span
                            className={`px-2 py-0.5 border text-[10px] ${
                              compatible
                                ? 'border-emerald-500/50 bg-emerald-950/35 text-emerald-300'
                                : 'border-rose-500/50 bg-rose-950/35 text-rose-300'
                            }`}
                          >
                            {!fitsFairing
                              ? '✖ Fairing Too Narrow'
                              : !fitsMass
                                ? `✖ Too Heavy (${telemetry.wetMassKg} kg)`
                                : '● Compatible'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Compatibility Check Panel */}
            <div
              className={`border p-4 space-y-2.5 ${
                telemetry.launchReady
                  ? 'border-emerald-500/50 bg-emerald-950/20'
                  : 'border-rose-500/60 bg-rose-950/25'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  {telemetry.launchReady ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                  )}
                  <span>Rocket &amp; Orbit Compatibility Check</span>
                </div>
                <span className="font-mono-tab text-[11px] text-slate-300">
                  {telemetry.wetMassKg} / {telemetry.payloadCapacityKg} kg
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono-tab">
                <div className="border border-slate-800 bg-slate-950/70 p-2">
                  <div className="text-slate-400">Weight Fit</div>
                  <div className={massFits ? 'text-emerald-400' : 'text-rose-400'}>
                    {massFits ? '● PASS' : '✖ OVER'}
                  </div>
                </div>
                <div className="border border-slate-800 bg-slate-950/70 p-2">
                  <div className="text-slate-400">Nose Fairing</div>
                  <div className={fairingFits ? 'text-emerald-400' : 'text-rose-400'}>
                    {fairingFits ? '● FITS' : '✖ TOO WIDE'}
                  </div>
                </div>
                <div className="border border-slate-800 bg-slate-950/70 p-2">
                  <div className="text-slate-400">Fuel Δv</div>
                  <div
                    className={
                      telemetry.deltaVStatus === 'Critical' ? 'text-rose-400' : 'text-emerald-400'
                    }
                  >
                    {telemetry.availableDeltaVKms}/{telemetry.requiredDeltaVKms}
                  </div>
                </div>
                <div className="border border-slate-800 bg-slate-950/70 p-2">
                  <div className="text-slate-400">Budget Cap</div>
                  <div
                    className={
                      telemetry.budgetStatus === 'Critical' ? 'text-rose-400' : 'text-emerald-400'
                    }
                  >
                    ${telemetry.totalCostM}/${telemetry.budgetCapM}M
                  </div>
                </div>
              </div>

              {!telemetry.launchReady && telemetry.advisories.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-rose-200">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    {telemetry.advisories[0].plainTerms} (Or click Test Launch above to see the failure unfold in flight!)
                  </span>
                  {telemetry.advisories[0].quickFix && parts.difficulty.showQuickFixes && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateConfig(
                          telemetry.advisories[0].quickFix!.patch,
                          telemetry.advisories[0].quickFix!.label,
                        )
                      }
                      className="flex items-center gap-1 bg-amber-400 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-amber-300 cursor-pointer"
                    >
                      <Wrench className="h-3 w-3" />
                      {telemetry.advisories[0].quickFix.label}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Interactive Visual Orbit Ring Selector */}
          <div className="lg:col-span-6 border border-slate-800 bg-[#080d19] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono-tab uppercase tracking-wider text-slate-300">
                <Compass className="h-4 w-4 text-cyan-400" />
                <span>2. Visual Orbit Ring Selector</span>
              </div>
              <span className="font-mono-tab text-[11px] text-cyan-300">
                Target: {worldVisual.label}
              </span>
            </div>

            {/* Interactive SVG Concentric Orbit Ring Visualizer */}
            <div className="relative border border-slate-800 bg-[#040710] p-3">
              <svg
                viewBox="0 0 420 230"
                className="w-full h-[215px]"
                role="img"
                aria-label="Interactive Orbit Ring Diagram"
              >
                {/* Star dots */}
                <circle cx="42" cy="30" r="1.2" fill="#94a3b8" />
                <circle cx="375" cy="44" r="1.4" fill="#cbd5e1" />
                <circle cx="340" cy="192" r="1.1" fill="#64748b" />
                <circle cx="70" cy="185" r="1.3" fill="#94a3b8" />

                {/* Concentric Orbit Rings mapped from visibleOrbits */}
                {visibleOrbits.map((orb, idx) => {
                  const isSelected = orb.id === config.orbitId;
                  const matchesBody = orb.body === parts.objective.targetBody;
                  const rx = 68 + idx * 38;
                  const ry = 34 + idx * 19;
                  return (
                    <g
                      key={orb.id}
                      onClick={() => onUpdateConfig({ orbitId: orb.id }, orb.shortName)}
                      className="cursor-pointer group"
                    >
                      {/* Generous invisible hit area */}
                      <ellipse
                        cx="210"
                        cy="115"
                        rx={rx}
                        ry={ry}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="16"
                      />
                      <ellipse
                        cx="210"
                        cy="115"
                        rx={rx}
                        ry={ry}
                        fill="none"
                        stroke={
                          isSelected
                            ? '#22d3ee'
                            : matchesBody
                              ? '#334155'
                              : '#1e293b'
                        }
                        strokeWidth={isSelected ? 2.6 : 1.3}
                        strokeDasharray={orb.ringType === 'interplanetary' || orb.ringType === 'lunar' ? '5 4' : undefined}
                      />
                      {/* Clickable Node Badge on the Ring */}
                      <circle
                        cx={210 + (idx % 2 === 0 ? rx : -rx)}
                        cy={115}
                        r={isSelected ? 6 : 4.5}
                        fill={isSelected ? '#22d3ee' : matchesBody ? '#64748b' : '#334155'}
                      />
                    </g>
                  );
                })}

                {/* Central Target Planet / Moon / Asteroid */}
                <circle
                  cx="210"
                  cy="115"
                  r="30"
                  fill={worldVisual.fill}
                  stroke={worldVisual.ring}
                  strokeWidth="2"
                />
                <text
                  x="210"
                  y="119"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9.5"
                  fontWeight="700"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {parts.objective.targetBody.toUpperCase()}
                </text>
              </svg>

              <div className="mt-2 flex items-center justify-between text-[11px] font-mono-tab text-slate-400">
                <span>Selected Ring: <strong className="text-cyan-300">{parts.orbit.name}</strong></span>
                <span>Delay: {telemetry.commsDelaySec}s</span>
              </div>
            </div>

            {/* Selectable Orbit Cards */}
            <div className="space-y-2">
              {visibleOrbits.map((orb) => {
                const selected = orb.id === config.orbitId;
                const isRecommended = orb.id === parts.objective.recommendedOrbitId;
                const wrongWorld = orb.body !== parts.objective.targetBody;

                return (
                  <button
                    key={orb.id}
                    type="button"
                    onClick={() => onUpdateConfig({ orbitId: orb.id }, orb.shortName)}
                    className={`w-full text-left border p-3 transition-colors cursor-pointer ${
                      selected
                        ? 'border-cyan-400 bg-cyan-950/35'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">{orb.name}</span>
                      <div className="flex items-center gap-1.5 font-mono-tab text-[10px]">
                        {isRecommended && (
                          <span className="border border-emerald-500/50 bg-emerald-950/40 px-1.5 py-0.5 text-emerald-300">
                            Recommended
                          </span>
                        )}
                        {wrongWorld && (
                          <span className="border border-rose-500/50 bg-rose-950/40 px-1.5 py-0.5 text-rose-300">
                            Wrong World
                          </span>
                        )}
                        <span className="text-amber-300">{orb.requiredDeltaVKms} km/s Δv</span>
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-cyan-200/90">
                      {orb.coverageNote}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-3 font-mono-tab text-[10px] text-slate-400">
                      <span>{orb.delayNote}</span>
                      <span>· Eclipse: {Math.round(orb.eclipseFraction * 100)}%</span>
                      <span>· Rad: {orb.radiationDoseRate} krad/yr</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
