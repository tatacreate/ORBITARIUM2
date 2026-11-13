import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  Copy,
  Download,
  GitCompare,
  History,
  Share2,
  Trash2,
  Trophy,
  Upload,
  X,
} from 'lucide-react';
import { OBJECTIVES } from '../data/catalog';
import { computeTelemetry, getCatalogParts } from '../engine/physics';
import {
  deleteLeaderboardEntry,
  deleteMissionRecord,
  fetchLeaderboardEntries,
  fetchUserMissions,
} from '../services/missionService';
import type { LeaderboardEntry, MissionConfig, MissionRecord } from '../types/mission';
import { decodeDesignCode, encodeDesignCode } from '../utils/designShare';

interface MissionArchiveModalProps {
  user: User | null;
  currentConfig: MissionConfig;
  onLoadConfig: (config: MissionConfig, label: string) => void;
  onClose: () => void;
  onSignIn: () => void;
}

type ArchiveTab = 'leaderboard' | 'saved' | 'compare';

interface ComparableDesign {
  key: string;
  label: string;
  sublabel: string;
  config: MissionConfig;
  score?: number;
  grade?: string;
}

export function MissionArchiveModal({
  user,
  currentConfig,
  onLoadConfig,
  onClose,
  onSignIn,
}: MissionArchiveModalProps) {
  const [activeTab, setActiveTab] = useState<ArchiveTab>('leaderboard');
  const [records, setRecords] = useState<MissionRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [objectiveFilter, setObjectiveFilter] = useState<string>('all');
  const [competitiveOnly, setCompetitiveOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Share & Import state
  const [copiedCurrent, setCopiedCurrent] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importInput, setImportInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Side-by-Side Compare state
  const [slotAKey, setSlotAKey] = useState<string>('current');
  const [slotBKey, setSlotBKey] = useState<string>('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchUserMissions(user.uid).catch(() => [] as MissionRecord[]),
      fetchLeaderboardEntries().catch(() => [] as LeaderboardEntry[]),
    ])
      .then(([myMissions, lbList]) => {
        if (!active) return;
        setRecords(myMissions);
        setLeaderboard(lbList);
        if (lbList.length > 0) {
          setSlotBKey(`lb:${lbList[0].id}`);
        } else {
          const withCfg = myMissions.find((m) => m.designConfig);
          if (withCfg) setSlotBKey(`rec:${withCfg.id}`);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load archive.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  const handleDeleteRecord = async (id: string) => {
    await deleteMissionRecord(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleDeleteLb = async (id: string) => {
    await deleteLeaderboardEntry(id);
    setLeaderboard((prev) => prev.filter((e) => e.id !== id));
  };

  const filteredLeaderboard = useMemo(
    () =>
      leaderboard.filter((entry) => {
        if (objectiveFilter !== 'all' && entry.objectiveId !== objectiveFilter) return false;
        if (competitiveOnly && entry.challengeMode !== 'competitive') return false;
        return true;
      }),
    [leaderboard, objectiveFilter, competitiveOnly],
  );

  const comparablePool: ComparableDesign[] = useMemo(() => {
    const items: ComparableDesign[] = [
      {
        key: 'current',
        label: 'Current Hangar Spacecraft',
        sublabel: 'Active Workspace',
        config: currentConfig,
      },
    ];
    leaderboard.forEach((entry) => {
      if (entry.designConfig) {
        items.push({
          key: `lb:${entry.id}`,
          label: `${entry.teamName} (${entry.totalScore}/500)`,
          sublabel: `${entry.objectiveTitle} · ${entry.pilotName}`,
          config: entry.designConfig,
          score: entry.totalScore,
          grade: entry.grade,
        });
      }
    });
    records.forEach((rec) => {
      if (rec.designConfig) {
        items.push({
          key: `rec:${rec.id}`,
          label: `My Saved Run: ${rec.objectiveTitle} (${rec.totalScore}/500)`,
          sublabel: `${rec.mode.toUpperCase()} · Grade ${rec.grade}`,
          config: rec.designConfig,
          score: rec.totalScore,
          grade: rec.grade,
        });
      }
    });
    return items;
  }, [currentConfig, leaderboard, records]);

  const designA = comparablePool.find((d) => d.key === slotAKey) ?? comparablePool[0];
  const designB =
    comparablePool.find((d) => d.key === slotBKey) ?? comparablePool[1] ?? comparablePool[0];

  const compA = useMemo(() => {
    const parts = getCatalogParts(designA.config);
    const tel = computeTelemetry(designA.config);
    return { ...designA, parts, tel };
  }, [designA]);

  const compB = useMemo(() => {
    const parts = getCatalogParts(designB.config);
    const tel = computeTelemetry(designB.config);
    return { ...designB, parts, tel };
  }, [designB]);

  const handleCopyDesign = (cfg: MissionConfig, id: string) => {
    void navigator.clipboard.writeText(encodeDesignCode(cfg));
    if (id === 'current') {
      setCopiedCurrent(true);
      setTimeout(() => setCopiedCurrent(false), 1800);
    } else {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    const decoded = decodeDesignCode(importInput);
    if (!decoded) {
      setImportError('Invalid design code. Codes start with APG1-...');
      return;
    }
    onLoadConfig(decoded, 'Imported shared spacecraft design');
    onClose();
  };

  const handleSelectForCompare = (key: string) => {
    setSlotBKey(key);
    setActiveTab('compare');
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl border border-slate-700 bg-[#080c15] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Trophy className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Mission Rankings, Archive &amp; Design Comparison
              </h2>
              <div className="text-xs font-mono-tab text-slate-400">
                Global &amp; Competitive Team Leaderboards · Save, Share &amp; Compare Designs
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium border cursor-pointer transition-colors ${
              activeTab === 'leaderboard'
                ? 'border-cyan-400 bg-cyan-950/45 text-cyan-200'
                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            Leaderboard &amp; Competitive
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium border cursor-pointer transition-colors ${
              activeTab === 'saved'
                ? 'border-cyan-400 bg-cyan-950/45 text-cyan-200'
                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            My Saved Missions ({records.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compare')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium border cursor-pointer transition-colors ${
              activeTab === 'compare'
                ? 'border-cyan-400 bg-cyan-950/45 text-cyan-200'
                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
            }`}
          >
            <GitCompare className="h-3.5 w-3.5" />
            Compare &amp; Share Designs
          </button>
        </div>

        {/* Tab 1: Leaderboard & Competitive Challenges */}
        {activeTab === 'leaderboard' && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={objectiveFilter}
                  onChange={(e) => setObjectiveFilter(e.target.value)}
                  className="border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="all">All Mission Objectives</option>
                  {OBJECTIVES.map((obj) => (
                    <option key={obj.id} value={obj.id}>
                      {obj.title}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={competitiveOnly}
                    onChange={(e) => setCompetitiveOnly(e.target.checked)}
                    className="accent-amber-400"
                  />
                  Competitive Team Challenges Only
                </label>
              </div>
              <div className="text-[11px] font-mono-tab text-slate-400">
                {filteredLeaderboard.length} Ranked Entries
              </div>
            </div>

            {!user ? (
              <div className="border border-slate-800 bg-slate-900/40 p-6 text-center space-y-3">
                <p className="text-sm text-slate-300">
                  Sign in with Google to view live mission rankings and compete with other teams on the same objective.
                </p>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="bg-cyan-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer"
                >
                  Sign in with Google
                </button>
              </div>
            ) : loading ? (
              <div className="py-10 text-center text-sm font-mono-tab text-slate-400">
                Loading rankings...
              </div>
            ) : error ? (
              <div className="border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
                {error}
              </div>
            ) : filteredLeaderboard.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No rankings posted for this filter yet. Launch a mission and click &ldquo;Post to Leaderboard&rdquo;!
              </div>
            ) : (
              <div className="aero-scroll max-h-[360px] overflow-y-auto space-y-2">
                {filteredLeaderboard.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-3 border border-slate-800 bg-slate-900/60 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center border font-mono-tab text-xs font-bold ${
                          idx === 0
                            ? 'border-amber-400 bg-amber-950/40 text-amber-300'
                            : idx === 1
                              ? 'border-slate-400 bg-slate-800 text-slate-200'
                              : idx === 2
                                ? 'border-amber-700 bg-amber-950/20 text-amber-500'
                                : 'border-slate-800 bg-slate-950 text-slate-400'
                        }`}
                      >
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                          <span className="truncate">{entry.teamName}</span>
                          <span className="text-[11px] font-mono-tab text-cyan-400">
                            · {entry.pilotName} · {entry.mode === 'team' ? 'Team' : 'Solo'}
                            {entry.challengeMode === 'competitive' ? ' · Competitive' : ''}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-mono-tab text-slate-400">
                          {entry.objectiveTitle} · ${entry.costM}M · {entry.massKg}kg ·{' '}
                          {entry.lifetimeMonths}mo · {(entry.difficulty || 'engineer').toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right font-mono-tab mr-2">
                        <div className="text-sm font-bold text-white">{entry.totalScore}/500</div>
                        <div className="text-[11px] text-cyan-300">Grade {entry.grade}</div>
                      </div>
                      {entry.designConfig && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onLoadConfig(entry.designConfig, `Loaded ${entry.teamName} design`);
                              onClose();
                            }}
                            title="Load into Hangar"
                            className="border border-cyan-500/60 bg-cyan-950/35 px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 cursor-pointer"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectForCompare(`lb:${entry.id}`)}
                            title="Compare against current spacecraft"
                            className="border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                          >
                            Compare
                          </button>
                        </>
                      )}
                      {entry.ownerUid === user.uid && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteLb(entry.id)}
                          title="Remove from Leaderboard"
                          className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: My Saved Missions */}
        {activeTab === 'saved' && (
          <div className="mt-4">
            {!user ? (
              <div className="border border-slate-800 bg-slate-900/40 p-6 text-center space-y-3">
                <p className="text-sm text-slate-300">
                  Sign in with Google to view your saved mission simulations and reload past spacecraft designs.
                </p>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="bg-cyan-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer"
                >
                  Sign in with Google
                </button>
              </div>
            ) : loading ? (
              <div className="py-10 text-center text-sm font-mono-tab text-slate-400">
                Loading mission archive...
              </div>
            ) : records.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No completed mission simulations saved yet. Launch a mission and click &ldquo;Save to Log&rdquo;!
              </div>
            ) : (
              <div className="aero-scroll max-h-[360px] overflow-y-auto space-y-2.5">
                {records.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex flex-wrap items-center justify-between gap-3 border border-slate-800 bg-slate-900/60 p-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <span className="truncate">{rec.objectiveTitle}</span>
                        <span className="font-mono-tab text-xs text-cyan-400 shrink-0">
                          [{rec.mode === 'team' ? `Team ${rec.roomId}` : 'Solo'} ·{' '}
                          {(rec.difficulty || 'engineer').toUpperCase()}]
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-mono-tab text-slate-400">
                        ${rec.costM}M · {rec.massKg}kg ·{' '}
                        {rec.powerMarginW >= 0 ? `+${rec.powerMarginW}` : rec.powerMarginW}W ·{' '}
                        {rec.lifetimeMonths} mo
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right font-mono-tab mr-2">
                        <div className="text-sm font-bold text-white">{rec.totalScore}/500</div>
                        <div className="text-xs text-cyan-300">Grade {rec.grade}</div>
                      </div>
                      {rec.designConfig && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onLoadConfig(rec.designConfig!, `Loaded ${rec.objectiveTitle}`);
                              onClose();
                            }}
                            className="border border-cyan-500/60 bg-cyan-950/35 px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 cursor-pointer"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyDesign(rec.designConfig!, rec.id)}
                            title="Copy Share Code"
                            className="border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                          >
                            {copiedId === rec.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Share2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectForCompare(`rec:${rec.id}`)}
                            className="border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                          >
                            Compare
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDeleteRecord(rec.id)}
                        title="Delete Mission Record"
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Compare & Share Designs */}
        {activeTab === 'compare' && (
          <div className="mt-4 space-y-4 aero-scroll max-h-[66vh] overflow-y-auto pr-1">
            {/* Share Current & Import Design Code */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-slate-800 bg-slate-900/50 p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-mono-tab uppercase text-cyan-400">
                  <Share2 className="h-3.5 w-3.5" />
                  Share Current Spacecraft Design
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={encodeDesignCode(currentConfig)}
                    className="flex-1 border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono-tab text-[11px] text-slate-300 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyDesign(currentConfig, 'current')}
                    className="flex items-center gap-1.5 bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer shrink-0"
                  >
                    {copiedCurrent ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedCurrent ? 'Copied' : 'Copy Code'}
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleImportSubmit}
                className="border border-slate-800 bg-slate-900/50 p-3.5 space-y-2"
              >
                <div className="flex items-center gap-1.5 text-xs font-mono-tab uppercase text-emerald-400">
                  <Upload className="h-3.5 w-3.5" />
                  Import Shared Design Code
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={importInput}
                    onChange={(e) => setImportInput(e.target.value)}
                    placeholder="Paste APG1-... code here"
                    className="flex-1 border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono-tab text-[11px] text-white focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!importInput.trim()}
                    className="flex items-center gap-1 border border-emerald-500/60 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Load
                  </button>
                </div>
                {importError && <div className="text-[11px] text-rose-400">{importError}</div>}
              </form>
            </div>

            {/* Side-by-Side Comparison Matrix */}
            <div className="border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="text-xs font-mono-tab uppercase tracking-wider text-slate-300">
                  Side-by-Side Architecture Comparison
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] font-mono-tab uppercase text-cyan-400 mb-1">
                    Design A
                  </label>
                  <select
                    value={designA.key}
                    onChange={(e) => setSlotAKey(e.target.value)}
                    className="w-full border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {comparablePool.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono-tab uppercase text-amber-300 mb-1">
                    Design B
                  </label>
                  <select
                    value={designB.key}
                    onChange={(e) => setSlotBKey(e.target.value)}
                    className="w-full border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {comparablePool.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 font-mono-tab text-[11px] text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Metric / Subsystem</th>
                      <th className="px-3 py-2 text-cyan-300">{compA.label}</th>
                      <th className="px-3 py-2 text-amber-300">{compB.label}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-900/40 font-mono-tab text-[11px]">
                    <tr>
                      <td className="px-3 py-2 text-slate-400">Objective</td>
                      <td className="px-3 py-2 text-white">{compA.parts.objective.title}</td>
                      <td className="px-3 py-2 text-white">{compB.parts.objective.title}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-400">Orbit &amp; Rocket</td>
                      <td className="px-3 py-2 text-slate-200">
                        {compA.parts.orbit.name.split('(')[0].trim()} · {compA.parts.launchVehicle.name}
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {compB.parts.orbit.name.split('(')[0].trim()} · {compB.parts.launchVehicle.name}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-400">Bus &amp; Propulsion</td>
                      <td className="px-3 py-2 text-slate-200">
                        {compA.parts.bus.name} · {compA.parts.propulsion.name}
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {compB.parts.bus.name} · {compB.parts.propulsion.name}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-400">Power &amp; Comms</td>
                      <td className="px-3 py-2 text-slate-200">
                        {compA.parts.power.name} · {compA.parts.comms.name}
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {compB.parts.power.name} · {compB.parts.comms.name}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-400">Cost vs. Cap</td>
                      <td className="px-3 py-2 text-white">
                        ${compA.tel.totalCostM}M / ${compA.tel.budgetCapM}M ({compA.tel.budgetStatus})
                      </td>
                      <td className="px-3 py-2 text-white">
                        ${compB.tel.totalCostM}M / ${compB.tel.budgetCapM}M ({compB.tel.budgetStatus})
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-400">Wet Mass vs. Cap</td>
                      <td className="px-3 py-2 text-white">
                        {compA.tel.wetMassKg} / {compA.tel.payloadCapacityKg} kg ({compA.tel.massStatus})
                      </td>
                      <td className="px-3 py-2 text-white">
                        {compB.tel.wetMassKg} / {compB.tel.payloadCapacityKg} kg ({compB.tel.massStatus})
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-400">Power Margin</td>
                      <td className="px-3 py-2 text-white">
                        {compA.tel.powerMarginW >= 0 ? `+${compA.tel.powerMarginW}` : compA.tel.powerMarginW} W
                      </td>
                      <td className="px-3 py-2 text-white">
                        {compB.tel.powerMarginW >= 0 ? `+${compB.tel.powerMarginW}` : compB.tel.powerMarginW} W
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-400">Downlink vs. Data</td>
                      <td className="px-3 py-2 text-white">
                        {compA.tel.downlinkCapacityGBDay} / {compA.tel.dataGeneratedGBDay} GB/d
                      </td>
                      <td className="px-3 py-2 text-white">
                        {compB.tel.downlinkCapacityGBDay} / {compB.tel.dataGeneratedGBDay} GB/d
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-400">Science &amp; Lifetime</td>
                      <td className="px-3 py-2 text-emerald-300">
                        {compA.tel.scienceReturnPotential} Sci · {compA.tel.estimatedLifetimeMonths} mo
                      </td>
                      <td className="px-3 py-2 text-emerald-300">
                        {compB.tel.scienceReturnPotential} Sci · {compB.tel.estimatedLifetimeMonths} mo
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
