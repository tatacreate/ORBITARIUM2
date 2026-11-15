import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Orbit,
  Cpu,
  ArrowRight,
  Flame,
  Scale,
  ShieldAlert,
  Sun,
  Radar,
  CheckCircle2,
  BatteryCharging,
  Crosshair,
  Wrench,
  FastForward,
  AlertTriangle,
} from 'lucide-react';
import { audioSynth } from '../../audio/synth';
import {
  CELESTIAL_BODIES,
  calculateHohmannTransfer,
  computeCanadarmEndEffector,
  getTradeOffScenarios,
  predictManeuverOrbit,
} from '../../engine/orbitalMechanics';
import { NasaOrbitalScene } from '../../three/NasaOrbitalScene';
import type {
  CsaChallengeState,
  ManeuverNodePlan,
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

function angleDiffDeg(a: number, b: number): number {
  const diff = ((a - b + 540) % 360) - 180;
  return Math.abs(diff);
}

export function SpaceSegment({
  selectedObjective,
  orbitState,
  onUpdateOrbitParams,
  onWarpToAnomaly,
  selectedPropulsion,
  propellantBudgetKg,
  onApplyManeuverBurn,
  instruments,
  onToggleInstrument,
  onShedHeavyPayloads,
  hasLineOfSight,
  activeStationId,
  csaChallenges,
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
  const [viewportMode, setViewportMode] = useState<'tactical-2d' | 'orbital-3d'>('tactical-2d');
  const [cameraPreset, setCameraPreset] = useState<'hero' | 'satellite' | 'earth-view' | 'ground-station'>('hero');
  const [activeTab, setActiveTab] = useState<'maneuvers' | 'canadarm' | 'targeting' | 'tradeoff'>('maneuvers');

  // Interactive Maneuver Node state
  const [maneuverNode, setManeuverNode] = useState<ManeuverNodePlan>(() => {
    const pred = predictManeuverOrbit(selectedObjective.targetBody, orbitState, { progradeMs: 120, normalMs: 0 });
    return {
      id: 'MN-1',
      trueAnomalyDeg: 90,
      progradeMs: 120,
      normalMs: 0,
      armed: true,
      burnWindowActive: false,
      executed: false,
      predictedPeKm: pred.predictedPeKm,
      predictedApKm: pred.predictedApKm,
      predictedIncDeg: pred.predictedIncDeg,
      predictedEcc: pred.predictedEcc,
    };
  });

  const [isBurningEffect, setIsBurningEffect] = useState(false);
  const [radarPulseActive, setRadarPulseActive] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  const tacticalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const armCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingHandleRef = useRef<'none' | 'prograde' | 'normal'>('none');

  // Keep maneuver prediction synced when orbit or node vectors change
  const predicted = predictManeuverOrbit(selectedObjective.targetBody, orbitState, {
    progradeMs: maneuverNode.progradeMs,
    normalMs: maneuverNode.normalMs,
  });

  const distToNodeDeg = angleDiffDeg(orbitState.trueAnomalyDeg, maneuverNode.trueAnomalyDeg);
  const isBurnWindowActive = distToNodeDeg <= 22;

  const activeInstruments = instruments.filter((i) => i.enabled);
  const totalPowerDrawW = activeInstruments.reduce((sum, i) => sum + i.powerDrawW, 0) + 110;
  const solarErrorDeg = angleDiffDeg(opsState.solarPanelAngleDeg, opsState.sunAngleDeg);
  const solarEfficiency = Math.max(0.15, Math.cos((Math.min(90, solarErrorDeg) * Math.PI) / 180));
  const totalPowerGenW = orbitState.inEclipse ? 35 : Math.round(520 * solarEfficiency);
  const powerMarginW = totalPowerGenW - totalPowerDrawW;
  const shieldErrorDeg = angleDiffDeg(opsState.shieldAngleDeg, opsState.sunAngleDeg);

  const hohmannTargetAlt = Math.min(35786, orbitState.altitudeKm + 1200);
  const hohmannPlan = calculateHohmannTransfer(selectedObjective.targetBody, orbitState.altitudeKm, hohmannTargetAlt);
  const tradeOffScenarios = getTradeOffScenarios(selectedObjective);

  const handleExecuteNodeBurn = useCallback(() => {
    const dvMag = Math.sqrt(maneuverNode.progradeMs ** 2 + maneuverNode.normalMs ** 2);
    if (dvMag <= 0) return;

    const accuracyPct = isBurnWindowActive
      ? Math.max(84, Math.round(100 - distToNodeDeg * 0.7))
      : Math.max(45, Math.round(78 - distToNodeDeg * 0.3));

    setIsBurningEffect(true);
    window.setTimeout(() => setIsBurningEffect(false), 1100);

    onApplyManeuverBurn(
      {
        progradeMs: maneuverNode.progradeMs,
        normalMs: maneuverNode.normalMs,
        radialMs: 0,
      },
      accuracyPct,
    );
    setManeuverNode((prev) => ({ ...prev, executed: true }));
  }, [maneuverNode, isBurnWindowActive, distToNodeDeg, onApplyManeuverBurn]);

  // Trigger emergency burn pulse feedback
  const handleEmergencyDodgeBurn = () => {
    setIsBurningEffect(true);
    window.setTimeout(() => setIsBurningEffect(false), 900);
    onApplyManeuverBurn({ progradeMs: 32, normalMs: 12, radialMs: 0 }, 96);
  };

  // Interactive 2D GMAT Tactical Trajectory & Maneuver Node Canvas Render
  useEffect(() => {
    if (viewportMode !== 'tactical-2d') return;
    const canvas = tacticalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.fillStyle = '#040814';
    ctx.fillRect(0, 0, w, h);

    // Subtle astrodynamics grid
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
    ctx.lineWidth = 1;
    for (let r = 60; r <= 240; r += 60) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // Sun Vector Indicator on Left/Edge
    const sunRad = (opsState.sunAngleDeg * Math.PI) / 180;
    const sunX = cx + Math.cos(sunRad) * 205;
    const sunY = cy - Math.sin(sunRad) * 205;
    ctx.strokeStyle = opsState.activeHazard?.type === 'solar-flare' ? '#f43f5e' : 'rgba(251, 191, 36, 0.55)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(sunX, sunY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '10px monospace';
    ctx.fillText('SUN VECTOR', Math.min(w - 75, Math.max(8, sunX - 28)), Math.max(14, sunY - 12));

    // Visual Planet Sphere at Center
    const planetVisR = 46;
    const pGrad = ctx.createRadialGradient(cx - 12, cy - 12, 8, cx, cy, planetVisR);
    if (selectedObjective.targetBody === 'mars') {
      pGrad.addColorStop(0, '#fb923c');
      pGrad.addColorStop(1, '#7c2d12');
    } else if (selectedObjective.targetBody === 'moon') {
      pGrad.addColorStop(0, '#e2e8f0');
      pGrad.addColorStop(1, '#475569');
    } else {
      pGrad.addColorStop(0, '#38bdf8');
      pGrad.addColorStop(1, '#0c4a6e');
    }
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, planetVisR, 0, Math.PI * 2);
    ctx.fill();

    // Shadow Eclipse Cone behind Planet (opposite Sun vector)
    ctx.fillStyle = 'rgba(2, 6, 18, 0.45)';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(sunRad + Math.PI / 2) * planetVisR, cy - Math.sin(sunRad + Math.PI / 2) * planetVisR);
    ctx.lineTo(cx - Math.cos(sunRad) * 260 + Math.cos(sunRad + Math.PI / 2) * planetVisR, cy + Math.sin(sunRad) * 260 - Math.sin(sunRad + Math.PI / 2) * planetVisR);
    ctx.lineTo(cx - Math.cos(sunRad) * 260 - Math.cos(sunRad + Math.PI / 2) * planetVisR, cy + Math.sin(sunRad) * 260 + Math.sin(sunRad + Math.PI / 2) * planetVisR);
    ctx.lineTo(cx - Math.cos(sunRad + Math.PI / 2) * planetVisR, cy + Math.sin(sunRad + Math.PI / 2) * planetVisR);
    ctx.closePath();
    ctx.fill();

    // Orbit Geometry Scaling
    const baseRx = Math.min(165, Math.max(82, 82 + (orbitState.altitudeKm / 2500) * 65));
    const baseRy = baseRx * Math.sqrt(Math.max(0.28, 1 - orbitState.eccentricity ** 2));

    // Predicted Transfer Orbit Ellipse (Dashed Amber)
    const predRx = Math.min(210, Math.max(70, 82 + (predicted.predictedAltKm / 2500) * 65));
    const predRy = predRx * Math.sqrt(Math.max(0.28, 1 - predicted.predictedEcc ** 2));

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const th = (i / 90) * Math.PI * 2;
      const px = cx + predRx * Math.cos(th);
      const py = cy - predRy * Math.sin(th);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Current Active Orbit Ellipse (Solid Cyan)
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const th = (i / 90) * Math.PI * 2;
      const ox = cx + baseRx * Math.cos(th);
      const oy = cy - baseRy * Math.sin(th);
      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
    }
    ctx.stroke();

    // Maneuver Node Marker (MN-1) + Burn Window Arc
    const mnRad = (maneuverNode.trueAnomalyDeg * Math.PI) / 180;
    const mnX = cx + baseRx * Math.cos(mnRad);
    const mnY = cy - baseRy * Math.sin(mnRad);

    // Highlight ±22° Burn Window Arc around node
    ctx.strokeStyle = isBurnWindowActive ? '#10b981' : 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let deg = maneuverNode.trueAnomalyDeg - 22; deg <= maneuverNode.trueAnomalyDeg + 22; deg += 2) {
      const rad = (deg * Math.PI) / 180;
      const wx = cx + baseRx * Math.cos(rad);
      const wy = cy - baseRy * Math.sin(rad);
      if (deg === maneuverNode.trueAnomalyDeg - 22) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.stroke();

    // Prograde / Retrograde Draggable Vector Handle from Node
    const tanX = -baseRx * Math.sin(mnRad);
    const tanY = -baseRy * Math.cos(mnRad);
    const tanLen = Math.hypot(tanX, tanY) || 1;
    const ux = tanX / tanLen;
    const uy = tanY / tanLen;
    const handleDist = (maneuverNode.progradeMs / 600) * 65;
    const hx = mnX + ux * handleDist;
    const hy = mnY + uy * handleDist;

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mnX, mnY);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    // Prograde Drag Handle Circle
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(hx, hy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Maneuver Node Diamond
    ctx.save();
    ctx.translate(mnX, mnY);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = isBurnWindowActive ? '#10b981' : '#f59e0b';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`MN-1 (${Math.round(maneuverNode.trueAnomalyDeg)}°)`, mnX + 12, mnY - 10);

    // Spacecraft Position on Orbit
    const nuRad = (orbitState.trueAnomalyDeg * Math.PI) / 180;
    const sx = cx + baseRx * Math.cos(nuRad);
    const sy = cy - baseRy * Math.sin(nuRad);

    // Debris Threat Marker if Debris Hazard Active
    if (opsState.activeHazard?.type === 'debris') {
      const debRad = nuRad + 0.35;
      const dx = cx + (baseRx + 6) * Math.cos(debRad);
      const dy = cy - (baseRy + 6) * Math.sin(debRad);
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(dx, dy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
      ctx.beginPath();
      ctx.arc(dx, dy, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fda4af';
      ctx.fillText('DEBRIS!', dx + 10, dy + 4);
    }

    // Spacecraft Icon + Shield & Solar Orientation Indicators
    ctx.save();
    ctx.translate(sx, sy);

    // Radiation Shield Arc facing shieldAngleDeg
    const shRad = (opsState.shieldAngleDeg * Math.PI) / 180;
    ctx.strokeStyle = shieldErrorDeg <= 22 ? '#10b981' : '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 15, -shRad - 0.65, -shRad + 0.65);
    ctx.stroke();

    // Solar Panel Wings
    const solRad = (opsState.solarPanelAngleDeg * Math.PI) / 180;
    ctx.rotate(-solRad);
    ctx.fillStyle = solarErrorDeg <= 20 ? '#38bdf8' : '#64748b';
    ctx.fillRect(-13, -2, 26, 4);
    ctx.restore();

    // Spacecraft Core Dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Radar Scan Pulse Ring when firing
    if (radarPulseActive) {
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 26, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Legend Corner
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText('Click orbit to place MN-1 · Drag amber handle for Δv', 10, 18);
    ctx.fillStyle = isBurnWindowActive ? '#34d399' : '#cbd5e1';
    ctx.fillText(
      `SAT ν=${Math.round(orbitState.trueAnomalyDeg)}° | MN-1 Δ=${Math.round(distToNodeDeg)}° ${isBurnWindowActive ? '(BURN WINDOW ACTIVE!)' : ''}`,
      10,
      h - 10,
    );
  }, [
    viewportMode,
    orbitState,
    maneuverNode,
    predicted,
    selectedObjective.targetBody,
    opsState,
    isBurnWindowActive,
    distToNodeDeg,
    shieldErrorDeg,
    solarErrorDeg,
    radarPulseActive,
  ]);

  // Mouse Interactions on 2D GMAT Tactical Canvas (Click to place MN-1 or Drag Prograde handle)
  const handleTacticalPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = tacticalCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const baseRx = Math.min(165, Math.max(82, 82 + (orbitState.altitudeKm / 2500) * 65));
    const baseRy = baseRx * Math.sqrt(Math.max(0.28, 1 - orbitState.eccentricity ** 2));

    const mnRad = (maneuverNode.trueAnomalyDeg * Math.PI) / 180;
    const mnX = cx + baseRx * Math.cos(mnRad);
    const mnY = cy - baseRy * Math.sin(mnRad);
    const tanX = -baseRx * Math.sin(mnRad);
    const tanY = -baseRy * Math.cos(mnRad);
    const tanLen = Math.hypot(tanX, tanY) || 1;
    const handleDist = (maneuverNode.progradeMs / 600) * 65;
    const hx = mnX + (tanX / tanLen) * handleDist;
    const hy = mnY + (tanY / tanLen) * handleDist;

    if (Math.hypot(px - hx, py - hy) < 18) {
      draggingHandleRef.current = 'prograde';
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    // Place node at clicked orbital true anomaly
    const angleRad = Math.atan2(-(py - cy) / baseRy, (px - cx) / baseRx);
    const angleDeg = ((angleRad * 180) / Math.PI + 360) % 360;
    audioSynth.playSelect();
    setManeuverNode((prev) => ({
      ...prev,
      trueAnomalyDeg: Math.round(angleDeg),
      executed: false,
    }));
  };

  const handleTacticalPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingHandleRef.current !== 'prograde') return;
    const canvas = tacticalCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const baseRx = Math.min(165, Math.max(82, 82 + (orbitState.altitudeKm / 2500) * 65));
    const baseRy = baseRx * Math.sqrt(Math.max(0.28, 1 - orbitState.eccentricity ** 2));
    const mnRad = (maneuverNode.trueAnomalyDeg * Math.PI) / 180;
    const mnX = cx + baseRx * Math.cos(mnRad);
    const mnY = cy - baseRy * Math.sin(mnRad);
    const tanX = -baseRx * Math.sin(mnRad);
    const tanY = -baseRy * Math.cos(mnRad);
    const tanLen = Math.hypot(tanX, tanY) || 1;

    const projPx = (px - mnX) * (tanX / tanLen) + (py - mnY) * (tanY / tanLen);
    const nextPrograde = Math.max(-400, Math.min(600, Math.round((projPx / 65) * 600 / 10) * 10));
    setManeuverNode((prev) => ({ ...prev, progradeMs: nextPrograde, executed: false }));
  };

  const handleTacticalPointerUp = () => {
    draggingHandleRef.current = 'none';
  };

  // CSA Canadarm3 Robotic Bay Canvas Render
  const armKinematics = computeCanadarmEndEffector(
    opsState.canadarm.shoulderDeg,
    opsState.canadarm.elbowDeg,
    opsState.canadarm.wristDeg,
  );
  const armDistToTarget = Math.hypot(
    armKinematics.endX - opsState.canadarm.targetX,
    armKinematics.endY - opsState.canadarm.targetY,
  );
  const armInGrappleZone = armDistToTarget <= 0.16;

  useEffect(() => {
    if (activeTab !== 'canadarm') return;
    const canvas = armCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#040814';
    ctx.fillRect(0, 0, w, h);

    // Bay Grid
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Coordinate transform: normalized bay x in [-1, 1], y in [0, 1.3] -> pixels
    const toPx = (nx: number, ny: number) => ({
      x: w * 0.5 + nx * (w * 0.42),
      y: h - 28 - ny * (h * 0.72),
    });

    // Spacecraft Cargo Deck Base
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, h - 28, w, 28);
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(0, h - 28);
    ctx.lineTo(w, h - 28);
    ctx.stroke();

    // Target Payload / Gateway Module / Damaged Solar Wing
    const tPx = toPx(opsState.canadarm.targetX, opsState.canadarm.targetY);
    ctx.save();
    ctx.translate(tPx.x, tPx.y);
    ctx.strokeStyle = armInGrappleZone ? '#10b981' : '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (opsState.canadarm.targetType === 'cubesat') {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-12, -12, 24, 24);
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(-24, -4, 12, 8);
      ctx.fillRect(12, -4, 12, 8);
    } else if (opsState.canadarm.targetType === 'gateway-module') {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-18, -10, 36, 20);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-6, -14, 12, 4);
    } else {
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(-20, -8, 40, 16);
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, -8);
      ctx.lineTo(14, 8);
      ctx.stroke();
    }
    ctx.restore();

    // Canadarm3 Articulated Links
    const pts = armKinematics.joints.map((j) => toPx(j.x, j.y));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 10;
    ctx.beginPath();
    pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 4;
    ctx.beginPath();
    pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();

    // Joint Servos
    pts.forEach((p, idx) => {
      ctx.fillStyle = idx === pts.length - 1 ? (armInGrappleZone ? '#10b981' : '#f59e0b') : '#0f172a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, idx === pts.length - 1 ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = idx === pts.length - 1 ? '#ffffff' : '#22d3ee';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(
      `TARGET: ${opsState.canadarm.targetType.toUpperCase()} · RANGE: ${(armDistToTarget * 10).toFixed(1)} m`,
      10,
      16,
    );
  }, [activeTab, opsState.canadarm, armKinematics, armDistToTarget, armInGrappleZone]);

  // Keyboard support when Canadarm tab is active
  useEffect(() => {
    if (activeTab !== 'canadarm') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'q') {
        onUpdateOpsState((p) => ({ ...p, canadarm: { ...p.canadarm, shoulderDeg: Math.min(155, p.canadarm.shoulderDeg + 5) } }));
      } else if (e.key.toLowerCase() === 'e') {
        onUpdateOpsState((p) => ({ ...p, canadarm: { ...p.canadarm, shoulderDeg: Math.max(25, p.canadarm.shoulderDeg - 5) } }));
      } else if (e.key.toLowerCase() === 'w') {
        onUpdateOpsState((p) => ({ ...p, canadarm: { ...p.canadarm, elbowDeg: Math.min(120, p.canadarm.elbowDeg + 6) } }));
      } else if (e.key.toLowerCase() === 's') {
        onUpdateOpsState((p) => ({ ...p, canadarm: { ...p.canadarm, elbowDeg: Math.max(-120, p.canadarm.elbowDeg - 6) } }));
      } else if (e.key.toLowerCase() === 'a') {
        onUpdateOpsState((p) => ({ ...p, canadarm: { ...p.canadarm, wristDeg: Math.min(90, p.canadarm.wristDeg + 6) } }));
      } else if (e.key.toLowerCase() === 'd') {
        onUpdateOpsState((p) => ({ ...p, canadarm: { ...p.canadarm, wristDeg: Math.max(-90, p.canadarm.wristDeg - 6) } }));
      } else if (e.code === 'Space') {
        e.preventDefault();
        onResolveCanadarmCapture();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, onUpdateOpsState, onResolveCanadarmCapture]);

  const handleFireScan = (landmarkId?: string) => {
    setRadarPulseActive(true);
    window.setTimeout(() => setRadarPulseActive(false), 950);
    const res = onFireInstrumentScan(landmarkId);
    setScanFeedback(res.message);
  };

  return (
    <div className="space-y-4">
      {/* Segment Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-800 bg-[#080d19] p-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="border border-cyan-500/50 bg-cyan-950/40 px-2 py-0.5 font-mono-tab text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              NASA Segment 2: Active Space Operations
            </span>
            <span className="text-xs text-slate-400">· GMAT Maneuver Nodes, CSA Canadarm3 &amp; Hazard Defense</span>
          </div>
          <h2 className="mt-1 font-display text-xl md:text-2xl font-bold text-white">
            Orbital Piloting, Robotic Capture &amp; Real-Time Space Hazards
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Place &amp; fire maneuver nodes on the GMAT orbit ring, grapple payloads with Canadarm3, shield/orient against space storms, and pulse-scan planetary surface targets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onTriggerHazardDrill()}
            className="border border-amber-500/50 bg-amber-950/30 px-3 py-2 font-mono-tab text-[11px] font-bold text-amber-300 hover:bg-amber-900/40 cursor-pointer"
          >
            Trigger Space Crisis Drill
          </button>
          <button
            type="button"
            onClick={onPrevSegment}
            className="border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            ← Launch
          </button>
          <button
            type="button"
            onClick={onProceedToGround}
            className="flex items-center gap-2 bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
          >
            <span>Segment 3: Ground Dish →</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Live Crisis Alarm Banner */}
      {opsState.activeHazard && (
        <div
          className={`border p-3.5 flex flex-wrap items-center justify-between gap-3 ${
            opsState.activeHazard.severity === 'critical'
              ? 'border-rose-500/70 bg-rose-950/40 text-rose-100'
              : 'border-amber-500/70 bg-amber-950/35 text-amber-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <div className="flex flex-wrap items-center gap-2 font-mono-tab text-xs font-bold uppercase">
                <span>▲ ACTIVE SPACE HAZARD: {opsState.activeHazard.title}</span>
                <span className="border border-rose-400/50 bg-rose-950/80 px-2 py-0.5 text-[11px] text-rose-200">
                  T-{Math.max(0, opsState.activeHazard.timeRemainingSec).toFixed(1)}s
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-200">{opsState.activeHazard.detail}</p>
              <p className="mt-1 font-mono-tab text-[11px] text-cyan-300">
                Required Action: {opsState.activeHazard.actionHint}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {opsState.activeHazard.type === 'debris' && (
              <button
                type="button"
                onClick={handleEmergencyDodgeBurn}
                className="bg-rose-500 hover:bg-rose-400 text-slate-950 px-3.5 py-2 font-mono-tab text-xs font-bold uppercase cursor-pointer"
              >
                Fire 32 m/s Dodge Burn
              </button>
            )}
            {opsState.activeHazard.type === 'solar-flare' && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateOpsState((p) => ({ ...p, shieldAngleDeg: p.sunAngleDeg }))
                  }
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-2 font-mono-tab text-xs font-bold uppercase cursor-pointer"
                >
                  Slew Shield to Sun ({opsState.sunAngleDeg}°)
                </button>
                <button
                  type="button"
                  onClick={onShedHeavyPayloads}
                  className="border border-cyan-400 bg-cyan-950/50 text-cyan-200 hover:bg-cyan-900/60 px-3 py-2 font-mono-tab text-xs font-bold uppercase cursor-pointer"
                >
                  Shed Payloads
                </button>
              </>
            )}
            {opsState.activeHazard.type === 'eclipse-drain' && (
              <>
                <button
                  type="button"
                  onClick={onShedHeavyPayloads}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-2 font-mono-tab text-xs font-bold uppercase cursor-pointer"
                >
                  Shed Power Load
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateOpsState((p) => ({ ...p, solarPanelAngleDeg: p.sunAngleDeg }))
                  }
                  className="border border-cyan-400 bg-cyan-950/50 text-cyan-200 hover:bg-cyan-900/60 px-3 py-2 font-mono-tab text-xs font-bold uppercase cursor-pointer"
                >
                  Track Solar Panels ({opsState.sunAngleDeg}°)
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Grid: Dual Tactical / 3D Viewport (Left 7 cols) & Action Cockpit (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 flex flex-col border border-slate-800 bg-slate-950 relative overflow-hidden min-h-[540px]">
          {/* Top Switcher Bar */}
          <div className="z-10 flex flex-wrap items-center justify-between gap-2 p-2.5 border-b border-slate-800 bg-[#070c18]">
            <div className="flex items-center gap-1 border border-slate-800 bg-slate-900 p-0.5 font-mono-tab text-[11px]">
              <button
                type="button"
                onClick={() => setViewportMode('tactical-2d')}
                className={`px-2.5 py-1 font-bold cursor-pointer ${
                  viewportMode === 'tactical-2d' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                2D GMAT Maneuver Node Canvas
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('orbital-3d')}
                className={`px-2.5 py-1 font-bold cursor-pointer ${
                  viewportMode === 'orbital-3d' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                3D Orbital Spacecraft View
              </button>
            </div>

            {viewportMode === 'orbital-3d' ? (
              <div className="flex items-center gap-1 font-mono-tab text-[10px]">
                {(['hero', 'satellite', 'earth-view', 'ground-station'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCameraPreset(preset)}
                    className={`px-2 py-1 uppercase border cursor-pointer ${
                      cameraPreset === preset
                        ? 'border-cyan-400 bg-cyan-500 text-slate-950 font-bold'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
                    }`}
                  >
                    {preset === 'earth-view' ? 'Polar' : preset === 'ground-station' ? 'Station' : preset}
                  </button>
                ))}
              </div>
            ) : (
              <span className="font-mono-tab text-[10px] text-amber-300">
                {body.name} · Pe {orbitState.periapsisKm}km / Ap {orbitState.apoapsisKm}km · e={orbitState.eccentricity}
              </span>
            )}
          </div>

          {/* Active Viewport */}
          <div className="flex-1 relative flex items-center justify-center bg-[#040814]">
            {viewportMode === 'tactical-2d' ? (
              <canvas
                ref={tacticalCanvasRef}
                width={580}
                height={430}
                onPointerDown={handleTacticalPointerDown}
                onPointerMove={handleTacticalPointerMove}
                onPointerUp={handleTacticalPointerUp}
                onPointerLeave={handleTacticalPointerUp}
                className="w-full h-full max-h-[450px] object-contain cursor-crosshair block"
              />
            ) : (
              <NasaOrbitalScene
                targetBody={selectedObjective.targetBody}
                orbitState={orbitState}
                hasLineOfSight={hasLineOfSight}
                activeStationId={activeStationId}
                activeInstrumentsCount={activeInstruments.length}
                isBurning={isBurningEffect}
                cameraPreset={cameraPreset}
                predictedOrbit={{
                  altitudeKm: predicted.predictedAltKm,
                  eccentricity: predicted.predictedEcc,
                  inclinationDeg: predicted.predictedIncDeg,
                }}
                maneuverNodeAnomalyDeg={maneuverNode.trueAnomalyDeg}
                solarPanelAngleDeg={opsState.solarPanelAngleDeg}
                radiationAlert={opsState.activeHazard?.type === 'solar-flare'}
                debrisAlert={opsState.activeHazard?.type === 'debris'}
                radarPulseActive={radarPulseActive}
              />
            )}
          </div>

          {/* Bottom Live Bus Status Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2.5 border-t border-slate-800 bg-[#070b16] font-mono-tab text-[10px]">
            <div>
              <span className="text-slate-500 block">BATTERY SoC</span>
              <strong className={opsState.batteryPct < 25 ? 'text-rose-400' : 'text-emerald-400'}>
                {opsState.batteryPct.toFixed(0)}% ({powerMarginW >= 0 ? `+${powerMarginW}W` : `${powerMarginW}W`})
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">HULL INTEGRITY</span>
              <strong className={opsState.hullIntegrityPct < 60 ? 'text-rose-400' : 'text-cyan-300'}>
                {opsState.hullIntegrityPct.toFixed(0)}%
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">RADIATION DOSE</span>
              <strong className={opsState.radiationDosePct > 55 ? 'text-rose-400' : 'text-amber-300'}>
                {opsState.radiationDosePct.toFixed(0)}%
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">PROPELLANT LEFT</span>
              <strong className="text-white">{propellantBudgetKg} kg</strong>
            </div>
            <div>
              <span className="text-slate-500 block">J2 PRECESSION</span>
              <strong className="text-amber-300">{orbitState.perturbations.j2NodalPrecessionDegPerDay}°/d</strong>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Interactive Flight Tabs */}
        <div className="lg:col-span-5 space-y-3">
          {/* Quick Ops Score Bar */}
          <div className="border border-slate-800 bg-[#080d19] px-3 py-2 flex flex-wrap items-center justify-between gap-2 font-mono-tab text-[11px]">
            <span className="text-cyan-300">
              Hazards Survived: <strong className="text-emerald-400">{opsState.hazardsSurvived}</strong>
              {' · '}Arm Ops: <strong className="text-amber-300">{opsState.canadarm.completedCount}</strong>
            </span>
            <span className="text-slate-300">
              Targets: <strong className="text-cyan-300">{landmarks.filter((l) => l.captured).length}/{landmarks.length}</strong>
            </span>
          </div>

          <div className="grid grid-cols-4 border-b border-slate-800 bg-[#080d19]">
            <button
              type="button"
              onClick={() => setActiveTab('maneuvers')}
              className={`py-2 px-1 text-center text-[11px] font-mono-tab font-bold cursor-pointer ${
                activeTab === 'maneuvers'
                  ? 'border-b-2 border-cyan-400 bg-cyan-950/30 text-cyan-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Maneuvers
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('canadarm')}
              className={`py-2 px-1 text-center text-[11px] font-mono-tab font-bold cursor-pointer ${
                activeTab === 'canadarm'
                  ? 'border-b-2 border-amber-400 bg-amber-950/30 text-amber-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Canadarm3
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('targeting')}
              className={`py-2 px-1 text-center text-[11px] font-mono-tab font-bold cursor-pointer ${
                activeTab === 'targeting'
                  ? 'border-b-2 border-emerald-400 bg-emerald-950/30 text-emerald-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Targeting
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tradeoff')}
              className={`py-2 px-1 text-center text-[11px] font-mono-tab font-bold cursor-pointer ${
                activeTab === 'tradeoff'
                  ? 'border-b-2 border-cyan-400 bg-cyan-950/30 text-cyan-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Trade-Offs
            </button>
          </div>

          {/* TAB 1: Interactive Maneuver Nodes + Attitude/Power/Shield Controls */}
          {activeTab === 'maneuvers' && (
            <div className="space-y-3">
              {/* Maneuver Node Controller */}
              <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3 font-mono-tab">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-amber-400" />
                    <h3 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                      GMAT Node MN-1 @ {maneuverNode.trueAnomalyDeg}° Anomaly
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => onWarpToAnomaly((maneuverNode.trueAnomalyDeg - 8 + 360) % 360)}
                    className="flex items-center gap-1 border border-cyan-500/40 bg-cyan-950/40 px-2 py-1 text-[10px] font-bold text-cyan-300 hover:bg-cyan-900/50 cursor-pointer"
                  >
                    <FastForward className="h-3 w-3" />
                    Warp to Burn Window
                  </button>
                </div>

                {/* Predicted Orbit Preview Box */}
                <div className="grid grid-cols-4 gap-1.5 border border-amber-500/30 bg-amber-950/15 p-2 text-[10px]">
                  <div>
                    <span className="text-slate-400 block">PRED Pe</span>
                    <strong className="text-amber-300">{predicted.predictedPeKm} km</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">PRED Ap</span>
                    <strong className="text-amber-300">{predicted.predictedApKm} km</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">PRED Inc</span>
                    <strong className="text-cyan-300">{predicted.predictedIncDeg}°</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">PRED Ecc</span>
                    <strong className="text-white">{predicted.predictedEcc}</strong>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Prograde / Retrograde (Δv_v)</span>
                    <strong className={maneuverNode.progradeMs >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {maneuverNode.progradeMs >= 0 ? `+${maneuverNode.progradeMs}` : maneuverNode.progradeMs} m/s
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={-400}
                    max={600}
                    step={10}
                    value={maneuverNode.progradeMs}
                    onChange={(e) =>
                      setManeuverNode((p) => ({ ...p, progradeMs: parseInt(e.target.value, 10), executed: false }))
                    }
                    aria-label="Node Prograde Delta-v"
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Normal Plane Change (Δv_n)</span>
                    <strong className="text-cyan-300">
                      {maneuverNode.normalMs >= 0 ? `+${maneuverNode.normalMs}` : maneuverNode.normalMs} m/s
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={-300}
                    max={300}
                    step={15}
                    value={maneuverNode.normalMs}
                    onChange={(e) =>
                      setManeuverNode((p) => ({ ...p, normalMs: parseInt(e.target.value, 10), executed: false }))
                    }
                    aria-label="Node Normal Delta-v"
                    className="w-full accent-cyan-400 h-1.5 bg-slate-800 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleExecuteNodeBurn}
                    className={`py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-bold uppercase cursor-pointer ${
                      isBurnWindowActive
                        ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-lg shadow-emerald-500/20'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    <Flame className="h-3.5 w-3.5" />
                    <span>{isBurnWindowActive ? 'Execute IN WINDOW!' : 'Fire Burn Now'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateOrbitParams(orbitState.altitudeKm, 0.0, orbitState.inclinationDeg)}
                    className="border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 px-3 text-xs font-bold uppercase cursor-pointer"
                  >
                    Circularize (e=0)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onApplyManeuverBurn({ progradeMs: hohmannPlan.deltaV1Ms, normalMs: 0, radialMs: 0 }, 95)
                  }
                  className="w-full border border-cyan-500/40 bg-cyan-950/30 hover:bg-cyan-950/60 py-1.5 px-3 text-[11px] font-bold text-cyan-300 cursor-pointer"
                >
                  GMAT Hohmann Transfer to {hohmannTargetAlt} km (Δv₁: {hohmannPlan.deltaV1Ms} m/s)
                </button>
              </div>

              {/* Attitude: Solar Panel Alignment, Radiation Shield & Battery Controls */}
              <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3 font-mono-tab">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-amber-400" />
                    <h3 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                      Attitude, Solar Arrays &amp; Radiation Shield
                    </h3>
                  </div>
                  <span className="text-[10px] text-amber-300">Sun Vector: {opsState.sunAngleDeg}°</span>
                </div>

                {/* Solar Panel Orientation */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Solar Wing Slew Angle</span>
                    <strong className={solarErrorDeg <= 20 ? 'text-emerald-400' : 'text-amber-300'}>
                      {opsState.solarPanelAngleDeg}° ({Math.round(solarEfficiency * 100)}% Eff)
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={5}
                    value={opsState.solarPanelAngleDeg}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      onUpdateOpsState((p) => ({ ...p, solarPanelAngleDeg: val }));
                    }}
                    aria-label="Solar Wing Slew Angle"
                    className="w-full accent-cyan-400 h-1.5 bg-slate-800 cursor-pointer"
                  />
                </div>

                {/* Radiation Shield Orientation */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Radiation Shield Facing</span>
                    <strong className={shieldErrorDeg <= 22 ? 'text-emerald-400' : 'text-rose-300'}>
                      {opsState.shieldAngleDeg}° (Err {shieldErrorDeg.toFixed(0)}°)
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={5}
                    value={opsState.shieldAngleDeg}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      onUpdateOpsState((p) => ({ ...p, shieldAngleDeg: val }));
                    }}
                    aria-label="Radiation Shield Facing"
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <BatteryCharging className="h-4 w-4 text-emerald-400" />
                    <span className="text-slate-300">
                      Gen {totalPowerGenW}W vs Draw {totalPowerDrawW}W
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onShedHeavyPayloads}
                    className="border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[10px] font-bold text-amber-300 cursor-pointer"
                  >
                    Emergency Load Shed
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CSA Canadarm3 Robotic Operations Mini-Game */}
          {activeTab === 'canadarm' && (
            <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-amber-400" />
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                    CSA Canadarm3 Servicing &amp; Grapple Bay
                  </h3>
                </div>
                <span className="font-mono-tab text-[10px] text-cyan-300">
                  Completed: <strong>{opsState.canadarm.completedCount}</strong>
                </span>
              </div>

              <div className="border border-slate-800 bg-slate-950 overflow-hidden">
                <canvas
                  ref={armCanvasRef}
                  width={440}
                  height={250}
                  className="w-full h-auto block"
                />
              </div>

              {opsState.canadarm.lastOpFeedback && (
                <div className="border border-cyan-500/40 bg-cyan-950/25 p-2 text-[11px] text-cyan-200 font-mono-tab">
                  {opsState.canadarm.lastOpFeedback}
                </div>
              )}

              {/* Joint Controls */}
              <div className="space-y-2 font-mono-tab text-xs">
                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">1. Shoulder Joint (Q/E)</span>
                    <strong className="text-cyan-300">{opsState.canadarm.shoulderDeg}°</strong>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={155}
                    step={2}
                    value={opsState.canadarm.shoulderDeg}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      onUpdateOpsState((p) => ({ ...p, canadarm: { ...p.canadarm, shoulderDeg: val } }));
                    }}
                    aria-label="Shoulder Joint"
                    className="w-full accent-cyan-400 h-1.5 bg-slate-800 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">2. Elbow Joint (W/S)</span>
                    <strong className="text-amber-300">{opsState.canadarm.elbowDeg}°</strong>
                  </div>
                  <input
                    type="range"
                    min={-120}
                    max={120}
                    step={2}
                    value={opsState.canadarm.elbowDeg}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      onUpdateOpsState((p) => ({ ...p, canadarm: { ...p.canadarm, elbowDeg: val } }));
                    }}
                    aria-label="Elbow Joint"
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">3. Wrist / End-Effector (A/D)</span>
                    <strong className="text-emerald-300">{opsState.canadarm.wristDeg}°</strong>
                  </div>
                  <input
                    type="range"
                    min={-90}
                    max={90}
                    step={2}
                    value={opsState.canadarm.wristDeg}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      onUpdateOpsState((p) => ({ ...p, canadarm: { ...p.canadarm, wristDeg: val } }));
                    }}
                    aria-label="Wrist Joint"
                    className="w-full accent-emerald-400 h-1.5 bg-slate-800 cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={onResolveCanadarmCapture}
                className={`w-full py-2.5 px-4 font-mono-tab text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  armInGrappleZone
                    ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-lg shadow-emerald-500/20'
                    : 'border border-amber-500/50 bg-amber-950/40 text-amber-300 hover:bg-amber-950/70'
                }`}
              >
                {armInGrappleZone
                  ? '✔ ALIGNED — GRAPPLE & LOCK TARGET (SPACE)'
                  : `Move End-Effector Closer (${(armDistToTarget * 10).toFixed(1)}m away)`}
              </button>
            </div>
          )}

          {/* TAB 3: Active Surface Target Scanner & Payload Rack */}
          {activeTab === 'targeting' && (
            <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crosshair className="h-4 w-4 text-emerald-400" />
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                    Active Surface Landmark Scanner
                  </h3>
                </div>
                <span className="font-mono-tab text-[10px] text-cyan-300">
                  Slew: {opsState.sensorSlewOffsetDeg}°
                </span>
              </div>

              {/* Sensor Gimbal Slew Control */}
              <div className="border border-slate-800 bg-slate-900/50 p-2.5 space-y-1 font-mono-tab text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-300">Instrument Gimbal Cross-Track Slew</span>
                  <strong className="text-emerald-300">{opsState.sensorSlewOffsetDeg}°</strong>
                </div>
                <input
                  type="range"
                  min={-30}
                  max={30}
                  step={2}
                  value={opsState.sensorSlewOffsetDeg}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    onUpdateOpsState((p) => ({ ...p, sensorSlewOffsetDeg: val }));
                  }}
                  aria-label="Instrument Gimbal Slew"
                  className="w-full accent-emerald-400 h-1.5 bg-slate-800 cursor-pointer"
                />
              </div>

              {scanFeedback && (
                <div className="border border-emerald-500/40 bg-emerald-950/25 p-2 text-[11px] text-emerald-200 font-mono-tab">
                  {scanFeedback}
                </div>
              )}

              {/* Target Landmarks List */}
              <div className="space-y-2 max-h-[225px] overflow-y-auto pr-1">
                {landmarks.map((lm) => {
                  const dLat = Math.abs(lm.latDeg - (orbitState.subSatLatDeg + opsState.sensorSlewOffsetDeg));
                  const dLon = Math.min(
                    Math.abs(lm.lonDeg - orbitState.subSatLonDeg),
                    360 - Math.abs(lm.lonDeg - orbitState.subSatLonDeg),
                  );
                  const angDist = Math.round(Math.hypot(dLat, dLon));
                  const inWindow = angDist <= 42;
                  const instPowered = instruments.some((i) => i.id === lm.requiredInstrument && i.enabled);

                  return (
                    <div
                      key={lm.id}
                      className={`border p-2.5 font-mono-tab text-[11px] flex items-center justify-between gap-2 ${
                        lm.captured
                          ? 'border-emerald-500/40 bg-emerald-950/20'
                          : inWindow
                          ? 'border-cyan-400 bg-cyan-950/30'
                          : 'border-slate-800 bg-slate-900/40'
                      }`}
                    >
                      <div>
                        <div className="font-display text-xs font-bold text-white">{lm.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {lm.category} · Req: <strong className={instPowered ? 'text-emerald-300' : 'text-rose-400'}>{lm.requiredInstrument}</strong>
                          {' · '}Range: {angDist}°
                        </div>
                      </div>

                      {lm.captured ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold text-[10px] shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {lm.downlinked ? 'DOWNLINKED' : 'IN SSR'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleFireScan(lm.id)}
                          disabled={!instPowered}
                          className={`px-2.5 py-1.5 text-[10px] font-bold uppercase shrink-0 cursor-pointer ${
                            !instPowered
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : inWindow
                              ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                              : 'border border-cyan-500/50 bg-cyan-950/50 text-cyan-300 hover:bg-cyan-900/60'
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            <Radar className="h-3 w-3" />
                            {inWindow ? 'FIRE SCAN!' : 'Slew & Fire'}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Quick Instrument Power Rack */}
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between font-mono-tab text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Cpu className="h-3 w-3 text-cyan-400" />
                    PAYLOAD POWER BUS ({activeInstruments.length}/{instruments.length} ON)
                  </span>
                  <span className={powerMarginW >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    Margin: {powerMarginW >= 0 ? `+${powerMarginW}W` : `${powerMarginW}W`}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 max-h-[155px] overflow-y-auto pr-1">
                  {instruments.map((inst) => (
                    <div
                      key={inst.id}
                      className="border border-slate-800 bg-slate-900/50 px-2.5 py-1.5 flex items-center justify-between gap-2 font-mono-tab text-[10px]"
                    >
                      <div>
                        <strong className="text-white">{inst.acronym}</strong>{' '}
                        <span className="text-slate-400">({inst.powerDrawW}W · {inst.dataRateMbps} Mbps)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleInstrument(inst.id)}
                        className={`px-2 py-0.5 font-bold uppercase cursor-pointer ${
                          inst.enabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {inst.enabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Propulsion Trade-Offs */}
          {activeTab === 'tradeoff' && (
            <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3 font-mono-tab">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-cyan-400" />
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                  Propulsion Architecture Trade-Off ({selectedPropulsion.toUpperCase()} Active)
                </h3>
              </div>

              <div className="space-y-2.5">
                <div className="border border-amber-500/40 bg-amber-950/20 p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-300">1. Chemical Bipropellant</span>
                    <span className="text-[10px] text-slate-400">Isp 325s · 450N</span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Propellant: <strong className="text-white">{tradeOffScenarios.chemical.propellantMassKg} kg</strong> · Transit: <strong className="text-amber-300">{tradeOffScenarios.chemical.transferDurationDays}d</strong>
                  </div>
                </div>

                <div className="border border-cyan-500/40 bg-cyan-950/20 p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-cyan-300">2. Solar Electric Ion</span>
                    <span className="text-[10px] text-slate-400">Isp 3,100s · 0.25N</span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Propellant: <strong className="text-white">{tradeOffScenarios.electric.propellantMassKg} kg</strong> · Payload: <strong className="text-emerald-400">{tradeOffScenarios.electric.payloadCapacityKg} kg (+35%)</strong>
                  </div>
                </div>
              </div>

              <div className="border border-slate-800 bg-slate-900/50 p-2.5 text-[11px] text-slate-300">
                CSA Ops Score: <strong className="text-amber-300">{csaChallenges.challengePoints}/90 pts</strong> · Debris Dodged: <strong className="text-emerald-400">{csaChallenges.debrisAvoidedCount}</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
