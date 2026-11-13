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
  AdcsSpec,
  AvionicsSpec,
  BatterySpec,
  ConstraintStatus,
  CriterionCheck,
  EngineeringAdvisory,
  FlightAnomaly,
  MissionConfig,
  SimulationOutcome,
  TelemetryReport,
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
    const eclipsePenalty = Math.max(0.65, 1 - orbit.eclipseFraction * (0.45 * (120 / Math.max(60, battery.capacityWh))));
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
  const downlinkCapacityGBDay = Number(
    ((effectiveMbps * 3600 * 8) / 8000).toFixed(1),
  );

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
            label: 'Switch to MMRTG Nuclear Battery',
            patch: { powerId: 'mmrtg-nuclear' },
          }
        : {
            label: 'Upgrade to Mega-Flex Solar',
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
      message: `Optical Laser needs <=15" pointing; ${bus.name} is ${bus.pointingAccuracyArcsec}".`,
      plainTerms:
        'Space lasers shoot a tiny beam across millions of kilometers and require a stable Octagonal or Hex-Core spacecraft bus.',
      quickFix: {
        label: 'Upgrade to Octagonal Bus',
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
        label: 'Equip 2.4m Ka-Band Dish',
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
    linkMarginDb,
    dataStatus,
    estimatedLifetimeMonths,
    requiredLifetimeMonths: objective.minLifetimeMonths,
    lifetimeStatus,
    scienceReturnPotential,
    synergies,
    advisories: finalAdvisories,
    launchReady,
    criticalFailureReason,
  };
}

export function generateFlightAnomalies(config: MissionConfig, seed: number): FlightAnomaly[] {
  const { objective, orbit, power, comms, propulsion } = getCatalogParts(config);
  const pickSolar = power.kind === 'solar';
  const isDeep = orbit.solarDistanceAU >= 1.5;

  const cruisePool: FlightAnomaly[] = [
    pickSolar
      ? {
          id: 'solar-storm-eclipse',
          phaseIndex: 1,
          leadRole: 'power',
          title: isDeep
            ? 'Solar Irradiance Attenuation & Thermal Cold-Soak'
            : 'Coronal Mass Ejection (CME) Particle Surge',
          description: isDeep
            ? `At ${orbit.solarDistanceAU} AU, unexpected dust/plasma scattering reduces array output by 22% during cruise.`
            : 'An X-class solar flare is inbound, threatening exposed avionics and attitude sensors.',
          choices: [
            {
              id: 'safe-mode',
              label: 'Throttle Payload & Enter Rad-Safe Attitude',
              detail: 'Preserve spacecraft health & margin (+12 Margin, -4 Science).',
              whyItMatters:
                'Turning off power-hungry cameras briefly keeps onboard batteries charged and shields delicate sensors from radiation spikes.',
              scienceDelta: -4,
              marginDelta: 12,
              collabDelta: 8,
            },
            {
              id: 'burn-through',
              label: 'Maintain Full Science Observation',
              detail: 'Capture rare flare telemetry at the cost of power reserve (+10 Science, -10 Margin).',
              whyItMatters:
                'Keeping every instrument running records unique storm physics, but drains your electrical safety margin.',
              scienceDelta: 10,
              marginDelta: -10,
              collabDelta: 5,
            },
          ],
        }
      : {
          id: 'thermal-shunt',
          phaseIndex: 1,
          leadRole: 'propulsion',
          title: 'MMRTG Radiator Louver Calibration Drift',
          description:
            'Excess nuclear thermal energy is warming the spectrometer focal plane during cruise.',
          choices: [
            {
              id: 'roll-maneuver',
              label: 'Execute Passive Thermal Roll Maneuver',
              detail: 'Uses minor RCS impulse to dump heat cleanly (+10 Margin, +6 Collab).',
              whyItMatters:
                'Slowly rotating the spacecraft like a rotisserie radiates heat into cold space so optical sensors stay accurate.',
              scienceDelta: 2,
              marginDelta: 10,
              collabDelta: 6,
            },
            {
              id: 'duty-cycle',
              label: 'Duty-Cycle High-Power Transmitters',
              detail: 'Keep sensors cool with zero propellant spend (+5 Margin, -3 Science).',
              whyItMatters:
                'Taking short transmitter breaks cuts internal electronics heat without using precious thruster fuel.',
              scienceDelta: -3,
              marginDelta: 5,
              collabDelta: 8,
            },
          ],
        },
    {
      id: `micrometeoroid-adcs-${seed % 100}`,
      phaseIndex: 1,
      leadRole: 'propulsion',
      title: 'Micrometeoroid Attitude Jitter Detected',
      description:
        'A tiny dust grain struck the solar boom, causing reaction wheels to spin faster to hold camera aim.',
      choices: [
        {
          id: 'wheel-desat',
          label: 'Run Gentle Reaction Wheel Desaturation',
          detail: 'Uses tiny thruster puffs to stabilize pointing (+11 Margin, +8 Collab).',
          whyItMatters:
            'Bleeding off wheel spin keeps cameras and antennas steady so photos do not blur.',
          scienceDelta: 3,
          marginDelta: 11,
          collabDelta: 8,
        },
        {
          id: 'gyro-override',
          label: 'Keep Shooting & Recalibrate Later',
          detail: 'No science pause, slightly higher wear on attitude control (+8 Science, -7 Margin).',
          whyItMatters:
            'Skipping calibration avoids missing a science pass, but leaves less reaction-wheel safety cushion.',
          scienceDelta: 8,
          marginDelta: -7,
          collabDelta: 4,
        },
      ],
    },
    {
      id: `fuel-valve-sensor-${seed % 100}`,
      phaseIndex: 1,
      leadRole: 'propulsion',
      title: `${propulsion.name} Pressure Sensor Anomaly`,
      description:
        'Telemetry shows a minor pressure oscillation in the main propulsion manifold ahead of orbital insertion.',
      choices: [
        {
          id: 'backup-manifold',
          label: 'Switch to Redundant Latch Valve & Slow Warmup',
          detail: 'Protects main capture burn reliability (+12 Margin, +7 Collab).',
          whyItMatters:
            'Routing propellant through backup hardware prevents a stuck valve during the critical orbit capture burn.',
          scienceDelta: 0,
          marginDelta: 12,
          collabDelta: 7,
        },
        {
          id: 'single-burn-push',
          label: 'Hold Primary Valve & Trim Burn Duration',
          detail: 'Saves propellant budget but leaves less Δv cushion (+6 Science, -6 Margin).',
          whyItMatters:
            'Staying on the primary line avoids valve cycling delays, though it trims your orbital reserve.',
          scienceDelta: 6,
          marginDelta: -6,
          collabDelta: 5,
        },
      ],
    },
  ];

  const opsPool: FlightAnomaly[] = [
    {
      id: `science-window-${seed % 10}`,
      phaseIndex: 3,
      leadRole: 'payload',
      title:
        objective.targetBody === 'europa'
          ? 'Transient Cryovolcanic Plume Eruption Detected'
          : objective.targetBody === 'mars'
            ? 'Regional Dust Storm Front Over Target Crater'
            : 'High-Priority Transient Target Opportunity',
      description: `Comms link (${comms.band}) has a narrow 4-hour high-gain window to transmit burst science data.`,
      choices: [
        {
          id: 'lossless-compress',
          label: 'Prioritize Cross-Instrument Compressed Burst',
          detail: 'Balances onboard buffer & link margin for high-value science (+12 Science, +6 Margin).',
          whyItMatters:
            'Compressing files shrinks daily gigabytes so your antenna sends every key measurement before the Earth pass ends.',
          scienceDelta: 12,
          marginDelta: 6,
          collabDelta: 10,
        },
        {
          id: 'raw-dump',
          label: 'Transmit Uncompressed Raw Telemetry',
          detail: 'Maximum fidelity if link holds, heavy power draw (+15 Science, -8 Margin).',
          whyItMatters:
            'Raw files preserve every pixel for scientists, but demand maximum transmitter power and antenna speed.',
          scienceDelta: 15,
          marginDelta: -8,
          collabDelta: 4,
        },
      ],
    },
    {
      id: `dsn-rain-fade-${seed % 100}`,
      phaseIndex: 3,
      leadRole: 'power',
      title: 'Deep Space Network Ground Station Rain Fade',
      description:
        `Heavy clouds over the Madrid ground dish attenuate ${comms.band} signal strength by 4 dB during downlink.`,
      choices: [
        {
          id: 'buffer-relay',
          label: 'Store Science in Avionics Buffer Until Next Pass',
          detail: 'Protects data integrity cleanly (+4 Science, +10 Margin, +9 Collab).',
          whyItMatters:
            'Saving observations in onboard memory until skies clear guarantees zero lost science packets.',
          scienceDelta: 4,
          marginDelta: 10,
          collabDelta: 9,
        },
        {
          id: 'boost-tx',
          label: 'Boost Transmitter Power & Stream Priority Maps',
          detail: 'Pushes critical maps through storm noise (+11 Science, -8 Margin).',
          whyItMatters:
            'Raising transmitter wattage punches through atmospheric interference at the cost of battery reserve.',
          scienceDelta: 11,
          marginDelta: -8,
          collabDelta: 5,
        },
      ],
    },
  ];

  const a1 = cruisePool[seed % cruisePool.length];
  const a2 = opsPool[(seed >> 2) % opsPool.length];
  return [a1, a2];
}

export function evaluateSimulationOutcome(
  config: MissionConfig,
  telemetry: TelemetryReport,
  chosenActions: { scienceDelta: number; marginDelta: number; collabDelta: number }[],
  teamMemberCount: number,
  allReadySignedOff: boolean,
): SimulationOutcome {
  const { difficulty, objective, orbit, launchVehicle, propulsion, power, comms, shielding, bus } =
    getCatalogParts(config);
  const lessons: string[] = [];

  const actionScience = chosenActions.reduce((s, c) => s + c.scienceDelta, 0);
  const actionMargin = chosenActions.reduce((s, c) => s + c.marginDelta, 0);
  const actionCollab = chosenActions.reduce((s, c) => s + c.collabDelta, 0);

  let missionSuccess = difficulty.isSandbox ? true : telemetry.launchReady;
  let failureSummary = difficulty.isSandbox ? null : telemetry.criticalFailureReason;

  if (!difficulty.isSandbox) {
    if (missionSuccess && telemetry.budgetStatus === 'Critical') {
      missionSuccess = false;
      failureSummary = `Mission canceled in flight review: cost $${telemetry.totalCostM}M breached $${telemetry.budgetCapM}M budget cap.`;
    } else if (
      missionSuccess &&
      (telemetry.linkMarginDb < 0 || telemetry.downlinkCapacityGBDay < telemetry.dataGeneratedGBDay * 0.5)
    ) {
      missionSuccess = false;
      failureSummary = `Communications failure: ${telemetry.downlinkCapacityGBDay} GB/day downlink (${telemetry.linkMarginDb} dB) could not return ${telemetry.dataGeneratedGBDay} GB/day science data.`;
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
          ? `Your fueled spacecraft (${telemetry.wetMassKg} kg) fit inside ${launchVehicle.name}'s ${telemetry.payloadCapacityKg} kg lift limit for ${orbit.name}.`
          : `Distant/low orbits shrink a rocket's lift limit; ${telemetry.wetMassKg} kg wet mass or the ${bus.name} frame exceeded what ${launchVehicle.name} could carry here.`,
    },
    {
      label: 'Orbital Insertion Δv',
      passed: telemetry.deltaVStatus !== 'Critical',
      detail: `${telemetry.availableDeltaVKms} / ${telemetry.requiredDeltaVKms} km/s`,
      whyItMattered:
        telemetry.deltaVStatus !== 'Critical'
          ? `${propulsion.name} (${propulsion.ispSec}s Isp) gave enough speed change (${telemetry.availableDeltaVKms} km/s) to brake into ${orbit.name}.`
          : `Entering ${orbit.name} takes ${telemetry.requiredDeltaVKms} km/s of Δv; without enough propellant or a higher-Isp engine, the probe flies past its target.`,
    },
    {
      label: 'Power Generation Margin',
      passed: telemetry.powerMarginW >= 0,
      detail: `${telemetry.powerMarginW >= 0 ? '+' : ''}${telemetry.powerMarginW} W`,
      whyItMattered:
        telemetry.powerMarginW >= 0
          ? `${power.name} generated ${telemetry.powerGeneratedW}W at ${orbit.solarDistanceAU} AU, covering ${telemetry.powerPeakDrawW}W peak draw with +${telemetry.powerMarginW}W spare.`
          : `At ${orbit.solarDistanceAU} AU sunlight drops to ${(telemetry.solarFluxFactor * 100).toFixed(1)}%, so ${power.name} fell ${Math.abs(telemetry.powerMarginW)}W short of instrument and heater draw.`,
    },
    {
      label: 'Communications Downlink',
      passed: telemetry.dataStatus !== 'Critical',
      detail: `${telemetry.downlinkCapacityGBDay} / ${telemetry.dataGeneratedGBDay} GB/d (${telemetry.linkMarginDb} dB)`,
      whyItMattered:
        telemetry.dataStatus !== 'Critical'
          ? `${comms.name} maintained a ${telemetry.linkMarginDb} dB link across ${orbit.commsDistanceAU} AU, returning ${telemetry.downlinkCapacityGBDay} GB/day vs ${telemetry.dataGeneratedGBDay} GB/day gathered.`
          : `Across ${orbit.commsDistanceAU} AU, ${comms.name} only sent ${telemetry.downlinkCapacityGBDay} GB/day (${telemetry.linkMarginDb} dB), bottlenecking ${telemetry.dataGeneratedGBDay} GB/day of science data.`,
    },
    {
      label: 'Science Return Target',
      passed: telemetry.scienceReturnPotential >= objective.minScienceValue,
      detail: `${telemetry.scienceReturnPotential} / ${objective.minScienceValue} min`,
      whyItMattered:
        telemetry.scienceReturnPotential >= objective.minScienceValue
          ? `Matching preferred sensors with ${orbit.name} boosted measurement quality to ${telemetry.scienceReturnPotential} points.`
          : `To reach ${objective.minScienceValue} science points, pair instruments suited to ${objective.title} with an orbit around ${objective.targetBody.toUpperCase()}.`,
    },
    {
      label: 'Operational Lifetime Goal',
      passed: telemetry.estimatedLifetimeMonths >= objective.minLifetimeMonths,
      detail: `${telemetry.estimatedLifetimeMonths} / ${telemetry.requiredLifetimeMonths} mo`,
      whyItMattered:
        telemetry.estimatedLifetimeMonths >= objective.minLifetimeMonths
          ? `${shielding.name} (${shielding.radToleranceKrad} krad) and fuel reserves sustained ${telemetry.estimatedLifetimeMonths} months against ${orbit.radiationDoseRate} krad/yr radiation.`
          : `Radiation (${orbit.radiationDoseRate} krad/yr) or tight station-keeping fuel wore down ${shielding.name} before the ${objective.minLifetimeMonths}-month mission goal.`,
    },
  ];

  // 1. Science Score (0-100)
  const rawScience = telemetry.scienceReturnPotential + actionScience;
  const scienceScore = Math.max(0, Math.min(100, Math.round(missionSuccess ? rawScience : rawScience * 0.4)));

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
    lessons.push(`Healthy ${telemetry.powerMarginW} W power reserve enabled uninterrupted instrument operations.`);
  }
  if (telemetry.downlinkCapacityGBDay < telemetry.dataGeneratedGBDay) {
    lessons.push(
      `Science instruments produced ${telemetry.dataGeneratedGBDay} GB/day vs ${telemetry.downlinkCapacityGBDay} GB/day downlink—upgrading to Ka-Band or Optical prevents buffer overflow.`,
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
    failureSummary,
    criteriaChecks,
    lessons,
  };
}
