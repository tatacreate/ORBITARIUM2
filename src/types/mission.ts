export type EngineeringRole = 'director' | 'propulsion' | 'power' | 'payload';

export type DifficultyLevel = 'junior' | 'cadet' | 'engineer' | 'director' | 'sandbox';

export type SpacecraftModelMode = 'simplified' | 'realistic';

export type MissionChallengeMode = 'cooperative' | 'competitive';

export type SubsystemTab = 'mission' | 'bus' | 'power' | 'payload' | 'team';

export type BuilderCategory = 'bus' | 'power' | 'comms' | 'science' | 'team';

export type CameraPreset = 'hero' | 'payload' | 'propulsion' | 'power';

export type CelestialBodyId = 'earth' | 'moon' | 'mars' | 'europa' | 'psyche';

export type GamePhase = 'title' | 'briefing' | 'assembly' | 'planner' | 'simulating' | 'debrief';

export interface DifficultySpec {
  id: DifficultyLevel;
  label: string;
  shortLabel: string;
  tagline: string;
  budgetMultiplier: number;
  payloadMultiplier: number;
  radiationMultiplier: number;
  showQuickFixes: boolean;
  scoreBonusMultiplier: number;
  isSandbox?: boolean;
}

export interface RandomConstraintSpec {
  id: string;
  title: string;
  description: string;
  impactSummary: string;
  budgetMult: number;
  payloadMult: number;
  radiationMult: number;
  dataMult: number;
  linkBonusDb: number;
  scienceBonus: number;
}

export interface MissionObjective {
  id: string;
  title: string;
  badgeLabel: string;
  targetBody: CelestialBodyId;
  recommendedOrbitId: string;
  budgetCapM: number;
  minScienceValue: number;
  minLifetimeMonths: number;
  preferredInstruments: string[];
  radiationSeverity: number;
  summary: string;
  storyHook: string;
  constraintsNote: string;
}

export interface MissionArchetype {
  id: string;
  objectiveId: string;
  name: string;
  strategyTag: string;
  tradeOffNote: string;
  patch: Partial<MissionConfig>;
}

export interface OrbitSpec {
  id: string;
  name: string;
  shortName: string;
  ringType: 'leo' | 'polar' | 'geo' | 'lunar' | 'interplanetary';
  body: CelestialBodyId;
  altitudeKm: number;
  requiredDeltaVKms: number;
  solarDistanceAU: number;
  commsDistanceAU: number;
  radiationDoseRate: number;
  eclipseFraction: number;
  payloadMultiplier: number;
  coverageNote: string;
  delayNote: string;
  description: string;
}

export interface LaunchVehicleSpec {
  id: string;
  name: string;
  tierLabel: 'Light Rocket' | 'Medium Reusable' | 'Heavy Lift' | 'Super-Heavy';
  costM: number;
  leoCapacityKg: number;
  fairingDiameterM: number;
  maxBusTier: number;
  reliability: number;
  heightMeters: number;
  stages: number;
  accentColor: string;
  description: string;
}

export interface BusSpec {
  id: string;
  name: string;
  shortLabel: string;
  tier: number;
  dryMassKg: number;
  costM: number;
  maxInstruments: number;
  basePowerW: number;
  dataBufferGB: number;
  pointingAccuracyArcsec: number;
  description: string;
  tradeOffTip: string;
}

export interface PropulsionSpec {
  id: string;
  name: string;
  ispSec: number;
  thrustN: number;
  dryMassKg: number;
  costM: number;
  powerDrawW: number;
  electricPropulsion: boolean;
  description: string;
}

export interface PowerSpec {
  id: string;
  name: string;
  shortLabel: string;
  kind: 'solar' | 'nuclear';
  baseOutputWAt1AU: number;
  massKg: number;
  costM: number;
  wasteHeatBonusC: number;
  description: string;
  tradeOffTip: string;
}

export interface CommsSpec {
  id: string;
  name: string;
  shortLabel: string;
  band: 'S-Band' | 'Ka-Band' | 'Optical';
  massKg: number;
  costM: number;
  powerDrawW: number;
  baseRateMbpsAt1AU: number;
  gainDb: number;
  requiresFinePointing: boolean;
  description: string;
  tradeOffTip: string;
}

export interface ShieldingSpec {
  id: string;
  name: string;
  massKg: number;
  costM: number;
  powerDrawW: number;
  radToleranceKrad: number;
  thermalRating: number;
  description: string;
}

export interface InstrumentSpec {
  id: string;
  name: string;
  shortName: string;
  massKg: number;
  powerDrawW: number;
  dataRateGBPerDay: number;
  costM: number;
  scienceBase: number;
  category: 'imaging' | 'radar' | 'spectrometry' | 'fields';
  description: string;
  tradeOffTip: string;
}

export interface AvionicsSpec {
  id: string;
  name: string;
  complexity: 'simple' | 'advanced';
  massKg: number;
  costM: number;
  powerDrawW: number;
  dataBufferGB: number;
  description: string;
}

export interface AdcsSpec {
  id: string;
  name: string;
  complexity: 'simple' | 'advanced';
  pointingAccuracyArcsec: number;
  massKg: number;
  costM: number;
  powerDrawW: number;
  description: string;
}

export interface BatterySpec {
  id: string;
  name: string;
  complexity: 'simple' | 'advanced';
  capacityWh: number;
  massKg: number;
  costM: number;
  description: string;
}

export interface MissionConfig {
  difficulty: DifficultyLevel;
  modelMode?: SpacecraftModelMode;
  constraintEventId?: string;
  objectiveId: string;
  orbitId: string;
  launchVehicleId: string;
  busId: string;
  propulsionId: string;
  powerId: string;
  batteryId: string;
  commsId: string;
  avionicsId: string;
  adcsId: string;
  shieldingId: string;
  instrumentIds: string[];
  solarSizing: number;
  propellantRatio: number;
}

export type ConstraintStatus = 'Nominal' | 'Tight' | 'Critical';

export interface EngineeringAdvisory {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  subsystem: SubsystemTab;
  message: string;
  plainTerms: string;
  quickFix?: {
    label: string;
    patch: Partial<MissionConfig>;
  };
}

export interface TelemetryReport {
  totalCostM: number;
  budgetCapM: number;
  budgetStatus: ConstraintStatus;

  dryMassKg: number;
  propellantMassKg: number;
  wetMassKg: number;
  payloadCapacityKg: number;
  massStatus: ConstraintStatus;

  availableDeltaVKms: number;
  requiredDeltaVKms: number;
  deltaVStatus: ConstraintStatus;

  solarFluxFactor: number;
  powerGeneratedW: number;
  powerPeakDrawW: number;
  powerMarginW: number;
  powerStatus: ConstraintStatus;

  dataGeneratedGBDay: number;
  downlinkCapacityGBDay: number;
  dataRateMbps: number;
  downlinkMbps: number;
  commsDelaySec: number;
  linkMarginDb: number;
  dataStatus: ConstraintStatus;

  estimatedLifetimeMonths: number;
  estimatedLifetimeYears: number;
  requiredLifetimeMonths: number;
  lifetimeStatus: ConstraintStatus;

  scienceReturnPotential: number;
  synergies: string[];
  advisories: EngineeringAdvisory[];
  launchReady: boolean;
  criticalFailureReason: string | null;
}

export interface TradeOffPopup {
  id: string;
  title: string;
  summary: string;
  deltas: { label: string; tone: 'good' | 'warn' | 'neutral' }[];
}

export interface AnomalyChoice {
  id: string;
  label: string;
  detail: string;
  whyItMatters?: string;
  scienceDelta: number;
  marginDelta: number;
  collabDelta: number;
  powerShiftW?: number;
  dataShiftPct?: number;
}

export interface FlightAnomaly {
  id: string;
  phaseIndex: number;
  triggerProgress: number;
  leadRole: EngineeringRole;
  title: string;
  description: string;
  choices: AnomalyChoice[];
}

export interface CriterionCheck {
  label: string;
  passed: boolean;
  detail: string;
  whyItMattered: string;
}

export interface SimulationOutcome {
  totalScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'F';
  scienceScore: number;
  marginScore: number;
  budgetScore: number;
  synergyScore: number;
  collabScore: number;
  missionSuccess: boolean;
  failureDay: number | null;
  failureSummary: string | null;
  criteriaChecks: CriterionCheck[];
  lessons: string[];
}

export interface RoomState {
  roomId: string;
  hostUid: string;
  title: string;
  status: 'designing' | 'simulating' | 'debrief' | 'archived';
  challengeMode?: MissionChallengeMode;
  difficulty: DifficultyLevel;
  modelMode?: SpacecraftModelMode;
  constraintEventId?: string;
  runCount: number;
  memberCount: number;
  objectiveId: string;
  orbitId: string;
  launchVehicleId: string;
  busId: string;
  propulsionId: string;
  powerId: string;
  batteryId: string;
  commsId: string;
  avionicsId: string;
  adcsId: string;
  shieldingId: string;
  instrumentIds: string[];
  solarSizing: number;
  propellantRatio: number;
  simulationSeed: number;
  finalScore: number;
  grade: string;
}

export interface RoomMember {
  uid: string;
  displayName: string;
  role: EngineeringRole;
  ready: boolean;
}

export interface RoomMessage {
  id: string;
  senderUid: string;
  senderName: string;
  role: EngineeringRole;
  text: string;
  kind: 'chat' | 'change' | 'signoff';
}

export interface MissionRecord {
  id: string;
  ownerUid: string;
  ownerName: string;
  mode: 'solo' | 'team';
  difficulty: DifficultyLevel;
  roomId: string;
  objectiveId: string;
  objectiveTitle: string;
  orbitId: string;
  launchVehicleId: string;
  totalScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'F';
  scienceScore: number;
  marginScore: number;
  budgetScore: number;
  synergyScore: number;
  collabScore: number;
  massKg: number;
  costM: number;
  powerMarginW: number;
  lifetimeMonths: number;
  designConfig?: MissionConfig;
}

export interface LeaderboardEntry {
  id: string;
  ownerUid: string;
  pilotName: string;
  teamName: string;
  mode: 'solo' | 'team';
  challengeMode: MissionChallengeMode;
  difficulty: DifficultyLevel;
  objectiveId: string;
  objectiveTitle: string;
  orbitId: string;
  launchVehicleId: string;
  totalScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'F';
  scienceScore: number;
  marginScore: number;
  budgetScore: number;
  synergyScore: number;
  collabScore: number;
  massKg: number;
  costM: number;
  powerMarginW: number;
  lifetimeMonths: number;
  designConfig: MissionConfig;
}
