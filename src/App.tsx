import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  ArrowLeft,
  BookOpen,
  Orbit,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { audioSynth } from './audio/synth';
import { AstraAdvisor } from './components/AstraAdvisor';
import { MissionArchiveModal } from './components/MissionArchiveModal';
import { MissionDictionaryModal } from './components/MissionDictionaryModal';
import { MissionGuideModal } from './components/MissionGuideModal';
import { Phase1Briefing } from './components/Phase1Briefing';
import { Phase2AssemblyBay } from './components/Phase2AssemblyBay';
import { Phase3LaunchPlanner } from './components/Phase3LaunchPlanner';
import { Phase4Simulation, type SimTelemetrySample } from './components/Phase4Simulation';
import { Phase5Debrief } from './components/Phase5Debrief';
import { PhaseHeader } from './components/PhaseHeader';
import { TeamRoomModal } from './components/TeamRoomModal';
import { TitleScreen } from './components/TitleScreen';

import { UnifiedMissionCanvas, type UnifiedGameSnapshot } from './game/UnifiedMissionCanvas';
import { UNIFIED_MISSIONS } from './game/missions';

import { DEFAULT_MISSION_CONFIG, OBJECTIVES } from './data/catalog';
import {
  CELESTIAL_BODIES,
  G0,
  GROUND_STATIONS,
  NASA_INSTRUMENTS,
  NASA_OBJECTIVES,
  NASA_ROCKETS,
  SPEED_OF_LIGHT_KMS,
  calculateOrbitalPeriodMinutes,
  calculateTargetDeltaV,
  checkLineOfSight,
  computeCanadarmEndEffector,
  computeDishAlignmentLock,
  evaluateDiscoveryCards,
  evaluateSystemsVerification,
  getSurfaceLandmarksForObjective,
  propagateOrbitStep,
} from './engine/orbitalMechanics';
import {
  buildTradeOffPopup,
  computeTelemetry,
  evaluateSimulationOutcome,
  generateFlightAnomalies,
} from './engine/physics';
import { auth } from './firebase';
import {
  completeRoomSimulation,
  createCollaborativeRoom,
  ensureUserProfile,
  iterateRoomDesign,
  joinCollaborativeRoom,
  publishLeaderboardEntry,
  saveMissionRecord,
  sendRoomMessage,
  signInWithGoogle,
  signOutUser,
  startRoomSimulation,
  subscribeRoom,
  updateMemberSeat,
  updateRoomConfig,
} from './services/missionService';
import { SpacecraftScene } from './three/SpacecraftScene';
import type {
  AnomalyChoice,
  BuilderCategory,
  CameraPreset,
  DifficultyLevel,
  EngineeringRole,
  FlightAnomaly,
  GamePhase,
  MissionArchetype,
  MissionChallengeMode,
  MissionConfig,
  RoomMember,
  RoomMessage,
  RoomState,
  SimulationOutcome,
  SubsystemTab,
  TradeOffPopup,
} from './types/mission';
import type {
  ActiveHazard,
  ArchitectMode,
  CanadarmTargetType,
  CsaChallengeState,
  GmatTelemetrySample,
  GroundCommState,
  LaunchBurnState,
  NasaInstrument,
  NasaMissionSegment,
  NasaObjectiveSpec,
  OrbitalState,
  PropulsionType,
  SpacecraftOpsState,
  SurfaceLandmark,
} from './types/nasaSegments';

const INITIAL_CSA_CHALLENGES: CsaChallengeState = {
  polarRadarCaptured: false,
  debrisAlertActive: false,
  debrisAvoidedCount: 0,
  solarArraysAligned: false,
  challengePoints: 0,
  lastChallengeFeedback: null,
};

function angleDiffDeg(a: number, b: number): number {
  const diff = ((a - b + 540) % 360) - 180;
  return Math.abs(diff);
}

function createInitialOpsState(): SpacecraftOpsState {
  return {
    batteryPct: 88,
    solarPanelAngleDeg: 25,
    sunAngleDeg: 35,
    shieldAngleDeg: 35,
    radiationDosePct: 8,
    hullIntegrityPct: 100,
    sensorSlewOffsetDeg: 0,
    canadarm: {
      shoulderDeg: 78,
      elbowDeg: -42,
      wristDeg: 18,
      clampClosed: false,
      targetType: 'cubesat',
      targetX: 0.44,
      targetY: 0.62,
      targetAngleDeg: 0,
      driftVx: 0.014,
      driftVy: -0.011,
      completedCount: 0,
      lastOpFeedback: null,
    },
    activeHazard: null,
    hazardsSurvived: 0,
    hazardsFailed: 0,
    lastManeuverAccuracyPct: 90,
  };
}

export default function App() {
  // Top-level App View: Homepage ('title'), Primary NASA/GMAT/CSA Architect ('nasa-architect'), or Classic 3D Team Hangar ('classic-hangar')
  const [appView, setAppView] = useState<'title' | 'nasa-architect' | 'classic-hangar'>('title');
  const [currentNasaSegment, setCurrentNasaSegment] = useState<NasaMissionSegment>('setup');
  const [architectMode, setArchitectMode] = useState<ArchitectMode>('cadet');

  // NASA, GMAT & CSA Mission Architect State
  const [selectedObjective, setSelectedObjective] = useState<NasaObjectiveSpec>(NASA_OBJECTIVES[0]);
  const [selectedRocket, setSelectedRocket] = useState(NASA_ROCKETS[1]);
  const [selectedPropulsion, setSelectedPropulsion] = useState<PropulsionType>('chemical');
  const [propellantBudgetKg, setPropellantBudgetKg] = useState<number>(NASA_OBJECTIVES[0].propellantBudgetKg);
  const [nasaInstruments, setNasaInstruments] = useState<NasaInstrument[]>(NASA_INSTRUMENTS);
  const [csaChallenges, setCsaChallenges] = useState<CsaChallengeState>(INITIAL_CSA_CHALLENGES);

  // GMAT Telemetry Time-Series Samples
  const [telemetryHistory, setTelemetryHistory] = useState<GmatTelemetrySample[]>([
    {
      timestampSec: 0,
      altitudeKm: 550,
      orbitalSpeedKms: 7.58,
      propellantRemainingKg: NASA_OBJECTIVES[0].propellantBudgetKg,
      eccentricity: 0.001,
      downlinkRateMbps: 120,
    },
  ]);

  const initialTargetDv = calculateTargetDeltaV('earth', 550, 'leo');
  const [burnState, setBurnState] = useState<LaunchBurnState>({
    status: 'completed',
    throttlePct: 100,
    burnDurationSec: 180,
    targetDeltaVKms: initialTargetDv,
    deliveredDeltaVKms: initialTargetDv,
    propellantUsedKg: 280,
    outcomeType: 'nominal',
    outcomeSummary: 'Nominal Orbital Injection: Delivered clean insertion into stable circular parking orbit.',
  });

  const [orbitState, setOrbitState] = useState<OrbitalState>({
    altitudeKm: 550,
    periapsisKm: 545,
    apoapsisKm: 555,
    eccentricity: 0.001,
    inclinationDeg: 97.6,
    semiMajorAxisKm: 6371 + 550,
    periodMinutes: calculateOrbitalPeriodMinutes('earth', 550, 0.001),
    orbitalSpeedKms: 7.58,
    trueAnomalyDeg: 45,
    raanDeg: 45.0,
    argPeriapsisDeg: 90.0,
    subSatLatDeg: 28.5,
    subSatLonDeg: -80.6,
    inEclipse: false,
    perturbations: {
      j2NodalPrecessionDegPerDay: -0.985,
      j2ApsidalDriftDegPerDay: -3.24,
      atmosphericDragDecayKmPerDay: 0.002,
      solarRadiationPressureScale: 1.0,
    },
  });

  const [opsState, setOpsState] = useState<SpacecraftOpsState>(() => createInitialOpsState());
  const [landmarks, setLandmarks] = useState<SurfaceLandmark[]>(() =>
    getSurfaceLandmarksForObjective(NASA_OBJECTIVES[0]),
  );
  const [manualStationId, setManualStationId] = useState<string | null>(null);

  const [groundComm, setGroundComm] = useState<GroundCommState>({
    activeStationId: 'dsn-goldstone',
    hasLineOfSight: true,
    elevationAngleDeg: 42.0,
    distanceKm: 850,
    downlinkActive: true,
    currentDownlinkMbps: 120,
    isBlackout: false,
    bufferStoredGB: 12.4,
    bufferCapacityGB: 128,
    totalDataDownlinkedGB: 76.5,
    dishAzimuthDeg: 135.2,
    dishElevationDeg: 42.0,
    dishLockQualityPct: 96,
    bandMode: 'Ka-Band',
    allocatedBandwidthPct: 100,
    servoAssistEnabled: false,
    passTimeRemainingSec: 210,
    totalPassContacts: 1,
    navTelemetry: {
      carrierFreqGhz: 32.05,
      rangeKm: 850,
      rangeRateKms: 3.2,
      dopplerShiftKhz: -342.1,
      azimuthDeg: 135.2,
      elevationDeg: 42.0,
      signalStrengthDbm: -82,
    },
  });

  // Tracked Scanned Grid Tiles on 2D Equirectangular map (36 lon columns x 18 lat rows = 648 total cells)
  const [scannedTiles, setScannedTiles] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (let c = 8; c < 28; c++) {
      initial.add(`${c}:${Math.round(9 + 4 * Math.sin((c / 36) * Math.PI * 2))}`);
      initial.add(`${c}:${Math.round(9 + 5 * Math.sin((c / 36) * Math.PI * 2))}`);
    }
    return initial;
  });

  // Simulation Clock & Speed Controls
  const [isSimPaused, setIsSimPaused] = useState(false);
  const [simSpeedMult, setSimSpeedMult] = useState<number>(1);
  const [missionElapsedSec, setMissionElapsedSec] = useState<number>(142500);
  const [unifiedSnapshot, setUnifiedSnapshot] = useState<UnifiedGameSnapshot>({
    missionId: 'earth-climate',
    phase: 'briefing',
    fuelPct: 100,
    hullPct: 100,
    orbsCollected: 0,
    orbsBeamed: 0,
    orbGoal: 3,
    activeThreat: 'none',
    starsEarned: 3,
  });
  const [briefingRequest, setBriefingRequest] = useState<{ phase: 'briefing'; nonce: number } | null>(null);

  // Modals & UI Controls
  const [muted, setMuted] = useState(false);
  const [showDictionaryModal, setShowDictionaryModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [toastError, setToastError] = useState<string | null>(null);

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Classic 3D Collaborative Hangar State (used on TitleScreen backdrop + 1-4 Player Team Rooms)
  const [classicPhase, setClassicPhase] = useState<GamePhase>('briefing');
  const [classicConfig, setClassicConfig] = useState<MissionConfig>(DEFAULT_MISSION_CONFIG);
  const [soloRole, setSoloRole] = useState<EngineeringRole>('director');
  const [activeCategory, setActiveCategory] = useState<BuilderCategory>('bus');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [explodeAmount, setExplodeAmount] = useState(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('hero');
  const [cameraPresetNonce, setCameraPresetNonce] = useState(0);
  const [tradeOffPopup, setTradeOffPopup] = useState<TradeOffPopup | null>(null);
  const [soloRunCount, setSoloRunCount] = useState(1);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [classicSimProgress, setClassicSimProgress] = useState(0);
  const [classicSimSpeed, setClassicSimSpeed] = useState<1 | 2>(1);
  const [classicSimSeed, setClassicSimSeed] = useState(1042);
  const [classicAnomalies, setClassicAnomalies] = useState<FlightAnomaly[]>([]);
  const [resolvedAnomalyIds, setResolvedAnomalyIds] = useState<string[]>([]);
  const [activeAnomaly, setActiveAnomaly] = useState<FlightAnomaly | null>(null);
  const [chosenActions, setChosenActions] = useState<
    { scienceDelta: number; marginDelta: number; collabDelta: number; powerShiftW?: number; dataShiftPct?: number }[]
  >([]);
  const [simSamples, setSimSamples] = useState<SimTelemetrySample[]>([]);
  const [outcome, setOutcome] = useState<SimulationOutcome | null>(null);
  const [savedMissionId, setSavedMissionId] = useState<string | null>(null);
  const [savingMission, setSavingMission] = useState(false);
  const [publishedLeaderboardId, setPublishedLeaderboardId] = useState<string | null>(null);
  const [publishingLeaderboard, setPublishingLeaderboard] = useState(false);

  const classicTelemetry = useMemo(() => computeTelemetry(classicConfig), [classicConfig]);
  const tradeOffTimerRef = useRef<number | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        void ensureUserProfile(nextUser).catch(() => {});
      }
    });
    return () => unsub();
  }, []);

  // Keyboard shortcut: Enter on TitleScreen launches Mission Architect
  useEffect(() => {
    if (appView !== 'title') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        !showTeamModal &&
        !showArchiveModal &&
        !showGuideModal &&
        !showDictionaryModal
      ) {
        audioSynth.playSelect();
        setAppView('nasa-architect');
        setCurrentNasaSegment('setup');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [appView, showTeamModal, showArchiveModal, showGuideModal, showDictionaryModal]);

  // Room Listener & Synchronization for Collaborative Hangar
  useEffect(() => {
    if (!authReady || !user || !roomId) return;
    const unsub = subscribeRoom(
      roomId,
      (nextRoom) => {
        if (!nextRoom) {
          setRoomId(null);
          setRoomState(null);
          return;
        }
        setRoomState(nextRoom);
        setClassicConfig({
          difficulty: nextRoom.difficulty,
          modelMode: nextRoom.modelMode,
          constraintEventId: nextRoom.constraintEventId,
          objectiveId: nextRoom.objectiveId,
          orbitId: nextRoom.orbitId,
          launchVehicleId: nextRoom.launchVehicleId,
          busId: nextRoom.busId,
          propulsionId: nextRoom.propulsionId,
          powerId: nextRoom.powerId,
          batteryId: nextRoom.batteryId,
          commsId: nextRoom.commsId,
          avionicsId: nextRoom.avionicsId,
          adcsId: nextRoom.adcsId,
          shieldingId: nextRoom.shieldingId,
          instrumentIds: nextRoom.instrumentIds,
          solarSizing: nextRoom.solarSizing,
          propellantRatio: nextRoom.propellantRatio,
        });
      },
      setMembers,
      setMessages,
    );
    return () => unsub();
  }, [authReady, user, roomId]);

  // Classic Simulation Loop (when team room or classic hangar enters simulating phase)
  useEffect(() => {
    if (appView !== 'classic-hangar' || classicPhase !== 'simulating' || activeAnomaly) return;

    const timer = window.setInterval(() => {
      setClassicSimProgress((prev) => {
        const next = Math.min(1, prev + 0.015 * classicSimSpeed);

        const nextAnomaly = classicAnomalies.find(
          (a) => next >= a.triggerProgress && !resolvedAnomalyIds.includes(a.id),
        );
        if (nextAnomaly) {
          audioSynth.playAlert();
          setActiveAnomaly(nextAnomaly);
          return next;
        }

        const powerShift = chosenActions.reduce((s, c) => s + (c.powerShiftW || 0), 0);
        const dataShift = chosenActions.reduce((s, c) => s + (c.dataShiftPct || 0), 0);
        setSimSamples((old) => [
          ...old.slice(-30),
          {
            progress: next,
            powerPct: Math.max(0, Math.min(100, 75 + (classicTelemetry.powerMarginW + powerShift) * 0.08)),
            dataPct: Math.max(0, Math.min(100, 68 + classicTelemetry.linkMarginDb * 2 + dataShift)),
            sciencePct: Math.round(next * 100),
          },
        ]);

        if (next >= 1) {
          clearInterval(timer);
          const allReady = members.length <= 1 || members.every((m) => m.ready);
          const result = evaluateSimulationOutcome(
            classicConfig,
            classicTelemetry,
            chosenActions,
            members.length || 1,
            allReady,
          );
          setOutcome(result);
          if (result.missionSuccess) audioSynth.playSuccess();
          else audioSynth.playAlert();
          if (roomId) {
            void completeRoomSimulation(roomId, result.totalScore, result.grade).catch(() => {});
          }
          setClassicPhase('debrief');
        }
        return next;
      });
    }, 120);

    return () => clearInterval(timer);
  }, [
    appView,
    classicPhase,
    activeAnomaly,
    classicSimSpeed,
    classicAnomalies,
    resolvedAnomalyIds,
    chosenActions,
    classicTelemetry,
    classicConfig,
    members,
    roomId,
  ]);

  // Auth Handlers
  const handleSignIn = useCallback(async () => {
    setAuthLoading(true);
    try {
      await signInWithGoogle();
      audioSynth.playSelect();
    } catch (err) {
      setToastError(err instanceof Error ? err.message : 'Unable to sign in with Google.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOutUser();
      setRoomId(null);
      setRoomState(null);
    } catch (err) {
      setToastError(err instanceof Error ? err.message : 'Unable to sign out.');
    }
  }, []);

  // TitleScreen Difficulty Sync
  const handleSelectDifficulty = useCallback((d: DifficultyLevel) => {
    audioSynth.playSelect();
    setClassicConfig((prev) => ({ ...prev, difficulty: d }));
    setArchitectMode(d === 'sandbox' ? 'sandbox' : 'cadet');
  }, []);

  // Classic Config Updater
  const handleUpdateClassicConfig = useCallback(
    (patch: Partial<MissionConfig>, label: string) => {
      audioSynth.playMountPart();
      setClassicConfig((prev) => {
        const next = { ...prev, ...patch };
        const popup = buildTradeOffPopup(prev, next, label);
        if (popup) {
          setTradeOffPopup(popup);
          if (tradeOffTimerRef.current) clearTimeout(tradeOffTimerRef.current);
          tradeOffTimerRef.current = window.setTimeout(() => setTradeOffPopup(null), 5000);
        }
        if (roomId) {
          void updateRoomConfig(roomId, next).catch(() => {});
          if (user) {
            const myMember = members.find((m) => m.uid === user.uid);
            void sendRoomMessage(roomId, user, myMember?.role || soloRole, `Updated ${label}`, 'change').catch(() => {});
          }
        }
        return next;
      });
    },
    [roomId, user, members, soloRole],
  );

  // Team Room Creation & Joining
  const handleCreateRoom = useCallback(
    async (title: string, challengeMode: MissionChallengeMode, objectiveId: string) => {
      if (!user) throw new Error('Sign in with Google first.');
      const obj = OBJECTIVES.find((o) => o.id === objectiveId) ?? OBJECTIVES[0];
      const nextCfg: MissionConfig = {
        ...classicConfig,
        objectiveId: obj.id,
        orbitId: obj.recommendedOrbitId,
      };
      const newRoomId = await createCollaborativeRoom(user, title, nextCfg, challengeMode);
      setClassicConfig(nextCfg);
      setRoomId(newRoomId);
      setClassicPhase('assembly');
      setAppView('classic-hangar');
      audioSynth.playSuccess();
    },
    [user, classicConfig],
  );

  const handleJoinRoom = useCallback(
    async (code: string) => {
      if (!user) throw new Error('Sign in with Google first.');
      const joined = await joinCollaborativeRoom(user, code);
      setRoomId(joined.roomId);
      setClassicPhase('assembly');
      setAppView('classic-hangar');
      audioSynth.playSuccess();
    },
    [user],
  );

  const handleLaunchClassicSimulation = useCallback(() => {
    const seed = Math.floor(Math.random() * 99999);
    setClassicSimSeed(seed);
    setClassicSimProgress(0);
    setSimSamples([]);
    setChosenActions([]);
    setResolvedAnomalyIds([]);
    setActiveAnomaly(null);
    setOutcome(null);
    setSavedMissionId(null);
    setPublishedLeaderboardId(null);
    setClassicAnomalies(generateFlightAnomalies(classicConfig, seed));
    setClassicPhase('simulating');
    audioSynth.playSuccess();
    if (roomId) {
      void startRoomSimulation(roomId, seed).catch(() => {});
    }
  }, [classicConfig, roomId]);

  const handleSelectSubsystem = useCallback((tab: SubsystemTab) => {
    if (tab === 'bus') setActiveCategory('bus');
    else if (tab === 'power') setActiveCategory('power');
    else if (tab === 'payload') setActiveCategory('science');
    else if (tab === 'team') setActiveCategory('team');
  }, []);

  // NASA 4-Segment Calculations
  const totalGridCells = 36 * 18;
  const groundTrackCoveragePct = Math.min(100, Number(((scannedTiles.size / (totalGridCells * 0.45)) * 100).toFixed(1)));
  const totalBudgetCostM = selectedRocket.costM + 95 + nasaInstruments.filter((i) => i.enabled).length * 18;

  const verificationScorecard = useMemo(() => {
    return evaluateSystemsVerification(
      selectedObjective,
      selectedRocket,
      burnState,
      orbitState,
      groundComm,
      nasaInstruments,
      totalBudgetCostM,
      groundTrackCoveragePct,
      architectMode,
      csaChallenges,
      opsState,
      landmarks,
    );
  }, [
    selectedObjective,
    selectedRocket,
    burnState,
    orbitState,
    groundComm,
    nasaInstruments,
    totalBudgetCostM,
    groundTrackCoveragePct,
    architectMode,
    csaChallenges,
    opsState,
    landmarks,
  ]);

  const discoveryCards = useMemo(() => {
    return evaluateDiscoveryCards(selectedObjective, nasaInstruments, csaChallenges, verificationScorecard);
  }, [selectedObjective, nasaInstruments, csaChallenges, verificationScorecard]);

  // Live snapshot ref so the 60ms simulation interval never tears down or reads stale closures
  const simSnapshotRef = useRef({
    selectedObjective,
    nasaInstruments,
    orbitState,
    groundComm,
    opsState,
    landmarks,
    propellantBudgetKg,
    missionElapsedSec,
    manualStationId,
    currentNasaSegment,
  });
  simSnapshotRef.current = {
    selectedObjective,
    nasaInstruments,
    orbitState,
    groundComm,
    opsState,
    landmarks,
    propellantBudgetKg,
    missionElapsedSec,
    manualStationId,
    currentNasaSegment,
  };

  const simTickCounterRef = useRef(0);
  const lastAutoHazardElapsedRef = useRef(142500);

  const buildHazardSpec = useCallback((kind?: 'debris' | 'solar-flare' | 'eclipse-drain'): ActiveHazard => {
    const chosen: 'debris' | 'solar-flare' | 'eclipse-drain' =
      kind || (['debris', 'solar-flare', 'eclipse-drain'][Math.floor(Math.random() * 3)] as 'debris' | 'solar-flare' | 'eclipse-drain');

    if (chosen === 'debris') {
      return {
        id: `haz-${Date.now()}`,
        type: 'debris',
        title: 'Orbital Debris Conjunction Corridor',
        detail: '18th Space Defense Squadron tracks a 14 cm fragmentation shard intersecting your orbital plane.',
        actionHint: 'Execute a ≥ 25 m/s Maneuver Burn (or press Fire 32 m/s Dodge Burn) before T-0.',
        timeRemainingSec: 18,
        maxTimeSec: 18,
        severity: 'critical',
        incomingVectorDeg: Math.round(Math.random() * 360),
        resolved: false,
      };
    }

    if (chosen === 'solar-flare') {
      return {
        id: `haz-${Date.now()}`,
        type: 'solar-flare',
        title: 'X-Class Coronal Mass Ejection (CME)',
        detail: 'High-energy solar protons spiking across magnetosphere! Sensitive optics risk radiation saturation.',
        actionHint: 'Slew Radiation Shield within ±22° of Sun Vector AND shed heavy payloads (≤ 2 active instruments).',
        timeRemainingSec: 20,
        maxTimeSec: 20,
        severity: 'critical',
        incomingVectorDeg: Math.round(simSnapshotRef.current.opsState.sunAngleDeg),
        resolved: false,
      };
    }

    return {
      id: `haz-${Date.now()}`,
      type: 'eclipse-drain',
      title: 'Deep Umbra Power Bus Sag',
      detail: 'Extended shadow crossing with high payload draw is dragging main Li-Ion bus toward brownout.',
      actionHint: 'Shed heavy payloads (≤ 2 instruments ON) or restore positive solar panel margin.',
      timeRemainingSec: 18,
      maxTimeSec: 18,
      severity: 'warning',
      incomingVectorDeg: 180,
      resolved: false,
    };
  }, []);

  // Legacy orbital interval paused — UnifiedMissionCanvas drives its own 60fps fixed-timestep loop
  useEffect(() => {
    if (true || appView !== 'nasa-architect' || isSimPaused) return;

    const interval = window.setInterval(() => {
      const snap = simSnapshotRef.current;
      const dtSec = 1.0 * simSpeedMult;
      const nextElapsed = snap.missionElapsedSec + dtSec;
      simTickCounterRef.current += 1;

      setMissionElapsedSec(nextElapsed);

      // 1. Propagate Keplerian orbit & ground swath coverage
      const nextOrbit = propagateOrbitStep(snap.selectedObjective.targetBody, snap.orbitState, dtSec);
      setOrbitState(nextOrbit);

      const activeInstruments = snap.nasaInstruments.filter((i) => i.enabled);
      if (activeInstruments.length > 0) {
        const col = Math.floor(((nextOrbit.subSatLonDeg + 180) / 360) * 36) % 36;
        const row = Math.floor(((nextOrbit.subSatLatDeg + 90) / 180) * 18) % 18;
        const key = `${col}:${row}`;
        setScannedTiles((prevTiles) => {
          if (prevTiles.has(key)) return prevTiles;
          const updated = new Set(prevTiles);
          updated.add(key);
          return updated;
        });
      }

      // 2. Step Spacecraft Bus, Solar Alignment, Canadarm Drift & Real-Time Hazards
      const instDrawW = activeInstruments.reduce((sum, i) => sum + i.powerDrawW, 0) + 115;
      setOpsState((prevOps) => {
        const nextSunAngle = Number(((prevOps.sunAngleDeg + 0.35 * dtSec) % 360).toFixed(1));
        const solarErr = angleDiffDeg(prevOps.solarPanelAngleDeg, nextSunAngle);
        const solarEfficiency = Math.max(0.15, Math.cos((solarErr * Math.PI) / 180));
        const powerGenW = nextOrbit.inEclipse ? 30 : Math.round(520 * solarEfficiency);
        const netPowerW = powerGenW - instDrawW;
        const nextBattery = Math.max(
          5,
          Math.min(100, Number((prevOps.batteryPct + (netPowerW / 320) * dtSec).toFixed(1))),
        );

        // Canadarm target gentle floating drift inside cargo bay [-0.76..0.76] x [0.34..0.92]
        let nextTx = prevOps.canadarm.targetX + prevOps.canadarm.driftVx * (0.06 * simSpeedMult);
        let nextTy = prevOps.canadarm.targetY + prevOps.canadarm.driftVy * (0.06 * simSpeedMult);
        let nextVx = prevOps.canadarm.driftVx;
        let nextVy = prevOps.canadarm.driftVy;
        if (nextTx > 0.76 || nextTx < -0.76) {
          nextVx = -nextVx;
          nextTx = Math.max(-0.76, Math.min(0.76, nextTx));
        }
        if (nextTy > 0.92 || nextTy < 0.34) {
          nextVy = -nextVy;
          nextTy = Math.max(0.34, Math.min(0.92, nextTy));
        }

        let nextHazard = prevOps.activeHazard;
        let nextSurvived = prevOps.hazardsSurvived;
        let nextFailed = prevOps.hazardsFailed;
        let nextHull = prevOps.hullIntegrityPct;
        let nextRad = prevOps.radiationDosePct;
        let batteryAfterHazard = nextBattery;

        if (nextHazard) {
          const shieldAligned = angleDiffDeg(prevOps.shieldAngleDeg, nextSunAngle) <= 22;
          const lowPayloadLoad = activeInstruments.length <= 2;

          if (nextHazard.type === 'solar-flare' && shieldAligned && lowPayloadLoad) {
            audioSynth.playSuccess();
            nextSurvived += 1;
            nextHazard = null;
          } else if (nextHazard.type === 'eclipse-drain' && (lowPayloadLoad || netPowerW >= 0)) {
            audioSynth.playSuccess();
            nextSurvived += 1;
            nextHazard = null;
          } else {
            const rem = Number((nextHazard.timeRemainingSec - 0.14 * simSpeedMult).toFixed(1));
            if (rem <= 0) {
              audioSynth.playAlert();
              nextFailed += 1;
              if (nextHazard.type === 'debris') {
                nextHull = Math.max(15, nextHull - 18);
                setCsaChallenges((c) => ({
                  ...c,
                  debrisAlertActive: false,
                  lastChallengeFeedback: 'Debris impact grazed secondary radiator (-18% Hull Integrity)!',
                }));
              } else if (nextHazard.type === 'solar-flare') {
                nextRad = Math.min(100, nextRad + 22);
                nextHull = Math.max(15, nextHull - 10);
              } else {
                batteryAfterHazard = Math.max(5, batteryAfterHazard - 20);
              }
              nextHazard = null;
            } else {
              nextHazard = { ...nextHazard, timeRemainingSec: rem };
            }
          }
        } else if (
          snap.currentNasaSegment === 'space' &&
          nextElapsed - lastAutoHazardElapsedRef.current >= 58
        ) {
          lastAutoHazardElapsedRef.current = nextElapsed;
          const drill = buildHazardSpec();
          nextHazard = drill;
          audioSynth.playAlert();
          if (drill.type === 'debris') {
            setCsaChallenges((c) => ({
              ...c,
              debrisAlertActive: true,
              lastChallengeFeedback: 'DEBRIS CONJUNCTION ALERT: Fire a ≥ 25 m/s burn or use the emergency dodge button!',
            }));
          }
        }

        // Sync CSA solar alignment achievement cleanly when aligned within 20°
        if (solarErr <= 20) {
          setCsaChallenges((c) =>
            c.solarArraysAligned
              ? c
              : {
                  ...c,
                  solarArraysAligned: true,
                  challengePoints: c.challengePoints + 30,
                  lastChallengeFeedback: 'Solar wings locked onto Sun Vector (+30 CSA Ops pts).',
                },
          );
        }

        return {
          ...prevOps,
          sunAngleDeg: nextSunAngle,
          batteryPct: batteryAfterHazard,
          hullIntegrityPct: nextHull,
          radiationDosePct: nextRad,
          activeHazard: nextHazard,
          hazardsSurvived: nextSurvived,
          hazardsFailed: nextFailed,
          canadarm: {
            ...prevOps.canadarm,
            targetX: Number(nextTx.toFixed(3)),
            targetY: Number(nextTy.toFixed(3)),
            driftVx: nextVx,
            driftVy: nextVy,
            targetAngleDeg: Number(((prevOps.canadarm.targetAngleDeg + 0.6 * dtSec) % 360).toFixed(1)),
          },
        };
      });

      // 3. Step Ground Station Line-of-Sight, Dish Lock & SSR Downlink
      let targetStation = GROUND_STATIONS[0];
      let targetCheck = checkLineOfSight(
        snap.selectedObjective.targetBody,
        targetStation,
        nextOrbit.subSatLatDeg,
        nextOrbit.subSatLonDeg,
        nextOrbit.altitudeKm,
        nextOrbit.orbitalSpeedKms,
      );

      const pinnedStation = snap.manualStationId
        ? GROUND_STATIONS.find((s) => s.id === snap.manualStationId)
        : null;

      if (pinnedStation) {
        targetStation = pinnedStation;
        targetCheck = checkLineOfSight(
          snap.selectedObjective.targetBody,
          pinnedStation,
          nextOrbit.subSatLatDeg,
          nextOrbit.subSatLonDeg,
          nextOrbit.altitudeKm,
          nextOrbit.orbitalSpeedKms,
        );
      } else {
        let bestElev = -999;
        let foundLos = false;
        for (const st of GROUND_STATIONS) {
          const chk = checkLineOfSight(
            snap.selectedObjective.targetBody,
            st,
            nextOrbit.subSatLatDeg,
            nextOrbit.subSatLonDeg,
            nextOrbit.altitudeKm,
            nextOrbit.orbitalSpeedKms,
          );
          if (chk.hasLineOfSight && chk.elevationAngleDeg > bestElev) {
            bestElev = chk.elevationAngleDeg;
            targetStation = st;
            targetCheck = chk;
            foundLos = true;
          }
        }
        if (!foundLos) {
          targetStation =
            GROUND_STATIONS.find((s) => s.body === snap.selectedObjective.targetBody) || GROUND_STATIONS[0];
          targetCheck = checkLineOfSight(
            snap.selectedObjective.targetBody,
            targetStation,
            nextOrbit.subSatLatDeg,
            nextOrbit.subSatLonDeg,
            nextOrbit.altitudeKm,
            nextOrbit.orbitalSpeedKms,
          );
        }
      }

      const prevComm = snap.groundComm;
      let nextDishAz = prevComm.dishAzimuthDeg;
      let nextDishEl = prevComm.dishElevationDeg;
      if (prevComm.servoAssistEnabled && targetCheck.hasLineOfSight) {
        const azDiff = ((targetCheck.navTelemetry.azimuthDeg - nextDishAz + 540) % 360) - 180;
        nextDishAz = Number(((nextDishAz + azDiff * 0.25 + 360) % 360).toFixed(1));
        nextDishEl = Number(
          (nextDishEl + (targetCheck.navTelemetry.elevationDeg - nextDishEl) * 0.25).toFixed(1),
        );
      }

      const lockResult = targetCheck.hasLineOfSight
        ? computeDishAlignmentLock(
            nextDishAz,
            nextDishEl,
            targetCheck.navTelemetry.azimuthDeg,
            targetCheck.navTelemetry.elevationDeg,
            prevComm.bandMode,
          )
        : { angularErrorDeg: 90, lockQualityPct: 0 };

      const bandMultiplier = prevComm.bandMode === 'Ka-Band' ? 1.0 : 0.72;
      const effectiveDownlinkMbps = targetCheck.hasLineOfSight
        ? Math.round(
            targetStation.maxDataRateMbps *
              bandMultiplier *
              (lockResult.lockQualityPct / 100) *
              (prevComm.allocatedBandwidthPct / 100),
          )
        : 0;

      const activeDataRateMbps = activeInstruments.reduce((sum, i) => sum + i.dataRateMbps, 0);
      const dataGenGB = (activeDataRateMbps * dtSec) / 8000;
      let nextBuffer = Math.min(prevComm.bufferCapacityGB, prevComm.bufferStoredGB + dataGenGB);
      let nextDownlinked = prevComm.totalDataDownlinkedGB;

      if (targetCheck.hasLineOfSight && effectiveDownlinkMbps > 0 && nextBuffer > 0) {
        const maxDownlinkGB = (effectiveDownlinkMbps * dtSec) / 8000;
        const downlinkedThisStep = Math.min(nextBuffer, maxDownlinkGB);
        nextBuffer = Math.max(0, nextBuffer - downlinkedThisStep);
        nextDownlinked += downlinkedThisStep;
      }

      const enteredLos = targetCheck.hasLineOfSight && !prevComm.hasLineOfSight;

      // Flush captured science landmarks to downlinked status when dish lock >= 50%
      if (targetCheck.hasLineOfSight && lockResult.lockQualityPct >= 50) {
        const hasPending = snap.landmarks.some((l) => l.captured && !l.downlinked);
        if (hasPending) {
          setLandmarks((prevLms) =>
            prevLms.map((l) =>
              l.captured && !l.downlinked
                ? { ...l, downlinked: true, signalQualityPct: Math.max(l.signalQualityPct, lockResult.lockQualityPct) }
                : l,
            ),
          );
        }
      }

      setGroundComm({
        activeStationId: targetStation.id,
        hasLineOfSight: targetCheck.hasLineOfSight,
        elevationAngleDeg: targetCheck.elevationAngleDeg,
        distanceKm: targetCheck.distanceKm,
        downlinkActive: targetCheck.hasLineOfSight && effectiveDownlinkMbps > 0 && nextBuffer > 0,
        currentDownlinkMbps: effectiveDownlinkMbps,
        isBlackout: !targetCheck.hasLineOfSight,
        bufferStoredGB: nextBuffer,
        bufferCapacityGB: prevComm.bufferCapacityGB,
        totalDataDownlinkedGB: nextDownlinked,
        dishAzimuthDeg: nextDishAz,
        dishElevationDeg: nextDishEl,
        dishLockQualityPct: lockResult.lockQualityPct,
        bandMode: prevComm.bandMode,
        allocatedBandwidthPct: prevComm.allocatedBandwidthPct,
        servoAssistEnabled: prevComm.servoAssistEnabled,
        passTimeRemainingSec: targetCheck.hasLineOfSight
          ? Math.max(15, Math.round(90 + targetCheck.elevationAngleDeg * 2.2))
          : 0,
        totalPassContacts: prevComm.totalPassContacts + (enteredLos ? 1 : 0),
        navTelemetry: targetCheck.navTelemetry,
      });

      // 4. Append GMAT telemetry sample every 12 ticks (~0.72s)
      if (simTickCounterRef.current % 12 === 0) {
        setTelemetryHistory((prevHistory) => {
          const sample: GmatTelemetrySample = {
            timestampSec: Math.round(nextElapsed),
            altitudeKm: nextOrbit.altitudeKm,
            orbitalSpeedKms: nextOrbit.orbitalSpeedKms,
            propellantRemainingKg: snap.propellantBudgetKg,
            eccentricity: nextOrbit.eccentricity,
            downlinkRateMbps: effectiveDownlinkMbps,
          };
          const next = [...prevHistory, sample];
          return next.length > 70 ? next.slice(next.length - 70) : next;
        });
      }
    }, 60);

    return () => clearInterval(interval);
  }, [appView, isSimPaused, simSpeedMult, buildHazardSpec]);

  // Objective Change Handler
  const handleSelectObjective = (obj: NasaObjectiveSpec) => {
    audioSynth.playSelect();
    setSelectedObjective(obj);
    setPropellantBudgetKg(obj.propellantBudgetKg);
    setLandmarks(getSurfaceLandmarksForObjective(obj));
    setOpsState(createInitialOpsState());
    setManualStationId(null);

    const targetDv = calculateTargetDeltaV(obj.targetBody, obj.targetAltitudeKm, obj.regime);
    setBurnState({
      status: 'completed',
      throttlePct: 100,
      burnDurationSec: 180,
      targetDeltaVKms: targetDv,
      deliveredDeltaVKms: targetDv,
      propellantUsedKg: 280,
      outcomeType: 'nominal',
      outcomeSummary: `Nominal Injection: Spacecraft placed into ${obj.targetAltitudeKm} km orbit around ${obj.targetBody.toUpperCase()}.`,
    });

    const b = CELESTIAL_BODIES[obj.targetBody];
    setOrbitState({
      altitudeKm: obj.targetAltitudeKm,
      periapsisKm: obj.periapsisKm ?? Math.max(0, obj.targetAltitudeKm - 25),
      apoapsisKm: obj.apoapsisKm ?? obj.targetAltitudeKm + 25,
      eccentricity: obj.targetEccentricity ?? 0.001,
      inclinationDeg: obj.targetInclinationDeg,
      semiMajorAxisKm: b.radiusKm + obj.targetAltitudeKm,
      periodMinutes: calculateOrbitalPeriodMinutes(obj.targetBody, obj.targetAltitudeKm, obj.targetEccentricity ?? 0),
      orbitalSpeedKms: Number(Math.sqrt(b.mu / (b.radiusKm + obj.targetAltitudeKm)).toFixed(2)),
      trueAnomalyDeg: 0,
      raanDeg: obj.raanDeg ?? 45.0,
      argPeriapsisDeg: obj.argPeriapsisDeg ?? 0.0,
      subSatLatDeg: 0,
      subSatLonDeg: 0,
      inEclipse: false,
      perturbations: {
        j2NodalPrecessionDegPerDay: -0.985,
        j2ApsidalDriftDegPerDay: -3.24,
        atmosphericDragDecayKmPerDay: 0.002,
        solarRadiationPressureScale: 1.0,
      },
    });
  };

  // Time-warp orbiter cleanly to maneuver node true anomaly
  const handleWarpToAnomaly = useCallback((targetAnomalyDeg: number) => {
    audioSynth.playSelect();
    setOrbitState((prev) => {
      const b = CELESTIAL_BODIES[selectedObjective.targetBody];
      const deg2rad = Math.PI / 180;
      const nuRad = targetAnomalyDeg * deg2rad;
      const incRad = prev.inclinationDeg * deg2rad;
      const subSatLatDeg = Number((Math.asin(Math.sin(incRad) * Math.sin(nuRad)) / deg2rad).toFixed(2));
      const subSatLonRad = Math.atan2(Math.cos(incRad) * Math.sin(nuRad), Math.cos(nuRad));
      const subSatLonDeg = Number((((((subSatLonRad / deg2rad) + 180) % 360) + 360) % 360 - 180).toFixed(2));
      const a = b.radiusKm + prev.altitudeKm;
      const r = (a * (1 - prev.eccentricity ** 2)) / (1 + prev.eccentricity * Math.cos(nuRad));
      const currentAltKm = Math.round(r - b.radiusKm);
      const orbitalSpeedKms = Number(Math.sqrt(Math.max(0.1, b.mu * (2 / r - 1 / a))).toFixed(2));

      return {
        ...prev,
        trueAnomalyDeg: Number(targetAnomalyDeg.toFixed(2)),
        altitudeKm: currentAltKm,
        orbitalSpeedKms,
        subSatLatDeg,
        subSatLonDeg,
        inEclipse: Math.cos(nuRad) < -0.35 && currentAltKm < 2000,
      };
    });
  }, [selectedObjective.targetBody]);

  // Impulsive Maneuver Burn Executor (with burn accuracy & debris hazard evasion)
  const handleApplyManeuverBurn = (
    deltaVVector: { progradeMs: number; normalMs: number; radialMs: number },
    accuracyPct = 92,
  ) => {
    const dvMagnitudeMs = Math.sqrt(
      deltaVVector.progradeMs ** 2 + deltaVVector.normalMs ** 2 + deltaVVector.radialMs ** 2,
    );
    if (dvMagnitudeMs <= 0) return;

    audioSynth.playMountPart();

    const isp = selectedPropulsion === 'chemical' ? 325 : 3100;
    const exhaustVelocityMs = isp * G0;
    const currentWetMassKg =
      420 +
      propellantBudgetKg +
      nasaInstruments.reduce((sum, i) => sum + (i.enabled ? i.massKg : 0), 0);
    const propellantSpentKg = Math.min(
      propellantBudgetKg,
      Math.round(currentWetMassKg * (1 - Math.exp(-dvMagnitudeMs / exhaustVelocityMs))),
    );
    setPropellantBudgetKg((p) => Math.max(0, p - propellantSpentKg));

    const body = CELESTIAL_BODIES[selectedObjective.targetBody];
    setOrbitState((prev) => {
      const altDeltaKm = Math.round((deltaVVector.progradeMs / 1000) * (prev.altitudeKm + body.radiusKm) * 0.28);
      const nextAlt = Math.max(120, prev.altitudeKm + altDeltaKm);
      const incDeltaDeg = Number(
        ((deltaVVector.normalMs / Math.max(1, prev.orbitalSpeedKms * 1000)) * (180 / Math.PI)).toFixed(1),
      );
      const nextInc = Math.max(0, Math.min(98, Number((prev.inclinationDeg + incDeltaDeg).toFixed(1))));
      const eccShift = Math.abs(deltaVVector.progradeMs) / 1400;
      const nextEcc =
        deltaVVector.progradeMs >= 0
          ? Math.min(0.75, Number((prev.eccentricity + eccShift).toFixed(3)))
          : Math.max(0.0, Number((prev.eccentricity - eccShift * 0.8).toFixed(3)));

      const rMean = body.radiusKm + nextAlt;
      const speed = Number(Math.sqrt(body.mu / rMean).toFixed(2));
      const period = calculateOrbitalPeriodMinutes(selectedObjective.targetBody, nextAlt, nextEcc);
      const periapsisKm = Math.max(80, Math.round(rMean * (1 - nextEcc) - body.radiusKm));
      const apoapsisKm = Math.max(periapsisKm + 10, Math.round(rMean * (1 + nextEcc) - body.radiusKm));

      return {
        ...prev,
        altitudeKm: nextAlt,
        periapsisKm,
        apoapsisKm,
        eccentricity: nextEcc,
        inclinationDeg: nextInc,
        semiMajorAxisKm: Math.round(rMean),
        periodMinutes: period,
        orbitalSpeedKms: speed,
      };
    });

    setOpsState((prev) => {
      let nextHazard = prev.activeHazard;
      let nextSurvived = prev.hazardsSurvived;
      if (dvMagnitudeMs >= 25 && prev.activeHazard?.type === 'debris') {
        nextHazard = null;
        nextSurvived += 1;
      }
      return {
        ...prev,
        activeHazard: nextHazard,
        hazardsSurvived: nextSurvived,
        lastManeuverAccuracyPct: Math.round((prev.lastManeuverAccuracyPct + accuracyPct) / 2),
      };
    });

    // Check CSA Debris Conjunction Evasion resolution
    if (dvMagnitudeMs >= 25) {
      setCsaChallenges((prev) => {
        if (!prev.debrisAlertActive) return prev;
        const firstDodge = prev.debrisAvoidedCount === 0;
        audioSynth.playSuccess();
        return {
          ...prev,
          debrisAlertActive: false,
          debrisAvoidedCount: prev.debrisAvoidedCount + 1,
          challengePoints: prev.challengePoints + (firstDodge ? 30 : 0),
          lastChallengeFeedback: `Conjunction Evaded! ${Math.round(dvMagnitudeMs)} m/s burn cleared the orbital debris corridor${firstDodge ? ' (+30 pts)' : ''}.`,
        };
      });
    }
  };

  // Emergency Payload Shedding (keeps only the lowest-power single instrument active)
  const handleShedHeavyPayloads = useCallback(() => {
    audioSynth.playSelect();
    setNasaInstruments((prev) => {
      const enabled = prev.filter((i) => i.enabled).sort((a, b) => a.powerDrawW - b.powerDrawW);
      const keepId = enabled[0]?.id;
      return prev.map((i) => ({ ...i, enabled: i.id === keepId }));
    });
  }, []);

  // Manual or Scheduled Space Hazard Trigger
  const handleTriggerHazardDrill = useCallback(
    (kind?: 'debris' | 'solar-flare' | 'eclipse-drain') => {
      audioSynth.playAlert();
      const hazard = buildHazardSpec(kind);
      setOpsState((prev) => ({ ...prev, activeHazard: hazard }));
      if (hazard.type === 'debris') {
        setCsaChallenges((prev) => ({
          ...prev,
          debrisAlertActive: true,
          lastChallengeFeedback: 'DEBRIS CONJUNCTION ALERT: Fire a ≥ 25 m/s burn before T-0!',
        }));
      }
    },
    [buildHazardSpec],
  );

  // CSA Canadarm3 Grapple Attempt
  const handleResolveCanadarmCapture = useCallback(() => {
    const snap = simSnapshotRef.current;
    const arm = snap.opsState.canadarm;
    const kin = computeCanadarmEndEffector(arm.shoulderDeg, arm.elbowDeg, arm.wristDeg);
    const dist = Math.hypot(kin.endX - arm.targetX, kin.endY - arm.targetY);

    if (dist > 0.16) {
      audioSynth.playAlert();
      setOpsState((prev) => ({
        ...prev,
        canadarm: {
          ...prev.canadarm,
          lastOpFeedback: `End-effector missed by ${(dist * 10).toFixed(1)} m — align within 1.6 m of the amber docking ring!`,
        },
      }));
      return;
    }

    audioSynth.playSuccess();
    const order: CanadarmTargetType[] = ['cubesat', 'gateway-module', 'solar-wing'];
    const nextType = order[(arm.completedCount + 1) % order.length];
    const nextX = Number((((Math.random() - 0.5) * 1.1)).toFixed(2));
    const nextY = Number((0.44 + Math.random() * 0.42).toFixed(2));

    setOpsState((prev) => ({
      ...prev,
      hullIntegrityPct: Math.min(100, prev.hullIntegrityPct + 12),
      canadarm: {
        ...prev.canadarm,
        clampClosed: true,
        targetType: nextType,
        targetX: nextX,
        targetY: nextY,
        completedCount: prev.canadarm.completedCount + 1,
        lastOpFeedback: `Grapple LOCKED on ${arm.targetType.toUpperCase()}! Hull serviced (+12%). Next payload queued: ${nextType.toUpperCase()}.`,
      },
    }));

    setCsaChallenges((prev) => ({
      ...prev,
      challengePoints: Math.min(90, prev.challengePoints + 20),
      lastChallengeFeedback: `Canadarm3 autonomous capture succeeded on ${arm.targetType}!`,
    }));
  }, []);

  // Active Surface Landmark Scanner
  const handleFireInstrumentScan = useCallback((landmarkId?: string) => {
    const snap = simSnapshotRef.current;
    const effectiveLat = snap.orbitState.subSatLatDeg + snap.opsState.sensorSlewOffsetDeg;
    const target = landmarkId
      ? snap.landmarks.find((l) => l.id === landmarkId)
      : snap.landmarks.find((l) => !l.captured);

    if (!target) {
      return { capturedName: null, message: 'All planetary landmarks already scanned!' };
    }

    const instEnabled = snap.nasaInstruments.some((i) => i.id === target.requiredInstrument && i.enabled);
    if (!instEnabled) {
      audioSynth.playAlert();
      return {
        capturedName: null,
        message: `Power ON ${target.requiredInstrument.toUpperCase()} in the Payload Power Bus below before scanning ${target.name}!`,
      };
    }

    // If user clicked "Slew & Fire" on a landmark outside window, gently slew orbiter closer or capture with gimbal
    const dLat = Math.abs(target.latDeg - effectiveLat);
    const dLon = Math.min(
      Math.abs(target.lonDeg - snap.orbitState.subSatLonDeg),
      360 - Math.abs(target.lonDeg - snap.orbitState.subSatLonDeg),
    );
    const angDist = Math.hypot(dLat, dLon);
    const signalQuality = Math.max(68, Math.min(99, Math.round(99 - angDist * 0.25)));

    audioSynth.playSuccess();
    setLandmarks((prev) =>
      prev.map((l) =>
        l.id === target.id ? { ...l, captured: true, signalQualityPct: signalQuality } : l,
      ),
    );

    // Paint scanned tiles around the landmark
    setScannedTiles((prevTiles) => {
      const updated = new Set(prevTiles);
      const baseCol = Math.floor(((target.lonDeg + 180) / 360) * 36) % 36;
      const baseRow = Math.floor(((target.latDeg + 90) / 180) * 18) % 18;
      for (let dc = -2; dc <= 2; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const c = (baseCol + dc + 36) % 36;
          const r = Math.max(0, Math.min(17, baseRow + dr));
          updated.add(`${c}:${r}`);
        }
      }
      return updated;
    });

    // Queue captured packet into SSR onboard buffer
    setGroundComm((prev) => ({
      ...prev,
      bufferStoredGB: Math.min(prev.bufferCapacityGB, Number((prev.bufferStoredGB + 8.5).toFixed(1))),
    }));

    // Unlock CSA RADARSAT Polar challenge if radar-sar or high-latitude landmark scanned
    if (Math.abs(target.latDeg) >= 55 || target.requiredInstrument === 'radar-sar') {
      setCsaChallenges((prev) => ({
        ...prev,
        polarRadarCaptured: true,
        challengePoints: prev.polarRadarCaptured ? prev.challengePoints : Math.min(90, prev.challengePoints + 30),
        lastChallengeFeedback: `High-latitude swath captured at ${target.name}! Packet queued in SSR for Ground Segment downlink.`,
      }));
    }

    return {
      capturedName: target.name,
      message: `SCANNED: ${target.name} (${signalQuality}% signal quality, +8.5 GB queued in SSR).`,
    };
  }, []);

  // Ground Segment Interactive Dish & Link Handlers
  const handleSteerDish = useCallback((azimuthDeg: number, elevationDeg: number) => {
    setGroundComm((prev) => ({
      ...prev,
      dishAzimuthDeg: Number(((azimuthDeg + 360) % 360).toFixed(1)),
      dishElevationDeg: Math.max(5, Math.min(90, Number(elevationDeg.toFixed(1)))),
    }));
  }, []);

  const handleSelectStation = useCallback((stationId: string) => {
    audioSynth.playSelect();
    setManualStationId(stationId);
    setGroundComm((prev) => ({ ...prev, activeStationId: stationId }));
  }, []);

  const handleChangeBandMode = useCallback((band: 'Ka-Band' | 'X-Band') => {
    audioSynth.playSelect();
    setGroundComm((prev) => ({ ...prev, bandMode: band }));
  }, []);

  const handleChangeBandwidthPct = useCallback((pct: number) => {
    setGroundComm((prev) => ({ ...prev, allocatedBandwidthPct: Math.max(25, Math.min(100, pct)) }));
  }, []);

  const handleToggleServoAssist = useCallback(() => {
    audioSynth.playSelect();
    setGroundComm((prev) => ({ ...prev, servoAssistEnabled: !prev.servoAssistEnabled }));
  }, []);

  const handleFlushSsrBurst = useCallback(() => {
    const snap = simSnapshotRef.current;
    if (!snap.groundComm.hasLineOfSight || snap.groundComm.dishLockQualityPct < 60) {
      audioSynth.playAlert();
      return;
    }
    audioSynth.playSuccess();
    setGroundComm((prev) => {
      const burstGB = Math.min(prev.bufferStoredGB, 24);
      return {
        ...prev,
        bufferStoredGB: Math.max(0, Number((prev.bufferStoredGB - burstGB).toFixed(1))),
        totalDataDownlinkedGB: Number((prev.totalDataDownlinkedGB + burstGB).toFixed(1)),
      };
    });
    setLandmarks((prev) =>
      prev.map((l) =>
        l.captured && !l.downlinked
          ? { ...l, downlinked: true, signalQualityPct: Math.max(l.signalQualityPct, snap.groundComm.dishLockQualityPct) }
          : l,
      ),
    );
  }, []);

  const handleUpdateOrbitParams = (altKm: number, ecc: number, incDeg: number) => {
    const body = CELESTIAL_BODIES[selectedObjective.targetBody];
    const r = body.radiusKm + altKm;
    const speed = Number(Math.sqrt(body.mu / r).toFixed(2));
    const period = calculateOrbitalPeriodMinutes(selectedObjective.targetBody, altKm, ecc);

    setOrbitState((prev) => ({
      ...prev,
      altitudeKm: altKm,
      eccentricity: ecc,
      inclinationDeg: incDeg,
      semiMajorAxisKm: Math.round(r),
      periodMinutes: period,
      orbitalSpeedKms: speed,
      periapsisKm: Math.max(80, Math.round(r * (1 - ecc) - body.radiusKm)),
      apoapsisKm: Math.max(90, Math.round(r * (1 + ecc) - body.radiusKm)),
    }));
  };

  const handleToggleInstrument = (id: string) => {
    audioSynth.playSelect();
    setNasaInstruments((prev) =>
      prev.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i)),
    );
  };

  const formatMET = (totalSec: number) => {
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = Math.floor(totalSec % 60);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `MET +${String(days).padStart(3, '0')}d ${pad(hours)}h:${pad(mins)}m:${pad(secs)}s`;
  };

  return (
    <div className="relative h-screen w-screen overflow-y-auto overflow-x-hidden bg-[#040711] text-slate-100 flex flex-col font-sans select-none">
      {/* VIEW 1: HOMEPAGE (TitleScreen over live 3D SpacecraftScene) */}
      {appView === 'title' && (
        <div className="relative h-screen w-screen overflow-hidden">
          <SpacecraftScene
            config={classicConfig}
            sceneMode="title"
            explodeAmount={0}
            cameraPreset="hero"
            cameraPresetNonce={0}
            simProgress={0}
          />
          <TitleScreen
            user={user}
            authLoading={authLoading}
            difficulty={classicConfig.difficulty}
            onSelectDifficulty={handleSelectDifficulty}
            onSignIn={() => void handleSignIn()}
            onSignOut={() => void handleSignOut()}
            onStartSolo={() => {
              audioSynth.playSelect();
              setAppView('nasa-architect');
              setCurrentNasaSegment('setup');
            }}
            onOpenTeamModal={() => {
              audioSynth.playSelect();
              setShowTeamModal(true);
            }}
            onOpenArchive={() => {
              audioSynth.playSelect();
              setShowArchiveModal(true);
            }}
            onOpenGuide={() => {
              audioSynth.playSelect();
              setShowGuideModal(true);
            }}
          />
        </div>
      )}

      {/* VIEW 2: UNIFIED FULL-SCREEN 60FPS SPACE MISSION GAME */}
      {appView === 'nasa-architect' && (
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#020617]">
          <header className="z-40 shrink-0 border-b border-slate-800/90 bg-[#060a14]/95 px-4 py-2">
            <div className="flex items-center justify-between gap-4">
              {/* Left: Back to Homepage + Brand */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    audioSynth.setThrustRumble(0);
                    audioSynth.playSelect();
                    setAppView('title');
                  }}
                  className="flex items-center gap-1 border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-cyan-400 hover:text-white transition-colors cursor-pointer"
                  title="Return to Orbitarium Homepage"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Home</span>
                </button>

                <div className="flex items-center gap-2">
                  <Orbit className="h-4 w-4 text-cyan-400" />
                  <span className="font-display text-base font-black tracking-wider text-white">
                    ORBITARIUM
                  </span>
                </div>
              </div>

              {/* Center: Connected 4-Phase Journey Breadcrumb */}
              <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold">
                {[
                  { id: 'briefing', label: 'Briefing' },
                  { id: 'launch', label: '1. Launch' },
                  { id: 'orbit', label: '2. Orbit Mission' },
                  { id: 'beamdown', label: '3. Beam Data' },
                  { id: 'finale', label: '4. Finale' },
                ].map((step, idx) => {
                  const activePhase =
                    unifiedSnapshot.phase === 'transition_orbit' ? 'launch' : unifiedSnapshot.phase;
                  const active = activePhase === step.id;
                  return (
                    <div key={step.id} className="flex items-center gap-1.5">
                      {idx > 0 && <span className="text-slate-600">→</span>}
                      <span
                        className={`px-2 py-0.5 whitespace-nowrap ${
                          active
                            ? 'bg-cyan-400 text-slate-950 font-bold'
                            : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Right Controls: Change Mission, Sound, Space Words */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden lg:inline text-xs font-medium text-cyan-300 mr-1">
                  {UNIFIED_MISSIONS.find((m) => m.id === unifiedSnapshot.missionId)?.title}
                </span>

                {unifiedSnapshot.phase !== 'briefing' && (
                  <button
                    type="button"
                    onClick={() => {
                      audioSynth.playSelect();
                      setBriefingRequest((prev) => ({
                        phase: 'briefing',
                        nonce: (prev?.nonce ?? 0) + 1,
                      }));
                    }}
                    className="flex items-center gap-1 border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-cyan-400 hover:text-white cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Missions</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const next = !muted;
                    audioSynth.setMuted(next);
                    setMuted(next);
                  }}
                  className="p-1.5 border border-slate-800 bg-slate-900/70 text-slate-300 hover:text-white cursor-pointer"
                  title={muted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5 text-cyan-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowDictionaryModal(true)}
                  className="flex items-center gap-1 border border-cyan-500/40 bg-cyan-950/30 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition-colors cursor-pointer"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Dictionary</span>
                </button>
              </div>
            </div>
          </header>

          <main className="relative flex-1 min-h-0 w-full overflow-hidden">
            <UnifiedMissionCanvas
              onSnapshotChange={setUnifiedSnapshot}
              externalPhaseRequest={briefingRequest}
            />
          </main>
        </div>
      )}

      {/* VIEW 3: CLASSIC 3D TEAM HANGAR (1–4 Player Co-Op & Competitive Rooms) */}
      {appView === 'classic-hangar' && (
        <div className="relative h-screen w-screen overflow-hidden">
          <SpacecraftScene
            config={classicConfig}
            sceneMode={
              classicPhase === 'simulating'
                ? 'orbit'
                : classicPhase === 'planner'
                  ? 'planner'
                  : 'hangar'
            }
            explodeAmount={explodeAmount}
            cameraPreset={cameraPreset}
            cameraPresetNonce={cameraPresetNonce}
            simProgress={classicSimProgress}
            onSelectSubsystem={handleSelectSubsystem}
          />

          <PhaseHeader
            phase={classicPhase}
            config={classicConfig}
            telemetry={classicTelemetry}
            roomId={roomId}
            memberCount={members.length || 1}
            runCount={roomState?.runCount ?? soloRunCount}
            muted={muted}
            onNavigatePhase={(target) => {
              audioSynth.playSelect();
              if (target === 'title') {
                setAppView('title');
              } else {
                setClassicPhase(target);
              }
            }}
            onToggleMute={() => {
              const next = !muted;
              audioSynth.setMuted(next);
              setMuted(next);
            }}
            onOpenDictionary={() => setShowDictionaryModal(true)}
            onOpenTeamModal={() => setShowTeamModal(true)}
            onOpenArchive={() => setShowArchiveModal(true)}
            onLaunchMission={handleLaunchClassicSimulation}
          />

          {classicPhase === 'briefing' && (
            <Phase1Briefing
              config={classicConfig}
              roomId={roomId}
              selectedSoloRole={soloRole}
              onSelectSoloRole={setSoloRole}
              onSelectDifficulty={(d) => handleUpdateClassicConfig({ difficulty: d }, `Difficulty: ${d}`)}
              onSelectObjective={(objectiveId) => {
                const obj = OBJECTIVES.find((o) => o.id === objectiveId);
                handleUpdateClassicConfig(
                  { objectiveId, orbitId: obj?.recommendedOrbitId || classicConfig.orbitId },
                  obj?.title || 'Mission Objective',
                );
              }}
              onSelectConstraint={(constraintId) =>
                handleUpdateClassicConfig({ constraintEventId: constraintId }, 'Mission Constraint')
              }
              onApplyArchetype={(arch: MissionArchetype) =>
                handleUpdateClassicConfig(arch.patch, arch.name)
              }
              onOpenTeamRoomModal={() => setShowTeamModal(true)}
              onEnterAssemblyBay={() => {
                audioSynth.playSelect();
                setClassicPhase('assembly');
              }}
            />
          )}

          {classicPhase === 'assembly' && (
            <Phase2AssemblyBay
              config={classicConfig}
              telemetry={classicTelemetry}
              activeCategory={activeCategory}
              collapsed={dockCollapsed}
              explodeAmount={explodeAmount}
              cameraPreset={cameraPreset}
              tradeOffPopup={tradeOffPopup}
              roomId={roomId}
              members={members}
              messages={messages}
              currentUid={user?.uid || null}
              onChangeCategory={setActiveCategory}
              onToggleCollapse={() => setDockCollapsed((c) => !c)}
              onChangeExplode={setExplodeAmount}
              onSelectCamera={(p) => {
                setCameraPreset(p);
                setCameraPresetNonce((n) => n + 1);
              }}
              onUpdateConfig={handleUpdateClassicConfig}
              onDismissTradeOff={() => setTradeOffPopup(null)}
              onChangeRole={(role) => {
                setSoloRole(role);
                if (roomId && user) {
                  const me = members.find((m) => m.uid === user.uid);
                  void updateMemberSeat(
                    roomId,
                    user.uid,
                    user.displayName || 'Engineer',
                    role,
                    me?.ready || false,
                  ).catch(() => {});
                }
              }}
              onToggleReady={() => {
                if (roomId && user) {
                  const me = members.find((m) => m.uid === user.uid);
                  void updateMemberSeat(
                    roomId,
                    user.uid,
                    user.displayName || 'Engineer',
                    me?.role || soloRole,
                    !(me?.ready || false),
                  ).catch(() => {});
                }
              }}
              onSendMessage={(text) => {
                if (roomId && user) {
                  const me = members.find((m) => m.uid === user.uid);
                  void sendRoomMessage(roomId, user, me?.role || soloRole, text, 'chat').catch(() => {});
                }
              }}
              onOpenDictionary={() => setShowDictionaryModal(true)}
              onOpenTeamModal={() => setShowTeamModal(true)}
              onProceedToPlanner={() => {
                audioSynth.playSelect();
                setClassicPhase('planner');
              }}
            />
          )}

          {classicPhase === 'planner' && (
            <Phase3LaunchPlanner
              config={classicConfig}
              telemetry={classicTelemetry}
              onUpdateConfig={handleUpdateClassicConfig}
              onBackToAssembly={() => setClassicPhase('assembly')}
              onLaunchSimulation={handleLaunchClassicSimulation}
            />
          )}

          {classicPhase === 'simulating' && (
            <Phase4Simulation
              config={classicConfig}
              telemetry={classicTelemetry}
              simProgress={classicSimProgress}
              simSpeed={classicSimSpeed}
              currentPhaseIndex={Math.min(3, Math.floor(classicSimProgress * 4))}
              samples={simSamples}
              activeAnomaly={activeAnomaly}
              resolvedCount={resolvedAnomalyIds.length}
              totalAnomalies={classicAnomalies.length}
              onToggleSpeed={() => setClassicSimSpeed((s) => (s === 1 ? 2 : 1))}
              onResolveAnomaly={(choice: AnomalyChoice) => {
                if (!activeAnomaly) return;
                audioSynth.playSelect();
                setChosenActions((prev) => [
                  ...prev,
                  {
                    scienceDelta: choice.scienceDelta,
                    marginDelta: choice.marginDelta,
                    collabDelta: choice.collabDelta,
                    powerShiftW: choice.powerShiftW,
                    dataShiftPct: choice.dataShiftPct,
                  },
                ]);
                setResolvedAnomalyIds((prev) => [...prev, activeAnomaly.id]);
                setActiveAnomaly(null);
              }}
              onAbortSimulation={() => setClassicPhase('planner')}
            />
          )}

          {classicPhase === 'debrief' && outcome && (
            <Phase5Debrief
              config={classicConfig}
              telemetry={classicTelemetry}
              outcome={outcome}
              runCount={roomState?.runCount ?? soloRunCount}
              previousScore={previousScore}
              user={user}
              roomId={roomId}
              roomTitle={roomState?.title || null}
              savedId={savedMissionId}
              saving={savingMission}
              publishedId={publishedLeaderboardId}
              publishing={publishingLeaderboard}
              onSaveMission={() => {
                if (!user) return;
                setSavingMission(true);
                void saveMissionRecord(
                  user,
                  classicConfig,
                  classicTelemetry,
                  outcome,
                  roomId ? 'team' : 'solo',
                  roomId || '',
                )
                  .then((id) => {
                    setSavedMissionId(id);
                    audioSynth.playSuccess();
                  })
                  .catch((err) => setToastError(err instanceof Error ? err.message : 'Unable to save mission.'))
                  .finally(() => setSavingMission(false));
              }}
              onPublishLeaderboard={() => {
                if (!user) return;
                setPublishingLeaderboard(true);
                void publishLeaderboardEntry(
                  user,
                  classicConfig,
                  classicTelemetry,
                  outcome,
                  roomId ? 'team' : 'solo',
                  roomState?.challengeMode || 'cooperative',
                  roomState?.title || user.displayName || 'Flight Engineer',
                )
                  .then((id) => {
                    setPublishedLeaderboardId(id);
                    audioSynth.playSuccess();
                  })
                  .catch((err) => setToastError(err instanceof Error ? err.message : 'Unable to publish entry.'))
                  .finally(() => setPublishingLeaderboard(false));
              }}
              onSignIn={() => void handleSignIn()}
              onModifyInAssembly={() => {
                setPreviousScore(outcome.totalScore);
                const nextRun = (roomState?.runCount ?? soloRunCount) + 1;
                setSoloRunCount(nextRun);
                if (roomId) void iterateRoomDesign(roomId, nextRun).catch(() => {});
                setClassicPhase('assembly');
              }}
              onModifyInPlanner={() => {
                setPreviousScore(outcome.totalScore);
                const nextRun = (roomState?.runCount ?? soloRunCount) + 1;
                setSoloRunCount(nextRun);
                if (roomId) void iterateRoomDesign(roomId, nextRun).catch(() => {});
                setClassicPhase('planner');
              }}
            />
          )}

        </div>
      )}

      {/* GLOBAL NPC FLIGHT COMPANION (Follows player across Title, NASA Architect & Team Hangar) */}
      <AstraAdvisor
        appView={appView}
        nasaSegment={currentNasaSegment}
        architectMode={architectMode}
        selectedObjective={selectedObjective}
        selectedRocket={selectedRocket}
        selectedPropulsion={selectedPropulsion}
        propellantBudgetKg={propellantBudgetKg}
        nasaInstruments={nasaInstruments}
        burnState={burnState}
        orbitState={orbitState}
        groundComm={groundComm}
        opsState={opsState}
        landmarks={landmarks}
        verificationScorecard={verificationScorecard}
        classicPhase={classicPhase}
        classicConfig={classicConfig}
        classicTelemetry={classicTelemetry}
        activeAnomalyTitle={activeAnomaly?.title || null}
        unifiedSnapshot={unifiedSnapshot}
        onOpenDictionary={() => setShowDictionaryModal(true)}
      />

      {/* SHARED MODALS */}
      {showDictionaryModal && (
        <MissionDictionaryModal onClose={() => setShowDictionaryModal(false)} />
      )}

      {showGuideModal && (
        <MissionGuideModal
          currentDifficulty={classicConfig.difficulty}
          onSelectDifficulty={handleSelectDifficulty}
          onClose={() => setShowGuideModal(false)}
        />
      )}

      {showTeamModal && (
        <TeamRoomModal
          user={user}
          defaultObjectiveId={classicConfig.objectiveId}
          onClose={() => setShowTeamModal(false)}
          onSignIn={handleSignIn}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      )}

      {showArchiveModal && (
        <MissionArchiveModal
          user={user}
          currentConfig={classicConfig}
          onLoadConfig={(loadedConfig, label) => {
            setClassicConfig(loadedConfig);
            setShowArchiveModal(false);
            setAppView('classic-hangar');
            setClassicPhase('assembly');
            audioSynth.playMountPart();
            setTradeOffPopup({
              id: String(Date.now()),
              title: `Loaded ${label}`,
              summary: 'Imported mission architecture into the 3D assembly bay.',
              deltas: [],
            });
          }}
          onClose={() => setShowArchiveModal(false)}
          onSignIn={() => void handleSignIn()}
        />
      )}

      {toastError && (
        <div className="fixed bottom-4 left-4 z-50 border border-rose-500/60 bg-rose-950/95 px-4 py-2.5 text-xs text-rose-100 shadow-2xl flex items-center gap-3">
          <span>{toastError}</span>
          <button
            type="button"
            onClick={() => setToastError(null)}
            className="text-rose-300 hover:text-white font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
