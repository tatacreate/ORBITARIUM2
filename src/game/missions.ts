import { DISCOVERY_IMAGES } from '../data/discoveryArt';
import type { CelestialBodyId } from '../types/mission';

export type UnifiedMissionId = 'earth-climate' | 'lunar-rescue' | 'mars-water';

export interface MissionLandmarkSpec {
  id: string;
  name: string;
  angleDeg: number;
  fact: string;
  image: string;
  iconType: 'hurricane' | 'ice' | 'crater' | 'pod';
}

export interface UnifiedMissionSpec {
  id: UnifiedMissionId;
  title: string;
  difficultyLabel: 'Beginner' | 'Intermediate' | 'Expert';
  subtitle: string;
  tag: string;
  targetBody: CelestialBodyId;
  planetName: string;
  planetColors: {
    base: string;
    highlight: string;
    accent: string;
    atmosphere: string;
    skyTop: string;
    skyBottom: string;
  };
  startingFuelPct: number;
  targetOrbitLabel: string;
  stationName: string;
  stationAnglesDeg: number[];
  threatType: 'debris' | 'solar-wave';
  threatLabel: string;
  mechanicMode: 'scan' | 'canadarm';
  orbCount: number;
  landmarks: MissionLandmarkSpec[];
  badgeTitle: string;
}

export const UNIFIED_MISSIONS: UnifiedMissionSpec[] = [
  {
    id: 'earth-climate',
    title: 'EARTH: Hurricane Watch',
    difficultyLabel: 'Beginner',
    subtitle:
      'Launch a weather satellite, scan 3 swirling hurricanes, dodge space junk & beam storm alerts to Earth.',
    tag: 'Beginner · Low Earth Orbit',
    targetBody: 'earth',
    planetName: 'Earth',
    planetColors: {
      base: '#0369a1',
      highlight: '#10b981',
      accent: '#e0f2fe',
      atmosphere: 'rgba(56, 189, 248, 0.36)',
      skyTop: '#020617',
      skyBottom: '#082f49',
    },
    startingFuelPct: 100,
    targetOrbitLabel: 'Low Earth Orbit',
    stationName: 'Earth Ground Network',
    stationAnglesDeg: [205, 25],
    threatType: 'debris',
    threatLabel: 'Space Junk',
    mechanicMode: 'scan',
    orbCount: 3,
    landmarks: [
      {
        id: 'earth-hurricane-1',
        name: 'Hurricane Nova Core',
        angleDeg: 52,
        fact: 'Weather satellites peek straight into spinning Category-5 hurricane eyes to warn coastal towns days early!',
        image: DISCOVERY_IMAGES.earthArctic,
        iconType: 'hurricane',
      },
      {
        id: 'earth-hurricane-2',
        name: 'Typhoon Solis Eye',
        angleDeg: 162,
        fact: 'Radar beams cut through thick storm clouds to measure ocean-whipping winds inside massive typhoons!',
        image: DISCOVERY_IMAGES.earthArctic,
        iconType: 'hurricane',
      },
      {
        id: 'earth-hurricane-3',
        name: 'Cyclone Zephyr Spiral',
        angleDeg: 282,
        fact: 'Tracking warm ocean heat from orbit lets scientists predict when tropical cyclones rapidly intensify!',
        image: DISCOVERY_IMAGES.earthArctic,
        iconType: 'hurricane',
      },
    ],
    badgeTitle: 'Storm Guardian',
  },
  {
    id: 'lunar-rescue',
    title: 'MOON: Gateway Cargo Rescue',
    difficultyLabel: 'Intermediate',
    subtitle:
      'Slingshot to Lunar orbit, catch the spinning supply pod with CSA Canadarm & transmit telemetry home.',
    tag: 'Intermediate · Lunar Orbit & CSA Canadarm',
    targetBody: 'moon',
    planetName: 'The Moon',
    planetColors: {
      base: '#475569',
      highlight: '#94a3b8',
      accent: '#e2e8f0',
      atmosphere: 'rgba(148, 163, 184, 0.16)',
      skyTop: '#020617',
      skyBottom: '#0f172a',
    },
    startingFuelPct: 100,
    targetOrbitLabel: 'Lunar Polar Orbit',
    stationName: 'Lunar Deep-Space Dish',
    stationAnglesDeg: [190, 10],
    threatType: 'debris',
    threatLabel: 'Meteor Shard',
    mechanicMode: 'canadarm',
    orbCount: 3,
    landmarks: [
      {
        id: 'moon-pod-secured',
        name: 'Gateway Supply Pod Secured!',
        angleDeg: 60,
        fact: 'Canada’s Canadarm3 robot arm catches drifting supply pods and services Artemis stations around the Moon!',
        image: DISCOVERY_IMAGES.lunarCrater,
        iconType: 'pod',
      },
      {
        id: 'moon-shackleton',
        name: 'Shackleton Ice Telemetry',
        angleDeg: 165,
        fact: 'Sunlight never reaches the bottom of Shackleton Crater, keeping ancient water ice frozen for future Moon crews!',
        image: DISCOVERY_IMAGES.lunarCrater,
        iconType: 'crater',
      },
      {
        id: 'moon-gateway-dock',
        name: 'Gateway Orbit Sync Locked',
        angleDeg: 290,
        fact: 'Lunar Gateway loops in a clever polar halo orbit so astronauts keep steady radio contact with Earth!',
        image: DISCOVERY_IMAGES.lunarCrater,
        iconType: 'ice',
      },
    ],
    badgeTitle: 'Canadarm Ace',
  },
  {
    id: 'mars-water',
    title: 'MARS: Polar Ice Discovery',
    difficultyLabel: 'Expert',
    subtitle:
      'Scan 3 subsurface polar ice craters while blocking sweeping Solar Storms with your directional Shield.',
    tag: 'Expert · Deep Space & Solar Storms',
    targetBody: 'mars',
    planetName: 'Mars',
    planetColors: {
      base: '#9a3412',
      highlight: '#ea580c',
      accent: '#fed7aa',
      atmosphere: 'rgba(251, 146, 60, 0.30)',
      skyTop: '#05030a',
      skyBottom: '#2b0f0a',
    },
    startingFuelPct: 100,
    targetOrbitLabel: 'Mars Polar Orbit',
    stationName: 'Mars Deep-Space Relay',
    stationAnglesDeg: [205, 25],
    threatType: 'solar-wave',
    threatLabel: 'Solar Radiation Wave',
    mechanicMode: 'scan',
    orbCount: 3,
    landmarks: [
      {
        id: 'mars-korolev',
        name: 'Subsurface Martian Ice Confirmed!',
        angleDeg: 42,
        fact: 'Korolev Crater holds a permanent sparkling dome of water ice nearly two kilometers thick beneath Martian skies!',
        image: DISCOVERY_IMAGES.marsCanyon,
        iconType: 'ice',
      },
      {
        id: 'mars-borealis',
        name: 'Borealis Frost Basin Mapped',
        angleDeg: 158,
        fact: 'Ground-penetrating radar echoes reveal frozen underground glaciers buried beneath red Martian dust!',
        image: DISCOVERY_IMAGES.marsCanyon,
        iconType: 'crater',
      },
      {
        id: 'mars-planum',
        name: 'Planum Boreum Polar Core',
        angleDeg: 274,
        fact: 'Mars’s icy polar caps grow and shrink every season as frozen carbon dioxide snows down from thin red air!',
        image: DISCOVERY_IMAGES.marsCanyon,
        iconType: 'ice',
      },
    ],
    badgeTitle: 'Red Planet Scout',
  },
];
