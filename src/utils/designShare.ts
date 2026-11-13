import {
  ADCS_SYSTEMS,
  AVIONICS_SYSTEMS,
  BATTERY_SYSTEMS,
  BUSES,
  COMMS_SYSTEMS,
  DEFAULT_MISSION_CONFIG,
  DIFFICULTY_MODES,
  INSTRUMENTS,
  LAUNCH_VEHICLES,
  OBJECTIVES,
  ORBITS,
  POWER_SYSTEMS,
  PROPULSION_SYSTEMS,
  RANDOM_CONSTRAINTS,
  SHIELDING_SYSTEMS,
} from '../data/catalog';
import { getCatalogParts } from '../engine/physics';
import type { MissionConfig, SimulationOutcome, TelemetryReport } from '../types/mission';

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeDesignCode(config: MissionConfig): string {
  const compact = {
    v: 1,
    d: config.difficulty,
    m: config.modelMode ?? 'realistic',
    c: config.constraintEventId ?? 'none',
    o: config.objectiveId,
    r: config.orbitId,
    lv: config.launchVehicleId,
    b: config.busId,
    pr: config.propulsionId,
    pw: config.powerId,
    bt: config.batteryId,
    cm: config.commsId,
    av: config.avionicsId,
    ad: config.adcsId,
    sh: config.shieldingId,
    in: config.instrumentIds.slice(0, 4),
    ss: Number(config.solarSizing.toFixed(2)),
    pp: Number(config.propellantRatio.toFixed(2)),
  };
  return `APG1-${toBase64Url(JSON.stringify(compact))}`;
}

export function decodeDesignCode(rawCode: string): MissionConfig | null {
  try {
    const cleaned = rawCode.trim();
    const token = cleaned.startsWith('APG1-') ? cleaned.slice(5) : cleaned;
    const parsed = JSON.parse(fromBase64Url(token)) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;

    const pickId = (val: unknown, allowed: string[], fallback: string) =>
      typeof val === 'string' && allowed.includes(val) ? val : fallback;

    const diffRaw = parsed.d;
    const difficulty =
      typeof diffRaw === 'string' && diffRaw in DIFFICULTY_MODES
        ? (diffRaw as MissionConfig['difficulty'])
        : DEFAULT_MISSION_CONFIG.difficulty;

    const modelMode =
      parsed.m === 'simplified' || parsed.m === 'realistic'
        ? parsed.m
        : DEFAULT_MISSION_CONFIG.modelMode;

    const constraintEventId = pickId(
      parsed.c,
      RANDOM_CONSTRAINTS.map((x) => x.id),
      'none',
    );

    const rawInstruments = Array.isArray(parsed.in)
      ? parsed.in.filter((id): id is string => typeof id === 'string' && INSTRUMENTS.some((i) => i.id === id))
      : DEFAULT_MISSION_CONFIG.instrumentIds;

    const solarSizing =
      typeof parsed.ss === 'number' && Number.isFinite(parsed.ss)
        ? Math.min(2.0, Math.max(0.5, parsed.ss))
        : 1.0;

    const propellantRatio =
      typeof parsed.pp === 'number' && Number.isFinite(parsed.pp)
        ? Math.min(1.5, Math.max(0.5, parsed.pp))
        : 1.0;

    return {
      difficulty,
      modelMode,
      constraintEventId,
      objectiveId: pickId(parsed.o, OBJECTIVES.map((x) => x.id), DEFAULT_MISSION_CONFIG.objectiveId),
      orbitId: pickId(parsed.r, ORBITS.map((x) => x.id), DEFAULT_MISSION_CONFIG.orbitId),
      launchVehicleId: pickId(parsed.lv, LAUNCH_VEHICLES.map((x) => x.id), DEFAULT_MISSION_CONFIG.launchVehicleId),
      busId: pickId(parsed.b, BUSES.map((x) => x.id), DEFAULT_MISSION_CONFIG.busId),
      propulsionId: pickId(parsed.pr, PROPULSION_SYSTEMS.map((x) => x.id), DEFAULT_MISSION_CONFIG.propulsionId),
      powerId: pickId(parsed.pw, POWER_SYSTEMS.map((x) => x.id), DEFAULT_MISSION_CONFIG.powerId),
      batteryId: pickId(parsed.bt, BATTERY_SYSTEMS.map((x) => x.id), DEFAULT_MISSION_CONFIG.batteryId),
      commsId: pickId(parsed.cm, COMMS_SYSTEMS.map((x) => x.id), DEFAULT_MISSION_CONFIG.commsId),
      avionicsId: pickId(parsed.av, AVIONICS_SYSTEMS.map((x) => x.id), DEFAULT_MISSION_CONFIG.avionicsId),
      adcsId: pickId(parsed.ad, ADCS_SYSTEMS.map((x) => x.id), DEFAULT_MISSION_CONFIG.adcsId),
      shieldingId: pickId(parsed.sh, SHIELDING_SYSTEMS.map((x) => x.id), DEFAULT_MISSION_CONFIG.shieldingId),
      instrumentIds: rawInstruments.slice(0, 4),
      solarSizing,
      propellantRatio,
    };
  } catch {
    return null;
  }
}

export function sanitizeDesignForStorage(config: MissionConfig): MissionConfig {
  return {
    difficulty: config.difficulty || 'engineer',
    modelMode: config.modelMode === 'simplified' ? 'simplified' : 'realistic',
    constraintEventId: config.constraintEventId || 'none',
    objectiveId: config.objectiveId,
    orbitId: config.orbitId,
    launchVehicleId: config.launchVehicleId,
    busId: config.busId,
    propulsionId: config.propulsionId,
    powerId: config.powerId,
    batteryId: config.batteryId || 'batt-simple-li',
    commsId: config.commsId,
    avionicsId: config.avionicsId || 'avionics-simple',
    adcsId: config.adcsId || 'adcs-advanced',
    shieldingId: config.shieldingId,
    instrumentIds: config.instrumentIds.slice(0, 4),
    solarSizing: Number(Math.min(2.0, Math.max(0.5, config.solarSizing)).toFixed(2)),
    propellantRatio: Number(Math.min(1.5, Math.max(0.5, config.propellantRatio)).toFixed(2)),
  };
}

export function buildMissionReportText(
  config: MissionConfig,
  telemetry: TelemetryReport,
  outcome: SimulationOutcome,
  runCount: number,
  pilotName: string,
  roomId: string | null,
): string {
  const parts = getCatalogParts(config);
  const shareCode = encodeDesignCode(config);
  const now = new Date().toISOString();

  const lines: string[] = [
    '============================================================',
    'ORBITARIUM — POST-MISSION ENGINEERING REPORT',
    '============================================================',
    `Generated: ${now}`,
    `Architect / Team: ${pilotName}${roomId ? ` (Team Room ${roomId})` : ' (Solo Mission)'}`,
    `Simulation Run: #${runCount}`,
    `Difficulty Mode: ${parts.difficulty.label}`,
    `Spacecraft Model Detail: ${parts.modelMode.toUpperCase()}`,
    `Mission Condition / Constraint: ${parts.constraintEvent.title} (${parts.constraintEvent.impactSummary})`,
    '',
    '1. MISSION OVERVIEW & SCORE',
    '------------------------------------------------------------',
    `Objective: ${parts.objective.title} (Target: ${parts.objective.targetBody.toUpperCase()})`,
    `Outcome: ${outcome.missionSuccess ? 'MISSION OBJECTIVES ACHIEVED' : 'MISSION ANOMALY FAILURE'}`,
    `Final Grade: ${outcome.grade} (${outcome.totalScore} / 500 pts)`,
    `  - Science Return: ${outcome.scienceScore}/100`,
    `  - Engineering Margin: ${outcome.marginScore}/100`,
    `  - Budget Efficiency: ${outcome.budgetScore}/100`,
    `  - Subsystem Synergy: ${outcome.synergyScore}/100`,
    `  - Flight Ops / Team Coordination: ${outcome.collabScore}/100`,
    ...(outcome.failureSummary ? [`Failure Root Cause: ${outcome.failureSummary}`] : []),
    '',
    '2. SPACECRAFT & LAUNCH ARCHITECTURE',
    '------------------------------------------------------------',
    `Target Orbit: ${parts.orbit.name}`,
    `Launch Vehicle: ${parts.launchVehicle.name} ($${parts.launchVehicle.costM}M)`,
    `Bus Structure: ${parts.bus.name}`,
    `Propulsion: ${parts.propulsion.name} (${parts.propulsion.ispSec}s Isp, Fuel Ratio ${(config.propellantRatio * 100).toFixed(0)}%)`,
    `Power Generation: ${parts.power.name} (Solar Span ${(config.solarSizing * 100).toFixed(0)}%)`,
    `Energy Storage: ${parts.battery.name}`,
    `Communications: ${parts.comms.name}`,
    `Avionics: ${parts.avionics.name}`,
    `Attitude Control (ADCS): ${parts.adcs.name}`,
    `Radiation & Thermal Shielding: ${parts.shielding.name}`,
    `Science Instruments (${parts.instruments.length}): ${
      parts.instruments.length > 0 ? parts.instruments.map((i) => i.name).join(', ') : 'None'
    }`,
    '',
    '3. SIX-RESOURCE TELEMETRY SUMMARY',
    '------------------------------------------------------------',
    `Budget: $${telemetry.totalCostM}M / $${telemetry.budgetCapM}M [${telemetry.budgetStatus}]`,
    `Mass: ${telemetry.wetMassKg} kg wet (${telemetry.dryMassKg} kg dry + ${telemetry.propellantMassKg} kg fuel) / ${telemetry.payloadCapacityKg} kg max [${telemetry.massStatus}]`,
    `Orbital Δv: ${telemetry.availableDeltaVKms} km/s / ${telemetry.requiredDeltaVKms} km/s req [${telemetry.deltaVStatus}]`,
    `Power: ${telemetry.powerGeneratedW}W generated vs ${telemetry.powerPeakDrawW}W peak draw (${telemetry.powerMarginW >= 0 ? '+' : ''}${telemetry.powerMarginW}W margin) [${telemetry.powerStatus}]`,
    `Data & Comms: ${telemetry.downlinkCapacityGBDay} GB/day downlink (${telemetry.linkMarginDb} dB) vs ${telemetry.dataGeneratedGBDay} GB/day generated [${telemetry.dataStatus}]`,
    `Time / Lifetime: ${telemetry.estimatedLifetimeMonths} months / ${telemetry.requiredLifetimeMonths} months goal [${telemetry.lifetimeStatus}]`,
    '',
    '4. PASS / FAIL ENGINEERING CRITERIA & WHY IT MATTERED',
    '------------------------------------------------------------',
    ...outcome.criteriaChecks.flatMap((c) => [
      `[${c.passed ? 'PASS' : 'FAIL'}] ${c.label}: ${c.detail}`,
      `       Why: ${c.whyItMattered}`,
    ]),
    '',
    '5. KEY ENGINEERING LESSONS',
    '------------------------------------------------------------',
    ...outcome.lessons.map((l) => `* ${l}`),
    '',
    '6. SHAREABLE MISSION DESIGN CODE',
    '------------------------------------------------------------',
    shareCode,
    '============================================================',
  ];

  return lines.join('\n');
}
