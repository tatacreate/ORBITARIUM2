import { useState } from 'react';
import {
  BatteryCharging,
  BookOpen,
  Compass,
  Orbit,
  Radio,
  Rocket,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { CELESTIAL_BODIES } from '../../engine/orbitalMechanics';
import { NasaOrbitalScene } from '../../three/NasaOrbitalScene';
import type {
  CsaChallengeState,
  GroundCommState,
  LaunchBurnState,
  NasaInstrument,
  NasaObjectiveSpec,
  OrbitalState,
  SpacecraftOpsState,
  SurfaceLandmark,
  SystemVerificationScorecard,
} from '../../types/nasaSegments';

interface ConOpsSegmentProps {
  selectedObjective: NasaObjectiveSpec;
  orbitState: OrbitalState;
  burnState: LaunchBurnState;
  groundComm: GroundCommState;
  instruments: NasaInstrument[];
  scorecard: SystemVerificationScorecard;
  csaChallenges: CsaChallengeState;
  opsState?: SpacecraftOpsState;
  landmarks?: SurfaceLandmark[];
  groundTrackCoveragePct: number;
  onOpenDictionary: () => void;
  onNavigateSegment: (segment: 'setup' | 'launch' | 'space' | 'ground' | 'user') => void;
}

export function ConOpsSegment({
  selectedObjective,
  orbitState,
  burnState,
  groundComm,
  instruments,
  scorecard,
  opsState,
  landmarks,
  onOpenDictionary,
  onNavigateSegment,
}: ConOpsSegmentProps) {
  const body = CELESTIAL_BODIES[selectedObjective.targetBody];
  const [cameraPreset, setCameraPreset] = useState<'hero' | 'satellite' | 'earth-view' | 'ground-station'>('hero');

  const activeInstruments = instruments.filter((i) => i.enabled);
  const downlinkedLandmarksCount = landmarks ? landmarks.filter((l) => l.downlinked).length : 0;
  const totalLandmarksCount = landmarks?.length ?? 5;
  const batteryPct = Math.round(opsState?.batteryPct ?? 88);
  const hullPct = Math.round(opsState?.hullIntegrityPct ?? 100);

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-800 bg-[#080d19] p-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
            <Compass className="h-4 w-4" />
            <span>3D Planet &amp; Satellite View</span>
          </div>
          <h2 className="mt-0.5 font-display text-xl md:text-2xl font-bold text-white">
            Live {body.name} Mission Globe
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Watch your spacecraft fly around {body.name} in 3D, or jump straight to any mission mini-game below!
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenDictionary}
          className="flex items-center gap-1.5 border border-cyan-500/50 bg-cyan-950/40 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition-colors cursor-pointer"
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Space Words Guide</span>
        </button>
      </div>

      {/* 4 Colorful Jump Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => onNavigateSegment('launch')}
          className="border border-slate-800 bg-slate-900/75 p-3.5 text-left hover:border-amber-400 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-bold text-amber-300">
            <span>1. Rocket Launch</span>
            <Rocket className="h-4 w-4" />
          </div>
          <div className="mt-1 font-display text-sm font-bold text-white">Blast Into Orbit</div>
          <div className="mt-1.5 text-xs text-slate-300">
            Status:{' '}
            <strong className={burnState.status === 'completed' ? 'text-emerald-400' : 'text-amber-300'}>
              {burnState.status === 'completed' ? 'In Space!' : 'Ready on Pad'}
            </strong>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSegment('space')}
          className="border border-slate-800 bg-slate-900/75 p-3.5 text-left hover:border-cyan-400 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
            <span>2. Space Piloting</span>
            <Orbit className="h-4 w-4" />
          </div>
          <div className="mt-1 font-display text-sm font-bold text-white">Slingshot, Claw &amp; Snap</div>
          <div className="mt-1.5 text-xs text-slate-300">
            Gadgets ON: <strong className="text-cyan-300">{activeInstruments.length} / {instruments.length}</strong>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSegment('ground')}
          className="border border-slate-800 bg-slate-900/75 p-3.5 text-left hover:border-emerald-400 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
            <span>3. Dish Laser Link</span>
            <Radio className="h-4 w-4" />
          </div>
          <div className="mt-1 font-display text-sm font-bold text-white">Beam Photos Home</div>
          <div className="mt-1.5 text-xs text-slate-300">
            Sky Signal:{' '}
            <strong className={groundComm.hasLineOfSight ? 'text-emerald-400' : 'text-amber-300'}>
              {groundComm.hasLineOfSight ? 'Connected' : 'Behind Planet'}
            </strong>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSegment('user')}
          className="border border-slate-800 bg-slate-900/75 p-3.5 text-left hover:border-purple-400 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-bold text-purple-300">
            <span>4. Discovery Gallery</span>
            <Trophy className="h-4 w-4" />
          </div>
          <div className="mt-1 font-display text-sm font-bold text-white">Photos &amp; Star Rewards</div>
          <div className="mt-1.5 text-xs text-slate-300">
            Unlocked:{' '}
            <strong className="text-purple-300">
              {downlinkedLandmarksCount} / {totalLandmarksCount} Cards
            </strong>
          </div>
        </button>
      </div>

      {/* Main 3D Planet Globe + Plain-English Spacecraft Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 flex flex-col border border-slate-800 bg-slate-950 relative overflow-hidden h-[450px] lg:h-[500px]">
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-slate-950/90 to-transparent pointer-events-none">
            <div className="pointer-events-auto text-xs font-bold text-white">
              {body.name} Live 3D Orbit
            </div>

            <div className="pointer-events-auto flex items-center gap-1 border border-slate-800/80 bg-slate-900/80 p-0.5 backdrop-blur">
              <button
                type="button"
                onClick={() => setCameraPreset('hero')}
                className={`px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                  cameraPreset === 'hero' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300'
                }`}
              >
                Planet View
              </button>
              <button
                type="button"
                onClick={() => setCameraPreset('satellite')}
                className={`px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                  cameraPreset === 'satellite' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300'
                }`}
              >
                Craft Cam
              </button>
              <button
                type="button"
                onClick={() => setCameraPreset('earth-view')}
                className={`px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                  cameraPreset === 'earth-view' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300'
                }`}
              >
                Top View
              </button>
            </div>
          </div>

          <div className="flex-1 w-full h-full">
            <NasaOrbitalScene
              targetBody={selectedObjective.targetBody}
              orbitState={orbitState}
              hasLineOfSight={groundComm.hasLineOfSight}
              activeStationId={groundComm.activeStationId}
              activeInstrumentsCount={activeInstruments.length}
              isBurning={burnState.status === 'burning'}
              cameraPreset={cameraPreset}
              solarPanelAngleDeg={opsState?.solarPanelAngleDeg}
              radiationAlert={opsState?.activeHazard?.type === 'solar-flare'}
              debrisAlert={opsState?.activeHazard?.type === 'debris'}
            />
          </div>
        </div>

        {/* Right: Simple Plain-English Live Craft Card */}
        <div className="lg:col-span-4 border border-slate-800 bg-[#080d19] p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h3 className="font-display text-sm font-bold text-white border-b border-slate-800 pb-2">
              Spacecraft Health &amp; Loot
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <BatteryCharging className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Battery</span>
                </div>
                <div className="mt-1 font-display text-lg font-bold text-cyan-300">{batteryPct}%</div>
              </div>

              <div className="border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Craft Health</span>
                </div>
                <div className="mt-1 font-display text-lg font-bold text-emerald-300">{hullPct}%</div>
              </div>

              <div className="border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Radio className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Laser Link</span>
                </div>
                <div
                  className={`mt-1 font-display text-sm font-bold ${
                    groundComm.hasLineOfSight ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {groundComm.hasLineOfSight ? 'Clear Sky!' : 'Blocked'}
                </div>
              </div>

              <div className="border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  <span>Discoveries</span>
                </div>
                <div className="mt-1 font-display text-lg font-bold text-amber-300">
                  {downlinkedLandmarksCount}/{totalLandmarksCount}
                </div>
              </div>
            </div>

            <div className="border border-slate-800 bg-slate-900/50 p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Height Above {body.name}</span>
                <strong className="text-white">{orbitState.altitudeKm} km</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Commander Rank</span>
                <strong className="text-amber-300">{scorecard.missionRankBadge}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Canadarm3 Grabs</span>
                <strong className="text-cyan-300">{opsState?.canadarm.completedCount ?? 0}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateSegment('setup')}
            className="w-full border border-cyan-500/40 bg-cyan-950/35 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-900/50 cursor-pointer"
          >
            Pick a Different Planet Mission
          </button>
        </div>
      </div>
    </div>
  );
}
