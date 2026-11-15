import { useEffect, useRef } from 'react';
import {
  Radio,
  Wifi,
  WifiOff,
  HardDrive,
  ArrowRight,
  Compass,
  Waves,
  Crosshair,
  Sliders,
} from 'lucide-react';
import { audioSynth } from '../../audio/synth';
import { GROUND_STATIONS, CELESTIAL_BODIES, checkLineOfSight } from '../../engine/orbitalMechanics';
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

  const skyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef(false);

  const bufferPct = Math.min(100, (groundComm.bufferStoredGB / groundComm.bufferCapacityGB) * 100);
  const isBufferOverflowRisk = bufferPct > 85;
  const pendingLandmarks = landmarks.filter((l) => l.captured && !l.downlinked).length;
  const downlinkedLandmarks = landmarks.filter((l) => l.downlinked).length;

  // Render Interactive Polar Sky-Dome Dish Tracker Canvas
  useEffect(() => {
    const canvas = skyCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2 - 12;
    const maxR = Math.min(w, h) * 0.4;

    ctx.fillStyle = '#040814';
    ctx.fillRect(0, 0, w, h);

    // Elevation Rings: 5° horizon, 30°, 60°, Zenith (90°)
    const elevRings = [
      { el: 5, label: '5° HORIZON MASK' },
      { el: 30, label: '30°' },
      { el: 60, label: '60°' },
    ];
    elevRings.forEach((ring, idx) => {
      const r = maxR * ((90 - ring.el) / 85);
      ctx.strokeStyle = idx === 0 ? 'rgba(245, 158, 11, 0.45)' : 'rgba(51, 65, 85, 0.65)';
      ctx.lineWidth = idx === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.fillText(ring.label, cx + 4, cy - r + 10);
    });

    // Crosshairs N/E/S/W
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.55)';
    ctx.beginPath();
    ctx.moveTo(cx - maxR, cy);
    ctx.lineTo(cx + maxR, cy);
    ctx.moveTo(cx, cy - maxR);
    ctx.lineTo(cx, cy + maxR);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('N (0°)', cx - 18, cy - maxR - 8);
    ctx.fillText('S (180°)', cx - 24, cy + maxR + 15);
    ctx.fillText('E (90°)', cx + maxR + 6, cy + 4);
    ctx.fillText('W (270°)', cx - maxR - 54, cy + 4);

    const polarToXY = (azDeg: number, elDeg: number) => {
      const clampedEl = Math.max(0, Math.min(90, elDeg));
      const r = maxR * ((90 - clampedEl) / 85);
      const rad = (azDeg * Math.PI) / 180;
      return {
        x: cx + r * Math.sin(rad),
        y: cy - r * Math.cos(rad),
      };
    };

    // Draw Satellite Target Marker if LOS active
    const satPt = polarToXY(groundComm.navTelemetry.azimuthDeg, groundComm.navTelemetry.elevationDeg);
    if (groundComm.hasLineOfSight) {
      ctx.fillStyle = 'rgba(34, 211, 238, 0.25)';
      ctx.beginPath();
      ctx.arc(satPt.x, satPt.y, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(satPt.x, satPt.y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#cffafe';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(
        `SAT (${Math.round(groundComm.navTelemetry.azimuthDeg)}°/${Math.round(groundComm.navTelemetry.elevationDeg)}°)`,
        satPt.x + 12,
        satPt.y - 6,
      );
    } else {
      ctx.fillStyle = 'rgba(244, 63, 94, 0.85)';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('OCCLUDED BELOW HORIZON — SELECT IN-VIEW STATION OR WAIT PASS', 24, cy);
    }

    // Player Dish Beam Reticle
    const dishPt = polarToXY(groundComm.dishAzimuthDeg, groundComm.dishElevationDeg);
    const beamRadiusPx = groundComm.bandMode === 'Ka-Band' ? 22 : 38;
    const isLocked = groundComm.hasLineOfSight && groundComm.dishLockQualityPct >= 65;

    ctx.strokeStyle = isLocked ? '#10b981' : '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(dishPt.x, dishPt.y, beamRadiusPx, 0, Math.PI * 2);
    ctx.stroke();

    // Dish Crosshair Center
    ctx.beginPath();
    ctx.moveTo(dishPt.x - 9, dishPt.y);
    ctx.lineTo(dishPt.x + 9, dishPt.y);
    ctx.moveTo(dishPt.x, dishPt.y - 9);
    ctx.lineTo(dishPt.x, dishPt.y + 9);
    ctx.stroke();

    ctx.fillStyle = isLocked ? '#34d399' : '#fbbf24';
    ctx.font = '10px monospace';
    ctx.fillText(
      `DISH BEAM (${groundComm.bandMode}) · LOCK ${groundComm.dishLockQualityPct}%`,
      12,
      h - 10,
    );
  }, [groundComm]);

  const steerFromPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = skyCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2 - 12;
    const maxR = Math.min(canvas.width, canvas.height) * 0.4;

    const dx = px - cx;
    const dy = -(py - cy); // +North up
    const dist = Math.hypot(dx, dy);
    const azDeg = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
    const elDeg = Math.max(5, Math.min(90, 90 - (dist / maxR) * 85));

    onSteerDish(Math.round(azDeg), Math.round(elDeg));
  };

  return (
    <div className="space-y-4">
      {/* Segment Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-800 bg-[#080d19] p-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="border border-emerald-500/50 bg-emerald-950/40 px-2 py-0.5 font-mono-tab text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              NASA Segment 3: Active Ground Dish Tracking
            </span>
            <span className="text-xs text-slate-400">· Sky-Dome Antenna Steering, Carrier Lock &amp; SSR Flush</span>
          </div>
          <h2 className="mt-1 font-display text-xl md:text-2xl font-bold text-white">
            Track Moving Spacecraft Dish Pass &amp; Downlink Science Packets
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Aim the parabolic antenna reticle onto the passing satellite on the polar sky-dome, select Ka-Band or X-Band modulation, and flush buffered science discoveries before horizon blackout.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevSegment}
            className="border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            ← Space
          </button>
          <button
            type="button"
            onClick={onProceedToUser}
            className="flex items-center gap-2 bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
          >
            <span>Segment 4: Science Map →</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Real-Time Link & Lock Status Strip */}
      <div
        className={`border p-3.5 transition-all ${
          groundComm.hasLineOfSight
            ? groundComm.dishLockQualityPct >= 60
              ? 'border-emerald-500/50 bg-emerald-950/25'
              : 'border-amber-500/50 bg-amber-950/20'
            : 'border-rose-500/50 bg-rose-950/20'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center ${
                groundComm.hasLineOfSight ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {groundComm.hasLineOfSight ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            </div>
            <div>
              <div className="font-mono-tab text-xs font-bold uppercase tracking-wider text-white">
                {groundComm.hasLineOfSight
                  ? groundComm.dishLockQualityPct >= 60
                    ? `● CARRIER LOCKED (${groundComm.dishLockQualityPct}%) · ${activeStation.name}`
                    : `▲ SLEW DISH TO SATELLITE (LOCK ${groundComm.dishLockQualityPct}%)`
                  : `✖ HORIZON BLACKOUT — SWITCH TO AN IN-VIEW STATION`}
              </div>
              <div className="font-mono-tab text-[11px] text-slate-300">
                Sat Az {groundComm.navTelemetry.azimuthDeg}° / El {groundComm.navTelemetry.elevationDeg}° · Captured Targets Queued: <strong className="text-amber-300">{pendingLandmarks}</strong> · Downlinked: <strong className="text-emerald-400">{downlinkedLandmarks}/{landmarks.length}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono-tab text-xs">
            <div className="border border-slate-800 bg-slate-900/70 px-3 py-1.5">
              <span className="text-slate-400 text-[9px] block">LIVE RATE</span>
              <strong className="text-cyan-300">{groundComm.currentDownlinkMbps} Mbps</strong>
            </div>
            <div className="border border-slate-800 bg-slate-900/70 px-3 py-1.5">
              <span className="text-slate-400 text-[9px] block">DOPPLER SHIFT</span>
              <strong className="text-amber-300">{groundComm.navTelemetry.dopplerShiftKhz} kHz</strong>
            </div>
            <div className="border border-slate-800 bg-slate-900/70 px-3 py-1.5">
              <span className="text-slate-400 text-[9px] block">RETURNED</span>
              <strong className="text-emerald-400">{Math.round(groundComm.totalDataDownlinkedGB)} GB</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Sky-Dome Tracker (Left 6 cols) & Dish Console + Station Handover (Right 6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 6 Cols: Sky-Dome Canvas + Dish Steering Controls */}
        <div className="lg:col-span-6 space-y-4">
          <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crosshair className="h-4 w-4 text-cyan-400" />
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                  Polar Sky-Dome Dish Tracking Reticle
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  audioSynth.playSelect();
                  onToggleServoAssist();
                }}
                className={`px-2 py-0.5 font-mono-tab text-[10px] font-bold border cursor-pointer ${
                  groundComm.servoAssistEnabled
                    ? 'border-emerald-400 bg-emerald-950/40 text-emerald-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {groundComm.servoAssistEnabled ? 'SERVO AUTO-TRACK: ON' : 'MANUAL STEERING'}
              </button>
            </div>

            <div className="border border-slate-800 bg-slate-950 overflow-hidden">
              <canvas
                ref={skyCanvasRef}
                width={480}
                height={340}
                onPointerDown={(e) => {
                  draggingRef.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  steerFromPointer(e);
                }}
                onPointerMove={(e) => {
                  if (draggingRef.current) steerFromPointer(e);
                }}
                onPointerUp={() => {
                  draggingRef.current = false;
                }}
                onPointerLeave={() => {
                  draggingRef.current = false;
                }}
                className="w-full h-auto cursor-crosshair block"
              />
            </div>

            {/* Tactile Band Mode + Bandwidth + Flush Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono-tab text-xs">
              <div className="border border-slate-800 bg-slate-900/50 p-2.5 space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase block">Carrier Band Modulation</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeBandMode('Ka-Band')}
                    className={`py-1.5 text-[10px] font-bold border cursor-pointer ${
                      groundComm.bandMode === 'Ka-Band'
                        ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                        : 'border-slate-700 bg-slate-950 text-slate-300'
                    }`}
                  >
                    Ka-Band (Fast / Narrow)
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeBandMode('X-Band')}
                    className={`py-1.5 text-[10px] font-bold border cursor-pointer ${
                      groundComm.bandMode === 'X-Band'
                        ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                        : 'border-slate-700 bg-slate-950 text-slate-300'
                    }`}
                  >
                    X-Band (Wide Beam)
                  </button>
                </div>
              </div>

              <div className="border border-slate-800 bg-slate-900/50 p-2.5 space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400 uppercase">Downlink Bandwidth</span>
                  <strong className="text-cyan-300">{groundComm.allocatedBandwidthPct}%</strong>
                </div>
                <input
                  type="range"
                  min={25}
                  max={100}
                  step={25}
                  value={groundComm.allocatedBandwidthPct}
                  onChange={(e) => onChangeBandwidthPct(parseInt(e.target.value, 10))}
                  aria-label="Downlink Bandwidth Allocation"
                  className="w-full accent-cyan-400 h-1.5 bg-slate-800 cursor-pointer"
                />
              </div>
            </div>

            {/* Dish Manual Slew + Flush Button */}
            <div className="grid grid-cols-2 gap-2 font-mono-tab text-xs">
              <button
                type="button"
                onClick={() => {
                  audioSynth.playSelect();
                  onSteerDish(
                    Math.round(groundComm.navTelemetry.azimuthDeg),
                    Math.max(5, Math.round(groundComm.navTelemetry.elevationDeg)),
                  );
                }}
                disabled={!groundComm.hasLineOfSight}
                className={`py-2 px-3 flex items-center justify-center gap-1.5 font-bold uppercase border cursor-pointer ${
                  groundComm.hasLineOfSight
                    ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60'
                    : 'border-slate-800 bg-slate-900 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                Acquire Sat Vector
              </button>

              <button
                type="button"
                onClick={() => {
                  audioSynth.playSuccess();
                  onFlushSsrBurst();
                }}
                disabled={!groundComm.hasLineOfSight || groundComm.dishLockQualityPct < 45}
                className={`py-2 px-3 flex items-center justify-center gap-1.5 font-bold uppercase cursor-pointer ${
                  groundComm.hasLineOfSight && groundComm.dishLockQualityPct >= 45
                    ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                Flush SSR Burst
              </button>
            </div>
          </div>

          {/* SSR Buffer Card */}
          <div className="border border-slate-800 bg-[#080d19] p-4 space-y-2.5 font-mono-tab">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-cyan-400" />
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                  Onboard Solid-State Recorder (SSR)
                </h3>
              </div>
              <span className={`text-[10px] font-bold ${isBufferOverflowRisk ? 'text-rose-400' : 'text-slate-300'}`}>
                {bufferPct.toFixed(1)}% ({groundComm.bufferStoredGB.toFixed(1)}/{groundComm.bufferCapacityGB} GB)
              </span>
            </div>

            <div className="h-3 w-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  isBufferOverflowRisk ? 'bg-rose-500' : bufferPct > 55 ? 'bg-amber-400' : 'bg-cyan-400'
                }`}
                style={{ width: `${bufferPct}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px] pt-1">
              <div className="border border-slate-800 bg-slate-900/50 p-2">
                <span className="text-slate-500 block">DISH AZ / EL</span>
                <strong className="text-white">{groundComm.dishAzimuthDeg}° / {groundComm.dishElevationDeg}°</strong>
              </div>
              <div className="border border-slate-800 bg-slate-900/50 p-2">
                <span className="text-slate-500 block">RANGE</span>
                <strong className="text-cyan-300">{groundComm.navTelemetry.rangeKm.toLocaleString()} km</strong>
              </div>
              <div className="border border-slate-800 bg-slate-900/50 p-2">
                <span className="text-slate-500 block">SIGNAL STRENGTH</span>
                <strong className="text-emerald-400">{groundComm.navTelemetry.signalStrengthDbm} dBm</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Interactive Ground Station Handover Directory */}
        <div className="lg:col-span-6 border border-slate-800 bg-[#080d19] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-400" />
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                Station Handover Selector (Click to Switch Dish)
              </h3>
            </div>
            <span className="font-mono-tab text-[10px] text-slate-400">
              Sub-Sat: {orbitState.subSatLatDeg}°, {orbitState.subSatLonDeg}°
            </span>
          </div>

          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
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

              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    audioSynth.playSelect();
                    onSelectStation(st.id);
                  }}
                  className={`w-full text-left border p-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-500/40'
                      : los.hasLineOfSight
                      ? 'border-emerald-500/40 bg-emerald-950/15 hover:border-emerald-400'
                      : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono-tab text-[10px] uppercase tracking-wider text-cyan-300">
                        {st.agency} · {st.network}
                      </div>
                      <div className="mt-0.5 font-display text-xs font-bold text-white">{st.name}</div>
                      <p className="mt-1 text-[11px] text-slate-300">{st.locationDesc}</p>
                    </div>

                    <span
                      className={`font-mono-tab text-[10px] font-bold px-2 py-0.5 shrink-0 ${
                        los.hasLineOfSight
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {los.hasLineOfSight ? `PASS (${los.elevationAngleDeg}° El)` : 'OCCLUDED'}
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-2 font-mono-tab text-[10px] text-slate-400">
                    <div>
                      Dish: <strong className="text-slate-200">{st.antennaDiameterM}m</strong>
                    </div>
                    <div>
                      Band: <strong className="text-cyan-300">{st.frequencyBand}</strong>
                    </div>
                    <div>
                      Max: <strong className="text-slate-200">{st.maxDataRateMbps} Mbps</strong>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border border-emerald-500/30 bg-emerald-950/15 p-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-300">
              <Waves className="h-3.5 w-3.5" />
              Why High-Latitude Dishes (CSA Inuvik 68.3°N) Matter
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Equatorial dishes miss high-latitude polar orbits for hours. Switching to northern stations like CSA Inuvik or Svalbard keeps continuous Line-of-Sight on {body.name} polar orbits so science buffers never overflow.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
