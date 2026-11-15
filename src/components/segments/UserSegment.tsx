import { useState, useEffect, useRef } from 'react';
import {
  Award,
  CheckCircle2,
  XCircle,
  MapPin,
  RotateCcw,
  Sparkles,
  ArrowRight,
  LineChart,
  Lock,
  Layers,
} from 'lucide-react';
import { CELESTIAL_BODIES } from '../../engine/orbitalMechanics';
import type {
  CsaChallengeState,
  DiscoveryCard,
  GmatTelemetrySample,
  GroundCommState,
  LaunchBurnState,
  NasaInstrument,
  NasaObjectiveSpec,
  OrbitalState,
  SpacecraftOpsState,
  SurfaceLandmark,
  SystemVerificationScorecard,
} from '../../types/nasaSegments';

interface UserSegmentProps {
  selectedObjective: NasaObjectiveSpec;
  orbitState: OrbitalState;
  burnState: LaunchBurnState;
  groundComm: GroundCommState;
  instruments: NasaInstrument[];
  scorecard: SystemVerificationScorecard;
  discoveryCards: DiscoveryCard[];
  csaChallenges: CsaChallengeState;
  opsState: SpacecraftOpsState;
  landmarks: SurfaceLandmark[];
  groundTrackCoveragePct: number;
  scannedTiles: Set<string>;
  telemetryHistory: GmatTelemetrySample[];
  onResetMission: () => void;
  onGoToConOps: () => void;
  onPrevSegment: () => void;
}

export function UserSegment({
  selectedObjective,
  orbitState,
  burnState,
  groundComm,
  scorecard,
  discoveryCards,
  csaChallenges,
  opsState,
  landmarks,
  groundTrackCoveragePct,
  scannedTiles,
  telemetryHistory,
  onResetMission,
  onGoToConOps,
  onPrevSegment,
}: UserSegmentProps) {
  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const plotCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const body = CELESTIAL_BODIES[selectedObjective.targetBody];

  const [scienceLayer, setScienceLayer] = useState<'composite' | 'sar' | 'spectral'>('composite');
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<string>(landmarks[0]?.id ?? '');
  const [selectedPlotMetric, setSelectedPlotMetric] = useState<
    'altitude' | 'velocity' | 'propellant' | 'eccentricity'
  >('altitude');

  const selectedLandmark = landmarks.find((l) => l.id === selectedLandmarkId) || landmarks[0];
  const downlinkedCount = landmarks.filter((l) => l.downlinked).length;
  const capturedCount = landmarks.filter((l) => l.captured).length;

  // Draw Interactive Science Reconstruction Map (Equirectangular Projection + Reconstructed Discovery Heatmaps)
  useEffect(() => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Planetary base terrain tone
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (selectedObjective.targetBody === 'mars') {
      bgGrad.addColorStop(0, '#1e100a');
      bgGrad.addColorStop(0.5, '#2b140b');
      bgGrad.addColorStop(1, '#1e100a');
    } else if (selectedObjective.targetBody === 'moon') {
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.5, '#1e293b');
      bgGrad.addColorStop(1, '#0f172a');
    } else {
      bgGrad.addColorStop(0, '#091a2e');
      bgGrad.addColorStop(0.5, '#060c1a');
      bgGrad.addColorStop(1, '#091a2e');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle polar ice / regolith bands
    ctx.fillStyle = selectedObjective.targetBody === 'mars' ? 'rgba(251,146,60,0.08)' : 'rgba(186,230,253,0.08)';
    ctx.fillRect(0, 0, width, 24);
    ctx.fillRect(0, height - 24, width, 24);

    // Grid lines
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.45)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += width / 12) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += height / 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Orbit Swath Tiles
    const cellW = width / 36;
    const cellH = height / 18;
    scannedTiles.forEach((tileKey) => {
      const [colStr, rowStr] = tileKey.split(':');
      const col = parseInt(colStr, 10);
      const row = parseInt(rowStr, 10);
      if (!isNaN(col) && !isNaN(row)) {
        ctx.fillStyle =
          scienceLayer === 'sar'
            ? 'rgba(34, 211, 238, 0.25)'
            : scienceLayer === 'spectral'
            ? 'rgba(168, 85, 247, 0.24)'
            : 'rgba(16, 185, 129, 0.2)';
        ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
      }
    });

    // Ground track curve
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let x = 0; x < width; x += 4) {
      const lonNorm = (x / width) * 2 * Math.PI;
      const latDeg = Math.sin(lonNorm) * orbitState.inclinationDeg;
      const y = height / 2 - (latDeg / 90) * (height / 2);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Reconstructed Discovery Heatmap Regions for Captured & Downlinked Landmarks
    landmarks.forEach((lm) => {
      const lx = ((lm.lonDeg + 180) / 360) * width;
      const ly = height / 2 - (lm.latDeg / 90) * (height / 2);
      const isSelected = lm.id === selectedLandmarkId;

      if (lm.downlinked) {
        const rad = scienceLayer === 'sar' ? 42 : 36;
        const grad = ctx.createRadialGradient(lx, ly, 4, lx, ly, rad);
        grad.addColorStop(0, scienceLayer === 'spectral' ? 'rgba(244, 63, 94, 0.85)' : 'rgba(16, 185, 129, 0.82)');
        grad.addColorStop(0.55, scienceLayer === 'sar' ? 'rgba(6, 182, 212, 0.42)' : 'rgba(245, 158, 11, 0.38)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lx, ly, rad, 0, Math.PI * 2);
        ctx.fill();
      } else if (lm.captured) {
        ctx.strokeStyle = '#fbbf24';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(lx, ly, 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Pin Marker
      ctx.fillStyle = lm.downlinked ? '#10b981' : lm.captured ? '#fbbf24' : '#64748b';
      ctx.beginPath();
      ctx.arc(lx, ly, isSelected ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = lm.downlinked ? '#ecfdf5' : '#94a3b8';
      ctx.font = '9px monospace';
      ctx.fillText(lm.name.split(' ').slice(0, 2).join(' '), Math.min(width - 90, lx + 8), Math.max(12, ly - 6));
    });

    // Sub-satellite Live Position
    const satX = ((orbitState.subSatLonDeg + 180) / 360) * width;
    const satY = height / 2 - (orbitState.subSatLatDeg / 90) * (height / 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(satX, satY, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }, [orbitState, scannedTiles, selectedObjective, landmarks, scienceLayer, selectedLandmarkId]);

  const handleMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);

    let closest = landmarks[0];
    let bestD = Infinity;
    landmarks.forEach((lm) => {
      const lx = ((lm.lonDeg + 180) / 360) * canvas.width;
      const ly = canvas.height / 2 - (lm.latDeg / 90) * (canvas.height / 2);
      const d = Math.hypot(px - lx, py - ly);
      if (d < bestD) {
        bestD = d;
        closest = lm;
      }
    });
    if (closest && bestD < 45) setSelectedLandmarkId(closest.id);
  };

  // Draw GMAT Live Analytical Plot
  useEffect(() => {
    const canvas = plotCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.fillStyle = '#050913';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (!telemetryHistory || telemetryHistory.length < 2) return;

    const dataPoints = telemetryHistory.map((s) => {
      if (selectedPlotMetric === 'altitude') return s.altitudeKm;
      if (selectedPlotMetric === 'velocity') return s.orbitalSpeedKms;
      if (selectedPlotMetric === 'propellant') return s.propellantRemainingKg;
      return s.eccentricity;
    });

    const minVal = Math.min(...dataPoints) * 0.95;
    const maxVal = Math.max(...dataPoints) * 1.05 || minVal + 1;
    const strokeColor =
      selectedPlotMetric === 'velocity'
        ? '#38bdf8'
        : selectedPlotMetric === 'propellant'
        ? '#f59e0b'
        : selectedPlotMetric === 'eccentricity'
        ? '#a855f7'
        : '#22d3ee';

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    dataPoints.forEach((val, idx) => {
      const x = (idx / (dataPoints.length - 1)) * width;
      const normalizedY = (val - minVal) / (maxVal - minVal);
      const y = height - normalizedY * (height - 20) - 10;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(`Max: ${maxVal.toFixed(1)}`, 10, 16);
    ctx.fillText(`Min: ${minVal.toFixed(1)}`, 10, height - 8);
    ctx.fillText(`Latest: ${dataPoints[dataPoints.length - 1]?.toFixed(2)}`, width - 95, 16);
  }, [telemetryHistory, selectedPlotMetric]);

  return (
    <div className="space-y-4">
      {/* Segment Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-800 bg-[#080d19] p-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="border border-purple-500/50 bg-purple-950/40 px-2 py-0.5 font-mono-tab text-[10px] font-bold uppercase tracking-wider text-purple-300">
              NASA Segment 4: Interactive Science Assembly &amp; Verification
            </span>
            <span className="text-xs text-slate-400">· Data Reconstruction Map &amp; Mission Performance Rating</span>
          </div>
          <h2 className="mt-1 font-display text-xl md:text-2xl font-bold text-white">
            Planetary Discovery Reconstruction &amp; Flight Performance Debrief
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Inspect reconstructed science heatmaps unlocked by capturing targets in Space (Seg 2) and downlinking packets via dish passes (Seg 3), and review your Dynamic Systems Performance Index.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevSegment}
            className="border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            ← Ground
          </button>
          <button
            type="button"
            onClick={onGoToConOps}
            className="flex items-center gap-2 bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
          >
            <span>Master ConOps HUD →</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Science Map + GMAT Plots (Left 5 cols) & Scorecard (Right 7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 space-y-4">
          {/* Interactive Science Reconstruction Map */}
          <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-400" />
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                  {body.name} Science Data Reconstruction
                </h3>
              </div>
              <span className="font-mono-tab text-[11px] font-bold text-emerald-400">
                {downlinkedCount}/{landmarks.length} Downlinked
              </span>
            </div>

            {/* Layer Filter Toggles */}
            <div className="grid grid-cols-3 gap-1 font-mono-tab text-[10px]">
              {[
                { id: 'composite', label: 'Composite Map' },
                { id: 'sar', label: 'RADARSAT SAR' },
                { id: 'spectral', label: 'IR / Methane' },
              ].map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setScienceLayer(layer.id as 'composite' | 'sar' | 'spectral')}
                  className={`py-1 px-2 border cursor-pointer flex items-center justify-center gap-1 ${
                    scienceLayer === layer.id
                      ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 font-bold'
                      : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="h-3 w-3" />
                  {layer.label}
                </button>
              ))}
            </div>

            <div className="border border-slate-800 bg-slate-950 overflow-hidden relative">
              <canvas
                ref={mapCanvasRef}
                width={480}
                height={230}
                onClick={handleMapClick}
                className="w-full h-auto block cursor-pointer"
              />
            </div>

            {/* Selected Landmark Packet Inspector */}
            {selectedLandmark && (
              <div className="border border-slate-800 bg-slate-900/60 p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <strong className="font-display text-white">{selectedLandmark.name}</strong>
                  <span
                    className={`font-mono-tab text-[10px] font-bold px-2 py-0.5 ${
                      selectedLandmark.downlinked
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : selectedLandmark.captured
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {selectedLandmark.downlinked
                      ? `RECONSTRUCTED (${selectedLandmark.signalQualityPct}%)`
                      : selectedLandmark.captured
                      ? 'QUEUED IN SSR (DOWNLINK IN SEG 3)'
                      : 'UNSCANNED (SCAN IN SEG 2)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {selectedLandmark.downlinked
                    ? selectedLandmark.regionDataSummary
                    : selectedLandmark.captured
                    ? 'Science packet is stored onboard SSR. Switch to Ground Segment (Seg 3) and lock dish pass to downlink this dataset!'
                    : `Fly near (${selectedLandmark.latDeg}°, ${selectedLandmark.lonDeg}°) and fire ${selectedLandmark.requiredInstrument} in Space Segment (Seg 2).`}
                </p>
              </div>
            )}

            {/* Quick Landmark Selector Pills */}
            <div className="flex flex-wrap gap-1.5 font-mono-tab text-[10px]">
              {landmarks.map((lm) => (
                <button
                  key={lm.id}
                  type="button"
                  onClick={() => setSelectedLandmarkId(lm.id)}
                  className={`px-2 py-1 border cursor-pointer ${
                    lm.id === selectedLandmarkId
                      ? 'border-cyan-400 bg-cyan-950/50 text-white font-bold'
                      : lm.downlinked
                      ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
                      : lm.captured
                      ? 'border-amber-500/40 bg-amber-950/20 text-amber-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  {lm.downlinked ? '✔ ' : lm.captured ? '◔ ' : '○ '}
                  {lm.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* GMAT Live Analytical Plot Card */}
          <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LineChart className="h-4 w-4 text-cyan-400" />
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                  GMAT Telemetry Plot
                </h3>
              </div>
              <span className="font-mono-tab text-[10px] text-slate-400">
                {telemetryHistory.length} Samples
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1 font-mono-tab text-[10px]">
              {(['altitude', 'velocity', 'propellant', 'eccentricity'] as const).map((metric) => (
                <button
                  key={metric}
                  type="button"
                  onClick={() => setSelectedPlotMetric(metric)}
                  className={`p-1.5 text-center border capitalize cursor-pointer ${
                    selectedPlotMetric === metric
                      ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 font-bold'
                      : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-white'
                  }`}
                >
                  {metric === 'eccentricity' ? 'Ecc (e)' : metric}
                </button>
              ))}
            </div>

            <div className="border border-slate-800 bg-slate-950 overflow-hidden">
              <canvas ref={plotCanvasRef} width={480} height={140} className="w-full h-auto block" />
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Performance Rating & NASA Verification Scorecard */}
        <div className="lg:col-span-7 border border-slate-800 bg-[#080d19] p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-400" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
                  Dynamic Mission Performance &amp; NASA Verification
                </h3>
              </div>
              <div className="mt-0.5 font-mono-tab text-[11px] text-slate-400">
                Rank: <strong className="text-amber-300">{scorecard.missionRankBadge}</strong> · Index: <strong className="text-cyan-300">{scorecard.dynamicPerformanceScore}/100</strong>
              </div>
            </div>

            <div
              className={`px-3 py-1 font-mono-tab text-xs font-bold border ${
                scorecard.overallPass
                  ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                  : 'border-rose-500/50 bg-rose-950/40 text-rose-300'
              }`}
            >
              {scorecard.flightCertificationGrade}
            </div>
          </div>

          {/* 6 Hands-On Flight Pillars */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono-tab text-[11px]">
            <div className="border border-slate-800 bg-slate-900/50 p-2.5">
              <span className="text-slate-400 text-[9px] block">ASCENT &amp; SECO EFFICIENCY</span>
              <strong className="text-amber-300 text-sm">{burnState.launchEfficiencyScore ?? 92}%</strong>
            </div>
            <div className="border border-slate-800 bg-slate-900/50 p-2.5">
              <span className="text-slate-400 text-[9px] block">MANEUVER ACCURACY</span>
              <strong className="text-cyan-300 text-sm">{opsState.lastManeuverAccuracyPct}%</strong>
            </div>
            <div className="border border-slate-800 bg-slate-900/50 p-2.5">
              <span className="text-slate-400 text-[9px] block">HAZARDS SURVIVED</span>
              <strong className="text-emerald-400 text-sm">
                {opsState.hazardsSurvived} / {opsState.hazardsSurvived + opsState.hazardsFailed}
              </strong>
            </div>
            <div className="border border-slate-800 bg-slate-900/50 p-2.5">
              <span className="text-slate-400 text-[9px] block">CANADARM3 OPS</span>
              <strong className="text-amber-300 text-sm">{opsState.canadarm.completedCount} Captures</strong>
            </div>
            <div className="border border-slate-800 bg-slate-900/50 p-2.5">
              <span className="text-slate-400 text-[9px] block">SCIENCE RECONSTRUCTED</span>
              <strong className="text-emerald-400 text-sm">
                {downlinkedCount}/{landmarks.length} ({capturedCount} cap)
              </strong>
            </div>
            <div className="border border-slate-800 bg-slate-900/50 p-2.5">
              <span className="text-slate-400 text-[9px] block">DISH CARRIER LOCK</span>
              <strong className="text-cyan-300 text-sm">{groundComm.dishLockQualityPct}% Avg</strong>
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900/50 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between font-mono-tab text-[11px]">
              <span className="text-cyan-300 font-bold uppercase">Chief Flight Director Assessment:</span>
              <span className="text-slate-400">Compliance: {scorecard.complianceScore}%</span>
            </div>
            <p className="text-[11px] text-slate-200 leading-relaxed">
              {scorecard.systemsEngineerSummary}
            </p>
          </div>

          {/* 7-Requirement Verification Matrix Table */}
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            {scorecard.items.map((item) => (
              <div
                key={item.id}
                className={`border p-2.5 text-xs ${
                  item.passed ? 'border-emerald-900/40 bg-emerald-950/15' : 'border-rose-900/40 bg-rose-950/15'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tab text-[9px] uppercase px-1 border border-slate-700 bg-slate-800 text-slate-300">
                          {item.segment}
                        </span>
                        <strong className="text-white font-medium">{item.requirementName}</strong>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300">{item.consequence}</p>
                    </div>
                  </div>
                  <span
                    className={`font-mono-tab text-[10px] font-bold px-1.5 py-0.5 shrink-0 ${
                      item.passed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {item.passed ? 'VERIFIED' : 'DEFICIENT'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={onResetMission}
              className="flex items-center gap-1.5 border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-cyan-400" />
              <span>Re-Engineer Mission Architecture</span>
            </button>
          </div>
        </div>
      </div>

      {/* Gamified Space Science Discovery Cards */}
      <div className="border border-slate-800 bg-[#080d19] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
              Space Science Discovery Cards (NASA &amp; CSA Mission Heritage)
            </h3>
          </div>
          <span className="font-mono-tab text-xs text-cyan-300">
            {discoveryCards.filter((c) => c.unlocked).length} / {discoveryCards.length} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {discoveryCards.map((card) => (
            <div
              key={card.id}
              className={`border p-3.5 flex flex-col justify-between ${
                card.unlocked
                  ? 'border-cyan-500/50 bg-cyan-950/20'
                  : 'border-slate-800 bg-slate-900/40 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 font-mono-tab text-[10px]">
                  <span className={card.unlocked ? 'text-amber-300 font-bold' : 'text-slate-500'}>
                    {card.agency} · {card.category}
                  </span>
                  {card.unlocked ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <CheckCircle2 className="h-3.5 w-3.5" /> UNLOCKED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-400">
                      <Lock className="h-3 w-3" /> LOCKED
                    </span>
                  )}
                </div>
                <h4 className="mt-1.5 font-display text-sm font-bold text-white">{card.title}</h4>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">{card.fact}</p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800/80 font-mono-tab text-[10px]">
                {card.unlocked ? (
                  <span className="text-cyan-300">Mission Heritage: {card.realMission}</span>
                ) : (
                  <span className="text-amber-300/90">Unlock: {card.unlockRequirement}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
