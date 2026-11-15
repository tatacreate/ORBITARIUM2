import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  Camera,
  CheckCircle2,
  Flame,
  Orbit,
  Shield,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { audioSynth } from '../../audio/synth';
import { getArtworkForBodyAndRegime, getFriendlyLandmarkFact } from '../../data/discoveryArt';
import {
  CELESTIAL_BODIES,
  computeCanadarmEndEffector,
  predictManeuverOrbit,
} from '../../engine/orbitalMechanics';
import { NasaOrbitalScene } from '../../three/NasaOrbitalScene';
import type {
  CsaChallengeState,
  NasaInstrument,
  NasaObjectiveSpec,
  OrbitalState,
  PropulsionType,
  SpacecraftOpsState,
  SurfaceLandmark,
} from '../../types/nasaSegments';

interface SpaceSegmentProps {
  selectedObjective: NasaObjectiveSpec;
  orbitState: OrbitalState;
  onUpdateOrbitParams: (altitudeKm: number, eccentricity: number, inclinationDeg: number) => void;
  onWarpToAnomaly: (targetAnomalyDeg: number) => void;
  selectedPropulsion: PropulsionType;
  propellantBudgetKg: number;
  onApplyManeuverBurn: (
    deltaVVector: { progradeMs: number; normalMs: number; radialMs: number },
    accuracyPct?: number,
  ) => void;
  instruments: NasaInstrument[];
  onToggleInstrument: (id: string) => void;
  onShedHeavyPayloads: () => void;
  hasLineOfSight: boolean;
  activeStationId: string | null;
  csaChallenges: CsaChallengeState;
  opsState: SpacecraftOpsState;
  onUpdateOpsState: (updater: (prev: SpacecraftOpsState) => SpacecraftOpsState) => void;
  onTriggerHazardDrill: (kind?: 'debris' | 'solar-flare' | 'eclipse-drain') => void;
  onResolveCanadarmCapture: () => void;
  landmarks: SurfaceLandmark[];
  onFireInstrumentScan: (landmarkId?: string) => { capturedName: string | null; message: string };
  onProceedToGround: () => void;
  onPrevSegment: () => void;
}

interface SpaceSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export function SpaceSegment({
  selectedObjective,
  orbitState,
  onWarpToAnomaly,
  propellantBudgetKg,
  onApplyManeuverBurn,
  instruments,
  onToggleInstrument,
  onShedHeavyPayloads,
  hasLineOfSight,
  activeStationId,
  opsState,
  onUpdateOpsState,
  onTriggerHazardDrill,
  onResolveCanadarmCapture,
  landmarks,
  onFireInstrumentScan,
  onProceedToGround,
  onPrevSegment,
}: SpaceSegmentProps) {
  const body = CELESTIAL_BODIES[selectedObjective.targetBody];
  const [viewportMode, setViewportMode] = useState<'arcade-2d' | 'orbital-3d'>('arcade-2d');
  const [activeTab, setActiveTab] = useState<'slingshot' | 'canadarm' | 'craft'>('slingshot');

  // Visual Slingshot Drag State
  const [slingshotBoostMs, setSlingshotBoostMs] = useState(140);
  const [slingshotTiltMs, setSlingshotTiltMs] = useState(0);
  const [slingshotAngleDeg, setSlingshotAngleDeg] = useState(65);
  const [burnFlash, setBurnFlash] = useState(false);
  const [dodgeOffsetPx, setDodgeOffsetPx] = useState(0);
  const [scanFlash, setScanFlash] = useState(false);

  // Snapshot Pop-up Card when player snaps a planet target!
  const [snapshotPopup, setSnapshotPopup] = useState<{
    landmark: SurfaceLandmark;
    artUrl: string;
    title: string;
    fact: string;
  } | null>(null);
  const [toastTip, setToastTip] = useState<string | null>(null);

  const arenaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const clawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragSlingshotRef = useRef(false);
  const sparksRef = useRef<SpaceSpark[]>([]);
  const shakeRef = useRef(0);
  const animPhaseRef = useRef(0);

  const predicted = predictManeuverOrbit(selectedObjective.targetBody, orbitState, {
    progradeMs: slingshotBoostMs,
    normalMs: slingshotTiltMs,
  });

  const activeInstruments = instruments.filter((i) => i.enabled);
  const capturedCount = landmarks.filter((l) => l.captured).length;
  const fuelPct = Math.min(100, Math.round((propellantBudgetKg / Math.max(1, selectedObjective.propellantBudgetKg)) * 100));

  const spawnSparks = useCallback((cx: number, cy: number, color: string, count = 18) => {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 4.5;
      sparksRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 32,
        color,
      });
    }
  }, []);

  // Fire Slingshot Burn
  const handleFireSlingshot = useCallback(() => {
    audioSynth.playMountPart();
    setBurnFlash(true);
    window.setTimeout(() => setBurnFlash(false), 650);
    shakeRef.current = 8;
    onApplyManeuverBurn(
      { progradeMs: slingshotBoostMs, normalMs: slingshotTiltMs, radialMs: 0 },
      95,
    );
    setToastTip('THRUSTERS FIRED! Orbit reshaped cleanly!');
  }, [onApplyManeuverBurn, slingshotBoostMs, slingshotTiltMs]);

  // Snap Target Photo / Radar Scan
  const handleSnapTarget = useCallback(
    (specificLandmarkId?: string) => {
      // Find closest uncaptured landmark or specific one
      const nextTarget =
        (specificLandmarkId ? landmarks.find((l) => l.id === specificLandmarkId) : null) ||
        landmarks.find((l) => !l.captured);

      if (!nextTarget) {
        setToastTip('All 5 planet discoveries captured! Head to Ground Link to beam them home!');
        return;
      }

      // Auto-power the required gadget if it was turned off so players never get stuck on hidden tech gates!
      const reqInst = instruments.find((i) => i.id === nextTarget.requiredInstrument);
      if (reqInst && !reqInst.enabled) {
        onToggleInstrument(reqInst.id);
      }

      // Brief delay if we just toggled instrument, or fire directly via state update:
      setScanFlash(true);
      window.setTimeout(() => setScanFlash(false), 750);

      // Compute friendly discovery popup even if instrument just toggled
      const res = onFireInstrumentScan(nextTarget.id);
      if (res.capturedName) {
        const info = getFriendlyLandmarkFact(nextTarget);
        setSnapshotPopup({
          landmark: { ...nextTarget, captured: true, signalQualityPct: 92 },
          artUrl: getArtworkForBodyAndRegime(
            selectedObjective.targetBody,
            selectedObjective.regime,
            nextTarget.id,
          ),
          title: info.shortName,
          fact: info.funFact,
        });
        setToastTip(`+100 Discovery Points! Snapped "${info.shortName}"!`);
      } else {
        // Retry once after instrument enabled on next tick
        window.setTimeout(() => {
          const retry = onFireInstrumentScan(nextTarget.id);
          if (retry.capturedName) {
            const info = getFriendlyLandmarkFact(nextTarget);
            setSnapshotPopup({
              landmark: { ...nextTarget, captured: true, signalQualityPct: 92 },
              artUrl: getArtworkForBodyAndRegime(
                selectedObjective.targetBody,
                selectedObjective.regime,
                nextTarget.id,
              ),
              title: info.shortName,
              fact: info.funFact,
            });
            setToastTip(`+100 Discovery Points! Snapped "${info.shortName}"!`);
          }
        }, 60);
      }
    },
    [
      instruments,
      landmarks,
      onFireInstrumentScan,
      onToggleInstrument,
      selectedObjective.regime,
      selectedObjective.targetBody,
    ],
  );

  // Action Event Dodge (Debris Up / Down)
  const handleDodgeDebris = useCallback(
    (dir: 'up' | 'down') => {
      audioSynth.playSuccess();
      setDodgeOffsetPx(dir === 'up' ? -24 : 24);
      shakeRef.current = 12;
      window.setTimeout(() => setDodgeOffsetPx(0), 650);
      onApplyManeuverBurn({ progradeMs: dir === 'up' ? 32 : -32, normalMs: 0, radialMs: 0 }, 96);
      setToastTip(`DODGED ${dir.toUpperCase()}! Space junk zoomed safely past!`);
    },
    [onApplyManeuverBurn],
  );

  // Action Event Flip Heat Shield (Solar Flare)
  const handleFlipShield = useCallback(() => {
    audioSynth.playSuccess();
    onUpdateOpsState((p) => ({
      ...p,
      shieldAngleDeg: p.sunAngleDeg,
      activeHazard: p.activeHazard?.type === 'solar-flare' ? null : p.activeHazard,
      hazardsSurvived: p.activeHazard?.type === 'solar-flare' ? p.hazardsSurvived + 1 : p.hazardsSurvived,
    }));
    if (activeInstruments.length > 2) {
      onShedHeavyPayloads();
    }
    setToastTip('SHIELD FLIPPED! Solar storm sparks bounced right off!');
  }, [activeInstruments.length, onShedHeavyPayloads, onUpdateOpsState]);

  // 60FPS Space Arcade Canvas Render
  useEffect(() => {
    if (viewportMode !== 'arcade-2d') return;
    let raf = 0;

    const renderLoop = () => {
      animPhaseRef.current += 0.04;
      const canvas = arenaCanvasRef.current;
      if (!canvas) {
        raf = requestAnimationFrame(renderLoop);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.save();
      if (shakeRef.current > 0) {
        shakeRef.current -= 1;
        ctx.translate((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
      }

      // Deep Space Gradient Sky
      const bg = ctx.createRadialGradient(cx, cy, 40, cx, cy, 340);
      bg.addColorStop(0, '#0f1c3f');
      bg.addColorStop(1, '#040712');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Animated Stars
      for (let i = 0; i < 60; i++) {
        const sx = ((i * 137) % w);
        const sy = ((i * 79) % h);
        const twinkle = 0.35 + 0.55 * Math.abs(Math.sin(animPhaseRef.current * 0.5 + i));
        ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
        ctx.beginPath();
        ctx.arc(sx, sy, (i % 2) + 0.9, 0, Math.PI * 2);
        ctx.fill();
      }

      // Sun Beacon on Outer Edge (flashes during Solar Flare)
      const sunRad = (opsState.sunAngleDeg * Math.PI) / 180;
      const sunX = cx + Math.cos(sunRad) * 235;
      const sunY = cy - Math.sin(sunRad) * 185;
      const flareActive = opsState.activeHazard?.type === 'solar-flare';
      ctx.fillStyle = flareActive ? '#fb7185' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(sunX, sunY, flareActive ? 18 + Math.sin(animPhaseRef.current * 4) * 3 : 12, 0, Math.PI * 2);
      ctx.fill();
      if (flareActive) {
        ctx.strokeStyle = 'rgba(251, 113, 133, 0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Colorful Planet Center (Earth / Moon / Mars)
      const planetR = 64;
      const pGrad = ctx.createRadialGradient(cx - 18, cy - 18, 10, cx, cy, planetR);
      if (selectedObjective.targetBody === 'mars') {
        pGrad.addColorStop(0, '#fb923c');
        pGrad.addColorStop(0.7, '#c2410c');
        pGrad.addColorStop(1, '#451a03');
      } else if (selectedObjective.targetBody === 'moon') {
        pGrad.addColorStop(0, '#f1f5f9');
        pGrad.addColorStop(0.7, '#94a3b8');
        pGrad.addColorStop(1, '#334155');
      } else {
        pGrad.addColorStop(0, '#38bdf8');
        pGrad.addColorStop(0.65, '#0284c7');
        pGrad.addColorStop(1, '#082f49');
      }
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, planetR, 0, Math.PI * 2);
      ctx.fill();

      // Atmospheric Glow Ring
      ctx.strokeStyle =
        selectedObjective.targetBody === 'mars'
          ? 'rgba(251, 146, 60, 0.35)'
          : selectedObjective.targetBody === 'moon'
            ? 'rgba(226, 232, 240, 0.2)'
            : 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(cx, cy, planetR + 3, 0, Math.PI * 2);
      ctx.stroke();

      // Target Surface Rings around the planet rim
      landmarks.forEach((lm, idx) => {
        const ringAng = ((idx / landmarks.length) * Math.PI * 2) + animPhaseRef.current * 0.08;
        const lx = cx + Math.cos(ringAng) * (planetR - 14);
        const ly = cy + Math.sin(ringAng) * (planetR - 14);
        ctx.fillStyle = lm.captured ? '#34d399' : '#fbbf24';
        ctx.beginPath();
        ctx.arc(lx, ly, lm.captured ? 5 : 6 + Math.sin(animPhaseRef.current * 3 + idx) * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Orbit Scales
      const rx = Math.min(185, Math.max(105, 105 + (orbitState.altitudeKm / 2600) * 70));
      const ry = rx * Math.sqrt(Math.max(0.42, 1 - orbitState.eccentricity ** 2)) * 0.82;

      // Predicted Slingshot Orbit (Dashed Amber)
      const pRx = Math.min(240, Math.max(92, 105 + (predicted.predictedAltKm / 2600) * 70));
      const pRy = pRx * Math.sqrt(Math.max(0.42, 1 - predicted.predictedEcc ** 2)) * 0.82;
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.78)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, pRx, pRy, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Active Glowing Neon Orbit Trail
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Slingshot Drag Handle on Orbit
      const sRad = (slingshotAngleDeg * Math.PI) / 180;
      const nodeX = cx + rx * Math.cos(sRad);
      const nodeY = cy - ry * Math.sin(sRad);
      const tanX = -rx * Math.sin(sRad);
      const tanY = -ry * Math.cos(sRad);
      const tanLen = Math.hypot(tanX, tanY) || 1;
      const pullLen = Math.max(-55, Math.min(65, (slingshotBoostMs / 400) * 58));
      const handleX = nodeX + (tanX / tanLen) * pullLen;
      const handleY = nodeY + (tanY / tanLen) * pullLen;

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(nodeX, nodeY);
      ctx.lineTo(handleX, handleY);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(handleX, handleY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('DRAG SLINGSHOT', Math.min(w - 105, Math.max(8, handleX + 12)), Math.max(14, handleY + 4));

      // Spacecraft Current Position
      const satRad = (orbitState.trueAnomalyDeg * Math.PI) / 180;
      const satX = cx + rx * Math.cos(satRad);
      const satY = cy - ry * Math.sin(satRad) + dodgeOffsetPx;

      // Sweeping Emerald Scanner Cone from Satellite toward Planet
      ctx.fillStyle = scanFlash ? 'rgba(52, 211, 153, 0.5)' : 'rgba(52, 211, 153, 0.14)';
      ctx.beginPath();
      ctx.moveTo(satX, satY);
      const toCenterAng = Math.atan2(cy - satY, cx - satX);
      ctx.lineTo(satX + Math.cos(toCenterAng - 0.24) * 75, satY + Math.sin(toCenterAng - 0.24) * 75);
      ctx.lineTo(satX + Math.cos(toCenterAng + 0.24) * 75, satY + Math.sin(toCenterAng + 0.24) * 75);
      ctx.closePath();
      ctx.fill();

      // Incoming Red Space Debris Warning Lane!
      if (opsState.activeHazard?.type === 'debris') {
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, satY);
        ctx.lineTo(w, satY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Animated streaking junk rock
        const junkX = (animPhaseRef.current * 90) % w;
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(junkX, satY, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fecdd3';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw Cute Colorful Satellite Sprite
      ctx.save();
      ctx.translate(satX, satY);
      // Solar wings
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-20, -4, 13, 8);
      ctx.fillRect(7, -4, 13, 8);
      // Gold Body
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-7, -7, 14, 14);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.strokeRect(-7, -7, 14, 14);
      // Thruster Burn Flash
      if (burnFlash) {
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Update & Draw Sparks
      sparksRef.current = sparksRef.current
        .map((sp) => ({ ...sp, x: sp.x + sp.vx, y: sp.y + sp.vy, life: sp.life - 1 }))
        .filter((sp) => sp.life > 0);
      sparksRef.current.forEach((sp) => {
        ctx.fillStyle = sp.color;
        ctx.globalAlpha = sp.life / 32;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      ctx.restore();
      raf = requestAnimationFrame(renderLoop);
    };

    raf = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(raf);
  }, [
    viewportMode,
    selectedObjective.targetBody,
    orbitState.altitudeKm,
    orbitState.eccentricity,
    orbitState.trueAnomalyDeg,
    predicted.predictedAltKm,
    predicted.predictedEcc,
    slingshotAngleDeg,
    slingshotBoostMs,
    opsState.sunAngleDeg,
    opsState.activeHazard,
    landmarks,
    scanFlash,
    burnFlash,
    dodgeOffsetPx,
  ]);

  // Drag Slingshot Handle on 2D Arena Canvas
  const updateSlingshotFromPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 580 - 290;
    const y = 215 - ((e.clientY - rect.top) / rect.height) * 430;
    const dist = Math.hypot(x, y);
    const angle = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    setSlingshotAngleDeg(Math.round(angle));
    onWarpToAnomaly(Math.round(angle));
    const mappedBoost = Math.round(Math.max(-220, Math.min(420, (dist - 120) * 3.5)));
    setSlingshotBoostMs(mappedBoost);
  };

  // Canadarm Claw Bay Render
  const armKin = computeCanadarmEndEffector(
    opsState.canadarm.shoulderDeg,
    opsState.canadarm.elbowDeg,
    opsState.canadarm.wristDeg,
  );
  const armDist = Math.hypot(armKin.endX - opsState.canadarm.targetX, armKin.endY - opsState.canadarm.targetY);
  const clawLockedZone = armDist <= 0.18;

  useEffect(() => {
    if (activeTab !== 'canadarm') return;
    const canvas = clawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#050a18';
    ctx.fillRect(0, 0, w, h);

    // Bay Grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 1;
    for (let gx = 40; gx < w; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 40; gy < h; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    const toPx = (nx: number, ny: number) => ({
      x: w / 2 + nx * (w * 0.4),
      y: h - 22 - ny * (h - 46),
    });

    const tPos = toPx(opsState.canadarm.targetX, opsState.canadarm.targetY);
    // Floating Pod / Target
    ctx.fillStyle = clawLockedZone ? 'rgba(16, 185, 129, 0.25)' : 'rgba(251, 191, 36, 0.2)';
    ctx.strokeStyle = clawLockedZone ? '#34d399' : '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tPos.x, tPos.y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('POD', tPos.x - 11, tPos.y + 4);

    // Draw Robot Arm
    const pts = armKin.joints.map((j) => toPx(j.x, j.y));
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    pts.forEach((p, idx) => {
      ctx.fillStyle = idx === pts.length - 1 ? (clawLockedZone ? '#34d399' : '#fbbf24') : '#0f172a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, idx === pts.length - 1 ? 9 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [activeTab, armKin, clawLockedZone, opsState.canadarm]);

  // Helper to nudge Canadarm easily with intuitive Up/Down/Left/Right buttons!
  const nudgeCanadarm = (dx: number, dy: number) => {
    onUpdateOpsState((p) => ({
      ...p,
      canadarm: {
        ...p.canadarm,
        shoulderDeg: Math.max(25, Math.min(155, p.canadarm.shoulderDeg + dx * 8)),
        elbowDeg: Math.max(-120, Math.min(120, p.canadarm.elbowDeg + dy * 10)),
      },
    }));
  };

  return (
    <div className="space-y-4">
      {/* Segment Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-cyan-500/30 bg-[#091122] p-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
            <Orbit className="h-4 w-4" />
            <span>Mission Phase 2 · Space Action Sandbox</span>
          </div>
          <h2 className="mt-1 font-display text-2xl font-black text-white">
            Sling Orbits, Snap Planet Pics &amp; Dodge Hazards!
          </h2>
          <p className="mt-0.5 text-xs text-slate-300">
            Drag the glowing Slingshot Arrow to bend your orbit, tap SNAP PHOTO to capture target rings, and grab pods with Canadarm3!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onTriggerHazardDrill()}
            className="border border-amber-400/60 bg-amber-950/40 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/50 cursor-pointer"
          >
            Trigger Action Event!
          </button>
          <button
            type="button"
            onClick={onPrevSegment}
            className="flex items-center gap-1 border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Launch</span>
          </button>
          <button
            type="button"
            onClick={onProceedToGround}
            className="flex items-center gap-2 bg-emerald-400 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-300 cursor-pointer"
          >
            <span>Next: Laser Dish Link</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Live Action Event Banner (Debris Dodge / Solar Flare Shield / Power Save) */}
      {opsState.activeHazard && (
        <div className="border-2 border-rose-500 bg-rose-950/55 p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-300 shrink-0" />
            <div>
              <div className="flex items-center gap-2 font-display text-base font-black text-white">
                <span>
                  {opsState.activeHazard.type === 'debris'
                    ? 'INCOMING SPACE JUNK! DODGE NOW!'
                    : opsState.activeHazard.type === 'solar-flare'
                      ? 'SOLAR FLARE ALERT! FLIP HEAT SHIELD!'
                      : 'SHADOW BATTERY LOW! SAVE POWER!'}
                </span>
                <span className="bg-rose-500 text-slate-950 px-2 py-0.5 text-xs font-black">
                  {Math.max(0, opsState.activeHazard.timeRemainingSec).toFixed(1)}s
                </span>
              </div>
              <p className="text-xs text-rose-100 mt-0.5">{opsState.activeHazard.actionHint}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {opsState.activeHazard.type === 'debris' && (
              <>
                <button
                  type="button"
                  onClick={() => handleDodgeDebris('up')}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2.5 text-xs font-black cursor-pointer"
                >
                  ▲ DODGE UP!
                </button>
                <button
                  type="button"
                  onClick={() => handleDodgeDebris('down')}
                  className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 px-4 py-2.5 text-xs font-black cursor-pointer"
                >
                  ▼ DODGE DOWN!
                </button>
              </>
            )}
            {opsState.activeHazard.type === 'solar-flare' && (
              <button
                type="button"
                onClick={handleFlipShield}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-5 py-2.5 text-xs font-black cursor-pointer flex items-center gap-1.5"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>FLIP HEAT SHIELD!</span>
              </button>
            )}
            {opsState.activeHazard.type === 'eclipse-drain' && (
              <button
                type="button"
                onClick={onShedHeavyPayloads}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-5 py-2.5 text-xs font-black cursor-pointer"
              >
                POWER SAVER MODE!
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Split: Space Arena Canvas (7 cols) + Action Controls (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Space Canvas + Instant Snapshot Pop-Up */}
        <div className="lg:col-span-7 border border-slate-800 bg-[#040814] flex flex-col relative overflow-hidden min-h-[480px]">
          <div className="flex items-center justify-between gap-2 p-2.5 border-b border-slate-800 bg-[#080d19]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewportMode('arcade-2d')}
                className={`px-3 py-1.5 text-xs font-bold cursor-pointer ${
                  viewportMode === 'arcade-2d' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                2D Slingshot Arena
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('orbital-3d')}
                className={`px-3 py-1.5 text-xs font-bold cursor-pointer ${
                  viewportMode === 'orbital-3d' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                3D Planet View
              </button>
            </div>

            <div className="text-xs font-bold text-emerald-300">
              Snapshots: {capturedCount}/{landmarks.length}
            </div>
          </div>

          <div className="flex-1 relative flex items-center justify-center">
            {viewportMode === 'arcade-2d' ? (
              <canvas
                ref={arenaCanvasRef}
                width={580}
                height={430}
                onPointerDown={(e) => {
                  dragSlingshotRef.current = true;
                  updateSlingshotFromPointer(e);
                }}
                onPointerMove={(e) => {
                  if (dragSlingshotRef.current) updateSlingshotFromPointer(e);
                }}
                onPointerUp={() => {
                  dragSlingshotRef.current = false;
                }}
                onPointerLeave={() => {
                  dragSlingshotRef.current = false;
                }}
                className="w-full h-full max-h-[430px] object-contain cursor-crosshair block touch-none"
              />
            ) : (
              <NasaOrbitalScene
                targetBody={selectedObjective.targetBody}
                orbitState={orbitState}
                hasLineOfSight={hasLineOfSight}
                activeStationId={activeStationId}
                activeInstrumentsCount={activeInstruments.length}
                isBurning={burnFlash}
                cameraPreset="hero"
                predictedOrbit={{
                  altitudeKm: predicted.predictedAltKm,
                  eccentricity: predicted.predictedEcc,
                  inclinationDeg: predicted.predictedIncDeg,
                }}
                maneuverNodeAnomalyDeg={slingshotAngleDeg}
                solarPanelAngleDeg={opsState.solarPanelAngleDeg}
                radiationAlert={opsState.activeHazard?.type === 'solar-flare'}
                debrisAlert={opsState.activeHazard?.type === 'debris'}
                radarPulseActive={scanFlash}
              />
            )}

            {/* Instant Illustrated Discovery Snapshot Pop-up */}
            {snapshotPopup && (
              <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-[320px] z-20 border-2 border-emerald-400 bg-[#080d19]/98 p-3 shadow-2xl">
                <div className="flex items-start gap-3">
                  <img
                    src={snapshotPopup.artUrl}
                    alt={snapshotPopup.title}
                    referrerPolicy="no-referrer"
                    className="w-20 h-16 object-cover border border-emerald-400/50 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black uppercase text-emerald-300">
                        SNAPSHOT COLLECTED! ★★★
                      </span>
                      <button
                        type="button"
                        onClick={() => setSnapshotPopup(null)}
                        aria-label="Close snapshot preview"
                        className="text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="font-display text-sm font-bold text-white truncate">
                      {snapshotPopup.title}
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug mt-0.5">{snapshotPopup.fact}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Friendly Bottom Status Strip */}
          <div className="grid grid-cols-3 gap-2 border-t border-slate-800 bg-[#080d19] p-3 text-xs font-bold">
            <div className="flex items-center gap-2">
              <BatteryCharging className="h-4 w-4 text-emerald-400" />
              <span className="text-slate-300">Battery:</span>
              <span className="text-emerald-300">{Math.round(opsState.batteryPct)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyan-400" />
              <span className="text-slate-300">Craft Health:</span>
              <span className="text-cyan-300">{Math.round(opsState.hullIntegrityPct)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-400" />
              <span className="text-slate-300">Fuel:</span>
              <span className="text-amber-300">{fuelPct}%</span>
            </div>
          </div>
        </div>

        {/* Right: 3 Clean Action Tabs */}
        <div className="lg:col-span-5 space-y-3">
          <div className="grid grid-cols-3 gap-1 border border-slate-800 bg-[#080d19] p-1">
            <button
              type="button"
              onClick={() => setActiveTab('slingshot')}
              className={`py-2 text-xs font-black cursor-pointer ${
                activeTab === 'slingshot' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Orbit &amp; Snap
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('canadarm')}
              className={`py-2 text-xs font-black cursor-pointer ${
                activeTab === 'canadarm' ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Canadarm Claw ({opsState.canadarm.completedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('craft')}
              className={`py-2 text-xs font-black cursor-pointer ${
                activeTab === 'craft' ? 'bg-emerald-400 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Gadgets &amp; Solar
            </button>
          </div>

          {toastTip && (
            <div className="border border-cyan-400/50 bg-cyan-950/40 px-3 py-2 text-xs font-bold text-cyan-200 flex items-center justify-between gap-2">
              <span>{toastTip}</span>
              <button
                type="button"
                onClick={() => setToastTip(null)}
                className="text-cyan-300 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* TAB 1: Slingshot + Photo Snap */}
          {activeTab === 'slingshot' && (
            <div className="border border-slate-800 bg-[#080d19] p-4 space-y-4">
              {/* Slingshot Box */}
              <div className="space-y-2.5 border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-black text-white">1. Slingshot Orbit Path</h3>
                  <span className="text-xs font-bold text-amber-300">
                    {slingshotBoostMs >= 0 ? 'Boost Wider' : 'Shrink Closer'}
                  </span>
                </div>
                <input
                  type="range"
                  min={-220}
                  max={420}
                  step={10}
                  value={slingshotBoostMs}
                  onChange={(e) => setSlingshotBoostMs(parseInt(e.target.value, 10))}
                  aria-label="Slingshot Boost Power"
                  className="w-full accent-amber-400 h-2 bg-slate-800 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={handleFireSlingshot}
                  className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 py-2.5 px-4 text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Flame className="h-4 w-4" />
                  <span>FIRE THRUSTERS ALONG PATH!</span>
                </button>
              </div>

              {/* Target Snap List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-black text-white">2. Snap Planet Discoveries</h3>
                  <button
                    type="button"
                    onClick={() => handleSnapTarget()}
                    className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 px-3 py-1.5 text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>SNAP NEXT!</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[245px] overflow-y-auto pr-1">
                  {landmarks.map((lm) => {
                    const info = getFriendlyLandmarkFact(lm);
                    return (
                      <div
                        key={lm.id}
                        className={`border p-2.5 flex items-center justify-between gap-2 ${
                          lm.captured
                            ? 'border-emerald-500/50 bg-emerald-950/25'
                            : 'border-slate-800 bg-slate-900/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-display text-xs font-bold text-white truncate">
                            {info.shortName}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {lm.captured ? 'Saved for Download ✓' : 'Waiting for Photo Snap!'}
                          </div>
                        </div>

                        {lm.captured ? (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs font-black shrink-0">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>SNAPPED!</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSnapTarget(lm.id)}
                            className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 px-3 py-1.5 text-[11px] font-black shrink-0 cursor-pointer"
                          >
                            SNAP PHOTO!
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Canadarm Claw Mini-Game */}
          {activeTab === 'canadarm' && (
            <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-black text-white flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-amber-400" />
                  CSA Canadarm3 Supply Catch
                </h3>
                <span className="text-xs font-bold text-emerald-300">
                  Caught: {opsState.canadarm.completedCount}
                </span>
              </div>

              <canvas
                ref={clawCanvasRef}
                width={380}
                height={200}
                className="w-full h-[185px] border border-slate-800 block"
              />

              {opsState.canadarm.lastOpFeedback && (
                <div className="border border-cyan-500/40 bg-cyan-950/30 p-2 text-xs text-cyan-200">
                  {opsState.canadarm.lastOpFeedback}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div />
                <button
                  type="button"
                  onClick={() => nudgeCanadarm(0, 1)}
                  className="border border-slate-700 bg-slate-800 py-2 text-xs font-black text-white hover:bg-slate-700 cursor-pointer"
                >
                  ▲ UP
                </button>
                <div />
                <button
                  type="button"
                  onClick={() => nudgeCanadarm(1, 0)}
                  className="border border-slate-700 bg-slate-800 py-2 text-xs font-black text-white hover:bg-slate-700 cursor-pointer"
                >
                  ◀ LEFT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResolveCanadarmCapture();
                    spawnSparks(290, 215, '#34d399', 22);
                  }}
                  className={`py-2 text-xs font-black cursor-pointer ${
                    clawLockedZone
                      ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                      : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  }`}
                >
                  {clawLockedZone ? 'GRAB IT! ✓' : 'GRAB POD'}
                </button>
                <button
                  type="button"
                  onClick={() => nudgeCanadarm(-1, 0)}
                  className="border border-slate-700 bg-slate-800 py-2 text-xs font-black text-white hover:bg-slate-700 cursor-pointer"
                >
                  RIGHT ▶
                </button>
                <div />
                <button
                  type="button"
                  onClick={() => nudgeCanadarm(0, -1)}
                  className="border border-slate-700 bg-slate-800 py-2 text-xs font-black text-white hover:bg-slate-700 cursor-pointer"
                >
                  ▼ DOWN
                </button>
                <div />
              </div>
            </div>
          )}

          {/* TAB 3: Gadgets & Solar Wings */}
          {activeTab === 'craft' && (
            <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-black text-white flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  Solar Wings &amp; Space Gadgets
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateOpsState((p) => ({
                      ...p,
                      solarPanelAngleDeg: p.sunAngleDeg,
                      shieldAngleDeg: p.sunAngleDeg,
                    }))
                  }
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-3 py-1 text-[11px] font-black cursor-pointer"
                >
                  Aim Solar at Sun!
                </button>
              </div>

              <div className="space-y-2">
                {instruments.map((inst) => (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => onToggleInstrument(inst.id)}
                    className={`w-full border p-2.5 flex items-center justify-between text-left cursor-pointer ${
                      inst.enabled
                        ? 'border-emerald-400/70 bg-emerald-950/25'
                        : 'border-slate-800 bg-slate-900/50'
                    }`}
                  >
                    <span className="text-xs font-bold text-white">{inst.name}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-black ${
                        inst.enabled ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {inst.enabled ? 'ON' : 'OFF'}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onProceedToGround}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 py-2.5 text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>Ready! Beam Photos to Earth →</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
