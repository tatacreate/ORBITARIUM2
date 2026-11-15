import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Lock,
  RotateCcw,
  Star,
  Trophy,
} from 'lucide-react';
import { getArtworkForBodyAndRegime, getFriendlyLandmarkFact } from '../../data/discoveryArt';
import { CELESTIAL_BODIES } from '../../engine/orbitalMechanics';
import type {
  CsaChallengeState,
  DiscoveryCard,
  GmatTelemetrySample,
  GroundCommState,
  LaunchBurnState,
  NasaInstrument,
  NasaObjectiveSpec,
  OrbitalState,
  SpacecraftOpsState,
  SurfaceLandmark,
  SystemVerificationScorecard,
} from '../../types/nasaSegments';

interface UserSegmentProps {
  selectedObjective: NasaObjectiveSpec;
  orbitState: OrbitalState;
  burnState: LaunchBurnState;
  groundComm: GroundCommState;
  instruments: NasaInstrument[];
  scorecard: SystemVerificationScorecard;
  discoveryCards: DiscoveryCard[];
  csaChallenges: CsaChallengeState;
  opsState: SpacecraftOpsState;
  landmarks: SurfaceLandmark[];
  groundTrackCoveragePct: number;
  scannedTiles: Set<string>;
  telemetryHistory: GmatTelemetrySample[];
  onResetMission: () => void;
  onGoToConOps: () => void;
  onPrevSegment: () => void;
}

export function UserSegment({
  selectedObjective,
  burnState,
  groundComm,
  discoveryCards,
  opsState,
  landmarks,
  onResetMission,
  onGoToConOps,
  onPrevSegment,
}: UserSegmentProps) {
  const body = CELESTIAL_BODIES[selectedObjective.targetBody];
  const [filterMode, setFilterMode] = useState<'all' | 'unlocked'>('all');

  const capturedCount = landmarks.filter((l) => l.captured).length;
  const downlinkedCount = landmarks.filter((l) => l.downlinked).length;
  const heritageUnlockedCount = discoveryCards.filter((c) => c.unlocked).length;

  const reachedOrbit = burnState.status === 'completed';
  const snappedPhotos = capturedCount > 0;
  const beamedHome = downlinkedCount > 0 || groundComm.totalDataDownlinkedGB >= 40;
  const robotBonus = opsState.canadarm.completedCount > 0 || opsState.hazardsSurvived > 0;

  // Star rating 1..3
  const starCount: 1 | 2 | 3 =
    downlinkedCount >= 3 && reachedOrbit && robotBonus
      ? 3
      : downlinkedCount >= 1 || capturedCount >= 2
        ? 2
        : 1;

  const commanderTitle =
    starCount === 3
      ? 'Galactic Legend!'
      : starCount === 2
        ? 'Star Voyager!'
        : 'Space Explorer';

  const visibleLandmarks =
    filterMode === 'unlocked' ? landmarks.filter((l) => l.downlinked || l.captured) : landmarks;

  const missionSteps = [
    {
      label: 'Blasted Into Orbit',
      done: reachedOrbit,
      detail: reachedOrbit ? 'Rocket reached space!' : 'Finish Step 1 Launch',
    },
    {
      label: 'Snapped Planet Photos',
      done: snappedPhotos,
      detail: `${capturedCount} of ${landmarks.length} snapped`,
    },
    {
      label: 'Beamed Data Home',
      done: beamedHome,
      detail: `${downlinkedCount} sent by laser dish`,
    },
    {
      label: 'Robot Claw & Hazards',
      done: robotBonus,
      detail: robotBonus ? `${opsState.canadarm.completedCount} grabs · ${opsState.hazardsSurvived} dodges` : 'Try Canadarm3 in Space!',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Celebration Star Hero Banner */}
      <div className="relative overflow-hidden border border-cyan-500/40 bg-gradient-to-br from-[#081326] via-[#0b1b36] to-[#08101f] p-5 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Trophy className="h-4 w-4" />
              <span>Step 4 · Discovery Gallery &amp; Mission Rewards</span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white">
              {body.name} Discovery Album — {commanderTitle}
            </h2>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
              {starCount === 3
                ? 'Amazing flying! You launched into space, snapped planetary discoveries, steered Canadarm3, and beamed them straight back to Earth!'
                : 'Every photo you snap in Space and beam down with the Laser Dish unlocks a colorful Discovery Card below!'}
            </p>
          </div>

          {/* Glowing 1–3 Star Showcase */}
          <div className="flex flex-col items-center gap-1.5 border border-amber-400/40 bg-slate-950/75 px-5 py-3">
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((idx) => {
                const earned = idx <= starCount;
                return (
                  <Star
                    key={idx}
                    className={`h-8 w-8 transition-transform ${
                      earned
                        ? 'fill-amber-400 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.75)] scale-105'
                        : 'text-slate-700'
                    }`}
                  />
                );
              })}
            </div>
            <span className="font-display text-xs font-bold text-amber-300">
              {starCount} / 3 Mission Stars
            </span>
          </div>
        </div>

        {/* Simple 4-Step Mission Checklist */}
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {missionSteps.map((step) => (
            <div
              key={step.label}
              className={`border p-3 flex items-center gap-2.5 ${
                step.done
                  ? 'border-emerald-500/50 bg-emerald-950/30'
                  : 'border-slate-800 bg-slate-900/60'
              }`}
            >
              <CheckCircle2
                className={`h-5 w-5 shrink-0 ${step.done ? 'text-emerald-400' : 'text-slate-600'}`}
              />
              <div>
                <div className="text-xs font-bold text-white">{step.label}</div>
                <div className="text-[11px] text-slate-300">{step.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Navigation */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevSegment}
              className="flex items-center gap-1 border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Laser Dish</span>
            </button>
            <button
              type="button"
              onClick={onResetMission}
              className="flex items-center gap-1.5 border border-cyan-500/40 bg-cyan-950/40 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-900/60 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Play New Planet Mission</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onGoToConOps}
            className="flex items-center gap-1.5 bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 cursor-pointer"
          >
            <span>Open 3D Planet View</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Illustrated Discovery Gallery Grid */}
      <div className="border border-slate-800 bg-[#080d19] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-white">
              {body.name} Photo Discoveries ({downlinkedCount}/{landmarks.length} Unlocked)
            </h3>
            <p className="text-xs text-slate-400">
              Snap photos in Space and beam them through the Laser Dish to reveal every illustration!
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 font-bold border cursor-pointer ${
                filterMode === 'all'
                  ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              All ({landmarks.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unlocked')}
              className={`px-3 py-1 font-bold border cursor-pointer ${
                filterMode === 'unlocked'
                  ? 'border-emerald-400 bg-emerald-400 text-slate-950'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              Unlocked ({capturedCount})
            </button>
          </div>
        </div>

        {visibleLandmarks.length === 0 ? (
          <div className="border border-slate-800 bg-slate-900/50 p-6 text-center text-xs text-slate-300">
            No discoveries snapped yet! Jump to <strong>2. Space</strong> and hit <strong>SNAP PHOTO!</strong> when your scanner passes over a glowing ring.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleLandmarks.map((lm) => {
              const info = getFriendlyLandmarkFact(lm);
              const artSrc = getArtworkForBodyAndRegime(
                selectedObjective.targetBody,
                selectedObjective.regime,
                lm.id,
              );
              const unlocked = lm.downlinked;
              const inMemory = lm.captured && !lm.downlinked;

              return (
                <div
                  key={lm.id}
                  className={`border overflow-hidden flex flex-col justify-between transition-all ${
                    unlocked
                      ? 'border-emerald-400/60 bg-slate-900/90 shadow-lg'
                      : inMemory
                        ? 'border-amber-400/55 bg-slate-900/80'
                        : 'border-slate-800 bg-slate-950/80'
                  }`}
                >
                  {/* Discovery Artwork */}
                  <div className="relative h-40 w-full overflow-hidden bg-slate-950">
                    <img
                      src={artSrc}
                      alt={info.shortName}
                      referrerPolicy="no-referrer"
                      className={`h-full w-full object-cover transition-all duration-300 ${
                        unlocked
                          ? 'brightness-105 saturate-110'
                          : inMemory
                            ? 'brightness-75 contrast-110'
                            : 'brightness-40 grayscale blur-[2px]'
                      }`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

                    {/* Top status badge */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-bold ${
                          unlocked
                            ? 'bg-emerald-400 text-slate-950'
                            : inMemory
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-900/90 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {unlocked
                          ? 'UNLOCKED!'
                          : inMemory
                            ? 'BEAM IN STEP 3!'
                            : 'SNAP IN STEP 2'}
                      </span>

                      <div className="flex items-center gap-0.5 bg-slate-950/80 px-1.5 py-0.5">
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            className={`h-3.5 w-3.5 ${
                              unlocked && s <= info.stars
                                ? 'fill-amber-400 text-amber-300'
                                : 'text-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="absolute bottom-2.5 left-3 right-3">
                      <h4 className="font-display text-base font-bold text-white drop-shadow">
                        {info.shortName}
                      </h4>
                    </div>
                  </div>

                  {/* Fun 1-Sentence Science Fact */}
                  <div className="p-3.5 text-xs text-slate-200 leading-relaxed">
                    {unlocked ? (
                      info.funFact
                    ) : inMemory ? (
                      <span className="text-amber-200">
                        Photo saved on your satellite! Go to <strong>3. Ground</strong> and click{' '}
                        <strong>Beam Photo Home</strong> to unlock this card!
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        Fly over this target in <strong>2. Space</strong> and hit <strong>SNAP PHOTO!</strong> to see what’s hiding here.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Real Space Badges (NASA & Canadian Space Agency) */}
      <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-400" />
            <h3 className="font-display text-sm font-bold text-white">
              Real NASA &amp; Canada Space Badges ({heritageUnlockedCount}/{discoveryCards.length})
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {discoveryCards.map((card) => (
            <div
              key={card.id}
              className={`border p-3.5 flex flex-col justify-between ${
                card.unlocked
                  ? 'border-cyan-400/55 bg-cyan-950/20'
                  : 'border-slate-800 bg-slate-900/45 opacity-80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className={card.unlocked ? 'font-bold text-amber-300' : 'text-slate-400'}>
                    {card.agency}
                  </span>
                  {card.unlocked ? (
                    <span className="flex items-center gap-1 font-bold text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Earned
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-400">
                      <Lock className="h-3 w-3" /> Locked
                    </span>
                  )}
                </div>
                <h4 className="mt-1 font-display text-sm font-bold text-white">{card.title}</h4>
                <p className="mt-1 text-xs text-slate-300 leading-relaxed">{card.fact}</p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px]">
                {card.unlocked ? (
                  <span className="text-cyan-300">Real Mission: {card.realMission}</span>
                ) : (
                  <span className="text-amber-300">How to unlock: {card.unlockRequirement}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
