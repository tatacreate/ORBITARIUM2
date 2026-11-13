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
  ConstraintStatus,
  CriterionCheck,
  EngineeringAdvisory,
  FlightAnomaly,
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
    linkMarginDb < 2 || downlinkCapacityGBDay < dataGeneratedGBDay * 0.7
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

export function generateFlightAnomalies(config: MissionConfig, seed: number): FlightAnomaly[] {
  const { objective, orbit, power, comms, propulsion } = getCatalogParts(config);
  const pickSolar = power.kind === 'solar';
  const isDeep = orbit.solarDistanceAU >= 1.5;

  const anomaly1Pool: FlightAnomaly[] = [
    pickSolar
      ? {
          id: `solar-flare-${seed % 100}`,
          phaseIndex: 1,
          triggerProgress: 0.28,
          leadRole: 'power',
          title: isDeep
            ? 'Solar Dust Storm & Irradiance Drop'
            : 'Solar Flare Incoming!',
          description: isDeep
            ? `At ${orbit.solarDistanceAU} AU, plasma scattering cuts solar wing output by 20% during deep-space cruise.`
            : 'An X-class solar flare is racing toward your spacecraft! Radiation spikes can scramble electronics.',
          choices: [
            {
              id: 'safe-mode',
              label: 'Put Instruments in Safe Mode',
              detail: 'Protects batteries & electronics (+12 Margin, -4 Science).',
              whyItMatters:
                'Powering down sensitive cameras during a solar storm prevents electrical shorts and keeps batteries healthy.',
              scienceDelta: -4,
              marginDelta: 12,
              collabDelta: 8,
              powerShiftW: 55,
            },
            {
              id: 'burn-through',
              label: 'Keep Recording Science Data',
              detail: 'Captures rare solar storm readings, drains power (+10 Science, -10 Margin).',
              whyItMatters:
                'Keeping instruments awake gathers awesome storm physics, at the cost of battery reserve.',
              scienceDelta: 10,
              marginDelta: -10,
              collabDelta: 5,
              powerShiftW: -65,
            },
          ],
        }
      : {
          id: `thermal-shunt-${seed % 100}`,
          phaseIndex: 1,
          triggerProgress: 0.28,
          leadRole: 'propulsion',
          title: 'RTG Radiator Louver Drift',
          description:
            'Heat from the nuclear battery is warming the spectrometer bay faster than planned during cruise.',
          choices: [
            {
              id: 'roll-maneuver',
              label: 'Start Slow Thermal Roll Maneuver',
              detail: 'Evenly radiates excess heat into space (+10 Margin, +2 Science).',
              whyItMatters:
                'Slowly spinning the spacecraft like a rotisserie cools sun-facing panels without wasting battery power.',
              scienceDelta: 2,
              marginDelta: 10,
              collabDelta: 6,
              powerShiftW: 20,
            },
            {
              id: 'duty-cycle',
              label: 'Pause High-Power Radio Briefly',
              detail: 'Drops internal heat fast (+5 Margin, -3 Science).',
              whyItMatters:
                'Taking short transmitter breaks reduces electronics heat with zero thruster fuel spent.',
              scienceDelta: -3,
              marginDelta: 5,
              collabDelta: 8,
              powerShiftW: 35,
            },
          ],
        },
    {
      id: `valve-sensor-${seed % 100}`,
      phaseIndex: 1,
      triggerProgress: 0.28,
      leadRole: 'propulsion',
      title: `${propulsion.name} Pressure Sensor Spike`,
      description:
        'Telemetry detects a brief pressure wobble in the main fuel line right before orbit insertion.',
      choices: [
        {
          id: 'backup-manifold',
          label: 'Switch to Backup Propellant Valve',
          detail: 'Locks in safe orbit capture burn (+12 Margin, +7 Collab).',
          whyItMatters:
            'Spacecraft carry backup valves so one sticky part never ruins an entire multi-million-dollar mission.',
          scienceDelta: 0,
          marginDelta: 12,
          collabDelta: 7,
          powerShiftW: 15,
        },
        {
          id: 'single-burn-push',
          label: 'Hold Primary Valve & Trim Burn',
          detail: 'Keeps tight schedule (+6 Science, -6 Margin).',
          whyItMatters:
            'Skipping the switch saves time, though it leaves less propellant safety margin.',
          scienceDelta: 6,
          marginDelta: -6,
          collabDelta: 5,
          powerShiftW: -25,
        },
      ],
    },
  ];

  const anomaly2Pool: FlightAnomaly[] = [
    {
      id: `micrometeoroid-panel-${seed % 100}`,
      phaseIndex: 2,
      triggerProgress: 0.56,
      leadRole: 'power',
      title: 'Micrometeoroid Damaged Solar Panel A!',
      description:
        'A pebble-sized space rock nicked one power wing, cutting spare wattage and shaking reaction wheels.',
      choices: [
        {
          id: 'reroute-power',
          label: 'Reroute Power & Lower Data Rate Briefly',
          detail: 'Stabilizes bus voltage & wheel pointing (+11 Margin, +8 Collab, +3 Science).',
          whyItMatters:
            'Lowering radio transmit speed saves watts immediately so critical computers stay powered.',
          scienceDelta: 3,
          marginDelta: 11,
          collabDelta: 8,
          powerShiftW: 45,
          dataShiftPct: -15,
        },
        {
          id: 'keep-camera-full',
          label: 'Keep Camera & Radio at Full Throttle',
          detail: 'Zero pause in mapping, stresses battery bank (+8 Science, -8 Margin).',
          whyItMatters:
            'Full-power imaging finishes maps faster, but forces batteries to work harder through every shadow.',
          scienceDelta: 8,
          marginDelta: -8,
          collabDelta: 4,
          powerShiftW: -55,
        },
      ],
    },
    {
      id: `attitude-jitter-${seed % 100}`,
      phaseIndex: 2,
      triggerProgress: 0.56,
      leadRole: 'propulsion',
      title: 'Reaction Wheel Spin Saturation',
      description:
        'Solar wind pressure spun up your aiming wheels; cameras may blur unless momentum is dumped.',
      choices: [
        {
          id: 'wheel-desat',
          label: 'Fire Gentle Thruster Puffs to Reset Wheels',
          detail: 'Restores crystal-sharp camera aiming (+10 Margin, +4 Science).',
          whyItMatters:
            'Resetting spinning wheels keeps narrow-beam dishes and lenses locked squarely onto their targets.',
          scienceDelta: 4,
          marginDelta: 10,
          collabDelta: 8,
          powerShiftW: 25,
        },
        {
          id: 'delay-desat',
          label: 'Delay Reset Until After Target Flyby',
          detail: 'Don’t miss a single second of flyby (+7 Science, -6 Margin).',
          whyItMatters:
            'Holding position catches fleeting science events, though pointing accuracy drifts slightly.',
          scienceDelta: 7,
          marginDelta: -6,
          collabDelta: 4,
          powerShiftW: -20,
        },
      ],
    },
  ];

  const anomaly3Pool: FlightAnomaly[] = [
    {
      id: `science-burst-${seed % 10}`,
      phaseIndex: 3,
      triggerProgress: 0.8,
      leadRole: 'payload',
      title:
        objective.targetBody === 'europa'
          ? 'Cryovolcanic Ice Plume Eruption Spotted!'
          : objective.targetBody === 'mars'
            ? 'Giant Martian Dust Storm Front Forming!'
            : 'Surprise Science Discovery Window!',
      description: `Your ${comms.shortLabel} has a 4-hour clear window to beam bonus high-value measurements home.`,
      choices: [
        {
          id: 'lossless-compress',
          label: 'Compress & Stream Cross-Sensor Burst',
          detail: 'Fits through antenna cleanly (+12 Science, +6 Margin, +10 Collab).',
          whyItMatters:
            'Lossless file compression lets smaller antennas return huge discoveries without overflowing memory.',
          scienceDelta: 12,
          marginDelta: 6,
          collabDelta: 10,
          dataShiftPct: 12,
        },
        {
          id: 'raw-dump',
          label: 'Beam Uncompressed Raw HD Telemetry',
          detail: 'Top science fidelity, heavy battery & link load (+15 Science, -8 Margin).',
          whyItMatters:
            'Raw data is gold for scientists, provided your dish and power reserve can handle the surge.',
          scienceDelta: 15,
          marginDelta: -8,
          collabDelta: 4,
          powerShiftW: -40,
          dataShiftPct: 24,
        },
      ],
    },
    {
      id: `dsn-rain-fade-${seed % 100}`,
      phaseIndex: 3,
      triggerProgress: 0.8,
      leadRole: 'power',
      title: 'Ground Station Rain Fade Over Madrid',
      description: `Thunderstorms over Earth's receiving dish weaken your ${comms.band} signal by 4 dB.`,
      choices: [
        {
          id: 'buffer-relay',
          label: 'Save Data in Memory Until Skies Clear',
          detail: 'Zero lost packets (+5 Science, +10 Margin, +9 Collab).',
          whyItMatters:
            'Avionics solid-state storage holds science safely until the next clear ground station rotates into view.',
          scienceDelta: 5,
          marginDelta: 10,
          collabDelta: 9,
          powerShiftW: 25,
        },
        {
          id: 'boost-tx',
          label: 'Boost Transmitter Power Through Storm',
          detail: 'Streams live data immediately (+11 Science, -8 Margin).',
          whyItMatters:
            'Pumping extra watts into the transmitter punches through rain clouds at the cost of power reserve.',
          scienceDelta: 11,
          marginDelta: -8,
          collabDelta: 5,
          powerShiftW: -45,
        },
      ],
    },
  ];

  return [
    anomaly1Pool[seed % anomaly1Pool.length],
    anomaly2Pool[(seed >> 1) % anomaly2Pool.length],
    anomaly3Pool[(seed >> 2) % anomaly3Pool.length],
  ];
}

export function evaluateSimulationOutcome(
  config: MissionConfig,
  telemetry: TelemetryReport,
  chosenActions: { scienceDelta: number; marginDelta: number; collabDelta: number }[],
  teamMemberCount: number,
  allReadySignedOff: boolean,
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
    } else if (telemetry.budgetStatus === 'Critical') {
      missionSuccess = false;
      failureDay = 1;
      failureSummary = `Mission Canceled on Day 1 (Review): Total cost $${telemetry.totalCostM}M went $${(telemetry.totalCostM - telemetry.budgetCapM).toFixed(1)}M over your $${telemetry.budgetCapM}M agency budget cap.`;
    } else if (
      telemetry.linkMarginDb < 0 ||
      telemetry.downlinkCapacityGBDay < telemetry.dataGeneratedGBDay * 0.5
    ) {
      missionSuccess = false;
      failureDay = 140;
      const topInst = instruments[0]?.shortName || 'instruments';
      failureSummary = `Mission Failed on Day 140: Your ${topInst} generated ${telemetry.dataGeneratedGBDay} GB/day—more data than your ${comms.shortLabel} (${telemetry.downlinkCapacityGBDay} GB/day) could send back to Earth!`;
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
  const rawScience = telemetry.scienceReturnPotential + actionScience;
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
  const marginScore = Math.max(
    0,
    Math.min(100, Math.round(massPoints + powerPoints + dvPoints + lifePoints + actionMargin)),
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
  const collabScore = Math.max(0, Math.min(100, Math.round(baseCollab + actionCollab)));

  const rawTotal = scienceScore + marginScore + budgetScore + synergyScore + collabScore;
  const totalScore = Math.max(
    0,
    Math.min(500, Math.round(rawTotal * difficulty.scoreBonusMultiplier)),
  );

  let grade: 'S' | 'A' | 'B' | 'C' | 'F' = 'F';
  if (!missionSuccess) {
    grade = totalScore >= 260 ? 'C' : 'F';
  } else if (totalScore >= 435) {
    grade = 'S';
  } else if (totalScore >= 380) {
    grade = 'A';
  } else if (totalScore >= 315) {
    grade = 'B';
  } else {
    grade = 'C';
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
  };
}
