import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, db, googleProvider } from '../firebase';
import { DEFAULT_MISSION_CONFIG, OBJECTIVES } from '../data/catalog';
import type {
  EngineeringRole,
  LeaderboardEntry,
  MissionChallengeMode,
  MissionConfig,
  MissionRecord,
  RoomMember,
  RoomMessage,
  RoomState,
  SimulationOutcome,
  TelemetryReport,
} from '../types/mission';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function sanitizeId(raw: string, maxLen = 48): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, maxLen) || 'default';
}

function sanitizeText(raw: string, maxLen: number): string {
  const trimmed = raw.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : 'Engineer';
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(result.user);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function ensureUserProfile(user: User): Promise<void> {
  const uid = sanitizeId(user.uid, 128);
  const publicRef = doc(db, 'users', uid);
  const privateRef = doc(db, 'users', uid, 'private', 'info');
  const displayName = sanitizeText(user.displayName || 'Flight Engineer', 60);

  try {
    const snap = await getDoc(publicRef);
    if (!snap.exists()) {
      await setDoc(publicRef, {
        uid,
        displayName,
        missionsCompleted: 0,
        bestScore: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }

  if (user.email) {
    try {
      const privSnap = await getDoc(privateRef);
      if (!privSnap.exists()) {
        await setDoc(privateRef, {
          uid,
          email: user.email.slice(0, 160),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/private/info`);
    }
  }
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `APG-${suffix}`;
}

function buildCleanDesignMap(config: MissionConfig): MissionConfig {
  return {
    difficulty: config.difficulty || 'engineer',
    modelMode: config.modelMode === 'simplified' ? 'simplified' : 'realistic',
    constraintEventId: sanitizeId(config.constraintEventId || 'none'),
    objectiveId: sanitizeId(config.objectiveId),
    orbitId: sanitizeId(config.orbitId),
    launchVehicleId: sanitizeId(config.launchVehicleId),
    busId: sanitizeId(config.busId),
    propulsionId: sanitizeId(config.propulsionId),
    powerId: sanitizeId(config.powerId),
    batteryId: sanitizeId(config.batteryId || 'batt-simple-li'),
    commsId: sanitizeId(config.commsId),
    avionicsId: sanitizeId(config.avionicsId || 'avionics-simple'),
    adcsId: sanitizeId(config.adcsId || 'adcs-advanced'),
    shieldingId: sanitizeId(config.shieldingId),
    instrumentIds: config.instrumentIds.slice(0, 4).map((id) => sanitizeId(id)),
    solarSizing: Number(Math.min(2.0, Math.max(0.5, config.solarSizing)).toFixed(2)),
    propellantRatio: Number(Math.min(1.5, Math.max(0.5, config.propellantRatio)).toFixed(2)),
  };
}

export async function createCollaborativeRoom(
  user: User,
  title: string,
  initialConfig: MissionConfig = DEFAULT_MISSION_CONFIG,
  challengeMode: MissionChallengeMode = 'cooperative',
): Promise<string> {
  const uid = sanitizeId(user.uid, 128);
  const roomId = generateRoomCode();
  const roomRef = doc(db, 'rooms', roomId);
  const memberRef = doc(db, 'rooms', roomId, 'members', uid);
  const displayName = sanitizeText(user.displayName || 'Mission Lead', 60);
  const cleanCfg = buildCleanDesignMap(initialConfig);

  const batch = writeBatch(db);
  batch.set(roomRef, {
    roomId,
    hostUid: uid,
    title: sanitizeText(title, 80),
    status: 'designing',
    challengeMode,
    difficulty: cleanCfg.difficulty,
    modelMode: cleanCfg.modelMode,
    constraintEventId: cleanCfg.constraintEventId,
    runCount: 1,
    memberCount: 1,
    objectiveId: cleanCfg.objectiveId,
    orbitId: cleanCfg.orbitId,
    launchVehicleId: cleanCfg.launchVehicleId,
    busId: cleanCfg.busId,
    propulsionId: cleanCfg.propulsionId,
    powerId: cleanCfg.powerId,
    batteryId: cleanCfg.batteryId,
    commsId: cleanCfg.commsId,
    avionicsId: cleanCfg.avionicsId,
    adcsId: cleanCfg.adcsId,
    shieldingId: cleanCfg.shieldingId,
    instrumentIds: cleanCfg.instrumentIds,
    solarSizing: cleanCfg.solarSizing,
    propellantRatio: cleanCfg.propellantRatio,
    simulationSeed: Math.floor(Math.random() * 999999),
    finalScore: 0,
    grade: 'N/A',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(memberRef, {
    uid,
    displayName,
    role: 'director',
    ready: false,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return roomId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `rooms/${roomId}`);
  }
}

export async function joinCollaborativeRoom(user: User, rawRoomId: string): Promise<RoomState> {
  const roomId = sanitizeId(rawRoomId.toUpperCase(), 32);
  const uid = sanitizeId(user.uid, 128);
  const roomRef = doc(db, 'rooms', roomId);
  const memberRef = doc(db, 'rooms', roomId, 'members', uid);

  let roomSnap;
  try {
    roomSnap = await getDoc(roomRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `rooms/${roomId}`);
  }

  if (!roomSnap.exists()) {
    throw new Error(`Mission Room "${roomId}" was not found.`);
  }

  const roomData = roomSnap.data() as RoomState;

  // Check if user is already a member
  let alreadyMember = false;
  try {
    const memberSnap = await getDoc(memberRef);
    alreadyMember = memberSnap.exists();
  } catch {
    alreadyMember = false;
  }

  if (alreadyMember) {
    return roomData;
  }

  if (roomData.status !== 'designing') {
    throw new Error('This mission room has already launched.');
  }
  if (roomData.memberCount >= 4) {
    throw new Error('This mission room already has 4/4 engineers assigned.');
  }

  // Pick an open role
  const roles: EngineeringRole[] = ['director', 'propulsion', 'power', 'payload'];
  const assignedRole = roles[Math.min(3, roomData.memberCount)] || 'payload';

  const batch = writeBatch(db);
  batch.update(roomRef, {
    memberCount: roomData.memberCount + 1,
    updatedAt: serverTimestamp(),
  });
  batch.set(memberRef, {
    uid,
    displayName: sanitizeText(user.displayName || 'Engineer', 60),
    role: assignedRole,
    ready: false,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return { ...roomData, memberCount: roomData.memberCount + 1 };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

export function subscribeRoom(
  roomId: string,
  onRoom: (room: RoomState | null) => void,
  onMembers: (members: RoomMember[]) => void,
  onMessages: (messages: RoomMessage[]) => void,
): Unsubscribe {
  const cleanRoomId = sanitizeId(roomId, 32);
  const roomRef = doc(db, 'rooms', cleanRoomId);
  const membersRef = collection(db, 'rooms', cleanRoomId, 'members');
  const messagesQuery = query(
    collection(db, 'rooms', cleanRoomId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(60),
  );

  const unsubRoom = onSnapshot(
    roomRef,
    (snap) => {
      if (!snap.exists()) {
        onRoom(null);
      } else {
        onRoom(snap.data() as RoomState);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `rooms/${cleanRoomId}`);
    },
  );

  const unsubMembers = onSnapshot(
    membersRef,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as RoomMember);
      onMembers(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `rooms/${cleanRoomId}/members`);
    },
  );

  const unsubMessages = onSnapshot(
    messagesQuery,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<RoomMessage, 'id'>),
      }));
      onMessages(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `rooms/${cleanRoomId}/messages`);
    },
  );

  return () => {
    unsubRoom();
    unsubMembers();
    unsubMessages();
  };
}

export async function updateRoomConfig(roomId: string, config: MissionConfig): Promise<void> {
  const cleanRoomId = sanitizeId(roomId, 32);
  const roomRef = doc(db, 'rooms', cleanRoomId);
  const cleanCfg = buildCleanDesignMap(config);
  try {
    await updateDoc(roomRef, {
      difficulty: cleanCfg.difficulty,
      modelMode: cleanCfg.modelMode,
      constraintEventId: cleanCfg.constraintEventId,
      objectiveId: cleanCfg.objectiveId,
      orbitId: cleanCfg.orbitId,
      launchVehicleId: cleanCfg.launchVehicleId,
      busId: cleanCfg.busId,
      propulsionId: cleanCfg.propulsionId,
      powerId: cleanCfg.powerId,
      batteryId: cleanCfg.batteryId,
      commsId: cleanCfg.commsId,
      avionicsId: cleanCfg.avionicsId,
      adcsId: cleanCfg.adcsId,
      shieldingId: cleanCfg.shieldingId,
      instrumentIds: cleanCfg.instrumentIds,
      solarSizing: cleanCfg.solarSizing,
      propellantRatio: cleanCfg.propellantRatio,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${cleanRoomId}`);
  }
}

export async function updateMemberSeat(
  roomId: string,
  uid: string,
  displayName: string,
  role: EngineeringRole,
  ready: boolean,
): Promise<void> {
  const cleanRoomId = sanitizeId(roomId, 32);
  const cleanUid = sanitizeId(uid, 128);
  const memberRef = doc(db, 'rooms', cleanRoomId, 'members', cleanUid);
  try {
    await updateDoc(memberRef, {
      displayName: sanitizeText(displayName, 60),
      role,
      ready,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${cleanRoomId}/members/${cleanUid}`);
  }
}

export async function sendRoomMessage(
  roomId: string,
  user: User,
  role: EngineeringRole,
  text: string,
  kind: 'chat' | 'change' | 'signoff' = 'chat',
): Promise<void> {
  const cleanRoomId = sanitizeId(roomId, 32);
  const uid = sanitizeId(user.uid, 128);
  const messagesCol = collection(db, 'rooms', cleanRoomId, 'messages');
  try {
    await addDoc(messagesCol, {
      senderUid: uid,
      senderName: sanitizeText(user.displayName || 'Engineer', 60),
      role,
      text: sanitizeText(text, 280),
      kind,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `rooms/${cleanRoomId}/messages`);
  }
}

export async function startRoomSimulation(roomId: string, seed: number): Promise<void> {
  const cleanRoomId = sanitizeId(roomId, 32);
  const roomRef = doc(db, 'rooms', cleanRoomId);
  try {
    await updateDoc(roomRef, {
      status: 'simulating',
      simulationSeed: Math.max(0, Math.min(999999999, Math.round(seed))),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${cleanRoomId}`);
  }
}

export async function completeRoomSimulation(
  roomId: string,
  finalScore: number,
  grade: string,
): Promise<void> {
  const cleanRoomId = sanitizeId(roomId, 32);
  const roomRef = doc(db, 'rooms', cleanRoomId);
  try {
    await updateDoc(roomRef, {
      status: 'debrief',
      finalScore: Math.max(0, Math.min(500, Math.round(finalScore))),
      grade: grade.slice(0, 4),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${cleanRoomId}`);
  }
}

export async function iterateRoomDesign(roomId: string, nextRunCount: number): Promise<void> {
  const cleanRoomId = sanitizeId(roomId, 32);
  const roomRef = doc(db, 'rooms', cleanRoomId);
  try {
    await updateDoc(roomRef, {
      status: 'designing',
      runCount: Math.max(2, Math.min(500, nextRunCount)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${cleanRoomId}`);
  }
}

export async function saveMissionRecord(
  user: User,
  config: MissionConfig,
  telemetry: TelemetryReport,
  outcome: SimulationOutcome,
  mode: 'solo' | 'team',
  roomId = '',
): Promise<string> {
  const uid = sanitizeId(user.uid, 128);
  const objective = OBJECTIVES.find((o) => o.id === config.objectiveId) ?? OBJECTIVES[0];
  const missionsCol = collection(db, 'missions');
  const cleanCfg = buildCleanDesignMap(config);

  let docRef;
  try {
    docRef = await addDoc(missionsCol, {
      ownerUid: uid,
      ownerName: sanitizeText(user.displayName || 'Flight Engineer', 60),
      mode,
      difficulty: cleanCfg.difficulty,
      roomId: roomId ? sanitizeId(roomId, 32) : '',
      objectiveId: cleanCfg.objectiveId,
      objectiveTitle: sanitizeText(objective.title, 80),
      orbitId: cleanCfg.orbitId,
      launchVehicleId: cleanCfg.launchVehicleId,
      totalScore: Math.round(outcome.totalScore),
      grade: outcome.grade,
      scienceScore: Math.round(outcome.scienceScore),
      marginScore: Math.round(outcome.marginScore),
      budgetScore: Math.round(outcome.budgetScore),
      synergyScore: Math.round(outcome.synergyScore),
      collabScore: Math.round(outcome.collabScore),
      massKg: Math.round(telemetry.wetMassKg),
      costM: Number(telemetry.totalCostM.toFixed(1)),
      powerMarginW: Math.round(telemetry.powerMarginW),
      lifetimeMonths: Math.round(telemetry.estimatedLifetimeMonths),
      designConfig: cleanCfg,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'missions');
  }

  // Update user's mission stats
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as { missionsCompleted?: number; bestScore?: number };
      const prevCount = data.missionsCompleted || 0;
      const prevBest = data.bestScore || 0;
      await updateDoc(userRef, {
        missionsCompleted: prevCount + 1,
        bestScore: Math.max(prevBest, Math.round(outcome.totalScore)),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }

  return docRef.id;
}

export async function fetchUserMissions(uid: string): Promise<MissionRecord[]> {
  const cleanUid = sanitizeId(uid, 128);
  const q = query(
    collection(db, 'missions'),
    where('ownerUid', '==', cleanUid),
    limit(25),
  );
  try {
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<MissionRecord, 'id'> & { createdAt?: { toMillis?: () => number } }),
    }));
    list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'missions');
  }
}

export async function fetchUserHostedRooms(uid: string): Promise<RoomState[]> {
  const cleanUid = sanitizeId(uid, 128);
  const q = query(
    collection(db, 'rooms'),
    where('hostUid', '==', cleanUid),
    limit(15),
  );
  try {
    const snap = await getDocs(q);
    const list = snap.docs.map(
      (d) => d.data() as RoomState & { updatedAt?: { toMillis?: () => number } },
    );
    list.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'rooms');
  }
}

export async function deleteMissionRecord(missionId: string): Promise<void> {
  const cleanId = sanitizeId(missionId, 128);
  try {
    await deleteDoc(doc(db, 'missions', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `missions/${cleanId}`);
  }
}

export async function publishLeaderboardEntry(
  user: User,
  config: MissionConfig,
  telemetry: TelemetryReport,
  outcome: SimulationOutcome,
  mode: 'solo' | 'team',
  challengeMode: MissionChallengeMode,
  teamName: string,
): Promise<string> {
  const uid = sanitizeId(user.uid, 128);
  const objective = OBJECTIVES.find((o) => o.id === config.objectiveId) ?? OBJECTIVES[0];
  const cleanCfg = buildCleanDesignMap(config);
  const lbCol = collection(db, 'leaderboard');

  try {
    const docRef = await addDoc(lbCol, {
      ownerUid: uid,
      pilotName: sanitizeText(user.displayName || 'Flight Engineer', 60),
      teamName: sanitizeText(teamName || (mode === 'team' ? 'Mission Team' : 'Solo Architect'), 60),
      mode,
      challengeMode,
      difficulty: cleanCfg.difficulty,
      objectiveId: cleanCfg.objectiveId,
      objectiveTitle: sanitizeText(objective.title, 80),
      orbitId: cleanCfg.orbitId,
      launchVehicleId: cleanCfg.launchVehicleId,
      totalScore: Math.round(outcome.totalScore),
      grade: outcome.grade,
      scienceScore: Math.round(outcome.scienceScore),
      marginScore: Math.round(outcome.marginScore),
      budgetScore: Math.round(outcome.budgetScore),
      synergyScore: Math.round(outcome.synergyScore),
      collabScore: Math.round(outcome.collabScore),
      massKg: Math.round(telemetry.wetMassKg),
      costM: Number(telemetry.totalCostM.toFixed(1)),
      powerMarginW: Math.round(telemetry.powerMarginW),
      lifetimeMonths: Math.round(telemetry.estimatedLifetimeMonths),
      designConfig: cleanCfg,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'leaderboard');
  }
}

export async function fetchLeaderboardEntries(objectiveId?: string): Promise<LeaderboardEntry[]> {
  const baseCol = collection(db, 'leaderboard');
  const q = objectiveId
    ? query(baseCol, where('objectiveId', '==', sanitizeId(objectiveId)), limit(50))
    : query(baseCol, limit(50));
  try {
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<LeaderboardEntry, 'id'>),
    }));
    list.sort((a, b) => b.totalScore - a.totalScore);
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'leaderboard');
  }
}

export async function deleteLeaderboardEntry(entryId: string): Promise<void> {
  const cleanId = sanitizeId(entryId, 128);
  try {
    await deleteDoc(doc(db, 'leaderboard', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `leaderboard/${cleanId}`);
  }
}
