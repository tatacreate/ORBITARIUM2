import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  HardDrive,
  Radio,
  Send,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { audioSynth } from '../../audio/synth';
import { CELESTIAL_BODIES, GROUND_STATIONS, checkLineOfSight } from '../../engine/orbitalMechanics';
import type {
  GroundCommState,
  NasaObjectiveSpec,
  OrbitalState,
  SurfaceLandmark,
} from '../../types/nasaSegments';

interface GroundSegmentProps {
  selectedObjective: NasaObjectiveSpec;
  orbitState: OrbitalState;
  groundComm: GroundCommState;
  landmarks: SurfaceLandmark[];
  onSteerDish: (azimuthDeg: number, elevationDeg: number) => void;
  onSelectStation: (stationId: string) => void;
  onChangeBandMode: (band: 'Ka-Band' | 'X-Band') => void;
  onChangeBandwidthPct: (pct: number) => void;
  onToggleServoAssist: () => void;
  onFlushSsrBurst: () => void;
  onProceedToUser: () => void;
  onPrevSegment: () => void;
}

interface DataPacket {
  t: number;
  speed: number;
  color: string;
  size: number;
}

function getFriendlyStationLabel(id: string, fallbackName: string): {
  shortName: string;
  flag: string;
  vibe: string;
} {
  const map: Record<string, { shortName: string; flag: string; vibe: string }> = {
    'dsn-goldstone': {
      shortName: 'California Desert Dish',
      flag: 'USA',
      vibe: 'Giant deep-space dish in the Mojave Desert',
    },
    'csa-inuvik': {
      shortName: 'Arctic Canada Dish',
      flag: 'CAN',
      vibe: 'Top North Pole station—catches icy polar orbits every loop!',
    },
    'dsn-madrid': {
      shortName: 'Spain Dish Station',
      flag: 'ESP',
      vibe: 'Covers Europe and the Atlantic side of the planet',
    },
    'dsn-canberra': {
      shortName: 'Australia Dish Station',
      flag: 'AUS',
      vibe: 'Covers the Southern sky and Pacific Ocean',
    },
    'luna-relay': {
      shortName: 'Moon South Pole Relay',
      flag: 'MOON',
      vibe: 'Special lunar dish listening for Moon orbiters',
    },
    'mars-relay': {
      shortName: 'Mars Deep-Space Dish',
      flag: 'MARS',
      vibe: 'High-power beam reaching all the way to the Red Planet',
    },
  };
  return (
    map[id] || {
      shortName: fallbackName,
      flag: 'NET',
      vibe: 'Orbital tracking dish',
    }
  );
}

export function GroundSegment({
  selectedObjective,
  orbitState,
  groundComm,
  landmarks,
  onSteerDish,
  onSelectStation,
  onChangeBandMode,
  onChangeBandwidthPct,
  onToggleServoAssist,
  onFlushSsrBurst,
  onProceedToUser,
  onPrevSegment,
}: GroundSegmentProps) {
  const body = CELESTIAL_BODIES[selectedObjective.targetBody];
  const stations = GROUND_STATIONS;
  const activeStation = stations.find((s) => s.id === groundComm.activeStationId) || stations[0];
  const activeStationFriendly = getFriendlyStationLabel(activeStation.id, activeStation.name);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef(false);
  const packetsRef = useRef<DataPacket[]>([
    { t: 0.15, speed: 0.016, color: '#22d3ee', size: 5 },
    { t: 0.48, speed: 0.019, color: '#34d399', size: 6 },
    { t: 0.79, speed: 0.014, color: '#fbbf24', size: 5 },
  ]);
  const [burstFlash, setBurstFlash] = useState(0);
  const [burstBanner, setBurstBanner] = useState<string | null>(null);

  // Keep fresh state in a ref for smooth 60fps canvas animation
  const simRef = useRef({
    groundComm,
    targetBody: selectedObjective.targetBody,
    burstFlash,
    pendingCount: 0,
  });

  const pendingLandmarks = landmarks.filter((l) => l.captured && !l.downlinked).length;
  const downlinkedLandmarks = landmarks.filter((l) => l.downlinked).length;
  const bufferPct = Math.min(100, (groundComm.bufferStoredGB / groundComm.bufferCapacityGB) * 100);
  const lockPct = groundComm.hasLineOfSight ? groundComm.dishLockQualityPct : 0;
  const isStrongLock = groundComm.hasLineOfSight && lockPct >= 65;

  simRef.current = {
    groundComm,
    targetBody: selectedObjective.targetBody,
    burstFlash,
    pendingCount: pendingLandmarks,
  };

  // Fade burst flash gently
  useEffect(() => {
    if (burstFlash <= 0) return;
    const t = window.setInterval(() => {
      setBurstFlash((v) => Math.max(0, Number((v - 0.06).toFixed(2))));
    }, 45);
    return () => clearInterval(t);
  }, [burstFlash]);

  // 60fps Signal Laser Link Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let tick = 0;

    // Deterministic stars
    const stars = Array.from({ length: 58 }, (_, i) => ({
      x: ((i * 137.5) % 1) * canvas.width,
      y: ((i * 73.1) % 1) * (canvas.height * 0.72),
      r: (i % 3) * 0.7 + 0.8,
      twinkle: i * 0.7,
    }));

    const render = () => {
      tick += 1;
      const { groundComm: gc, targetBody, burstFlash: flash } = simRef.current;
      const w = canvas.width;
      const h = canvas.height;

      // Sky gradient
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#030816');
      bg.addColorStop(0.68, '#081833');
      bg.addColorStop(1, '#0b223d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Stars
      stars.forEach((s) => {
        const alpha = 0.35 + 0.5 * Math.sin(tick * 0.04 + s.twinkle);
        ctx.fillStyle = `rgba(226, 232, 240, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Satellite position across upper sky arc driven by Azimuth/Elevation
      const azNorm = Math.sin(((gc.navTelemetry.azimuthDeg % 360) * Math.PI) / 180);
      const elNorm = Math.max(0.08, Math.min(0.95, gc.navTelemetry.elevationDeg / 90));
      const satX = w * 0.5 + azNorm * (w * 0.34);
      const satY = gc.hasLineOfSight ? h * (0.48 - elNorm * 0.32) : h * 0.84;

      // Ground dish base at bottom center
      const dishX = w * 0.5;
      const dishY = h - 54;

      // Dish aiming angle derived from player dishAzimuthDeg / dishElevationDeg
      const playerAzNorm = Math.sin(((gc.dishAzimuthDeg % 360) * Math.PI) / 180);
      const playerElNorm = Math.max(0.08, Math.min(0.95, gc.dishElevationDeg / 90));
      const aimTargetX = w * 0.5 + playerAzNorm * (w * 0.34);
      const aimTargetY = h * (0.48 - playerElNorm * 0.32);

      // Planet Horizon Curve at Bottom
      const horizonColor =
        targetBody === 'mars' ? '#7c2d12' : targetBody === 'moon' ? '#334155' : '#065f46';
      const horizonHighlight =
        targetBody === 'mars' ? '#fb923c' : targetBody === 'moon' ? '#94a3b8' : '#34d399';

      ctx.fillStyle = horizonColor;
      ctx.beginPath();
      ctx.ellipse(w / 2, h + 135, w * 0.72, 185, 0, Math.PI, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = horizonHighlight;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(w / 2, h + 135, w * 0.72, 185, 0, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();

      // Player Dish Beam Cone (Wide = X-Band, Narrow = Ka-Band)
      const beamSpread = gc.bandMode === 'Ka-Band' ? 28 : 54;
      const locked = gc.hasLineOfSight && gc.dishLockQualityPct >= 60;
      const coneGrad = ctx.createLinearGradient(dishX, dishY - 12, aimTargetX, aimTargetY);
      coneGrad.addColorStop(
        0,
        locked ? 'rgba(16, 185, 129, 0.34)' : 'rgba(245, 158, 11, 0.28)',
      );
      coneGrad.addColorStop(1, 'rgba(34, 211, 238, 0.04)');

      const dx = aimTargetX - dishX;
      const dy = aimTargetY - (dishY - 12);
      const len = Math.max(1, Math.hypot(dx, dy));
      const perpX = (-dy / len) * beamSpread;
      const perpY = (dx / len) * beamSpread;

      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(dishX, dishY - 12);
      ctx.lineTo(aimTargetX + perpX, aimTargetY + perpY);
      ctx.lineTo(aimTargetX - perpX, aimTargetY - perpY);
      ctx.closePath();
      ctx.fill();

      // Target Dish Aim Reticle in Sky
      ctx.strokeStyle = locked ? '#34d399' : '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(aimTargetX, aimTargetY, gc.bandMode === 'Ka-Band' ? 22 : 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Laser Beam & Flying Data Packets when Line of Sight is Active
      if (gc.hasLineOfSight) {
        const beamAlpha = locked ? 0.85 : 0.28;
        ctx.strokeStyle = locked
          ? `rgba(34, 211, 238, ${beamAlpha})`
          : `rgba(251, 191, 36, ${beamAlpha})`;
        ctx.lineWidth = locked ? 4 + flash * 5 : 2;
        ctx.beginPath();
        ctx.moveTo(satX, satY);
        ctx.lineTo(dishX, dishY - 14);
        ctx.stroke();

        // Inner bright laser core
        if (locked) {
          ctx.strokeStyle = '#ecfeff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(satX, satY);
          ctx.lineTo(dishX, dishY - 14);
          ctx.stroke();
        }

        // Flying Data Packets from Satellite -> Dish
        const speedMult = locked ? 1.35 + flash * 1.8 : 0.45;
        packetsRef.current.forEach((pkt) => {
          pkt.t = (pkt.t + pkt.speed * speedMult) % 1;
          const px = satX + (dishX - satX) * pkt.t;
          const py = satY + (dishY - 14 - satY) * pkt.t;

          ctx.fillStyle = pkt.color;
          ctx.beginPath();
          ctx.arc(px, py, pkt.size + (locked ? 1.5 : 0), 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      } else {
        // Planet occlusion warning banner inside sky
        ctx.fillStyle = 'rgba(244, 63, 94, 0.16)';
        ctx.fillRect(w * 0.14, h * 0.22, w * 0.72, 44);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
        ctx.strokeRect(w * 0.14, h * 0.22, w * 0.72, 44);
        ctx.fillStyle = '#fda4af';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Satellite is behind the planet! Pick a CLEAR SKY dish on the right.', w / 2, h * 0.22 + 27);
        ctx.textAlign = 'left';
      }

      // Draw Cute Animated Satellite Sprite
      if (gc.hasLineOfSight) {
        const bob = Math.sin(tick * 0.06) * 3;
        const sy = satY + bob;

        // Pulsing beacon halo
        const haloR = 20 + Math.sin(tick * 0.1) * 4;
        ctx.fillStyle = locked ? 'rgba(52, 211, 153, 0.22)' : 'rgba(34, 211, 238, 0.24)';
        ctx.beginPath();
        ctx.arc(satX, sy, haloR, 0, Math.PI * 2);
        ctx.fill();

        // Solar Wings
        ctx.fillStyle = '#0284c7';
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 1.5;
        ctx.fillRect(satX - 28, sy - 6, 16, 12);
        ctx.strokeRect(satX - 28, sy - 6, 16, 12);
        ctx.fillRect(satX + 12, sy - 6, 16, 12);
        ctx.strokeRect(satX + 12, sy - 6, 16, 12);

        // Satellite Gold Core
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(satX - 9, sy - 9, 18, 18);
        ctx.strokeStyle = '#fef3c7';
        ctx.strokeRect(satX - 9, sy - 9, 18, 18);

        // Label
        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('YOUR SATELLITE', satX, sy - 18);
        ctx.textAlign = 'left';
      }

      // Draw Ground Parabolic Dish rotating toward aim point
      const dishAngle = Math.atan2(aimTargetY - (dishY - 10), aimTargetX - dishX);
      ctx.save();
      ctx.translate(dishX, dishY);

      // Pedestal tower
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(-14, 18);
      ctx.lineTo(14, 18);
      ctx.lineTo(7, -6);
      ctx.lineTo(-7, -6);
      ctx.closePath();
      ctx.fill();

      // Rotating dish bowl
      ctx.translate(0, -10);
      ctx.rotate(dishAngle + Math.PI / 2);
      ctx.strokeStyle = '#e2e8f0';
      ctx.fillStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 24, Math.PI * 0.12, Math.PI * 0.88);
      ctx.fill();
      ctx.stroke();

      // Feed horn needle
      ctx.strokeStyle = locked ? '#34d399' : '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(0, -14);
      ctx.stroke();

      ctx.fillStyle = locked ? '#34d399' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, -16, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Top HUD Tag
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.fillRect(10, 10, 236, 28);
      ctx.fillStyle = locked ? '#34d399' : '#fbbf24';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(
        gc.hasLineOfSight
          ? locked
            ? 'LASER LOCKED — STREAMING DATA!'
            : 'DRAG SKY CIRCLE ONTO SATELLITE'
          : 'WAITING FOR CLEAR SKY DISH',
        20,
        28,
      );

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Pointer aim steering on the interactive sky canvas
  const steerFromCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);

    // Invert visual projection back to Azimuth/Elevation smoothly
    const azNorm = Math.max(-1, Math.min(1, (px - canvas.width * 0.5) / (canvas.width * 0.34)));
    const azDeg = ((Math.asin(azNorm) * 180) / Math.PI + 360) % 360;
    const elNorm = Math.max(0.08, Math.min(0.95, (0.48 - py / canvas.height) / 0.32));
    const elDeg = Math.round(elNorm * 90);

    onSteerDish(Math.round(azDeg), Math.max(6, Math.min(88, elDeg)));
  };

  // Visual Signal Wave Tuner position (0..100 scale, target center = 50)
  const satAz = groundComm.navTelemetry.azimuthDeg;
  const dishAz = groundComm.dishAzimuthDeg;
  const azDelta = ((dishAz - satAz + 540) % 360) - 180;
  const elDelta = groundComm.dishElevationDeg - groundComm.navTelemetry.elevationDeg;
  const combinedDelta = Math.max(-50, Math.min(50, azDelta * 0.65 + elDelta * 0.5));
  const tunerPct = Math.max(4, Math.min(96, 50 + combinedDelta));

  const handleLockAndBeam = () => {
    audioSynth.playSuccess();
    if (groundComm.hasLineOfSight) {
      onSteerDish(
        Math.round(groundComm.navTelemetry.azimuthDeg),
        Math.max(8, Math.round(groundComm.navTelemetry.elevationDeg)),
      );
      onFlushSsrBurst();
      setBurstFlash(1);
      setBurstBanner(
        pendingLandmarks > 0
          ? `Woohoo! Sent ${pendingLandmarks} new photo discover${pendingLandmarks === 1 ? 'y' : 'ies'} home!`
          : 'Laser boost fired! Downloading science packets fast!',
      );
      window.setTimeout(() => setBurstBanner(null), 3200);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Arcade Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-800 bg-[#080d19] p-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <Radio className="h-4 w-4" />
            <span>Step 3 · Signal Laser Link</span>
          </div>
          <h2 className="mt-0.5 font-display text-xl md:text-2xl font-bold text-white">
            Aim the Ground Dish &amp; Beam Photos Home
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Click anywhere in the sky to point the dish laser at your satellite, or pick a green{' '}
            <strong className="text-emerald-300">CLEAR SKY</strong> dish on the right!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevSegment}
            className="flex items-center gap-1 border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Space</span>
          </button>
          <button
            type="button"
            onClick={onProceedToUser}
            className="flex items-center gap-2 bg-emerald-400 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-300 transition-colors cursor-pointer"
          >
            <span>See My Discoveries!</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Simple Color-Coded Signal Banner */}
      <div
        className={`border p-3.5 transition-all ${
          !groundComm.hasLineOfSight
            ? 'border-rose-500/60 bg-rose-950/25'
            : isStrongLock
              ? 'border-emerald-500/60 bg-emerald-950/25'
              : 'border-amber-500/60 bg-amber-950/20'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center ${
                !groundComm.hasLineOfSight
                  ? 'bg-rose-500/20 text-rose-400'
                  : isStrongLock
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {groundComm.hasLineOfSight ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
            </div>
            <div>
              <div className="font-display text-sm font-bold text-white">
                {!groundComm.hasLineOfSight
                  ? `${activeStationFriendly.shortName} is Behind ${body.name}!`
                  : isStrongLock
                    ? `Laser Connected to ${activeStationFriendly.shortName}!`
                    : `Almost Locked! Drag the sky circle onto your satellite`}
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                {pendingLandmarks > 0 ? (
                  <span>
                    <strong className="text-amber-300">{pendingLandmarks} new photo(s)</strong> waiting to download!
                  </span>
                ) : (
                  <span>
                    <strong className="text-emerald-300">{downlinkedLandmarks}/{landmarks.length}</strong> planet photos safely downloaded!
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-center">
              <span className="text-[10px] text-slate-400 block">Signal Strength</span>
              <strong className={isStrongLock ? 'text-emerald-300 text-sm' : 'text-amber-300 text-sm'}>
                {lockPct}%
              </strong>
            </div>
            <div className="border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-center">
              <span className="text-[10px] text-slate-400 block">Download Speed</span>
              <strong className="text-cyan-300 text-sm">{groundComm.currentDownlinkMbps} Mbps</strong>
            </div>
            <div className="border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-center">
              <span className="text-[10px] text-slate-400 block">Photos Saved</span>
              <strong className="text-emerald-300 text-sm">
                {downlinkedLandmarks}/{landmarks.length}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {burstBanner && (
        <div className="border border-emerald-400 bg-emerald-950/60 px-4 py-2.5 text-xs font-bold text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{burstBanner}</span>
        </div>
      )}

      {/* Main Split: Interactive Sky Laser Canvas (Left 7 cols) + World Dishes (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-4">
          <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-cyan-400" />
                <h3 className="font-display text-sm font-bold text-white">
                  Sky Dish Aiming Game
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  audioSynth.playSelect();
                  onToggleServoAssist();
                }}
                className={`px-3 py-1 text-xs font-bold border cursor-pointer ${
                  groundComm.servoAssistEnabled
                    ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                {groundComm.servoAssistEnabled ? 'Auto-Aim Helper: ON' : 'Auto-Aim Helper: OFF'}
              </button>
            </div>

            <div className="border border-slate-800 bg-slate-950 overflow-hidden">
              <canvas
                ref={canvasRef}
                width={620}
                height={330}
                onPointerDown={(e) => {
                  draggingRef.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  steerFromCanvas(e);
                }}
                onPointerMove={(e) => {
                  if (draggingRef.current) steerFromCanvas(e);
                }}
                onPointerUp={() => {
                  draggingRef.current = false;
                }}
                onPointerLeave={() => {
                  draggingRef.current = false;
                }}
                className="w-full h-auto block cursor-crosshair"
              />
            </div>

            {/* Visual Green Sweet-Spot Signal Bar */}
            <div className="border border-slate-800 bg-slate-900/60 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Signal Alignment Meter</span>
                <span className={isStrongLock ? 'font-bold text-emerald-300' : 'font-bold text-amber-300'}>
                  {isStrongLock ? 'IN THE GREEN SWEET SPOT!' : 'Slide or click sky to center the beam'}
                </span>
              </div>

              <div className="relative h-5 w-full overflow-hidden border border-slate-700 bg-slate-950">
                {/* Color zones: Red -> Yellow -> Green -> Yellow -> Red */}
                <div className="absolute inset-0 flex">
                  <div className="w-[18%] bg-rose-500/35" />
                  <div className="w-[20%] bg-amber-400/35" />
                  <div className="w-[24%] bg-emerald-400/45 border-x border-emerald-400/80" />
                  <div className="w-[20%] bg-amber-400/35" />
                  <div className="w-[18%] bg-rose-500/35" />
                </div>

                {/* Live tuner needle */}
                <div
                  className="absolute top-0 bottom-0 w-2 bg-white shadow-lg transition-all duration-75"
                  style={{ left: `calc(${tunerPct}% - 4px)` }}
                />
              </div>

              {/* Simple Dish Aim & Beam Mode Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-300 block">Beam Shape</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        audioSynth.playSelect();
                        onChangeBandMode('Ka-Band');
                      }}
                      className={`py-1.5 px-2 text-xs font-bold border cursor-pointer ${
                        groundComm.bandMode === 'Ka-Band'
                          ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                          : 'border-slate-700 bg-slate-950 text-slate-300'
                      }`}
                    >
                      Fast Laser (Narrow)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        audioSynth.playSelect();
                        onChangeBandMode('X-Band');
                      }}
                      className={`py-1.5 px-2 text-xs font-bold border cursor-pointer ${
                        groundComm.bandMode === 'X-Band'
                          ? 'border-emerald-400 bg-emerald-400 text-slate-950'
                          : 'border-slate-700 bg-slate-950 text-slate-300'
                      }`}
                    >
                      Wide Beam (Easy)
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-slate-300">Dish Power</span>
                    <strong className="text-cyan-300">{groundComm.allocatedBandwidthPct}%</strong>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={100}
                    step={25}
                    value={groundComm.allocatedBandwidthPct}
                    onChange={(e) => onChangeBandwidthPct(parseInt(e.target.value, 10))}
                    aria-label="Dish Power"
                    className="w-full accent-cyan-400 h-2 bg-slate-800 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Big Arcade Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  audioSynth.playSelect();
                  onSteerDish(
                    Math.round(groundComm.navTelemetry.azimuthDeg),
                    Math.max(8, Math.round(groundComm.navTelemetry.elevationDeg)),
                  );
                }}
                disabled={!groundComm.hasLineOfSight}
                className={`py-2.5 px-4 flex items-center justify-center gap-2 text-xs font-bold cursor-pointer border ${
                  groundComm.hasLineOfSight
                    ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200 hover:bg-cyan-900/60'
                    : 'border-slate-800 bg-slate-900 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Zap className="h-4 w-4" />
                Snap Dish to Satellite
              </button>

              <button
                type="button"
                onClick={handleLockAndBeam}
                disabled={!groundComm.hasLineOfSight}
                className={`py-2.5 px-4 flex items-center justify-center gap-2 text-xs font-bold cursor-pointer ${
                  groundComm.hasLineOfSight
                    ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Send className="h-4 w-4" />
                {pendingLandmarks > 0 ? `Beam ${pendingLandmarks} Photo(s) Home!` : 'Boost Data Download!'}
              </button>
            </div>
          </div>

          {/* Simple Spacecraft Memory Bar */}
          <div className="border border-slate-800 bg-[#080d19] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-bold text-white">
                <HardDrive className="h-4 w-4 text-cyan-400" />
                <span>Satellite Photo Memory</span>
              </div>
              <span className="text-slate-300">
                {bufferPct.toFixed(0)}% Full ({Math.round(groundComm.totalDataDownlinkedGB)} GB sent home)
              </span>
            </div>
            <div className="h-3 w-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  bufferPct > 85 ? 'bg-rose-500' : bufferPct > 55 ? 'bg-amber-400' : 'bg-cyan-400'
                }`}
                style={{ width: `${bufferPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right 5 Cols: World Ground Dish Switcher */}
        <div className="lg:col-span-5 border border-slate-800 bg-[#080d19] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">
              Pick a Ground Dish With Clear Sky
            </h3>
            <span className="text-[11px] text-slate-400">{stations.length} Dishes</span>
          </div>

          <div className="space-y-2 max-h-[470px] overflow-y-auto pr-1">
            {stations.map((st) => {
              const los = checkLineOfSight(
                selectedObjective.targetBody,
                st,
                orbitState.subSatLatDeg,
                orbitState.subSatLonDeg,
                orbitState.altitudeKm,
                orbitState.orbitalSpeedKms,
              );
              const isSelected = st.id === groundComm.activeStationId;
              const info = getFriendlyStationLabel(st.id, st.name);

              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    audioSynth.playSelect();
                    onSelectStation(st.id);
                  }}
                  className={`w-full text-left border p-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/35 ring-1 ring-cyan-400/50'
                      : los.hasLineOfSight
                        ? 'border-emerald-500/45 bg-emerald-950/20 hover:border-emerald-400'
                        : 'border-slate-800 bg-slate-900/55 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-bold text-cyan-300">{info.flag}</div>
                      <div className="font-display text-sm font-bold text-white">{info.shortName}</div>
                      <p className="mt-0.5 text-xs text-slate-300">{info.vibe}</p>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 shrink-0 ${
                        los.hasLineOfSight
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {los.hasLineOfSight ? 'CLEAR SKY' : 'BEHIND PLANET'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
