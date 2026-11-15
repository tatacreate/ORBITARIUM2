import type { CelestialBodyId } from '../types/mission';
import type {
  ActiveLaunchTelemetry,
  ArchitectMode,
  CsaChallengeState,
  DiscoveryCard,
  DopplerRangeTelemetry,
  GmatMissionRegime,
  GroundCommState,
  GroundStationSpec,
  LaunchBurnState,
  LaunchWindowSpec,
  NasaInstrument,
  NasaObjectiveSpec,
  OrbitalPerturbations,
  OrbitalState,
  PropulsionType,
  SpacecraftOpsState,
  SurfaceLandmark,
  SystemVerificationScorecard,
  TradeOffScenario,
} from '../types/nasaSegments';

export const G0 = 9.80665; // m/s^2
export const SPEED_OF_LIGHT_KMS = 299792.458; // km/s
export const J2_EARTH = 1.08262668e-3;

export interface BodyConstants {
  name: string;
  radiusKm: number;
  mu: number; // km^3 / s^2
  rotationHours: number;
  atmosphereHeightKm: number;
  surfaceGravity: number; // m/s^2
  color: string;
}

export const CELESTIAL_BODIES: Record<CelestialBodyId, BodyConstants> = {
  earth: {
    name: 'Earth',
    radiusKm: 6371,
    mu: 398600.4418,
    rotationHours: 24,
    atmosphereHeightKm: 120,
    surfaceGravity: 9.81,
    color: '#38bdf8',
  },
  moon: {
    name: 'Moon',
    radiusKm: 1737.4,
    mu: 4902.8,
    rotationHours: 655.7,
    atmosphereHeightKm: 0,
    surfaceGravity: 1.62,
    color: '#cbd5e1',
  },
  mars: {
    name: 'Mars',
    radiusKm: 3389.5,
    mu: 42828.3,
    rotationHours: 24.62,
    atmosphereHeightKm: 100,
    surfaceGravity: 3.72,
    color: '#fb923c',
  },
  europa: {
    name: 'Europa (Jupiter)',
    radiusKm: 1560.8,
    mu: 3202.7,
    rotationHours: 85.2,
    atmosphereHeightKm: 0,
    surfaceGravity: 1.31,
    color: '#bae6fd',
  },
  psyche: {
    name: 'Asteroid 16 Psyche',
    radiusKm: 113,
    mu: 1.5,
    rotationHours: 4.2,
    atmosphereHeightKm: 0,
    surfaceGravity: 0.06,
    color: '#eab308',
  },
};

/**
 * 6 NASA & GMAT-Supported Mission Regimes:
 * LEO, GEO, HEO (Molniya), Lunar, Lagrange (Sun-Earth L2), and Interplanetary (Earth-to-Mars).
 */
export const NASA_OBJECTIVES: NasaObjectiveSpec[] = [
  {
    id: 'leo-climate',
    regime: 'leo',
    title: 'Low Earth Orbit (LEO) Cryosphere & Climate Observer',
    category: 'Earth Science',
    targetBody: 'earth',
    targetAltitudeKm: 550,
    periapsisKm: 545,
    apoapsisKm: 555,
    targetInclinationDeg: 97.6, // Sun-Synchronous
    targetEccentricity: 0.001,
    raanDeg: 45.0,
    argPeriapsisDeg: 90.0,
    maxPayloadMassKg: 1850,
    propellantBudgetKg: 450,
    budgetCapM: 280,
    minScienceDataGB: 120,
    primaryScienceDeliverable: 'Daily global polar ice volume, methane flux & wildfire aerosol maps',
    scientificNeed:
      'Monitor rapid ice sheet calving and permafrost thawing in a Sun-Synchronous polar orbit with consistent solar illumination.',
    nasaProgramRef: 'NASA Earth Observing System (EOS) / ICESat-3 Architecture',
    gmatScenarioDesc:
      'GMAT Target: Circular SSO orbit with J2 nodal precession matched to mean solar motion (0.9856°/day).',
    csaCollaborationNote:
      'CSA Collaboration: Canada’s RADARSAT Constellation & NRCan Inuvik Arctic Station provide all-weather microwave ice monitoring across high polar latitudes.',
    summary:
      'Inject into a 550 km Sun-Synchronous Polar Orbit to deliver high-resolution radar and infrared scans of the changing cryosphere.',
  },
  {
    id: 'geo-telecom',
    regime: 'geo',
    title: 'Geostationary Orbit (GEO) Planetary Data Relay',
    category: 'Telecommunications',
    targetBody: 'earth',
    targetAltitudeKm: 35786,
    periapsisKm: 35780,
    apoapsisKm: 35792,
    targetInclinationDeg: 0.0,
    targetEccentricity: 0.0001,
    raanDeg: 0.0,
    argPeriapsisDeg: 0.0,
    maxPayloadMassKg: 3200,
    propellantBudgetKg: 1800,
    budgetCapM: 380,
    minScienceDataGB: 250,
    primaryScienceDeliverable: 'Continuous 24/7 uninterrupted space weather and planetary science relay',
    scientificNeed:
      'Maintain continuous fixed-longitude station-keeping at 35,786 km altitude to provide uninterrupted high-rate optical telemetry to NASA science centers.',
    nasaProgramRef: 'NASA Space Communications and Navigation (SCaN) / TDRS Network',
    gmatScenarioDesc:
      'GMAT Target: Geosynchronous circular orbit where orbital period T equals exactly 1 sidereal day (1436.1 min).',
    csaCollaborationNote:
      'CSA Collaboration: Joint optical & Ka-band relay links bridge northern Canadian Arctic weather observatories with NASA SCaN deep-space centers.',
    summary:
      'Circularize at 35,786 km altitude with zero inclination to establish a permanent geosynchronous communications relay.',
  },
  {
    id: 'heo-magnetosphere',
    regime: 'heo',
    title: 'Highly Elliptical Orbit (HEO) Magnetosphere Scout',
    category: 'Astrophysics',
    targetBody: 'earth',
    targetAltitudeKm: 20150, // mean
    periapsisKm: 600,
    apoapsisKm: 39700,
    targetInclinationDeg: 63.4, // Critical Molniya inclination where domega/dt = 0
    targetEccentricity: 0.72,
    raanDeg: 120.0,
    argPeriapsisDeg: 270.0,
    maxPayloadMassKg: 1100,
    propellantBudgetKg: 620,
    budgetCapM: 310,
    minScienceDataGB: 110,
    primaryScienceDeliverable: 'Van Allen radiation belt particle flux & magnetic reconnection boundary scans',
    scientificNeed:
      'Plunge deep into the radiation belts at periapsis and hover for 8 hours over the high Northern hemisphere at apogee.',
    nasaProgramRef: 'NASA Heliophysics Living With a Star (LWS) / MMS Follow-On',
    gmatScenarioDesc:
      'GMAT Target: Molniya orbit locked at critical inclination (i = 63.435°) to cancel J2 apsidal drift.',
    csaCollaborationNote:
      'CSA Collaboration: Critical-inclination apogee hangs directly over Northern Canada, enabling continuous auroral & space-weather monitoring with CSA ground stations.',
    summary:
      'Ride an extreme 63.4° Molniya ellipse to map radiation belt reconnection boundaries with frozen apogee hover.',
  },
  {
    id: 'lunar-recon',
    regime: 'lunar',
    title: 'Lunar South Pole Volatiles Reconnaissance (Artemis)',
    category: 'Lunar Exploration',
    targetBody: 'moon',
    targetAltitudeKm: 100,
    periapsisKm: 98,
    apoapsisKm: 102,
    targetInclinationDeg: 90.0,
    targetEccentricity: 0.002,
    raanDeg: 15.0,
    argPeriapsisDeg: 0.0,
    maxPayloadMassKg: 950,
    propellantBudgetKg: 850,
    budgetCapM: 360,
    minScienceDataGB: 95,
    primaryScienceDeliverable: 'Sub-meter water-ice deposit maps in permanently shadowed craters (Shackleton & Faustini)',
    scientificNeed:
      'Map accessible cryogenic hydrogen and water volatiles at the Moon’s South Pole to support Artemis permanent habitats.',
    nasaProgramRef: 'NASA Artemis Lunar Discovery and Exploration Program (LDEP)',
    gmatScenarioDesc:
      'GMAT Target: Trans-Lunar Injection (TLI) trajectory with lunar orbit insertion (LOI) into a frozen polar science orbit.',
    csaCollaborationNote:
      'CSA Collaboration: Features Canadarm3 AI autonomous robotics and Canadian neutron radiation sensors supporting Artemis Lunar Gateway crews.',
    summary:
      'Maintain an ultra-low 100 km polar orbit over Shackleton Crater with synthetic aperture radar and neutron spectrometers.',
  },
  {
    id: 'lagrange-observatory',
    regime: 'lagrange',
    title: 'Sun-Earth L2 Libration Point Deep-Space Observatory',
    category: 'Astrophysics',
    targetBody: 'earth',
    targetAltitudeKm: 1500000,
    periapsisKm: 1450000,
    apoapsisKm: 1550000,
    targetInclinationDeg: 15.0,
    targetEccentricity: 0.03,
    raanDeg: 0.0,
    argPeriapsisDeg: 0.0,
    maxPayloadMassKg: 2400,
    propellantBudgetKg: 400,
    budgetCapM: 650,
    minScienceDataGB: 180,
    primaryScienceDeliverable: 'Infrared exoplanet atmosphere transmission spectra and dark energy cosmic surveys',
    scientificNeed:
      'Station an ultra-sensitive cryogenic telescope 1.5 million km behind Earth where the Sun, Earth, and Moon are shielded together.',
    nasaProgramRef: 'NASA Astrophysics Flagship / JWST & Nancy Grace Roman Heritage',
    gmatScenarioDesc:
      'GMAT Target: Three-Body Circular Restricted Problem (CR3BP) Lissajous/Halo orbit around the unstable L2 Lagrangian point.',
    csaCollaborationNote:
      'CSA Collaboration: Carries Canadian Fine Guidance Sensor (FGS) and NIRISS spectrometer heritage for precision star-locking at L2.',
    summary:
      'Station an observatory 1.5M km from Earth in a halo orbit around the Sun-Earth L2 Lagrangian point for cosmic infrared surveys.',
  },
  {
    id: 'interplanetary-mars',
    regime: 'interplanetary',
    title: 'Interplanetary Heliocentric Transfer (Earth to Mars)',
    category: 'Planetary Science',
    targetBody: 'mars',
    targetAltitudeKm: 420,
    periapsisKm: 380,
    apoapsisKm: 460,
    targetInclinationDeg: 86.5,
    targetEccentricity: 0.01,
    raanDeg: 75.0,
    argPeriapsisDeg: 45.0,
    maxPayloadMassKg: 1250,
    propellantBudgetKg: 1100,
    budgetCapM: 490,
    minScienceDataGB: 85,
    primaryScienceDeliverable: 'Mars methane seasonal plumes, subsurface radar sounding, and entry corridor weather relay',
    scientificNeed:
      'Conduct a minimum-energy heliocentric Hohmann transfer to Mars with aerocapture and insertion into a near-polar mapping orbit.',
    nasaProgramRef: 'NASA Mars Exploration Program (MEP) / MAVEN & MRO Class',
    gmatScenarioDesc:
      'GMAT Target: Hyperbolic departure with C3 = 15.2 km²/s², 210-day ballistic cruise, and Mars Orbit Insertion (MOI) burn.',
    csaCollaborationNote:
      'CSA Collaboration: Integrates Canadian laser-induced breakdown & atmospheric trace-gas spectrometry heritage for Mars meteorology.',
    summary:
      'Execute a 210-day heliocentric transfer with Mars Orbit Insertion (MOI) into a 420 km near-polar science orbit.',
  },
];

export const GROUND_STATIONS: GroundStationSpec[] = [
  {
    id: 'dsn-goldstone',
    name: 'Goldstone DSN Complex (CA, USA)',
    agency: 'NASA DSN',
    body: 'earth',
    latDeg: 35.42,
    lonDeg: -116.89,
    antennaDiameterM: 70,
    frequencyBand: 'Ka-Band',
    carrierFreqGhz: 32.05,
    maxDataRateMbps: 150,
    network: 'Deep Space Network (DSN)',
    locationDesc: 'Mojave Desert prime terminal featuring the DSS-14 70-meter dish and high-power radar transmitters.',
  },
  {
    id: 'csa-inuvik',
    name: 'Inuvik Satellite Station Facility (NWT, Canada)',
    agency: 'CSA / NRCan',
    body: 'earth',
    latDeg: 68.32,
    lonDeg: -133.53,
    antennaDiameterM: 13,
    frequencyBand: 'X-Band',
    carrierFreqGhz: 8.40,
    maxDataRateMbps: 125,
    network: 'CSA Polar & Arctic Network',
    locationDesc: 'Canadian High-Arctic station operated with NRCan: tracks polar Sun-Synchronous satellites like RADARSAT on almost every orbit.',
  },
  {
    id: 'csa-gatineau',
    name: 'Gatineau Satellite Station (Quebec, Canada)',
    agency: 'CSA / NRCan',
    body: 'earth',
    latDeg: 45.58,
    lonDeg: -75.81,
    antennaDiameterM: 13,
    frequencyBand: 'X-Band',
    carrierFreqGhz: 8.42,
    maxDataRateMbps: 110,
    network: 'CSA Polar & Arctic Network',
    locationDesc: 'Canadian eastern reception terminal for Earth observation radar passes and North American climate downlinks.',
  },
  {
    id: 'dsn-madrid',
    name: 'Madrid DSN Complex (Spain)',
    agency: 'NASA DSN',
    body: 'earth',
    latDeg: 40.43,
    lonDeg: -4.25,
    antennaDiameterM: 70,
    frequencyBand: 'Ka-Band',
    carrierFreqGhz: 32.05,
    maxDataRateMbps: 150,
    network: 'Deep Space Network (DSN)',
    locationDesc: 'Robledo de Chavela terminal providing 120° planetary longitude separation for deep-space tracking.',
  },
  {
    id: 'dsn-canberra',
    name: 'Canberra DSN Complex (Australia)',
    agency: 'NASA DSN',
    body: 'earth',
    latDeg: -35.4,
    lonDeg: 148.98,
    antennaDiameterM: 70,
    frequencyBand: 'Ka-Band',
    carrierFreqGhz: 32.05,
    maxDataRateMbps: 150,
    network: 'Deep Space Network (DSN)',
    locationDesc: 'Tidbinbilla tracking station ensuring Southern Hemisphere line of sight for deep interplanetary probes.',
  },
  {
    id: 'nsn-svalbard',
    name: 'Svalbard Polar Ground Station (Norway)',
    agency: 'NASA NSN',
    body: 'earth',
    latDeg: 78.23,
    lonDeg: 15.4,
    antennaDiameterM: 13,
    frequencyBand: 'X-Band',
    carrierFreqGhz: 8.45,
    maxDataRateMbps: 85,
    network: 'Near Space Network (NSN)',
    locationDesc: 'Ultra-high Arctic latitude: establishes contact on 14 out of 14 polar LEO orbits every single day.',
  },
  {
    id: 'lunar-shackleton',
    name: 'Shackleton Artemis Base Relay (Moon)',
    agency: 'Artemis Relay',
    body: 'moon',
    latDeg: -89.9,
    lonDeg: 0.0,
    antennaDiameterM: 6,
    frequencyBand: 'Optical',
    carrierFreqGhz: 193.5, // 1550 nm infrared laser
    maxDataRateMbps: 250,
    network: 'Lunar Relay',
    locationDesc: 'South pole lunar laser terminal with uninterrupted direct optical line-of-sight to Earth.',
  },
  {
    id: 'mars-jezero',
    name: 'Jezero Surface Relay Station (Mars)',
    agency: 'NASA NSN',
    body: 'mars',
    latDeg: 18.38,
    lonDeg: 77.58,
    antennaDiameterM: 3.5,
    frequencyBand: 'X-Band',
    carrierFreqGhz: 8.42,
    maxDataRateMbps: 35,
    network: 'Near Space Network (NSN)',
    locationDesc: 'Surface lander relay terminal delivering proximity UHF and X-band uplink to orbiting satellites.',
  },
];

export const NASA_INSTRUMENTS: NasaInstrument[] = [
  {
    id: 'radar-sar',
    name: 'RADARSAT Synthetic Aperture Radar',
    acronym: 'RADARSAT-SAR',
    agencyPartner: 'CSA',
    type: 'radar',
    massKg: 95,
    powerDrawW: 180,
    dataRateMbps: 45.0,
    enabled: true,
    scienceValuePerSec: 4.5,
    targetRegions: 'Arctic sea ice, permafrost melt, soil moisture, and permanently shadowed lunar craters',
    description: 'Sees straight through clouds and polar darkness using microwave pulses to map ice thickness and regolith.',
    csaHeritage: 'Canadian Space Agency RADARSAT Constellation Mission (RCM) Heritage',
    systemsEngineeringRole: 'payload',
  },
  {
    id: 'canadarm-3',
    name: 'Canadarm3 Autonomous Grappling & Servicing Arm',
    acronym: 'CANADARM-3',
    agencyPartner: 'CSA',
    type: 'robotics',
    massKg: 68,
    powerDrawW: 95,
    dataRateMbps: 12.0,
    enabled: true,
    scienceValuePerSec: 3.6,
    targetRegions: 'Orbital debris capture, spacecraft berthing, and Lunar Gateway exterior maintenance',
    description: 'AI-enabled 8.5-meter robotic manipulator engineered to autonomously inspect, repair, and grapple space assets.',
    csaHeritage: 'Canadian Space Agency Artemis Lunar Gateway Robotics Contribution',
    systemsEngineeringRole: 'payload',
  },
  {
    id: 'spec-highres',
    name: 'Infrared Exoplanet & Climate Spectrometer',
    acronym: 'HR-SPEC',
    agencyPartner: 'NASA / CSA Joint',
    type: 'spectrometry',
    massKg: 42,
    powerDrawW: 65,
    dataRateMbps: 18.5,
    enabled: true,
    scienceValuePerSec: 2.8,
    targetRegions: 'Atmospheric methane plumes, exoplanet water vapor, and mineral chemical signatures',
    description: 'Locks onto faint targets with fine-guidance precision to decode chemical fingerprints in planetary atmospheres.',
    csaHeritage: 'JWST NIRISS & Fine Guidance Sensor (FGS) Canadian Optics Heritage',
    systemsEngineeringRole: 'payload',
  },
  {
    id: 'mag-boom',
    name: 'Neutron Radiation Monitor & 3-Axis Magnetometer',
    acronym: 'N-RAD',
    agencyPartner: 'NASA / CSA Joint',
    type: 'fields',
    massKg: 24,
    powerDrawW: 22,
    dataRateMbps: 3.5,
    enabled: true,
    scienceValuePerSec: 2.2,
    targetRegions: 'Artemis cosmic radiation dosimetry, polar hydrogen ice deposits, and magnetosphere shockwaves',
    description: 'Tracks solar storm radiation hazards for astronauts while sniffing out buried hydrogen and water molecules.',
    csaHeritage: 'CSA Space Radiation Dosimetry & Lunar Polar Hydrogen Heritage',
    systemsEngineeringRole: 'payload',
  },
  {
    id: 'cam-multispec',
    name: 'Multispectral Scientific Climate Camera',
    acronym: 'MS-CAM',
    agencyPartner: 'NASA',
    type: 'imaging',
    massKg: 38,
    powerDrawW: 55,
    dataRateMbps: 32.0,
    enabled: false,
    scienceValuePerSec: 3.4,
    targetRegions: 'Visible and ultraviolet surface morphology, optical albedo, and cloud topography',
    description: 'Captures high-resolution terrain photography across 12 calibrated narrowband optical filters.',
    systemsEngineeringRole: 'payload',
  },
];

export interface NasaRocketSpec {
  id: string;
  name: string;
  tier: 'Light Smallsat' | 'Medium Reusable' | 'Heavy Lift' | 'Super-Heavy Flagship';
  dryMassKg: number;
  propellantMassKg: number;
  maxPayloadKg: number;
  ispSec: number;
  thrustKn: number;
  costM: number;
  burnRateKgPerSec: number;
  description: string;
}

export const NASA_ROCKETS: NasaRocketSpec[] = [
  {
    id: 'vector-light',
    name: 'Vector-L Light Smallsat',
    tier: 'Light Smallsat',
    dryMassKg: 1400,
    propellantMassKg: 12500,
    maxPayloadKg: 420,
    ispSec: 315,
    thrustKn: 230,
    costM: 18,
    burnRateKgPerSec: 74,
    description: 'Affordable carbon-composite launcher engineered for rapid-response CubeSats and SmallSats.',
  },
  {
    id: 'meridian-reusable',
    name: 'Meridian-9 Reusable Workhorse',
    tier: 'Medium Reusable',
    dryMassKg: 22200,
    propellantMassKg: 418000,
    maxPayloadKg: 5800,
    ispSec: 348,
    thrustKn: 7607,
    costM: 67,
    burnRateKgPerSec: 2228,
    description: 'NASA Launch Services certified workhorse for LEO, GTO, Lunar, and Mars exploration missions.',
  },
  {
    id: 'centaur-heavy',
    name: 'Centaur-H Cryogenic Heavy Lift',
    tier: 'Heavy Lift',
    dryMassKg: 28500,
    propellantMassKg: 680000,
    maxPayloadKg: 15200,
    ispSec: 452,
    thrustKn: 9800,
    costM: 115,
    burnRateKgPerSec: 2210,
    description: 'Liquid hydrogen/oxygen upper stage delivering high characteristic energy (C3) for escape trajectories.',
  },
  {
    id: 'titan-super',
    name: 'Titan-SH Super-Heavy Flagship',
    tier: 'Super-Heavy Flagship',
    dryMassKg: 85000,
    propellantMassKg: 1200000,
    maxPayloadKg: 38000,
    ispSec: 380,
    thrustKn: 16500,
    costM: 160,
    burnRateKgPerSec: 4420,
    description: 'Massive heavy-lift flagship launcher designed for direct-injection deep space observatories and crew habitats.',
  },
];

/**
 * Launch Window & Planetary Alignment Analyzer:
 * Computes optimal phase angle, synodic period, and Porkchop Delta-v contour points.
 */
export function calculateLaunchWindowAnalysis(
  targetBody: CelestialBodyId,
  departureDayOffset = 0,
): LaunchWindowSpec {
  if (targetBody === 'mars') {
    // Earth-to-Mars synodic period is ~780 days; optimal phase angle is ~44 degrees ahead
    const optimalPhaseAngleDeg = 44.3;
    const currentPhaseAngleDeg = Number(((optimalPhaseAngleDeg + (departureDayOffset / 780) * 360) % 360).toFixed(1));
    const angleDelta = Math.abs(currentPhaseAngleDeg - optimalPhaseAngleDeg);

    // Delta-v penalty curve for off-optimal departure (classic Porkchop slice)
    const baseDeltaV = 3.65; // km/s Earth escape + injection
    const penalty = 0.0018 * Math.pow(departureDayOffset, 2);
    const minDeltaVKms = Number((baseDeltaV + penalty).toFixed(2));
    const c3EnergyKm2s2 = Number((14.5 + penalty * 8).toFixed(1));

    const porkchopCurve = [-30, -20, -10, 0, 10, 20, 30].map((day) => ({
      departureDayOffset: day,
      deltaVKms: Number((baseDeltaV + 0.0018 * Math.pow(day, 2)).toFixed(2)),
      c3: Number((14.5 + 0.0018 * Math.pow(day, 2) * 8).toFixed(1)),
    }));

    return {
      targetPlanet: 'Mars',
      optimalPhaseAngleDeg,
      currentPhaseAngleDeg,
      synodicPeriodDays: 780,
      windowOpenDays: Math.max(0, 35 - Math.round(Math.abs(departureDayOffset))),
      c3EnergyKm2s2,
      minDeltaVKms,
      porkchopCurve,
    };
  }

  if (targetBody === 'moon') {
    return {
      targetPlanet: 'Moon',
      optimalPhaseAngleDeg: 110.0,
      currentPhaseAngleDeg: Number(((110 + (departureDayOffset / 29.5) * 360) % 360).toFixed(1)),
      synodicPeriodDays: 29.5,
      windowOpenDays: 28,
      c3EnergyKm2s2: -2.1,
      minDeltaVKms: 3.12,
      porkchopCurve: [-3, -2, -1, 0, 1, 2, 3].map((d) => ({
        departureDayOffset: d,
        deltaVKms: Number((3.12 + 0.015 * d * d).toFixed(2)),
        c3: -2.1,
      })),
    };
  }

  // Earth LEO / GEO / HEO / Lagrange: daily windows
  return {
    targetPlanet: 'Earth Orbit / Libration L2',
    optimalPhaseAngleDeg: 0,
    currentPhaseAngleDeg: 0,
    synodicPeriodDays: 1,
    windowOpenDays: 365,
    c3EnergyKm2s2: targetBody === 'earth' ? -12.4 : -0.7,
    minDeltaVKms: 7.8,
    porkchopCurve: [-3, -2, -1, 0, 1, 2, 3].map((d) => ({
      departureDayOffset: d,
      deltaVKms: 7.8,
      c3: -12.4,
    })),
  };
}

/**
 * Tsiolkovsky Rocket Equation:
 * Delta-v = Isp * g0 * ln(m0 / mf)
 */
export function calculateRocketDeltaV(
  rocket: NasaRocketSpec,
  payloadMassKg: number,
  fuelFraction = 1.0,
): {
  totalDeltaVKms: number;
  initialMassKg: number;
  finalMassKg: number;
  thrustToWeightRatio: number;
} {
  const actualFuelKg = rocket.propellantMassKg * Math.max(0.2, Math.min(1.0, fuelFraction));
  const initialMassKg = rocket.dryMassKg + actualFuelKg + payloadMassKg;
  const finalMassKg = rocket.dryMassKg + payloadMassKg;

  const exhaustVelocityMs = rocket.ispSec * G0;
  const deltaVMs = exhaustVelocityMs * Math.log(initialMassKg / finalMassKg);
  const totalDeltaVKms = Number((deltaVMs / 1000).toFixed(2));

  const weightKn = (initialMassKg * G0) / 1000;
  const thrustToWeightRatio = Number((rocket.thrustKn / weightKn).toFixed(2));

  return {
    totalDeltaVKms,
    initialMassKg,
    finalMassKg,
    thrustToWeightRatio,
  };
}

/**
 * Keplerian orbital velocity in km/s:
 * v = sqrt(mu * (2/r - 1/a))
 */
export function calculateVisVivaVelocity(
  body: CelestialBodyId,
  rKm: number,
  aKm: number,
): number {
  const b = CELESTIAL_BODIES[body];
  const v = Math.sqrt(Math.max(0.01, b.mu * (2 / rKm - 1 / aKm)));
  return Number(v.toFixed(2));
}

/**
 * Keplerian orbital period in minutes:
 * T = 2 * pi * sqrt(a^3 / mu) / 60
 */
export function calculateOrbitalPeriodMinutes(
  body: CelestialBodyId,
  altitudeKm: number,
  eccentricity = 0,
): number {
  const b = CELESTIAL_BODIES[body];
  const r = b.radiusKm + altitudeKm;
  const a = eccentricity < 1.0 ? r / (1 - eccentricity) : r;
  const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / b.mu);
  return Number((periodSeconds / 60).toFixed(1));
}

/**
 * Theoretical Delta-v needed to inject into target orbit from parking orbit:
 */
export function calculateTargetDeltaV(
  body: CelestialBodyId,
  altitudeKm: number,
  regime: GmatMissionRegime = 'leo',
): number {
  if (regime === 'geo') return 11.85; // LEO to GEO Hohmann + circularization
  if (regime === 'heo') return 10.2; // LEO to Molniya apogee insertion
  if (regime === 'lunar') return 12.1; // LEO to TLI + lunar capture
  if (regime === 'lagrange') return 11.4; // Sun-Earth L2 insertion
  if (regime === 'interplanetary') return 14.8; // Trans-Mars injection + Mars capture

  // Standard LEO
  if (body === 'earth') {
    return Number((7.8 + 0.45 * Math.log10(Math.max(150, altitudeKm) / 200)).toFixed(2));
  }
  if (body === 'mars') {
    return Number((3.55 + 0.5 * Math.log10(Math.max(100, altitudeKm) / 200)).toFixed(2));
  }
  return 1.68;
}

/**
 * Astrodynamics Perturbations (Earth J2 Oblateness & Atmospheric Drag):
 * Computes nodal regression dOmega/dt and apsidal drift domega/dt in deg/day.
 */
export function calculateOrbitalPerturbations(
  body: CelestialBodyId,
  aKm: number,
  e: number,
  incDeg: number,
): OrbitalPerturbations {
  if (body !== 'earth') {
    return {
      j2NodalPrecessionDegPerDay: 0,
      j2ApsidalDriftDegPerDay: 0,
      atmosphericDragDecayKmPerDay: 0,
      solarRadiationPressureScale: 1.0,
    };
  }

  const b = CELESTIAL_BODIES.earth;
  const incRad = (incDeg * Math.PI) / 180;
  const p = aKm * (1 - e * e); // semilatus rectum
  const nRadPerSec = Math.sqrt(b.mu / Math.pow(aKm, 3)); // mean motion
  const secInDay = 86400;
  const rad2deg = 180 / Math.PI;

  const ratio = b.radiusKm / p;
  const j2Factor = 1.5 * J2_EARTH * Math.pow(ratio, 2) * nRadPerSec;

  // Nodal regression (dOmega/dt)
  const dOmegaRadPerSec = -j2Factor * Math.cos(incRad);
  const j2NodalPrecessionDegPerDay = Number((dOmegaRadPerSec * secInDay * rad2deg).toFixed(3));

  // Apsidal precession (domega/dt): vanishes at critical inclination 63.435 deg!
  const domegaRadPerSec = 0.75 * J2_EARTH * Math.pow(ratio, 2) * nRadPerSec * (5 * Math.pow(Math.cos(incRad), 2) - 1);
  const j2ApsidalDriftDegPerDay = Number((domegaRadPerSec * secInDay * rad2deg).toFixed(3));

  // Atmospheric drag scale (significant under 600 km)
  const perigeeAltKm = aKm * (1 - e) - b.radiusKm;
  let atmosphericDragDecayKmPerDay = 0;
  if (perigeeAltKm < 600) {
    atmosphericDragDecayKmPerDay = Number((0.08 * Math.exp(-(perigeeAltKm - 200) / 75)).toFixed(4));
  }

  return {
    j2NodalPrecessionDegPerDay,
    j2ApsidalDriftDegPerDay,
    atmosphericDragDecayKmPerDay,
    solarRadiationPressureScale: 1.0,
  };
}

/**
 * Hohmann Transfer Calculator between two circular orbits (r1 -> r2):
 */
export function calculateHohmannTransfer(
  body: CelestialBodyId,
  r1Km: number,
  r2Km: number,
): {
  deltaV1Ms: number;
  deltaV2Ms: number;
  totalDeltaVMs: number;
  totalDeltaVKms: number;
  transferTimeMinutes: number;
} {
  const b = CELESTIAL_BODIES[body];
  const r1 = b.radiusKm + r1Km;
  const r2 = b.radiusKm + r2Km;

  const v1 = Math.sqrt(b.mu / r1);
  const v2 = Math.sqrt(b.mu / r2);

  const aTrans = (r1 + r2) / 2;
  const vTrans1 = Math.sqrt(b.mu * (2 / r1 - 1 / aTrans));
  const vTrans2 = Math.sqrt(b.mu * (2 / r2 - 1 / aTrans));

  const dv1 = Math.abs(vTrans1 - v1) * 1000; // m/s
  const dv2 = Math.abs(v2 - vTrans2) * 1000; // m/s
  const totalDv = dv1 + dv2;

  const transferTimeSec = Math.PI * Math.sqrt(Math.pow(aTrans, 3) / b.mu);

  return {
    deltaV1Ms: Math.round(dv1),
    deltaV2Ms: Math.round(dv2),
    totalDeltaVMs: Math.round(totalDv),
    totalDeltaVKms: Number((totalDv / 1000).toFixed(2)),
    transferTimeMinutes: Number((transferTimeSec / 60).toFixed(1)),
  };
}

/**
 * Line of sight check with Doppler Frequency Shift and Navigation Telemetry:
 */
export function checkLineOfSight(
  body: CelestialBodyId,
  station: GroundStationSpec,
  subSatLatDeg: number,
  subSatLonDeg: number,
  spacecraftAltKm: number,
  orbitalSpeedKms = 7.5,
): {
  hasLineOfSight: boolean;
  elevationAngleDeg: number;
  distanceKm: number;
  navTelemetry: DopplerRangeTelemetry;
} {
  const b = CELESTIAL_BODIES[body];
  const deg2rad = Math.PI / 180;
  const rBody = b.radiusKm;
  const rSat = rBody + spacecraftAltKm;

  if (station.body !== body) {
    // Interplanetary radio link with planetary rotation/occultation geometry
    const dist = body === 'moon' ? 384400 : 145000000;
    const vr = Number((orbitalSpeedKms * 0.42 * Math.sin(subSatLonDeg * deg2rad)).toFixed(2));
    const carrier = station.carrierFreqGhz;
    const dopplerKhz = Number((-(carrier * 1e6 * (vr / SPEED_OF_LIGHT_KMS))).toFixed(1));
    const dynAz = Number((((142.5 + subSatLonDeg * 0.45 + 360) % 360)).toFixed(1));
    const dynEl = Number((18 + 52 * Math.max(0, Math.cos((subSatLatDeg * 0.65) * deg2rad))).toFixed(1));
    const occluded = Math.cos(subSatLonDeg * deg2rad) < -0.68 && spacecraftAltKm < 1200;

    return {
      hasLineOfSight: !occluded && dynEl >= 8,
      elevationAngleDeg: occluded ? -12 : dynEl,
      distanceKm: dist,
      navTelemetry: {
        carrierFreqGhz: carrier,
        rangeKm: dist,
        rangeRateKms: vr,
        dopplerShiftKhz: dopplerKhz,
        azimuthDeg: dynAz,
        elevationDeg: occluded ? 0 : dynEl,
        signalStrengthDbm: occluded ? -145 : body === 'moon' ? -96 : -118,
      },
    };
  }

  const stLat = station.latDeg * deg2rad;
  const stLon = station.lonDeg * deg2rad;
  const satLat = subSatLatDeg * deg2rad;
  const satLon = subSatLonDeg * deg2rad;

  const gx = rBody * Math.cos(stLat) * Math.cos(stLon);
  const gy = rBody * Math.cos(stLat) * Math.sin(stLon);
  const gz = rBody * Math.sin(stLat);

  const sx = rSat * Math.cos(satLat) * Math.cos(satLon);
  const sy = rSat * Math.cos(satLat) * Math.sin(satLon);
  const sz = rSat * Math.sin(satLat);

  const dx = sx - gx;
  const dy = sy - gy;
  const dz = sz - gz;
  const distanceKm = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const nx = Math.cos(stLat) * Math.cos(stLon);
  const ny = Math.cos(stLat) * Math.sin(stLon);
  const nz = Math.sin(stLat);

  const dot = (dx * nx + dy * ny + dz * nz) / distanceKm;
  const elevationAngleDeg = Number((Math.asin(Math.max(-1, Math.min(1, dot))) / deg2rad).toFixed(1));

  // Azimuth calculation
  const eastX = -Math.sin(stLon);
  const eastY = Math.cos(stLon);
  const eastZ = 0;
  const northX = -Math.sin(stLat) * Math.cos(stLon);
  const northY = -Math.sin(stLat) * Math.sin(stLon);
  const northZ = Math.cos(stLat);

  const dEast = dx * eastX + dy * eastY + dz * eastZ;
  const dNorth = dx * northX + dy * northY + dz * northZ;
  let azimuthDeg = Number(((Math.atan2(dEast, dNorth) / deg2rad + 360) % 360).toFixed(1));

  // Radial velocity projection for Doppler shift: vr = v_orb * cos(theta_rel)
  const rangeRateKms = Number(((orbitalSpeedKms * (dot > 0 ? (1 - dot) * 0.75 : -0.75))).toFixed(2));
  const carrier = station.carrierFreqGhz;
  const dopplerShiftKhz = Number((-(carrier * 1e6 * (rangeRateKms / SPEED_OF_LIGHT_KMS))).toFixed(1));
  const signalStrengthDbm = Math.round(-65 - 20 * Math.log10(Math.max(100, distanceKm) / 500));

  const hasLineOfSight = elevationAngleDeg >= 5.0;

  return {
    hasLineOfSight,
    elevationAngleDeg,
    distanceKm: Math.round(distanceKm),
    navTelemetry: {
      carrierFreqGhz: carrier,
      rangeKm: Math.round(distanceKm),
      rangeRateKms,
      dopplerShiftKhz,
      azimuthDeg,
      elevationDeg: Math.max(0, elevationAngleDeg),
      signalStrengthDbm,
    },
  };
}

/**
 * Propagate Keplerian orbit state forward by dt seconds:
 */
export function propagateOrbitStep(
  body: CelestialBodyId,
  current: OrbitalState,
  dtSeconds: number,
): OrbitalState {
  const b = CELESTIAL_BODIES[body];
  const a = b.radiusKm + current.altitudeKm;
  const n = Math.sqrt(b.mu / Math.pow(a, 3)); // mean motion in rad/s

  const dNuDeg = (n * dtSeconds * 180) / Math.PI;
  const trueAnomalyDeg = (current.trueAnomalyDeg + dNuDeg) % 360;

  // Planetary rotation rate
  const omegaRotDegPerSec = 360 / (b.rotationHours * 3600);
  const deg2rad = Math.PI / 180;
  const nuRad = trueAnomalyDeg * deg2rad;
  const incRad = current.inclinationDeg * deg2rad;

  // Sub-satellite latitude / longitude
  const subSatLatRad = Math.asin(Math.sin(incRad) * Math.sin(nuRad));
  const subSatLatDeg = Number((subSatLatRad / deg2rad).toFixed(2));

  const subSatLonRad = Math.atan2(Math.cos(incRad) * Math.sin(nuRad), Math.cos(nuRad));
  let subSatLonDeg = subSatLonRad / deg2rad - omegaRotDegPerSec * dtSeconds * 0.1;
  subSatLonDeg = ((((subSatLonDeg + 180) % 360) + 360) % 360) - 180;

  // Vis-viva speed at current radius
  const r = (a * (1 - Math.pow(current.eccentricity, 2))) / (1 + current.eccentricity * Math.cos(nuRad));
  const currentAltKm = Math.round(r - b.radiusKm);
  const orbitalSpeedKms = calculateVisVivaVelocity(body, r, a);
  const periodMinutes = calculateOrbitalPeriodMinutes(body, current.altitudeKm, current.eccentricity);

  // Eclipse check
  const inEclipse = Math.cos(nuRad) < -0.35 && current.altitudeKm < 2000;

  // Update J2 perturbations
  const perturbations = calculateOrbitalPerturbations(body, a, current.eccentricity, current.inclinationDeg);

  // Periapsis and Apoapsis
  const periapsisKm = Math.round(a * (1 - current.eccentricity) - b.radiusKm);
  const apoapsisKm = Math.round(a * (1 + current.eccentricity) - b.radiusKm);

  return {
    altitudeKm: currentAltKm,
    periapsisKm: Math.max(0, periapsisKm),
    apoapsisKm,
    eccentricity: current.eccentricity,
    inclinationDeg: current.inclinationDeg,
    semiMajorAxisKm: Math.round(a),
    periodMinutes,
    orbitalSpeedKms,
    trueAnomalyDeg: Number(trueAnomalyDeg.toFixed(2)),
    raanDeg: Number(((current.raanDeg + (perturbations.j2NodalPrecessionDegPerDay * dtSeconds) / 86400) % 360).toFixed(3)),
    argPeriapsisDeg: Number(
      ((current.argPeriapsisDeg + (perturbations.j2ApsidalDriftDegPerDay * dtSeconds) / 86400) % 360).toFixed(3),
    ),
    subSatLatDeg,
    subSatLonDeg: Number(subSatLonDeg.toFixed(2)),
    inEclipse,
    perturbations,
  };
}

/**
 * Trade-Off & Optimization Engine:
 * Compares High-Thrust Chemical Transfer vs. Low-Thrust Solar Electric Ion Transfer.
 */
export function getTradeOffScenarios(
  objective: NasaObjectiveSpec,
  dryMassKg = 850,
): {
  chemical: TradeOffScenario;
  electric: TradeOffScenario;
} {
  const reqDeltaVKms = calculateTargetDeltaV(objective.targetBody, objective.targetAltitudeKm, objective.regime);

  // 1. High-Thrust Chemical Bipropellant (Isp = 325s, high thrust = 450N)
  const chemIsp = 325;
  const chemExhaustMs = chemIsp * G0;
  // m0 = mf * exp(dv / c)
  const chemPayload = objective.maxPayloadMassKg;
  const chemMf = dryMassKg + chemPayload;
  const chemM0 = chemMf * Math.exp((reqDeltaVKms * 1000) / chemExhaustMs);
  const chemPropellantKg = Math.round(chemM0 - chemMf);
  const chemDurationDays = objective.regime === 'interplanetary' ? 210 : objective.regime === 'lunar' ? 3.5 : 0.4;

  const chemical: TradeOffScenario = {
    id: 'chemical-fast',
    name: 'High-Thrust Chemical Bipropellant (MMH/NTO)',
    propulsionType: 'chemical',
    ispSec: chemIsp,
    thrustN: 450,
    dryMassKg,
    propellantMassKg: chemPropellantKg,
    payloadCapacityKg: chemPayload,
    transferDurationDays: chemDurationDays,
    totalDeltaVKms: reqDeltaVKms,
    costM: 65,
    pros: [
      'Fast impulsive transfers (minutes per burn)',
      'Proven heritage with high operational readiness',
      'Minimizes radiation exposure during Van Allen crossing',
    ],
    cons: [
      'Low fuel efficiency requires heavy propellant mass fraction',
      'Forces selection of larger, more expensive launch vehicles',
    ],
  };

  // 2. Low-Thrust Solar Electric Propulsion (NEXT Hall-Effect Ion, Isp = 3100s, thrust = 0.25N)
  const elecIsp = 3100;
  const elecExhaustMs = elecIsp * G0;
  const elecPayload = Math.round(chemPayload * 1.35); // +35% payload capacity!
  const elecMf = dryMassKg + elecPayload;
  const elecM0 = elecMf * Math.exp((reqDeltaVKms * 1000) / elecExhaustMs);
  const elecPropellantKg = Math.round(elecM0 - elecMf);
  const elecDurationDays =
    objective.regime === 'interplanetary' ? 360 : objective.regime === 'lunar' ? 65 : 28;

  const electric: TradeOffScenario = {
    id: 'electric-efficient',
    name: 'High-Efficiency Solar Electric Propulsion (Hall/Ion)',
    propulsionType: 'electric',
    ispSec: elecIsp,
    thrustN: 0.25,
    dryMassKg,
    propellantMassKg: elecPropellantKg,
    payloadCapacityKg: elecPayload,
    transferDurationDays: elecDurationDays,
    totalDeltaVKms: reqDeltaVKms,
    costM: 82,
    pros: [
      'Extreme specific impulse (3,100s) cuts propellant mass by ~70%',
      'Allows +35% heavier scientific payload instruments',
      'Enables continuous trajectory optimization and fine tuning',
    ],
    cons: [
      'Low continuous thrust requires weeks or months of spiraling',
      'Demands large high-power solar arrays (15+ kW)',
      'Prolonged transit through Van Allen radiation belt',
    ],
  };

  return { chemical, electric };
}

/**
 * Gamified NASA + CSA Space Science Discovery Cards Evaluator:
 */
export function evaluateDiscoveryCards(
  objective: NasaObjectiveSpec,
  instruments: NasaInstrument[],
  challengeState: CsaChallengeState,
  scorecard: SystemVerificationScorecard,
): DiscoveryCard[] {
  const hasRadarsat = instruments.some((i) => i.id === 'radar-sar' && i.enabled);
  const hasCanadarm = instruments.some((i) => i.id === 'canadarm-3' && i.enabled);
  const hasSpectrometer = instruments.some((i) => i.id === 'spec-highres' && i.enabled);

  return [
    {
      id: 'card-radarsat',
      title: 'RADARSAT: Seeing Through Arctic Clouds',
      agency: 'CSA',
      category: 'Earth Observation',
      fact: 'Unlike optical cameras that get blocked by Arctic night or thick storm clouds, Canadian Synthetic Aperture Radar (SAR) bounces microwaves off Earth’s surface to measure shifting sea ice 24/7.',
      realMission: 'CSA RADARSAT Constellation Mission (RCM)',
      unlocked: hasRadarsat && challengeState.polarRadarCaptured,
      unlockRequirement: 'Equip RADARSAT-SAR and capture a Polar Ice Swath pass (|Lat| ≥ 55°) in Segment 2.',
    },
    {
      id: 'card-canadarm3',
      title: 'Canadarm3: AI Robotics at the Moon',
      agency: 'CSA',
      category: 'Deep-Space Robotics',
      fact: 'Because radio signals take seconds to travel between Earth and Lunar Gateway, Canadarm3 uses onboard AI to inspect modules, capture visiting cargo craft, and repair hardware autonomously.',
      realMission: 'NASA Artemis Lunar Gateway & CSA Canadarm3',
      unlocked: hasCanadarm && (objective.regime === 'lunar' || challengeState.debrisAvoidedCount > 0),
      unlockRequirement: 'Equip CANADARM-3 and fly a Lunar mission or resolve an orbital debris conjunction.',
    },
    {
      id: 'card-inuvik',
      title: 'Inuvik Arctic Dish: Catching Every Polar Pass',
      agency: 'CSA',
      category: 'Ground Segment',
      fact: 'Satellites in polar orbits cross near Earth’s poles 14 times a day. High-latitude stations like Inuvik (68.3° N) in Canada’s Northwest Territories catch nearly every orbit for fast climate downlinks.',
      realMission: 'NRCan / CSA Inuvik Satellite Station Facility',
      unlocked: scorecard.items.find((i) => i.id === 'req-ground')?.passed ?? false,
      unlockRequirement: 'Pass SR-06 Ground Segment Downlink requirement.',
    },
    {
      id: 'card-jwst-niriss',
      title: 'Star-Locking at L2 with Fine Guidance',
      agency: 'NASA & CSA Joint',
      category: 'Astrophysics',
      fact: 'To spot distant exoplanet atmospheres from Sun-Earth L2, Canada’s Fine Guidance Sensor holds telescope pointing steady to the width of a human hair seen from 1.6 km away.',
      realMission: 'NASA / ESA / CSA James Webb Space Telescope (FGS/NIRISS)',
      unlocked: hasSpectrometer && (objective.regime === 'lagrange' || scorecard.overallPass),
      unlockRequirement: 'Equip HR-SPEC and achieve Systems Engineering flight certification or L2 deployment.',
    },
    {
      id: 'card-molniya-j2',
      title: 'Beating Earth’s Equator Bulge at 63.4°',
      agency: 'NASA',
      category: 'GMAT Astrodynamics',
      fact: 'Earth bulges slightly at the equator (J2 oblateness), twisting tilted orbits. At the magic 63.435° critical inclination, apsidal drift cancels out to zero so satellites hover over northern skies.',
      realMission: 'NASA GMAT Critical-Inclination HEO Studies',
      unlocked: challengeState.solarArraysAligned && scorecard.complianceScore >= 70,
      unlockRequirement: 'Align solar arrays during flight operations and reach ≥ 70% SE compliance.',
    },
    {
      id: 'card-tsiolkovsky',
      title: 'The Tyranny of the Rocket Equation',
      agency: 'NASA',
      category: 'Propulsion Trade-Offs',
      fact: 'Every extra kilogram of propellant needs more propellant just to lift itself. High-Isp Solar Electric ion thrusters use 70% less fuel mass than chemical rockets—freeing space for bigger instruments.',
      realMission: 'NASA Psyche & Dawn Solar Electric Missions',
      unlocked: scorecard.items.find((i) => i.id === 'req-burn')?.passed ?? false,
      unlockRequirement: 'Complete a nominal Orbital Insertion Burn in Segment 1.',
    },
  ];
}

export function getSurfaceLandmarksForObjective(objective: NasaObjectiveSpec): SurfaceLandmark[] {
  if (objective.targetBody === 'moon') {
    return [
      {
        id: 'lm-shackleton',
        name: 'Shackleton Crater Permanent Shadow',
        latDeg: -89.5,
        lonDeg: 10.0,
        category: 'Cryogenic Water-Ice Trap',
        requiredInstrument: 'radar-sar',
        captured: false,
        downlinked: false,
        signalQualityPct: 0,
        regionDataSummary: 'Sub-surface dielectric radar backscatter indicates 5.8 wt% water-ice deposits in crater floor.',
        colorHex: '#22d3ee',
      },
      {
        id: 'lm-faustini',
        name: 'Faustini Crater Rim Hydrogen Pocket',
        latDeg: -87.2,
        lonDeg: 77.0,
        category: 'Neutron Hydrogen Signature',
        requiredInstrument: 'mag-boom',
        captured: false,
        downlinked: false,
        signalQualityPct: 0,
        regionDataSummary: 'Epithermal neutron depression maps buried hydrogen lenses at 0.4–1.2 m regolith depth.',
        colorHex: '#38bdf8',
      },
      {
        id: 'lm-cabeus',
        name: 'Cabeus Volatile Basin',
        latDeg: -84.9,
        lonDeg: -35.5,
        category: 'IR Hydroxyl Absorption',
        requiredInstrument: 'spec-highres',
        captured: false,
        downlinked: false,
        signalQualityPct: 0,
        regionDataSummary: '3.0 μm infrared absorption confirms frost crystals mixed with cold trap regolith.',
        colorHex: '#a855f7',
      },
      {
        id: 'lm-malapert',
        name: 'Malapert Massif Peak of Eternal Light',
        latDeg: -86.0,
        lonDeg: 2.5,
        category: 'Artemis Solar Survey',
        requiredInstrument: 'cam-multispec',
        captured: false,
        downlinked: false,
        signalQualityPct: 0,
        regionDataSummary: '89% annual solar illumination verified for Artemis relay tower and habitat siting.',
        colorHex: '#fbbf24',
      },
      {
        id: 'lm-nobile',
        name: 'Nobile Crater Landing Corridor',
        latDeg: -85.2,
        lonDeg: 53.5,
        category: 'Terrain Hazard SAR Scan',
        requiredInstrument: 'radar-sar',
        captured: false,
        downlinked: false,
        signalQualityPct: 0,
        regionDataSummary: 'Meter-scale boulder and slope hazard grid cleared for Artemis lander touchdown.',
        colorHex: '#34d399',
      },
    ];
  }

  if (objective.targetBody === 'mars') {
    return [
      {
        id: 'lm-jezero',
        name: 'Jezero River Delta Paleo-Lake',
        latDeg: 18.4,
        lonDeg: 77.6,
        category: 'Hydrated Mineral Spectroscopy',
        requiredInstrument: 'spec-highres',
        captured: false,
        downlinked: false,
        signalQualityPct: 0,
        regionDataSummary: 'Phyllosilicate clay and carbonate veins mapped across ancient delta fan channels.',
        colorHex: '#fb923c',
      },
      {
        id: 'lm-gale',
        name: 'Gale Crater Seasonal Methane Plume',
        latDeg: -5.4,
        lonDeg: 137.8,
        category: 'Trace Gas Methane Sweep',
        requiredInstrument: 'spec-highres',
        captured: false,
        downlinked: false,
        signalQualityPct: 0,
        regionDataSummary: 'Detected 14 ppb seasonal CH₄ spike correlated with warm summer boundary layer mixing.',
        colorHex: '#f43f5e',
      },
      {
        id: 'lm-hellas',
        name: 'Hellas Planitia Buried Glacier',
        latDeg: -42.4,
        lonDeg: 70.5,
        category: 'Subsurface SAR Ice Sounding',
        requiredInstrument: 'radar-sar',
        captured: false,
        downlinked: false,
        signalQualityPct: 0,
        regionDataSummary: 'Shallow radar echoes reveal 300 m thick buried water-ice lobe beneath dust mantle.',
        colorHex: '#22d3ee',
      },
      {
        id: 'lm-valles',
        name: 'Valles Marineris Canyon Wind Shear',
        latDeg: -13.9,
        lonDeg: -59.2,
        category: 'Entry Corridor Dust Optical',
        requiredInstrument: 'cam-multispec',
        captured: false,
        downlinked: false,
        signalQualityPct: 0,
        regionDataSummary: 'Morning canyon fog and dust opacity profile calibrated for safe lander EDL corridor.',
        colorHex: '#fbbf24',
      },
      {
        id: 'lm-korolev',
        name: 'Korolev Polar Water-Ice Crater',
        latDeg: 72.8,
        lonDeg: -164.5,
        category: 'Polar Neutron Hydrogen',
        requiredInstrument: 'mag-boom',
        captured: false,
        downlinked: false,
        signalQualityPct: 0,
        regionDataSummary: '1.8 km permanent polar ice dome volumetric inventory verified at northern high latitudes.',
        colorHex: '#38bdf8',
      },
    ];
  }

  // Earth (LEO, GEO, HEO, Lagrange)
  return [
    {
      id: 'lm-beaufort',
      name: 'Beaufort Sea Multi-Year Ice Pack',
      latDeg: 73.2,
      lonDeg: -142.0,
      category: 'CSA RADARSAT Sea-Ice Swath',
      requiredInstrument: 'radar-sar',
      captured: false,
      downlinked: false,
      signalQualityPct: 0,
      regionDataSummary: 'C-band SAR polarization reveals 18% seasonal ridge thinning & open lead fractures.',
      colorHex: '#22d3ee',
    },
    {
      id: 'lm-hudson',
      name: 'Hudson Bay Permafrost Methane Belt',
      latDeg: 58.6,
      lonDeg: -85.4,
      category: 'Arctic Methane Flux Sweep',
      requiredInstrument: 'spec-highres',
      captured: false,
      downlinked: false,
      signalQualityPct: 0,
      regionDataSummary: 'Near-IR absorption spectrometer detects elevated thaw-pond methane emission anomaly.',
      colorHex: '#f59e0b',
    },
    {
      id: 'lm-jakobshavn',
      name: 'Jakobshavn Glacier Calving Front',
      latDeg: 69.1,
      lonDeg: -49.8,
      category: 'Cryosphere Flow Velocity',
      requiredInstrument: 'radar-sar',
      captured: false,
      downlinked: false,
      signalQualityPct: 0,
      regionDataSummary: 'Interferometric radar pass tracks 38 m/day glacier terminus retreat velocity.',
      colorHex: '#38bdf8',
    },
    {
      id: 'lm-aurora',
      name: 'Auroral Oval Magnetosphere Cusp',
      latDeg: 66.5,
      lonDeg: 18.0,
      category: 'Geomagnetic Field & Particle Flux',
      requiredInstrument: 'mag-boom',
      captured: false,
      downlinked: false,
      signalQualityPct: 0,
      regionDataSummary: '3-axis magnetometer resolves Birkeland field-aligned storm current surge.',
      colorHex: '#a855f7',
    },
    {
      id: 'lm-amazon',
      name: 'Amazon Basin Canopy Carbon Sink',
      latDeg: -4.2,
      lonDeg: -62.5,
      category: 'Equatorial Carbon & Aerosol',
      requiredInstrument: 'cam-multispec',
      captured: false,
      downlinked: false,
      signalQualityPct: 0,
      regionDataSummary: 'Multispectral vegetation index + biomass moisture map stitched across cloud gaps.',
      colorHex: '#34d399',
    },
  ];
}

export function createInitialLaunchTelemetry(
  targetDeltaVKms: number,
  rocket: NasaRocketSpec,
): ActiveLaunchTelemetry {
  return {
    phase: 'prelaunch',
    timeSec: 0,
    altitudeKm: 0,
    downrangeKm: 0,
    velocityKms: 0,
    targetVelocityKms: targetDeltaVKms,
    pitchDeg: 90,
    targetPitchDeg: 90,
    throttlePct: 100,
    dynamicPressureKpa: 0,
    maxQReachedKpa: 0,
    structuralStressPct: 0,
    thermalHeatPct: 0,
    fuelRemainingKg: rocket.propellantMassKg,
    fuelTotalKg: rocket.propellantMassKg,
    apoapsisProjectedKm: 0,
    flightPathErrorDeg: 0,
    launchEfficiencyScore: 100,
    failureReason: null,
    trajectoryPoints: [{ downrangeKm: 0, altitudeKm: 0, targetAltKm: 0 }],
  };
}

/**
 * Interactive Gravity-Turn & Max-Q Ascent Physics Step:
 * Player manages pitchDeg (90 vertical -> 0 horizontal), throttlePct (0..100), and manual SECO cutoff.
 */
export function stepAscentPhysics(
  current: ActiveLaunchTelemetry,
  rocket: NasaRocketSpec,
  targetOrbitAltKm: number,
  dtSec: number,
  autoGuidance = false,
): ActiveLaunchTelemetry {
  if (current.phase !== 'ascent') return current;

  const nextTime = current.timeSec + dtSec;
  // Target gravity-turn pitch schedule: 90 deg at liftoff -> 0 deg around 145 km altitude
  const altFactor = Math.min(1, current.altitudeKm / 145);
  const targetPitchDeg = Number((90 * Math.pow(1 - altFactor, 0.72)).toFixed(1));
  const pitchDeg = autoGuidance
    ? Number((current.pitchDeg + (targetPitchDeg - current.pitchDeg) * Math.min(1, dtSec * 3.5)).toFixed(1))
    : current.pitchDeg;

  const pitchRad = (pitchDeg * Math.PI) / 180;
  const throttle = current.fuelRemainingKg > 0 ? current.throttlePct / 100 : 0;

  // Atmospheric density scale (peaks Max-Q around 14-24 km)
  const rhoNorm = Math.exp(-current.altitudeKm / 14.5);
  const dynamicPressureKpa = Number((0.5 * rhoNorm * Math.pow(current.velocityKms * 3.1, 2) * 18).toFixed(1));
  const maxQReachedKpa = Math.max(current.maxQReachedKpa, dynamicPressureKpa);

  // Structural Stress rises if flying fast inside dense atmosphere (Max-Q) without throttling down
  const qOverload = Math.max(0, dynamicPressureKpa - 34);
  const pitchErr = Math.abs(pitchDeg - targetPitchDeg);
  const stressDelta =
    qOverload > 0
      ? qOverload * 1.45 * dtSec + (pitchErr > 22 ? 4 * dtSec : 0)
      : -12 * dtSec;
  const structuralStressPct = Math.max(0, Math.min(100, Number((current.structuralStressPct + stressDelta).toFixed(1))));

  // Thermal Heating if steep off-corridor or high throttle in low atmosphere
  const heatBuild =
    (pitchErr > 25 ? (pitchErr - 20) * 0.6 : 0) +
    (dynamicPressureKpa > 38 ? (dynamicPressureKpa - 38) * 0.9 : 0) -
    (current.altitudeKm > 70 ? 6 : 3);
  const thermalHeatPct = Math.max(0, Math.min(100, Number((current.thermalHeatPct + heatBuild * dtSec).toFixed(1))));

  // Fuel consumption & Acceleration
  // Normalize burn time so a full ascent takes ~36-48 real seconds of engaging play
  const simBurnRate = (rocket.propellantMassKg / 48) * throttle;
  const fuelRemainingKg = Math.max(0, current.fuelRemainingKg - simBurnRate * dtSec);

  const effectiveAccel = throttle > 0
    ? (0.21 + 0.14 * (rocket.ispSec / 380)) * throttle
    : 0;
  const gravityDrag = 0.032 * Math.sin(pitchRad);
  const aeroDrag = 0.0018 * dynamicPressureKpa;

  const dvGain = Math.max(-0.04, (effectiveAccel - gravityDrag - aeroDrag) * dtSec);
  const velocityKms = Math.max(0, Number((current.velocityKms + dvGain).toFixed(3)));

  // Vertical & Horizontal kinematic integration
  const vertSpeed = velocityKms * Math.sin(pitchRad) * 2.25;
  const horizSpeed = velocityKms * Math.cos(pitchRad) * 3.8;
  const altitudeKm = Math.max(0, Number((current.altitudeKm + vertSpeed * dtSec).toFixed(1)));
  const downrangeKm = Number((current.downrangeKm + horizSpeed * dtSec).toFixed(1));

  // Projected Apoapsis estimates where orbit peaks if engine cuts off now
  const velRatio = velocityKms / Math.max(0.5, current.targetVelocityKms);
  const apoapsisProjectedKm = Math.max(
    altitudeKm,
    Math.round(altitudeKm + Math.pow(velRatio, 2.2) * (targetOrbitAltKm * 0.85)),
  );

  const effPenalty = (pitchErr > 16 ? (pitchErr - 16) * 0.09 : 0) * dtSec + (qOverload > 5 ? 0.5 * dtSec : 0);
  const launchEfficiencyScore = Math.max(10, Math.round(current.launchEfficiencyScore - effPenalty));

  const nextPoints =
    current.trajectoryPoints.length < 90 &&
    (downrangeKm - (current.trajectoryPoints[current.trajectoryPoints.length - 1]?.downrangeKm ?? -99) >= 8 ||
      altitudeKm - (current.trajectoryPoints[current.trajectoryPoints.length - 1]?.altitudeKm ?? -99) >= 4)
      ? [
          ...current.trajectoryPoints,
          {
            downrangeKm,
            altitudeKm,
            targetAltKm: Number((Math.min(targetOrbitAltKm, 160) * (1 - Math.exp(-downrangeKm / 260))).toFixed(1)),
          },
        ]
      : current.trajectoryPoints;

  // Check Catastrophic Failure Conditions
  if (structuralStressPct >= 100) {
    return {
      ...current,
      phase: 'failed',
      timeSec: nextTime,
      altitudeKm,
      downrangeKm,
      velocityKms,
      pitchDeg,
      targetPitchDeg,
      dynamicPressureKpa,
      maxQReachedKpa,
      structuralStressPct: 100,
      thermalHeatPct,
      fuelRemainingKg,
      apoapsisProjectedKm,
      flightPathErrorDeg: Number(pitchErr.toFixed(1)),
      launchEfficiencyScore,
      failureReason: `Max-Q Structural Failure at ${altitudeKm} km (${dynamicPressureKpa} kPa): Throttle down below 75% while passing through Max-Q turbulence!`,
      trajectoryPoints: nextPoints,
    };
  }

  if (thermalHeatPct >= 100) {
    return {
      ...current,
      phase: 'failed',
      timeSec: nextTime,
      altitudeKm,
      downrangeKm,
      velocityKms,
      pitchDeg,
      targetPitchDeg,
      dynamicPressureKpa,
      maxQReachedKpa,
      structuralStressPct,
      thermalHeatPct: 100,
      fuelRemainingKg,
      apoapsisProjectedKm,
      flightPathErrorDeg: Number(pitchErr.toFixed(1)),
      launchEfficiencyScore,
      failureReason: `Aerothermal Fairing Burnup at ${altitudeKm} km: Stay inside the dashed Gravity-Turn Pitch Corridor!`,
      trajectoryPoints: nextPoints,
    };
  }

  if (fuelRemainingKg <= 0 && velocityKms < current.targetVelocityKms * 0.88) {
    return {
      ...current,
      phase: 'failed',
      timeSec: nextTime,
      altitudeKm,
      downrangeKm,
      velocityKms,
      pitchDeg,
      targetPitchDeg,
      dynamicPressureKpa,
      maxQReachedKpa,
      structuralStressPct,
      thermalHeatPct,
      fuelRemainingKg: 0,
      apoapsisProjectedKm,
      flightPathErrorDeg: Number(pitchErr.toFixed(1)),
      launchEfficiencyScore,
      failureReason: `Propellant Depleted at ${velocityKms.toFixed(2)} km/s (Short of ${current.targetVelocityKms} km/s). Follow the gravity-turn curve or pick a higher-capacity rocket!`,
      trajectoryPoints: nextPoints,
    };
  }

  // Over-burn auto-fail if player keeps thrusting far past orbital velocity
  if (velocityKms > current.targetVelocityKms * 1.18) {
    return {
      ...current,
      phase: 'failed',
      timeSec: nextTime,
      altitudeKm,
      downrangeKm,
      velocityKms,
      pitchDeg,
      targetPitchDeg,
      dynamicPressureKpa,
      maxQReachedKpa,
      structuralStressPct,
      thermalHeatPct,
      fuelRemainingKg,
      apoapsisProjectedKm,
      flightPathErrorDeg: Number(pitchErr.toFixed(1)),
      launchEfficiencyScore,
      failureReason: `Missed SECO Cutoff Window (${velocityKms.toFixed(2)} km/s > target ${current.targetVelocityKms} km/s): Spacecraft overshot into hyperbolic escape!`,
      trajectoryPoints: nextPoints,
    };
  }

  return {
    ...current,
    timeSec: Number(nextTime.toFixed(1)),
    altitudeKm,
    downrangeKm,
    velocityKms,
    pitchDeg,
    targetPitchDeg,
    dynamicPressureKpa,
    maxQReachedKpa,
    structuralStressPct,
    thermalHeatPct,
    fuelRemainingKg,
    apoapsisProjectedKm,
    flightPathErrorDeg: Number(pitchErr.toFixed(1)),
    launchEfficiencyScore,
    trajectoryPoints: nextPoints,
  };
}

/**
 * Predict orbital elements resulting from an impulsive maneuver node burn
 */
export function predictManeuverOrbit(
  bodyId: CelestialBodyId,
  currentOrbit: OrbitalState,
  node: { progradeMs: number; normalMs: number },
): {
  predictedPeKm: number;
  predictedApKm: number;
  predictedIncDeg: number;
  predictedEcc: number;
  predictedAltKm: number;
} {
  const b = CELESTIAL_BODIES[bodyId];
  const altDeltaKm = Math.round((node.progradeMs / 1000) * (currentOrbit.altitudeKm + b.radiusKm) * 0.28);
  const predictedAltKm = Math.max(120, currentOrbit.altitudeKm + altDeltaKm);
  const incDeltaDeg = Number(
    ((node.normalMs / Math.max(1, currentOrbit.orbitalSpeedKms * 1000)) * (180 / Math.PI)).toFixed(1),
  );
  const predictedIncDeg = Math.max(0, Math.min(98, Number((currentOrbit.inclinationDeg + incDeltaDeg).toFixed(1))));

  const eccShift = Math.abs(node.progradeMs) / 1400;
  const predictedEcc =
    node.progradeMs >= 0
      ? Math.min(0.75, Number((currentOrbit.eccentricity + eccShift).toFixed(3)))
      : Math.max(0.0, Number((currentOrbit.eccentricity - eccShift * 0.8).toFixed(3)));

  const rMean = b.radiusKm + predictedAltKm;
  const predictedPeKm = Math.max(80, Math.round(rMean * (1 - predictedEcc) - b.radiusKm));
  const predictedApKm = Math.max(predictedPeKm + 10, Math.round(rMean * (1 + predictedEcc) - b.radiusKm));

  return {
    predictedPeKm,
    predictedApKm,
    predictedIncDeg,
    predictedEcc,
    predictedAltKm,
  };
}

/**
 * Sky-dome angular error & signal lock quality for interactive ground dish steering
 */
export function computeDishAlignmentLock(
  dishAzDeg: number,
  dishElDeg: number,
  targetAzDeg: number,
  targetElDeg: number,
  bandMode: 'Ka-Band' | 'X-Band',
): { angularErrorDeg: number; lockQualityPct: number } {
  const deg2rad = Math.PI / 180;
  const el1 = Math.max(0, dishElDeg) * deg2rad;
  const el2 = Math.max(0, targetElDeg) * deg2rad;
  const dAz = ((dishAzDeg - targetAzDeg + 540) % 360 - 180) * deg2rad;

  const cosAngle = Math.sin(el1) * Math.sin(el2) + Math.cos(el1) * Math.cos(el2) * Math.cos(dAz);
  const angularErrorDeg = Number((Math.acos(Math.max(-1, Math.min(1, cosAngle))) / deg2rad).toFixed(1));

  const beamHalfWidth = bandMode === 'Ka-Band' ? 16 : 28;
  const lockQualityPct = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-Math.pow(angularErrorDeg / beamHalfWidth, 2)))));

  return { angularErrorDeg, lockQualityPct };
}

/**
 * 2D Planar Forward Kinematics for the CSA Canadarm3 Bay Mini-Game
 */
export function computeCanadarmEndEffector(
  shoulderDeg: number,
  elbowDeg: number,
  wristDeg: number,
): {
  joints: { x: number; y: number }[];
  endX: number;
  endY: number;
  endAngleDeg: number;
} {
  const L1 = 0.56;
  const L2 = 0.48;
  const L3 = 0.24;
  const deg2rad = Math.PI / 180;

  const a1 = shoulderDeg * deg2rad;
  const a2 = (shoulderDeg + elbowDeg) * deg2rad;
  const a3 = (shoulderDeg + elbowDeg + wristDeg) * deg2rad;

  const base = { x: 0, y: 0.05 };
  const p1 = { x: base.x + L1 * Math.cos(a1), y: base.y + L1 * Math.sin(a1) };
  const p2 = { x: p1.x + L2 * Math.cos(a2), y: p1.y + L2 * Math.sin(a2) };
  const p3 = { x: p2.x + L3 * Math.cos(a3), y: p2.y + L3 * Math.sin(a3) };

  return {
    joints: [base, p1, p2, p3],
    endX: p3.x,
    endY: p3.y,
    endAngleDeg: (shoulderDeg + elbowDeg + wristDeg) % 360,
  };
}

/**
 * NASA Systems Engineering Verification Scorecard Evaluator:
 */
export function evaluateSystemsVerification(
  objective: NasaObjectiveSpec,
  rocket: NasaRocketSpec,
  burn: LaunchBurnState,
  orbit: OrbitalState,
  ground: GroundCommState,
  instruments: NasaInstrument[],
  totalBudgetCostM: number,
  groundTrackCoveragePct: number,
  architectMode: ArchitectMode = 'cadet',
  challengeState?: CsaChallengeState,
  opsState?: SpacecraftOpsState,
  landmarks?: SurfaceLandmark[],
): SystemVerificationScorecard {
  const items: SystemVerificationScorecard['items'] = [];

  // 1. Mass Envelope
  const totalPayloadMassKg = instruments.reduce((sum, i) => sum + (i.enabled ? i.massKg : 0), 0) + 420;
  const massPass = totalPayloadMassKg <= objective.maxPayloadMassKg && totalPayloadMassKg <= rocket.maxPayloadKg;
  const massMargin = Number(
    (((objective.maxPayloadMassKg - totalPayloadMassKg) / objective.maxPayloadMassKg) * 100).toFixed(1),
  );
  items.push({
    id: 'req-mass',
    requirementName: 'SR-01: Spacecraft Wet Mass Launch Envelope',
    segment: 'Launch',
    targetValue: `≤ ${objective.maxPayloadMassKg} kg`,
    achievedValue: `${totalPayloadMassKg} kg (${rocket.name})`,
    passed: massPass,
    marginPercent: massMargin,
    consequence: massPass
      ? `Payload mass is within the ${rocket.name} lift envelope with a +${massMargin}% margin.`
      : `Spacecraft exceeds maximum payload limit by ${totalPayloadMassKg - objective.maxPayloadMassKg} kg.`,
  });

  // 2. Budget
  const budgetPass = totalBudgetCostM <= objective.budgetCapM;
  const budgetMargin = Number((((objective.budgetCapM - totalBudgetCostM) / objective.budgetCapM) * 100).toFixed(1));
  items.push({
    id: 'req-budget',
    requirementName: 'SR-02: NASA Program Budget Constraint',
    segment: 'Setup',
    targetValue: `≤ $${objective.budgetCapM}M`,
    achievedValue: `$${totalBudgetCostM}M`,
    passed: budgetPass,
    marginPercent: budgetMargin,
    consequence: budgetPass
      ? `Mission lifecycle costs meet the NASA ${objective.nasaProgramRef} guidelines with a +${budgetMargin}% reserve.`
      : `Program cost exceeds spending cap by $${(totalBudgetCostM - objective.budgetCapM).toFixed(1)}M.`,
  });

  // 3. Injection Delta-v & Ascent SECO
  const burnPass = burn.status === 'completed' && burn.outcomeType === 'nominal';
  const deltaVMargin = Number((((burn.deliveredDeltaVKms - burn.targetDeltaVKms) / burn.targetDeltaVKms) * 100).toFixed(1));
  items.push({
    id: 'req-burn',
    requirementName: 'SR-03: Launch Ascent & SECO Orbital Insertion',
    segment: 'Launch',
    targetValue: `${burn.targetDeltaVKms} km/s (±5%)`,
    achievedValue: `${burn.deliveredDeltaVKms} km/s (${burn.outcomeType.toUpperCase()})`,
    passed: burnPass,
    marginPercent: deltaVMargin,
    consequence: burnPass
      ? `Upper stage executed manual gravity turn and SECO cutoff within tolerance (Efficiency: ${burn.launchEfficiencyScore ?? 92}%).`
      : `Injection burn was out of tolerance (${burn.outcomeSummary}).`,
  });

  // 4. Target Orbital Altitude / Periapsis
  const targetAlt = objective.targetAltitudeKm;
  const altDiff = Math.abs(orbit.altitudeKm - targetAlt);
  const altTol = Math.max(50, targetAlt * 0.15);
  const altPass = altDiff <= altTol;
  const altMargin = Number(((1 - altDiff / Math.max(1, targetAlt)) * 100).toFixed(1));
  items.push({
    id: 'req-alt',
    requirementName: 'SR-04: Space Segment Science Altitude / Apsides',
    segment: 'Space',
    targetValue: `${targetAlt} km (±${Math.round(altTol)} km)`,
    achievedValue: `${orbit.altitudeKm} km (Pe: ${orbit.periapsisKm} km, Ap: ${orbit.apoapsisKm} km)`,
    passed: altPass,
    marginPercent: altMargin,
    consequence: altPass
      ? `Orbiter altitude matches target science regime for ${objective.regime.toUpperCase()}.`
      : `Altitude error of ${Math.round(altDiff)} km degrades field of view and spatial resolution.`,
  });

  // 5. Inclination
  const incDiff = Math.abs(orbit.inclinationDeg - objective.targetInclinationDeg);
  const incPass = incDiff <= 4.0;
  items.push({
    id: 'req-inc',
    requirementName: 'SR-05: Orbital Inclination & Ground Track',
    segment: 'Space',
    targetValue: `${objective.targetInclinationDeg}° (±4°)`,
    achievedValue: `${orbit.inclinationDeg}°`,
    passed: incPass,
    marginPercent: Number((100 - incDiff * 20).toFixed(1)),
    consequence: incPass
      ? `Orbital inclination achieves required planetary ground track coverage.`
      : `Inclination error of ${incDiff.toFixed(1)}° misses target science latitude bands.`,
  });

  // 6. Ground Segment Downlink
  const dataTotal = ground.totalDataDownlinkedGB;
  const downlinkPass = dataTotal >= objective.minScienceDataGB * 0.75;
  const downlinkMargin = Number((((dataTotal - objective.minScienceDataGB) / objective.minScienceDataGB) * 100).toFixed(1));
  items.push({
    id: 'req-ground',
    requirementName: 'SR-06: Ground Segment Dish Lock & Data Return',
    segment: 'Ground',
    targetValue: `≥ ${objective.minScienceDataGB} GB return`,
    achievedValue: `${Math.round(dataTotal)} GB (Lock: ${ground.dishLockQualityPct}%)`,
    passed: downlinkPass,
    marginPercent: downlinkMargin,
    consequence: downlinkPass
      ? `Ground tracking antennas maintained carrier lock and downlinked science packets.`
      : `Downlink return fell short (${Math.round(dataTotal)} / ${objective.minScienceDataGB} GB).`,
  });

  // 7. Science Coverage & Target Landmarks
  const capturedCount = landmarks ? landmarks.filter((l) => l.captured).length : 0;
  const downlinkedCount = landmarks ? landmarks.filter((l) => l.downlinked).length : 0;
  const coveragePass = groundTrackCoveragePct >= 65 || downlinkedCount >= 2;
  items.push({
    id: 'req-user',
    requirementName: 'SR-07: User Segment Science Reconstruction & Landmarks',
    segment: 'User',
    targetValue: '≥ 65% mapped or ≥ 2 targets',
    achievedValue: `${Math.round(groundTrackCoveragePct)}% swath · ${downlinkedCount}/${landmarks?.length ?? 5} targets`,
    passed: coveragePass,
    marginPercent: groundTrackCoveragePct - 65,
    consequence: coveragePass
      ? `Science team reconstructed ${downlinkedCount} planetary target datasets (${capturedCount} captured in orbit).`
      : `Coverage (${Math.round(groundTrackCoveragePct)}%) & target captures insufficient for primary science.`,
  });

  const passedCount = items.filter((i) => i.passed).length;
  const complianceScore = Math.round((passedCount / items.length) * 100);
  const overallPass = passedCount >= 6;

  // Dynamic Systems Engineering Performance Score (0..100) from hands-on gameplay
  const launchScore = burn.launchEfficiencyScore ?? (burnPass ? 88 : 50);
  const maneuverScore = opsState?.lastManeuverAccuracyPct ?? 80;
  const hazardTotal = (opsState?.hazardsSurvived ?? 0) + (opsState?.hazardsFailed ?? 0);
  const hazardScore = hazardTotal > 0 ? Math.round(((opsState?.hazardsSurvived ?? 0) / hazardTotal) * 100) : 85;
  const armScore = Math.min(100, 60 + (opsState?.canadarm.completedCount ?? 0) * 15);
  const targetScore = landmarks?.length ? Math.round((downlinkedCount / landmarks.length) * 100) : Math.round(groundTrackCoveragePct);
  const dynamicPerformanceScore = Math.round(
    complianceScore * 0.4 + launchScore * 0.15 + maneuverScore * 0.12 + hazardScore * 0.13 + armScore * 0.1 + targetScore * 0.1,
  );

  let flightCertificationGrade: SystemVerificationScorecard['flightCertificationGrade'] =
    'DEFICIENT - RE-ENGINEERING REQUIRED (CATEGORY C)';
  if (overallPass && passedCount === items.length) {
    flightCertificationGrade = 'FLIGHT CERTIFIED (CATEGORY A)';
  } else if (overallPass) {
    flightCertificationGrade = 'CONDITIONAL PASS (CATEGORY B)';
  }

  const challengePts = challengeState?.challengePoints ?? 0;
  let missionRankBadge = 'Engineering Trainee';
  if (architectMode === 'sandbox') {
    missionRankBadge = passedCount === items.length ? 'Sandbox Lead Architect' : 'Sandbox Astrodynamics Explorer';
  } else if (passedCount === items.length && (challengePts >= 60 || dynamicPerformanceScore >= 86)) {
    missionRankBadge = 'Joint NASA-CSA Flight Director';
  } else if (overallPass) {
    missionRankBadge = 'GMAT Astrodynamics Specialist';
  } else if (challengePts >= 30 || passedCount >= 4) {
    missionRankBadge = 'CSA Orbital Cadet';
  }

  const systemsEngineerSummary = overallPass
    ? `All primary NASA Systems Engineering requirements verified (Performance Index: ${dynamicPerformanceScore}/100). Mission execution across Launch SECO, Space Maneuvers, Ground Dish Tracking, and Science Reconstruction achieves ${objective.title}.`
    : `Mission fails critical Systems Engineering gates (${items.length - passedCount} non-conformances identified). Refine ascent SECO, maneuver burns, hazard mitigation, or ground downlink tracking.`;

  return {
    overallPass,
    complianceScore,
    dynamicPerformanceScore,
    flightCertificationGrade,
    missionRankBadge,
    items,
    systemsEngineerSummary,
  };
}
