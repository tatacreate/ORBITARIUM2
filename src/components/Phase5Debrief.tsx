import { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Award,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  LogIn,
  RotateCcw,
  Save,
  Share2,
  Trophy,
  XCircle,
} from 'lucide-react';
import { OFFICIAL_REFERENCES } from '../data/references';
import { getCatalogParts } from '../engine/physics';
import type { MissionConfig, SimulationOutcome, TelemetryReport } from '../types/mission';
import { buildMissionReportText, encodeDesignCode } from '../utils/designShare';

interface Phase5DebriefProps {
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
  onModifyInAssembly: () => void;
  onModifyInPlanner: () => void;
}

export function Phase5Debrief({
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
  onModifyInAssembly,
  onModifyInPlanner,
}: Phase5DebriefProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const parts = getCatalogParts(config);
  const shareCode = encodeDesignCode(config);

  const axes = [
    { label: 'Science', value: outcome.scienceScore },
    { label: 'Margin', value: outcome.marginScore },
    { label: 'Budget', value: outcome.budgetScore },
    { label: 'Synergy', value: outcome.synergyScore },
    { label: 'Team Ops', value: outcome.collabScore },
  ];

  const cx = 110;
  const cy = 110;
  const maxR = 72;
  const radarPoints = axes
    .map((a, idx) => {
      const angle = (idx / axes.length) * Math.PI * 2 - Math.PI / 2;
      const r = (Math.max(10, a.value) / 100) * maxR;
      return `${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`;
    })
    .join(' ');

  const gradeStyle: Record<string, string> = {
    S: 'border-emerald-400 bg-emerald-950/50 text-emerald-300',
    A: 'border-cyan-400 bg-cyan-950/50 text-cyan-200',
    B: 'border-amber-400 bg-amber-950/40 text-amber-200',
    C: 'border-orange-400 bg-orange-950/40 text-orange-200',
    F: 'border-rose-500 bg-rose-950/50 text-rose-300',
  };

  const scoreDelta = previousScore !== null ? outcome.totalScore - previousScore : null;

  const handleDownloadReport = () => {
    const text = buildMissionReportText(
      config,
      telemetry,
      outcome,
      runCount,
      user?.displayName || roomTitle || 'Flight Director',
      roomId,
    );
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orbitarium-report-${parts.objective.id}-run${runCount}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyCode = () => {
    void navigator.clipboard.writeText(shareCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div className="pointer-events-auto fixed inset-0 top-[52px] z-20 overflow-y-auto bg-[#050811]/95 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-5 pb-20">
        {/* Top NASA-Style Mission Debrief Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-700 bg-[#080d19] p-5 shadow-2xl">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center border-2 ${
                gradeStyle[outcome.grade] || gradeStyle.C
              }`}
            >
              <span className="font-mono-tab text-[10px] uppercase tracking-wider opacity-80">
                Grade
              </span>
              <span className="font-display text-4xl font-bold leading-none">
                {outcome.grade}
              </span>
            </div>

            <div>
              <div className="text-[11px] font-mono-tab uppercase tracking-widest text-cyan-400">
                Phase 5 of 5 · Official NASA-Style Mission Debrief · Run #{runCount}
              </div>
              <h1 className="mt-0.5 font-display text-2xl font-bold text-white">
                {outcome.missionSuccess
                  ? `${parts.objective.title} — Mission Accomplished!`
                  : `${parts.objective.title} — Mission Anomaly`}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 font-mono-tab text-xs text-slate-300">
                <span>
                  Score: <strong className="text-white">{outcome.totalScore} / 500</strong>
                </span>
                {scoreDelta !== null && (
                  <span className={scoreDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    ({scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} vs Run #{runCount - 1})
                  </span>
                )}
                <span>· {parts.difficulty.label}</span>
                {outcome.hullRemainingPct !== undefined && (
                  <span
                    className={
                      outcome.hullRemainingPct >= 65
                        ? 'text-emerald-300'
                        : outcome.hullRemainingPct > 0
                        ? 'text-amber-300'
                        : 'text-rose-400 font-bold'
                    }
                  >
                    · Hull: {outcome.hullRemainingPct}%
                  </span>
                )}
                {outcome.wrongChoicesCount !== undefined && outcome.wrongChoicesCount > 0 && (
                  <span className="text-rose-300">
                    · {outcome.wrongChoicesCount} Critical Flight Error
                    {outcome.wrongChoicesCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onModifyInAssembly}
              className="flex items-center gap-1.5 bg-cyan-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Modify &amp; Re-Simulate
            </button>
            <button
              type="button"
              onClick={onModifyInPlanner}
              className="border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-slate-200 hover:border-cyan-400 cursor-pointer"
            >
              Adjust Rocket &amp; Orbit
            </button>
          </div>
        </div>

        {/* Plain-Language Diagnosis Callout */}
        <div
          className={`border p-4 ${
            outcome.missionSuccess
              ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-100'
              : 'border-rose-500/60 bg-rose-950/30 text-rose-100'
          }`}
        >
          <div className="flex items-start gap-3">
            {outcome.missionSuccess ? (
              <Award className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="text-xs font-mono-tab uppercase tracking-wider font-bold">
                {outcome.missionSuccess ? 'Why Your Mission Succeeded' : 'Why Your Mission Failed'}
              </div>
              <p className="text-sm leading-relaxed">
                {outcome.failureSummary
                  ? outcome.failureSummary
                  : `Your spacecraft survived ${telemetry.estimatedLifetimeYears} years around ${parts.orbit.shortName}, delivered ${telemetry.scienceReturnPotential} Science Value within your $${telemetry.budgetCapM}M budget, and kept earthbound antennas streaming cleanly!`}
              </p>
            </div>
          </div>
        </div>

        {/* Middle Row: 5-Axis Radar Chart + Score Breakdown + Checklist */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Radar + Score Bars */}
          <div className="lg:col-span-5 border border-slate-800 bg-[#080d19] p-4 flex flex-col items-center justify-between gap-4">
            <div className="w-full text-xs font-mono-tab uppercase tracking-wider text-slate-400">
              5-Pillar Mission Performance
            </div>

            <svg viewBox="0 0 220 220" className="w-52 h-52">
              {[0.33, 0.66, 1].map((scale) => (
                <polygon
                  key={scale}
                  points={axes
                    .map((_, idx) => {
                      const angle = (idx / axes.length) * Math.PI * 2 - Math.PI / 2;
                      return `${(cx + Math.cos(angle) * maxR * scale).toFixed(1)},${(cy + Math.sin(angle) * maxR * scale).toFixed(1)}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="1"
                />
              ))}
              {axes.map((a, idx) => {
                const angle = (idx / axes.length) * Math.PI * 2 - Math.PI / 2;
                const lx = cx + Math.cos(angle) * (maxR + 20);
                const ly = cy + Math.sin(angle) * (maxR + 18);
                return (
                  <g key={a.label}>
                    <line
                      x1={cx}
                      y1={cy}
                      x2={cx + Math.cos(angle) * maxR}
                      y2={cy + Math.sin(angle) * maxR}
                      stroke="#1e293b"
                    />
                    <text
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#94a3b8"
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {a.label}
                    </text>
                  </g>
                );
              })}
              <polygon
                points={radarPoints}
                fill="rgba(6, 182, 212, 0.25)"
                stroke="#22d3ee"
                strokeWidth="2"
              />
            </svg>

            <div className="w-full space-y-1.5 text-xs">
              {axes.map((a) => (
                <div key={a.label} className="flex items-center justify-between font-mono-tab">
                  <span className="text-slate-300">{a.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-28 bg-slate-800">
                      <div className="h-1.5 bg-cyan-400" style={{ width: `${a.value}%` }} />
                    </div>
                    <span className="w-10 text-right text-white">{a.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Engineering Checks */}
          <div className="lg:col-span-7 border border-slate-800 bg-[#080d19] p-4 space-y-2.5">
            <div className="text-xs font-mono-tab uppercase tracking-wider text-slate-400">
              Engineering Checklist &amp; Cause-and-Effect Breakdown
            </div>
            <div className="space-y-2 max-h-[340px] overflow-y-auto aero-scroll pr-1">
              {outcome.criteriaChecks.map((check) => (
                <div
                  key={check.label}
                  className="border border-slate-800 bg-slate-900/60 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                      {check.passed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                      )}
                      {check.label}
                    </span>
                    <span
                      className={`font-mono-tab text-[11px] ${
                        check.passed ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {check.detail}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400">{check.whyItMattered}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Engineering Lessons & Multiple Valid Solutions Insight */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-slate-800 bg-[#080d19] p-4 space-y-2">
            <div className="text-xs font-mono-tab uppercase tracking-wider text-cyan-400">
              How Your Design Choices Shaped This Run
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
              {outcome.lessons.map((lesson) => (
                <li key={lesson} className="leading-relaxed">
                  {lesson}
                </li>
              ))}
            </ul>
          </div>

          <div className="border border-slate-800 bg-[#080d19] p-4 space-y-2">
            <div className="text-xs font-mono-tab uppercase tracking-wider text-amber-300">
              Multiple Valid Architectures for {parts.objective.targetBody.toUpperCase()}
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {parts.objective.alternativeStrategies}
            </p>
            <p className="text-[11px] text-slate-400">
              Try clicking <strong className="text-cyan-300">Modify &amp; Re-Simulate</strong> to test a completely different engine, power, or orbit combination and compare your score!
            </p>
          </div>
        </div>

        {/* Bottom Actions: Share Code, Download Report, Save to Log & Leaderboard */}
        <div className="border border-slate-800 bg-[#080d19] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:border-cyan-400 cursor-pointer"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-cyan-400" />}
              {copiedCode ? 'Design Code Copied!' : 'Copy Share Code'}
            </button>
            <button
              type="button"
              onClick={handleDownloadReport}
              className="flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:border-cyan-400 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              Download Report (.txt)
            </button>
            <span className="hidden sm:inline-flex items-center gap-1 font-mono-tab text-[11px] text-slate-500">
              <Share2 className="h-3 w-3" />
              {shareCode.slice(0, 18)}...
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user ? (
              <>
                <button
                  type="button"
                  disabled={saving || Boolean(savedId)}
                  onClick={onSaveMission}
                  className="flex items-center gap-1.5 border border-cyan-500/60 bg-cyan-950/40 px-3.5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/50 cursor-pointer disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savedId ? 'Saved to Log' : saving ? 'Saving...' : 'Save to Log'}
                </button>
                <button
                  type="button"
                  disabled={publishing || Boolean(publishedId)}
                  onClick={onPublishLeaderboard}
                  className="flex items-center gap-1.5 bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 cursor-pointer disabled:opacity-60"
                >
                  <Trophy className="h-3.5 w-3.5" />
                  {publishedId ? 'Posted to Rankings!' : publishing ? 'Posting...' : 'Post to Leaderboard'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                className="flex items-center gap-1.5 border border-cyan-500/60 bg-cyan-950/40 px-4 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/50 cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign in with Google to Save &amp; Rank
              </button>
            )}
          </div>
        </div>

        {/* Official NASA & CSA Reference Links */}
        <div className="border border-slate-800 bg-[#080d19] p-4 space-y-2.5">
          <div className="text-[11px] font-mono-tab uppercase tracking-wider text-cyan-400">
            Official NASA &amp; Canadian Space Agency Resources
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {OFFICIAL_REFERENCES.map((ref) => (
              <a
                key={ref.id}
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start justify-between gap-2 border border-slate-800 bg-slate-900/60 p-3 hover:border-cyan-400/70 transition-colors"
              >
                <div>
                  <div className="text-[10px] font-mono-tab uppercase text-amber-300">
                    {ref.agency}
                  </div>
                  <div className="mt-0.5 text-xs font-bold text-white group-hover:text-cyan-300">
                    {ref.title}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400 leading-snug">
                    {ref.subtitle}
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-300 shrink-0 mt-0.5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
