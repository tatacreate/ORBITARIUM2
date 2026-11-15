import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Rocket,
  Flame,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  Calendar,
  Gauge,
  Compass,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import { audioSynth } from '../../audio/synth';
import {
  NASA_ROCKETS,
  calculateLaunchWindowAnalysis,
  calculateRocketDeltaV,
  calculateTargetDeltaV,
  createInitialLaunchTelemetry,
  stepAscentPhysics,
  type NasaRocketSpec,
} from '../../engine/orbitalMechanics';
import type {
  ActiveLaunchTelemetry,
  ArchitectMode,
  LaunchBurnState,
  LaunchWindowSpec,
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

  const [departureDayOffset, setDepartureDayOffset] = useState<number>(0);
  const launchWindow: LaunchWindowSpec = calculateLaunchWindowAnalysis(
    selectedObjective.targetBody,
    departureDayOffset,
  );

  const baseTargetDeltaVKms = calculateTargetDeltaV(
    selectedObjective.targetBody,
    selectedObjective.targetAltitudeKm,
    selectedObjective.regime,
  );
  const windowPenaltyDeltaVKms =
    selectedObjective.regime === 'interplanetary' || selectedObjective.regime === 'lunar'
      ? Math.max(0, launchWindow.minDeltaVKms - 3.65)
      : 0;
  const targetDeltaVKms = Number((baseTargetDeltaVKms + windowPenaltyDeltaVKms).toFixed(2));

  const [showPrelaunchConfig, setShowPrelaunchConfig] = useState(false);
  const [autoGuidance, setAutoGuidance] = useState(architectMode === 'cadet');
  const [telemetry, setTelemetry] = useState<ActiveLaunchTelemetry>(() =>
    createInitialLaunchTelemetry(targetDeltaVKms, selectedRocket),
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;

  const autoGuidanceRef = useRef(autoGuidance);
  autoGuidanceRef.current = autoGuidance;

  const rocketPerf = calculateRocketDeltaV(selectedRocket, totalPayloadMassKg, 1.0);
  const isPayloadTooHeavy = totalPayloadMassKg > selectedRocket.maxPayloadKg;
  const isTwrTooLow = rocketPerf.thrustToWeightRatio < 1.1;

  // Reset telemetry when rocket or target delta-v changes while prelaunch
  useEffect(() => {
    setTelemetry((prev) => {
      if (prev.phase === 'ascent') return prev;
      return createInitialLaunchTelemetry(targetDeltaVKms, selectedRocket);
    });
  }, [selectedRocket, targetDeltaVKms]);

  const handleLiftoff = useCallback(() => {
    if (isPayloadTooHeavy || isTwrTooLow) {
      audioSynth.playAlert();
      return;
    }
    audioSynth.playMountPart();
    const fresh = createInitialLaunchTelemetry(targetDeltaVKms, selectedRocket);
    fresh.phase = 'ascent';
    fresh.throttlePct = 100;
    fresh.pitchDeg = 90;
    setTelemetry(fresh);
    onUpdateBurnState({
      status: 'burning',
      throttlePct: 100,
      burnDurationSec: 0,
      targetDeltaVKms,
      deliveredDeltaVKms: 0,
      propellantUsedKg: 0,
      outcomeType: 'pending',
      outcomeSummary: 'Ascent active — manage throttle through Max-Q and follow the gravity-turn pitch corridor!',
    });
  }, [isPayloadTooHeavy, isTwrTooLow, targetDeltaVKms, selectedRocket, onUpdateBurnState]);

  const handleExecuteSeco = useCallback(() => {
    const t = telemetryRef.current;
    if (t.phase !== 'ascent') return;

    const velRatio = t.velocityKms / Math.max(0.1, t.targetVelocityKms);
    const diffRatio = velRatio - 1.0;
    const fuelUsed = Math.round(t.fuelTotalKg - t.fuelRemainingKg);
    const deliveredDv = Number(t.velocityKms.toFixed(2));

    let outcomeType: LaunchBurnState['outcomeType'] = 'nominal';
    let outcomeSummary = '';
    let isSuccess = true;

    if (t.altitudeKm < 65 || diffRatio < -0.06) {
      outcomeType = 'underburn';
      isSuccess = false;
      outcomeSummary = `Premature SECO (${deliveredDv} km/s at ${t.altitudeKm} km): Insufficient orbital velocity or altitude to clear atmosphere.`;
    } else if (diffRatio > 0.07) {
      outcomeType = 'overburn';
      isSuccess = false;
      outcomeSummary = `Late SECO Over-Burn (${deliveredDv} km/s > ${t.targetVelocityKms} km/s): Overshot target apogee corridor.`;
    } else {
      outcomeType = 'nominal';
      isSuccess = true;
      outcomeSummary = `Clean SECO Orbital Insertion! Cut engines at ${deliveredDv} km/s (${Math.round(t.launchEfficiencyScore)}% ascent efficiency).`;
    }

    if (isSuccess) audioSynth.playSuccess();
    else audioSynth.playAlert();

    setTelemetry((prev) => ({
      ...prev,
      phase: isSuccess ? 'seco' : 'failed',
      throttlePct: 0,
      failureReason: isSuccess ? null : outcomeSummary,
    }));

    onUpdateBurnState({
      status: isSuccess ? 'completed' : 'failed',
      throttlePct: 0,
      burnDurationSec: Math.round(t.timeSec),
      targetDeltaVKms: t.targetVelocityKms,
      deliveredDeltaVKms: deliveredDv,
      propellantUsedKg: fuelUsed,
      outcomeType,
      outcomeSummary,
      launchEfficiencyScore: t.launchEfficiencyScore,
    });
  }, [onUpdateBurnState]);

  const handleResetPad = useCallback(() => {
    audioSynth.playSelect();
    setTelemetry(createInitialLaunchTelemetry(targetDeltaVKms, selectedRocket));
    onUpdateBurnState({
      status: 'idle',
      throttlePct: 100,
      burnDurationSec: 0,
      targetDeltaVKms,
      deliveredDeltaVKms: 0,
      propellantUsedKg: 0,
      outcomeType: 'pending',
      outcomeSummary: 'Vehicle on launch pad. Ignite engines and pilot gravity turn to SECO.',
    });
  }, [targetDeltaVKms, selectedRocket, onUpdateBurnState]);

  // Real-Time Ascent Physics Loop (60ms tick)
  useEffect(() => {
    if (telemetry.phase !== 'ascent') return;

    const timer = window.setInterval(() => {
      setTelemetry((prev) => {
        if (prev.phase !== 'ascent') return prev;
        const next = stepAscentPhysics(
          prev,
          selectedRocket,
          selectedObjective.targetAltitudeKm,
          0.16,
          autoGuidanceRef.current,
        );
        if (next.phase === 'failed') {
          audioSynth.playAlert();
          onUpdateBurnState({
            status: 'failed',
            throttlePct: 0,
            burnDurationSec: Math.round(next.timeSec),
            targetDeltaVKms: next.targetVelocityKms,
            deliveredDeltaVKms: Number(next.velocityKms.toFixed(2)),
            propellantUsedKg: Math.round(next.fuelTotalKg - next.fuelRemainingKg),
            outcomeType: next.velocityKms > next.targetVelocityKms ? 'overburn' : 'underburn',
            outcomeSummary: next.failureReason || 'Ascent anomaly forced mission abort.',
            launchEfficiencyScore: next.launchEfficiencyScore,
          });
        }
        return next;
      });
    }, 60);

    return () => clearInterval(timer);
  }, [telemetry.phase, selectedRocket, selectedObjective.targetAltitudeKm, onUpdateBurnState]);

  // Keyboard Flight Controls (W/S Throttle, A/D Pitch, Space Liftoff / SECO)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const t = telemetryRef.current;

      if (e.code === 'Space') {
        e.preventDefault();
        if (t.phase === 'prelaunch') handleLiftoff();
        else if (t.phase === 'ascent') handleExecuteSeco();
        return;
      }

      if (t.phase !== 'ascent') return;

      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        e.preventDefault();
        setTelemetry((p) => ({ ...p, throttlePct: Math.min(100, p.throttlePct + 5) }));
      } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        setTelemetry((p) => ({ ...p, throttlePct: Math.max(0, p.throttlePct - 5) }));
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setTelemetry((p) => ({ ...p, pitchDeg: Math.max(0, p.pitchDeg - 4) }));
      } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setTelemetry((p) => ({ ...p, pitchDeg: Math.min(90, p.pitchDeg + 4) }));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleLiftoff, handleExecuteSeco]);

  // Render Live HTML5 Canvas Ascent Telemetry Viewport
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const t = telemetry;

    // Sky to Space Altitude Gradient
    const spaceFactor = Math.min(1, t.altitudeKm / 120);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#02050e');
    skyGrad.addColorStop(0.55, spaceFactor > 0.6 ? '#050b18' : '#0a1d3a');
    skyGrad.addColorStop(1, spaceFactor > 0.8 ? '#0a1628' : '#0f365c');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle Coordinate Grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Viewport Scale Mapping: Downrange 0..550 km, Altitude 0..190 km
    const maxDr = Math.max(520, t.downrangeKm + 140);
    const maxAlt = Math.max(185, t.altitudeKm + 40);
    const mapX = (dr: number) => 55 + (dr / maxDr) * (w - 95);
    const mapY = (alt: number) => h - 38 - (alt / maxAlt) * (h - 70);

    // Max-Q Atmospheric Turbulence Zone Band (12 km - 32 km)
    const maxQTopY = mapY(32);
    const maxQBotY = mapY(12);
    ctx.fillStyle = t.dynamicPressureKpa > 34 ? 'rgba(244, 63, 94, 0.16)' : 'rgba(245, 158, 11, 0.09)';
    ctx.fillRect(0, maxQTopY, w, maxQBotY - maxQTopY);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.32)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, maxQTopY);
    ctx.lineTo(w, maxQTopY);
    ctx.moveTo(0, maxQBotY);
    ctx.lineTo(w, maxQBotY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.78)';
    ctx.font = '10px monospace';
    ctx.fillText('MAX-Q AERODYNAMIC STRESS CORRIDOR (12–32 km · THROTTLE DOWN)', 12, maxQTopY - 4);

    // Karman Line (100 km Space Boundary)
    const karmanY = mapY(100);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.28)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(0, karmanY);
    ctx.lineTo(w, karmanY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.72)';
    ctx.fillText('KÁRMÁN LINE (100 km · SPACE THRESHOLD)', 12, karmanY - 5);

    // Earth Horizon Surface Band
    ctx.fillStyle = '#0c4a6e';
    ctx.fillRect(0, h - 38, w, 38);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h - 38);
    ctx.lineTo(w, h - 38);
    ctx.stroke();

    // Launchpad Tower
    ctx.fillStyle = '#64748b';
    ctx.fillRect(46, h - 62, 6, 24);
    ctx.fillRect(42, h - 62, 12, 3);

    // Target Gravity-Turn Reference Arc (Dashed Cyan)
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    for (let dr = 0; dr <= maxDr; dr += 12) {
      const targetAlt = 155 * (1 - Math.exp(-dr / 245));
      const x = mapX(dr);
      const y = mapY(targetAlt);
      if (dr === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Actual Rocket Flight Path Breadcrumb Trail
    if (t.trajectoryPoints.length > 1) {
      ctx.strokeStyle = t.phase === 'failed' ? '#f43f5e' : '#34d399';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      t.trajectoryPoints.forEach((pt, idx) => {
        const px = mapX(pt.downrangeKm);
        const py = mapY(pt.altitudeKm);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    // Rocket Sprite at Current Position
    const rx = mapX(t.downrangeKm);
    const ry = mapY(t.altitudeKm);

    ctx.save();
    ctx.translate(rx, ry);
    // Canvas 0 rad points right (+X), -PI/2 points straight up (-Y).
    // pitchDeg=90 => point straight up (-PI/2); pitchDeg=0 => point right (0)
    const canvasRotRad = -(t.pitchDeg * Math.PI) / 180;
    ctx.rotate(canvasRotRad);

    // Exhaust Plume if ascending and throttle > 0
    if (t.phase === 'ascent' && t.throttlePct > 0 && t.fuelRemainingKg > 0) {
      const flameLen = (14 + (t.throttlePct / 100) * 34) * (0.88 + (Math.sin(t.timeSec * 30) + 1) * 0.14);
      const grad = ctx.createLinearGradient(-8, 0, -8 - flameLen, 0);
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.4, '#f59e0b');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-10, -5);
      ctx.lineTo(-10 - flameLen, 0);
      ctx.lineTo(-10, 5);
      ctx.closePath();
      ctx.fill();
    }

    // Rocket Body & Fairing (pointing +X in rotated frame)
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-10, -4.5, 22, 9);
    // Nosecone
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(12, -4.5);
    ctx.lineTo(22, 0);
    ctx.lineTo(12, 4.5);
    ctx.closePath();
    ctx.fill();
    // Engine Bell & Fins
    ctx.fillStyle = '#475569';
    ctx.fillRect(-13, -3.5, 4, 7);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-10, -7, 5, 2.5);
    ctx.fillRect(-10, 4.5, 5, 2.5);

    // Max-Q Shock Cone Aura
    if (t.dynamicPressureKpa > 26 && t.phase === 'ascent') {
      ctx.strokeStyle = t.dynamicPressureKpa > 38 ? 'rgba(244,63,94,0.85)' : 'rgba(251,191,36,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(16, 0, 12, -1.0, 1.0);
      ctx.stroke();
    }

    ctx.restore();

    // Target Pitch Ghost Arrow around Rocket
    if (t.phase === 'ascent') {
      const targetRot = -(t.targetPitchDeg * Math.PI) / 180;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(targetRot);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(44, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }, [telemetry]);

  const velRatioPct = Math.min(125, Math.round((telemetry.velocityKms / Math.max(0.1, telemetry.targetVelocityKms)) * 100));
  const inSecoWindow = telemetry.phase === 'ascent' && velRatioPct >= 94 && velRatioPct <= 107 && telemetry.altitudeKm >= 65;
  const inMaxQAlert = telemetry.phase === 'ascent' && telemetry.dynamicPressureKpa > 34;

  return (
    <div className="space-y-4">
      {/* Segment Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-800 bg-[#080d19] p-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="border border-amber-500/50 bg-amber-950/40 px-2 py-0.5 font-mono-tab text-[10px] font-bold uppercase tracking-wider text-amber-300">
              NASA Segment 1: Active Ascent &amp; SECO Insertion
            </span>
            <span className="text-xs text-slate-400">· Real-Time Gravity Turn, Max-Q &amp; Engine Cutoff</span>
          </div>
          <h2 className="mt-1 font-display text-xl md:text-2xl font-bold text-white">
            Pilot Launch Ascent, Survive Max-Q &amp; Hit Orbital SECO Cutoff
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Steer pitch along the dashed gravity-turn curve, throttle down through Max-Q aerodynamic stress, and cut engines (<strong className="text-emerald-300">SECO</strong>) inside the 94%–107% velocity gate.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevSegment}
            className="border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            ← Setup
          </button>
          <button
            type="button"
            onClick={onProceedToSpace}
            disabled={architectMode !== 'sandbox' && burnState.status !== 'completed'}
            className={`flex items-center gap-2 px-5 py-2 text-xs font-bold transition-all cursor-pointer ${
              architectMode === 'sandbox' || burnState.status === 'completed'
                ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-lg shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <span>{architectMode === 'sandbox' ? 'Segment 2: Space (Sandbox Open)' : 'Segment 2: Space Segment'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Collapsible Pre-Launch Vehicle & Window Configuration Strip */}
      <div className="border border-slate-800 bg-[#080d19]">
        <button
          type="button"
          onClick={() => setShowPrelaunchConfig((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-900/50 cursor-pointer"
        >
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Rocket className="h-4 w-4 text-cyan-400" />
            <span className="font-display font-bold text-white uppercase tracking-wider">
              Launch Vehicle &amp; Window: {selectedRocket.name}
            </span>
            <span className="font-mono-tab text-[11px] text-slate-400">
              Wet Mass: <strong className={isPayloadTooHeavy ? 'text-rose-400' : 'text-cyan-300'}>{totalPayloadMassKg}/{selectedRocket.maxPayloadKg} kg</strong>
              {' · '}Target Δv: <strong className="text-amber-300">{targetDeltaVKms} km/s</strong>
              {' · '}TWR: <strong className={isTwrTooLow ? 'text-rose-400' : 'text-emerald-400'}>{rocketPerf.thrustToWeightRatio}x</strong>
            </span>
          </div>
          <span className="flex items-center gap-1 font-mono-tab text-[10px] text-cyan-300">
            {showPrelaunchConfig ? 'Hide Selector' : 'Change Rocket / Window'}
            {showPrelaunchConfig ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        </button>

        {showPrelaunchConfig && (
          <div className="p-4 pt-2 border-t border-slate-800 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {NASA_ROCKETS.map((rocket) => {
                const isSelected = rocket.id === selectedRocket.id;
                const perf = calculateRocketDeltaV(rocket, totalPayloadMassKg, 1.0);
                const tooHeavy = totalPayloadMassKg > rocket.maxPayloadKg;

                return (
                  <button
                    key={rocket.id}
                    type="button"
                    onClick={() => onSelectRocket(rocket)}
                    disabled={telemetry.phase === 'ascent'}
                    className={`flex flex-col justify-between text-left border p-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/30'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    } ${tooHeavy ? 'opacity-75 border-rose-900/60' : ''}`}
                  >
                    <div>
                      <div className="flex items-center justify-between font-mono-tab text-[10px]">
                        <span className="text-slate-400 uppercase">{rocket.tier}</span>
                        <span className="text-amber-300 font-bold">${rocket.costM}M</span>
                      </div>
                      <div className="mt-1 font-display text-sm font-bold text-white">{rocket.name}</div>
                      <p className="mt-1 text-[11px] text-slate-300">{rocket.description}</p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-1 font-mono-tab text-[10px]">
                      <span className={tooHeavy ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                        Max: {rocket.maxPayloadKg} kg
                      </span>
                      <span className="text-right text-emerald-400 font-bold">
                        Δv: {perf.totalDeltaVKms} km/s
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Compact Launch Window Selector */}
            <div className="border border-slate-800 bg-slate-950/60 p-3 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="h-4 w-4 text-amber-400" />
                <span className="font-bold text-white">Departure Epoch Offset ({launchWindow.targetPlanet}):</span>
                <span className="font-mono-tab text-amber-300">
                  {departureDayOffset === 0 ? 'Day 0 (Optimal)' : `${departureDayOffset > 0 ? `+${departureDayOffset}` : departureDayOffset}d`}
                </span>
              </div>
              <input
                type="range"
                min={-30}
                max={30}
                step={1}
                value={departureDayOffset}
                disabled={telemetry.phase === 'ascent'}
                onChange={(e) => setDepartureDayOffset(parseInt(e.target.value, 10))}
                aria-label="Departure Date Offset"
                className="w-48 accent-amber-400 h-1.5 bg-slate-800 cursor-pointer"
              />
              <span className="font-mono-tab text-[11px] text-slate-300">
                C3: <strong className="text-amber-300">{launchWindow.c3EnergyKm2s2}</strong> · Penalty: <strong className={windowPenaltyDeltaVKms > 0 ? 'text-rose-400' : 'text-emerald-400'}>+{windowPenaltyDeltaVKms.toFixed(2)} km/s</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Interactive Flight Director Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 8 Cols: Live HTML5 Canvas Ascent Viewport */}
        <div className="lg:col-span-8 border border-slate-800 bg-[#050914] flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-[#080d19] font-mono-tab text-[11px]">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-cyan-400" />
              <span className="font-bold text-white uppercase">Ascent Trajectory &amp; Gravity-Turn Viewport</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                  telemetry.phase === 'ascent'
                    ? inMaxQAlert
                      ? 'border-rose-500/60 bg-rose-950/60 text-rose-300'
                      : inSecoWindow
                      ? 'border-emerald-500/60 bg-emerald-950/60 text-emerald-300'
                      : 'border-amber-500/50 bg-amber-950/50 text-amber-300'
                    : telemetry.phase === 'seco'
                    ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                    : telemetry.phase === 'failed'
                    ? 'border-rose-500/60 bg-rose-950/50 text-rose-300'
                    : 'border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                {telemetry.phase === 'ascent'
                  ? inMaxQAlert
                    ? '▲ MAX-Q HIGH STRESS — THROTTLE DOWN'
                    : inSecoWindow
                    ? '● SECO WINDOW OPEN — CUT ENGINES NOW'
                    : '● ASCENT BURN ACTIVE'
                  : telemetry.phase === 'seco'
                  ? '✔ SECO ORBITAL INSERTION CONFIRMED'
                  : telemetry.phase === 'failed'
                  ? '✖ ASCENT ABORT / FAILURE'
                  : 'PAD STANDBY — READY FOR IGNITION'}
              </span>
            </div>

            <span className="text-slate-400">
              T+ {telemetry.timeSec.toFixed(1)}s · Keys: W/S Throttle · A/D Pitch · Space Launch/SECO
            </span>
          </div>

          <div className="relative">
            <canvas
              ref={canvasRef}
              width={760}
              height={360}
              className="w-full h-auto block"
            />

            {/* Compact Telemetry Overlay Bar */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-2.5 border-t border-slate-800 bg-[#070b16] font-mono-tab text-[11px]">
              <div>
                <span className="text-[9px] text-slate-500 block">ALTITUDE</span>
                <strong className="text-cyan-300">{telemetry.altitudeKm.toFixed(1)} km</strong>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">VELOCITY</span>
                <strong className={inSecoWindow ? 'text-emerald-400' : 'text-white'}>
                  {telemetry.velocityKms.toFixed(2)} / {telemetry.targetVelocityKms} km/s
                </strong>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">PITCH / TARGET</span>
                <strong className={telemetry.flightPathErrorDeg > 18 ? 'text-rose-400' : 'text-cyan-300'}>
                  {telemetry.pitchDeg.toFixed(0)}° (Aim {telemetry.targetPitchDeg.toFixed(0)}°)
                </strong>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">DYNAMIC PRESS (Q)</span>
                <strong className={telemetry.dynamicPressureKpa > 34 ? 'text-rose-400' : 'text-amber-300'}>
                  {telemetry.dynamicPressureKpa} kPa
                </strong>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">STAGE FUEL</span>
                <strong className="text-slate-200">
                  {Math.round((telemetry.fuelRemainingKg / Math.max(1, telemetry.fuelTotalKg)) * 100)}%
                </strong>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">PROJ APOGEE</span>
                <strong className="text-emerald-400">{telemetry.apoapsisProjectedKm} km</strong>
              </div>
            </div>
          </div>

          {/* Outcome / Failure Feedback Banner */}
          {(burnState.status === 'completed' || burnState.status === 'failed' || telemetry.failureReason) && (
            <div
              className={`border-t p-3 text-xs flex items-center justify-between gap-3 ${
                burnState.status === 'completed' && telemetry.phase !== 'failed'
                  ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                  : 'border-rose-500/40 bg-rose-950/30 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {burnState.status === 'completed' && telemetry.phase !== 'failed' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span>{telemetry.failureReason || burnState.outcomeSummary}</span>
              </div>
              <button
                type="button"
                onClick={handleResetPad}
                className="shrink-0 flex items-center gap-1 border border-slate-600 bg-slate-900 px-2.5 py-1 font-mono-tab text-[11px] font-bold text-white hover:border-cyan-400 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Pad
              </button>
            </div>
          )}
        </div>

        {/* Right 4 Cols: Tactile Cockpit Flight Controls */}
        <div className="lg:col-span-4 border border-slate-800 bg-[#080d19] p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-amber-400" />
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                  Flight Director Cockpit
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAutoGuidance((g) => !g)}
                className={`px-2 py-0.5 font-mono-tab text-[10px] font-bold border cursor-pointer ${
                  autoGuidance
                    ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                }`}
                title="Toggle SAS Gravity-Turn Pitch Assist"
              >
                {autoGuidance ? 'SAS PITCH ASSIST: ON' : 'MANUAL PITCH'}
              </button>
            </div>

            {/* Throttle Control */}
            <div className="border border-slate-800 bg-slate-900/60 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono-tab">
                <span className="text-slate-300">MAIN ENGINE THROTTLE</span>
                <strong className="text-amber-300 text-sm">{telemetry.throttlePct}%</strong>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={telemetry.throttlePct}
                onChange={(e) =>
                  setTelemetry((p) => ({ ...p, throttlePct: parseInt(e.target.value, 10) }))
                }
                aria-label="Main Engine Throttle"
                className="w-full accent-amber-400 h-2 bg-slate-800 cursor-pointer"
              />
              <div className="grid grid-cols-4 gap-1.5 font-mono-tab text-[10px]">
                {[0, 65, 85, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTelemetry((p) => ({ ...p, throttlePct: val }))}
                    className={`py-1.5 border font-bold cursor-pointer ${
                      telemetry.throttlePct === val
                        ? 'border-amber-400 bg-amber-500 text-slate-950'
                        : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-amber-400'
                    }`}
                  >
                    {val === 65 ? '65% Q' : `${val}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Pitch Angle Control */}
            <div className="border border-slate-800 bg-slate-900/60 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono-tab">
                <span className="text-slate-300">PITCH ANGLE (90° UP → 0° ORBIT)</span>
                <strong className="text-cyan-300 text-sm">{telemetry.pitchDeg.toFixed(0)}°</strong>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={1}
                value={telemetry.pitchDeg}
                onChange={(e) => {
                  setAutoGuidance(false);
                  setTelemetry((p) => ({ ...p, pitchDeg: parseInt(e.target.value, 10) }));
                }}
                aria-label="Pitch Angle"
                className="w-full accent-cyan-400 h-2 bg-slate-800 cursor-pointer"
              />
              <div className="grid grid-cols-4 gap-1.5 font-mono-tab text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    setAutoGuidance(false);
                    setTelemetry((p) => ({ ...p, pitchDeg: Math.min(90, p.pitchDeg + 8) }));
                  }}
                  className="py-1.5 border border-slate-700 bg-slate-950 text-slate-200 hover:border-cyan-400 cursor-pointer"
                >
                  ▲ Pitch +8°
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAutoGuidance(false);
                    setTelemetry((p) => ({ ...p, pitchDeg: Math.min(90, p.pitchDeg + 3) }));
                  }}
                  className="py-1.5 border border-slate-700 bg-slate-950 text-slate-200 hover:border-cyan-400 cursor-pointer"
                >
                  +3°
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAutoGuidance(false);
                    setTelemetry((p) => ({ ...p, pitchDeg: Math.max(0, p.pitchDeg - 3) }));
                  }}
                  className="py-1.5 border border-slate-700 bg-slate-950 text-slate-200 hover:border-cyan-400 cursor-pointer"
                >
                  -3°
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAutoGuidance(false);
                    setTelemetry((p) => ({ ...p, pitchDeg: Math.max(0, p.pitchDeg - 8) }));
                  }}
                  className="py-1.5 border border-slate-700 bg-slate-950 text-slate-200 hover:border-cyan-400 cursor-pointer"
                >
                  ▼ Turn -8°
                </button>
              </div>
            </div>

            {/* Vehicle Stress & Thermal Gauges */}
            <div className="grid grid-cols-2 gap-2.5 font-mono-tab text-[11px]">
              <div className="border border-slate-800 bg-slate-900/60 p-2.5 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">MAX-Q STRESS</span>
                  <strong className={telemetry.structuralStressPct > 65 ? 'text-rose-400' : 'text-amber-300'}>
                    {telemetry.structuralStressPct.toFixed(0)}%
                  </strong>
                </div>
                <div className="h-2 w-full bg-slate-800">
                  <div
                    className={`h-full transition-all ${telemetry.structuralStressPct > 65 ? 'bg-rose-500' : 'bg-amber-400'}`}
                    style={{ width: `${telemetry.structuralStressPct}%` }}
                  />
                </div>
              </div>

              <div className="border border-slate-800 bg-slate-900/60 p-2.5 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">THERMAL LOAD</span>
                  <strong className={telemetry.thermalHeatPct > 65 ? 'text-rose-400' : 'text-cyan-300'}>
                    {telemetry.thermalHeatPct.toFixed(0)}%
                  </strong>
                </div>
                <div className="h-2 w-full bg-slate-800">
                  <div
                    className={`h-full transition-all ${telemetry.thermalHeatPct > 65 ? 'bg-rose-500' : 'bg-cyan-400'}`}
                    style={{ width: `${telemetry.thermalHeatPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* SECO Velocity Cutoff Window Meter */}
            <div className="border border-slate-800 bg-slate-950 p-3 space-y-1.5 font-mono-tab">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-300">SECO CUTOFF VELOCITY GATE</span>
                <strong className={inSecoWindow ? 'text-emerald-400' : 'text-cyan-300'}>
                  {velRatioPct}% of Target
                </strong>
              </div>
              <div className="relative h-3.5 w-full bg-slate-900 border border-slate-800">
                {/* Green 94%-107% nominal SECO zone */}
                <div
                  className="absolute top-0 bottom-0 bg-emerald-500/35 border-x border-emerald-400"
                  style={{ left: '75.2%', width: '10.4%' }}
                  title="Nominal SECO Cutoff Window (94% - 107%)"
                />
                <div
                  className={`h-full transition-all duration-75 ${
                    inSecoWindow ? 'bg-emerald-400' : velRatioPct > 107 ? 'bg-rose-500' : 'bg-cyan-400'
                  }`}
                  style={{ width: `${Math.min(100, (velRatioPct / 125) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>0%</span>
                <span className="text-emerald-400">SECO WINDOW (94–107%)</span>
                <span>125% OVERBURN</span>
              </div>
            </div>
          </div>

          {/* Primary Liftoff / SECO Ignition Trigger */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            {(isPayloadTooHeavy || isTwrTooLow) && (
              <div className="border border-rose-500/40 bg-rose-950/30 p-2 text-[11px] text-rose-200 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
                <span>
                  {isPayloadTooHeavy
                    ? 'Payload exceeds selected rocket lift cap—open Rocket Selector above.'
                    : 'Liftoff TWR < 1.1x—select a higher-thrust rocket.'}
                </span>
              </div>
            )}

            {telemetry.phase === 'ascent' ? (
              <button
                type="button"
                onClick={handleExecuteSeco}
                className={`w-full py-3 px-4 flex items-center justify-center gap-2 font-mono-tab text-sm font-black uppercase tracking-wider transition-all cursor-pointer ${
                  inSecoWindow
                    ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-xl shadow-emerald-500/30'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                <Zap className="h-4 w-4" />
                <span>{inSecoWindow ? 'CUT ENGINES NOW (SECO NOMINAL!)' : 'CUT ENGINES (SECO)'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLiftoff}
                disabled={isPayloadTooHeavy || isTwrTooLow}
                className={`w-full py-3 px-4 flex items-center justify-center gap-2 font-mono-tab text-sm font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isPayloadTooHeavy || isTwrTooLow
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                }`}
              >
                <Flame className="h-4 w-4" />
                <span>{telemetry.phase === 'prelaunch' ? 'IGNITE ENGINES (LIFTOFF)' : 'RE-FLY ASCENT LAUNCH'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
