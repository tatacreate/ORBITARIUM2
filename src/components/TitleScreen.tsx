import type { User } from 'firebase/auth';
import { BookOpen, ExternalLink, Gamepad2, History, LogIn, LogOut, Rocket, Users } from 'lucide-react';
import { DIFFICULTY_MODES } from '../data/catalog';
import { OFFICIAL_REFERENCES } from '../data/references';
import type { DifficultyLevel } from '../types/mission';

interface TitleScreenProps {
  user: User | null;
  authLoading: boolean;
  difficulty: DifficultyLevel;
  onSelectDifficulty: (d: DifficultyLevel) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onStartFlightSim: () => void;
  onStartSolo: () => void;
  onOpenTeamModal: () => void;
  onOpenArchive: () => void;
  onOpenGuide: () => void;
}

export function TitleScreen({
  user,
  authLoading,
  difficulty,
  onSelectDifficulty,
  onSignIn,
  onSignOut,
  onStartFlightSim,
  onStartSolo,
  onOpenTeamModal,
  onOpenArchive,
  onOpenGuide,
}: TitleScreenProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 md:p-10">
      {/* Top Minimal Account Row */}
      <div className="flex items-center justify-between gap-4">
        <div className="pointer-events-auto flex items-center gap-3 text-xs font-mono-tab text-slate-400">
          <span>ORBITAL SYSTEMS ARCHITECT</span>
          <span aria-hidden="true">·</span>
          <span>1–4 PARTICIPANTS</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={onOpenGuide}
            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Field Guide
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3 border border-slate-700/80 bg-[#090d16]/95 px-3.5 py-2 text-xs">
              <span className="font-medium text-slate-200 whitespace-nowrap">
                {user.displayName || user.email}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <button
                type="button"
                onClick={onOpenArchive}
                className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap cursor-pointer"
              >
                <History className="h-3.5 w-3.5" />
                Log &amp; Rankings
              </button>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenArchive}
                className="flex items-center gap-1.5 border border-slate-700 bg-[#090d16]/95 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap cursor-pointer"
              >
                <History className="h-3.5 w-3.5" />
                Rankings &amp; Compare
              </button>
              <button
                type="button"
                disabled={authLoading}
                onClick={onSignIn}
                className="flex items-center gap-2 border border-cyan-500/50 bg-[#090d16]/95 px-4 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-950/60 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <LogIn className="h-3.5 w-3.5" />
                {authLoading ? 'Connecting...' : 'Sign in with Google'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Left-Third Hero Lockup over Calm Negative Space */}
      <div className="pointer-events-auto max-w-lg border border-slate-800/90 bg-[#070a12]/92 p-7 md:p-8">
        <div className="flex items-center gap-3.5">
          <svg
            width="38"
            height="38"
            viewBox="0 0 40 40"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle cx="20" cy="20" r="17" stroke="#1e293b" strokeWidth="1.5" />
            <ellipse
              cx="20"
              cy="20"
              rx="16"
              ry="6.5"
              transform="rotate(-28 20 20)"
              stroke="#06b6d4"
              strokeWidth="1.5"
            />
            <circle cx="20" cy="20" r="4.5" fill="#f59e0b" />
            <circle cx="32" cy="13.5" r="2.5" fill="#22d3ee" />
          </svg>
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-white">
              ORBITARIUM
            </h1>
          </div>
        </div>

        <div className="mt-3 text-[11px] font-mono-tab uppercase tracking-wider text-cyan-300">
          Space Mission Design Challenge · Systems Engineering · 1–4 Players
        </div>

        <p className="mt-2.5 text-sm md:text-base leading-relaxed text-slate-300">
          Steer a rocket to orbit, maneuver around Earth, the Moon, or Mars, scan targets or operate the CSA Canadarm, dodge orbital debris &amp; solar waves, and transmit data during ground-station pass windows—or engineer spacecraft trade-offs in 3D with a 1–4 player crew.
        </p>

        {/* Difficulty Selector */}
        <div className="mt-4">
          <div className="text-[11px] font-mono-tab uppercase tracking-wider text-slate-400 mb-2">
            Mission Mode &amp; Difficulty
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {(['cadet', 'engineer', 'director', 'sandbox'] as DifficultyLevel[]).map((level) => {
              const active = difficulty === level || (level === 'cadet' && difficulty === 'junior');
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => onSelectDifficulty(level)}
                  className={`px-2 py-2 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'border-cyan-400 bg-cyan-950/45 text-cyan-200'
                      : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-white'
                  }`}
                >
                  {DIFFICULTY_MODES[level].shortLabel}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            {DIFFICULTY_MODES[difficulty].tagline}
          </p>
        </div>

        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={onStartFlightSim}
            className="flex w-full items-center justify-center gap-2 bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap cursor-pointer shadow-lg"
          >
            <Gamepad2 className="h-4 w-4" />
            Fly Interactive Mission (Launch → Space → Ground)
          </button>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onStartSolo}
              className="flex flex-1 items-center justify-center gap-2 bg-cyan-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Rocket className="h-4 w-4" />
              3D Systems Designer
            </button>
            <button
              type="button"
              onClick={onOpenTeamModal}
              className="flex flex-1 items-center justify-center gap-2 border border-slate-600 bg-slate-900/90 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-100 hover:border-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Users className="h-4 w-4" />
              Team Room (1–4)
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono-tab text-slate-400">
            <span>NASA 4-Segment Loop</span>
            <span aria-hidden="true">·</span>
            <span>GMAT Trajectories &amp; CSA Canadarm</span>
            <span aria-hidden="true">·</span>
            <span>3D Trade-Off Lab</span>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-mono-tab uppercase tracking-wider text-slate-500">
              Grounded in Official NASA &amp; CSA Resources
            </div>
            <div className="flex flex-wrap gap-1.5">
              {OFFICIAL_REFERENCES.map((ref) => (
                <a
                  key={ref.id}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={ref.subtitle}
                  className="inline-flex items-center gap-1 border border-slate-700/90 bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-cyan-300 hover:border-cyan-400 hover:text-white transition-colors whitespace-nowrap"
                >
                  <span>{ref.agency}:</span>
                  <span>{ref.id === 'nasa-se-guide' ? 'Mission Design PDF' : ref.id === 'nasa-gmat' ? 'GMAT Software' : 'Digital Games'}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Single Flat Control Hint Line */}
      <div className="flex items-center justify-between text-xs font-mono-tab text-slate-400">
        <span>Drag to Orbit · Scroll to Zoom · Click 3D Subsystem to Inspect · H Toggle Controls</span>
        <span className="hidden sm:inline">Press Enter to Start</span>
      </div>
    </div>
  );
}
