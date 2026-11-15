import { useState } from 'react';
import {
  ArrowRight,
  BatteryCharging,
  Compass,
  Flame,
  Gamepad2,
  Globe,
  Rocket,
  Scale,
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
  { id: 'all', label: 'All Worlds' },
  { id: 'leo', label: 'Earth Ice' },
  { id: 'geo', label: 'Earth Comms' },
  { id: 'heo', label: 'Aurora Orbit' },
  { id: 'lunar', label: 'The Moon' },
  { id: 'lagrange', label: 'Deep Space' },
  { id: 'interplanetary', label: 'Mars' },
];

const FUN_MISSION_BLURBS: Record<string, { shortTitle: string; funGoal: string; distanceTag: string; color: string }> = {
  'leo-earth-climate': {
    shortTitle: 'Arctic Ice & Climate Patrol',
    funGoal: 'Zoom low over Earth’s North Pole to snap glowing ice sheets and northern storms!',
    distanceTag: 'Close Orbit · Easy',
    color: 'from-cyan-500/20 to-sky-600/10 border-cyan-500/40',
  },
  'geo-comms-relay': {
    shortTitle: 'Super-High Sky Relay',
    funGoal: 'Park super high above Earth so your laser beam stays locked onto cities nonstop!',
    distanceTag: 'High Orbit · Medium',
    color: 'from-indigo-500/20 to-blue-600/10 border-indigo-400/40',
  },
  'heo-magnetosphere': {
    shortTitle: 'Northern Lights Chaser',
    funGoal: 'Slingshot in a giant egg-shaped loop to surf Earth’s shimmering green auroras!',
    distanceTag: 'Looping Orbit · Medium',
    color: 'from-emerald-500/20 to-teal-600/10 border-emerald-400/40',
  },
  'lunar-gateway-recon': {
    shortTitle: 'Moon Crater Ice Hunt',
    funGoal: 'Fly to the Moon and shine radar into freezing dark craters hiding sparkling water ice!',
    distanceTag: 'Lunar Flight · Challenge',
    color: 'from-slate-400/20 to-cyan-500/10 border-slate-400/50',
  },
  'l2-deep-space': {
    shortTitle: 'Exoplanet Telescope Quest',
    funGoal: 'Float far behind Earth in deep space to photograph colorful alien worlds and nebulas!',
    distanceTag: 'Deep Space · Pro',
    color: 'from-purple-500/20 to-amber-500/10 border-purple-400/40',
  },
  'interplanetary-mars': {
    shortTitle: 'Red Planet Ice Expedition',
    funGoal: 'Blast all the way to Mars to discover hidden underground lakes and red dust storms!',
    distanceTag: 'Mars Voyage · Epic',
    color: 'from-orange-500/25 to-rose-600/10 border-orange-400/50',
  },
};

const FRIENDLY_GADGET_COPY: Record<string, { nick: string; funLine: string }> = {
  'radar-sar': {
    nick: 'Cloud-Piercing Radar',
    funLine: 'Sees straight through thick clouds and dark Moon craters!',
  },
  'canadarm-3': {
    nick: 'Canadarm3 Robot Claw',
    funLine: 'Canadian robotic arm that catches supply pods in zero gravity!',
  },
  'spec-highres': {
    nick: 'Rainbow Molecule Scanner',
    funLine: 'Spots hidden water, methane gas, and alien air colors!',
  },
  'cam-multispec': {
    nick: 'Super Planet Camera',
    funLine: 'Takes vivid full-color space snapshots of storms and forests!',
  },
  'mag-boom': {
    nick: 'Aurora & Ice Detector',
    funLine: 'Senses glowing magnetic storms and underground frozen water!',
  },
};

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
  const massPct = Math.min(100, Math.round((totalPayloadMassKg / selectedObjective.maxPayloadMassKg) * 100));
  const isOverMass = totalPayloadMassKg > selectedObjective.maxPayloadMassKg;
  const fuelPct = Math.round(((propellantBudgetKg - 150) / (2500 - 150)) * 100);

  return (
    <div className="space-y-5">
      {/* Arcade Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-cyan-500/30 bg-[#091122] p-5 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
            <Compass className="h-4 w-4" />
            <span>Step 1 · Pick Your Space Adventure</span>
          </div>
          <h2 className="mt-1 font-display text-2xl md:text-3xl font-black tracking-tight text-white">
            Choose a Planet &amp; Build Your Craft
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Pick where you want to explore, snap on fun NASA &amp; Canadian Space Agency gadgets, then blast off!
          </p>
        </div>

        <button
          type="button"
          onClick={onProceedToLaunch}
          className="flex items-center gap-2.5 bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3.5 text-sm font-black text-slate-950 hover:from-amber-300 hover:to-orange-400 transition-all cursor-pointer shrink-0 shadow-lg shadow-amber-500/25 whitespace-nowrap"
        >
          <Rocket className="h-5 w-5" />
          <span>GO TO LAUNCHPAD!</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Play Mode Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChangeArchitectMode('cadet')}
          className={`flex items-center gap-3.5 border p-4 text-left transition-all cursor-pointer ${
            architectMode === 'cadet'
              ? 'border-cyan-400 bg-cyan-950/35 ring-1 ring-cyan-400/50'
              : 'border-slate-800 bg-[#080d19] hover:border-slate-700'
          }`}
        >
          <div className="h-10 w-10 flex items-center justify-center bg-cyan-500/20 border border-cyan-400/40 shrink-0">
            <Gamepad2 className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-bold text-white">Adventure Mode</span>
              {architectMode === 'cadet' && (
                <span className="text-[11px] font-bold text-cyan-300">· Selected</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-300">
              Earn up to 3 Stars, dodge space junk, catch supply pods, and unlock colorful Discovery Cards!
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChangeArchitectMode('sandbox')}
          className={`flex items-center gap-3.5 border p-4 text-left transition-all cursor-pointer ${
            architectMode === 'sandbox'
              ? 'border-amber-400 bg-amber-950/25 ring-1 ring-amber-400/50'
              : 'border-slate-800 bg-[#080d19] hover:border-slate-700'
          }`}
        >
          <div className="h-10 w-10 flex items-center justify-center bg-amber-500/20 border border-amber-400/40 shrink-0">
            <Wrench className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-bold text-white">Free Play Sandbox</span>
              {architectMode === 'sandbox' && (
                <span className="text-[11px] font-bold text-amber-300">· Selected</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-300">
              No limits! Experiment with any rocket, sling orbits wildly, and snap every planet landmark at your own pace.
            </p>
          </div>
        </button>
      </div>

      {/* Destination Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {REGIME_TABS.map((tab) => {
          const isActive = activeRegimeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveRegimeFilter(tab.id)}
              className={`px-3.5 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                isActive
                  ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                  : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Vibrant Destination Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredObjectives.map((obj) => {
          const isSelected = obj.id === selectedObjective.id;
          const bodyData = CELESTIAL_BODIES[obj.targetBody];
          const meta = FUN_MISSION_BLURBS[obj.id] || {
            shortTitle: obj.title,
            funGoal: obj.summary,
            distanceTag: bodyData.name,
            color: 'from-cyan-500/20 to-slate-900 border-slate-700',
          };

          return (
            <button
              key={obj.id}
              type="button"
              onClick={() => onSelectObjective(obj)}
              className={`flex flex-col justify-between text-left border p-4 transition-all cursor-pointer bg-gradient-to-br ${meta.color} ${
                isSelected ? 'ring-2 ring-cyan-300 scale-[1.01]' : 'opacity-85 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-5 w-5 rounded-full border border-white/40 inline-block shrink-0 shadow-inner"
                      style={{
                        background:
                          obj.targetBody === 'mars'
                            ? 'radial-gradient(circle at 30% 30%, #fb923c, #9a3412)'
                            : obj.targetBody === 'moon'
                              ? 'radial-gradient(circle at 30% 30%, #f1f5f9, #64748b)'
                              : 'radial-gradient(circle at 30% 30%, #38bdf8, #0369a1)',
                      }}
                    />
                    <span className="text-xs font-bold text-slate-200">{meta.distanceTag}</span>
                  </div>
                  {isSelected && (
                    <span className="bg-cyan-400 text-slate-950 px-2 py-0.5 text-[10px] font-black uppercase">
                      SELECTED
                    </span>
                  )}
                </div>

                <h3 className="mt-2.5 font-display text-lg font-extrabold text-white">{meta.shortTitle}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-200">{meta.funGoal}</p>
              </div>

              <div className="mt-4 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-semibold text-slate-200">
                <span className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-cyan-300" />
                  {bodyData.name}
                </span>
                <span className="text-amber-300">Reward: 3★ Discovery Gallery</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Fun Gadget Loadout */}
      <div className="border border-slate-800 bg-[#080d19] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-extrabold text-white">
              Snap On Your Space Gadgets
            </h3>
            <p className="text-xs text-slate-400">
              Click gadgets ON or OFF! Keep total weight inside the green zone so your rocket can lift off.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 px-3.5 py-2">
            <Scale className={`h-4 w-4 ${isOverMass ? 'text-rose-400' : 'text-emerald-400'}`} />
            <div className="w-36">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-slate-300">Craft Weight</span>
                <span className={isOverMass ? 'text-rose-400' : 'text-emerald-400'}>
                  {isOverMass ? 'TOO HEAVY!' : 'GOOD FIT ✓'}
                </span>
              </div>
              <div className="h-2 bg-slate-800 overflow-hidden mt-1">
                <div
                  className={`h-full transition-all ${
                    isOverMass ? 'bg-rose-500' : massPct > 80 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${massPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {instruments.map((inst) => {
            const friendly = FRIENDLY_GADGET_COPY[inst.id] || {
              nick: inst.name,
              funLine: inst.description,
            };
            return (
              <button
                key={inst.id}
                type="button"
                onClick={() => onToggleInstrument(inst.id)}
                className={`border p-3.5 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  inst.enabled
                    ? 'border-emerald-400/80 bg-emerald-950/25'
                    : 'border-slate-800 bg-slate-900/50 opacity-70 hover:opacity-100'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-cyan-300">{inst.agencyPartner}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-black uppercase ${
                        inst.enabled ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {inst.enabled ? 'ON ✓' : 'OFF'}
                    </span>
                  </div>
                  <h4 className="mt-1 font-display text-sm font-bold text-white">{friendly.nick}</h4>
                  <p className="mt-1 text-xs text-slate-300">{friendly.funLine}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300">
                  <span>Weight: {inst.massKg < 100 ? 'Light' : inst.massKg < 150 ? 'Medium' : 'Heavy'}</span>
                  <span className="flex items-center gap-1 text-amber-300">
                    <BatteryCharging className="h-3.5 w-3.5" />
                    {inst.powerDrawW < 100 ? 'Low Power' : 'High Power'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Engine Choice + Fuel Tank Slider */}
      <div className="border border-slate-800 bg-[#080d19] p-5 space-y-4">
        <h3 className="font-display text-base font-extrabold text-white">
          Pick Your Space Engine &amp; Fuel Tank Size
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <button
            type="button"
            onClick={() => onSelectPropulsion('chemical')}
            className={`border p-4 text-left transition-all cursor-pointer ${
              selectedPropulsion === 'chemical'
                ? 'border-amber-400 bg-amber-950/30 ring-1 ring-amber-400/50'
                : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-amber-400" />
                <span className="font-display text-base font-bold text-white">Turbo Rocket Blaster</span>
              </div>
              <span className="text-[11px] font-bold text-amber-300">SUPER FAST</span>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              Huge punchy flame burns! Great for quick orbit hops and fast asteroid dodges.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelectPropulsion('electric')}
            className={`border p-4 text-left transition-all cursor-pointer ${
              selectedPropulsion === 'electric'
                ? 'border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-400/50'
                : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-cyan-400" />
                <span className="font-display text-base font-bold text-white">Blue Ion Thruster</span>
              </div>
              <span className="text-[11px] font-bold text-cyan-300">FUEL SAVER</span>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              Glowing blue ion beam sips tiny amounts of fuel—awesome for faraway Moon &amp; Mars trips!
            </p>
          </button>
        </div>

        <div className="border border-slate-800 bg-slate-900/60 p-3.5 space-y-2">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-200">Boost Fuel Tank Size</span>
            <span className="text-cyan-300">{fuelPct}% Tank Capacity</span>
          </div>
          <input
            type="range"
            min={150}
            max={2500}
            step={50}
            value={propellantBudgetKg}
            onChange={(e) => onChangePropellantBudget(parseInt(e.target.value, 10))}
            aria-label="Boost Fuel Tank Size"
            className="w-full accent-cyan-400 h-2 bg-slate-800 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Light Hopper</span>
            <span>Balanced</span>
            <span>Mega Tank</span>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onProceedToLaunch}
            className="flex items-center gap-2 bg-cyan-500 px-6 py-3 text-sm font-black text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
          >
            <Rocket className="h-4 w-4" />
            <span>Ready! Head to Launchpad →</span>
          </button>
        </div>
      </div>
    </div>
  );
}
