import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { getCatalogParts } from '../engine/physics';
import type { GamePhase, MissionConfig, TelemetryReport } from '../types/mission';

interface AstraAdvisorProps {
  phase: GamePhase;
  config: MissionConfig;
  telemetry: TelemetryReport;
  activeAnomalyTitle?: string | null;
  onOpenDictionary: () => void;
}

type AstraMood = 'nominal' | 'warning' | 'alert' | 'excited';

export function AstraAdvisor({
  phase,
  config,
  telemetry,
  activeAnomalyTitle,
  onOpenDictionary,
}: AstraAdvisorProps) {
  const [minimized, setMinimized] = useState(false);

  if (phase === 'title') return null;

  const { objective, orbit, power, comms, launchVehicle, instruments } = getCatalogParts(config);

  let mood: AstraMood = 'nominal';
  let headline = 'A.S.T.R.A. Flight Advisor';
  let tip = 'Balance mass, power, data speed, and budget to ace your mission!';

  if (phase === 'briefing') {
    mood = 'excited';
    headline = `Mission Target: ${objective.title}`;
    tip =
      objective.targetBody === 'europa'
        ? 'Tip: Europa orbits 5.2× farther from the Sun than Earth—sunlight is super dim there, so plan for Nuclear RTG power and radiation armor!'
        : objective.targetBody === 'mars'
          ? 'Tip: Mars is 1.52 AU away—you will need extra solar wings or a High-Gain Dish to beam rover data back to Earth!'
          : objective.targetBody === 'moon'
            ? 'Tip: South Pole craters sit in deep shadow! Ice Radar and an Elemental Mapper make a winning combo.'
            : 'Tip: Pick a mission scenario and difficulty mode. New to space design? Start in Cadet Mode for helpful engineering quick-fixes!';
  } else if (phase === 'assembly') {
    if (telemetry.powerStatus === 'Critical') {
      mood = 'alert';
      headline = 'Power Warning — Solar Drop-Off!';
      tip = `Your spacecraft needs ${Math.abs(telemetry.powerMarginW)}W more electricity at ${orbit.solarDistanceAU} AU. Upgrade to Deployable Wings or an RTG Nuclear battery!`;
    } else if (telemetry.dataStatus === 'Critical') {
      mood = 'warning';
      headline = 'Data Bottleneck Alert!';
      tip = `Your ${instruments[0]?.shortName || 'instruments'} generate ${telemetry.dataGeneratedGBDay} GB/day, but ${comms.shortLabel} can only beam ${telemetry.downlinkCapacityGBDay} GB/day. Try a High-Gain Dish!`;
    } else if (telemetry.budgetStatus === 'Critical') {
      mood = 'warning';
      headline = 'Over Agency Budget!';
      tip = `Total cost is $${telemetry.totalCostM}M vs your $${telemetry.budgetCapM}M cap. Trim an optional subsystem or test a lighter bus to save millions.`;
    } else if (telemetry.synergies.length > 0) {
      mood = 'excited';
      headline = 'Sweet Engineering Synergy!';
      tip = `${telemetry.synergies[0]}! Watch your live gauges—you are ready to pick your Rocket & Orbit in Phase 3.`;
    } else {
      mood = 'nominal';
      headline = 'Assembly Bay Online';
      tip = `Try swapping parts and watch the live resource bars react! Adding heavy radar boosts Science, while ${power.shortLabel} keeps systems energized.`;
    }
  } else if (phase === 'planner') {
    if (telemetry.massStatus === 'Critical') {
      mood = 'alert';
      headline = 'Rocket Overload Check!';
      tip = `Your fueled spacecraft (${telemetry.wetMassKg} kg) is too heavy or wide for ${launchVehicle.name} (${telemetry.payloadCapacityKg} kg limit to ${orbit.shortName}). Upgrade your rocket or try a Fuel-saving orbit!`;
    } else if (!telemetry.launchReady && telemetry.advisories[0]) {
      mood = 'warning';
      headline = 'Pre-Launch Check Flagged';
      tip = telemetry.advisories[0].plainTerms;
    } else {
      mood = 'excited';
      headline = 'Trajectory Cleared for Launch!';
      tip = `${launchVehicle.name} easily carries your ${telemetry.wetMassKg} kg probe into ${orbit.shortName} (${orbit.delayNote}). Hit Launch when ready!`;
    }
  } else if (phase === 'simulating') {
    if (activeAnomalyTitle) {
      mood = 'alert';
      headline = 'Live Space Crisis!';
      tip = `Respond to "${activeAnomalyTitle}" carefully—protecting spacecraft margin keeps you alive, while bold science grabs bonus points!`;
    } else {
      mood = 'excited';
      headline = 'Telemetry Streaming Live';
      tip = `Watch your live power & data lines! Deep-space missions face solar flares, micrometeoroids, and Earth ground-station rainstorms.`;
    }
  } else if (phase === 'debrief') {
    mood = telemetry.launchReady ? 'excited' : 'warning';
    headline = 'Mission Debrief Ready';
    tip = 'Check which subsystems drove your score, then click "Modify & Re-Simulate" to beat your personal record!';
  }

  const moodColors: Record<AstraMood, { ring: string; visor: string; badge: string }> = {
    nominal: { ring: '#22d3ee', visor: '#06b6d4', badge: 'text-cyan-300 border-cyan-500/40' },
    excited: { ring: '#34d399', visor: '#10b981', badge: 'text-emerald-300 border-emerald-500/40' },
    warning: { ring: '#fbbf24', visor: '#f59e0b', badge: 'text-amber-300 border-amber-500/40' },
    alert: { ring: '#fb7185', visor: '#f43f5e', badge: 'text-rose-300 border-rose-500/40' },
  };

  const palette = moodColors[mood];

  return (
    <div className="pointer-events-auto fixed bottom-3 left-3 z-25 w-[310px] sm:w-[345px] border border-slate-700/90 bg-[#080c15] shadow-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/90 px-3 py-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Custom SVG A.S.T.R.A. Robot Helm Avatar */}
          <svg
            width="30"
            height="30"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle cx="18" cy="18" r="16" fill="#0f172a" stroke={palette.ring} strokeWidth="1.6" />
            <line x1="18" y1="2" x2="18" y2="6" stroke={palette.ring} strokeWidth="1.8" />
            <circle cx="18" cy="2.5" r="2" fill={palette.visor} />
            <rect x="8" y="11" width="20" height="14" rx="6" fill="#020617" stroke="#334155" strokeWidth="1.2" />
            <circle cx="14" cy="18" r="2.2" fill={palette.visor} />
            <circle cx="22" cy="18" r="2.2" fill={palette.visor} />
            <path
              d={
                mood === 'alert'
                  ? 'M14 22 Q18 20 22 22'
                  : mood === 'warning'
                    ? 'M14 21.5 L22 21.5'
                    : 'M13.5 21 Q18 23.5 22.5 21'
              }
              stroke={palette.ring}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono-tab text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                A.S.T.R.A.
              </span>
              <span className="text-[10px] text-slate-500">·</span>
              <span className="truncate text-xs font-semibold text-white">{headline}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMinimized((m) => !m)}
          aria-label={minimized ? 'Expand A.S.T.R.A. Advisor' : 'Minimize A.S.T.R.A. Advisor'}
          className="p-1 text-slate-400 hover:text-white cursor-pointer"
        >
          {minimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {!minimized && (
        <div className="p-3 space-y-2">
          <p className="text-xs leading-relaxed text-slate-200">{tip}</p>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="inline-flex items-center gap-1 text-[10px] font-mono-tab text-slate-400">
              <Sparkles className="h-3 w-3 text-cyan-400" />
              Orbitarium Flight Guide
            </span>
            <button
              type="button"
              onClick={onOpenDictionary}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300 hover:text-cyan-200 cursor-pointer"
            >
              <BookOpen className="h-3 w-3" />
              Space Terms
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
