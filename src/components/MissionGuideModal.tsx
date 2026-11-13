import { useState } from 'react';
import { BookOpen, Compass, Radio, Rocket, Sun, Users, X, Zap } from 'lucide-react';
import { CONCEPT_GUIDE, DIFFICULTY_MODES, ROLE_META } from '../data/catalog';
import type { DifficultyLevel, EngineeringRole } from '../types/mission';

interface MissionGuideModalProps {
  currentDifficulty: DifficultyLevel;
  onSelectDifficulty: (d: DifficultyLevel) => void;
  onClose: () => void;
}

type GuideTab = 'concepts' | 'lab';

export function MissionGuideModal({
  currentDifficulty,
  onSelectDifficulty,
  onClose,
}: MissionGuideModalProps) {
  const [activeTab, setActiveTab] = useState<GuideTab>('lab');
  const [labDistanceAU, setLabDistanceAU] = useState(1.52);
  const [labInstruments, setLabInstruments] = useState(2);
  const [labAltitudeMode, setLabAltitudeMode] = useState<'low' | 'elliptical' | 'deep'>('low');

  // Interactive 1/r^2 solar power calculation for the Learning Lab
  const solarFluxPct = Math.round((1 / (labDistanceAU * labDistanceAU)) * 1000) / 10;
  const solarWatts = Math.round(1350 * (1 / (labDistanceAU * labDistanceAU)));
  const nuclearWatts = 560;

  // Interactive Data Rate vs. Comms simulation
  const dataGeneratedGBDay = labInstruments * 24;
  const xBandCap = Number((25.9 / Math.pow(Math.max(0.15, labDistanceAU), 1.35)).toFixed(1));
  const kaBandCap = Number((320 / Math.pow(Math.max(0.15, labDistanceAU), 1.35)).toFixed(1));

  const distanceLabel =
    labDistanceAU <= 1.05
      ? 'Earth / Moon (1.0 AU)'
      : labDistanceAU <= 1.7
        ? 'Mars (1.52 AU)'
        : labDistanceAU <= 3.0
          ? 'Asteroid Belt (2.7 AU)'
          : 'Jupiter / Europa (5.2 AU)';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl border border-slate-700 bg-[#080c15] p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Space Mission Field Guide &amp; Learning Lab
              </h2>
              <div className="text-xs font-mono-tab text-slate-400">
                Interactive Physics Explorer · Plain-English Concepts · Difficulty Presets
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Field Guide"
            className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Segmented Sub-Navigation */}
        <div className="mt-4 flex items-center gap-1 border-b border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('lab')}
            className={`px-4 py-1.5 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'lab'
                ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200'
                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
            }`}
          >
            Interactive Science Lab
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('concepts')}
            className={`px-4 py-1.5 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'concepts'
                ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200'
                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
            }`}
          >
            Difficulty &amp; Trade-Off Guide
          </button>
        </div>

        <div className="aero-scroll mt-4 max-h-[65vh] overflow-y-auto space-y-6 pr-1">
          {activeTab === 'lab' ? (
            <div className="space-y-5">
              {/* Lab 1: Sunlight vs Distance + Data Rate vs Comms */}
              <div className="border border-slate-800 bg-slate-900/45 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      1. How Distance from Earth &amp; the Sun Affects Power and Communications
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Drag the distance slider to see why deep-space probes need nuclear power and big dishes.
                    </p>
                  </div>
                  <div className="text-xs font-mono-tab text-cyan-300">
                    {distanceLabel} · {labDistanceAU.toFixed(2)} AU
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono-tab text-slate-400 mb-1">
                    <span>Distance from Sun &amp; Earth: {labDistanceAU.toFixed(2)} AU</span>
                    <span>Sunlight Strength: {solarFluxPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={5.2}
                    step={0.1}
                    value={labDistanceAU}
                    onChange={(e) => setLabDistanceAU(parseFloat(e.target.value))}
                    className="aero-slider w-full"
                  />
                  <div className="mt-1 flex justify-between text-[10px] font-mono-tab text-slate-500">
                    <span>1.0 AU (Earth/Moon)</span>
                    <span>1.52 AU (Mars)</span>
                    <span>2.7 AU (Asteroids)</span>
                    <span>5.2 AU (Europa)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Power Visual Indicator */}
                  <div className="border border-slate-800 bg-slate-950/75 p-3.5 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Sun className="h-4 w-4 text-amber-400" />
                      <span>Power Generation: Solar vs. Nuclear</span>
                    </div>
                    <div className="space-y-2 text-[11px] font-mono-tab">
                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>Standard Solar Wings</span>
                          <span className={solarWatts >= 300 ? 'text-emerald-400' : 'text-rose-400'}>
                            {solarWatts} W ({solarFluxPct}% sun)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-800">
                          <div
                            className={`h-2 transition-all ${solarWatts >= 300 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                            style={{ width: `${Math.min(100, (solarWatts / 1350) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span>MMRTG Nuclear Battery</span>
                          <span className="text-cyan-300">{nuclearWatts} W (Constant)</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800">
                          <div
                            className="h-2 bg-cyan-400 transition-all"
                            style={{ width: `${(nuclearWatts / 1350) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      {labDistanceAU >= 2.5
                        ? 'At 2.5+ AU, sunlight spreads out so thinly (1/r² law) that standard solar panels can barely keep heaters warm—switching to MMRTG nuclear keeps power steady.'
                        : 'Near Earth and Mars, sunlight is strong enough that solar wings produce far more electricity per dollar than nuclear batteries.'}
                    </p>
                  </div>

                  {/* Data Rate & Comms Visual Indicator */}
                  <div className="border border-slate-800 bg-slate-950/75 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-cyan-400" />
                        <span>Data Rate vs. Antenna Downlink</span>
                      </span>
                      <span className="font-mono-tab text-[11px] text-cyan-300">
                        {labInstruments} Instruments ({dataGeneratedGBDay} GB/d)
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-mono-tab text-slate-400 mb-1">
                        <span>Science Instruments Mounted: {labInstruments}</span>
                        <span>Daily Data Created: {dataGeneratedGBDay} GB/day</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={4}
                        step={1}
                        value={labInstruments}
                        onChange={(e) => setLabInstruments(parseInt(e.target.value, 10))}
                        className="aero-slider w-full"
                      />
                    </div>

                    <div className="space-y-1.5 text-[11px] font-mono-tab">
                      <div className="flex justify-between">
                        <span className="text-slate-300">S-Band Omni Antenna:</span>
                        <span className={xBandCap >= dataGeneratedGBDay ? 'text-emerald-400' : 'text-rose-400'}>
                          {xBandCap} GB/d {xBandCap >= dataGeneratedGBDay ? '(OK)' : '(Bottleneck)'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">High-Gain Dish:</span>
                        <span className={kaBandCap >= dataGeneratedGBDay ? 'text-emerald-400' : 'text-amber-300'}>
                          {Math.min(320, kaBandCap)} GB/d {kaBandCap >= dataGeneratedGBDay ? '(OK)' : '(Tight)'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      {xBandCap < dataGeneratedGBDay
                        ? 'Adding more cameras creates more daily gigabytes; across deep space, a small patch antenna cannot empty the memory buffer fast enough, so a Ka-Band dish or Optical Laser is needed.'
                        : 'Close to Earth, even a compact antenna sends all your photos back every day.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Lab 2: Orbital Altitude & Payload Capacity Trade-off */}
              <div className="border border-slate-800 bg-slate-900/45 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      2. How Orbital Altitude Changes Science, Fuel (Δv), and Rocket Payload Capacity
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Compare orbit shapes to see why there is rarely one “perfect” orbit.
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {[
                      { id: 'low' as const, label: 'Low Circular Orbit' },
                      { id: 'elliptical' as const, label: 'High / Elliptical Orbit' },
                      { id: 'deep' as const, label: 'Deep Space Capture' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLabAltitudeMode(opt.id)}
                        className={`px-2.5 py-1 text-[11px] font-medium border cursor-pointer transition-colors ${
                          labAltitudeMode === opt.id
                            ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {labAltitudeMode === 'low' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs border border-slate-800 bg-slate-950/75 p-3.5">
                    <div>
                      <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <Rocket className="h-3.5 w-3.5" /> Science &amp; Coverage
                      </div>
                      <p className="mt-1 text-slate-300 leading-relaxed">
                        Flying close (100–550 km) gives super-sharp camera &amp; radar resolution over every crater.
                      </p>
                    </div>
                    <div>
                      <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" /> Power &amp; Eclipses
                      </div>
                      <p className="mt-1 text-slate-300 leading-relaxed">
                        The planet blocks the Sun up to 38% of each lap, so you need sturdy batteries and extra solar sizing.
                      </p>
                    </div>
                    <div>
                      <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                        <Compass className="h-3.5 w-3.5" /> Fuel &amp; Rocket Mass
                      </div>
                      <p className="mt-1 text-slate-300 leading-relaxed">
                        Braking all the way down into a tight circular orbit demands more Δv fuel, shrinking how much science weight fits.
                      </p>
                    </div>
                  </div>
                )}

                {labAltitudeMode === 'elliptical' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs border border-slate-800 bg-slate-950/75 p-3.5">
                    <div>
                      <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <Rocket className="h-3.5 w-3.5" /> Science &amp; Coverage
                      </div>
                      <p className="mt-1 text-slate-300 leading-relaxed">
                        Swoops close on one side for sharp measurements, then arcs wide to relay data back to Earth.
                      </p>
                    </div>
                    <div>
                      <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" /> Power &amp; Eclipses
                      </div>
                      <p className="mt-1 text-slate-300 leading-relaxed">
                        Spends less time in the planet’s shadow (~16–18%), keeping solar panels charging longer.
                      </p>
                    </div>
                    <div>
                      <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                        <Compass className="h-3.5 w-3.5" /> Fuel &amp; Rocket Mass
                      </div>
                      <p className="mt-1 text-slate-300 leading-relaxed">
                        Saves 0.4–0.7 km/s of braking fuel and increases rocket payload capacity, letting a medium booster do the job!
                      </p>
                    </div>
                  </div>
                )}

                {labAltitudeMode === 'deep' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs border border-slate-800 bg-slate-950/75 p-3.5">
                    <div>
                      <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <Rocket className="h-3.5 w-3.5" /> Radiation &amp; Lifetime
                      </div>
                      <p className="mt-1 text-slate-300 leading-relaxed">
                        Planets like Jupiter trap intense radiation belts—heavy shielding or multi-flyby orbits protect electronics from dying early.
                      </p>
                    </div>
                    <div>
                      <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" /> Payload Capacity Drop
                      </div>
                      <p className="mt-1 text-slate-300 leading-relaxed">
                        A rocket that lifts 6,200 kg to Low Earth Orbit can only throw ~1,180 kg out to Jupiter because escaping Earth’s gravity takes huge energy.
                      </p>
                    </div>
                    <div>
                      <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                        <Compass className="h-3.5 w-3.5" /> Why Ion Drives Shine
                      </div>
                      <p className="mt-1 text-slate-300 leading-relaxed">
                        Electric Ion Engines have 5–8× higher fuel efficiency (Isp), cutting total fuel weight so you can fit heavier shields and cameras.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Difficulty Selector */}
              <section>
                <div className="flex items-center gap-2 text-xs font-mono-tab uppercase tracking-wider text-slate-400 mb-2.5">
                  <Compass className="h-3.5 w-3.5 text-cyan-400" />
                  Select Engineering Difficulty
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {(['cadet', 'engineer', 'director', 'sandbox'] as DifficultyLevel[]).map((level) => {
                    const spec = DIFFICULTY_MODES[level];
                    const active = currentDifficulty === level || (level === 'cadet' && currentDifficulty === 'junior');
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => onSelectDifficulty(level)}
                        className={`text-left border p-3 transition-colors cursor-pointer ${
                          active
                            ? 'border-cyan-400 bg-cyan-950/35 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="text-xs font-semibold">{spec.label}</div>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                          {spec.tagline}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Resource Management Guide */}
              <section>
                <div className="text-xs font-mono-tab uppercase tracking-wider text-slate-400 mb-2.5">
                  Six Connected Mission Resources
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div className="border border-slate-800 bg-slate-900/50 p-3">
                    <div className="font-semibold text-cyan-300">1. Mass &amp; Payload</div>
                    <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                      Dry spacecraft + propellant must stay below your rocket’s lift limit for the chosen orbit.
                    </p>
                  </div>
                  <div className="border border-slate-800 bg-slate-900/50 p-3">
                    <div className="font-semibold text-cyan-300">2. Power &amp; Energy</div>
                    <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                      Solar or nuclear generation minus computer, heater, antenna, and sensor consumption.
                    </p>
                  </div>
                  <div className="border border-slate-800 bg-slate-900/50 p-3">
                    <div className="font-semibold text-cyan-300">3. Budget &amp; Funds</div>
                    <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                      Rocket launch price + spacecraft parts + propellant cost must fit within the agency cap.
                    </p>
                  </div>
                  <div className="border border-slate-800 bg-slate-900/50 p-3">
                    <div className="font-semibold text-cyan-300">4. Scientific Data</div>
                    <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                      Cameras and radars generate daily gigabytes that fill memory if not beamed home.
                    </p>
                  </div>
                  <div className="border border-slate-800 bg-slate-900/50 p-3">
                    <div className="font-semibold text-cyan-300">5. Communications Link</div>
                    <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                      Antenna gain and pointing accuracy determine how many GB/day reach Earth across millions of km.
                    </p>
                  </div>
                  <div className="border border-slate-800 bg-slate-900/50 p-3">
                    <div className="font-semibold text-cyan-300">6. Mission Lifetime &amp; Time</div>
                    <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                      How many months electronics survive space radiation and station-keeping fuel lasts.
                    </p>
                  </div>
                </div>
              </section>

              {/* Plain-English Concepts */}
              <section>
                <div className="text-xs font-mono-tab uppercase tracking-wider text-slate-400 mb-2.5">
                  Core Space Engineering Trade-Offs
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {CONCEPT_GUIDE.map((item) => (
                    <div
                      key={item.title}
                      className="border border-slate-800 bg-slate-900/50 p-3.5"
                    >
                      <div className="text-xs font-semibold text-cyan-300">{item.title}</div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                        {item.plainEnglish}
                      </p>
                      <p className="mt-2 text-[11px] font-mono-tab leading-relaxed text-amber-300/90">
                        Trade-off: {item.tradeOff}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* 4-Player Team Roles */}
              <section>
                <div className="flex items-center gap-2 text-xs font-mono-tab uppercase tracking-wider text-slate-400 mb-2.5">
                  <Users className="h-3.5 w-3.5 text-cyan-400" />
                  Team Responsibilities (1–4 Engineers)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(['director', 'propulsion', 'power', 'payload'] as EngineeringRole[]).map(
                    (role) => {
                      const meta = ROLE_META[role];
                      return (
                        <div
                          key={role}
                          className="border border-slate-800 bg-slate-900/50 p-3 text-xs"
                        >
                          <div className="font-semibold text-white">{meta.title}</div>
                          <div className="mt-0.5 text-slate-400">{meta.scope}</div>
                        </div>
                      );
                    },
                  )}
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="bg-cyan-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
          >
            Back to Mission Control
          </button>
        </div>
      </div>
    </div>
  );
}
