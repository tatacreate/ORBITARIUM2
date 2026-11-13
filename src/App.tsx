import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
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
import { DEFAULT_MISSION_CONFIG, OBJECTIVES } from './data/catalog';
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [config, setConfig] = useState<MissionConfig>(DEFAULT_MISSION_CONFIG);
  const [soloRole, setSoloRole] = useState<EngineeringRole>('director');
  const [activeCategory, setActiveCategory] = useState<BuilderCategory>('bus');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [explodeAmount, setExplodeAmount] = useState(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('hero');
  const [cameraPresetNonce, setCameraPresetNonce] = useState(0);
  const [muted, setMuted] = useState(false);
  const [tradeOffPopup, setTradeOffPopup] = useState<TradeOffPopup | null>(null);

  // Multi-run iteration tracking
  const [soloRunCount, setSoloRunCount] = useState(1);
  const [previousScore, setPreviousScore] = useState<number | null>(null);

  // Collaborative Team Room State
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);

  // Modals
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showDictionaryModal, setShowDictionaryModal] = useState(false);
  const [toastError, setToastError] = useState<string | null>(null);

  // Simulation State
  const [simProgress, setSimProgress] = useState(0);
  const [simSpeed, setSimSpeed] = useState<1 | 2>(1);
  const [simSeed, setSimSeed] = useState(1042);
  const [anomalies, setAnomalies] = useState<FlightAnomaly[]>([]);
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

  const telemetry = useMemo(() => computeTelemetry(config), [config]);

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

  // Firestore Real-Time Room Listener
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
        setConfig({
          difficulty: nextRoom.difficulty || 'engineer',
          modelMode: nextRoom.modelMode || 'realistic',
          constraintEventId: nextRoom.constraintEventId || 'none',
          objectiveId: nextRoom.objectiveId,
          orbitId: nextRoom.orbitId,
          launchVehicleId: nextRoom.launchVehicleId,
          busId: nextRoom.busId,
          propulsionId: nextRoom.propulsionId,
          powerId: nextRoom.powerId,
          batteryId: nextRoom.batteryId || 'batt-simple-li',
          commsId: nextRoom.commsId,
          avionicsId: nextRoom.avionicsId || 'avionics-simple',
          adcsId: nextRoom.adcsId || 'adcs-advanced',
          shieldingId: nextRoom.shieldingId,
          instrumentIds: nextRoom.instrumentIds,
          solarSizing: nextRoom.solarSizing,
          propellantRatio: nextRoom.propellantRatio,
        });
        if (nextRoom.status === 'simulating') {
          setSimSeed(nextRoom.simulationSeed);
          setPhase((prev) =>
            prev === 'briefing' || prev === 'assembly' || prev === 'planner'
              ? 'simulating'
              : prev,
          );
        } else if (nextRoom.status === 'designing') {
          setPhase((prev) => (prev === 'debrief' ? 'assembly' : prev));
        }
      },
      setMembers,
      setMessages,
    );
    return () => unsub();
  }, [authReady, user, roomId]);

  const showToast = useCallback((msg: string) => {
    setToastError(msg);
    setTimeout(() => {
      setToastError((curr) => (curr === msg ? null : curr));
    }, 4500);
  }, []);

  // Auto-dismiss trade-off popup after 6.5 seconds
  useEffect(() => {
    if (!tradeOffPopup) return;
    const timer = setTimeout(() => {
      setTradeOffPopup((curr) => (curr?.id === tradeOffPopup.id ? null : curr));
    }, 6500);
    return () => clearTimeout(timer);
  }, [tradeOffPopup]);

  const handleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithGoogle();
      audioSynth.playSelect();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Google Sign-In was cancelled.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setRoomId(null);
    setRoomState(null);
    setMembers([]);
    setMessages([]);
  };

  const handleStartSolo = () => {
    audioSynth.playSelect();
    setRoomId(null);
    setRoomState(null);
    setSoloRunCount(1);
    setPreviousScore(null);
    setPhase('briefing');
  };

  const handleCreateRoom = async (
    title: string,
    challengeMode: MissionChallengeMode,
    objectiveId: string,
  ) => {
    if (!user) return;
    const targetObj = OBJECTIVES.find((o) => o.id === objectiveId) ?? OBJECTIVES[0];
    const startConfig: MissionConfig =
      challengeMode === 'competitive'
        ? { ...config, objectiveId: targetObj.id, orbitId: targetObj.recommendedOrbitId }
        : config;
    const code = await createCollaborativeRoom(user, title, startConfig, challengeMode);
    audioSynth.playMountPart();
    setConfig(startConfig);
    setRoomId(code);
    setPreviousScore(null);
    setPhase('assembly');
    setActiveCategory('team');
  };

  const handleJoinRoom = async (code: string) => {
    if (!user) return;
    const joined = await joinCollaborativeRoom(user, code);
    audioSynth.playMountPart();
    setRoomId(joined.roomId);
    setPreviousScore(null);
    setPhase('assembly');
    setActiveCategory('team');
  };

  const handleUpdateConfig = useCallback(
    (patch: Partial<MissionConfig>, changeSummary?: string) => {
      audioSynth.playMountPart();
      setConfig((prev) => {
        const next = { ...prev, ...patch };
        if (changeSummary && phase === 'assembly') {
          const popup = buildTradeOffPopup(prev, next, changeSummary);
          if (popup) setTradeOffPopup(popup);
        }
        if (roomId && user && roomState?.status === 'designing') {
          void updateRoomConfig(roomId, next).catch((err) =>
            showToast(err instanceof Error ? err.message : 'Sync failed.'),
          );
          if (changeSummary) {
            const myRole = members.find((m) => m.uid === user.uid)?.role || 'director';
            void sendRoomMessage(roomId, user, myRole, changeSummary, 'change').catch(() => {});
          }
        }
        return next;
      });
    },
    [roomId, user, roomState?.status, members, showToast, phase],
  );

  const handleChangeDifficulty = (difficulty: DifficultyLevel) => {
    handleUpdateConfig({ difficulty }, `Switched difficulty to ${difficulty}`);
  };

  const handleSelectBriefingObjective = (objectiveId: string) => {
    const obj = OBJECTIVES.find((o) => o.id === objectiveId);
    if (!obj) return;
    handleUpdateConfig(
      { objectiveId: obj.id, orbitId: obj.recommendedOrbitId },
      `Set objective to ${obj.title}`,
    );
  };

  const handleApplyArchetype = (arch: MissionArchetype) => {
    handleUpdateConfig(arch.patch, `Loaded ${arch.name} blueprint`);
    setPhase('assembly');
  };

  const handleChangeRole = async (role: EngineeringRole) => {
    if (!roomId || !user) return;
    audioSynth.playSelect();
    const mySeat = members.find((m) => m.uid === user.uid);
    await updateMemberSeat(
      roomId,
      user.uid,
      user.displayName || 'Engineer',
      role,
      mySeat?.ready || false,
    );
  };

  const handleToggleReady = async () => {
    if (!roomId || !user) return;
    const mySeat = members.find((m) => m.uid === user.uid);
    const nextReady = !(mySeat?.ready || false);
    audioSynth.playSelect();
    await updateMemberSeat(
      roomId,
      user.uid,
      user.displayName || 'Engineer',
      mySeat?.role || 'director',
      nextReady,
    );
    await sendRoomMessage(
      roomId,
      user,
      mySeat?.role || 'director',
      nextReady ? 'Signed off on subsystem readiness.' : 'Reopened subsystem for edits.',
      'signoff',
    );
  };

  const handleSendMessage = async (text: string) => {
    if (!roomId || !user) return;
    const mySeat = members.find((m) => m.uid === user.uid);
    await sendRoomMessage(roomId, user, mySeat?.role || 'director', text, 'chat');
  };

  const beginSimulation = useCallback(
    (seed: number) => {
      audioSynth.playIgnition();
      setSimProgress(0);
      setAnomalies(generateFlightAnomalies(config, seed));
      setResolvedAnomalyIds([]);
      setActiveAnomaly(null);
      setChosenActions([]);
      setSimSamples([]);
      setOutcome(null);
      setSavedMissionId(null);
      setPublishedLeaderboardId(null);
      setPhase('simulating');
    },
    [config],
  );

  const handleStartSimulationClick = async () => {
    const seed = Math.floor(Math.random() * 900000) + 10000;
    setSimSeed(seed);
    if (roomId && roomState?.status === 'designing') {
      await startRoomSimulation(roomId, seed);
    }
    beginSimulation(seed);
  };

  useEffect(() => {
    if (phase === 'simulating' && anomalies.length === 0) {
      setAnomalies(generateFlightAnomalies(config, simSeed));
      setSimProgress(0);
      setResolvedAnomalyIds([]);
      setActiveAnomaly(null);
      setChosenActions([]);
      setSimSamples([]);
    }
  }, [phase, anomalies.length, config, simSeed]);

  const simStateRef = useRef({
    phase,
    simSpeed,
    activeAnomaly,
    anomalies,
    resolvedAnomalyIds,
    chosenActions,
    config,
    telemetry,
    members,
    roomId,
  });
  simStateRef.current = {
    phase,
    simSpeed,
    activeAnomaly,
    anomalies,
    resolvedAnomalyIds,
    chosenActions,
    config,
    telemetry,
    members,
    roomId,
  };

  useEffect(() => {
    if (phase !== 'simulating') return;
    let rafId = 0;
    let lastTime = performance.now();
    let lastSampleAt = 0;

    const step = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const s = simStateRef.current;
      if (s.phase !== 'simulating') return;

      if (!s.activeAnomaly) {
        setSimProgress((prev) => {
          const speedMult = s.simSpeed === 2 ? 1.85 : 1.0;
          const next = Math.min(1, prev + dt * 0.075 * speedMult);

          const pending = s.anomalies.find(
            (a) => !s.resolvedAnomalyIds.includes(a.id) && next >= a.triggerProgress,
          );
          if (pending) {
            audioSynth.playAlert();
            setActiveAnomaly(pending);
            return prev;
          }

          // Sample telemetry every ~0.25s for live resource graph
          if (now - lastSampleAt > 240) {
            lastSampleAt = now;
            const powerShift = s.chosenActions.reduce((acc, a) => acc + (a.powerShiftW || 0), 0);
            const dataShift = s.chosenActions.reduce((acc, a) => acc + (a.dataShiftPct || 0), 0);
            const basePowerPct = Math.max(
              15,
              Math.min(
                98,
                72 + ((s.telemetry.powerMarginW + powerShift) / Math.max(200, s.telemetry.powerGeneratedW)) * 35,
              ),
            );
            const ripple = Math.sin(next * 24) * 5;
            const baseDataPct = Math.max(
              10,
              Math.min(
                98,
                (s.telemetry.dataGeneratedGBDay / Math.max(1, s.telemetry.downlinkCapacityGBDay)) * 55 + dataShift,
              ),
            );
            setSimSamples((old) => [
              ...old.slice(-36),
              {
                progress: next,
                powerPct: Math.max(8, Math.min(98, basePowerPct + ripple)),
                dataPct: Math.max(8, Math.min(98, baseDataPct + Math.cos(next * 19) * 4)),
                sciencePct: Math.round(next * 100),
              },
            ]);
          }

          if (next >= 1) {
            const allReady = s.members.length > 0 && s.members.every((m) => m.ready);
            const result = evaluateSimulationOutcome(
              s.config,
              s.telemetry,
              s.chosenActions,
              Math.max(1, s.members.length),
              allReady,
            );
            audioSynth.playSuccess();
            setOutcome(result);
            setPhase('debrief');
            if (s.roomId) {
              void completeRoomSimulation(s.roomId, result.totalScore, result.grade).catch(
                () => {},
              );
            }
          }
          return next;
        });
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [phase]);

  const handleResolveAnomaly = (choice: AnomalyChoice) => {
    if (!activeAnomaly) return;
    audioSynth.playSelect();
    setResolvedAnomalyIds((prev) => [...prev, activeAnomaly.id]);
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
    setActiveAnomaly(null);
  };

  const handleIterateDesign = async (targetPhase: 'assembly' | 'planner') => {
    if (outcome) {
      setPreviousScore(outcome.totalScore);
    }
    setOutcome(null);
    if (roomId && roomState) {
      await iterateRoomDesign(roomId, (roomState.runCount || 1) + 1);
    } else {
      setSoloRunCount((c) => c + 1);
    }
    setPhase(targetPhase);
  };

  const handleSaveMission = async () => {
    if (!user || !outcome || savedMissionId) return;
    setSavingMission(true);
    try {
      const id = await saveMissionRecord(
        user,
        config,
        telemetry,
        outcome,
        roomId ? 'team' : 'solo',
        roomId || '',
      );
      setSavedMissionId(id);
      audioSynth.playSuccess();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save mission.');
    } finally {
      setSavingMission(false);
    }
  };

  const handlePublishLeaderboard = async () => {
    if (!user || !outcome || publishedLeaderboardId) return;
    setPublishingLeaderboard(true);
    try {
      const id = await publishLeaderboardEntry(
        user,
        config,
        telemetry,
        outcome,
        roomId ? 'team' : 'solo',
        roomState?.challengeMode || 'cooperative',
        roomId ? roomState?.title || `Team ${roomId}` : user.displayName || 'Solo Architect',
      );
      setPublishedLeaderboardId(id);
      audioSynth.playSuccess();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to publish to leaderboard.');
    } finally {
      setPublishingLeaderboard(false);
    }
  };

  const handleLoadConfig = (nextConfig: MissionConfig, label: string) => {
    handleUpdateConfig(nextConfig, label);
    if (phase === 'title' || phase === 'briefing') {
      setPhase('assembly');
    }
  };

  const handleSceneSubsystemSelect = (tab: SubsystemTab) => {
    audioSynth.playSelect();
    const mapped: BuilderCategory =
      tab === 'payload'
        ? 'science'
        : tab === 'power'
          ? 'power'
          : tab === 'team'
            ? 'team'
            : 'bus';
    setActiveCategory(mapped);
    setDockCollapsed(false);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (
        e.key === 'Enter' &&
        phase === 'title' &&
        !showTeamModal &&
        !showArchiveModal &&
        !showGuideModal &&
        !showDictionaryModal
      ) {
        e.preventDefault();
        handleStartSolo();
      } else if ((e.key === 'h' || e.key === 'H') && phase === 'assembly') {
        e.preventDefault();
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'Escape') {
        setShowTeamModal(false);
        setShowArchiveModal(false);
        setShowGuideModal(false);
        setShowDictionaryModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, showTeamModal, showArchiveModal, showGuideModal, showDictionaryModal]);

  const sceneMode: 'title' | 'hangar' | 'planner' | 'orbit' =
    phase === 'title'
      ? 'title'
      : phase === 'planner'
        ? 'planner'
        : phase === 'simulating' || phase === 'debrief'
          ? 'orbit'
          : 'hangar';

  const currentPhaseIndex =
    simProgress < 0.22 ? 0 : simProgress < 0.45 ? 1 : simProgress < 0.72 ? 2 : 3;
  const activeRunCount = roomId ? roomState?.runCount || 1 : soloRunCount;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#050811]">
      <SpacecraftScene
        config={config}
        sceneMode={sceneMode}
        explodeAmount={phase === 'assembly' ? explodeAmount : 0}
        cameraPreset={cameraPreset}
        cameraPresetNonce={cameraPresetNonce}
        simProgress={simProgress}
        onSelectSubsystem={handleSceneSubsystemSelect}
      />

      {phase !== 'title' && (
        <PhaseHeader
          phase={phase}
          config={config}
          telemetry={telemetry}
          roomId={roomId}
          memberCount={Math.max(1, members.length)}
          runCount={activeRunCount}
          muted={muted}
          onNavigatePhase={(target) => {
            audioSynth.playSelect();
            if (target === 'title') setExplodeAmount(0);
            setPhase(target);
          }}
          onToggleMute={() => {
            const next = !muted;
            audioSynth.muted = next;
            setMuted(next);
          }}
          onOpenDictionary={() => setShowDictionaryModal(true)}
          onOpenTeamModal={() => setShowTeamModal(true)}
          onOpenArchive={() => setShowArchiveModal(true)}
          onLaunchMission={() => void handleStartSimulationClick()}
        />
      )}

      {phase === 'title' && (
        <TitleScreen
          user={user}
          authLoading={authLoading}
          difficulty={config.difficulty}
          onSelectDifficulty={handleChangeDifficulty}
          onSignIn={() => void handleSignIn()}
          onSignOut={() => void handleSignOut()}
          onStartSolo={handleStartSolo}
          onOpenTeamModal={() => setShowTeamModal(true)}
          onOpenArchive={() => setShowArchiveModal(true)}
          onOpenGuide={() => setShowGuideModal(true)}
        />
      )}

      {phase === 'briefing' && (
        <Phase1Briefing
          config={config}
          roomId={roomId}
          selectedSoloRole={soloRole}
          onSelectSoloRole={(r) => {
            audioSynth.playSelect();
            setSoloRole(r);
          }}
          onSelectDifficulty={handleChangeDifficulty}
          onSelectObjective={handleSelectBriefingObjective}
          onSelectConstraint={(constraintEventId) =>
            handleUpdateConfig({ constraintEventId }, 'Changed flight weather')
          }
          onApplyArchetype={handleApplyArchetype}
          onOpenTeamRoomModal={() => setShowTeamModal(true)}
          onEnterAssemblyBay={() => {
            audioSynth.playSelect();
            setPhase('assembly');
          }}
        />
      )}

      {phase === 'assembly' && (
        <Phase2AssemblyBay
          config={config}
          telemetry={telemetry}
          activeCategory={activeCategory}
          collapsed={dockCollapsed}
          explodeAmount={explodeAmount}
          cameraPreset={cameraPreset}
          tradeOffPopup={tradeOffPopup}
          roomId={roomId}
          members={members}
          messages={messages}
          currentUid={user?.uid || null}
          onChangeCategory={(cat) => {
            audioSynth.playSelect();
            setActiveCategory(cat);
          }}
          onToggleCollapse={() => setDockCollapsed((c) => !c)}
          onChangeExplode={setExplodeAmount}
          onSelectCamera={(preset) => {
            audioSynth.playSelect();
            setCameraPreset(preset);
            setCameraPresetNonce((n) => n + 1);
          }}
          onUpdateConfig={handleUpdateConfig}
          onDismissTradeOff={() => setTradeOffPopup(null)}
          onChangeRole={(role) => void handleChangeRole(role)}
          onToggleReady={() => void handleToggleReady()}
          onSendMessage={(text) => void handleSendMessage(text)}
          onOpenDictionary={() => setShowDictionaryModal(true)}
          onOpenTeamModal={() => setShowTeamModal(true)}
          onProceedToPlanner={() => {
            audioSynth.playSelect();
            setExplodeAmount(0);
            setPhase('planner');
          }}
        />
      )}

      {phase === 'planner' && (
        <Phase3LaunchPlanner
          config={config}
          telemetry={telemetry}
          onUpdateConfig={handleUpdateConfig}
          onBackToAssembly={() => {
            audioSynth.playSelect();
            setPhase('assembly');
          }}
          onLaunchSimulation={() => void handleStartSimulationClick()}
        />
      )}

      {phase === 'simulating' && (
        <Phase4Simulation
          config={config}
          telemetry={telemetry}
          simProgress={simProgress}
          simSpeed={simSpeed}
          currentPhaseIndex={currentPhaseIndex}
          samples={simSamples}
          activeAnomaly={activeAnomaly}
          resolvedCount={resolvedAnomalyIds.length}
          totalAnomalies={anomalies.length}
          onToggleSpeed={() => setSimSpeed((s) => (s === 1 ? 2 : 1))}
          onResolveAnomaly={handleResolveAnomaly}
          onAbortSimulation={() => setPhase('planner')}
        />
      )}

      {phase === 'debrief' && outcome && (
        <Phase5Debrief
          config={config}
          telemetry={telemetry}
          outcome={outcome}
          runCount={activeRunCount}
          previousScore={previousScore}
          user={user}
          roomId={roomId}
          roomTitle={roomState?.title || null}
          savedId={savedMissionId}
          saving={savingMission}
          publishedId={publishedLeaderboardId}
          publishing={publishingLeaderboard}
          onSaveMission={() => void handleSaveMission()}
          onPublishLeaderboard={() => void handlePublishLeaderboard()}
          onSignIn={() => void handleSignIn()}
          onModifyInAssembly={() => void handleIterateDesign('assembly')}
          onModifyInPlanner={() => void handleIterateDesign('planner')}
        />
      )}

      {/* Corner A.S.T.R.A. Friendly AI Mission Advisor */}
      <AstraAdvisor
        phase={phase}
        config={config}
        telemetry={telemetry}
        activeAnomalyTitle={activeAnomaly?.title || null}
        onOpenDictionary={() => setShowDictionaryModal(true)}
      />

      {showTeamModal && (
        <TeamRoomModal
          user={user}
          defaultObjectiveId={config.objectiveId}
          onClose={() => setShowTeamModal(false)}
          onSignIn={handleSignIn}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      )}

      {showArchiveModal && (
        <MissionArchiveModal
          user={user}
          currentConfig={config}
          onLoadConfig={handleLoadConfig}
          onClose={() => setShowArchiveModal(false)}
          onSignIn={() => void handleSignIn()}
        />
      )}

      {showGuideModal && (
        <MissionGuideModal
          currentDifficulty={config.difficulty}
          onSelectDifficulty={handleChangeDifficulty}
          onClose={() => setShowGuideModal(false)}
        />
      )}

      {showDictionaryModal && (
        <MissionDictionaryModal onClose={() => setShowDictionaryModal(false)} />
      )}

      {toastError && (
        <div className="fixed top-14 right-4 z-50 max-w-sm border border-rose-500/60 bg-[#090d16] px-4 py-3 text-xs text-rose-200 shadow-xl">
          {toastError}
        </div>
      )}
    </main>
  );
}
