import { ArrowRight, BatteryCharging, Cpu, Flame, Radio, Rocket, Shield } from 'lucide-react';
import { getCatalogParts } from '../engine/physics';
import type { BuilderCategory, ConstraintStatus, MissionConfig, TelemetryReport } from '../types/mission';

interface ResourceFlowMapProps {
  config: MissionConfig;
  telemetry: TelemetryReport;
  onSelectCategory?: (cat: BuilderCategory) => void;
  compact?: boolean;
}

function statusPillClass(status: ConstraintStatus): string {
  if (status === 'Critical') return 'border-rose-500/80 bg-rose-950/60 text-rose-200';
  if (status === 'Tight') return 'border-amber-400/70 bg-amber-950/45 text-amber-200';
  return 'border-emerald-500/45 bg-emerald-950/30 text-emerald-200';
}

function arrowColor(status: ConstraintStatus): string {
  if (status === 'Critical') return 'text-rose-400';
  if (status === 'Tight') return 'text-amber-400';
  return 'text-cyan-500/70';
}

export function ResourceFlowMap({
  config,
  telemetry,
  onSelectCategory,
  compact = false,
}: ResourceFlowMapProps) {
  const parts = getCatalogParts(config);

  const nodes: {
    id: string;
    label: string;
    value: string;
    why: string;
    status: ConstraintStatus;
    category: BuilderCategory;
    icon: typeof Rocket;
  }[] = [
    {
      id: 'mass',
      label: '1. Rocket Lift',
      value: `${telemetry.wetMassKg}/${telemetry.payloadCapacityKg} kg`,
      why:
        telemetry.massStatus === 'Critical'
          ? 'Too heavy for rocket! Trim parts or pick bigger rocket in Phase 3.'
          : 'Rocket carries craft + fuel.',
      status: telemetry.massStatus,
      category: 'bus',
      icon: Rocket,
    },
    {
      id: 'dv',
      label: '2. Orbit Fuel (Δv)',
      value: `${telemetry.availableDeltaVKms}/${telemetry.requiredDeltaVKms} km/s`,
      why:
        telemetry.deltaVStatus === 'Critical'
          ? 'Not enough speed-change fuel to brake into target orbit!'
          : 'Engine brakes into target orbit.',
      status: telemetry.deltaVStatus,
      category: 'bus',
      icon: Flame,
    },
    {
      id: 'power',
      label: '3. Power Bus',
      value: `${telemetry.powerMarginW >= 0 ? '+' : ''}${telemetry.powerMarginW} W`,
      why:
        telemetry.powerStatus === 'Critical'
          ? `Draw beats supply at ${parts.orbit.solarDistanceAU} AU! Instruments brown out.`
          : 'Feeds sensors, CPU & radio.',
      status: telemetry.powerStatus,
      category: 'power',
      icon: BatteryCharging,
    },
    {
      id: 'science',
      label: '4. Science & CPU',
      value: `${telemetry.dataGeneratedGBDay} GB/d`,
      why:
        parts.instruments.length === 0
          ? 'Zero science sensors mounted yet!'
          : `${parts.instruments.length} sensor(s) + ${parts.avionics.dataBufferGB} GB buffer.`,
      status: parts.instruments.length === 0 ? 'Critical' : 'Nominal',
      category: 'science',
      icon: Cpu,
    },
    {
      id: 'comms',
      label: '5. Earth Link',
      value: `${telemetry.downlinkCapacityGBDay} GB/d`,
      why:
        telemetry.dataStatus === 'Critical'
          ? `Link (${telemetry.downlinkMbps} Mbps) cannot empty ${telemetry.dataGeneratedGBDay} GB/d!`
          : `Link margin +${telemetry.linkMarginDb} dB.`,
      status: telemetry.dataStatus,
      category: 'comms',
      icon: Radio,
    },
    {
      id: 'life',
      label: '6. Armor & Time',
      value: `${telemetry.estimatedLifetimeYears} yrs`,
      why:
        telemetry.lifetimeStatus === 'Critical'
          ? `Radiation (${parts.orbit.radiationDoseRate} krad/yr) wears out parts early!`
          : `Goal: ${telemetry.requiredLifetimeMonths} mo.`,
      status: telemetry.lifetimeStatus,
      category: 'bus',
      icon: Shield,
    },
  ];

  const firstBroken = nodes.find((n) => n.status === 'Critical') ?? nodes.find((n) => n.status === 'Tight');

  return (
    <div className="border border-slate-800 bg-[#080c15]/95 p-2.5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="text-[10px] font-mono-tab uppercase tracking-wider text-cyan-300">
          Connected Mission Chain — How Every Choice Ripples
        </div>
        {firstBroken ? (
          <div className="text-[11px] font-medium text-amber-200">
            Bottleneck at <strong className="text-white">{firstBroken.label}</strong>: {firstBroken.why}
          </div>
        ) : (
          <div className="text-[11px] text-emerald-300">
            All 6 connected mission links balanced for {parts.orbit.shortName}.
          </div>
        )}
      </div>

      <div className={`grid gap-1.5 ${compact ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
        {nodes.map((node, idx) => {
          const Icon = node.icon;
          const Tag = onSelectCategory ? 'button' : 'div';
          return (
            <div key={node.id} className="flex items-center gap-1 min-w-0">
              <Tag
                {...(onSelectCategory
                  ? {
                      type: 'button' as const,
                      onClick: () => onSelectCategory(node.category),
                    }
                  : {})}
                className={`flex-1 min-w-0 text-left border px-2 py-1.5 transition-colors ${statusPillClass(node.status)} ${
                  onSelectCategory ? 'cursor-pointer hover:border-cyan-300' : ''
                }`}
                title={node.why}
              >
                <div className="flex items-center gap-1 text-[10px] font-semibold truncate">
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{node.label}</span>
                </div>
                <div className="mt-0.5 font-mono-tab text-[10px] font-bold text-white truncate">
                  {node.value}
                </div>
              </Tag>
              {idx < nodes.length - 1 && (
                <ArrowRight className={`hidden xl:block h-3 w-3 shrink-0 ${arrowColor(node.status)}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
