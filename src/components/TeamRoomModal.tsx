import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { LogIn, Plus, Trophy, Users, X } from 'lucide-react';
import { OBJECTIVES } from '../data/catalog';
import { fetchUserHostedRooms } from '../services/missionService';
import type { MissionChallengeMode, RoomState } from '../types/mission';

interface TeamRoomModalProps {
  user: User | null;
  defaultObjectiveId: string;
  onClose: () => void;
  onSignIn: () => Promise<void>;
  onCreateRoom: (
    title: string,
    challengeMode: MissionChallengeMode,
    objectiveId: string,
  ) => Promise<void>;
  onJoinRoom: (code: string) => Promise<void>;
}

export function TeamRoomModal({
  user,
  defaultObjectiveId,
  onClose,
  onSignIn,
  onCreateRoom,
  onJoinRoom,
}: TeamRoomModalProps) {
  const [roomTitle, setRoomTitle] = useState('Artemis Cryo Recon');
  const [challengeMode, setChallengeMode] = useState<MissionChallengeMode>('cooperative');
  const [objectiveId, setObjectiveId] = useState(defaultObjectiveId);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hostedRooms, setHostedRooms] = useState<RoomState[]>([]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchUserHostedRooms(user.uid)
      .then((rooms) => {
        if (active) setHostedRooms(rooms.filter((r) => r.status === 'designing'));
      })
      .catch(() => {
        // Ignore if index is still initializing
      });
    return () => {
      active = false;
    };
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onCreateRoom(roomTitle || 'Orbital Mission Room', challengeMode, objectiveId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create room.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (code: string) => {
    setError(null);
    setBusy(true);
    try {
      await onJoinRoom(code);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join room.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-lg border border-slate-700 bg-[#080c15] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-cyan-400" />
            <h2 className="font-display text-xl font-bold text-white">
              Team Mission Room (1–4 Players)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!user ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm leading-relaxed text-slate-300">
              Sign in with Google to host or join a real-time 4-engineer Mission Control room or enter Competitive Team Challenges on the public leaderboard.
            </p>
            <button
              type="button"
              onClick={() => void onSignIn()}
              className="flex w-full items-center justify-center gap-2 bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
            >
              <LogIn className="h-4 w-4" />
              Sign in with Google
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {error && (
              <div className="border border-rose-500/50 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-200">
                {error}
              </div>
            )}

            {/* Create New Room */}
            <form onSubmit={handleCreate} className="space-y-3 border border-slate-800 bg-slate-900/50 p-4">
              <div className="text-xs font-mono-tab uppercase tracking-wider text-slate-400">
                Host New Team Room
              </div>

              {/* Cooperative vs Competitive Scenario Mode */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChallengeMode('cooperative')}
                  className={`flex items-center justify-center gap-1.5 border px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                    challengeMode === 'cooperative'
                      ? 'border-cyan-400 bg-cyan-950/45 text-cyan-200'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Cooperative Team
                </button>
                <button
                  type="button"
                  onClick={() => setChallengeMode('competitive')}
                  className={`flex items-center justify-center gap-1.5 border px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                    challengeMode === 'competitive'
                      ? 'border-amber-400 bg-amber-950/45 text-amber-200'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  <Trophy className="h-3.5 w-3.5" />
                  Competitive Challenge
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                {challengeMode === 'competitive'
                  ? 'Rival teams build spacecraft for the exact same mission objective and post scores to compete for Rank #1 on the leaderboard.'
                  : 'Up to 4 teammates coordinate subsystems together in real time to complete any mission.'}
              </p>

              {challengeMode === 'competitive' && (
                <div>
                  <label className="block text-[11px] font-mono-tab uppercase text-slate-400 mb-1">
                    Shared Challenge Objective
                  </label>
                  <select
                    value={objectiveId}
                    onChange={(e) => setObjectiveId(e.target.value)}
                    className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {OBJECTIVES.map((obj) => (
                      <option key={obj.id} value={obj.id}>
                        {obj.title} ({obj.targetBody.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={60}
                  value={roomTitle}
                  onChange={(e) => setRoomTitle(e.target.value)}
                  placeholder="Team Callsign..."
                  className="flex-1 border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="flex items-center gap-1.5 bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  Create Room
                </button>
              </div>
            </form>

            {/* Join Existing Room */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (joinCode.trim()) void handleJoin(joinCode.trim());
              }}
              className="space-y-3 border border-slate-800 bg-slate-900/50 p-4"
            >
              <div className="text-xs font-mono-tab uppercase tracking-wider text-slate-400">
                Join Existing Room by Code
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={16}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. APG-492X"
                  className="flex-1 border border-slate-700 bg-slate-950 px-3 py-2 font-mono-tab text-sm uppercase text-white focus:border-cyan-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy || !joinCode.trim()}
                  className="border border-cyan-500/60 bg-cyan-950/40 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  Join Room
                </button>
              </div>
            </form>

            {/* Active Hosted Rooms */}
            {hostedRooms.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-mono-tab uppercase tracking-wider text-slate-400">
                  Resume Your Active Rooms
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto aero-scroll">
                  {hostedRooms.map((r) => (
                    <button
                      key={r.roomId}
                      type="button"
                      disabled={busy}
                      onClick={() => void handleJoin(r.roomId)}
                      className="flex w-full items-center justify-between border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs hover:border-cyan-400 transition-colors cursor-pointer"
                    >
                      <span className="font-medium text-white truncate">
                        {r.title}
                        {r.challengeMode === 'competitive' ? ' (Competitive)' : ''}
                      </span>
                      <span className="font-mono-tab text-cyan-300 shrink-0">
                        {r.roomId} · {r.memberCount}/4
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
