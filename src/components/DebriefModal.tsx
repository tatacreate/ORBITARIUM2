import { useState } from 'react';
import {
  Award,
  Check,
  CheckCircle2,
  Download,
  RotateCcw,
  Save,
  Share2,
  Trophy,
  XCircle,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { getCatalogParts } from '../engine/physics';
import { buildMissionReportText, encodeDesignCode } from '../utils/designShare';
import type { MissionConfig, SimulationOutcome, TelemetryReport } from '../types/mission';

interface DebriefModalProps {
  config: MissionConfig;
  telemetry: TelemetryReport;
  outcome: SimulationOutcome;
  runCount: number;
  previousScore: number | null;
  user: User | null;
  roomId: string | null;
  roomTitle: string | null;
  savedId: string | null;
  saving: boolean;
  publishedId: string | null;
  publishing: boolean;
  onSaveMission: () => void;
  onPublishLeaderboard: () => void;
  onSignIn: () => void;
  onRedesign: () => void;
}

function RadarChart({ outcome }: { outcome: SimulationOutcome }) {
  const axes = [
    { label: 'SCIENCE', val: outcome.scienceScore },
    { label: 'MARGIN', val: outcome.marginScore },
    { label: 'BUDGET', val: outcome.budgetScore },
    { label: 'SYNERGY', val: outcome.synergyScore },
    { label: 'OPS/TEAM', val: outcome.collabScore },
  ];

  const cx = 130;
  const cy = 120;
  const rMax = 78;
  const toPoint = (idx: number, ratio: number) => {
    const angle = (idx / axes.length) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(angle) * rMax * ratio, cy + Math.sin(angle) * rMax * ratio];
  };

  const rings = [0.25, 0.5, 0.75, 1.0];
  const polyPoints = axes
    .map((a, i) => toPoint(i, a.val / 100).join(','))
    .join(' ');

  return (
    <svg viewBox="0 0 260 245" className="w-full max-w-[250px] mx-auto">
      {rings.map((r) => (
        <polygon
          key={r}
          points={axes.map((_, i) => toPoint(i, r).join(',')).join(' ')}
          fill="none"
          stroke="#1e293b"
          strokeWidth="1"
        />
      ))}
      {axes.map((a, i) => {
        const [x, y] = toPoint(i, 1);
        const [lx, ly] = toPoint(i, 1.24);
        return (
          <g key={a.label}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#1e293b" strokeWidth="1" />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#94a3b8"
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
            >
              {a.label} ({a.val})
            </text>
          </g>
        );
      })}
      <polygon
        points={polyPoints}
        fill="rgba(6, 182, 212, 0.22)"
        stroke="#06b6d4"
        strokeWidth="2"
      />
      {axes.map((a, i) => {
        const [px, py] = toPoint(i, a.val / 100);
        return <circle key={a.label} cx={px} cy={py} r="3.5" fill="#22d3ee" />;
      })}
    </svg>
  );
}

export function DebriefModal({
  config,
  telemetry,
  outcome,
  runCount,
  previousScore,
  user,
  roomId,
  roomTitle,
  savedId,
  saving,
  publishedId,
  publishing,
  onSaveMission,
  onPublishLeaderboard,
  onSignIn,
  onRedesign,
}: DebriefModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const { difficulty, constraintEvent, objective, orbit, launchVehicle } = getCatalogParts(config);
  const delta = previousScore !== null ? outcome.totalScore - previousScore : null;

  const gradeColor =
    outcome.grade === 'S'
      ? 'text-cyan-300 border-cyan-400'
      : outcome.grade === 'A'
        ? 'text-emerald-400 border-emerald-500'
        : outcome.grade === 'B'
          ? 'text-amber-300 border-amber-400'
          : 'text-rose-400 border-rose-500';

  const handleDownloadReport = () => {
    const pilot = roomTitle || user?.displayName || 'Flight Engineer';
    const content = buildMissionReportText(config, telemetry, outcome, runCount, pilot, roomId);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orbitarium-${objective.id}-run${runCount}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyShareCode = () => {
    const code = encodeDesignCode(config);
    void navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl border border-slate-700 bg-[#080c15] p-6 md:p-7 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs font-mono-tab uppercase tracking-wider text-cyan-400">
              Post-Mission Evaluation · Run #{runCount} · {difficulty.label}
              {constraintEvent.id !== 'none' ? ` · ${constraintEvent.title}` : ''}
            </div>
            <h2 className="mt-1 font-display text-2xl md:text-3xl font-bold text-white">
              {outcome.missionSuccess ? 'Mission Objectives Achieved' : 'Mission Anomaly Failure'}
            </h2>
            <div className="mt-1 text-xs font-mono-tab text-slate-400">
              {objective.title} · {orbit.name} · {launchVehicle.name}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right font-mono-tab">
              <div className="text-[11px] uppercase text-slate-400">Total Score</div>
              <div className="text-2xl font-bold text-white">
                {outcome.totalScore}
                <span className="text-sm text-slate-500"> / 500</span>
              </div>
              {delta !== null && (
                <div
                  className={`text-[11px] ${
                    delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {delta >= 0 ? `+${delta}` : delta} pts vs Run #{runCount - 1}
                </div>
              )}
            </div>
            <div
              className={`flex h-14 w-14 items-center justify-center border-2 font-display text-3xl font-bold ${gradeColor}`}
            >
              {outcome.grade}
            </div>
          </div>
        </div>

        {outcome.failureSummary && (
          <div className="mt-4 border border-rose-500/40 bg-rose-950/35 px-4 py-3 text-sm text-rose-200">
            {outcome.failureSummary}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Radar Chart */}
          <div className="lg:col-span-4 border border-slate-800 bg-slate-950/70 p-3">
            <RadarChart outcome={outcome} />
          </div>

          {/* Middle: Explicit Pass/Fail Mission Criteria + Cause & Effect */}
          <div className="lg:col-span-4 border border-slate-800 bg-slate-900/50 p-3.5 max-h-[300px] overflow-y-auto aero-scroll">
            <div className="text-xs font-mono-tab uppercase tracking-wider text-slate-400 mb-2.5">
              Mission Performance Breakdown
            </div>
            <div className="space-y-2.5 text-xs">
              {outcome.criteriaChecks.map((chk) => (
                <div
                  key={chk.label}
                  className="border-b border-slate-800/80 pb-2 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {chk.passed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                      )}
                      <span className="font-medium text-slate-100 truncate">{chk.label}</span>
                    </div>
                    <span
                      className={`font-mono-tab shrink-0 ${
                        chk.passed ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {chk.detail}
                    </span>
                  </div>
                  <p className="mt-1 pl-5 text-[11px] leading-relaxed text-slate-400">
                    {chk.whyItMattered}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Telemetry Metrics & Trade-off Lessons */}
          <div className="lg:col-span-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs font-mono-tab">
              <div className="border border-slate-800 bg-slate-900/60 p-2.5">
                <div className="text-slate-400">Final Cost</div>
                <div className="mt-0.5 text-sm font-semibold text-white">
                  ${telemetry.totalCostM}M
                </div>
              </div>
              <div className="border border-slate-800 bg-slate-900/60 p-2.5">
                <div className="text-slate-400">Wet Mass</div>
                <div className="mt-0.5 text-sm font-semibold text-white">
                  {telemetry.wetMassKg} kg
                </div>
              </div>
              <div className="border border-slate-800 bg-slate-900/60 p-2.5">
                <div className="text-slate-400">Power Margin</div>
                <div className="mt-0.5 text-sm font-semibold text-white">
                  {telemetry.powerMarginW >= 0 ? `+${telemetry.powerMarginW}` : telemetry.powerMarginW} W
                </div>
              </div>
              <div className="border border-slate-800 bg-slate-900/60 p-2.5">
                <div className="text-slate-400">Lifetime</div>
                <div className="mt-0.5 text-sm font-semibold text-white">
                  {telemetry.estimatedLifetimeMonths} mo
                </div>
              </div>
            </div>

            <div className="border border-slate-800 bg-slate-900/50 p-3">
              <div className="flex items-center gap-2 text-xs font-mono-tab uppercase tracking-wider text-slate-400">
                <Award className="h-3.5 w-3.5 text-cyan-400" />
                Engineering Takeaways
              </div>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-300">
                {outcome.lessons.map((lesson, i) => (
                  <li key={i}>· {lesson}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-800 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRedesign}
              className="flex items-center gap-2 border border-slate-600 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 hover:border-cyan-400 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Modify &amp; Re-Simulate (Run #{runCount + 1})
            </button>
            <button
              type="button"
              onClick={handleDownloadReport}
              className="flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Download Report
            </button>
            <button
              type="button"
              onClick={handleCopyShareCode}
              className="flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
              {copiedCode ? 'Design Code Copied' : 'Share Design'}
            </button>
          </div>

          {user ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={Boolean(publishedId) || publishing}
                onClick={onPublishLeaderboard}
                className="flex items-center gap-1.5 border border-amber-500/60 bg-amber-950/35 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-900/50 transition-colors cursor-pointer disabled:opacity-60"
              >
                {publishedId ? <Check className="h-3.5 w-3.5" /> : <Trophy className="h-3.5 w-3.5" />}
                {publishedId ? 'Ranked on Leaderboard' : publishing ? 'Posting...' : 'Post to Leaderboard'}
              </button>
              <button
                type="button"
                disabled={Boolean(savedId) || saving}
                onClick={onSaveMission}
                className="flex items-center gap-1.5 bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer disabled:opacity-60"
              >
                {savedId ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                {savedId ? 'Saved to Log' : saving ? 'Saving...' : 'Save to Log'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="flex items-center gap-2 bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
            >
              Sign in with Google to Save &amp; Rank
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
