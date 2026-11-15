import earthArcticImg from '../assets/images/discovery_earth_arctic_1794749459142.jpg';
import lunarCraterImg from '../assets/images/discovery_lunar_crater_1794749459052.jpg';
import marsCanyonImg from '../assets/images/discovery_mars_canyon_1794749460882.jpg';
import deepSpaceImg from '../assets/images/discovery_deep_space_1794749460602.jpg';
import type { CelestialBodyId } from '../types/mission';
import type { GmatMissionRegime, SurfaceLandmark } from '../types/nasaSegments';

export const DISCOVERY_IMAGES = {
  earthArctic: earthArcticImg,
  lunarCrater: lunarCraterImg,
  marsCanyon: marsCanyonImg,
  deepSpace: deepSpaceImg,
} as const;

export function getArtworkForBodyAndRegime(
  body: CelestialBodyId,
  regime: GmatMissionRegime,
  landmarkId?: string,
): string {
  if (regime === 'lagrange' || landmarkId === 'lm-aurora') {
    return landmarkId === 'lm-aurora' ? DISCOVERY_IMAGES.earthArctic : DISCOVERY_IMAGES.deepSpace;
  }
  if (body === 'moon') return DISCOVERY_IMAGES.lunarCrater;
  if (body === 'mars') return DISCOVERY_IMAGES.marsCanyon;
  if (regime === 'geo') return DISCOVERY_IMAGES.deepSpace;
  return DISCOVERY_IMAGES.earthArctic;
}

export function getFriendlyLandmarkFact(lm: SurfaceLandmark): {
  shortName: string;
  funFact: string;
  stars: 1 | 2 | 3;
} {
  const shortMap: Record<string, { shortName: string; funFact: string }> = {
    'lm-beaufort': {
      shortName: 'Arctic Sea-Ice Pack',
      funFact: 'Radar microwaves bounce straight through polar blizzards to track how thick Arctic ice is every day!',
    },
    'lm-hudson': {
      shortName: 'Hudson Bay Methane Belt',
      funFact: 'Warming northern ponds bubble invisible methane gas that rainbow light scanners spot from space!',
    },
    'lm-jakobshavn': {
      shortName: 'Greenland Mega-Glacier',
      funFact: 'This giant river of ice slides toward the ocean faster than almost any glacier on Earth!',
    },
    'lm-aurora': {
      shortName: 'Dancing Northern Lights',
      funFact: 'Solar wind particles crash into Earth’s magnetic shield and light up the polar sky like neon curtains!',
    },
    'lm-amazon': {
      shortName: 'Amazon Rainforest Lungs',
      funFact: 'From orbit, cameras watch how billions of green leaves soak up carbon dioxide across the whole basin!',
    },
    'lm-shackleton': {
      shortName: 'Shackleton Ice Crater',
      funFact: 'Sunlight never reaches the bottom of this Moon crater, keeping ancient water ice frozen for billions of years!',
    },
    'lm-faustini': {
      shortName: 'Faustini Frozen Rim',
      funFact: 'Astronauts could someday melt buried lunar hydrogen ice here to make drinking water and rocket fuel!',
    },
    'lm-cabeus': {
      shortName: 'Cabeus Frost Basin',
      funFact: 'Infrared eyes caught real frost crystals shimmering inside this pitch-black lunar valley!',
    },
    'lm-malapert': {
      shortName: 'Peak of Eternal Sunlight',
      funFact: 'This tall Moon mountain stays sunlit almost 90% of the year—perfect for solar-powered Moon bases!',
    },
    'lm-nobile': {
      shortName: 'Artemis Landing Zone',
      funFact: 'Radar checks every boulder here so future Moon landers can touch down safely!',
    },
    'lm-jezero': {
      shortName: 'Ancient Mars River Delta',
      funFact: 'Billions of years ago, a winding river poured water right into this rocky Martian lakebed!',
    },
    'lm-gale': {
      shortName: 'Gale Crater Methane Puff',
      funFact: 'Mars quietly puffs tiny burps of methane gas every summer—scientists want to know what makes it!',
    },
    'lm-hellas': {
      shortName: 'Hidden Martian Ice Lake',
      funFact: 'Radar echoes peeked beneath red Martian dust to find huge buried glaciers of frozen water!',
    },
    'lm-valles': {
      shortName: 'Grand Canyon of Mars',
      funFact: 'Valles Marineris is so huge it would stretch all the way across the United States!',
    },
    'lm-korolev': {
      shortName: 'Korolev Ice Rink Crater',
      funFact: 'This giant Martian crater holds a permanent sparkling dome of ice almost 2 kilometers thick!',
    },
  };

  const info = shortMap[lm.id] || {
    shortName: lm.name,
    funFact: lm.regionDataSummary,
  };

  const stars: 1 | 2 | 3 =
    !lm.captured ? 1 : lm.signalQualityPct >= 82 ? 3 : lm.signalQualityPct >= 65 ? 2 : 1;

  return { ...info, stars };
}
