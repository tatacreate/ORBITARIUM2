import {
  ADCS_SYSTEMS,
  AVIONICS_SYSTEMS,
  BATTERY_SYSTEMS,
  BUSES,
  COMMS_SYSTEMS,
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
import type {
  AnomalyChoice,
  ConstraintStatus,
  CriterionCheck,
  EngineeringAdvisory,
  FlightAnomaly,
  LiveFlightReport,
  MissionConfig,
  SimulationOutcome,
  TelemetryReport,
  TradeOffPopup,
} from '../types/mission';

const G0 = 9.80665;

export function getCatalogParts(config: MissionConfig) {
  const difficulty = DIFFICULTY_MODES[config.difficulty] ?? DIFFICULTY_MODES.engineer;
  const objective = OBJECTIVES.find((o) => o.id === config.objectiveId) ?? OBJECTIVES[0];
  const orbit = ORBITS.find((o) => o.id === config.orbitId) ?? ORBITS[0];
  const launchVehicle =
    LAUNCH_VEHICLES.find((l) => l.id === config.launchVehicleId) ?? LAUNCH_VEHICLES[1];
  const bus = BUSES.find((b) => b.id === config.busId) ?? BUSES[1];
  const propulsion =
    PROPULSION_SYSTEMS.find((p) => p.id === config.propulsionId) ?? PROPULSION_SYSTEMS[1];
  const power = POWER_SYSTEMS.find((p) => p.id === config.powerId) ?? POWER_SYSTEMS[0];
  const battery =
    BATTERY_SYSTEMS.find((b) => b.id === config.batteryId) ?? BATTERY_SYSTEMS[0];
  const comms = COMMS_SYSTEMS.find((c) => c.id === config.commsId) ?? COMMS_SYSTEMS[1];
  const avionics =
    AVIONICS_SYSTEMS.find((a) => a.id === config.avionicsId) ?? AVIONICS_SYSTEMS[0];
  const adcs =
    ADCS_SYSTEMS.find((a) => a.id === config.adcsId) ?? ADCS_SYSTEMS[1];
  const shielding =
    SHIELDING_SYSTEMS.find((s) => s.id === config.shieldingId) ?? SHIELDING_SYSTEMS[1];
  const instruments = INSTRUMENTS.filter((inst) => config.instrumentIds.includes(inst.id)).slice(
    0,
    bus.maxInstruments,
  );

  const constraintEvent =
    RANDOM_CONSTRAINTS.find((c) => c.id === config.constraintEventId) ?? RANDOM_CONSTRAINTS[0];
  const modelMode = config.modelMode === 'simplified' ? 'simplified' : 'realistic';

  return {
    difficulty,
    constraintEvent,
    modelMode,
    objective,
    orbit,
    launchVehicle,
    bus,
    propulsion,
    power,
    battery,
    comms,
    avionics,
    adcs,
    shielding,
    instruments,
  };
}

export function computeTelemetry(config: MissionConfig): TelemetryReport {
  const {
    difficulty,
    constraintEvent,
    objective,
    orbit,
    launchVehicle,
    bus,
    propulsion,
    power,
    battery,
    comms,
    avionics,
    adcs,
    shielding,
    instruments,
  } = getCatalogParts(config);

  const advisories: EngineeringAdvisory[] = [];
  const synergies: string[] = [];

  // 1. Mass & Propellant via Tsiolkovsky Rocket Equation
  const solarMassKg =
    power.kind === 'solar' ? power.massKg * config.solarSizing : power.massKg;
  const instrumentMassKg = instruments.reduce((sum, i) => sum + i.massKg, 0);
  const dryMassKg = Math.round(
    bus.dryMassKg +
      propulsion.dryMassKg +
      solarMassKg +
      battery.massKg +
      comms.massKg +
      avionics.massKg +
      adcs.massKg +
      shielding.massKg +
      instrumentMassKg,
  );

  const targetDvMs = orbit.requiredDeltaVKms * 1000 * config.propellantRatio;
  const exhaustVel = propulsion.ispSec * G0;
  const massRatio = Math.exp(targetDvMs / exhaustVel);
  const propellantMassKg = Math.round(dryMassKg * (massRatio - 1));
  const wetMassKg = dryMassKg + propellantMassKg;

  const availableDeltaVKms = Number(
    ((exhaustVel * Math.log((dryMassKg + propellantMassKg) / dryMassKg)) / 1000).toFixed(2),
  );
  const requiredDeltaVKms = orbit.requiredDeltaVKms;

  const payloadCapacityKg = Math.round(
    launchVehicle.leoCapacityKg *
      orbit.payloadMultiplier *
      difficulty.payloadMultiplier *
      constraintEvent.payloadMult,
  );

  // 2. Budget Calculation with Difficulty Cap & Random Constraint
  const budgetCapM = Math.round(
    objective.budgetCapM * difficulty.budgetMultiplier * constraintEvent.budgetMult,
  );
  const solarCostM =
    power.kind === 'solar' ? power.costM * (0.65 + 0.35 * config.solarSizing) : power.costM;
  const instrumentCostM = instruments.reduce((sum, i) => sum + i.costM, 0);
  const propellantCostM = propellantMassKg * 0.004;
  const totalCostM = Number(
    (
      launchVehicle.costM +
      bus.costM +
      propulsion.costM +
      solarCostM +
      battery.costM +
      comms.costM +
      avionics.costM +
      adcs.costM +
      shielding.costM +
      instrumentCostM +
      propellantCostM
    ).toFixed(1),
  );

  // 3. Power Calculation (Inverse-Square Solar Flux + Eclipse Battery Penalty)
  const solarFluxFactor =
    power.kind === 'solar' ? Number((1 / (orbit.solarDistanceAU * orbit.solarDistanceAU)).toFixed(3)) : 1.0;

  let powerGeneratedW = 0;
  if (power.kind === 'solar') {
    const eclipsePenalty = Math.max(
      0.65,
      1 - orbit.eclipseFraction * (0.45 * (120 / Math.max(60, battery.capacityWh))),
    );
    powerGeneratedW = Math.round(
      power.baseOutputWAt1AU * config.solarSizing * solarFluxFactor * eclipsePenalty,
    );
  } else {
    powerGeneratedW = power.baseOutputWAt1AU;
  }

  const instrumentDrawW = instruments.reduce((sum, i) => sum + i.powerDrawW, 0);
  const thermalHeaterDrawW =
    orbit.solarDistanceAU >= 1.5 && power.wasteHeatBonusC === 0
      ? Math.round(45 * orbit.solarDistanceAU - shielding.thermalRating * 15)
      : 0;
  const clampedHeaterW = Math.max(0, thermalHeaterDrawW);
  const powerPeakDrawW = Math.round(
    bus.basePowerW +
      propulsion.powerDrawW +
      comms.powerDrawW +
      avionics.powerDrawW +
      adcs.powerDrawW +
      shielding.powerDrawW +
      instrumentDrawW +
      clampedHeaterW,
  );
  const powerMarginW = powerGeneratedW - powerPeakDrawW;

  const effectivePointingArcsec = Math.min(bus.pointingAccuracyArcsec, adcs.pointingAccuracyArcsec);

  // 4. Data Volume & Communications Link Budget
  const dataGeneratedGBDay = Number(
    (
      instruments.reduce((sum, i) => sum + i.dataRateGBPerDay, 0) * constraintEvent.dataMult
    ).toFixed(1),
  );

  const effectiveDistAU = Math.max(0.08, orbit.commsDistanceAU);
  const pathFactor = 1 / Math.pow(effectiveDistAU, 1.35);
  const pointingPenalty =
    comms.requiresFinePointing && effectivePointingArcsec > 15 ? 0.35 : 1.0;
  const effectiveMbps = Math.min(
    320,
    comms.baseRateMbpsAt1AU * pathFactor * pointingPenalty,
  );
  const downlinkMbps = Number(effectiveMbps.toFixed(1));
  const dataRateMbps = Number(((dataGeneratedGBDay * 8000) / (3600 * 8)).toFixed(1));
  const downlinkCapacityGBDay = Number(((effectiveMbps * 3600 * 8) / 8000).toFixed(1));
  const commsDelaySec = Number((orbit.commsDistanceAU * 499).toFixed(2));
  const totalBufferGB = Math.max(bus.dataBufferGB, avionics.dataBufferGB);
  const bufferGraceBonus = totalBufferGB >= 400 ? 1.15 : totalBufferGB >= 160 ? 1.05 : 1.0;

  const linkMarginDb = Number(
    (
      comms.gainDb -
      20 * Math.log10(Math.max(0.2, orbit.commsDistanceAU * 1.4)) -
      (comms.requiresFinePointing && effectivePointingArcsec > 15 ? 8 : 0) -
      14 +
      constraintEvent.linkBonusDb
    ).toFixed(1),
  );

  // 5. Radiation & Lifetime Model (scaled by Difficulty & Random Constraint)
  const effectiveRadRate = Math.max(
    2,
    orbit.radiationDoseRate *
      (objective.radiationSeverity / 2.2) *
      difficulty.radiationMultiplier *
      constraintEvent.radiationMult,
  );
  const radLifetimeMonths = Math.round((shielding.radToleranceKrad / effectiveRadRate) * 12);
  const dvReserveRatio = availableDeltaVKms / Math.max(0.1, requiredDeltaVKms);
  const propLifetimeMonths = Math.round(36 * Math.min(2.2, Math.max(0.15, dvReserveRatio)));
  const estimatedLifetimeMonths = Math.min(72, Math.min(radLifetimeMonths, propLifetimeMonths));
  const estimatedLifetimeYears = Number((estimatedLifetimeMonths / 12).toFixed(1));

  // 6. Status Classifications
  const budgetStatus: ConstraintStatus =
    totalCostM > budgetCapM
      ? 'Critical'
      : totalCostM > budgetCapM * 0.9
        ? 'Tight'
        : 'Nominal';

  const massStatus: ConstraintStatus =
    wetMassKg > payloadCapacityKg || bus.tier > launchVehicle.maxBusTier
      ? 'Critical'
      : wetMassKg > payloadCapacityKg * 0.9
        ? 'Tight'
        : 'Nominal';

  const deltaVStatus: ConstraintStatus =
    availableDeltaVKms < requiredDeltaVKms * 0.96
      ? 'Critical'
      : availableDeltaVKms < requiredDeltaVKms * 1.08
        ? 'Tight'
        : 'Nominal';

  const powerStatus: ConstraintStatus =
    powerMarginW < 0 ? 'Critical' : powerMarginW < 45 ? 'Tight' : 'Nominal';

  const dataStatus: ConstraintStatus =
    linkMarginDb < 2 || downlinkCapacityGBDay * bufferGraceBonus < dataGeneratedGBDay * 0.7
      ? 'Critical'
      : downlinkCapacityGBDay < dataGeneratedGBDay
        ? 'Tight'
        : 'Nominal';

  const lifetimeStatus: ConstraintStatus =
    estimatedLifetimeMonths < objective.minLifetimeMonths * 0.85
      ? 'Critical'
      : estimatedLifetimeMonths < objective.minLifetimeMonths
        ? 'Tight'
        : 'Nominal';

  // 7. Synergies & Science Return Potential
  let scienceScore = 0;
  instruments.forEach((inst) => {
    const isPreferred = objective.preferredInstruments.includes(inst.id);
    scienceScore += inst.scienceBase * (isPreferred ? 1.28 : 0.82);
  });

  const bodyMatches =
    orbit.body === objective.targetBody ||
    (objective.targetBody === 'psyche' &&
      (orbit.id === 'deep-jovian' || orbit.id === 'deep-flyby'));

  if (orbit.id === objective.recommendedOrbitId) {
    scienceScore += 12;
    synergies.push('Optimal Science Orbit Alignment (+12 Science)');
  } else if (bodyMatches) {
    scienceScore += 6;
    synergies.push('Viable Alternative Orbit Trade-Off (+6 Science)');
  } else {
    scienceScore *= 0.42;
    advisories.push({
      id: 'wrong-body',
      severity: 'critical',
      subsystem: 'mission',
      message: `Selected orbit targets ${orbit.body.toUpperCase()}, but objective requires ${objective.targetBody.toUpperCase()}.`,
      plainTerms:
        'Your spacecraft needs to orbit the actual planet or moon you are studying in order to take science measurements.',
      quickFix: {
        label: 'Align Orbit to Target',
        patch: { orbitId: objective.recommendedOrbitId },
      },
    });
  }

  if (power.kind === 'nuclear' && orbit.solarDistanceAU >= 2.5) {
    synergies.push('RTG Deep-Space Thermal & Power Immunity');
  }
  if (propulsion.electricPropulsion && orbit.requiredDeltaVKms >= 2.0 && powerMarginW >= 40) {
    synergies.push('High-Isp Ion Cruise Mass Savings');
  }
  if (comms.band === 'Optical' && bus.pointingAccuracyArcsec <= 12) {
    synergies.push('Arcsecond Optical Laser High-Rate Link');
  }
  if (
    config.instrumentIds.includes('sar-radar') &&
    config.instrumentIds.includes('gamma-neutron')
  ) {
    synergies.push('Subsurface Ice + Elemental Regolith Cross-Calibration');
  }

  const scienceReturnPotential = Math.min(
    100,
    Math.round(scienceScore + (instruments.length > 0 ? constraintEvent.scienceBonus : 0)),
  );

  // 8. Engineering Advisories with Plain-Language Context & Quick-Fixes
  if (bus.tier > launchVehicle.maxBusTier) {
    advisories.push({
      id: 'fairing-fit',
      severity: 'critical',
      subsystem: 'mission',
      message: `${bus.name} exceeds ${launchVehicle.name} fairing envelope.`,
      plainTerms:
        'The spacecraft frame is physically wider than the rocket nose cone. Either pick a larger rocket or a smaller bus.',
      quickFix: {
        label: 'Upgrade to Meridian-9 Rocket',
        patch: { launchVehicleId: 'falcon-med' },
      },
    });
  }
  if (wetMassKg > payloadCapacityKg) {
    const nextVehicle =
      launchVehicle.id === 'electron-light'
        ? 'falcon-med'
        : launchVehicle.id === 'falcon-med'
          ? 'vulcan-heavy'
          : 'starship-super';
    advisories.push({
      id: 'overweight',
      severity: 'critical',
      subsystem: 'mission',
      message: `Wet mass (${wetMassKg} kg) exceeds ${launchVehicle.name} capacity (${payloadCapacityKg} kg).`,
      plainTerms:
        'Fueled spacecraft mass is too heavy for this rocket to push into your chosen orbit.',
      quickFix:
        launchVehicle.id !== 'starship-super'
          ? {
              label: 'Upgrade Launch Vehicle',
              patch: { launchVehicleId: nextVehicle },
            }
          : {
              label: 'Switch to Ion Drive (Less Fuel)',
              patch: { propulsionId: 'xenon-hall' },
            },
    });
  }
  if (totalCostM > budgetCapM) {
    advisories.push({
      id: 'overbudget',
      severity: 'critical',
      subsystem: 'mission',
      message: `Mission cost ($${totalCostM}M) exceeds $${budgetCapM}M program cap.`,
      plainTerms:
        'Total hardware plus launch price goes over your agency budget. Trim an expensive instrument or downsize the rocket if mass allows.',
    });
  }
  if (powerMarginW < 0) {
    const suggestNuclear = orbit.solarDistanceAU >= 2.5;
    advisories.push({
      id: 'power-deficit',
      severity: 'critical',
      subsystem: 'power',
      message: `Power deficit of ${Math.abs(powerMarginW)} W at ${orbit.solarDistanceAU} AU.`,
      plainTerms:
        'Your instruments and comms draw more watts than your power source generates. Far from the Sun, sunlight drops by 1/r².',
      quickFix: suggestNuclear
        ? {
            label: 'Switch to RTG Nuclear Battery',
            patch: { powerId: 'mmrtg-nuclear' },
          }
        : {
            label: 'Upgrade to Deployable Wings',
            patch: { powerId: 'ultraflex-array', solarSizing: 1.4 },
          },
    });
  }
  if (availableDeltaVKms < requiredDeltaVKms * 0.96) {
    advisories.push({
      id: 'low-dv',
      severity: 'critical',
      subsystem: 'bus',
      message: `Available Δv (${availableDeltaVKms} km/s) is below orbit requirement (${requiredDeltaVKms} km/s).`,
      plainTerms:
        'Your spacecraft does not carry enough propellant speed-change (Δv) to brake and enter target orbit.',
      quickFix: {
        label: 'Increase Fuel Tank to 105%',
        patch: { propellantRatio: 1.05 },
      },
    });
  }
  if (comms.requiresFinePointing && bus.pointingAccuracyArcsec > 15) {
    advisories.push({
      id: 'laser-pointing',
      severity: 'warning',
      subsystem: 'power',
      message: `Laser Comms needs <=15" pointing; ${bus.name} is ${bus.pointingAccuracyArcsec}".`,
      plainTerms:
        'Space lasers shoot a tiny beam across millions of kilometers and require a stable Medium Explorer or Heavy Bus.',
      quickFix: {
        label: 'Upgrade to Medium Explorer Bus',
        patch: { busId: 'octa-probe' },
      },
    });
  }
  if (dataStatus === 'Critical') {
    advisories.push({
      id: 'link-failure',
      severity: 'critical',
      subsystem: 'power',
      message: `Downlink (${downlinkCapacityGBDay} GB/day, ${linkMarginDb} dB) cannot support ${dataGeneratedGBDay} GB/day.`,
      plainTerms:
        'Your science instruments collect more data than your antenna can transmit home each day.',
      quickFix: {
        label: 'Equip High-Gain Dish',
        patch: { commsId: 'kaband-hga' },
      },
    });
  }
  if (instruments.length === 0) {
    advisories.push({
      id: 'no-payload',
      severity: 'critical',
      subsystem: 'payload',
      message: 'No scientific instruments mounted on the payload deck.',
      plainTerms:
        'Without scientific instruments, the spacecraft cannot gather measurements to achieve the mission objective.',
      quickFix: {
        label: 'Mount Preferred Instrument',
        patch: { instrumentIds: [objective.preferredInstruments[0]] },
      },
    });
  }
  if (estimatedLifetimeMonths < objective.minLifetimeMonths * 0.85) {
    advisories.push({
      id: 'rad-lifetime',
      severity: 'warning',
      subsystem: 'bus',
      message: `Projected lifetime (${estimatedLifetimeMonths} mo) is below ${objective.minLifetimeMonths} mo goal.`,
      plainTerms:
        'High orbital radiation or tight station-keeping fuel will end the mission early unless you add heavier shielding.',
      quickFix: {
        label: 'Equip Titanium Rad Vault',
        patch: { shieldingId: 'cryo-radiator' },
      },
    });
  }

  let criticalFailureReason: string | null = null;
  if (!difficulty.isSandbox) {
    if (!bodyMatches) {
      criticalFailureReason = 'Target orbit does not match mission objective celestial body.';
    } else if (instruments.length === 0) {
      criticalFailureReason = 'Spacecraft has zero scientific instruments installed.';
    } else if (massStatus === 'Critical') {
      criticalFailureReason = 'Spacecraft exceeds launch vehicle mass or fairing limits.';
    } else if (powerStatus === 'Critical') {
      criticalFailureReason = 'Negative electrical power margin causes avionics brownout.';
    } else if (deltaVStatus === 'Critical') {
      criticalFailureReason = 'Insufficient Δv to capture into target science orbit.';
    }
  }

  const launchReady = difficulty.isSandbox || criticalFailureReason === null;
  const finalAdvisories = difficulty.isSandbox
    ? advisories.map((adv) => ({
        ...adv,
        severity: adv.severity === 'critical' ? ('info' as const) : adv.severity,
        message: `${adv.message} (Sandbox: launch allowed)`,
      }))
    : advisories;

  return {
    totalCostM,
    budgetCapM,
    budgetStatus,
    dryMassKg,
    propellantMassKg,
    wetMassKg,
    payloadCapacityKg,
    massStatus,
    availableDeltaVKms,
    requiredDeltaVKms,
    deltaVStatus,
    solarFluxFactor,
    powerGeneratedW,
    powerPeakDrawW,
    powerMarginW,
    powerStatus,
    dataGeneratedGBDay,
    downlinkCapacityGBDay,
    dataRateMbps,
    downlinkMbps,
    commsDelaySec,
    linkMarginDb,
    dataStatus,
    estimatedLifetimeMonths,
    estimatedLifetimeYears,
    requiredLifetimeMonths: objective.minLifetimeMonths,
    lifetimeStatus,
    scienceReturnPotential,
    synergies,
    advisories: finalAdvisories,
    launchReady,
    criticalFailureReason,
  };
}

export function buildTradeOffPopup(
  prevConfig: MissionConfig,
  nextConfig: MissionConfig,
  partTitle: string,
): TradeOffPopup | null {
  const prev = computeTelemetry(prevConfig);
  const next = computeTelemetry(nextConfig);

  const costDiff = Number((next.totalCostM - prev.totalCostM).toFixed(1));
  const massDiff = Math.round(next.wetMassKg - prev.wetMassKg);
  const powerDiff = Math.round(next.powerMarginW - prev.powerMarginW);
  const sciDiff = Math.round(next.scienceReturnPotential - prev.scienceReturnPotential);
  const dlDiff = Number((next.downlinkMbps - prev.downlinkMbps).toFixed(1));
  const dataDiff = Number((next.dataGeneratedGBDay - prev.dataGeneratedGBDay).toFixed(1));

  const deltas: TradeOffPopup['deltas'] = [];
  if (sciDiff !== 0) {
    deltas.push({
      label: `${sciDiff > 0 ? '+' : ''}${sciDiff} Science`,
      tone: sciDiff > 0 ? 'good' : 'warn',
    });
  }
  if (massDiff !== 0) {
    deltas.push({
      label: `${massDiff > 0 ? '+' : ''}${massDiff} kg Mass`,
      tone: massDiff <= 0 ? 'good' : next.massStatus === 'Critical' ? 'warn' : 'neutral',
    });
  }
  if (powerDiff !== 0) {
    deltas.push({
      label: `${powerDiff > 0 ? '+' : ''}${powerDiff} W Margin`,
      tone: powerDiff > 0 ? 'good' : next.powerStatus === 'Critical' ? 'warn' : 'neutral',
    });
  }
  if (costDiff !== 0) {
    deltas.push({
      label: `${costDiff > 0 ? '+' : ''}$${costDiff}M`,
      tone: costDiff <= 0 ? 'good' : next.budgetStatus === 'Critical' ? 'warn' : 'neutral',
    });
  }
  if (dlDiff !== 0) {
    deltas.push({
      label: `${dlDiff > 0 ? '+' : ''}${dlDiff} Mbps Link`,
      tone: dlDiff > 0 ? 'good' : 'warn',
    });
  }
  if (dataDiff !== 0) {
    deltas.push({
      label: `${dataDiff > 0 ? '+' : ''}${dataDiff} GB/d Data`,
      tone: dataDiff > 0 && next.dataStatus === 'Critical' ? 'warn' : 'neutral',
    });
  }

  if (deltas.length === 0) return null;

  let summary = `Updated ${partTitle}.`;
  if (next.massStatus === 'Critical' && prev.massStatus !== 'Critical') {
    summary = `Heads up! Adding ${partTitle} pushed spacecraft weight over your rocket's limit—upgrade your rocket in Phase 3 or trim mass.`;
  } else if (next.powerStatus === 'Critical' && prev.powerStatus !== 'Critical') {
    summary = `Power alert! ${partTitle} draws more watts than your solar/RTG supply generates—boost your power system to keep instruments running.`;
  } else if (next.dataStatus === 'Critical' && prev.dataStatus !== 'Critical') {
    summary = `Data bottleneck! ${partTitle} creates more daily science data than your current antenna can send home.`;
  } else if (sciDiff > 0 && (massDiff > 0 || powerDiff < 0)) {
    summary = `${partTitle} boosts Science Value +${sciDiff}, while trading +${Math.max(0, massDiff)} kg mass and ${Math.abs(powerDiff)} W power reserve.`;
  } else if (powerDiff > 0 && massDiff > 0) {
    summary = `${partTitle} adds +${powerDiff} W electrical reserve for +${massDiff} kg mass.`;
  } else if (dlDiff > 0) {
    summary = `${partTitle} speeds up your Earth downlink by +${dlDiff} Mbps so high-res data streams home cleanly.`;
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: partTitle,
    summary,
    deltas: deltas.slice(0, 4),
  };
}

function rotateChoices(choices: AnomalyChoice[], offset: number): AnomalyChoice[] {
  const n = choices.length;
  if (n <= 1) return choices;
  const shift = ((offset % n) + n) % n;
  return [...choices.slice(shift), ...choices.slice(0, shift)];
}

export function generateFlightAnomalies(config: MissionConfig, seed: number): FlightAnomaly[] {
  const { objective, orbit, power, comms, shielding, battery, avionics, adcs, bus } =
    getCatalogParts(config);
  const hasHighCapBattery = battery.capacityWh >= 300;
  const hasRadHardComputer = avionics.dataBufferGB >= 400;
  const hasStarTrackers = Math.min(bus.pointingAccuracyArcsec, adcs.pointingAccuracyArcsec) <= 12;
  const hasStrongArmor = shielding.radToleranceKrad >= 150;
  const hasHighGainComms = comms.band !== 'S-Band';
  const body = objective.targetBody;

  if (body === 'earth') {
    return [
      {
        id: `earth-debris-${seed % 100}`,
        phaseIndex: 1,
        triggerProgress: 0.28,
        leadRole: 'propulsion',
        title: `LEO Debris Conjunction Tracked (${orbit.shortName})`,
        description:
          'Space Surveillance warns of a 14 cm upper-stage fragment intersecting your orbital track in 32 minutes.',
        choices: rotateChoices(
          [
            {
              id: 'evasive-burn',
              label: 'Fire 14 m/s Phasing Dodge Burn',
              riskNote: 'Consumes maneuvering propellant; guarantees clearance',
              detail: 'Phasing burn shifted orbit out of debris lane cleanly.',
              whyItMatters:
                'Small thruster reserves keep spacecraft alive in crowded Earth orbits.',
              hullDamage: 0,
              scienceDelta: 2,
              marginDelta: 9,
              collabDelta: 8,
            },
            {
              id: 'rad-track-trim',
              label: 'Precision Attitude Edge-On Dodge',
              riskNote: 'Requires Star Trackers (≤12" pointing) to align razor-thin profile',
              requiresHardwareLabel: 'Star Trackers (≤12" Pointing)',
              hardwareMet: hasStarTrackers,
              isHazardous: !hasStarTrackers,
              detail: hasStarTrackers
                ? 'Star trackers oriented craft edge-on cleanly with zero fuel spent!'
                : 'Coarse attitude sensors drifted mid-pass—debris clipped a solar panel (-28% Hull)!',
              whyItMatters:
                'Sub-arcsecond pointing lets craft orient safely without wasting fuel.',
              hullDamage: hasStarTrackers ? 0 : 28,
              scienceDelta: hasStarTrackers ? 10 : -18,
              marginDelta: hasStarTrackers ? 8 : -20,
              collabDelta: hasStarTrackers ? 9 : -5,
            },
            {
              id: 'ignore-conjunction',
              label: 'Ignore Warning & Keep Mapping Unchanged',
              riskNote: 'Zero fuel used, but crosses predicted collision corridor unprotected',
              isHazardous: true,
              detail: 'Micro-fragmentation impact punctured radiator loop (-42% Hull, Science lost)!',
              whyItMatters:
                'In busy LEO corridors, skipping collision avoidance causes catastrophic hull strikes.',
              hullDamage: 42,
              scienceDelta: -26,
              marginDelta: -28,
              collabDelta: -10,
              powerShiftW: -85,
            },
          ],
          seed,
        ),
      },
      {
        id: `earth-hurricane-${seed % 100}`,
        phaseIndex: 2,
        triggerProgress: 0.56,
        leadRole: 'payload',
        title: 'Category-5 Hurricane Eye Pass Over Ocean',
        description: `Emergency forecasters want rapid radar + thermal sweeps! ${
          hasRadHardComputer
            ? 'Your 512 GB flight computer can queue multi-orbit storm bursts.'
            : 'Your 64 GB memory fills rapidly during multi-sensor storm passes.'
        }`,
        choices: rotateChoices(
          [
            {
              id: 'burst-scan',
              label: 'Lock Uncompressed Multi-Sensor Burst',
              riskNote: 'Requires 512 GB Flight Computer to hold burst queue without crashing',
              requiresHardwareLabel: '512 GB Flight Computer',
              hardwareMet: hasRadHardComputer,
              isHazardous: !hasRadHardComputer,
              detail: hasRadHardComputer
                ? '512 GB recorder captured the entire hurricane eye wall with zero packet loss!'
                : '64 GB memory overflowed mid-storm—recorder rebooted and wiped recent scans (-24% Hull)!',
              whyItMatters:
                'Onboard memory size dictates whether a craft can capture bursts between ground station passes.',
              hullDamage: hasRadHardComputer ? 0 : 24,
              scienceDelta: hasRadHardComputer ? 14 : -22,
              marginDelta: hasRadHardComputer ? 6 : -18,
              collabDelta: hasRadHardComputer ? 10 : -4,
              dataShiftPct: hasRadHardComputer ? 12 : 35,
            },
            {
              id: 'compressed-pass',
              label: 'Run Onboard Cloud-Mask Compression',
              riskNote: 'Drops empty ocean pixels to keep memory safe; slight resolution trade-off',
              hullDamage: 0,
              detail: 'Compression trimmed daily GB by 30% and delivered key storm eye metrics.',
              whyItMatters:
                'Smart onboard filtering lets modest computers deliver critical disaster data.',
              scienceDelta: 5,
              marginDelta: 8,
              collabDelta: 8,
              dataShiftPct: -15,
            },
            {
              id: 'force-raw-unbuffered',
              label: 'Force Continuous Unbuffered Downlink Over Storm',
              riskNote: 'Reckless — drives radio amp beyond thermal limits over open ocean',
              isHazardous: true,
              hullDamage: 34,
              detail: 'Transmitter overheated during continuous open-ocean broadcast (-34% Hull)!',
              whyItMatters:
                'Running high-watt transmitters without a ground station in view wastes power and overheats hardware.',
              scienceDelta: -24,
              marginDelta: -26,
              collabDelta: -8,
              powerShiftW: -110,
            },
          ],
          seed + 1,
        ),
      },
      {
        id: `earth-downlink-${seed % 100}`,
        phaseIndex: 3,
        triggerProgress: 0.8,
        leadRole: 'power',
        title: 'Heavy Squall Rain Fade Over Polar Ground Dish',
        description: `Dense clouds weaken your ${comms.band} radio signal by 4 dB right as daily maps queue up.`,
        choices: rotateChoices(
          [
            {
              id: 'buffer-pass',
              label: 'Hold Packets in Memory Until Clear Pass',
              riskNote: 'Delays delivery 95 minutes, preserves battery and link reliability',
              hullDamage: 0,
              detail: 'Held science cleanly in memory and delivered full map on clear polar pass.',
              whyItMatters:
                'Multi-station ground networks let LEO satellites wait 95 minutes for clear skies.',
              scienceDelta: 4,
              marginDelta: 9,
              collabDelta: 9,
              powerShiftW: 20,
            },
            {
              id: 'high-gain-push',
              label: 'Switch to High-Rate Directional Downlink',
              riskNote: 'Requires Ka-Band Dish or Optical Laser to pierce rain fade cleanly',
              requiresHardwareLabel: 'Ka-Band Dish or Laser',
              hardwareMet: hasHighGainComms,
              isHazardous: !hasHighGainComms,
              detail: hasHighGainComms
                ? `${comms.shortLabel} punched through squall fade with crisp storm imagery!`
                : 'Weak S-Band patch failed in rain fade—corrupted storm frames and drained battery (-22% Hull)!',
              whyItMatters:
                'Antenna gain directly governs whether signals survive atmospheric rain attenuation.',
              hullDamage: hasHighGainComms ? 0 : 22,
              scienceDelta: hasHighGainComms ? 12 : -20,
              marginDelta: hasHighGainComms ? 6 : -18,
              collabDelta: hasHighGainComms ? 9 : -5,
            },
            {
              id: 'unfiltered-dump',
              label: 'Blast Raw Telemetry at 100% Amp Gain',
              riskNote: 'Overloads power bus and drops half the packets in static',
              isHazardous: true,
              hullDamage: 30,
              detail: 'Amplifier tripped breaker mid-pass, corrupting stored science (-30% Hull)!',
              whyItMatters:
                'Over-driving antennas against bad weather wastes energy and drops packets.',
              scienceDelta: -25,
              marginDelta: -24,
              collabDelta: -9,
              powerShiftW: -95,
            },
          ],
          seed + 2,
        ),
      },
    ];
  }

  if (body === 'moon') {
    return [
      {
        id: `lunar-umbra-${seed % 100}`,
        phaseIndex: 1,
        triggerProgress: 0.28,
        leadRole: 'power',
        title: `Lunar South Pole ${Math.round(orbit.eclipseFraction * 100)}% Shadow Crossing`,
        description: `Plunging into freezing lunar night! ${
          hasHighCapBattery
            ? 'Your 360 Wh Deep-Cycle battery holds solid emergency reserve.'
            : 'Your compact 120 Wh battery is dropping fast under radar + heater load.'
        }`,
        choices: rotateChoices(
          [
            {
              id: 'keep-radar-hot',
              label: 'Run Ice Radar at Full Power Inside Shadow',
              riskNote: 'Requires ≥300 Wh Battery Pack or triggers severe brownout',
              requiresHardwareLabel: 'Deep-Cycle Battery (≥300 Wh)',
              hardwareMet: hasHighCapBattery,
              isHazardous: !hasHighCapBattery,
              hullDamage: hasHighCapBattery ? 0 : 32,
              detail: hasHighCapBattery
                ? '360 Wh battery carried Ice Radar straight across the dark crater floor!'
                : '120 Wh battery collapsed in shadow—thermal freeze cracked radar electronics (-32% Hull)!',
              whyItMatters:
                'Low lunar orbits spend up to 38% of each lap in pitch black; battery sizing decides survival.',
              scienceDelta: hasHighCapBattery ? 13 : -24,
              marginDelta: hasHighCapBattery ? 5 : -24,
              collabDelta: hasHighCapBattery ? 8 : -6,
              powerShiftW: hasHighCapBattery ? -15 : -110,
            },
            {
              id: 'heater-priority',
              label: 'Enter Safe Duty-Cycle & Protect Heaters',
              riskNote: 'Pauses radar in shadow to keep battery above critical threshold',
              hullDamage: 0,
              detail: 'Duty-cycling kept propellant lines warm until sunlight returned.',
              whyItMatters:
                'When battery capacity is modest, turning sensors off during eclipses prevents permanent freeze damage.',
              scienceDelta: -3,
              marginDelta: 10,
              collabDelta: 8,
              powerShiftW: 45,
            },
            {
              id: 'shut-heaters-off',
              label: 'Cut Survival Heaters to Keep Cameras On',
              riskNote: 'Reckless — exposes frozen optical joints to -170°C lunar night',
              isHazardous: true,
              hullDamage: 44,
              detail: 'Propellant valve froze solid without heaters, rupturing fuel feed (-44% Hull)!',
              whyItMatters:
                'Thermal survival heaters can never be sacrificed in deep lunar eclipses.',
              scienceDelta: -30,
              marginDelta: -32,
              collabDelta: -10,
            },
          ],
          seed,
        ),
      },
      {
        id: `lunar-mascon-${seed % 100}`,
        phaseIndex: 2,
        triggerProgress: 0.56,
        leadRole: 'propulsion',
        title: 'Lunar Mascon Gravity Perturbation!',
        description:
          'Dense buried lunar basins dragged your periapsis 14 km lower toward Shackleton Crater rim.',
        choices: rotateChoices(
          [
            {
              id: 'periapsis-raise',
              label: 'Execute Station-Keeping Altitude Burn',
              riskNote: 'Uses maneuvering Δv; restores safe 24-month frozen orbit',
              hullDamage: 0,
              detail: 'Burn raised periapsis cleanly above crater peaks.',
              whyItMatters:
                'Lumpy lunar gravity destabilizes low orbits unless station-keeping fuel is budgeted.',
              scienceDelta: 2,
              marginDelta: 10,
              collabDelta: 8,
            },
            {
              id: 'star-skim',
              label: 'Precision Terrain-Following Rim Pass',
              riskNote: 'Requires Star Trackers (≤12" pointing) to skim safely',
              requiresHardwareLabel: 'Star Trackers (≤12" Pointing)',
              hardwareMet: hasStarTrackers,
              isHazardous: !hasStarTrackers,
              hullDamage: hasStarTrackers ? 0 : 35,
              detail: hasStarTrackers
                ? 'Precision ADCS tracked Shackleton ridge cleanly for razor-sharp ice maps!'
                : 'Coarse pointing drifted during low pass—thrusters fired late (-35% Hull)!',
              whyItMatters:
                'Low-altitude lunar skimming demands high-precision star-tracking attitude control.',
              scienceDelta: hasStarTrackers ? 14 : -24,
              marginDelta: hasStarTrackers ? 5 : -24,
              collabDelta: hasStarTrackers ? 8 : -6,
            },
            {
              id: 'ignore-mascon',
              label: 'Ignore Gravity Drift & Stay Uncorrected',
              riskNote: 'Reckless — orbit keeps decaying toward lunar mountains',
              isHazardous: true,
              hullDamage: 48,
              detail: 'Emergency late scrape skimmed ridge ejecta, damaging lower antenna (-48% Hull)!',
              whyItMatters:
                'Unattended lunar mascon drift ends missions via surface impact within months.',
              scienceDelta: -32,
              marginDelta: -30,
              collabDelta: -10,
            },
          ],
          seed + 1,
        ),
      },
      {
        id: `lunar-artemis-${seed % 100}`,
        phaseIndex: 3,
        triggerProgress: 0.8,
        leadRole: 'payload',
        title: 'Buried Water-Ice Deposit Detected at 88°S!',
        description: 'Strong hydrogen + radar reflection below an Artemis candidate ridge!',
        choices: rotateChoices(
          [
            {
              id: 'cross-calibrate',
              label: 'Cross-Scan & Queue Verified Ice Data',
              riskNote: 'Balanced power/data load; reliable Artemis resource proof',
              hullDamage: 0,
              detail: 'Confirmed subsurface ice purity cleanly within downlink budget.',
              whyItMatters:
                'Cross-calibrating instruments delivers verified discoveries without overloading links.',
              scienceDelta: 10,
              marginDelta: 7,
              collabDelta: 10,
            },
            {
              id: 'raw-mosaic-hga',
              label: 'Stream Live 3D Boulder Hazard Mosaic',
              riskNote: 'Requires Ka-Band Dish or Laser to handle heavy mosaic stream',
              requiresHardwareLabel: 'Ka-Band Dish or Laser',
              hardwareMet: hasHighGainComms,
              isHazardous: !hasHighGainComms,
              hullDamage: hasHighGainComms ? 0 : 25,
              detail: hasHighGainComms
                ? `${comms.shortLabel} streamed full 3D Artemis landing hazard map cleanly!`
                : 'S-Band antenna choked on raw 3D mosaic—buffer crashed and dropped scan (-25% Hull)!',
              whyItMatters:
                'Uncompressed terrain mosaics require high-gain links to avoid memory crashes.',
              scienceDelta: hasHighGainComms ? 15 : -22,
              marginDelta: hasHighGainComms ? 5 : -20,
              collabDelta: hasHighGainComms ? 9 : -5,
            },
            {
              id: 'untested-slew',
              label: 'Slew Craft Blindly Toward Solar Glare',
              riskNote: 'Reckless — points sensitive IR spectrometer straight at Sun',
              isHazardous: true,
              hullDamage: 38,
              detail: 'Direct sunlight blinded optical/IR optics permanently (-38% Hull)!',
              whyItMatters:
                'Keep-out cone rules protect sensitive detectors from direct solar damage.',
              scienceDelta: -34,
              marginDelta: -26,
              collabDelta: -8,
            },
          ],
          seed + 2,
        ),
      },
    ];
  }

  if (body === 'mars') {
    return [
      {
        id: `mars-dust-${seed % 100}`,
        phaseIndex: 1,
        triggerProgress: 0.28,
        leadRole: 'power',
        title: 'Global Martian Dust Storm at 1.52 AU!',
        description: `Sunlight is already 43% of Earth—dust haze cuts solar warmth. ${
          power.kind === 'nuclear'
            ? 'Your RTG nuclear battery ignores dust completely!'
            : 'Solar wings are losing output during cooling.'
        }`,
        choices: rotateChoices(
          [
            {
              id: 'rtg-push',
              label: 'Power All Radars & Heaters Through Dust Storm',
              riskNote: 'Requires RTG Nuclear Battery (or ≥300 Wh reserve) to avoid brownout',
              requiresHardwareLabel: 'RTG Nuclear or ≥300 Wh Battery',
              hardwareMet: power.kind === 'nuclear' || hasHighCapBattery,
              isHazardous: power.kind !== 'nuclear' && !hasHighCapBattery,
              hullDamage: power.kind === 'nuclear' || hasHighCapBattery ? 0 : 30,
              detail:
                power.kind === 'nuclear' || hasHighCapBattery
                  ? 'Steady nuclear/battery reserve kept storm instruments running continuously!'
                  : 'Solar + small battery browned out during dust cooling, resetting flight CPU (-30% Hull)!',
              whyItMatters:
                'At 1.52 AU, dust-cooled power margins punish solar probes without heavy battery reserves.',
              scienceDelta: power.kind === 'nuclear' || hasHighCapBattery ? 13 : -24,
              marginDelta: power.kind === 'nuclear' || hasHighCapBattery ? 7 : -22,
              collabDelta: power.kind === 'nuclear' || hasHighCapBattery ? 9 : -5,
            },
            {
              id: 'switch-ir-radar',
              label: 'Pause Optical Cam & Conserve Power',
              riskNote: 'Cuts non-essential draw so solar wings survive cooling storm',
              hullDamage: 0,
              detail: 'Power conservation preserved bus stability until Martian dust cleared.',
              whyItMatters:
                'Shedding optical cameras blinded by dust saves watts for thermal survival.',
              scienceDelta: 4,
              marginDelta: 10,
              collabDelta: 8,
              powerShiftW: 40,
            },
            {
              id: 'open-dust-covers',
              label: 'Open Precision Lens Covers Inside Dust Gale',
              riskNote: 'Reckless — exposes coated optics to abrasive electrostatic dust',
              isHazardous: true,
              hullDamage: 36,
              detail: 'Fine iron-oxide dust coated primary mirror, cutting imaging clarity (-36% Hull)!',
              whyItMatters:
                'Protecting optical covers during dust events saves mission instrumentation.',
              scienceDelta: -30,
              marginDelta: -26,
              collabDelta: -9,
            },
          ],
          seed,
        ),
      },
      {
        id: `mars-delay-${seed % 100}`,
        phaseIndex: 2,
        triggerProgress: 0.56,
        leadRole: 'propulsion',
        title: '12.9-Minute Light Delay Rover Relay Pass',
        description:
          'Commands from Earth take 13 minutes one-way—your orbiter must point autonomously at Jezero Crater.',
        choices: rotateChoices(
          [
            {
              id: 'auto-slew',
              label: 'Run Autonomous Star-Tracker Relay Sequence',
              riskNote: 'Requires Star Trackers (≤12" pointing) for locked high-speed pass',
              requiresHardwareLabel: 'Star Trackers (≤12" Pointing)',
              hardwareMet: hasStarTrackers,
              isHazardous: !hasStarTrackers,
              hullDamage: hasStarTrackers ? 0 : 22,
              detail: hasStarTrackers
                ? 'Sub-12" lock transferred 100% of rover core sample telemetry!'
                : 'Coarse pointing missed Jezero relay cone—rover timed out (-22% Hull)!',
              whyItMatters:
                'At 13-minute light delay, autonomous star-tracker pointing is essential.',
              scienceDelta: hasStarTrackers ? 14 : -18,
              marginDelta: hasStarTrackers ? 8 : -16,
              collabDelta: hasStarTrackers ? 10 : -4,
            },
            {
              id: 'wide-beam',
              label: 'Broadcast Wide Recovery Relay Beacon',
              riskNote: 'Lower speed, zero pointing risk; guarantees rover contact',
              hullDamage: 0,
              detail: 'Wide beam locked Jezero rover safely at reduced bandwidth.',
              whyItMatters:
                'Trading data speed for wide beamwidth prevents dropped rover contacts.',
              scienceDelta: 4,
              marginDelta: 9,
              collabDelta: 8,
            },
            {
              id: 'manual-joystick',
              label: 'Wait for Live Earth Joystick Commands',
              riskNote: 'Reckless — ignores 26-minute round-trip speed-of-light delay',
              isHazardous: true,
              hullDamage: 30,
              detail: 'Pass ended 20 minutes before Earth command even arrived—missed rover window (-30% Hull)!',
              whyItMatters:
                'You cannot joystick-fly a Mars orbiter in real time when light takes 13 minutes each way.',
              scienceDelta: -28,
              marginDelta: -22,
              collabDelta: -10,
            },
          ],
          seed + 1,
        ),
      },
      {
        id: `mars-dsn-${seed % 100}`,
        phaseIndex: 3,
        triggerProgress: 0.8,
        leadRole: 'power',
        title: '1.55 AU Deep-Space Downlink Bottleneck',
        description: `Across 230 million km, ${comms.shortLabel} must deliver rover caches and polar radar maps.`,
        choices: rotateChoices(
          [
            {
              id: 'prioritize-rover',
              label: 'Prioritize Compressed Rover Cache First',
              riskNote: 'Guarantees mission-critical samples fit inside link budget',
              hullDamage: 0,
              detail: 'Compressed rover packets reached DSN Goldstone with zero errors.',
              whyItMatters:
                'Prioritizing high-value science keeps deep-space links from overflowing.',
              scienceDelta: 8,
              marginDelta: 8,
              collabDelta: 9,
            },
            {
              id: 'hd-hga-dump',
              label: 'Stream Uncompressed Rover + Radar Survey',
              riskNote: 'Requires Ka-Band Dish or Laser to avoid 1.55 AU link collapse',
              requiresHardwareLabel: 'Ka-Band Dish or Laser',
              hardwareMet: hasHighGainComms,
              isHazardous: !hasHighGainComms,
              hullDamage: hasHighGainComms ? 0 : 25,
              detail: hasHighGainComms
                ? `${comms.shortLabel} streamed full HD Mars datasets smoothly across 1.55 AU!`
                : 'Low-gain S-Band saturated—data buffer dropped critical frames (-25% Hull)!',
              whyItMatters:
                'Deep-space HD dumps fail on weak omni antennas.',
              scienceDelta: hasHighGainComms ? 15 : -22,
              marginDelta: hasHighGainComms ? 5 : -19,
              collabDelta: hasHighGainComms ? 9 : -5,
            },
            {
              id: 'clear-buffer-raw',
              label: 'Overwrite Old Memory Without Downlinking',
              riskNote: 'Reckless — erases unconfirmed rover telemetry to free storage',
              isHazardous: true,
              hullDamage: 32,
              detail: 'Unbeamed Jezero core measurements were permanently overwritten (-32% Hull)!',
              whyItMatters:
                'Never purge onboard storage before Earth confirms packet receipt.',
              scienceDelta: -34,
              marginDelta: -20,
              collabDelta: -10,
            },
          ],
          seed + 2,
        ),
      },
    ];
  }

  if (body === 'psyche') {
    return [
      {
        id: `psyche-cruise-${seed % 100}`,
        phaseIndex: 1,
        triggerProgress: 0.28,
        leadRole: 'propulsion',
        title: '2.1 AU Sunlight Drop During Asteroid Cruise',
        description: `At 2.1 AU sunlight drops to 23% of Earth! ${
          power.kind === 'nuclear'
            ? 'Your RTG keeps heaters and computers warm.'
            : 'Solar wings must carefully feed cruise computers.'
        }`,
        choices: rotateChoices(
          [
            {
              id: 'coast-optimize',
              label: 'Enter Fuel-Optimal Sun-Pointed Attitude',
              riskNote: 'Protects power & propellant margin for asteroid arrival',
              hullDamage: 0,
              detail: 'Sun-pointed attitude charged batteries and conserved Δv cleanly.',
              whyItMatters:
                'Passive solar alignment avoids wasting propellant during deep-space cruise.',
              scienceDelta: 3,
              marginDelta: 10,
              collabDelta: 8,
              powerShiftW: 35,
            },
            {
              id: 'nuclear-thrust-boost',
              label: 'Sustain High-Isp Cruise Burn Through Dim Zone',
              riskNote: 'Requires RTG Nuclear Power (or ≥300 Wh Battery) for power stability',
              requiresHardwareLabel: 'RTG Nuclear or ≥300 Wh Battery',
              hardwareMet: power.kind === 'nuclear' || hasHighCapBattery,
              isHazardous: power.kind !== 'nuclear' && !hasHighCapBattery,
              hullDamage: power.kind === 'nuclear' || hasHighCapBattery ? 0 : 28,
              detail:
                power.kind === 'nuclear' || hasHighCapBattery
                  ? 'Steady cruise power delivered extra mapping days at Asteroid Psyche!'
                  : 'Cruise burn starved flight computer at 2.1 AU, forcing emergency safe-reboot (-28% Hull)!',
              whyItMatters:
                'Electric or high-watt cruise operations far from the Sun demand ample power margin.',
              scienceDelta: power.kind === 'nuclear' || hasHighCapBattery ? 13 : -22,
              marginDelta: power.kind === 'nuclear' || hasHighCapBattery ? 6 : -22,
              collabDelta: power.kind === 'nuclear' || hasHighCapBattery ? 9 : -4,
            },
            {
              id: 'skip-calibration',
              label: 'Power Off Navigation Star Checks During Cruise',
              riskNote: 'Reckless — trajectory drifts off asteroid intercept corridor',
              isHazardous: true,
              hullDamage: 40,
              detail: 'Missed trajectory correction burned emergency fuel reserves (-40% Hull)!',
              whyItMatters:
                'Midcourse navigation checks prevent costly fuel penalties near target arrival.',
              scienceDelta: -28,
              marginDelta: -30,
              collabDelta: -8,
            },
          ],
          seed,
        ),
      },
      {
        id: `psyche-tumbling-${seed % 100}`,
        phaseIndex: 2,
        triggerProgress: 0.56,
        leadRole: 'payload',
        title: 'Metallic Asteroid Spin & Gravity Anomaly!',
        description:
          'Lumpy nickel-iron mass pockets tugged your close formation pass over asteroid Psyche!',
        choices: rotateChoices(
          [
            {
              id: 'precision-track',
              label: 'Lock Rotation Rate with Precision Star Trackers',
              riskNote: 'Requires Star Trackers (≤12" pointing) to hold close formation safely',
              requiresHardwareLabel: 'Star Trackers (≤12" Pointing)',
              hardwareMet: hasStarTrackers,
              isHazardous: !hasStarTrackers,
              hullDamage: hasStarTrackers ? 0 : 34,
              detail: hasStarTrackers
                ? 'Star trackers locked smoothly onto metallic ridges for crisp magnetic maps!'
                : 'Coarse ADCS tumbled during gravity tug—reaction wheels saturated (-34% Hull)!',
              whyItMatters:
                'Oddly shaped asteroids require tight attitude control to map safely.',
              scienceDelta: hasStarTrackers ? 14 : -22,
              marginDelta: hasStarTrackers ? 7 : -24,
              collabDelta: hasStarTrackers ? 9 : -5,
            },
            {
              id: 'back-off-orbit',
              label: 'Step Out 50 km to Higher Stand-Off Orbit',
              riskNote: 'Trades close-up sharpness for zero gravity-tumble risk',
              hullDamage: 0,
              detail: 'Higher stand-off orbit stabilized spacecraft cleanly.',
              whyItMatters:
                'Backing out to a higher orbit protects probes around lumpy small bodies.',
              scienceDelta: 2,
              marginDelta: 10,
              collabDelta: 8,
            },
            {
              id: 'dive-blind',
              label: 'Swoop 10 km Lower Without Gravity Model',
              riskNote: 'Reckless — risks asteroid boulder impact or escape velocity loss',
              isHazardous: true,
              hullDamage: 46,
              detail: 'Unmodeled gravity spike slammed craft into spinning tumble, burning thrusters dry (-46% Hull)!',
              whyItMatters:
                'Never descend into irregular asteroid gravity wells before mapping mass distribution.',
              scienceDelta: -32,
              marginDelta: -32,
              collabDelta: -10,
            },
          ],
          seed + 1,
        ),
      },
      {
        id: `psyche-deflect-${seed % 100}`,
        phaseIndex: 3,
        triggerProgress: 0.8,
        leadRole: 'power',
        title: 'Asteroid Core Density & Magnetic Profile Ready',
        description: `Final target density & magnetic survey ready to beam across ${orbit.commsDistanceAU} AU.`,
        choices: rotateChoices(
          [
            {
              id: 'package-deflect-data',
              label: 'Transmit Priority Mass, Spin & Core Profile',
              riskNote: 'Compact packet guaranteed to clear link budget',
              hullDamage: 0,
              detail: 'Core density & planetary defense profile delivered cleanly.',
              whyItMatters:
                'Prioritizing core metrics guarantees primary science even on modest links.',
              scienceDelta: 9,
              marginDelta: 8,
              collabDelta: 9,
            },
            {
              id: 'raw-3d-scan',
              label: 'Stream Full Uncompressed 3D Radar Mesh',
              riskNote: 'Requires 512 GB Computer + High-Gain Link to avoid timeout',
              requiresHardwareLabel: '512 GB CPU + High-Gain Link',
              hardwareMet: hasRadHardComputer && hasHighGainComms,
              isHazardous: !(hasRadHardComputer && hasHighGainComms),
              hullDamage: hasRadHardComputer && hasHighGainComms ? 0 : 24,
              detail:
                hasRadHardComputer && hasHighGainComms
                  ? 'Full 3D stereo asteroid terrain mesh beamed cleanly to Earth!'
                  : 'Buffer & link bottlenecked raw 3D dump—partial dataset corrupted (-24% Hull)!',
              whyItMatters:
                'Large uncompressed 3D meshes demand both deep memory buffers and high-gain antennas.',
              scienceDelta: hasRadHardComputer && hasHighGainComms ? 15 : -20,
              marginDelta: hasRadHardComputer && hasHighGainComms ? 6 : -18,
              collabDelta: hasRadHardComputer && hasHighGainComms ? 10 : -5,
            },
            {
              id: 'skip-mag-zero',
              label: 'Disable Magnetometer Calibration Check',
              riskNote: 'Reckless — leaves spacecraft metallic noise unsubtracted',
              isHazardous: true,
              hullDamage: 28,
              detail: 'Uncalibrated readings masked Psyche’s metallic core signal (-28% Hull)!',
              whyItMatters:
                'Magnetometer calibration separates true planetary magnetism from spacecraft bus interference.',
              scienceDelta: -30,
              marginDelta: -18,
              collabDelta: -8,
            },
          ],
          seed + 2,
        ),
      },
    ];
  }

  // Europa / Jupiter Deep-Space Mission
  return [
    {
      id: `europa-freeze-${seed % 100}`,
      phaseIndex: 1,
      triggerProgress: 0.28,
      leadRole: 'power',
      title: '5.2 AU Deep-Space Cold Soak (3.7% Sunlight)',
      description: `At Jupiter, sunlight is 27× weaker than Earth! ${
        power.kind === 'nuclear'
          ? 'Your RTG nuclear battery makes both steady electricity and free warmth.'
          : 'Solar panels are starved of photons in deep space.'
      }`,
      choices: rotateChoices(
        [
          {
            id: 'rtg-full-warm',
            label: 'Sustain RTG Thermal Loop & Pre-Warm Spectrometers',
            riskNote: 'Requires RTG Nuclear Power at 5.2 AU (or risks severe solar freeze)',
            requiresHardwareLabel: 'MMRTG Nuclear Battery',
            hardwareMet: power.kind === 'nuclear',
            isHazardous: power.kind !== 'nuclear',
            hullDamage: power.kind === 'nuclear' ? 0 : 38,
            detail:
              power.kind === 'nuclear'
                ? 'RTG waste heat held electronics at +20°C effortlessly at 5.2 AU!'
                : 'Solar wings produced <4% power—heaters browned out and froze propulsion lines (-38% Hull)!',
            whyItMatters:
              'At 5.2 AU, sunlight follows the 1/r² inverse-square law (1/5.2² = 3.7%), making RTGs vital.',
            scienceDelta: power.kind === 'nuclear' ? 12 : -26,
            marginDelta: power.kind === 'nuclear' ? 10 : -28,
            collabDelta: power.kind === 'nuclear' ? 9 : -6,
          },
          {
            id: 'thermal-preserve',
            label: 'Hibernate Science Bay & Protect Core Bus',
            riskNote: 'Cuts all science sampling to keep avionics alive',
            hullDamage: 0,
            detail: 'Deep hibernation kept core avionics intact across cold cruise.',
            whyItMatters:
              'Hibernation saves marginal craft at the cost of missed cruise observations.',
            scienceDelta: -2,
            marginDelta: 8,
            collabDelta: 7,
            powerShiftW: 25,
          },
          {
            id: 'run-heaters-unregulated',
            label: 'Force All Heaters & Imagers Full Power',
            riskNote: 'Reckless — drains main bus voltage below computer cutoff',
            isHazardous: true,
            hullDamage: 44,
            detail: 'Uncontrolled bus sag triggered hard flight-computer brownout (-44% Hull)!',
            whyItMatters:
              'Ignoring deep-space power margins breaks spacecraft before science even begins.',
            scienceDelta: -30,
            marginDelta: -32,
            collabDelta: -10,
            powerShiftW: -120,
          },
        ],
        seed,
      ),
    },
    {
      id: `europa-rad-${seed % 100}`,
      phaseIndex: 2,
      triggerProgress: 0.56,
      leadRole: 'propulsion',
      title: 'Io Plasma Torus Radiation Spike!',
      description: `Jupiter’s magnetic belts unleash high-energy electrons! ${
        hasStrongArmor
          ? `Your ${shielding.name} (${shielding.radToleranceKrad} krad) protects the vault cleanly.`
          : 'Standard foil shielding risks bit-flips and sensor burn-out!'
      }`,
      choices: rotateChoices(
        [
          {
            id: 'sample-plume-vault',
            label: 'Dive Through Plume Behind Radiation Vault',
            riskNote: 'Requires Titanium Rad Vault (≥150 krad) to survive peak Jovian flux',
            requiresHardwareLabel: 'Titanium Rad Vault (≥150 krad)',
            hardwareMet: hasStrongArmor,
            isHazardous: !hasStrongArmor,
            hullDamage: hasStrongArmor ? 0 : 40,
            detail: hasStrongArmor
              ? 'Titanium Vault blocked relativistic electrons while sampling ocean water plumes!'
              : 'Thin foil could not block Jovian flux—bit-flips fried spectrometer memory (-40% Hull)!',
            whyItMatters:
              'Heavy radiation vaults are the price of close science around Jupiter and Europa.',
            scienceDelta: hasStrongArmor ? 16 : -28,
            marginDelta: hasStrongArmor ? 7 : -26,
            collabDelta: hasStrongArmor ? 9 : -6,
          },
          {
            id: 'rad-vault-reset',
            label: 'Pause Sampling & Engage Memory Scrub Safe Mode',
            riskNote: 'Protects electronics during belt peak; loses this plume pass',
            hullDamage: 0,
            detail: 'Memory scrub and safe orientation prevented bit-flip corruption.',
            whyItMatters:
              'Turning sensors off during radiation peaks saves hardware when shielding is light.',
            scienceDelta: -4,
            marginDelta: 10,
            collabDelta: 8,
          },
          {
            id: 'ignore-rad-belts',
            label: 'Ignore Belt Alert & Disable Error Correction',
            riskNote: 'Reckless — lets unshielded radiation corrupt flight memory',
            isHazardous: true,
            hullDamage: 50,
            detail: 'Massive single-event upset scrambled attitude thrusters (-50% Hull)!',
            whyItMatters:
              'Disabling error-correcting avionics inside Jupiter’s radiation belts is fatal.',
            scienceDelta: -36,
            marginDelta: -34,
            collabDelta: -12,
          },
        ],
        seed + 1,
      ),
    },
    {
      id: `europa-43min-${seed % 100}`,
      phaseIndex: 3,
      triggerProgress: 0.8,
      leadRole: 'payload',
      title: '43-Minute Light-Delay Plume Data Return',
      description: `Earth is 780 million km away—your ${comms.shortLabel} must send ocean chemistry home.`,
      choices: rotateChoices(
        [
          {
            id: 'smart-burst',
            label: 'Prioritize Calibrated Ocean Plume Spectra',
            riskNote: 'Guarantees key biosignature proof reaches DSN cleanly',
            hullDamage: 0,
            detail: 'Core ocean plume spectra received cleanly at DSN Madrid!',
            whyItMatters:
              'Prioritizing core biosignature packets guarantees mission return across 5.2 AU.',
            scienceDelta: 10,
            marginDelta: 8,
            collabDelta: 10,
          },
          {
            id: 'raw-plume-hga',
            label: 'Stream Full Uncompressed Plume + Ice Radar Burst',
            riskNote: 'Requires Ka-Band Dish or Laser + 512 GB Computer across 5.2 AU',
            requiresHardwareLabel: '512 GB CPU + High-Gain Link',
            hardwareMet: hasRadHardComputer && hasHighGainComms,
            isHazardous: !(hasRadHardComputer && hasHighGainComms),
            hullDamage: hasRadHardComputer && hasHighGainComms ? 0 : 26,
            detail:
              hasRadHardComputer && hasHighGainComms
                ? 'High-gain link and 512 GB CPU returned Nobel-class ocean radar cleanly!'
                : 'Weak antenna/buffer dropped 5.2 AU burst before DSN lock finished (-26% Hull)!',
            whyItMatters:
              'Raw deep-space radar dumps fail without high-gain antennas and deep onboard buffers.',
            scienceDelta: hasRadHardComputer && hasHighGainComms ? 16 : -22,
            marginDelta: hasRadHardComputer && hasHighGainComms ? 6 : -18,
            collabDelta: hasRadHardComputer && hasHighGainComms ? 9 : -5,
          },
          {
            id: 'skip-dsn-window',
            label: 'Hold Data & Skip Scheduled DSN Pass',
            riskNote: 'Reckless — buffer overflows before next belt flyby',
            isHazardous: true,
            hullDamage: 32,
            detail: 'Memory buffer overflowed on next pass, erasing ocean plume spectra (-32% Hull)!',
            whyItMatters:
              'Never skip a scheduled Deep Space Network pass when operating at 5.2 AU.',
            scienceDelta: -32,
            marginDelta: -22,
            collabDelta: -10,
          },
        ],
        seed + 2,
      ),
    },
  ];
}

export function evaluateSimulationOutcome(
  config: MissionConfig,
  telemetry: TelemetryReport,
  chosenActions: { scienceDelta: number; marginDelta: number; collabDelta: number }[],
  teamMemberCount: number,
  allReadySignedOff: boolean,
  liveReport?: LiveFlightReport,
): SimulationOutcome {
  const { difficulty, objective, orbit, launchVehicle, propulsion, power, comms, shielding, bus, instruments } =
    getCatalogParts(config);
  const lessons: string[] = [];

  const actionScience = chosenActions.reduce((s, c) => s + c.scienceDelta, 0);
  const actionMargin = chosenActions.reduce((s, c) => s + c.marginDelta, 0);
  const actionCollab = chosenActions.reduce((s, c) => s + c.collabDelta, 0);

  let missionSuccess = difficulty.isSandbox ? true : telemetry.launchReady;
  let failureDay: number | null = null;
  let failureSummary = difficulty.isSandbox ? null : telemetry.criticalFailureReason;

  const hullRemaining = liveReport?.hullIntegrityPct ?? 100;
  const wrongChoicesCount = liveReport?.wrongChoicesCount ?? 0;
  const batteryDropouts = liveReport?.batteryDropouts ?? 0;
  const dataOverflows = liveReport?.dataOverflows ?? 0;

  if (!difficulty.isSandbox) {
    if (!missionSuccess) {
      if (telemetry.massStatus === 'Critical') {
        failureDay = 1;
        failureSummary = `Mission Failed on Day 1 (Liftoff): Your spacecraft (${telemetry.wetMassKg} kg) exceeded ${launchVehicle.name}'s ${telemetry.payloadCapacityKg} kg limit for ${orbit.shortName}.`;
      } else if (telemetry.deltaVStatus === 'Critical') {
        failureDay = 42;
        failureSummary = `Mission Failed on Day 42 (Orbit Capture): ${propulsion.name} only had ${telemetry.availableDeltaVKms} km/s Δv, missing the ${telemetry.requiredDeltaVKms} km/s needed to enter ${orbit.shortName}.`;
      } else if (telemetry.powerStatus === 'Critical') {
        failureDay = 84;
        failureSummary = `Mission Failed on Day 84 (Power Brownout): Your systems drew ${telemetry.powerPeakDrawW}W, but ${power.shortLabel} only made ${telemetry.powerGeneratedW}W at ${orbit.solarDistanceAU} AU.`;
      } else {
        failureDay = 12;
      }
    } else if (hullRemaining <= 0 || wrongChoicesCount >= 2) {
      missionSuccess = false;
      failureDay = 112;
      failureSummary = `Spacecraft Lost in Flight (Day 112): ${
        liveReport?.lastEventSummary ||
        'Cumulative hardware damage from reckless flight commands or missing subsystem protection disabled the spacecraft.'
      }`;
    } else if (batteryDropouts >= 3) {
      missionSuccess = false;
      failureDay = 128;
      failureSummary = `Mission Failed on Day 128 (Eclipse Brownout): Leaving full science load on during shadow drained your battery repeatedly—switch Power Bus Mode to Balanced/Safe Mode or mount a larger battery.`;
    } else if (telemetry.budgetStatus === 'Critical') {
      missionSuccess = false;
      failureDay = 1;
      failureSummary = `Mission Canceled on Day 1 (Review): Total cost $${telemetry.totalCostM}M went $${(telemetry.totalCostM - telemetry.budgetCapM).toFixed(1)}M over your $${telemetry.budgetCapM}M agency budget cap.`;
    } else if (
      telemetry.linkMarginDb < 0 ||
      telemetry.downlinkCapacityGBDay < telemetry.dataGeneratedGBDay * 0.5 ||
      dataOverflows >= 3
    ) {
      missionSuccess = false;
      failureDay = 140;
      const topInst = instruments[0]?.shortName || 'instruments';
      failureSummary = `Mission Failed on Day 140 (Data Overflow): Your ${topInst} generated ${telemetry.dataGeneratedGBDay} GB/day—more than ${comms.shortLabel} (${telemetry.downlinkCapacityGBDay} GB/day) and live downlinks could clear!`;
    } else if (telemetry.estimatedLifetimeMonths < objective.minLifetimeMonths * 0.72) {
      missionSuccess = false;
      failureDay = Math.max(90, Math.round(telemetry.estimatedLifetimeMonths * 30));
      failureSummary = `Mission Failed on Day ${failureDay}: Harsh orbital radiation (${orbit.radiationDoseRate} krad/yr) overwhelmed ${shielding.name} before the ${objective.minLifetimeMonths}-month goal.`;
    }
  }

  // Explicit Criteria Checks with clear cause-and-effect explanations
  const criteriaChecks: CriterionCheck[] = [
    {
      label: 'Program Budget Cap',
      passed: telemetry.totalCostM <= telemetry.budgetCapM,
      detail: `$${telemetry.totalCostM}M / $${telemetry.budgetCapM}M`,
      whyItMattered:
        telemetry.totalCostM <= telemetry.budgetCapM
          ? `Keeping launch (${launchVehicle.name}) and hardware under $${telemetry.budgetCapM}M left room in the agency budget without cutting core science.`
          : `Combining ${launchVehicle.name} ($${launchVehicle.costM}M) with heavy/advanced subsystems pushed total spending $${(telemetry.totalCostM - telemetry.budgetCapM).toFixed(1)}M past the cap.`,
    },
    {
      label: 'Rocket Payload Capacity',
      passed: telemetry.massStatus !== 'Critical',
      detail: `${telemetry.wetMassKg} kg / ${telemetry.payloadCapacityKg} kg max`,
      whyItMattered:
        telemetry.massStatus !== 'Critical'
          ? `Your fueled spacecraft (${telemetry.wetMassKg} kg) fit inside ${launchVehicle.name}'s ${telemetry.payloadCapacityKg} kg lift limit for ${orbit.shortName}.`
          : `Distant/low orbits shrink a rocket's lift limit; ${telemetry.wetMassKg} kg wet mass or the ${bus.shortLabel} frame exceeded what ${launchVehicle.name} could carry here.`,
    },
    {
      label: 'Orbital Insertion Δv',
      passed: telemetry.deltaVStatus !== 'Critical',
      detail: `${telemetry.availableDeltaVKms} / ${telemetry.requiredDeltaVKms} km/s`,
      whyItMattered:
        telemetry.deltaVStatus !== 'Critical'
          ? `${propulsion.name} (${propulsion.ispSec}s Isp) gave enough speed change (${telemetry.availableDeltaVKms} km/s) to brake into ${orbit.shortName}.`
          : `Entering ${orbit.shortName} takes ${telemetry.requiredDeltaVKms} km/s of Δv; without enough propellant or a higher-Isp engine, the probe flies past its target.`,
    },
    {
      label: 'Power Generation Margin',
      passed: telemetry.powerMarginW >= 0,
      detail: `${telemetry.powerMarginW >= 0 ? '+' : ''}${telemetry.powerMarginW} W`,
      whyItMattered:
        telemetry.powerMarginW >= 0
          ? `${power.shortLabel} generated ${telemetry.powerGeneratedW}W at ${orbit.solarDistanceAU} AU, covering ${telemetry.powerPeakDrawW}W peak draw with +${telemetry.powerMarginW}W spare.`
          : `At ${orbit.solarDistanceAU} AU sunlight drops to ${(telemetry.solarFluxFactor * 100).toFixed(1)}%, so ${power.shortLabel} fell ${Math.abs(telemetry.powerMarginW)}W short of instrument and heater draw.`,
    },
    {
      label: 'Communications Downlink',
      passed: telemetry.dataStatus !== 'Critical',
      detail: `${telemetry.downlinkCapacityGBDay} / ${telemetry.dataGeneratedGBDay} GB/d (${telemetry.downlinkMbps} Mbps)`,
      whyItMattered:
        telemetry.dataStatus !== 'Critical'
          ? `${comms.shortLabel} maintained a ${telemetry.linkMarginDb} dB link across ${orbit.commsDistanceAU} AU, returning ${telemetry.downlinkCapacityGBDay} GB/day vs ${telemetry.dataGeneratedGBDay} GB/day gathered.`
          : `Across ${orbit.commsDistanceAU} AU, ${comms.shortLabel} only sent ${telemetry.downlinkCapacityGBDay} GB/day (${telemetry.linkMarginDb} dB), bottlenecking ${telemetry.dataGeneratedGBDay} GB/day of science data.`,
    },
    {
      label: 'Science Return Target',
      passed: telemetry.scienceReturnPotential >= objective.minScienceValue,
      detail: `${telemetry.scienceReturnPotential} / ${objective.minScienceValue} min`,
      whyItMattered:
        telemetry.scienceReturnPotential >= objective.minScienceValue
          ? `Matching preferred sensors with ${orbit.shortName} boosted measurement quality to ${telemetry.scienceReturnPotential} points.`
          : `To reach ${objective.minScienceValue} science points, pair instruments suited to ${objective.title} with an orbit around ${objective.targetBody.toUpperCase()}.`,
    },
    {
      label: 'Operational Lifetime Goal',
      passed: telemetry.estimatedLifetimeMonths >= objective.minLifetimeMonths,
      detail: `${telemetry.estimatedLifetimeYears} yrs (${telemetry.estimatedLifetimeMonths} mo)`,
      whyItMattered:
        telemetry.estimatedLifetimeMonths >= objective.minLifetimeMonths
          ? `${shielding.name} (${shielding.radToleranceKrad} krad) and fuel reserves sustained ${telemetry.estimatedLifetimeMonths} months against ${orbit.radiationDoseRate} krad/yr radiation.`
          : `Radiation (${orbit.radiationDoseRate} krad/yr) or tight station-keeping fuel wore down ${shielding.name} before the ${objective.minLifetimeMonths}-month mission goal.`,
    },
  ];

  // 1. Science Score (0-100)
  const overflowPenalty = dataOverflows * 8;
  const rawScience = telemetry.scienceReturnPotential + actionScience - overflowPenalty;
  const scienceScore = Math.max(0, Math.min(100, Math.round(missionSuccess ? rawScience : rawScience * 0.42)));

  // 2. Engineering Margin Score (0-100)
  const massUtilization = telemetry.wetMassKg / Math.max(1, telemetry.payloadCapacityKg);
  const massPoints = massUtilization <= 0.85 ? 25 : massUtilization <= 1.0 ? 18 : 0;
  const powerPoints = telemetry.powerMarginW >= 120 ? 25 : telemetry.powerMarginW >= 25 ? 18 : telemetry.powerMarginW >= 0 ? 10 : 0;
  const dvPoints =
    telemetry.availableDeltaVKms >= telemetry.requiredDeltaVKms * 1.1
      ? 25
      : telemetry.availableDeltaVKms >= telemetry.requiredDeltaVKms
        ? 18
        : 0;
  const lifePoints =
    telemetry.estimatedLifetimeMonths >= telemetry.requiredLifetimeMonths
      ? 25
      : Math.round(25 * (telemetry.estimatedLifetimeMonths / Math.max(1, telemetry.requiredLifetimeMonths)));
  const liveOpsMarginPenalty = batteryDropouts * 8 + Math.max(0, 100 - hullRemaining) * 0.35;
  const marginScore = Math.max(
    0,
    Math.min(100, Math.round(massPoints + powerPoints + dvPoints + lifePoints + actionMargin - liveOpsMarginPenalty)),
  );

  // 3. Budget Efficiency (0-100)
  const costRatio = telemetry.totalCostM / Math.max(1, telemetry.budgetCapM);
  let budgetScore = 0;
  if (costRatio <= 0.78) budgetScore = 96;
  else if (costRatio <= 0.92) budgetScore = 88;
  else if (costRatio <= 1.0) budgetScore = 76;
  else budgetScore = Math.max(15, Math.round(70 - (costRatio - 1) * 140));

  // 4. Subsystem Synergy (0-100)
  const baseSynergy = 48 + telemetry.synergies.length * 14;
  const dataPenalty = telemetry.dataStatus === 'Critical' ? -28 : telemetry.dataStatus === 'Tight' ? -10 : 8;
  const synergyScore = Math.max(0, Math.min(100, Math.round(baseSynergy + dataPenalty)));

  // 5. Collaboration / Flight Operations (0-100)
  const baseCollab = teamMemberCount > 1 ? (allReadySignedOff ? 78 : 62) : 68;
  const flushedBonus = liveReport ? Math.min(10, Math.round(liveReport.flushedGB * 0.25)) : 0;
  const collabScore = Math.max(0, Math.min(100, Math.round(baseCollab + actionCollab + flushedBonus - wrongChoicesCount * 10)));

  const rawTotal = scienceScore + marginScore + budgetScore + synergyScore + collabScore;
  const totalScore = Math.max(
    0,
    Math.min(500, Math.round(rawTotal * difficulty.scoreBonusMultiplier)),
  );

  let grade: 'S' | 'A' | 'B' | 'C' | 'F' = 'F';
  if (!missionSuccess) {
    grade = 'F';
  } else if (totalScore >= 435) {
    grade = 'S';
  } else if (totalScore >= 380) {
    grade = 'A';
  } else if (totalScore >= 315) {
    grade = 'B';
  } else {
    grade = 'C';
  }

  if (wrongChoicesCount > 0) {
    lessons.push(
      `${wrongChoicesCount} in-flight command(s) pushed hardware past safe limits or ignored environmental risks (${hullRemaining}% hull integrity remaining).`,
    );
  }
  if (batteryDropouts > 0) {
    lessons.push(
      `Battery dropped critically during shadow eclipse ${batteryDropouts} time(s)—switch Power Bus Mode to Balanced/Safe during shadow or mount a ≥300 Wh battery.`,
    );
  }
  if (dataOverflows > 0) {
    lessons.push(
      `Onboard memory overflowed ${dataOverflows} time(s)—flush buffered data during Earth ground passes or upgrade to a 512 GB flight computer & Ka-Band/Optical link.`,
    );
  }
  if (telemetry.synergies.length > 0) {
    lessons.push(`Strong architecture match: ${telemetry.synergies[0]}.`);
  }
  if (telemetry.powerMarginW < 60) {
    lessons.push(
      `Power margin (${telemetry.powerMarginW} W) was tight—deep-space 1/r² solar loss or high instrument draw limits duty cycles.`,
    );
  } else {
    lessons.push(`Healthy +${telemetry.powerMarginW} W power reserve enabled uninterrupted instrument operations.`);
  }
  if (telemetry.downlinkCapacityGBDay < telemetry.dataGeneratedGBDay) {
    lessons.push(
      `Science instruments produced ${telemetry.dataGeneratedGBDay} GB/day vs ${telemetry.downlinkCapacityGBDay} GB/day downlink—upgrading to High-Gain Dish or Laser Comms prevents buffer overflow.`,
    );
  }
  if (telemetry.totalCostM <= telemetry.budgetCapM * 0.88) {
    lessons.push(
      `Delivered mission $${(telemetry.budgetCapM - telemetry.totalCostM).toFixed(1)}M under the $${telemetry.budgetCapM}M ${difficulty.label} cap.`,
    );
  }

  return {
    totalScore,
    grade,
    scienceScore,
    marginScore,
    budgetScore,
    synergyScore,
    collabScore,
    missionSuccess,
    failureDay,
    failureSummary,
    criteriaChecks,
    lessons,
    hullRemainingPct: hullRemaining,
    wrongChoicesCount,
  };
}
