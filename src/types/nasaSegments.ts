import type { CelestialBodyId, EngineeringRole } from './mission';

export type NasaMissionSegment =
  | 'setup'
  | 'launch'
  | 'space'
  | 'ground'
  | 'user'
  | 'conops';

export type GmatMissionRegime =
  | 'leo'
  | 'geo'
  | 'heo'
  | 'lunar'
  | 'lagrange'
  | 'interplanetary';

export type PropulsionType = 'chemical' | 'electric';

export type ArchitectMode = 'cadet' | 'sandbox';

export interface NasaObjectiveSpec {
  id: string;
  regime: GmatMissionRegime;
  title: string;
  category: 'Earth Science' | 'Planetary Science' | 'Astrophysics' | 'Lunar Exploration' | 'Telecommunications';
  targetBody: CelestialBodyId;
  targetAltitudeKm: number;
  periapsisKm?: number;
  apoapsisKm?: number;
  targetInclinationDeg: number;
  targetEccentricity?: number;
  raanDeg?: number;
  argPeriapsisDeg?: number;
  maxPayloadMassKg: number;
  propellantBudgetKg: number;
  budgetCapM: number;
  minScienceDataGB: number;
  primaryScienceDeliverable: string;
  summary: string;
  scientificNeed: string;
  nasaProgramRef: string;
  gmatScenarioDesc: string;
  csaCollaborationNote: string;
}

export interface LaunchWindowSpec {
  targetPlanet: string;
  optimalPhaseAngleDeg: number;
  currentPhaseAngleDeg: number;
  synodicPeriodDays: number;
  windowOpenDays: number;
  c3EnergyKm2s2: number;
  minDeltaVKms: number;
  porkchopCurve: { departureDayOffset: number; deltaVKms: number; c3: number }[];
}

export interface GroundStationSpec {
  id: string;
  name: string;
  agency: 'NASA DSN' | 'CSA / NRCan' | 'NASA NSN' | 'Artemis Relay';
  body: CelestialBodyId;
  latDeg: number;
  lonDeg: number;
  antennaDiameterM: number;
  frequencyBand: 'S-Band' | 'X-Band' | 'Ka-Band' | 'Optical';
  carrierFreqGhz: number;
  maxDataRateMbps: number;
  network: 'Deep Space Network (DSN)' | 'CSA Polar & Arctic Network' | 'Near Space Network (NSN)' | 'Lunar Relay';
  locationDesc: string;
}

export interface DopplerRangeTelemetry {
  carrierFreqGhz: number;
  rangeKm: number;
  rangeRateKms: number;
  dopplerShiftKhz: number;
  azimuthDeg: number;
  elevationDeg: number;
  signalStrengthDbm: number;
}

export interface NasaInstrument {
  id: string;
  name: string;
  acronym: string;
  agencyPartner: 'NASA' | 'CSA' | 'NASA / CSA Joint';
  type: 'imaging' | 'radar' | 'spectrometry' | 'fields' | 'robotics';
  massKg: number;
  powerDrawW: number;
  dataRateMbps: number;
  enabled: boolean;
  scienceValuePerSec: number;
  targetRegions: string;
  description: string;
  csaHeritage?: string;
  systemsEngineeringRole: EngineeringRole;
}

export interface LaunchBurnState {
  status: 'idle' | 'burning' | 'completed' | 'failed';
  throttlePct: number;
  burnDurationSec: number;
  targetDeltaVKms: number;
  deliveredDeltaVKms: number;
  propellantUsedKg: number;
  outcomeType: 'nominal' | 'underburn' | 'overburn' | 'pending';
  outcomeSummary: string;
  launchEfficiencyScore?: number;
}

export interface ActiveLaunchTelemetry {
  phase: 'prelaunch' | 'ascent' | 'seco' | 'failed';
  timeSec: number;
  altitudeKm: number;
  downrangeKm: number;
  velocityKms: number;
  targetVelocityKms: number;
  pitchDeg: number; // 90 = vertical, 0 = horizontal orbital
  targetPitchDeg: number;
  throttlePct: number;
  dynamicPressureKpa: number;
  maxQReachedKpa: number;
  structuralStressPct: number;
  thermalHeatPct: number;
  fuelRemainingKg: number;
  fuelTotalKg: number;
  apoapsisProjectedKm: number;
  flightPathErrorDeg: number;
  launchEfficiencyScore: number;
  failureReason: string | null;
  trajectoryPoints: { downrangeKm: number; altitudeKm: number; targetAltKm: number }[];
}

export interface OrbitalPerturbations {
  j2NodalPrecessionDegPerDay: number;
  j2ApsidalDriftDegPerDay: number;
  atmosphericDragDecayKmPerDay: number;
  solarRadiationPressureScale: number;
}

export interface OrbitalState {
  altitudeKm: number;
  periapsisKm: number;
  apoapsisKm: number;
  eccentricity: number;
  inclinationDeg: number;
  semiMajorAxisKm: number;
  periodMinutes: number;
  orbitalSpeedKms: number;
  trueAnomalyDeg: number;
  raanDeg: number;
  argPeriapsisDeg: number;
  subSatLatDeg: number;
  subSatLonDeg: number;
  inEclipse: boolean;
  perturbations: OrbitalPerturbations;
}

export interface ManeuverNodePlan {
  id: string;
  trueAnomalyDeg: number;
  progradeMs: number;
  normalMs: number;
  armed: boolean;
  burnWindowActive: boolean;
  executed: boolean;
  predictedPeKm: number;
  predictedApKm: number;
  predictedIncDeg: number;
  predictedEcc: number;
}

export type CanadarmTargetType = 'cubesat' | 'gateway-module' | 'solar-wing';

export interface CanadarmState {
  shoulderDeg: number;
  elbowDeg: number;
  wristDeg: number;
  clampClosed: boolean;
  targetType: CanadarmTargetType;
  targetX: number; // normalized bay coords (-1..1)
  targetY: number; // normalized bay coords (0..1)
  targetAngleDeg: number;
  driftVx: number;
  driftVy: number;
  completedCount: number;
  lastOpFeedback: string | null;
}

export interface ActiveHazard {
  id: string;
  type: 'debris' | 'solar-flare' | 'eclipse-drain';
  title: string;
  detail: string;
  actionHint: string;
  timeRemainingSec: number;
  maxTimeSec: number;
  severity: 'warning' | 'critical';
  incomingVectorDeg: number;
  resolved: boolean;
}

export interface SpacecraftOpsState {
  batteryPct: number;
  solarPanelAngleDeg: number;
  sunAngleDeg: number;
  shieldAngleDeg: number;
  radiationDosePct: number;
  hullIntegrityPct: number;
  sensorSlewOffsetDeg: number;
  canadarm: CanadarmState;
  activeHazard: ActiveHazard | null;
  hazardsSurvived: number;
  hazardsFailed: number;
  lastManeuverAccuracyPct: number;
}

export interface SurfaceLandmark {
  id: string;
  name: string;
  latDeg: number;
  lonDeg: number;
  category: string;
  requiredInstrument: 'radar-sar' | 'spec-highres' | 'mag-boom' | 'cam-multispec';
  captured: boolean;
  downlinked: boolean;
  signalQualityPct: number;
  regionDataSummary: string;
  colorHex: string;
}

export interface CsaChallengeState {
  polarRadarCaptured: boolean;
  debrisAlertActive: boolean;
  debrisAvoidedCount: number;
  solarArraysAligned: boolean;
  challengePoints: number;
  lastChallengeFeedback: string | null;
}

export interface DiscoveryCard {
  id: string;
  title: string;
  agency: 'CSA' | 'NASA' | 'NASA & CSA Joint';
  category: string;
  fact: string;
  realMission: string;
  unlocked: boolean;
  unlockRequirement: string;
}

export interface TradeOffScenario {
  id: 'chemical-fast' | 'electric-efficient';
  name: string;
  propulsionType: PropulsionType;
  ispSec: number;
  thrustN: number;
  dryMassKg: number;
  propellantMassKg: number;
  payloadCapacityKg: number;
  transferDurationDays: number;
  totalDeltaVKms: number;
  costM: number;
  pros: string[];
  cons: string[];
}

export interface GroundCommState {
  activeStationId: string | null;
  hasLineOfSight: boolean;
  elevationAngleDeg: number;
  distanceKm: number;
  downlinkActive: boolean;
  currentDownlinkMbps: number;
  isBlackout: boolean;
  bufferStoredGB: number;
  bufferCapacityGB: number;
  totalDataDownlinkedGB: number;
  dishAzimuthDeg: number;
  dishElevationDeg: number;
  dishLockQualityPct: number;
  bandMode: 'Ka-Band' | 'X-Band';
  allocatedBandwidthPct: number;
  servoAssistEnabled: boolean;
  passTimeRemainingSec: number;
  totalPassContacts: number;
  navTelemetry: DopplerRangeTelemetry;
}

export interface GmatTelemetrySample {
  timestampSec: number;
  altitudeKm: number;
  orbitalSpeedKms: number;
  propellantRemainingKg: number;
  eccentricity: number;
  downlinkRateMbps: number;
}

export interface SystemVerificationItem {
  id: string;
  requirementName: string;
  segment: 'Setup' | 'Launch' | 'Space' | 'Ground' | 'User';
  targetValue: string;
  achievedValue: string;
  passed: boolean;
  marginPercent: number;
  consequence: string;
}

export interface SystemVerificationScorecard {
  overallPass: boolean;
  complianceScore: number;
  dynamicPerformanceScore: number;
  flightCertificationGrade:
    | 'FLIGHT CERTIFIED (CATEGORY A)'
    | 'CONDITIONAL PASS (CATEGORY B)'
    | 'DEFICIENT - RE-ENGINEERING REQUIRED (CATEGORY C)';
  missionRankBadge: string;
  items: SystemVerificationItem[];
  systemsEngineerSummary: string;
}
