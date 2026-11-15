import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Clock,
  Fuel,
  Play,
  Radio,
  RotateCcw,
  Shield,
  Star,
  Trophy,
  Wrench,
  Zap,
} from 'lucide-react';
import { audioSynth } from '../audio/synth';
import { UNIFIED_MISSIONS, type UnifiedMissionId, type UnifiedMissionSpec } from './missions';

export type UnifiedGamePhase =
  | 'briefing'
  | 'launch'
  | 'transition_orbit'
  | 'orbit'
  | 'beamdown'
  | 'finale';

export interface UnifiedGameSnapshot {
  missionId: UnifiedMissionId;
  phase: UnifiedGamePhase;
  fuelPct: number;
  hullPct: number;
  orbsCollected: number;
  orbsBeamed: number;
  orbGoal: number;
  activeThreat: 'none' | 'debris' | 'solar-wave';
  starsEarned: 1 | 2 | 3;
}

interface UnifiedMissionCanvasProps {
  initialMissionId?: UnifiedMissionId;
  onSnapshotChange?: (snap: UnifiedGameSnapshot) => void;
  externalPhaseRequest?: { phase: 'briefing'; nonce: number } | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface BoosterRing {
  alt: number;
  xOffset: number;
  collected: boolean;
  pulse: number;
}

interface OrbEntity {
  id: string;
  label: string;
  color: string;
  orbitAngle: number;
  state: 'on-ship' | 'beaming' | 'delivered';
  beamProgress: number;
  sourceX: number;
  sourceY: number;
  targetDishAngleOffsetDeg: number;
}

interface ThreatDebris {
  active: boolean;
  warningTimer: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  hitChecked: boolean;
}

interface ThreatSolarWave {
  active: boolean;
  warningTimer: number;
  waveX: number;
  blockedByShield: boolean;
  hitApplied: boolean;
}

const FIXED_DT = 1 / 60;
const DEG2RAD = Math.PI / 180;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function wrapAngleRad(a: number): number {
  let x = a % (Math.PI * 2);
  if (x < 0) x += Math.PI * 2;
  return x;
}

function shortestAngleDiffRad(a: number, b: number): number {
  let d = (a - b + Math.PI) % (Math.PI * 2);
  if (d < 0) d += Math.PI * 2;
  return d - Math.PI;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function formatTimer(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export function UnifiedMissionCanvas({
  initialMissionId = 'earth-climate',
  onSnapshotChange,
  externalPhaseRequest,
}: UnifiedMissionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const snapshotCbRef = useRef(onSnapshotChange);
  snapshotCbRef.current = onSnapshotChange;

  const [selectedMissionId, setSelectedMissionId] = useState<UnifiedMissionId>(initialMissionId);
  const [uiState, setUiState] = useState<{
    phase: UnifiedGamePhase;
    fuelPct: number;
    hullPct: number;
    orbsCollected: number;
    orbsBeamed: number;
    orbGoal: number;
    ringsHit: number;
    threatsCleared: number;
    activeThreat: 'none' | 'debris' | 'solar-wave';
    inTargetZone: boolean;
    inDishCone: boolean;
    shieldActive: boolean;
    scanPct: number;
    grapplePct: number;
    launchAltPct: number;
    launchInOrbitRing: boolean;
    elapsedSec: number;
    score: number;
    starsEarned: 1 | 2 | 3;
    actionHint: string;
  }>({
    phase: 'briefing',
    fuelPct: 100,
    hullPct: 100,
    orbsCollected: 0,
    orbsBeamed: 0,
    orbGoal: 3,
    ringsHit: 0,
    threatsCleared: 0,
    activeThreat: 'none',
    inTargetZone: false,
    inDishCone: false,
    shieldActive: false,
    scanPct: 0,
    grapplePct: 0,
    launchAltPct: 0,
    launchInOrbitRing: false,
    elapsedSec: 0,
    score: 0,
    starsEarned: 3,
    actionHint: 'Pick a mission to blast off!',
  });

  // Live input state ref (keyboard + pointer + HUD touch buttons)
  const inputRef = useRef({
    left: false,
    right: false,
    up: false,
    down: false,
    action: false, // Spacebar / primary action button
    shield: false, // Shift or E / Solar Shield button
    pointerSteerActive: false,
    pointerNormX: 0,
  });

  // Authoritative 60Hz game simulation state ref
  const simRef = useRef({
    mission: UNIFIED_MISSIONS[0] as UnifiedMissionSpec,
    phase: 'briefing' as UnifiedGamePhase,
    time: 0,
    elapsedMissionSec: 0,
    viewportW: 1200,
    viewportH: 720,

    // Continuous shared spacecraft resources
    fuelPct: 100,
    hullPct: 100,
    score: 0,
    ringsHit: 0,
    threatsCleared: 0,
    screenShake: 0,

    // Phase 1: Launch-to-Orbit state
    launchAlt: 0,
    launchSpeed: 0,
    launchX: 0,
    launchVx: 0,
    launchPitch: 0,
    launchBannerText: '' as string,
    launchBannerTimer: 0,
    boosterRings: [] as BoosterRing[],

    // Transition camera zoom-out state
    transitionTimer: 0,
    transitionDuration: 1.5,

    // Phase 2 & 3: Orbital Mission state
    planetRot: 0,
    shipAngle: -Math.PI / 2,
    shipRadiusOffset: 98,
    shipAngVel: 0.5,
    shipRadVel: 0,

    // Landmarks & Canadarm Pod
    scannedLandmarkIds: new Set<string>(),
    activeScanLandmarkId: null as string | null,
    scanProgress: 0,

    podAngle: 0.65,
    podRadiusOffset: 108,
    podAngVel: 0.34,
    podSpin: 0,
    podDocked: false,
    grappleProgress: 0,

    // Orbiting Data Orbs carried from Phase 2 -> Phase 3
    orbs: [] as OrbEntity[],
    beamCooldown: 0,
    beamActive: false,
    activeDishAngleDeg: 205,

    // Threats
    threatCooldown: 3.8,
    threatsSpawned: 0,
    debris: {
      active: false,
      warningTimer: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
      hitChecked: false,
    } as ThreatDebris,
    solarWave: {
      active: false,
      warningTimer: 0,
      waveX: -0.2,
      blockedByShield: false,
      hitApplied: false,
    } as ThreatSolarWave,

    // 3-depth parallax stars + city lights
    stars: Array.from({ length: 145 }, (_, i) => ({
      nx: ((i * 193.7) % 1000) / 1000,
      ny: ((i * 421.3) % 1000) / 1000,
      r: (i % 3) * 0.6 + 0.7,
      depth: (i % 3) + 1,
      phase: i * 0.9,
    })),
    particles: [] as Particle[],
    lastActionSoundAt: 0,
    lastBeamSoundAt: 0,
  });

  const mission =
    UNIFIED_MISSIONS.find((m) => m.id === selectedMissionId) || UNIFIED_MISSIONS[0];

  const spawnBurst = useCallback(
    (x: number, y: number, color: string, count = 16, speed = 130) => {
      const s = simRef.current;
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const spd = speed * (0.45 + Math.random() * 0.75);
        s.particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.45 + Math.random() * 0.45,
          maxLife: 0.9,
          size: 2.2 + Math.random() * 2.8,
          color,
        });
      }
      if (s.particles.length > 320) {
        s.particles.splice(0, s.particles.length - 320);
      }
    },
    [],
  );

  const startMission = useCallback((missionToStart: UnifiedMissionSpec) => {
    audioSynth.playIgnition();
    const s = simRef.current;
    s.mission = missionToStart;
    s.phase = 'launch';
    s.elapsedMissionSec = 0;
    s.fuelPct = missionToStart.startingFuelPct;
    s.hullPct = 100;
    s.score = 0;
    s.ringsHit = 0;
    s.threatsCleared = 0;
    s.screenShake = 7;

    s.launchAlt = 0.02;
    s.launchSpeed = 0.095;
    s.launchX = 0;
    s.launchVx = 0;
    s.launchPitch = 0;
    s.launchBannerText = 'LIFTOFF! Hit Gold Rings to Save Fuel!';
    s.launchBannerTimer = 2.6;

    const ringAlts = [0.18, 0.34, 0.5, 0.66, 0.79];
    s.boosterRings = ringAlts.map((alt, idx) => ({
      alt,
      xOffset: Math.sin(alt * Math.PI * 0.52) * 230 + (idx % 2 === 0 ? -36 : 36),
      collected: false,
      pulse: idx * 0.7,
    }));

    s.transitionTimer = 0;
    s.planetRot = 0;
    s.shipAngle = -Math.PI / 2;
    s.shipRadiusOffset = 98;
    s.shipAngVel = 0.5;
    s.shipRadVel = 0;

    s.scannedLandmarkIds = new Set<string>();
    s.activeScanLandmarkId = null;
    s.scanProgress = 0;

    s.podAngle = Math.PI * 0.25;
    s.podRadiusOffset = 108;
    s.podAngVel = 0.34;
    s.podSpin = 0;
    s.podDocked = false;
    s.grappleProgress = 0;

    s.orbs = [];
    s.beamCooldown = 0;
    s.beamActive = false;
    s.activeDishAngleDeg = missionToStart.stationAnglesDeg[0];

    s.threatCooldown = 3.8;
    s.threatsSpawned = 0;
    s.debris.active = false;
    s.solarWave.active = false;
    s.particles = [];
  }, []);

  useEffect(() => {
    if (!externalPhaseRequest) return;
    if (externalPhaseRequest.phase === 'briefing') {
      simRef.current.phase = 'briefing';
      simRef.current.debris.active = false;
      simRef.current.solarWave.active = false;
      audioSynth.setThrustRumble(0);
    }
  }, [externalPhaseRequest]);

  useEffect(() => {
    if (simRef.current.phase === 'briefing') {
      simRef.current.mission = mission;
    }
  }, [mission]);

  // Silence continuous thruster audio on unmount
  useEffect(() => {
    return () => {
      audioSynth.setThrustRumble(0);
    };
  }, []);

  // Keyboard bindings (WASD, Arrows, Space, Shift/E)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputRef.current.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') inputRef.current.right = true;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') inputRef.current.up = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') inputRef.current.down = true;
      if (e.code === 'Space') inputRef.current.action = true;
      if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        inputRef.current.shield = true;
      }

      if (e.code === 'Enter' && simRef.current.phase === 'briefing') {
        startMission(simRef.current.mission);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputRef.current.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') inputRef.current.right = false;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') inputRef.current.up = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') inputRef.current.down = false;
      if (e.code === 'Space') inputRef.current.action = false;
      if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        inputRef.current.shield = false;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [startMission]);

  // Responsive HiDPI ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(300, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      simRef.current.viewportW = w;
      simRef.current.viewportH = h;
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Main Fixed-Timestep 60fps Loop
  useEffect(() => {
    let rafId = 0;
    let lastTimeMs = performance.now();
    let accumulator = 0;
    let uiSyncTimer = 0;

    const stepPhysics = (dt: number) => {
      const s = simRef.current;
      const inp = inputRef.current;
      const m = s.mission;
      s.time += dt;
      s.screenShake = Math.max(0, s.screenShake - dt * 18);

      // Step particles
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) s.particles.splice(i, 1);
      }

      if (s.phase === 'briefing') {
        s.planetRot += 0.12 * dt;
        audioSynth.setThrustRumble(0);
        return;
      }

      if (s.phase !== 'finale') {
        s.elapsedMissionSec += dt;
      }

      // PHASE 1: LAUNCH & SEAMLESS CAMERA ZOOM-OUT
      if (s.phase === 'launch') {
        if (s.launchBannerTimer > 0) s.launchBannerTimer = Math.max(0, s.launchBannerTimer - dt);

        const boosting = inp.up;
        const targetClimbSpeed = boosting ? 0.145 : 0.102;
        s.launchSpeed = lerp(s.launchSpeed, targetClimbSpeed, 1 - Math.exp(-6 * dt));
        s.launchAlt += s.launchSpeed * dt;

        audioSynth.setThrustRumble(boosting ? 0.85 : 0.45);

        let steerInput = 0;
        if (inp.left) steerInput -= 1;
        if (inp.right) steerInput += 1;
        if (steerInput === 0 && inp.pointerSteerActive) {
          steerInput = clamp(inp.pointerNormX * 1.4, -1, 1);
        }

        const targetVx = steerInput * 290;
        s.launchVx = lerp(s.launchVx, targetVx, 1 - Math.exp(-10 * dt));
        s.launchX = clamp(s.launchX + s.launchVx * dt, -320, 320);

        const arcCenter = Math.sin(s.launchAlt * Math.PI * 0.52) * 230;
        const targetPitch = clamp(
          (s.launchVx / 290) * 0.38 + 0.12 * Math.sin(s.launchAlt * Math.PI * 0.5),
          -0.45,
          0.55,
        );
        s.launchPitch = lerp(s.launchPitch, targetPitch, 1 - Math.exp(-10 * dt));

        // Magnetic snap assist + pickup for Gold Booster Rings
        s.boosterRings.forEach((ring) => {
          if (ring.collected) return;
          const dAlt = Math.abs(s.launchAlt - ring.alt);
          const dX = Math.abs(s.launchX - ring.xOffset);
          if (dAlt < 0.068 && dX < 88) {
            s.launchX = lerp(s.launchX, ring.xOffset, 1 - Math.exp(-6 * dt));
          }
          if (dAlt < 0.05 && Math.abs(s.launchX - ring.xOffset) < 60) {
            ring.collected = true;
            s.ringsHit += 1;
            s.fuelPct = clamp(s.fuelPct + 7, 0, 100);
            s.score += 120;
            s.launchBannerText = '+7% BONUS FUEL SAVED!';
            s.launchBannerTimer = 1.25;
            audioSynth.playMountPart();
            spawnBurst(s.viewportW * 0.5, s.viewportH * 0.62, '#fbbf24', 20, 175);
          }
        });

        const offArcPenalty = Math.abs(s.launchX - arcCenter) > 150 ? 1.05 : 0.68;
        const burnRate = (boosting ? 3.3 : 2.0) * offArcPenalty;
        s.fuelPct = Math.max(18, s.fuelPct - burnRate * dt);

        // Launchpad billowing smoke clouds (low alt) + fiery exhaust sparks
        const rx = s.viewportW * 0.5 + (s.launchX - arcCenter) * 0.45;
        const ry = s.viewportH * 0.64;
        if (s.launchAlt < 0.16 && Math.random() < 0.75) {
          s.particles.push({
            x: rx + (Math.random() - 0.5) * 34,
            y: ry + 42,
            vx: (Math.random() - 0.5) * 90,
            vy: 30 + Math.random() * 45,
            life: 0.6 + Math.random() * 0.4,
            maxLife: 1.0,
            size: 10 + Math.random() * 10,
            color: 'rgba(226, 232, 240, 0.55)',
          });
        }
        if (Math.random() < 0.9) {
          s.particles.push({
            x: rx + (Math.random() - 0.5) * 10,
            y: ry + 32,
            vx: (Math.random() - 0.5) * 40 - Math.sin(s.launchPitch) * 65,
            vy: 155 + Math.random() * 85,
            life: 0.34 + Math.random() * 0.25,
            maxLife: 0.59,
            size: 4 + Math.random() * 4,
            color: Math.random() > 0.35 ? '#fb923c' : '#fde047',
          });
        }
        if (boosting) s.screenShake = Math.max(s.screenShake, 2.4);

        const inOrbitBand = s.launchAlt >= 0.82 && s.launchAlt <= 1.01;
        if ((inOrbitBand && inp.action) || s.launchAlt >= 1.01) {
          const bullseye = s.launchAlt >= 0.85 && s.launchAlt <= 0.96;
          if (bullseye) {
            s.fuelPct = clamp(s.fuelPct + 8, 0, 100);
            s.score += 250;
          } else {
            s.score += 140;
          }
          s.phase = 'transition_orbit';
          s.transitionTimer = 0;
          s.screenShake = 5;
          audioSynth.setThrustRumble(0);
          audioSynth.playSuccess();
          spawnBurst(s.viewportW * 0.5, s.viewportH * 0.55, '#34d399', 28, 220);
          inp.action = false;
        }
        return;
      }

      // SEAMLESS CAMERA ZOOM-OUT TRANSITION
      if (s.phase === 'transition_orbit') {
        s.transitionTimer += dt;
        s.planetRot += 0.16 * dt;
        audioSynth.setThrustRumble(0);
        if (s.transitionTimer >= s.transitionDuration) {
          s.phase = 'orbit';
          s.shipAngle = -Math.PI / 2;
          s.shipRadiusOffset = 98;
          s.shipAngVel = 0.5;
          s.shipRadVel = 0;
        }
        return;
      }

      // SHARED ORBITAL FLIGHT PHYSICS (PHASE 2, 3 & 4)
      const cx = s.viewportW * 0.5;
      const cy = s.viewportH * 0.5;
      const planetR = Math.min(s.viewportW, s.viewportH) * 0.21;
      const minOffset = 46;
      const maxOffset = Math.min(s.viewportW, s.viewportH) * 0.24 + 54;

      s.planetRot = wrapAngleRad(s.planetRot + 0.11 * dt);

      const canSteer = s.phase === 'orbit' || s.phase === 'beamdown';
      const baseCruiseVel = 0.48;
      let targetAngVel = baseCruiseVel;
      let targetRadVel = 0;
      let thrusting = false;

      if (canSteer) {
        if (inp.right) targetAngVel = 1.08;
        else if (inp.left) targetAngVel = -0.18;

        if (inp.up) targetRadVel = 95;
        else if (inp.down) targetRadVel = -95;

        thrusting = inp.left || inp.right || inp.up || inp.down;
        if (thrusting) {
          if (s.fuelPct > 0) {
            s.fuelPct = Math.max(0, s.fuelPct - 1.45 * dt);
          }
          s.screenShake = Math.max(s.screenShake, 1.4);
          audioSynth.setThrustRumble(0.28);
        } else {
          audioSynth.setThrustRumble(0);
        }
      } else {
        audioSynth.setThrustRumble(0);
      }

      s.shipAngVel = lerp(s.shipAngVel, targetAngVel, 1 - Math.exp(-8 * dt));
      s.shipRadVel = lerp(s.shipRadVel, targetRadVel, 1 - Math.exp(-10 * dt));

      s.shipAngle = wrapAngleRad(s.shipAngle + s.shipAngVel * dt);
      s.shipRadiusOffset = clamp(s.shipRadiusOffset + s.shipRadVel * dt, minOffset, maxOffset);

      const orbitR = planetR + s.shipRadiusOffset;
      const shipX = cx + Math.cos(s.shipAngle) * orbitR;
      const shipY = cy + Math.sin(s.shipAngle) * orbitR;

      // Determine nearest Ground Dish for beaming
      let bestDishAngle = wrapAngleRad(m.stationAnglesDeg[0] * DEG2RAD + s.planetRot);
      let bestDishDiff = Math.abs(shortestAngleDiffRad(s.shipAngle, bestDishAngle));
      m.stationAnglesDeg.forEach((deg) => {
        const ang = wrapAngleRad(deg * DEG2RAD + s.planetRot);
        const diff = Math.abs(shortestAngleDiffRad(s.shipAngle, ang));
        if (diff < bestDishDiff) {
          bestDishDiff = diff;
          bestDishAngle = ang;
        }
      });
      s.activeDishAngleDeg = (bestDishAngle / DEG2RAD + 360) % 360;
      const dishX = cx + Math.cos(bestDishAngle) * planetR;
      const dishY = cy + Math.sin(bestDishAngle) * planetR;

      // Update orbiting Data Orbs
      s.orbs.forEach((orb, idx) => {
        if (orb.state === 'on-ship') {
          orb.orbitAngle = wrapAngleRad(orb.orbitAngle + 2.4 * dt + idx * 0.001);
        } else if (orb.state === 'beaming') {
          orb.beamProgress = Math.min(1, orb.beamProgress + dt * 1.9);
          if (orb.beamProgress >= 1) {
            orb.state = 'delivered';
            s.score += 200;
            audioSynth.playSuccess();
            spawnBurst(dishX, dishY, '#34d399', 24, 175);
          }
        }
      });

      // PHASE 2: ACTIVE ORBITAL MISSION
      if (s.phase === 'orbit') {
        if (m.mechanicMode === 'scan') {
          let bestLm: (typeof m.landmarks)[0] | null = null;
          let bestDist = Infinity;
          m.landmarks.forEach((lm) => {
            if (s.scannedLandmarkIds.has(lm.id)) return;
            const lmAngle = wrapAngleRad(lm.angleDeg * DEG2RAD + s.planetRot);
            const angErr = Math.abs(shortestAngleDiffRad(s.shipAngle, lmAngle));
            if (angErr <= 26 * DEG2RAD && angErr < bestDist) {
              bestDist = angErr;
              bestLm = lm;
            }
          });

          if (bestLm) {
            const targetLm = bestLm as (typeof m.landmarks)[0];
            if (s.activeScanLandmarkId !== targetLm.id) {
              s.activeScanLandmarkId = targetLm.id;
              s.scanProgress = 0;
            }
            if (inp.action) {
              s.scanProgress = Math.min(1, s.scanProgress + dt * 0.94);
              if (s.time - s.lastActionSoundAt > 0.22) {
                s.lastActionSoundAt = s.time;
                audioSynth.playSonarPing(s.scanProgress);
              }
              if (s.scanProgress >= 1) {
                s.scannedLandmarkIds.add(targetLm.id);
                s.scanProgress = 0;
                s.activeScanLandmarkId = null;
                s.score += 220;
                const lmWorldAng = wrapAngleRad(targetLm.angleDeg * DEG2RAD + s.planetRot);
                const lmX = cx + Math.cos(lmWorldAng) * planetR;
                const lmY = cy + Math.sin(lmWorldAng) * planetR;
                const orbColors = ['#22d3ee', '#34d399', '#fbbf24'];
                s.orbs.push({
                  id: targetLm.id,
                  label: targetLm.name,
                  color: orbColors[s.orbs.length % orbColors.length],
                  orbitAngle: (s.orbs.length * Math.PI * 2) / 3,
                  state: 'on-ship',
                  beamProgress: 0,
                  sourceX: lmX,
                  sourceY: lmY,
                  targetDishAngleOffsetDeg: m.stationAnglesDeg[0],
                });
                audioSynth.playSuccess();
                spawnBurst(lmX, lmY, '#22d3ee', 24, 165);
                spawnBurst(shipX, shipY, '#34d399', 16, 130);
              }
            } else {
              s.scanProgress = Math.max(0, s.scanProgress - dt * 0.22);
            }
          } else {
            s.activeScanLandmarkId = null;
            s.scanProgress = 0;
          }
        } else {
          // MOON CANADARM RESCUE: Drifting spinning Gateway Pod
          if (!s.podDocked) {
            s.podAngle = wrapAngleRad(s.podAngle + s.podAngVel * dt);
            s.podSpin += (inp.action ? 0.35 : 2.1) * dt;
            const podR = planetR + s.podRadiusOffset + Math.sin(s.time * 1.4) * 8;
            const podX = cx + Math.cos(s.podAngle) * podR;
            const podY = cy + Math.sin(s.podAngle) * podR;
            const distToPod = Math.hypot(shipX - podX, shipY - podY);
            const grappleRange = 132;

            // Occasional warning spark on damaged spinning pod
            if (Math.random() < 0.14) {
              s.particles.push({
                x: podX + (Math.random() - 0.5) * 14,
                y: podY + (Math.random() - 0.5) * 14,
                vx: (Math.random() - 0.5) * 45,
                vy: (Math.random() - 0.5) * 45,
                life: 0.3,
                maxLife: 0.35,
                size: 2.2,
                color: '#fbbf24',
              });
            }

            if (distToPod <= grappleRange) {
              if (inp.action) {
                s.grappleProgress = Math.min(1, s.grappleProgress + dt * 0.64);
                s.podAngle = lerp(s.podAngle, s.shipAngle, dt * 1.35);
                s.podRadiusOffset = lerp(s.podRadiusOffset, s.shipRadiusOffset, dt * 1.5);

                if (s.time - s.lastActionSoundAt > 0.24) {
                  s.lastActionSoundAt = s.time;
                  audioSynth.playSonarPing(s.grappleProgress);
                }

                if (s.grappleProgress >= 1) {
                  s.podDocked = true;
                  s.score += 660;
                  audioSynth.playSuccess();
                  spawnBurst(shipX, shipY, '#fbbf24', 32, 210);
                  const orbColors = ['#38bdf8', '#fbbf24', '#34d399'];
                  m.landmarks.forEach((lm, idx) => {
                    s.scannedLandmarkIds.add(lm.id);
                    s.orbs.push({
                      id: lm.id,
                      label: lm.name,
                      color: orbColors[idx % orbColors.length],
                      orbitAngle: (idx * Math.PI * 2) / 3,
                      state: 'on-ship',
                      beamProgress: 0,
                      sourceX: podX,
                      sourceY: podY,
                      targetDishAngleOffsetDeg: m.stationAnglesDeg[0],
                    });
                  });
                }
              } else {
                s.grappleProgress = Math.max(0, s.grappleProgress - dt * 0.16);
              }
            } else {
              s.grappleProgress = Math.max(0, s.grappleProgress - dt * 0.24);
            }
          }
        }

        // Dynamic Hazard Spawner
        if (!s.debris.active && !s.solarWave.active && s.orbs.length < m.orbCount) {
          s.threatCooldown -= dt;
          if (s.threatCooldown <= 0 && s.threatsSpawned < 2) {
            s.threatsSpawned += 1;
            s.threatCooldown = 9.0;
            audioSynth.playAlert();

            if (m.threatType === 'debris') {
              const targetAng = s.shipAngle + 0.65;
              const targetR = planetR + s.shipRadiusOffset;
              const tx = cx + Math.cos(targetAng) * targetR;
              const ty = cy + Math.sin(targetAng) * targetR;
              const outAng = targetAng + 0.42;
              const startX = cx + Math.cos(outAng) * (Math.max(s.viewportW, s.viewportH) * 0.65);
              const startY = cy + Math.sin(outAng) * (Math.max(s.viewportW, s.viewportH) * 0.65);
              const dirLen = Math.max(1, Math.hypot(tx - startX, ty - startY));
              const speed = 255;

              s.debris = {
                active: true,
                warningTimer: 2.35, // ~2.4s clear warning
                x: startX,
                y: startY,
                vx: ((tx - startX) / dirLen) * speed,
                vy: ((ty - startY) / dirLen) * speed,
                startX,
                startY,
                endX: startX + ((tx - startX) / dirLen) * (dirLen + 420),
                endY: startY + ((ty - startY) / dirLen) * (dirLen + 420),
                hitChecked: false,
              };
            } else {
              s.solarWave = {
                active: true,
                warningTimer: 2.2,
                waveX: -0.15,
                blockedByShield: false,
                hitApplied: false,
              };
            }
          }
        }

        // Step Debris
        if (s.debris.active) {
          if (s.debris.warningTimer > 0) {
            s.debris.warningTimer -= dt;
          } else {
            s.debris.x += s.debris.vx * dt;
            s.debris.y += s.debris.vy * dt;
            const dShip = Math.hypot(s.debris.x - shipX, s.debris.y - shipY);
            if (dShip < 25 && !s.debris.hitChecked) {
              s.debris.hitChecked = true;
              s.hullPct = Math.max(25, s.hullPct - 25);
              s.screenShake = 10;
              audioSynth.playAlert();
              spawnBurst(shipX, shipY, '#f43f5e', 24, 180);
            }
            if (
              s.debris.x < -120 ||
              s.debris.x > s.viewportW + 120 ||
              s.debris.y < -120 ||
              s.debris.y > s.viewportH + 120
            ) {
              if (!s.debris.hitChecked) {
                s.threatsCleared += 1;
                s.score += 150;
                audioSynth.playMountPart();
              }
              s.debris.active = false;
            }
          }
        }

        // Step Solar Radiation Wave (deflected by directional Sun-facing Shield!)
        if (s.solarWave.active) {
          if (s.solarWave.warningTimer > 0) {
            s.solarWave.warningTimer -= dt;
          } else {
            s.solarWave.waveX += 0.52 * dt;
            const waveScreenX = s.solarWave.waveX * s.viewportW;
            if (Math.abs(waveScreenX - shipX) < 38) {
              if (inp.shield) {
                // Continuous harmless spark spray off directional shield facing Sun (left)
                if (Math.random() < 0.7) {
                  s.particles.push({
                    x: shipX - 24,
                    y: shipY + (Math.random() - 0.5) * 26,
                    vx: -90 - Math.random() * 80,
                    vy: (Math.random() - 0.5) * 140,
                    life: 0.35,
                    maxLife: 0.4,
                    size: 3,
                    color: '#67e8f9',
                  });
                }
                if (!s.solarWave.blockedByShield) {
                  s.solarWave.blockedByShield = true;
                  s.threatsCleared += 1;
                  s.score += 180;
                  audioSynth.playShieldDeflect();
                  spawnBurst(shipX - 22, shipY, '#22d3ee', 20, 150);
                }
              } else if (!s.solarWave.hitApplied && !s.solarWave.blockedByShield) {
                s.solarWave.hitApplied = true;
                s.hullPct = Math.max(25, s.hullPct - 25);
                s.screenShake = 10;
                audioSynth.playAlert();
                spawnBurst(shipX, shipY, '#fb923c', 22, 160);
              }
            }
            if (s.solarWave.waveX > 1.15) {
              s.solarWave.active = false;
            }
          }
        }

        if (s.orbs.length >= m.orbCount) {
          s.debris.active = false;
          s.solarWave.active = false;
          s.phase = 'beamdown';
          s.beamCooldown = 0.18;
          inp.action = false;
        }
      }

      // PHASE 3: GROUND STATION LASER LINK
      if (s.phase === 'beamdown') {
        const inDishCone = bestDishDiff <= 30 * DEG2RAD;
        s.beamCooldown = Math.max(0, s.beamCooldown - dt);
        s.beamActive = inDishCone && inp.action;

        if (s.beamActive) {
          if (s.time - s.lastBeamSoundAt > 0.18) {
            s.lastBeamSoundAt = s.time;
            audioSynth.playBeamHum();
          }
          if (s.beamCooldown <= 0) {
            const nextOrb = s.orbs.find((o) => o.state === 'on-ship');
            if (nextOrb) {
              nextOrb.state = 'beaming';
              nextOrb.beamProgress = 0;
              nextOrb.sourceX = shipX;
              nextOrb.sourceY = shipY;
              s.beamCooldown = 0.58;
            }
          }
        }

        const allDelivered =
          s.orbs.length >= m.orbCount && s.orbs.every((o) => o.state === 'delivered');
        if (allDelivered) {
          const fuelBonus = Math.round(s.fuelPct * 4);
          const timeBonus = Math.max(0, Math.round((130 - s.elapsedMissionSec) * 3));
          s.score += fuelBonus + timeBonus;
          s.phase = 'finale';
          audioSynth.setThrustRumble(0);
          audioSynth.playMissionTriumph();
          spawnBurst(cx, cy - planetR, '#fbbf24', 42, 230);
        }
      }
    };

    const renderScene = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const s = simRef.current;
      const m = s.mission;
      const inp = inputRef.current;
      const w = s.viewportW;
      const h = s.viewportH;
      const dpr = canvas.width / Math.max(1, w);

      ctx.save();
      ctx.scale(dpr, dpr);

      if (s.screenShake > 0.2) {
        ctx.translate(
          (Math.random() - 0.5) * s.screenShake,
          (Math.random() - 0.5) * s.screenShake,
        );
      }

      // 1. Background Sky / Space Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      if (s.phase === 'launch') {
        const spaceMix = clamp(s.launchAlt / 0.85, 0, 1);
        bgGrad.addColorStop(0, '#020617');
        bgGrad.addColorStop(
          0.6,
          spaceMix > 0.65 ? '#030c24' : spaceMix > 0.3 ? '#072a5e' : '#0ea5e9',
        );
        bgGrad.addColorStop(
          1,
          spaceMix > 0.7 ? '#091836' : spaceMix > 0.35 ? '#0284c7' : '#38bdf8',
        );
      } else {
        bgGrad.addColorStop(0, m.planetColors.skyTop);
        bgGrad.addColorStop(1, m.planetColors.skyBottom);
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // 3-Depth Parallax Starfield
      const starVisibility =
        s.phase === 'launch' ? clamp((s.launchAlt - 0.14) * 1.4, 0.1, 1) : 1;
      const warping = s.phase === 'transition_orbit' && m.targetBody !== 'earth';
      const warpFactor = warping
        ? Math.sin(clamp(s.transitionTimer / s.transitionDuration, 0, 1) * Math.PI)
        : 0;
      s.stars.forEach((st) => {
        const parallaxShift =
          s.phase === 'launch'
            ? (s.launchAlt * 110 * st.depth) % h
            : (s.shipAngle * 14 * st.depth) % w;
        const sx =
          s.phase === 'launch'
            ? st.nx * w
            : ((st.nx * w - parallaxShift + w * 2) % w);
        const sy =
          s.phase === 'launch' ? (st.ny * h + parallaxShift) % h : st.ny * h;
        const tw = (0.4 + 0.55 * Math.sin(s.time * 2.1 + st.phase)) * starVisibility;

        if (warpFactor > 0.12) {
          const dx = sx - w * 0.5;
          const dy = sy - h * 0.5;
          ctx.strokeStyle = `rgba(186, 230, 253, ${(tw * 0.85).toFixed(2)})`;
          ctx.lineWidth = st.r;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + dx * warpFactor * 0.12, sy + dy * warpFactor * 0.12);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(226, 232, 240, ${tw.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, st.r, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // MOON MISSION: Distant Blue Earth hanging in starry sky!
      if (m.targetBody === 'moon' && s.phase !== 'launch') {
        const ex = w * 0.14;
        const ey = h * 0.24;
        const eGlow = ctx.createRadialGradient(ex, ey, 14, ex, ey, 36);
        eGlow.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
        eGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = eGlow;
        ctx.beginPath();
        ctx.arc(ex, ey, 36, 0, Math.PI * 2);
        ctx.fill();

        const eGrad = ctx.createRadialGradient(ex - 6, ey - 6, 3, ex, ey, 22);
        eGrad.addColorStop(0, '#38bdf8');
        eGrad.addColorStop(0.6, '#0284c7');
        eGrad.addColorStop(1, '#082f49');
        ctx.fillStyle = eGrad;
        ctx.beginPath();
        ctx.arc(ex, ey, 22, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(16, 185, 129, 0.65)';
        ctx.beginPath();
        ctx.ellipse(ex - 5, ey - 2, 7, 5, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // MARS MISSION: Warm Sun Rim on Left Edge
      if (m.targetBody === 'mars' && s.phase !== 'launch') {
        const sunGlow = ctx.createRadialGradient(0, h * 0.5, 10, 0, h * 0.5, w * 0.32);
        sunGlow.addColorStop(0, 'rgba(251, 191, 36, 0.24)');
        sunGlow.addColorStop(1, 'rgba(251, 146, 60, 0)');
        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, w * 0.35, h);
      }

      // 2. PHASE 1 LAUNCH RENDERER
      if (s.phase === 'launch') {
        const rocketScreenY = h * 0.64;
        const pixelsPerAlt = 1150;
        const groundY = rocketScreenY + s.launchAlt * pixelsPerAlt;
        const arcCenterAtRocket = Math.sin(s.launchAlt * Math.PI * 0.52) * 230;
        const worldOffsetX = w * 0.5 - arcCenterAtRocket * 0.45;
        const rocketScreenX = w * 0.5 + (s.launchX - arcCenterAtRocket) * 0.45;

        if (groundY < h + 280) {
          ctx.fillStyle = '#065f46';
          ctx.beginPath();
          ctx.ellipse(w * 0.5, groundY + 420, w * 0.95, 445, 0, Math.PI, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#334155';
          ctx.fillRect(worldOffsetX - 55, groundY - 22, 110, 14);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(worldOffsetX - 44, groundY - 82, 12, 60);
        }

        // Dotted Golden Flight Arc
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.48)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 9]);
        ctx.beginPath();
        for (let a = 0; a <= 0.95; a += 0.04) {
          const ax = worldOffsetX + Math.sin(a * Math.PI * 0.52) * 230 * 0.45;
          const ay = rocketScreenY + (s.launchAlt - a) * pixelsPerAlt;
          if (a === 0) ctx.moveTo(ax, ay);
          else ctx.lineTo(ax, ay);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Target Orbit Ring Band
        const bandTopY = rocketScreenY + (s.launchAlt - 1.0) * pixelsPerAlt;
        const bandBotY = rocketScreenY + (s.launchAlt - 0.82) * pixelsPerAlt;
        const inZone = s.launchAlt >= 0.82 && s.launchAlt <= 1.01;
        ctx.fillStyle = inZone ? 'rgba(52, 211, 153, 0.28)' : 'rgba(52, 211, 153, 0.14)';
        ctx.fillRect(0, bandTopY, w, bandBotY - bandTopY);
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, bandTopY);
        ctx.lineTo(w, bandTopY);
        ctx.moveTo(0, bandBotY);
        ctx.lineTo(w, bandBotY);
        ctx.stroke();

        ctx.fillStyle = '#a7f3d0';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          inZone ? 'ORBIT ZONE! PRESS [SPACE] TO CUT ENGINE!' : 'TARGET ORBIT RING',
          w * 0.5,
          bandBotY - 14,
        );
        ctx.textAlign = 'left';

        // Golden Booster Rings
        s.boosterRings.forEach((ring) => {
          if (ring.collected) return;
          const rx = worldOffsetX + ring.xOffset * 0.45;
          const ry = rocketScreenY + (s.launchAlt - ring.alt) * pixelsPerAlt;
          if (ry < -60 || ry > h + 60) return;

          const pulse = 1 + 0.08 * Math.sin(s.time * 5 + ring.pulse);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(rx, ry, 28 * pulse, 12 * pulse, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
          ctx.beginPath();
          ctx.ellipse(rx, ry, 24 * pulse, 9 * pulse, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('+FUEL', rx, ry - 18);
          ctx.textAlign = 'left';
        });

        s.particles.forEach((p) => {
          ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        ctx.save();
        ctx.translate(rocketScreenX, rocketScreenY);
        ctx.rotate(s.launchPitch);

        const flameLen = (inp.up ? 46 : 32) + Math.sin(s.time * 40) * 6;
        const flameGrad = ctx.createLinearGradient(0, 22, 0, 22 + flameLen);
        flameGrad.addColorStop(0, '#fef08a');
        flameGrad.addColorStop(0.5, '#fb923c');
        flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-9, 22);
        ctx.lineTo(9, 22);
        ctx.lineTo(0, 22 + flameLen);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-10, -14, 20, 36);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-10, 4, 20, 7);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(-10, -14);
        ctx.lineTo(0, -34);
        ctx.lineTo(10, -14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#0ea5e9';
        ctx.beginPath();
        ctx.moveTo(-10, 8);
        ctx.lineTo(-18, 24);
        ctx.lineTo(-10, 22);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(10, 8);
        ctx.lineTo(18, 24);
        ctx.lineTo(10, 22);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(0, -4, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (s.launchBannerTimer > 0 && s.launchBannerText) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
          drawRoundedRect(ctx, w * 0.5 - 145, rocketScreenY - 82, 290, 30, 8);
          ctx.fill();
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 13px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(s.launchBannerText, w * 0.5, rocketScreenY - 62);
          ctx.textAlign = 'left';
        }

        ctx.restore();
        return;
      }

      // 3. SEAMLESS ZOOM-OUT TRANSITION -> FULL PLANET ORBIT
      const cx = w * 0.5;
      const cy = h * 0.5;
      const targetPlanetR = Math.min(w, h) * 0.21;
      let camZoom = 1;
      let camOffsetY = 0;

      if (s.phase === 'transition_orbit') {
        const t = clamp(s.transitionTimer / s.transitionDuration, 0, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        camZoom = lerp(2.2, 1.0, ease);
        camOffsetY = lerp(targetPlanetR * 1.15, 0, ease);
      }

      ctx.save();
      ctx.translate(cx, cy + camOffsetY);
      ctx.scale(camZoom, camZoom);
      ctx.translate(-cx, -cy);

      const planetR = targetPlanetR;

      // Atmosphere Halo
      const atmoGrad = ctx.createRadialGradient(cx, cy, planetR * 0.9, cx, cy, planetR * 1.38);
      atmoGrad.addColorStop(0, m.planetColors.atmosphere);
      atmoGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = atmoGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, planetR * 1.38, 0, Math.PI * 2);
      ctx.fill();

      // Planet Body
      const pGrad = ctx.createRadialGradient(
        cx - planetR * 0.35,
        cy - planetR * 0.35,
        planetR * 0.15,
        cx,
        cy,
        planetR,
      );
      pGrad.addColorStop(0, m.planetColors.highlight);
      pGrad.addColorStop(0.55, m.planetColors.base);
      pGrad.addColorStop(1, '#08101c');
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, planetR, 0, Math.PI * 2);
      ctx.fill();

      // Planet Custom Surface Details
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, planetR, 0, Math.PI * 2);
      ctx.clip();

      if (m.targetBody === 'earth') {
        // Lush emerald continents
        ctx.fillStyle = 'rgba(16, 185, 129, 0.58)';
        for (let i = 0; i < 5; i++) {
          const ang = s.planetRot + i * 1.3;
          const bx = cx + Math.cos(ang) * planetR * 0.5;
          const by = cy + Math.sin(ang) * planetR * 0.44;
          ctx.beginPath();
          ctx.ellipse(bx, by, planetR * 0.34, planetR * 0.2, ang, 0, Math.PI * 2);
          ctx.fill();
        }
        // Night-side shadow hemisphere + glowing amber city lights
        const nightGrad = ctx.createLinearGradient(cx - planetR, cy, cx + planetR, cy);
        nightGrad.addColorStop(0, 'rgba(2, 6, 23, 0)');
        nightGrad.addColorStop(0.58, 'rgba(2, 6, 23, 0.18)');
        nightGrad.addColorStop(1, 'rgba(2, 6, 23, 0.72)');
        ctx.fillStyle = nightGrad;
        ctx.fillRect(cx - planetR, cy - planetR, planetR * 2, planetR * 2);

        ctx.fillStyle = 'rgba(253, 224, 71, 0.85)';
        for (let c = 0; c < 18; c++) {
          const ca = s.planetRot * 0.8 + c * 0.42;
          const cityX = cx + planetR * 0.3 + Math.cos(ca) * planetR * 0.48;
          const cityY = cy + Math.sin(ca * 1.7) * planetR * 0.58;
          if (cityX > cx + planetR * 0.15) {
            ctx.fillRect(cityX, cityY, 2.2, 2.2);
          }
        }
        // Flowing cloud bands
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.22)';
        ctx.lineWidth = 4;
        for (let b = -2; b <= 2; b++) {
          ctx.beginPath();
          ctx.arc(cx + Math.cos(s.planetRot) * 18, cy + b * planetR * 0.26, planetR * 0.65, 0.2, 1.8);
          ctx.stroke();
        }
      } else if (m.targetBody === 'moon') {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.48)';
        for (let i = 0; i < 8; i++) {
          const ang = s.planetRot + i * 0.9;
          const bx = cx + Math.cos(ang) * planetR * (0.26 + (i % 3) * 0.22);
          const by = cy + Math.sin(ang) * planetR * (0.26 + ((i + 1) % 3) * 0.22);
          ctx.beginPath();
          ctx.arc(bx, by, planetR * (0.09 + (i % 2) * 0.07), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Mars canyon & white polar ice caps
        ctx.fillStyle = 'rgba(124, 45, 18, 0.65)';
        ctx.beginPath();
        ctx.ellipse(
          cx + Math.cos(s.planetRot) * planetR * 0.22,
          cy + Math.sin(s.planetRot) * planetR * 0.14,
          planetR * 0.58,
          planetR * 0.12,
          s.planetRot * 0.4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 250, 245, 0.9)';
        ctx.beginPath();
        ctx.arc(cx, cy - planetR * 0.92, planetR * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy + planetR * 0.94, planetR * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // LIVE PREDICTED ORBIT ELLIPSE WITH APOAPSIS (Ap) & PERIAPSIS (Pe) MARKERS
      const shipOrbitR = planetR + s.shipRadiusOffset;
      const eccBias = clamp((s.shipAngVel - 0.48) * 34, -22, 34);
      const semiMajorR = shipOrbitR + Math.abs(eccBias) * 0.5;
      const semiMinorR = Math.max(planetR + 40, shipOrbitR - Math.abs(eccBias) * 0.25);
      const apAngle = wrapAngleRad(s.shipAngle + Math.PI);
      const peAngle = s.shipAngle;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(s.shipAngle);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.ellipse(-eccBias * 0.5, 0, semiMajorR, semiMinorR, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      if (s.phase === 'orbit' || s.phase === 'beamdown') {
        const apR = shipOrbitR + Math.max(4, eccBias);
        const peR = Math.max(planetR + 42, shipOrbitR - Math.max(4, Math.abs(eccBias) * 0.5));
        const apX = cx + Math.cos(apAngle) * apR;
        const apY = cy + Math.sin(apAngle) * apR;
        const peX = cx + Math.cos(peAngle + 0.35) * peR;
        const peY = cy + Math.sin(peAngle + 0.35) * peR;

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(apX, apY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('Ap', apX + 6, apY + 3);

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(peX, peY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('Pe', peX + 6, peY + 3);
      }

      const shipX = cx + Math.cos(s.shipAngle) * shipOrbitR;
      const shipY = cy + Math.sin(s.shipAngle) * shipOrbitR;

      // Ground Dishes & Wide Cyan/Emerald Signal Cones
      m.stationAnglesDeg.forEach((deg) => {
        const dAng = wrapAngleRad(deg * DEG2RAD + s.planetRot);
        const dx = cx + Math.cos(dAng) * planetR;
        const dy = cy + Math.sin(dAng) * planetR;
        const shipInThisCone =
          Math.abs(shortestAngleDiffRad(s.shipAngle, dAng)) <= 30 * DEG2RAD;

        if (s.phase === 'beamdown' || s.phase === 'finale') {
          const coneR = planetR + 195;
          const coneSpan = 29 * DEG2RAD;
          const coneGrad = ctx.createRadialGradient(dx, dy, 8, dx, dy, coneR);
          coneGrad.addColorStop(
            0,
            shipInThisCone ? 'rgba(52, 211, 153, 0.48)' : 'rgba(34, 211, 238, 0.24)',
          );
          coneGrad.addColorStop(1, 'rgba(34, 211, 238, 0.02)');

          ctx.fillStyle = coneGrad;
          ctx.beginPath();
          ctx.moveTo(dx, dy);
          ctx.arc(cx, cy, coneR, dAng - coneSpan, dAng + coneSpan);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = shipInThisCone ? '#34d399' : 'rgba(56, 189, 248, 0.45)';
          ctx.lineWidth = shipInThisCone ? 2.5 : 1.4;
          ctx.beginPath();
          ctx.moveTo(dx, dy);
          ctx.lineTo(cx + Math.cos(dAng - coneSpan) * coneR, cy + Math.sin(dAng - coneSpan) * coneR);
          ctx.moveTo(dx, dy);
          ctx.lineTo(cx + Math.cos(dAng + coneSpan) * coneR, cy + Math.sin(dAng + coneSpan) * coneR);
          ctx.stroke();
        }

        // Dish icon
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(dAng + Math.PI / 2);
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(0, -6, 10, Math.PI * 0.15, Math.PI * 0.85);
        ctx.fill();
        ctx.strokeStyle = s.phase === 'beamdown' ? '#34d399' : '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(0, -14);
        ctx.stroke();
        ctx.restore();
      });

      // Landmarks (Swirling Hurricanes on Earth, Ice Craters on Mars)
      if (m.mechanicMode === 'scan' || s.phase === 'finale') {
        m.landmarks.forEach((lm) => {
          const lmAng = wrapAngleRad(lm.angleDeg * DEG2RAD + s.planetRot);
          const lmX = cx + Math.cos(lmAng) * (planetR - 4);
          const lmY = cy + Math.sin(lmAng) * (planetR - 4);
          const scanned = s.scannedLandmarkIds.has(lm.id);
          const isActiveTarget = s.activeScanLandmarkId === lm.id;

          // Animated Hurricane Spiral on Earth
          if (lm.iconType === 'hurricane') {
            ctx.save();
            ctx.translate(lmX, lmY);
            ctx.rotate(s.time * 2.8);
            ctx.strokeStyle = scanned ? 'rgba(167, 243, 208, 0.8)' : 'rgba(248, 250, 252, 0.9)';
            ctx.lineWidth = 2;
            for (let arm = 0; arm < 2; arm++) {
              ctx.rotate(Math.PI);
              ctx.beginPath();
              ctx.arc(4, 0, 8, 0, Math.PI * 1.1);
              ctx.stroke();
            }
            ctx.restore();
          }

          if (!scanned && s.phase === 'orbit') {
            const pulseR = 15 + Math.sin(s.time * 5) * 4;
            ctx.strokeStyle = isActiveTarget ? '#22d3ee' : '#fbbf24';
            ctx.lineWidth = isActiveTarget ? 3 : 2;
            ctx.beginPath();
            ctx.arc(lmX, lmY, pulseR, 0, Math.PI * 2);
            ctx.stroke();

            const markerX = cx + Math.cos(lmAng) * (planetR + 95);
            const markerY = cy + Math.sin(lmAng) * (planetR + 95);
            ctx.strokeStyle = isActiveTarget
              ? 'rgba(34, 211, 238, 0.5)'
              : 'rgba(251, 191, 36, 0.22)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(lmX, lmY);
            ctx.lineTo(markerX, markerY);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          ctx.fillStyle = scanned ? '#34d399' : isActiveTarget ? '#22d3ee' : '#fbbf24';
          ctx.beginPath();
          ctx.arc(lmX, lmY, scanned ? 5.5 : 6.5, 0, Math.PI * 2);
          ctx.fill();

          // Crisp Laser Scan Lines + Circular Progress Ring
          if (isActiveTarget && s.scanProgress > 0 && !scanned) {
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 4.5;
            ctx.beginPath();
            ctx.arc(
              lmX,
              lmY,
              22,
              -Math.PI / 2,
              -Math.PI / 2 + Math.PI * 2 * s.scanProgress,
            );
            ctx.stroke();

            // Sweeping laser scan fan
            const sweepAngle = Math.sin(s.time * 16) * 0.14;
            const lxEnd = lmX + Math.cos(lmAng + Math.PI / 2 + sweepAngle) * 14;
            const lyEnd = lmY + Math.sin(lmAng + Math.PI / 2 + sweepAngle) * 14;
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(shipX, shipY);
            ctx.lineTo(lmX, lmY);
            ctx.stroke();

            ctx.strokeStyle = '#ecfeff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(shipX, shipY);
            ctx.lineTo(lxEnd, lyEnd);
            ctx.stroke();
          }

          const lx = cx + Math.cos(lmAng) * (planetR + 22);
          const ly = cy + Math.sin(lmAng) * (planetR + 22);
          ctx.fillStyle = scanned ? '#a7f3d0' : '#fef08a';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = Math.cos(lmAng) >= 0 ? 'left' : 'right';
          ctx.fillText(lm.name, lx, ly);
          ctx.textAlign = 'left';
        });
      }

      // Moon Mode: Spinning Damaged Gateway Supply Module + CSA Canadarm Grapple
      if (m.mechanicMode === 'canadarm' && s.phase === 'orbit' && !s.podDocked) {
        const podR = planetR + s.podRadiusOffset + Math.sin(s.time * 1.4) * 8;
        const podX = cx + Math.cos(s.podAngle) * podR;
        const podY = cy + Math.sin(s.podAngle) * podR;
        const distToPod = Math.hypot(shipX - podX, shipY - podY);
        const inRange = distToPod <= 132;

        ctx.strokeStyle = inRange ? 'rgba(52, 211, 153, 0.78)' : 'rgba(251, 191, 36, 0.45)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.arc(podX, podY, 46, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (inRange && (inp.action || s.grappleProgress > 0.02)) {
          const midX = (shipX + podX) * 0.5 + Math.cos(s.shipAngle) * 18;
          const midY = (shipY + podY) * 0.5 + Math.sin(s.shipAngle) * 18;
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(shipX, shipY);
          ctx.lineTo(midX, midY);
          ctx.lineTo(podX, podY);
          ctx.stroke();

          ctx.strokeStyle = '#fb923c';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(podX, podY, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.grappleProgress);
          ctx.stroke();
        }

        ctx.save();
        ctx.translate(podX, podY);
        ctx.rotate(s.podSpin);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-24, -4, 48, 8);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-10, -10, 20, 20);
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-10, -10, 20, 20);
        ctx.restore();

        ctx.fillStyle = inRange ? '#34d399' : '#fde047';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(inRange ? 'HOLD [SPACE] GRAPPLE!' : 'GATEWAY POD', podX, podY - 26);
        ctx.textAlign = 'left';
      }

      // Phase 3: Vibrant Undulating Laser Beam from Ship -> Nearest Ground Dish
      const activeDishRad = s.activeDishAngleDeg * DEG2RAD;
      const activeDishX = cx + Math.cos(activeDishRad) * planetR;
      const activeDishY = cy + Math.sin(activeDishRad) * planetR;

      if (s.phase === 'beamdown' && s.beamActive) {
        // Outer glow
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(shipX, shipY);
        ctx.lineTo(activeDishX, activeDishY);
        ctx.stroke();

        // Undulating sine-wave core
        ctx.strokeStyle = '#ecfeff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const segs = 16;
        const bdx = activeDishX - shipX;
        const bdy = activeDishY - shipY;
        const bLen = Math.max(1, Math.hypot(bdx, bdy));
        const nx = -bdy / bLen;
        const ny = bdx / bLen;
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          const wave = Math.sin(t * Math.PI * 4 - s.time * 24) * 4 * Math.sin(t * Math.PI);
          const px = shipX + bdx * t + nx * wave;
          const py = shipY + bdy * t + ny * wave;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Render Collected Data Orbs
      s.orbs.forEach((orb) => {
        if (orb.state === 'delivered') return;
        let ox = shipX;
        let oy = shipY;
        if (orb.state === 'on-ship') {
          ox = shipX + Math.cos(orb.orbitAngle) * 29;
          oy = shipY + Math.sin(orb.orbitAngle) * 29;
        } else if (orb.state === 'beaming') {
          ox = lerp(orb.sourceX, activeDishX, orb.beamProgress);
          oy = lerp(orb.sourceY, activeDishY, orb.beamProgress);
        }

        ctx.fillStyle = orb.color;
        ctx.beginPath();
        ctx.arc(ox, oy, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Debris Threat
      if (s.debris.active) {
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.58)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(s.debris.startX, s.debris.startY);
        ctx.lineTo(s.debris.endX, s.debris.endY);
        ctx.stroke();
        ctx.setLineDash([]);

        if (s.debris.warningTimer <= 0) {
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(s.debris.x, s.debris.y, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fecdd3';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Solar Radiation Wave
      if (s.solarWave.active) {
        if (s.solarWave.warningTimer > 0) {
          ctx.fillStyle = 'rgba(251, 146, 60, 0.2)';
          ctx.fillRect(0, 0, 72, h);
        } else {
          const wx = s.solarWave.waveX * w;
          const waveGrad = ctx.createLinearGradient(wx - 48, 0, wx + 48, 0);
          waveGrad.addColorStop(0, 'rgba(251, 146, 60, 0)');
          waveGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.78)');
          waveGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
          ctx.fillStyle = waveGrad;
          ctx.fillRect(wx - 48, 0, 96, h);
        }
      }

      // Particles
      s.particles.forEach((p) => {
        ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Directional Curved Energy Shield facing Sun (Left Edge) in World Space around Ship
      if (inp.shield && s.phase === 'orbit') {
        ctx.save();
        ctx.translate(shipX, shipY);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 34, Math.PI * 0.62, Math.PI * 1.38);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(103, 232, 249, 0.45)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 34, Math.PI * 0.68, Math.PI * 1.32);
        ctx.stroke();
        ctx.restore();
      }

      // Draw Player's Exact Orbital Spacecraft (nose aligned prograde)
      ctx.save();
      ctx.translate(shipX, shipY);
      const radialPitch = clamp(s.shipRadVel * 0.0032, -0.34, 0.34);
      ctx.rotate(s.shipAngle + Math.PI - radialPitch);

      const wingScale =
        s.phase === 'transition_orbit'
          ? clamp(s.transitionTimer / s.transitionDuration, 0.1, 1)
          : 1;
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 1.2;
      ctx.fillRect(-10 - 20 * wingScale, -4, 20 * wingScale, 8);
      ctx.strokeRect(-10 - 20 * wingScale, -4, 20 * wingScale, 8);
      ctx.fillRect(10, -4, 20 * wingScale, 8);
      ctx.strokeRect(10, -4, 20 * wingScale, 8);

      if ((s.phase === 'orbit' || s.phase === 'beamdown') && (inp.left || inp.right || inp.up || inp.down)) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-5, 11);
        ctx.lineTo(5, 11);
        ctx.lineTo(0, 22 + Math.random() * 8);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-7, -10, 14, 20);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-7, 2, 14, 4);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-7, -10);
      ctx.lineTo(0, -21);
      ctx.lineTo(7, -10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(0, -3, 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      ctx.restore();
      ctx.restore();
    };

    const tick = (nowMs: number) => {
      const frameDt = Math.min(0.05, Math.max(0, (nowMs - lastTimeMs) / 1000));
      lastTimeMs = nowMs;
      accumulator += frameDt;

      while (accumulator >= FIXED_DT) {
        stepPhysics(FIXED_DT);
        accumulator -= FIXED_DT;
      }

      renderScene();

      uiSyncTimer += frameDt;
      if (uiSyncTimer >= 0.066) {
        uiSyncTimer = 0;
        const s = simRef.current;
        const m = s.mission;

        let inDishCone = false;
        m.stationAnglesDeg.forEach((deg) => {
          const ang = wrapAngleRad(deg * DEG2RAD + s.planetRot);
          if (Math.abs(shortestAngleDiffRad(s.shipAngle, ang)) <= 30 * DEG2RAD) {
            inDishCone = true;
          }
        });

        const activeThreat: 'none' | 'debris' | 'solar-wave' = s.debris.active
          ? 'debris'
          : s.solarWave.active
            ? 'solar-wave'
            : 'none';
        const orbsCollected = s.orbs.length;
        const orbsBeamed = s.orbs.filter((o) => o.state === 'delivered').length;
        const starsEarned: 1 | 2 | 3 =
          s.hullPct >= 75 && s.fuelPct >= 30 && s.elapsedMissionSec <= 125
            ? 3
            : s.hullPct >= 50 || s.fuelPct >= 15
              ? 2
              : 1;

        let actionHint = '';
        if (s.phase === 'launch') {
          actionHint =
            s.launchAlt >= 0.82
              ? 'ORBIT RING REACHED! Press [SPACE] to Cut Engine!'
              : 'Steer with A / D (or drag) through Gold Rings!';
        } else if (s.phase === 'transition_orbit') {
          actionHint = `Entering ${m.planetName} Orbit!`;
        } else if (s.phase === 'orbit') {
          if (activeThreat === 'debris') {
            actionHint = 'INCOMING DEBRIS! Boost Up/Down or Left/Right to Dodge!';
          } else if (activeThreat === 'solar-wave') {
            actionHint = 'SOLAR WAVE! Hold [SHIFT] or SHIELD Button!';
          } else if (m.mechanicMode === 'canadarm') {
            actionHint = 'Fly near the Spinning Pod & Hold [SPACE] to Grapple!';
          } else if (s.activeScanLandmarkId) {
            actionHint = 'Target Locked! Hold [SPACE] to Scan!';
          } else {
            actionHint = `Fly over glowing targets & Hold [SPACE] to Scan (${orbsCollected}/${m.orbCount})`;
          }
        } else if (s.phase === 'beamdown') {
          actionHint = inDishCone
            ? 'IN SIGNAL CONE! Hold [SPACE] to Beam Orbs Down!'
            : `Fly into a Cyan Signal Cone to Beam Data (${orbsBeamed}/${m.orbCount})`;
        } else if (s.phase === 'finale') {
          actionHint = 'Mission Accomplished!';
        }

        const nextSnapshot: UnifiedGameSnapshot = {
          missionId: m.id,
          phase: s.phase,
          fuelPct: Math.round(s.fuelPct),
          hullPct: Math.round(s.hullPct),
          orbsCollected,
          orbsBeamed,
          orbGoal: m.orbCount,
          activeThreat,
          starsEarned,
        };
        snapshotCbRef.current?.(nextSnapshot);

        setUiState({
          phase: s.phase,
          fuelPct: Math.round(s.fuelPct),
          hullPct: Math.round(s.hullPct),
          orbsCollected,
          orbsBeamed,
          orbGoal: m.orbCount,
          ringsHit: s.ringsHit,
          threatsCleared: s.threatsCleared,
          activeThreat,
          inTargetZone: Boolean(s.activeScanLandmarkId),
          inDishCone,
          shieldActive: inputRef.current.shield,
          scanPct: Math.round(s.scanProgress * 100),
          grapplePct: Math.round(s.grappleProgress * 100),
          launchAltPct: Math.min(100, Math.round(s.launchAlt * 100)),
          launchInOrbitRing: s.launchAlt >= 0.82 && s.launchAlt <= 1.01,
          elapsedSec: s.elapsedMissionSec,
          score: s.score,
          starsEarned,
          actionHint,
        });
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [spawnBurst]);

  const handleCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>, active: boolean) => {
    inputRef.current.pointerSteerActive = active;
    if (!active) return;
    const rect = e.currentTarget.getBoundingClientRect();
    inputRef.current.pointerNormX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
  };

  const handlePlayNextMission = () => {
    const idx = UNIFIED_MISSIONS.findIndex((m) => m.id === mission.id);
    const next = UNIFIED_MISSIONS[(idx + 1) % UNIFIED_MISSIONS.length];
    setSelectedMissionId(next.id);
    startMission(next);
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden select-none bg-[#020617]">
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          handleCanvasPointer(e, true);
        }}
        onPointerMove={(e) => {
          if (inputRef.current.pointerSteerActive) handleCanvasPointer(e, true);
        }}
        onPointerUp={() => {
          inputRef.current.pointerSteerActive = false;
        }}
        onPointerCancel={() => {
          inputRef.current.pointerSteerActive = false;
        }}
        className="block h-full w-full touch-none"
      />

      {/* TOP 3 ULTRA-CLEAN ICON BARS (Fuel, Hull Shield, Mission Progress + Timer) */}
      {uiState.phase !== 'briefing' && uiState.phase !== 'finale' && (
        <div className="pointer-events-none absolute top-3 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3">
          <div className="pointer-events-auto flex items-center gap-4 border border-slate-700/80 bg-slate-950/85 px-3.5 py-2 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Fuel className={`h-4 w-4 ${uiState.fuelPct < 25 ? 'text-rose-400' : 'text-amber-300'}`} />
              <div className="w-24">
                <div className="flex justify-between text-[10px] font-bold text-slate-300">
                  <span>FUEL</span>
                  <span className="tabular-nums">{uiState.fuelPct}%</span>
                </div>
                <div className="mt-0.5 h-2 w-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      uiState.fuelPct < 25 ? 'bg-rose-500' : 'bg-amber-400'
                    }`}
                    style={{ width: `${uiState.fuelPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-800" />

            <div className="flex items-center gap-2">
              <Shield className={`h-4 w-4 ${uiState.hullPct < 55 ? 'text-rose-400' : 'text-emerald-400'}`} />
              <div className="w-20">
                <div className="flex justify-between text-[10px] font-bold text-slate-300">
                  <span>SHIELD</span>
                  <span className="tabular-nums">{uiState.hullPct}%</span>
                </div>
                <div className="mt-0.5 h-2 w-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      uiState.hullPct < 55 ? 'bg-rose-500' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${uiState.hullPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Crisp Contextual Signifier */}
          <div
            className={`px-4 py-2 text-xs font-bold border backdrop-blur-md ${
              uiState.activeThreat !== 'none'
                ? 'border-rose-400 bg-rose-950/90 text-rose-100'
                : uiState.launchInOrbitRing || uiState.inDishCone || uiState.inTargetZone
                  ? 'border-emerald-400 bg-emerald-950/90 text-emerald-200'
                  : 'border-slate-700/80 bg-slate-950/85 text-cyan-200'
            }`}
          >
            {uiState.actionHint}
          </div>

          {/* Mission Progress Bar + Timer */}
          <div className="pointer-events-auto flex items-center gap-3 border border-slate-700/80 bg-slate-950/85 px-3.5 py-2 backdrop-blur-md">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 mr-1">
                {uiState.phase === 'beamdown' ? 'BEAMED' : 'ORBS'}
              </span>
              {Array.from({ length: uiState.orbGoal }, (_, i) => {
                const count = uiState.phase === 'beamdown' ? uiState.orbsBeamed : uiState.orbsCollected;
                const filled = i < count;
                return (
                  <span
                    key={i}
                    className={`h-3.5 w-3.5 rounded-full border ${
                      filled
                        ? 'border-cyan-200 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.85)]'
                        : 'border-slate-600 bg-slate-900'
                    }`}
                  />
                );
              })}
            </div>
            <div className="h-5 w-px bg-slate-800" />
            <span className="flex items-center gap-1 font-mono-tab text-xs font-bold text-slate-200 tabular-nums">
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
              {formatTimer(uiState.elapsedSec)}
            </span>
          </div>
        </div>
      )}

      {/* MISSION SELECT OVERLAY */}
      {uiState.phase === 'briefing' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4 md:p-8 bg-slate-950/45 backdrop-blur-[2px]">
          <div className="w-full max-w-5xl space-y-5">
            <div className="text-center space-y-1">
              <div className="text-xs font-bold tracking-wider text-cyan-300 uppercase">
                Select Your Connected Space Mission
              </div>
              <h2 className="font-display text-2xl md:text-4xl font-bold text-white">
                One Ship · One Fuel Tank · Start to Finish
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {UNIFIED_MISSIONS.map((m) => {
                const active = m.id === selectedMissionId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      audioSynth.playSelect();
                      setSelectedMissionId(m.id);
                      simRef.current.mission = m;
                    }}
                    className={`text-left border p-5 transition-all cursor-pointer flex flex-col justify-between bg-[#080f1e]/92 ${
                      active
                        ? 'border-cyan-400 ring-2 ring-cyan-400/40 shadow-2xl scale-[1.01]'
                        : 'border-slate-700/80 hover:border-slate-500'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-cyan-300">{m.tag}</div>
                      <h3 className="mt-1 font-display text-xl font-bold text-white">{m.title}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">{m.subtitle}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        {m.mechanicMode === 'canadarm' ? 'CSA Canadarm3' : `${m.orbCount} Scans`}
                      </span>
                      <span className="font-bold text-amber-300">{m.threatLabel}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => startMission(mission)}
                className="flex items-center gap-2.5 bg-amber-400 px-8 py-3.5 font-display text-base font-bold text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer shadow-xl"
              >
                <Play className="h-5 w-5 fill-slate-950" />
                <span>LAUNCH: {mission.title}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM SLEEK ACTION BAR — LAUNCH */}
      {uiState.phase === 'launch' && (
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between gap-3">
          <div className="pointer-events-auto flex items-center gap-2 border border-slate-700/80 bg-slate-950/85 p-2 backdrop-blur-md">
            <button
              type="button"
              onPointerDown={() => {
                inputRef.current.left = true;
              }}
              onPointerUp={() => {
                inputRef.current.left = false;
              }}
              onPointerLeave={() => {
                inputRef.current.left = false;
              }}
              className="h-10 w-10 flex items-center justify-center border border-slate-700 bg-slate-900 text-white active:bg-cyan-500 active:text-slate-950 cursor-pointer"
              aria-label="Steer Left"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onPointerDown={() => {
                inputRef.current.up = true;
              }}
              onPointerUp={() => {
                inputRef.current.up = false;
              }}
              onPointerLeave={() => {
                inputRef.current.up = false;
              }}
              className="h-10 px-3 flex items-center gap-1 border border-amber-500/50 bg-amber-950/40 text-xs font-bold text-amber-300 active:bg-amber-400 active:text-slate-950 cursor-pointer"
            >
              <Zap className="h-4 w-4" />
              <span>TURBO [W]</span>
            </button>
            <button
              type="button"
              onPointerDown={() => {
                inputRef.current.right = true;
              }}
              onPointerUp={() => {
                inputRef.current.right = false;
              }}
              onPointerLeave={() => {
                inputRef.current.right = false;
              }}
              className="h-10 w-10 flex items-center justify-center border border-slate-700 bg-slate-900 text-white active:bg-cyan-500 active:text-slate-950 cursor-pointer"
              aria-label="Steer Right"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          <button
            type="button"
            onPointerDown={() => {
              inputRef.current.action = true;
            }}
            onPointerUp={() => {
              inputRef.current.action = false;
            }}
            onPointerLeave={() => {
              inputRef.current.action = false;
            }}
            className={`pointer-events-auto px-6 py-3 font-display text-sm font-bold transition-all cursor-pointer ${
              uiState.launchInOrbitRing
                ? 'bg-emerald-400 text-slate-950 shadow-[0_0_24px_rgba(52,211,153,0.75)] scale-105'
                : 'border border-slate-700 bg-slate-950/90 text-slate-300'
            }`}
          >
            {uiState.launchInOrbitRing
              ? 'CUT ENGINE [SPACE]!'
              : `CLIMBING TO ORBIT (${uiState.launchAltPct}%)`}
          </button>

          <div className="hidden md:block text-xs text-slate-300 border border-slate-800 bg-slate-950/80 px-3 py-2">
            Steer: A / D · Turbo: W · Orbit Cutoff: SPACE
          </div>
        </div>
      )}

      {/* BOTTOM SLEEK ACTION BAR — ORBIT & BEAM-DOWN */}
      {(uiState.phase === 'orbit' || uiState.phase === 'beamdown') && (
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3">
          <div className="pointer-events-auto flex items-center gap-1.5 border border-slate-700/80 bg-slate-950/85 p-1.5 backdrop-blur-md">
            <button
              type="button"
              onPointerDown={() => {
                inputRef.current.left = true;
              }}
              onPointerUp={() => {
                inputRef.current.left = false;
              }}
              onPointerLeave={() => {
                inputRef.current.left = false;
              }}
              title="Slow Down Orbit (A)"
              className="h-10 px-2.5 flex items-center gap-1 border border-slate-700 bg-slate-900 text-xs font-bold text-slate-200 active:bg-cyan-400 active:text-slate-950 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Slow</span>
            </button>
            <button
              type="button"
              onPointerDown={() => {
                inputRef.current.up = true;
              }}
              onPointerUp={() => {
                inputRef.current.up = false;
              }}
              onPointerLeave={() => {
                inputRef.current.up = false;
              }}
              title="Raise Altitude (W)"
              className="h-10 px-2.5 flex items-center gap-1 border border-slate-700 bg-slate-900 text-xs font-bold text-slate-200 active:bg-cyan-400 active:text-slate-950 cursor-pointer"
            >
              <ArrowUp className="h-4 w-4" />
              <span className="hidden sm:inline">High</span>
            </button>
            <button
              type="button"
              onPointerDown={() => {
                inputRef.current.down = true;
              }}
              onPointerUp={() => {
                inputRef.current.down = false;
              }}
              onPointerLeave={() => {
                inputRef.current.down = false;
              }}
              title="Lower Altitude (S)"
              className="h-10 px-2.5 flex items-center gap-1 border border-slate-700 bg-slate-900 text-xs font-bold text-slate-200 active:bg-cyan-400 active:text-slate-950 cursor-pointer"
            >
              <ArrowDown className="h-4 w-4" />
              <span className="hidden sm:inline">Low</span>
            </button>
            <button
              type="button"
              onPointerDown={() => {
                inputRef.current.right = true;
              }}
              onPointerUp={() => {
                inputRef.current.right = false;
              }}
              onPointerLeave={() => {
                inputRef.current.right = false;
              }}
              title="Speed Up Orbit (D)"
              className="h-10 px-2.5 flex items-center gap-1 border border-slate-700 bg-slate-900 text-xs font-bold text-slate-200 active:bg-cyan-400 active:text-slate-950 cursor-pointer"
            >
              <span className="hidden sm:inline">Fast</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {mission.threatType === 'solar-wave' && uiState.phase === 'orbit' && (
              <button
                type="button"
                onPointerDown={() => {
                  inputRef.current.shield = true;
                }}
                onPointerUp={() => {
                  inputRef.current.shield = false;
                }}
                onPointerLeave={() => {
                  inputRef.current.shield = false;
                }}
                className={`px-4 py-3 font-display text-xs font-bold border cursor-pointer flex items-center gap-1.5 ${
                  uiState.activeThreat === 'solar-wave'
                    ? 'border-amber-300 bg-amber-400 text-slate-950'
                    : 'border-cyan-500/50 bg-cyan-950/60 text-cyan-200'
                }`}
              >
                <Shield className="h-4 w-4" />
                <span>HOLD [SHIFT] SHIELD</span>
              </button>
            )}

            <button
              type="button"
              onPointerDown={() => {
                inputRef.current.action = true;
              }}
              onPointerUp={() => {
                inputRef.current.action = false;
              }}
              onPointerLeave={() => {
                inputRef.current.action = false;
              }}
              className={`px-6 py-3 font-display text-sm font-bold cursor-pointer flex items-center gap-2 transition-all ${
                uiState.phase === 'beamdown'
                  ? uiState.inDishCone
                    ? 'bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.65)]'
                    : 'border border-slate-700 bg-slate-950/90 text-slate-300'
                  : mission.mechanicMode === 'canadarm'
                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                    : uiState.inTargetZone
                      ? 'bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.65)]'
                      : 'border border-slate-700 bg-slate-950/90 text-slate-300'
              }`}
            >
              {uiState.phase === 'beamdown' ? (
                <>
                  <Radio className="h-4 w-4" />
                  <span>HOLD [SPACE]: BEAM DATA ({uiState.orbsBeamed}/{uiState.orbGoal})</span>
                </>
              ) : mission.mechanicMode === 'canadarm' ? (
                <>
                  <Wrench className="h-4 w-4" />
                  <span>
                    HOLD [SPACE]: GRAPPLE{' '}
                    {uiState.grapplePct > 0 ? `(${uiState.grapplePct}%)` : ''}
                  </span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  <span>
                    HOLD [SPACE]: SCAN{' '}
                    {uiState.scanPct > 0 ? `(${uiState.scanPct}%)` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* PHASE 4: MISSION ACCOMPLISHED FINALE */}
      {uiState.phase === 'finale' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-4xl border border-cyan-500/45 bg-[#081123]/95 p-5 md:p-6 shadow-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <Trophy className="h-4 w-4" />
                  <span>MISSION ACCOMPLISHED · {mission.badgeTitle.toUpperCase()}</span>
                </div>
                <h2 className="mt-1 font-display text-2xl md:text-3xl font-bold text-white">
                  {mission.title}
                </h2>
              </div>

              <div className="flex flex-col items-center border border-amber-400/40 bg-slate-950/80 px-4 py-2">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3].map((n) => (
                    <Star
                      key={n}
                      className={`h-7 w-7 ${
                        n <= uiState.starsEarned
                          ? 'fill-amber-400 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                          : 'text-slate-700'
                      }`}
                    />
                  ))}
                </div>
                <span className="mt-1 text-xs font-bold text-amber-300">
                  {uiState.starsEarned} / 3 Stars · {uiState.score} pts
                </span>
              </div>
            </div>

            {/* Planetary Map + Fuel / Hull / Time Strip */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
              <div className="md:col-span-4 border border-slate-800 bg-slate-900/75 p-3 flex items-center gap-3">
                <svg viewBox="0 0 90 90" className="h-16 w-16 shrink-0" aria-hidden="true">
                  <circle cx="45" cy="45" r="39" fill="none" stroke="rgba(56,189,248,0.28)" strokeDasharray="4 4" strokeWidth="1.5" />
                  <circle cx="45" cy="45" r="28" fill={mission.planetColors.base} stroke={mission.planetColors.highlight} strokeWidth="2" />
                  {mission.landmarks.map((lm) => {
                    const rad = (lm.angleDeg * Math.PI) / 180;
                    return (
                      <circle
                        key={lm.id}
                        cx={45 + Math.cos(rad) * 26}
                        cy={45 + Math.sin(rad) * 26}
                        r="4"
                        fill="#34d399"
                        stroke="#ffffff"
                        strokeWidth="1"
                      />
                    );
                  })}
                  {mission.stationAnglesDeg.map((deg, idx) => (
                    <circle
                      key={idx}
                      cx={45 + Math.cos((deg * Math.PI) / 180) * 28}
                      cy={45 + Math.sin((deg * Math.PI) / 180) * 28}
                      r="3.5"
                      fill="#fbbf24"
                    />
                  ))}
                </svg>
                <div className="text-xs">
                  <div className="font-bold text-white">{mission.planetName} Surveyed</div>
                  <div className="text-emerald-300">{mission.orbCount} Discoveries Verified</div>
                  <div className="text-amber-300">{mission.stationName}</div>
                </div>
              </div>

              <div className="md:col-span-8 grid grid-cols-3 gap-2.5 text-center text-xs">
                <div className="border border-slate-800 bg-slate-900/70 p-2.5 flex flex-col justify-center">
                  <div className="text-slate-400">Fuel Remaining</div>
                  <strong className="text-amber-300 text-base tabular-nums">{uiState.fuelPct}%</strong>
                </div>
                <div className="border border-slate-800 bg-slate-900/70 p-2.5 flex flex-col justify-center">
                  <div className="text-slate-400">Hull Shield</div>
                  <strong className="text-emerald-300 text-base tabular-nums">{uiState.hullPct}%</strong>
                </div>
                <div className="border border-slate-800 bg-slate-900/70 p-2.5 flex flex-col justify-center">
                  <div className="text-slate-400">Mission Time</div>
                  <strong className="text-cyan-300 text-base tabular-nums">
                    {formatTimer(uiState.elapsedSec)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Illustrated Discovery Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {mission.landmarks.map((lm) => (
                <div
                  key={lm.id}
                  className="border border-emerald-500/40 bg-slate-900/85 overflow-hidden flex flex-col"
                >
                  <div className="relative h-28 w-full bg-slate-950">
                    <img
                      src={lm.image}
                      alt={lm.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                    <div className="absolute top-2 right-2 bg-emerald-400 px-2 py-0.5 text-[10px] font-bold text-slate-950 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> UNLOCKED
                    </div>
                    <div className="absolute bottom-2 left-2.5 right-2.5 font-display text-sm font-bold text-white">
                      {lm.name}
                    </div>
                  </div>
                  <p className="p-3 text-xs text-slate-200 leading-relaxed">{lm.fact}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => startMission(mission)}
                className="flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Replay Mission</span>
              </button>

              <button
                type="button"
                onClick={handlePlayNextMission}
                className="flex items-center gap-2 bg-cyan-400 px-6 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-cyan-300 cursor-pointer"
              >
                <span>Next Mission</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
