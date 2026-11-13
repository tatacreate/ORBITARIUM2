/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BookOpen, Sparkles, X } from 'lucide-react';

interface MissionDictionaryModalProps {
  onClose: () => void;
}

const DICTIONARY_TERMS: { term: string; category: string; definition: string }[] = [
  {
    term: 'Orbital Altitude',
    category: 'Orbits',
    definition:
      'How high above a planet or moon your spacecraft flies—lower orbits give sharper photos but need extra fuel and face longer shadow eclipses.',
  },
  {
    term: 'Payload Capacity',
    category: 'Rockets',
    definition:
      'The maximum total weight (spacecraft + fuel) a rocket can safely push all the way to your chosen destination.',
  },
  {
    term: 'Power Consumption',
    category: 'Energy',
    definition:
      'How much electricity your computers, heaters, antennas, and cameras use each second to stay awake and working.',
  },
  {
    term: 'Data Rate',
    category: 'Science',
    definition:
      'How many gigabytes of pictures, radar maps, and science measurements your instruments record every single day.',
  },
  {
    term: 'Communications',
    category: 'Signals',
    definition:
      'The radio dish or laser beam that sends your spacecraft’s discoveries back to Earth across millions of miles of space.',
  },
  {
    term: 'Telemetry',
    category: 'Control',
    definition:
      'The live health signals and dashboard numbers beamed down from space so mission control knows how the spacecraft is doing.',
  },
  {
    term: 'Orbital Mechanics',
    category: 'Physics',
    definition:
      'The invisible rules of gravity and speed that keep a spacecraft circling smoothly around a planet or moon instead of flying away.',
  },
  {
    term: 'Avionics',
    category: 'Hardware',
    definition:
      'The onboard computer brain that steers the spacecraft, runs science tools, and saves data in memory until it is sent home.',
  },
  {
    term: 'Propulsion',
    category: 'Engines',
    definition:
      'The rocket engines and fuel tanks that push the spacecraft into its target orbit and adjust its path in space.',
  },
  {
    term: 'Delta-v (Δv)',
    category: 'Physics',
    definition:
      'The total change in speed your fuel tank can provide—higher orbits and distant planets require a bigger speed budget.',
  },
  {
    term: 'Attitude Control (ADCS)',
    category: 'Guidance',
    definition:
      'Spinning reaction wheels and star-tracking cameras that keep the spacecraft pointed steadily at Earth or its science target.',
  },
  {
    term: 'Mission Lifetime',
    category: 'Time',
    definition:
      'How many months the spacecraft can keep working before harsh space radiation wears out electronics or steering fuel runs dry.',
  },
];

export function MissionDictionaryModal({ onClose }: MissionDictionaryModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="w-full max-w-3xl border border-slate-700 bg-[#080c15] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">Mission Dictionary</h2>
              <div className="text-xs font-mono-tab text-slate-400">
                Plain-Language Space Engineering Glossary · 1-Sentence Explanations
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Mission Dictionary"
            className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="aero-scroll mt-4 max-h-[70vh] overflow-y-auto space-y-3 pr-1">
          <div className="text-xs text-slate-300 bg-slate-900/70 border border-slate-800 p-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              New to rocket design? Every core space concept below is explained in one simple sentence—no advanced physics background required.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DICTIONARY_TERMS.map((item) => (
              <div
                key={item.term}
                className="border border-slate-800 bg-slate-900/55 p-3.5 hover:border-cyan-500/40 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{item.term}</span>
                  <span className="text-[11px] font-mono-tab text-cyan-400">{item.category}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{item.definition}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="bg-cyan-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
          >
            Back to Spacecraft Hangar
          </button>
        </div>
      </div>
    </div>
  );
}
