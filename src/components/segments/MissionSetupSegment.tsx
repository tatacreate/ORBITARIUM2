import { useState } from 'react';
import {
  ArrowRight,
  Compass,
  Cpu,
  Database,
  DollarSign,
  Flame,
  Globe,
  Info,
  Scale,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react';
import { CELESTIAL_BODIES, NASA_OBJECTIVES } from '../../engine/orbitalMechanics';
import type {
  ArchitectMode,
  GmatMissionRegime,
  NasaInstrument,
  NasaObjectiveSpec,
  PropulsionType,
} from '../../types/nasaSegments';

interface MissionSetupSegmentProps {
  architectMode: ArchitectMode;
  onChangeArchitectMode: (mode: ArchitectMode) => void;
  selectedObjective: NasaObjectiveSpec;
  onSelectObjective: (obj: NasaObjectiveSpec) => void;
  selectedPropulsion: PropulsionType;
  onSelectPropulsion: (type: PropulsionType) => void;
  propellantBudgetKg: number;
  onChangePropellantBudget: (kg: number) => void;
  instruments: NasaInstrument[];
  onToggleInstrument: (id: string) => void;
  onProceedToLaunch: () => void;
}

const REGIME_TABS: { id: 'all' | GmatMissionRegime; label: string }[] = [
  { id: 'all', label: 'All Regimes (6)' },
  { id: 'leo', label: 'LEO Climate' },
  { id: 'geo', label: 'GEO Comms' },
  { id: 'heo', label: 'HEO Molniya' },
  { id: 'lunar', label: 'Lunar Recon' },
  { id: 'lagrange', label: 'L2 Lagrange' },
  { id: 'interplanetary', label: 'Mars Transfer' },
];

export function MissionSetupSegment({
  architectMode,
  onChangeArchitectMode,
  selectedObjective,
  onSelectObjective,
  selectedPropulsion,
  onSelectPropulsion,
  propellantBudgetKg,
  onChangePropellantBudget,
  instruments,
  onToggleInstrument,
  onProceedToLaunch,
}: MissionSetupSegmentProps) {
  const [activeRegimeFilter, setActiveRegimeFilter] = useState<'all' | GmatMissionRegime>('all');

  const filteredObjectives =
    activeRegimeFilter === 'all'
      ? NASA_OBJECTIVES
      : NASA_OBJECTIVES.filter((o) => o.regime === activeRegimeFilter);

  const activeInstruments = instruments.filter((i) => i.enabled);
  const totalPayloadMassKg = activeInstruments.reduce((sum, i) => sum + i.massKg, 0) + 420;
  const totalPowerW = activeInstruments.reduce((sum, i) => sum + i.powerDrawW, 0) + 120;
  const isOverMass = totalPayloadMassKg > selectedObjective.maxPayloadMassKg;

  return (
    <div className="space-y-5">
      {/* Segment Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-800 bg-[#080d19] p-4 shadow-xl">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-cyan-500/50 bg-cyan-950/40 px-2 py-0.5 font-mono-tab text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              NASA Phase A: Concept &amp; Requirements Definition
            </span>
            <span className="text-xs text-slate-400">
              NASA SP-2016-6105 · GMAT Astrodynamics · CSA International Payloads
            </span>
          </div>
          <h2 className="mt-1 font-display text-xl md:text-2xl font-bold text-white">
            Mission Setup: Scientific Need, International Payloads &amp; Constraints
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Choose Cadet Challenge (guided mission goals &amp; badges) or Sandbox Architect Mode, select a GMAT regime, and equip joint NASA &amp; CSA instruments.
          </p>
        </div>

        <button
          type="button"
          onClick={onProceedToLaunch}
          className="flex items-center gap-2 bg-cyan-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer shrink-0 shadow-lg shadow-cyan-500/20 whitespace-nowrap"
        >
          <span>Segment 1: Launch &amp; Injection</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Cadet Challenge vs Sandbox Architect Toggle Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChangeArchitectMode('cadet')}
          className={`flex items-start gap-3 border p-3.5 text-left transition-colors cursor-pointer ${
            architectMode === 'cadet'
              ? 'border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-500/40'
              : 'border-slate-800 bg-[#080d19] hover:border-slate-700'
          }`}
        >
          <Sparkles className={`h-5 w-5 shrink-0 mt-0.5 ${architectMode === 'cadet' ? 'text-cyan-400' : 'text-slate-400'}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold text-white">Cadet Challenge (Gamified Guided Mode)</span>
              {architectMode === 'cadet' && (
                <span className="font-mono-tab text-[10px] font-bold text-cyan-300 border border-cyan-500/40 bg-cyan-950/60 px-1.5 py-0.5">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-300">
              Guided NASA–CSA objectives, active orbital mini-challenges in Segment 2, Mission Rank Badges, and unlockable Space Science Discovery Cards.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChangeArchitectMode('sandbox')}
          className={`flex items-start gap-3 border p-3.5 text-left transition-colors cursor-pointer ${
            architectMode === 'sandbox'
              ? 'border-amber-400 bg-amber-950/25 ring-1 ring-amber-500/40'
              : 'border-slate-800 bg-[#080d19] hover:border-slate-700'
          }`}
        >
          <Wrench className={`h-5 w-5 shrink-0 mt-0.5 ${architectMode === 'sandbox' ? 'text-amber-400' : 'text-slate-400'}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold text-white">Sandbox Architect Mode (Unrestricted Lab)</span>
              {architectMode === 'sandbox' && (
                <span className="font-mono-tab text-[10px] font-bold text-amber-300 border border-amber-500/40 bg-amber-950/60 px-1.5 py-0.5">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-300">
              Free-form astrodynamics laboratory: test any rocket, payload mass, and Delta-v maneuver freely without lockouts between segments.
            </p>
          </div>
        </button>
      </div>

      {/* Regime Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-800 pb-2">
        {REGIME_TABS.map((tab) => {
          const isActive = activeRegimeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveRegimeFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium font-mono-tab transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-b-2 border-cyan-400 bg-cyan-950/40 text-cyan-300 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Selectable NASA / GMAT Scientific Objectives */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredObjectives.map((obj) => {
          const isSelected = obj.id === selectedObjective.id;
          const targetBodyData = CELESTIAL_BODIES[obj.targetBody];

          return (
            <button
              key={obj.id}
              type="button"
              onClick={() => onSelectObjective(obj)}
              className={`flex flex-col justify-between text-left border p-4 transition-all cursor-pointer ${
                isSelected
                  ? 'border-cyan-400 bg-cyan-950/35 ring-1 ring-cyan-500/50'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-tab text-[10px] uppercase tracking-wider text-cyan-400 font-bold">
                    {obj.regime.toUpperCase()} · {targetBodyData.name}
                  </span>
                  <span className="font-mono-tab text-xs font-bold text-amber-300">
                    Cap ${obj.budgetCapM}M
                  </span>
                </div>

                <h3 className="mt-1.5 font-display text-sm font-bold text-white line-clamp-1">{obj.title}</h3>
                <p className="mt-1 text-xs text-cyan-100/90 leading-snug line-clamp-2">
                  {obj.scientificNeed}
                </p>
                <div className="mt-2 text-[10px] font-mono-tab text-slate-400 bg-slate-950/60 p-2 border border-slate-800/80">
                  {obj.gmatScenarioDesc}
                </div>
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-slate-800/90 grid grid-cols-3 gap-2 font-mono-tab text-[10px] text-slate-300">
                <div>
                  <span className="text-slate-500">Alt / Ap:</span>{' '}
                  <strong className="text-white">
                    {obj.apoapsisKm ? `${obj.apoapsisKm} km` : `${obj.targetAltitudeKm} km`}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Inc (i):</span>{' '}
                  <strong className="text-white">{obj.targetInclinationDeg}°</strong>
                </div>
                <div>
                  <span className="text-slate-500">Max Payload:</span>{' '}
                  <strong className="text-white">{obj.maxPayloadMassKg} kg</strong>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* International Payload Suite Selector (NASA & CSA Instruments) */}
      <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-cyan-400" />
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
              International Payload Suite (NASA &amp; Canadian Space Agency)
            </h3>
          </div>
          <div className="flex items-center gap-3 font-mono-tab text-xs">
            <span className={isOverMass ? 'text-rose-400 font-bold' : 'text-cyan-300'}>
              Bus + Payload: {totalPayloadMassKg} / {selectedObjective.maxPayloadMassKg} kg
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-300">Total Draw: {totalPowerW} W</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {instruments.map((inst) => (
            <button
              key={inst.id}
              type="button"
              onClick={() => onToggleInstrument(inst.id)}
              className={`border p-3 text-left transition-all cursor-pointer flex flex-col justify-between ${
                inst.enabled
                  ? 'border-cyan-400/70 bg-cyan-950/25'
                  : 'border-slate-800 bg-slate-900/40 opacity-75 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-tab text-[10px] font-bold text-cyan-300">
                    {inst.acronym} · {inst.agencyPartner}
                  </span>
                  <span
                    className={`font-mono-tab text-[10px] font-bold px-1.5 py-0.5 ${
                      inst.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {inst.enabled ? 'EQUIPPED' : 'STANDBY'}
                  </span>
                </div>
                <h4 className="mt-1 font-display text-xs font-bold text-white">{inst.name}</h4>
                <p className="mt-1 text-[11px] text-slate-300 leading-snug">{inst.description}</p>
                {inst.csaHeritage && (
                  <div className="mt-1.5 text-[10px] font-mono-tab text-amber-300/90">
                    Heritage: {inst.csaHeritage}
                  </div>
                )}
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono-tab text-[10px] text-slate-400">
                <span>Mass: <strong className="text-slate-200">{inst.massKg} kg</strong></span>
                <span>Power: <strong className="text-amber-300">{inst.powerDrawW} W</strong></span>
                <span>Data: <strong className="text-cyan-300">{inst.dataRateMbps} Mbps</strong></span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Propulsion Architecture & Propellant Budget Selector */}
      <div className="border border-slate-800 bg-[#080d19] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-cyan-400" />
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
              Spacecraft Propulsion Architecture &amp; Propellant Sizing
            </h3>
          </div>
          <span className="font-mono-tab text-[11px] text-slate-400">
            Regime: {selectedObjective.regime.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Chemical Propulsion Card */}
          <button
            type="button"
            onClick={() => onSelectPropulsion('chemical')}
            className={`border p-3.5 text-left transition-all cursor-pointer ${
              selectedPropulsion === 'chemical'
                ? 'border-amber-400 bg-amber-950/25 ring-1 ring-amber-500/40'
                : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-400" />
                <h4 className="font-display text-sm font-bold text-white">
                  Chemical Bipropellant (MMH / NTO)
                </h4>
              </div>
              <span className="font-mono-tab text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40">
                HIGH THRUST
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              Fast impulsive burns (minutes duration). Ideal for tight launch window injection and rapid Van Allen belt transit.
            </p>
            <div className="mt-3 pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-2 font-mono-tab text-[10px] text-slate-400">
              <div>Isp: <strong className="text-white">325 s</strong></div>
              <div>Thrust: <strong className="text-white">450 N</strong></div>
              <div>Burn Style: <strong className="text-amber-300">Impulsive</strong></div>
            </div>
          </button>

          {/* Solar Electric Propulsion Card */}
          <button
            type="button"
            onClick={() => onSelectPropulsion('electric')}
            className={`border p-3.5 text-left transition-all cursor-pointer ${
              selectedPropulsion === 'electric'
                ? 'border-cyan-400 bg-cyan-950/25 ring-1 ring-cyan-500/40'
                : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-400" />
                <h4 className="font-display text-sm font-bold text-white">
                  Solar Electric Propulsion (NEXT Hall Ion)
                </h4>
              </div>
              <span className="font-mono-tab text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                HIGH EFFICIENCY
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              Continuous low-thrust ion beams. Specific impulse of 3,100s cuts propellant mass by ~70%, leaving extra mass for sensors.
            </p>
            <div className="mt-3 pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-2 font-mono-tab text-[10px] text-slate-400">
              <div>Isp: <strong className="text-white">3,100 s</strong></div>
              <div>Thrust: <strong className="text-white">0.25 N</strong></div>
              <div>Burn Style: <strong className="text-cyan-300">Continuous Spiral</strong></div>
            </div>
          </button>
        </div>

        {/* Propellant Loading Slider */}
        <div className="border border-slate-800 bg-slate-900/60 p-3 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Onboard Propellant Loading Budget</span>
            <span className="font-mono-tab font-bold text-cyan-300">
              {propellantBudgetKg} kg (Recommended baseline: {selectedObjective.propellantBudgetKg} kg)
            </span>
          </div>
          <input
            type="range"
            min={150}
            max={2500}
            step={50}
            value={propellantBudgetKg}
            onChange={(e) => onChangePropellantBudget(parseInt(e.target.value, 10))}
            aria-label="Onboard Propellant Loading Budget"
            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono-tab">
            <span>150 kg (Smallsat budget)</span>
            <span>Target: {selectedObjective.propellantBudgetKg} kg</span>
            <span>2,500 kg (Deep space reserve)</span>
          </div>
        </div>
      </div>

      {/* Official NASA Systems Engineering & GMAT Requirements Matrix */}
      <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-cyan-400" />
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
              GMAT Orbital Elements &amp; Level-1 Constraints ({selectedObjective.title})
            </h3>
          </div>
          <span className="font-mono-tab text-[11px] text-slate-400">
            Ref: {selectedObjective.nasaProgramRef}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="border border-slate-800 bg-slate-900/50 p-3 space-y-1">
            <div className="flex items-center gap-1.5 font-mono-tab text-[11px] text-cyan-300">
              <Compass className="h-3.5 w-3.5" />
              Target Orbit Profile
            </div>
            <div className="text-slate-300">
              Alt: <strong className="text-white">{selectedObjective.targetAltitudeKm} km</strong>
            </div>
            <div className="text-slate-300">
              Inc: <strong className="text-white">{selectedObjective.targetInclinationDeg}°</strong>
            </div>
            <div className="text-slate-400 text-[10px]">
              Ecc: {selectedObjective.targetEccentricity ?? 0.0} · RAAN: {selectedObjective.raanDeg ?? 0}°
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900/50 p-3 space-y-1">
            <div className="flex items-center gap-1.5 font-mono-tab text-[11px] text-cyan-300">
              <Scale className="h-3.5 w-3.5" />
              Payload &amp; Propulsion
            </div>
            <div className="text-slate-300">
              Max Payload: <strong className="text-white">{selectedObjective.maxPayloadMassKg} kg</strong>
            </div>
            <div className="text-slate-300">
              Fuel Budget: <strong className="text-white">{propellantBudgetKg} kg</strong>
            </div>
            <div className="text-slate-400 text-[10px]">
              Engine: {selectedPropulsion === 'chemical' ? 'Chemical Biprop' : 'Solar Electric Ion'}
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900/50 p-3 space-y-1">
            <div className="flex items-center gap-1.5 font-mono-tab text-[11px] text-amber-300">
              <DollarSign className="h-3.5 w-3.5" />
              Budget &amp; Program Cap
            </div>
            <div className="text-slate-300">
              Cost Cap: <strong className="text-amber-300">${selectedObjective.budgetCapM}M</strong>
            </div>
            <div className="text-slate-400 text-[10px] line-clamp-2">
              Includes launcher procurement and Phase A–D development reserves.
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900/50 p-3 space-y-1">
            <div className="flex items-center gap-1.5 font-mono-tab text-[11px] text-emerald-300">
              <Globe className="h-3.5 w-3.5" />
              Primary Science Goal
            </div>
            <div className="text-slate-300 font-medium line-clamp-2">
              {selectedObjective.primaryScienceDeliverable}
            </div>
            <div className="text-slate-400 text-[10px]">
              Target Data: &ge; {selectedObjective.minScienceDataGB} GB
            </div>
          </div>
        </div>

        {/* Mission Briefing Callout: NASA + GMAT + CSA Partnership (clean full border, no thick left stripe) */}
        <div className="border border-cyan-500/30 bg-cyan-950/15 p-3.5 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-cyan-300">
            <Info className="h-3.5 w-3.5" />
            Mission Briefing: NASA Systems Engineering &amp; CSA Partnership
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {selectedObjective.csaCollaborationNote} In GMAT, astrodynamicists define the initial Keplerian state vector (a, e, i, Ω, ω, ν), dry mass, and propulsion hardware before running Prince-Dormand numerical propagators.
          </p>
        </div>
      </div>
    </div>
  );
}
