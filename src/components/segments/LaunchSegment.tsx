import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Flame,
  Gauge,
  RotateCcw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { audioSynth } from '../../audio/synth';
import {
  NASA_ROCKETS,
  calculateTargetDeltaV,
  type NasaRocketSpec,
} from '../../engine/orbitalMechanics';
import type {
  ArchitectMode,
  LaunchBurnState,
  NasaInstrument,
  NasaObjectiveSpec,
  PropulsionType,
} from '../../types/nasaSegments';

interface LaunchSegmentProps {
  architectMode: ArchitectMode;
  selectedObjective: NasaObjectiveSpec;
  selectedRocket: NasaRocketSpec;
  onSelectRocket: (rocket: NasaRocketSpec) => void;
  selectedPropulsion: PropulsionType;
  propellantBudgetKg: number;
  instruments: NasaInstrument[];
  burnState: LaunchBurnState;
  onUpdateBurnState: (burn: LaunchBurnState) => void;
  onProceedToSpace: () => void;
  onPrevSegment: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface FuelRing {
  id: number;
  progressY: number; // 0 (pad) -> 1 (space)
  laneX: number; // -1..1
  collected: boolean;
}

interface WindCloud {
  id: number;
  progressY: number;
  laneX: number;
  hitCooldown: number;
}

const ROCKET_NICKNAMES: Record<string, { label: string; powerText: string }> = {
  'vega-c': { label: 'Swift Scout Rocket', powerText: 'Light & Nimble' },
  'falcon-9': { label: 'Falcon Twin-Stage', powerText: 'Balanced All-Rounder' },
  'vulcan-centaur': { label: 'Vulcan Heavy Booster', powerText: 'Deep-Space Muscle' },
  'sls-block1': { label: 'Mega Moon Rocket', powerText: 'Maximum Lift Power' },
};

export function LaunchSegment({
  architectMode,
  selectedObjective,
  selectedRocket,
  onSelectRocket,
  propellantBudgetKg,
  instruments,
  burnState,
  onUpdateBurnState,
  onProceedToSpace,
  onPrevSegment,
}: LaunchSegmentProps) {
  const totalPayloadMassKg =
    instruments.reduce((sum, inst) => sum + (inst.enabled ? inst.massKg : 0), 0) +
    420 +
    propellantBudgetKg;
  const isPayloadTooHeavy = architectMode !== 'sandbox' && totalPayloadMassKg > selectedRocket.maxPayloadKg;

  const targetDeltaVKms = calculateTargetDeltaV(
    selectedObjective.targetBody,
    selectedObjective.targetAltitudeKm,
    selectedObjective.regime,
  );

  // Arcade Game State
  const [phase, setPhase] = useState<'pad' | 'flying' | 'deployed' | 'crashed'>('pad');
  const [altitudePct, setAltitudePct] = useState(0); // 0 -> 100
  const [fuelPct, setFuelPct] = useState(100);
  const [hullSafetyPct, setHullSafetyPct] = useState(100);
  const [ringsCollected, setRingsCollected] = useState(0);
  const [score, setScore] = useState(0);
  const [isBoosting, setIsBoosting] = useState(false);
  const [bannerHint, setBannerHint] = useState('HOLD BOOST & STEER INTO THE GREEN CORRIDOR!');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef({
    phase: 'pad' as 'pad' | 'flying' | 'deployed' | 'crashed',
    rocketX: 0, // -1 .. 1 around corridor center
    rocketVx: 0,
    altitude: 0, // 0 .. 115
    speed: 0, // 0 .. 1
    fuel: 100,
    hull: 100,
    ringsCollected: 0,
    score: 0,
    boosting: false,
    steerLeft: false,
    steerRight: false,
    pointerTargetX: null as number | null,
    shakeFrames: 0,
    particles: [] as Particle[],
    rings: [
      { id: 1, progressY: 16, laneX: 0.12, collected: false },
      { id: 2, progressY: 33, laneX: -0.22, collected: false },
      { id: 3, progressY: 50, laneX: 0.28, collected: false },
      { id: 4, progressY: 67, laneX: -0.1, collected: false },
      { id: 5, progressY: 82, laneX: 0.18, collected: false },
    ] as FuelRing[],
    clouds: [
      { id: 1, progressY: 26, laneX: -0.35, hitCooldown: 0 },
      { id: 2, progressY: 44, laneX: 0.42, hitCooldown: 0 },
      { id: 3, progressY: 61, laneX: -0.45, hitCooldown: 0 },
    ] as WindCloud[],
    stars: Array.from({ length: 65 }, (_, i) => ({
      x: ((i * 97) % 100) / 100,
      y: ((i * 53) % 100) / 100,
      r: (i % 3) + 1,
    })),
  });

  // Reset pad helper
  const resetLaunchpad = useCallback(() => {
    audioSynth.playSelect();
    gameRef.current = {
      ...gameRef.current,
      phase: 'pad',
      rocketX: 0,
      rocketVx: 0,
      altitude: 0,
      speed: 0,
      fuel: 100,
      hull: 100,
      ringsCollected: 0,
      score: 0,
      boosting: false,
      pointerTargetX: null,
      shakeFrames: 0,
      particles: [],
      rings: [
        { id: 1, progressY: 16, laneX: 0.14, collected: false },
        { id: 2, progressY: 33, laneX: -0.22, collected: false },
        { id: 3, progressY: 50, laneX: 0.26, collected: false },
        { id: 4, progressY: 67, laneX: -0.12, collected: false },
        { id: 5, progressY: 82, laneX: 0.18, collected: false },
      ],
      clouds: [
        { id: 1, progressY: 26, laneX: -0.36, hitCooldown: 0 },
        { id: 2, progressY: 44, laneX: 0.42, hitCooldown: 0 },
        { id: 3, progressY: 61, laneX: -0.44, hitCooldown: 0 },
      ],
    };
    setPhase('pad');
    setAltitudePct(0);
    setFuelPct(100);
    setHullSafetyPct(100);
    setRingsCollected(0);
    setScore(0);
    setIsBoosting(false);
    setBannerHint('TAP LAUNCH TO IGNITE ROCKETS!');
    onUpdateBurnState({
      status: 'idle',
      throttlePct: 100,
      burnDurationSec: 0,
      targetDeltaVKms,
      deliveredDeltaVKms: 0,
      propellantUsedKg: 0,
      outcomeType: 'pending',
      outcomeSummary: 'Rocket ready on launchpad.',
    });
  }, [onUpdateBurnState, targetDeltaVKms]);

  const startLaunch = useCallback(() => {
    if (isPayloadTooHeavy) {
      audioSynth.playAlert();
      setBannerHint('ROCKET TOO SMALL FOR PAYLOAD! PICK A BIGGER ROCKET!');
      return;
    }
    audioSynth.playMountPart();
    gameRef.current.phase = 'flying';
    gameRef.current.boosting = true;
    gameRef.current.speed = 0.25;
    setPhase('flying');
    setIsBoosting(true);
    setBannerHint('STEER INTO GREEN CORRIDOR & GRAB GOLD RINGS!');
    onUpdateBurnState({
      status: 'burning',
      throttlePct: 100,
      burnDurationSec: 0,
      targetDeltaVKms,
      deliveredDeltaVKms: 0,
      propellantUsedKg: 0,
      outcomeType: 'pending',
      outcomeSummary: 'Liftoff! Keep rocket inside the glowing green flight corridor.',
    });
  }, [isPayloadTooHeavy, onUpdateBurnState, targetDeltaVKms]);

  const deploySatellite = useCallback(() => {
    const g = gameRef.current;
    if (g.phase !== 'flying') return;

    const inTargetZone = g.altitude >= 78 && g.altitude <= 104;
    if (inTargetZone) {
      audioSynth.playSuccess();
      g.phase = 'deployed';
      g.boosting = false;
      const finalScore = Math.min(100, Math.round(70 + g.ringsCollected * 6 + g.hull * 0.15));
      g.score += 300 + g.ringsCollected * 100;
      // Confetti burst!
      const confettiColors = ['#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#a855f7'];
      for (let i = 0; i < 55; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 5.5;
        g.particles.push({
          x: 0,
          y: 0,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 65,
          maxLife: 65,
          color: confettiColors[i % confettiColors.length],
          size: 4 + Math.random() * 4,
        });
      }
      setPhase('deployed');
      setIsBoosting(false);
      setScore(g.score);
      setBannerHint('ORBIT LOCKED! SATELLITE DEPLOYED WITH CONFETTI!');
      onUpdateBurnState({
        status: 'completed',
        throttlePct: 0,
        burnDurationSec: 28,
        targetDeltaVKms,
        deliveredDeltaVKms: targetDeltaVKms,
        propellantUsedKg: Math.round((1 - g.fuel / 100) * propellantBudgetKg),
        outcomeType: 'nominal',
        outcomeSummary: `Satellite deployed cleanly into orbit! Collected ${g.ringsCollected} gold rings.`,
        launchEfficiencyScore: finalScore,
      });
    } else if (g.altitude < 78) {
      audioSynth.playAlert();
      g.phase = 'crashed';
      g.boosting = false;
      setPhase('crashed');
      setIsBoosting(false);
      setBannerHint('DEPLOYED TOO EARLY! REACH THE GREEN ORBIT ZONE FIRST!');
      onUpdateBurnState({
        status: 'failed',
        throttlePct: 0,
        burnDurationSec: 15,
        targetDeltaVKms,
        deliveredDeltaVKms: Number((targetDeltaVKms * (g.altitude / 90)).toFixed(2)),
        propellantUsedKg: Math.round((1 - g.fuel / 100) * propellantBudgetKg),
        outcomeType: 'underburn',
        outcomeSummary: 'Cutoff happened too low before reaching space!',
        launchEfficiencyScore: 45,
      });
    }
  }, [onUpdateBurnState, propellantBudgetKg, targetDeltaVKms]);

  // Keyboard Controls
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const g = gameRef.current;
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        g.steerLeft = true;
        g.pointerTargetX = null;
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        g.steerRight = true;
        g.pointerTargetX = null;
      } else if (e.code === 'Space' || e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (g.phase === 'pad') startLaunch();
        else if (g.phase === 'flying') {
          if (g.altitude >= 78 && g.altitude <= 104) deploySatellite();
          else {
            g.boosting = true;
            setIsBoosting(true);
          }
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') g.steerLeft = false;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') g.steerRight = false;
      if (e.code === 'Space' || e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        if (g.phase === 'flying') {
          g.boosting = false;
          setIsBoosting(false);
        }
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [startLaunch, deploySatellite]);

  // 60FPS Arcade Launch Loop + Canvas Render
  useEffect(() => {
    let raf = 0;

    const tick = () => {
      const g = gameRef.current;
      const canvas = canvasRef.current;
      if (!canvas) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // Corridor curve function: gentle S-curve bending into orbit
      const corridorCenterX = (alt: number) => Math.sin(alt * 0.085) * 0.28;

      if (g.phase === 'flying') {
        // Horizontal steering
        if (g.steerLeft) g.rocketVx -= 0.008;
        if (g.steerRight) g.rocketVx += 0.008;
        if (g.pointerTargetX !== null) {
          g.rocketVx += (g.pointerTargetX - g.rocketX) * 0.09;
        }
        g.rocketVx *= 0.86;
        g.rocketX = Math.max(-0.92, Math.min(0.92, g.rocketX + g.rocketVx));

        // Vertical thrust & fuel burn
        if (g.boosting && g.fuel > 0) {
          g.speed = Math.min(0.42, g.speed + 0.018);
          g.fuel = Math.max(0, g.fuel - 0.18);
          // Flame particles
          for (let i = 0; i < 2; i++) {
            g.particles.push({
              x: g.rocketX * (w * 0.36) + (Math.random() - 0.5) * 8,
              y: 26,
              vx: (Math.random() - 0.5) * 1.4,
              vy: 2.5 + Math.random() * 2.5,
              life: 24,
              maxLife: 24,
              color: Math.random() > 0.4 ? '#fb923c' : '#fde047',
              size: 4 + Math.random() * 4,
            });
          }
        } else {
          g.speed = Math.max(0.05, g.speed * 0.96);
        }

        g.altitude += g.speed;

        // Check corridor alignment bonus
        const corrDist = Math.abs(g.rocketX - corridorCenterX(g.altitude));
        if (corrDist < 0.24) {
          g.score += 1;
        } else if (corrDist > 0.55) {
          g.hull = Math.max(0, g.hull - 0.08);
        }

        // Collect Gold Rings
        g.rings.forEach((ring) => {
          if (
            !ring.collected &&
            Math.abs(g.altitude - ring.progressY) < 4.5 &&
            Math.abs(g.rocketX - ring.laneX) < 0.24
          ) {
            ring.collected = true;
            g.ringsCollected += 1;
            g.score += 150;
            g.fuel = Math.min(100, g.fuel + 12);
            audioSynth.playSuccess();
            for (let k = 0; k < 14; k++) {
              const ang = (k / 14) * Math.PI * 2;
              g.particles.push({
                x: ring.laneX * (w * 0.36),
                y: 0,
                vx: Math.cos(ang) * 3.5,
                vy: Math.sin(ang) * 3.5,
                life: 28,
                maxLife: 28,
                color: '#fbbf24',
                size: 4,
              });
            }
          }
        });

        // Dodge Wind Shear Clouds
        g.clouds.forEach((c) => {
          if (c.hitCooldown > 0) c.hitCooldown -= 1;
          if (
            c.hitCooldown === 0 &&
            Math.abs(g.altitude - c.progressY) < 4 &&
            Math.abs(g.rocketX - c.laneX) < 0.22
          ) {
            c.hitCooldown = 30;
            g.hull = Math.max(0, g.hull - 18);
            g.shakeFrames = 14;
            audioSynth.playAlert();
          }
        });

        // Hint updates & failure/overshoot checks
        if (g.altitude >= 78 && g.altitude <= 104) {
          setBannerHint('GREEN TARGET ZONE! TAP "DEPLOY SATELLITE!" NOW!');
        } else if (g.altitude > 106) {
          g.phase = 'crashed';
          g.boosting = false;
          audioSynth.playAlert();
          setPhase('crashed');
          setIsBoosting(false);
          setBannerHint('OVERSHOT SPACE ORBIT! RESET PAD & DEPLOY INSIDE GREEN BAND!');
          onUpdateBurnState({
            status: 'failed',
            throttlePct: 0,
            burnDurationSec: 34,
            targetDeltaVKms,
            deliveredDeltaVKms: Number((targetDeltaVKms * 1.15).toFixed(2)),
            propellantUsedKg: Math.round((1 - g.fuel / 100) * propellantBudgetKg),
            outcomeType: 'overburn',
            outcomeSummary: 'Rocket flew past the Target Orbit Zone!',
            launchEfficiencyScore: 52,
          });
        } else if (g.hull <= 0 || (g.fuel <= 0 && g.altitude < 72)) {
          g.phase = 'crashed';
          g.boosting = false;
          audioSynth.playAlert();
          setPhase('crashed');
          setIsBoosting(false);
          setBannerHint(g.hull <= 0 ? 'TOO MUCH TURBULENCE! DODGE STORM CLOUDS!' : 'OUT OF FUEL! GRAB GOLD RINGS TO REFUEL!');
          onUpdateBurnState({
            status: 'failed',
            throttlePct: 0,
            burnDurationSec: 20,
            targetDeltaVKms,
            deliveredDeltaVKms: Number((targetDeltaVKms * 0.6).toFixed(2)),
            propellantUsedKg: propellantBudgetKg,
            outcomeType: 'underburn',
            outcomeSummary: g.hull <= 0 ? 'Wind shear shook the rocket off course.' : 'Fuel ran out before orbit!',
            launchEfficiencyScore: 40,
          });
        }

        // Sync React HUD state gently
        setAltitudePct(Math.min(100, Math.round(g.altitude)));
        setFuelPct(Math.round(g.fuel));
        setHullSafetyPct(Math.round(g.hull));
        setRingsCollected(g.ringsCollected);
        setScore(g.score);
      }

      // Update Particles
      g.particles = g.particles
        .map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          life: p.life - 1,
        }))
        .filter((p) => p.life > 0);

      // --- RENDER 60FPS ARCADE CANVAS ---
      ctx.save();
      if (g.shakeFrames > 0) {
        g.shakeFrames -= 1;
        ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
      }

      // Sky-to-Space Gradient transitions dynamically with altitude!
      const spaceBlend = Math.min(1, g.altitude / 55);
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#020617');
      skyGrad.addColorStop(0.55, spaceBlend > 0.5 ? '#070e26' : '#0f2854');
      skyGrad.addColorStop(1, spaceBlend > 0.7 ? '#09142f' : '#1e3a8a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Twinkling Starfield
      g.stars.forEach((s) => {
        ctx.fillStyle = `rgba(255,255,255,${0.25 + spaceBlend * 0.7})`;
        ctx.beginPath();
        ctx.arc(s.x * w, ((s.y * h + g.altitude * 4) % h), s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Camera view maps a rolling 42-altitude window around the rocket
      const camBottomAlt = Math.max(0, g.altitude - 10);
      const altToScreenY = (alt: number) => h - 60 - ((alt - camBottomAlt) / 42) * (h - 90);
      const laneToScreenX = (lx: number) => w / 2 + lx * (w * 0.36);

      // Green Target Orbit Zone Band (Altitude 78..104)
      const zoneTopY = altToScreenY(104);
      const zoneBotY = altToScreenY(78);
      if (zoneBotY > 0 && zoneTopY < h) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
        ctx.fillRect(0, zoneTopY, w, zoneBotY - zoneTopY);
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(0, zoneBotY);
        ctx.lineTo(w, zoneBotY);
        ctx.moveTo(0, zoneTopY);
        ctx.lineTo(w, zoneTopY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#6ee7b7';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('TARGET ORBIT ZONE — DEPLOY SATELLITE HERE!', 22, Math.max(22, zoneBotY - 10));
      }

      // Glowing Curved Green Flight Corridor
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.25)';
      ctx.lineWidth = 105;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let a = Math.floor(camBottomAlt); a <= camBottomAlt + 45; a += 1.5) {
        const px = laneToScreenX(corridorCenterX(a));
        const py = altToScreenY(a);
        if (a === Math.floor(camBottomAlt)) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      for (let a = Math.floor(camBottomAlt); a <= camBottomAlt + 45; a += 1.5) {
        const px = laneToScreenX(corridorCenterX(a));
        const py = altToScreenY(a);
        if (a === Math.floor(camBottomAlt)) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Launchpad Ground at Altitude 0
      const padY = altToScreenY(0);
      if (padY < h + 40) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, padY + 26, w, h - padY);
        ctx.fillStyle = '#334155';
        ctx.fillRect(w / 2 - 70, padY + 14, 140, 14);
        // Launch Tower
        ctx.fillStyle = '#64748b';
        ctx.fillRect(w / 2 - 64, padY - 58, 12, 72);
        ctx.fillRect(w / 2 - 52, padY - 46, 30, 5);
      }

      // Draw Wind Shear Storm Clouds
      g.clouds.forEach((c) => {
        const cy = altToScreenY(c.progressY);
        if (cy < -30 || cy > h + 30) return;
        const cx = laneToScreenX(c.laneX);
        ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
        ctx.beginPath();
        ctx.arc(cx, cy, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fecdd3';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('TURBULENCE!', cx - 34, cy + 4);
      });

      // Draw Gold Bonus Fuel Rings
      g.rings.forEach((ring) => {
        if (ring.collected) return;
        const ry = altToScreenY(ring.progressY);
        if (ry < -30 || ry > h + 30) return;
        const rx = laneToScreenX(ring.laneX);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(rx, ry, 20, 9, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('+FUEL', rx - 15, ry - 13);
      });

      // Rocket Position on Screen
      const rx = laneToScreenX(g.rocketX);
      const ry = altToScreenY(g.altitude);

      // Draw Particles around Rocket / Confetti
      g.particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.beginPath();
        ctx.arc(rx + p.x - (g.phase === 'deployed' ? 0 : g.rocketX * (w * 0.36) - (rx - w / 2)), ry + p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Draw Colorful Rocket Sprite
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(g.rocketVx * 2.4);

      if (g.phase === 'flying' && g.boosting) {
        // Roaring flame plume
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(-10, 22);
        ctx.lineTo(10, 22);
        ctx.lineTo(0, 48 + Math.random() * 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(-5, 22);
        ctx.lineTo(5, 22);
        ctx.lineTo(0, 36 + Math.random() * 8);
        ctx.closePath();
        ctx.fill();
      }

      // Rocket Fins
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-11, 8);
      ctx.lineTo(-20, 22);
      ctx.lineTo(-10, 20);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(11, 8);
      ctx.lineTo(20, 22);
      ctx.lineTo(10, 20);
      ctx.closePath();
      ctx.fill();

      // Rocket Fuselage
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(-11, -18, 22, 38, 6);
      ctx.fill();
      // Nose Cone
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-11, -14);
      ctx.lineTo(11, -14);
      ctx.lineTo(0, -34);
      ctx.closePath();
      ctx.fill();
      // Window Porthole
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, -4, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
      ctx.restore();

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onUpdateBurnState, propellantBudgetKg, targetDeltaVKms]);

  const handleCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    if (g.phase !== 'flying') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const normX = ((e.clientX - rect.left) / rect.width - 0.5) / 0.36;
    g.pointerTargetX = Math.max(-0.9, Math.min(0.9, normX));
  };

  const inDeployWindow = phase === 'flying' && altitudePct >= 78 && altitudePct <= 104;

  return (
    <div className="space-y-4">
      {/* Top Arcade Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-amber-500/30 bg-[#091122] p-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <Rocket className="h-4 w-4" />
            <span>Mission Phase 1 · Launch Arcade</span>
          </div>
          <h2 className="mt-1 font-display text-2xl font-black text-white">
            Rocket Boost Ascent!
          </h2>
          <p className="mt-0.5 text-xs text-slate-300">
            Steer inside the glowing green flight corridor, collect gold fuel rings, and deploy your satellite in the Green Orbit Zone!
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onPrevSegment}
            className="flex items-center gap-1 border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Setup</span>
          </button>
          <button
            type="button"
            onClick={onProceedToSpace}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black transition-all cursor-pointer ${
              phase === 'deployed' || burnState.outcomeType === 'nominal'
                ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300 shadow-lg shadow-emerald-500/25'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
            }`}
          >
            <span>Next: Space Adventure</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Big 3-Word Action Prompt Banner */}
      <div
        className={`border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
          inDeployWindow
            ? 'border-emerald-400 bg-emerald-950/50 text-emerald-200'
            : phase === 'crashed'
              ? 'border-rose-500 bg-rose-950/50 text-rose-200'
              : phase === 'deployed'
                ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200'
                : 'border-amber-400/50 bg-amber-950/30 text-amber-200'
        }`}
      >
        <div className="flex items-center gap-2.5 font-display text-base font-black tracking-wide">
          {phase === 'deployed' ? <Trophy className="h-5 w-5 text-amber-300" /> : <Flame className="h-5 w-5" />}
          <span>{bannerHint}</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold font-mono-tab">
          <span className="text-amber-300">Gold Rings: {ringsCollected}/5</span>
          <span className="text-cyan-300">Score: {score}</span>
        </div>
      </div>

      {/* Main Split: Arcade Sky Canvas (8 cols) + Big Touch/Button Controls & Rocket Selector (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 border border-slate-800 bg-[#040814] relative overflow-hidden">
          <canvas
            ref={canvasRef}
            width={760}
            height={460}
            onPointerMove={handleCanvasPointer}
            onPointerDown={handleCanvasPointer}
            onPointerLeave={() => {
              gameRef.current.pointerTargetX = null;
            }}
            className="w-full h-[380px] sm:h-[440px] object-cover block cursor-crosshair touch-none"
          />

          {/* Bottom Arcade Control Strip */}
          <div className="border-t border-slate-800 bg-[#080d19] p-3 flex flex-wrap items-center justify-between gap-2.5">
            {phase === 'pad' && (
              <button
                type="button"
                onClick={startLaunch}
                disabled={isPayloadTooHeavy}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 py-3 px-6 text-sm font-black text-slate-950 hover:from-amber-300 hover:to-orange-400 disabled:opacity-40 cursor-pointer"
              >
                <Rocket className="h-5 w-5" />
                <span>IGNITE &amp; LAUNCH! (SPACE)</span>
              </button>
            )}

            {phase === 'flying' && (
              <>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onPointerDown={() => {
                      gameRef.current.steerLeft = true;
                    }}
                    onPointerUp={() => {
                      gameRef.current.steerLeft = false;
                    }}
                    onPointerLeave={() => {
                      gameRef.current.steerLeft = false;
                    }}
                    className="border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-black text-white hover:bg-slate-700 cursor-pointer select-none"
                  >
                    ◀ STEER LEFT
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => {
                      gameRef.current.steerRight = true;
                    }}
                    onPointerUp={() => {
                      gameRef.current.steerRight = false;
                    }}
                    onPointerLeave={() => {
                      gameRef.current.steerRight = false;
                    }}
                    className="border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-black text-white hover:bg-slate-700 cursor-pointer select-none"
                  >
                    STEER RIGHT ▶
                  </button>
                </div>

                <button
                  type="button"
                  onPointerDown={() => {
                    gameRef.current.boosting = true;
                    setIsBoosting(true);
                  }}
                  onPointerUp={() => {
                    gameRef.current.boosting = false;
                    setIsBoosting(false);
                  }}
                  onPointerLeave={() => {
                    gameRef.current.boosting = false;
                    setIsBoosting(false);
                  }}
                  className={`px-6 py-3 text-xs font-black uppercase cursor-pointer select-none ${
                    isBoosting ? 'bg-orange-500 text-slate-950' : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  }`}
                >
                  HOLD TO BOOST
                </button>

                <button
                  type="button"
                  onClick={deploySatellite}
                  className={`flex-1 py-3 px-5 text-xs font-black uppercase cursor-pointer transition-all ${
                    inDeployWindow
                      ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300 ring-2 ring-emerald-200'
                      : 'border border-cyan-500/50 bg-cyan-950/60 text-cyan-200 hover:bg-cyan-900/60'
                  }`}
                >
                  {inDeployWindow ? 'DEPLOY SATELLITE NOW! (SPACE)' : 'DEPLOY EARLY (WAIT FOR GREEN!)'}
                </button>
              </>
            )}

            {(phase === 'deployed' || phase === 'crashed') && (
              <>
                <button
                  type="button"
                  onClick={resetLaunchpad}
                  className="flex items-center gap-2 border border-slate-700 bg-slate-800 px-5 py-3 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Play Launch Again</span>
                </button>
                {phase === 'deployed' && (
                  <button
                    type="button"
                    onClick={onProceedToSpace}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-400 py-3 px-6 text-sm font-black text-slate-950 hover:bg-emerald-300 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>FLY IN SPACE! →</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: Visual Gauges + Rocket Garage */}
        <div className="lg:col-span-4 space-y-4">
          {/* 3 Visual Arcade Bars */}
          <div className="border border-slate-800 bg-[#080d19] p-4 space-y-4">
            <h3 className="font-display text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Gauge className="h-4 w-4 text-cyan-400" />
              Live Flight Bars
            </h3>

            {/* Height to Orbit Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-300">Height to Space</span>
                <span className={inDeployWindow ? 'text-emerald-400' : 'text-cyan-300'}>
                  {altitudePct}% {inDeployWindow ? '· IN ORBIT ZONE!' : ''}
                </span>
              </div>
              <div className="relative h-4 bg-slate-900 border border-slate-800 overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 bg-emerald-500/35 border-x border-emerald-400"
                  style={{ left: '78%', width: '22%' }}
                />
                <div
                  className={`h-full transition-all duration-75 ${
                    inDeployWindow ? 'bg-emerald-400' : 'bg-cyan-400'
                  }`}
                  style={{ width: `${Math.min(100, altitudePct)}%` }}
                />
              </div>
            </div>

            {/* Fuel Tank Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-300">Boost Fuel</span>
                <span className={fuelPct < 25 ? 'text-rose-400' : 'text-amber-300'}>{fuelPct}%</span>
              </div>
              <div className="h-3.5 bg-slate-900 border border-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${
                    fuelPct < 25 ? 'bg-rose-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${fuelPct}%` }}
                />
              </div>
            </div>

            {/* Rocket Hull Safety Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-300">Rocket Stability</span>
                <span className={hullSafetyPct < 40 ? 'text-rose-400' : 'text-emerald-400'}>
                  {hullSafetyPct}%
                </span>
              </div>
              <div className="h-3.5 bg-slate-900 border border-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${
                    hullSafetyPct < 40 ? 'bg-rose-500' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${hullSafetyPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Visual Rocket Selector */}
          <div className="border border-slate-800 bg-[#080d19] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-black uppercase tracking-wider text-white">
                Pick Your Rocket
              </h3>
              <span className={`text-xs font-bold ${isPayloadTooHeavy ? 'text-rose-400' : 'text-emerald-400'}`}>
                {isPayloadTooHeavy ? 'Too Small!' : 'Fits Craft ✓'}
              </span>
            </div>

            <div className="space-y-2">
              {NASA_ROCKETS.map((r) => {
                const selected = r.id === selectedRocket.id;
                const fits = totalPayloadMassKg <= r.maxPayloadKg;
                const nick = ROCKET_NICKNAMES[r.id] || {
                  label: r.name,
                  powerText: `Lifts up to ${r.maxPayloadKg} kg`,
                };
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={phase === 'flying'}
                    onClick={() => onSelectRocket(r)}
                    className={`w-full border p-3 text-left transition-all cursor-pointer flex items-center justify-between ${
                      selected
                        ? 'border-amber-400 bg-amber-950/30'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                    } disabled:opacity-50`}
                  >
                    <div>
                      <div className="font-display text-xs font-bold text-white">{nick.label}</div>
                      <div className="text-[11px] text-slate-400">{nick.powerText}</div>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 ${
                        fits ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {fits ? 'FITS ✓' : 'TOO HEAVY'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-1 flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
              <span>Move mouse/touch over sky or hold Left/Right keys to steer!</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
