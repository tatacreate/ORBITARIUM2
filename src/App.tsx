import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { audioSynth } from './audio/synth';
import { DebriefModal } from './components/DebriefModal';
import { EngineeringDock } from './components/EngineeringDock';
import { MissionArchiveModal } from './components/MissionArchiveModal';
import { MissionBriefingModal } from './components/MissionBriefingModal';
import { MissionGuideModal } from './components/MissionGuideModal';
import { MissionDictionaryModal } from './components/MissionDictionaryModal';
import { SimulationOverlay } from './components/SimulationOverlay';
import { TeamRoomModal } from './components/TeamRoomModal';
import { TitleScreen } from './components/TitleScreen';
import { TopTelemetryBar } from './components/TopTelemetryBar';
import { DEFAULT_MISSION_CONFIG, OBJECTIVES } from './data/catalog';
import {
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
  CameraPreset,
  DifficultyLevel,
  EngineeringRole,
  FlightAnomaly,
  MissionArchetype,
  MissionChallengeMode,
  MissionConfig,
  RoomMember,
  RoomMessage,
  RoomState,
  SimulationOutcome,
  SubsystemTab,
} from './types/mission';

type AppPhase = 'title' | 'briefing' | 'designing' | 'simulating' | 'debrief';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [phase, setPhase] = useState<AppPhase>('title');
  const [config, setConfig] = useState<MissionConfig>(DEFAULT_MISSION_CONFIG);
  const [activeTab, setActiveTab] = useState<SubsystemTab>('mission');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [explodeAmount, setExplodeAmount] = useState(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('hero');
  const [cameraPresetNonce, setCameraPresetNonce] = useState(0);
  const [muted, setMuted] = useState(false);

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
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [toastError, setToastError] = useState<string | null>(null);

  // Simulation State
  const [simProgress, setSimProgress] = useState(0);
  const [simSeed, setSimSeed] = useState(1042);
  const [anomalies, setAnomalies] = useState<FlightAnomaly[]>([]);
  const [resolvedAnomalyIds, setResolvedAnomalyIds] = useState<string[]>([]);
  const [activeAnomaly, setActiveAnomaly] = useState<FlightAnomaly | null>(null);
  const [chosenActions, setChosenActions] = useState<
    { scienceDelta: number; marginDelta: number; collabDelta: number }[]
  >([]);
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
          setPhase((prev) => (prev === 'designing' ? 'simulating' : prev));
        } else if (nextRoom.status === 'designing') {
          setPhase((prev) => (prev === 'debrief' ? 'designing' : prev));
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
    setPhase('designing');
    setActiveTab('team');
  };

  const handleJoinRoom = async (code: string) => {
    if (!user) return;
    const joined = await joinCollaborativeRoom(user, code);
    audioSynth.playMountPart();
    setRoomId(joined.roomId);
    setPreviousScore(null);
    setPhase('designing');
    setActiveTab('team');
  };

  const handleUpdateConfig = useCallback(
    (patch: Partial<MissionConfig>, changeSummary?: string) => {
      audioSynth.playMountPart();
      setConfig((prev) => {
        const next = { ...prev, ...patch };
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
    [roomId, user, roomState?.status, members, showToast],
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
    handleUpdateConfig(arch.patch, `Loaded ${arch.name} architecture`);
    setShowBriefingModal(false);
    setPhase('designing');
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
    }
  }, [phase, anomalies.length, config, simSeed]);

  const simStateRef = useRef({
    phase,
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

    const step = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const s = simStateRef.current;
      if (s.phase !== 'simulating') return;

      if (!s.activeAnomaly) {
        setSimProgress((prev) => {
          const next = Math.min(1, prev + dt * 0.095);

          const pending = s.anomalies.find(
            (a) =>
              !s.resolvedAnomalyIds.includes(a.id) &&
              ((a.phaseIndex === 1 && next >= 0.32) || (a.phaseIndex === 3 && next >= 0.78)),
          );
          if (pending) {
            audioSynth.playAlert();
            setActiveAnomaly(pending);
            return prev;
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
      },
    ]);
    setActiveAnomaly(null);
  };

  const handleIterateDesign = async () => {
    if (outcome) {
      setPreviousScore(outcome.totalScore);
    }
    setOutcome(null);
    if (roomId && roomState) {
      await iterateRoomDesign(roomId, (roomState.runCount || 1) + 1);
    } else {
      setSoloRunCount((c) => c + 1);
    }
    setPhase('designing');
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
      setPhase('designing');
    }
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
        !showGuideModal
      ) {
        e.preventDefault();
        handleStartSolo();
      } else if ((e.key === 'h' || e.key === 'H') && phase === 'designing') {
        e.preventDefault();
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'Escape') {
        setShowTeamModal(false);
        setShowArchiveModal(false);
        setShowGuideModal(false);
        setShowBriefingModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, showTeamModal, showArchiveModal, showGuideModal]);

  const sceneMode: 'title' | 'hangar' | 'orbit' =
    phase === 'title' ? 'title' : phase === 'simulating' || phase === 'debrief' ? 'orbit' : 'hangar';

  const currentPhaseIndex = Math.min(3, Math.floor(simProgress * 4));
  const activeRunCount = roomId ? roomState?.runCount || 1 : soloRunCount;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#050811]">
      <SpacecraftScene
        config={config}
        sceneMode={sceneMode}
        explodeAmount={phase === 'designing' ? explodeAmount : 0}
        cameraPreset={cameraPreset}
        cameraPresetNonce={cameraPresetNonce}
        simProgress={simProgress}
        onSelectSubsystem={(tab) => {
          audioSynth.playSelect();
          setActiveTab(tab);
          setDockCollapsed(false);
        }}
      />

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
        <MissionBriefingModal
          config={config}
          isInitialBriefing={true}
          onSelectObjective={handleSelectBriefingObjective}
          onApplyArchetype={handleApplyArchetype}
          onConfirmEnterHangar={() => {
            audioSynth.playSelect();
            setPhase('designing');
          }}
        />
      )}

      {phase === 'designing' && (
        <>
          <TopTelemetryBar
            config={config}
            telemetry={telemetry}
            roomId={roomId}
            memberCount={Math.max(1, members.length)}
            runCount={activeRunCount}
            muted={muted}
            onToggleMute={() => {
              const next = !muted;
              audioSynth.muted = next;
              setMuted(next);
            }}
            onBackToTitle={() => {
              setPhase('title');
              setExplodeAmount(0);
            }}
            onOpenTeamModal={() => setShowTeamModal(true)}
            onOpenArchive={() => setShowArchiveModal(true)}
            onOpenGuide={() => setShowGuideModal(true)}
            onOpenBriefing={() => setShowBriefingModal(true)}
            onStartSimulation={() => void handleStartSimulationClick()}
          />

          <EngineeringDock
            config={config}
            telemetry={telemetry}
            activeTab={activeTab}
            collapsed={dockCollapsed}
            explodeAmount={explodeAmount}
            cameraPreset={cameraPreset}
            roomId={roomId}
            members={members}
            messages={messages}
            currentUid={user?.uid || null}
            onChangeTab={(tab) => {
              audioSynth.playSelect();
              setActiveTab(tab);
            }}
            onToggleCollapse={() => setDockCollapsed((c) => !c)}
            onChangeExplode={setExplodeAmount}
            onSelectCamera={(preset) => {
              audioSynth.playSelect();
              setCameraPreset(preset);
              setCameraPresetNonce((n) => n + 1);
            }}
            onUpdateConfig={handleUpdateConfig}
            onChangeRole={(role) => void handleChangeRole(role)}
            onToggleReady={() => void handleToggleReady()}
            onSendMessage={(text) => void handleSendMessage(text)}
            onOpenTeamModal={() => setShowTeamModal(true)}
            onOpenBriefing={() => setShowBriefingModal(true)}
            onOpenDictionary={() => setShowDictionaryModal(true)}
          />
        </>
      )}

      {phase === 'simulating' && (
        <SimulationOverlay
          config={config}
          telemetry={telemetry}
          simProgress={simProgress}
          currentPhaseIndex={currentPhaseIndex}
          activeAnomaly={activeAnomaly}
          onResolveAnomaly={handleResolveAnomaly}
          onAbortSimulation={() => setPhase('designing')}
        />
      )}

      {phase === 'debrief' && outcome && (
        <DebriefModal
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
          onRedesign={() => void handleIterateDesign()}
        />
      )}

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
        <MissionDictionaryModal
          onClose={() => setShowDictionaryModal(false)}
        />
      )}

      {showBriefingModal && phase === 'designing' && (
        <MissionBriefingModal
          config={config}
          isInitialBriefing={false}
          onSelectObjective={handleSelectBriefingObjective}
          onApplyArchetype={handleApplyArchetype}
          onConfirmEnterHangar={() => setShowBriefingModal(false)}
          onClose={() => setShowBriefingModal(false)}
        />
      )}

      {toastError && (
        <div className="fixed top-14 right-4 z-40 max-w-sm border border-rose-500/60 bg-[#090d16] px-4 py-3 text-xs text-rose-200 shadow-xl">
          {toastError}
        </div>
      )}
    </main>
  );
}
