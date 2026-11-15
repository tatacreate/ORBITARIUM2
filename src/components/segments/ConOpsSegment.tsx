import { useState } from 'react';
import {
  Rocket,
  Orbit,
  Radio,
  FileCheck2,
  BookOpen,
  Award,
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
  csaChallenges,
  opsState,
  landmarks,
  groundTrackCoveragePct,
  onOpenDictionary,
  onNavigateSegment,
}: ConOpsSegmentProps) {
  const body = CELESTIAL_BODIES[selectedObjective.targetBody];
  const [cameraPreset, setCameraPreset] = useState<'hero' | 'satellite' | 'earth-view' | 'ground-station'>('hero');

  const activeInstruments = instruments.filter((i) => i.enabled);
  const totalPowerDrawW = activeInstruments.reduce((sum, i) => sum + i.powerDrawW, 0) + 120;
  const totalPowerGenW = orbitState.inEclipse ? 40 : 480;
  const downlinkedLandmarksCount = landmarks ? landmarks.filter((l) => l.downlinked).length : 0;

  return (
    <div className="space-y-4">
      {/* Top Banner: Master ConOps Overview */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-800 bg-[#080d19] p-4 shadow-xl">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-cyan-500/50 bg-cyan-950/40 px-2 py-0.5 font-mono-tab text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              NASA Master ConOps: Integrated Four-Segment Architecture
            </span>
            <span className="text-xs text-slate-400">
              Rank: <strong className="text-amber-300">{scorecard.missionRankBadge}</strong> · Index:{' '}
              <strong className="text-cyan-300">{scorecard.dynamicPerformanceScore}/100</strong> · CSA Ops: {csaChallenges.challengePoints}/90 pts
            </span>
          </div>
          <h2 className="mt-1 font-display text-xl md:text-2xl font-bold text-white">
            {selectedObjective.title} — Mission Control HUD
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Real-time synchronization across Launch, Space, Ground, and User Segments under NASA NPR 7120.5 with CSA collaboration.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenDictionary}
            className="flex items-center gap-1.5 border border-cyan-500/50 bg-cyan-950/40 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition-colors cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Mission Dictionary (Kid-Friendly)</span>
          </button>
        </div>
      </div>

      {/* Main 4-Segment Quick Access Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Segment 1: Launch */}
        <button
          type="button"
          onClick={() => onNavigateSegment('launch')}
          className="border border-slate-800 bg-slate-900/70 p-3.5 text-left hover:border-amber-500/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono-tab text-[10px] uppercase text-amber-400 group-hover:underline">
              Segment 1: Launch
            </span>
            <Rocket className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-1 font-display text-sm font-bold text-white">Orbital Injection Burn</div>
          <div className="mt-2 font-mono-tab text-[11px] text-slate-300 flex justify-between">
            <span>Status:</span>
            <span className={burnState.status === 'completed' ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
              {burnState.status.toUpperCase()}
            </span>
          </div>
          <div className="font-mono-tab text-[10px] text-slate-400 flex justify-between mt-0.5">
            <span>Delivered Δv:</span>
            <span>{burnState.deliveredDeltaVKms} / {burnState.targetDeltaVKms} km/s</span>
          </div>
        </button>

        {/* Segment 2: Space */}
        <button
          type="button"
          onClick={() => onNavigateSegment('space')}
          className="border border-slate-800 bg-slate-900/70 p-3.5 text-left hover:border-cyan-500/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono-tab text-[10px] uppercase text-cyan-400 group-hover:underline">
              Segment 2: Space
            </span>
            <Orbit className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-1 font-display text-sm font-bold text-white">Keplerian Orbiter</div>
          <div className="mt-2 font-mono-tab text-[11px] text-slate-300 flex justify-between">
            <span>Orbit:</span>
            <span className="text-cyan-300 font-bold">{orbitState.altitudeKm} km · {orbitState.inclinationDeg}°</span>
          </div>
          <div className="font-mono-tab text-[10px] text-slate-400 flex justify-between mt-0.5">
            <span>Active Sensors:</span>
            <span>{activeInstruments.length} / {instruments.length} Powered</span>
          </div>
        </button>

        {/* Segment 3: Ground */}
        <button
          type="button"
          onClick={() => onNavigateSegment('ground')}
          className="border border-slate-800 bg-slate-900/70 p-3.5 text-left hover:border-emerald-500/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono-tab text-[10px] uppercase text-emerald-400 group-hover:underline">
              Segment 3: Ground
            </span>
            <Radio className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1 font-display text-sm font-bold text-white">DSN &amp; Line-of-Sight</div>
          <div className="mt-2 font-mono-tab text-[11px] text-slate-300 flex justify-between">
            <span>Link Status:</span>
            <span className={groundComm.hasLineOfSight ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {groundComm.hasLineOfSight ? 'DOWNLINK ACTIVE' : 'BLACKOUT'}
            </span>
          </div>
          <div className="font-mono-tab text-[10px] text-slate-400 flex justify-between mt-0.5">
            <span>Total Returned:</span>
            <span>{Math.round(groundComm.totalDataDownlinkedGB)} GB</span>
          </div>
        </button>

        {/* Segment 4: User */}
        <button
          type="button"
          onClick={() => onNavigateSegment('user')}
          className="border border-slate-800 bg-slate-900/70 p-3.5 text-left hover:border-purple-500/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono-tab text-[10px] uppercase text-purple-400 group-hover:underline">
              Segment 4: User
            </span>
            <FileCheck2 className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-1 font-display text-sm font-bold text-white">Science &amp; Verification</div>
          <div className="mt-2 font-mono-tab text-[11px] text-slate-300 flex justify-between">
            <span>Surface Mapped:</span>
            <span className="text-purple-300 font-bold">{Math.round(groundTrackCoveragePct)}%</span>
          </div>
          <div className="font-mono-tab text-[10px] text-slate-400 flex justify-between mt-0.5">
            <span>Compliance:</span>
            <span className={scorecard.overallPass ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
              {scorecard.complianceScore}% ({scorecard.overallPass ? 'CERTIFIED' : 'DEFICIENT'})
            </span>
          </div>
        </button>
      </div>

      {/* Main Dual-Panel View: Full 3D Simulation Viewport & Live Telemetry Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: 3D Viewport (8 cols) */}
        <div className="lg:col-span-8 flex flex-col border border-slate-800 bg-slate-950 relative overflow-hidden h-[460px] lg:h-[520px]">
          {/* Viewport Top Bar */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-slate-950/90 to-transparent pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-2 font-mono-tab text-xs">
              <span className="font-bold text-white uppercase">{body.name} Orbital Simulation</span>
              <span className="text-slate-400">· True Anomaly: {orbitState.trueAnomalyDeg}°</span>
            </div>

            <div className="pointer-events-auto flex items-center gap-1 border border-slate-800/80 bg-slate-900/80 p-0.5 backdrop-blur">
              <button
                type="button"
                onClick={() => setCameraPreset('hero')}
                className={`px-2 py-0.5 font-mono-tab text-[10px] uppercase cursor-pointer ${
                  cameraPreset === 'hero' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-300'
                }`}
              >
                Hero
              </button>
              <button
                type="button"
                onClick={() => setCameraPreset('satellite')}
                className={`px-2 py-0.5 font-mono-tab text-[10px] uppercase cursor-pointer ${
                  cameraPreset === 'satellite' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-300'
                }`}
              >
                Sat
              </button>
              <button
                type="button"
                onClick={() => setCameraPreset('earth-view')}
                className={`px-2 py-0.5 font-mono-tab text-[10px] uppercase cursor-pointer ${
                  cameraPreset === 'earth-view' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-300'
                }`}
              >
                Polar
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

          {/* Bottom Telemetry Bar */}
          <div className="absolute bottom-0 left-0 right-0 z-10 grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent font-mono-tab text-[11px] text-slate-300 border-t border-slate-800/60 pointer-events-none">
            <div>
              <span className="text-slate-500 text-[10px] block">ORBIT VELOCITY</span>
              <strong className="text-cyan-300">{orbitState.orbitalSpeedKms} km/s</strong>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block">ORBIT PERIOD</span>
              <strong className="text-slate-200">{orbitState.periodMinutes} min</strong>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block">SUB-SAT LAT / LON</span>
              <strong className="text-slate-200">{orbitState.subSatLatDeg}° / {orbitState.subSatLonDeg}°</strong>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block">DSN LINE-OF-SIGHT</span>
              <span className={groundComm.hasLineOfSight ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {groundComm.hasLineOfSight ? 'ACQUIRED (DOWNLINK)' : 'PLANETARY BLACKOUT'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Live Telemetry Stream & Flight Readiness (4 cols) */}
        <div className="lg:col-span-4 border border-slate-800 bg-[#080d19] p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3 font-mono-tab">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-display text-xs font-bold uppercase tracking-wider text-white">
                Live Flight Telemetry Stream
              </span>
              <span className="flex items-center gap-1 font-mono-tab text-[10px] font-bold text-emerald-400">
                <Award className="h-3 w-3" />
                TELEMETRY ACTIVE
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Target Body &amp; Regime:</span>
                <span className="text-white font-bold">{body.name} ({selectedObjective.regime.toUpperCase()})</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Altitude / Apsides:</span>
                <span className="text-cyan-300 font-bold">
                  {orbitState.altitudeKm} km (Pe: {orbitState.periapsisKm} / Ap: {orbitState.apoapsisKm})
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Orbital Inclination (i):</span>
                <span className="text-cyan-300 font-bold">{orbitState.inclinationDeg}° (e = {orbitState.eccentricity})</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">DSN Doppler Drift:</span>
                <span className="text-amber-300 font-bold">
                  {groundComm.navTelemetry.dopplerShiftKhz >= 0
                    ? `+${groundComm.navTelemetry.dopplerShiftKhz}`
                    : groundComm.navTelemetry.dopplerShiftKhz}{' '}
                  kHz ({groundComm.navTelemetry.rangeRateKms} km/s)
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">J2 Nodal Precession:</span>
                <span className="text-emerald-400 font-bold">
                  {orbitState.perturbations.j2NodalPrecessionDegPerDay}°/day
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Power Net Margin:</span>
                <span className={totalPowerGenW >= totalPowerDrawW ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {totalPowerGenW - totalPowerDrawW >= 0 ? `+${totalPowerGenW - totalPowerDrawW}W` : `${totalPowerGenW - totalPowerDrawW}W`}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">SSR Data Buffer:</span>
                <span className="text-amber-300 font-bold">
                  {groundComm.bufferStoredGB.toFixed(1)} / {groundComm.bufferCapacityGB} GB
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Downlinked Science:</span>
                <span className="text-emerald-400 font-bold">
                  {Math.round(groundComm.totalDataDownlinkedGB)} / {selectedObjective.minScienceDataGB} GB
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Spacecraft Bus Health:</span>
                <span className="text-cyan-300 font-bold">
                  Bat {Math.round(opsState?.batteryPct ?? 88)}% · Hull {Math.round(opsState?.hullIntegrityPct ?? 100)}%
                </span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-slate-400">Surface &amp; Targets:</span>
                <span className="text-purple-300 font-bold">
                  {Math.round(groundTrackCoveragePct)}% swath ({downlinkedLandmarksCount}/{landmarks?.length ?? 5} targets)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Segment Jump Buttons */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="font-display text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Jump To Segment Controller
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => onNavigateSegment('launch')}
                className="border border-slate-700 bg-slate-800 p-2 text-slate-200 hover:bg-slate-700 text-left cursor-pointer"
              >
                1. Launch &amp; Δv
              </button>
              <button
                type="button"
                onClick={() => onNavigateSegment('space')}
                className="border border-slate-700 bg-slate-800 p-2 text-slate-200 hover:bg-slate-700 text-left cursor-pointer"
              >
                2. Space &amp; Orbit
              </button>
              <button
                type="button"
                onClick={() => onNavigateSegment('ground')}
                className="border border-slate-700 bg-slate-800 p-2 text-slate-200 hover:bg-slate-700 text-left cursor-pointer"
              >
                3. Ground &amp; DSN
              </button>
              <button
                type="button"
                onClick={() => onNavigateSegment('user')}
                className="border border-slate-700 bg-slate-800 p-2 text-slate-200 hover:bg-slate-700 text-left cursor-pointer"
              >
                4. User &amp; Verify
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
