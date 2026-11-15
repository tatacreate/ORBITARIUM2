export type AstronautMood = 'nominal' | 'excited' | 'warning' | 'alert';

export type HairStyle = 'spiky' | 'bob' | 'curly' | 'buzz' | 'buns' | 'none';
export type SuitColorId = 'white' | 'cobalt' | 'amber' | 'teal' | 'mars' | 'slate';
export type VisorTintId = 'clear' | 'gold' | 'cyan' | 'rose';
export type FaceAccessoryId = 'none' | 'glasses' | 'freckles' | 'star-cheek' | 'headset';
export type ChestPatchId = 'star' | 'maple' | 'orbit' | 'rocket';

export interface AstronautAppearance {
  skinTone: string;
  hairStyle: HairStyle;
  hairColor: string;
  suitColor: SuitColorId;
  visorTint: VisorTintId;
  accessory: FaceAccessoryId;
  patch: ChestPatchId;
}

export const DEFAULT_ASTRONAUT_APPEARANCE: AstronautAppearance = {
  skinTone: '#f3c6a5',
  hairStyle: 'spiky',
  hairColor: '#4a2c1d',
  suitColor: 'white',
  visorTint: 'cyan',
  accessory: 'headset',
  patch: 'orbit',
};

export const SKIN_TONES = [
  { id: 'peach', label: 'Fair', hex: '#f8d5c2' },
  { id: 'warm', label: 'Warm', hex: '#f3c6a5' },
  { id: 'olive', label: 'Tan', hex: '#d99e73' },
  { id: 'caramel', label: 'Bronze', hex: '#b67852' },
  { id: 'umber', label: 'Chestnut', hex: '#854e32' },
  { id: 'espresso', label: 'Deep', hex: '#543120' },
];

export const HAIR_COLORS = [
  { id: 'brown', label: 'Espresso', hex: '#4a2c1d' },
  { id: 'black', label: 'Obsidian', hex: '#1e2430' },
  { id: 'ginger', label: 'Mars Red', hex: '#c85528' },
  { id: 'blonde', label: 'Solar Gold', hex: '#e5b94c' },
  { id: 'silver', label: 'Lunar Silver', hex: '#cbd5e1' },
  { id: 'teal', label: 'Nebula Teal', hex: '#14b8a6' },
];

export const SUIT_PALETTES: Record<
  SuitColorId,
  { label: string; shell: string; shade: string; trim: string; accent: string }
> = {
  white: {
    label: 'NASA EVA White',
    shell: '#f1f5f9',
    shade: '#cbd5e1',
    trim: '#06b6d4',
    accent: '#ef4444',
  },
  cobalt: {
    label: 'CSA Cobalt',
    shell: '#2563eb',
    shade: '#1d4ed8',
    trim: '#f8fafc',
    accent: '#ef4444',
  },
  amber: {
    label: 'Artemis Pumpkin',
    shell: '#f97316',
    shade: '#c2410c',
    trim: '#fef3c7',
    accent: '#0f172a',
  },
  teal: {
    label: 'Orbitarium Teal',
    shell: '#0d9488',
    shade: '#115e59',
    trim: '#67e8f9',
    accent: '#fbbf24',
  },
  mars: {
    label: 'Mars Crimson',
    shell: '#dc2626',
    shade: '#991b1b',
    trim: '#fde68a',
    accent: '#f8fafc',
  },
  slate: {
    label: 'Night Stealth',
    shell: '#334155',
    shade: '#1e293b',
    trim: '#22d3ee',
    accent: '#f59e0b',
  },
};

export const VISOR_TINTS: Record<VisorTintId, { label: string; fill: string; opacity: number }> = {
  clear: { label: 'Clear Glass', fill: '#e0f2fe', opacity: 0.1 },
  cyan: { label: 'HUD Cyan', fill: '#22d3ee', opacity: 0.18 },
  gold: { label: 'Gold EVA', fill: '#fbbf24', opacity: 0.24 },
  rose: { label: 'Sunset Rose', fill: '#fb7185', opacity: 0.18 },
};

interface CartoonAstronautFaceProps {
  appearance: AstronautAppearance;
  mood?: AstronautMood;
  size?: number;
  className?: string;
}

export function CartoonAstronautFace({
  appearance,
  mood = 'nominal',
  size = 54,
  className = '',
}: CartoonAstronautFaceProps) {
  const suit = SUIT_PALETTES[appearance.suitColor] || SUIT_PALETTES.white;
  const visor = VISOR_TINTS[appearance.visorTint] || VISOR_TINTS.cyan;

  const moodRing =
    mood === 'alert'
      ? '#fb7185'
      : mood === 'warning'
        ? '#fbbf24'
        : mood === 'excited'
          ? '#34d399'
          : '#22d3ee';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Left Helmet Antenna */}
      <line x1="16" y1="42" x2="16" y2="18" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="15" r="4.5" fill={moodRing} stroke="#0f172a" strokeWidth="2" />

      {/* Helmet Ear Comms Pods */}
      <rect x="9" y="40" width="11" height="22" rx="5" fill={suit.shade} stroke="#0f172a" strokeWidth="2.5" />
      <rect x="80" y="40" width="11" height="22" rx="5" fill={suit.shade} stroke="#0f172a" strokeWidth="2.5" />
      <circle cx="14.5" cy="51" r="2.2" fill={suit.trim} />
      <circle cx="85.5" cy="51" r="2.2" fill={suit.trim} />

      {/* Upper Spacesuit Shoulders */}
      <path
        d="M20 96 C20 79, 32 74, 50 74 C68 74, 80 79, 80 96 Z"
        fill={suit.shell}
        stroke="#0f172a"
        strokeWidth="2.8"
      />
      {/* Shoulder Trim Stripes */}
      <path d="M26 83 L33 95" stroke={suit.trim} strokeWidth="3" strokeLinecap="round" />
      <path d="M74 83 L67 95" stroke={suit.trim} strokeWidth="3" strokeLinecap="round" />

      {/* Chest Mission Patch */}
      <g transform="translate(50, 86)">
        <circle cx="0" cy="0" r="6.5" fill="#0f172a" stroke={suit.trim} strokeWidth="1.5" />
        {appearance.patch === 'star' && (
          <path
            d="M0 -4 L1.2 -1.2 L4.2 -1 L1.9 1 L2.6 4 L0 2.3 L-2.6 4 L-1.9 1 L-4.2 -1 L-1.2 -1.2 Z"
            fill="#fbbf24"
          />
        )}
        {appearance.patch === 'maple' && (
          <path
            d="M0 -4.2 L1.2 -1.6 L3.8 -2 L2.3 0.5 L3.6 1.8 L0.8 1.8 L0.5 4 L-0.5 4 L-0.8 1.8 L-3.6 1.8 L-2.3 0.5 L-3.8 -2 L-1.2 -1.6 Z"
            fill="#ef4444"
          />
        )}
        {appearance.patch === 'orbit' && (
          <>
            <ellipse cx="0" cy="0" rx="4.5" ry="2" transform="rotate(-25)" stroke="#22d3ee" strokeWidth="1.2" />
            <circle cx="0" cy="0" r="1.7" fill="#fbbf24" />
          </>
        )}
        {appearance.patch === 'rocket' && (
          <path d="M0 -4 C2 -2 2 1 1 3 L-1 3 C-2 1 -2 -2 0 -4 Z" fill="#34d399" />
        )}
      </g>

      {/* Outer Rounded Helmet Dome */}
      <circle cx="50" cy="46" r="34" fill={suit.shell} stroke="#0f172a" strokeWidth="3" />
      {/* Helmet Collar Ring */}
      <rect x="27" y="72" width="46" height="8.5" rx="4" fill={suit.shade} stroke="#0f172a" strokeWidth="2.5" />
      <circle cx="34" cy="76.2" r="1.7" fill={suit.trim} />
      <circle cx="66" cy="76.2" r="1.7" fill={suit.trim} />

      {/* Visor Opening Frame */}
      <rect x="22" y="21" width="56" height="47" rx="22" fill="#0b1324" stroke={suit.trim} strokeWidth="2.4" />

      {/* Clip Face Inside Visor Window */}
      <defs>
        <clipPath id="astronaut-visor-clip">
          <rect x="23.5" y="22.5" width="53" height="44" rx="20.5" />
        </clipPath>
      </defs>

      <g clipPath="url(#astronaut-visor-clip)">
        {/* Subtle Helmet Interior Glow */}
        <circle cx="50" cy="45" r="28" fill="#172036" />

        {/* Back Hair Layer (for bob / buns / curly) */}
        {appearance.hairStyle === 'bob' && (
          <path d="M27 39 C27 23, 73 23, 73 39 L74 56 L66 56 L66 42 L34 42 L34 56 L26 56 Z" fill={appearance.hairColor} />
        )}
        {appearance.hairStyle === 'buns' && (
          <>
            <circle cx="31" cy="27" r="7.5" fill={appearance.hairColor} />
            <circle cx="69" cy="27" r="7.5" fill={appearance.hairColor} />
          </>
        )}

        {/* Cartoon Ears */}
        <circle cx="30" cy="48" r="4.5" fill={appearance.skinTone} />
        <circle cx="70" cy="48" r="4.5" fill={appearance.skinTone} />

        {/* Neck */}
        <rect x="44" y="60" width="12" height="10" rx="4" fill={appearance.skinTone} />

        {/* Cartoon Head */}
        <rect x="31" y="28" width="38" height="36" rx="18" fill={appearance.skinTone} />

        {/* Cheek Blush */}
        <ellipse cx="38" cy="52" rx="4" ry="2.2" fill="#fb7185" opacity="0.32" />
        <ellipse cx="62" cy="52" rx="4" ry="2.2" fill="#fb7185" opacity="0.32" />

        {/* Front Hair Styles */}
        {appearance.hairStyle === 'spiky' && (
          <path
            d="M30 40 C30 25, 70 25, 70 40 C66 34, 62 32, 58 36 L55 28 L50 35 L45 27 L41 35 C37 32, 33 34, 30 40 Z"
            fill={appearance.hairColor}
          />
        )}
        {appearance.hairStyle === 'bob' && (
          <path
            d="M30 39 C31 24, 69 24, 70 39 C64 33, 56 32, 50 35 C44 32, 36 33, 30 39 Z"
            fill={appearance.hairColor}
          />
        )}
        {appearance.hairStyle === 'curly' && (
          <g fill={appearance.hairColor}>
            <circle cx="34" cy="33" r="6" />
            <circle cx="42" cy="29" r="6.5" />
            <circle cx="51" cy="28" r="7" />
            <circle cx="60" cy="29" r="6.5" />
            <circle cx="67" cy="34" r="5.5" />
          </g>
        )}
        {appearance.hairStyle === 'buzz' && (
          <path d="M32 37 C34 25, 66 25, 68 37 C60 33, 40 33, 32 37 Z" fill={appearance.hairColor} />
        )}
        {appearance.hairStyle === 'buns' && (
          <path
            d="M31 38 C32 25, 68 25, 69 38 C61 33, 54 34, 50 37 C46 34, 39 33, 31 38 Z"
            fill={appearance.hairColor}
          />
        )}

        {/* Eyebrows based on Mood */}
        {mood === 'alert' ? (
          <>
            <path d="M36 42 L44 40" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M64 42 L56 40" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" />
          </>
        ) : mood === 'warning' ? (
          <>
            <path d="M36 40 Q40 38 44 40.5" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M56 41.5 L64 39.5" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M36 40.5 Q40 38.2 44 40.5" stroke="#1e293b" strokeWidth="2.1" strokeLinecap="round" />
            <path d="M56 40.5 Q60 38.2 64 40.5" stroke="#1e293b" strokeWidth="2.1" strokeLinecap="round" />
          </>
        )}

        {/* Cartoon Eyes */}
        {mood === 'excited' ? (
          <>
            <circle cx="40.5" cy="46.5" r="4.2" fill="#0f172a" />
            <circle cx="59.5" cy="46.5" r="4.2" fill="#0f172a" />
            <circle cx="39" cy="45" r="1.5" fill="#ffffff" />
            <circle cx="58" cy="45" r="1.5" fill="#ffffff" />
            <circle cx="42" cy="48" r="0.8" fill="#ffffff" />
            <circle cx="61" cy="48" r="0.8" fill="#ffffff" />
          </>
        ) : mood === 'alert' ? (
          <>
            <circle cx="40.5" cy="46.5" r="4.6" fill="#ffffff" stroke="#0f172a" strokeWidth="1.2" />
            <circle cx="59.5" cy="46.5" r="4.6" fill="#ffffff" stroke="#0f172a" strokeWidth="1.2" />
            <circle cx="40.5" cy="46.5" r="2.2" fill="#0f172a" />
            <circle cx="59.5" cy="46.5" r="2.2" fill="#0f172a" />
            <circle cx="39.7" cy="45.5" r="0.9" fill="#ffffff" />
            <circle cx="58.7" cy="45.5" r="0.9" fill="#ffffff" />
          </>
        ) : (
          <>
            <circle cx="40.5" cy="46.5" r="3.6" fill="#0f172a" />
            <circle cx="59.5" cy="46.5" r="3.6" fill="#0f172a" />
            <circle cx="39.3" cy="45.2" r="1.3" fill="#ffffff" />
            <circle cx="58.3" cy="45.2" r="1.3" fill="#ffffff" />
          </>
        )}

        {/* Cute Button Nose */}
        <path d="M49 49.5 Q50 51.5 51.2 49.5" stroke="#854e32" strokeWidth="1.6" strokeLinecap="round" opacity="0.65" />

        {/* Cartoon Mouth based on Mood */}
        {mood === 'excited' && (
          <path d="M43 54.5 Q50 61.5 57 54.5 Z" fill="#991b1b" stroke="#0f172a" strokeWidth="1.5" strokeLinejoin="round" />
        )}
        {mood === 'nominal' && (
          <path d="M44 55 Q50 59.5 56 55" stroke="#0f172a" strokeWidth="2.1" strokeLinecap="round" />
        )}
        {mood === 'warning' && (
          <path d="M45 56 Q50 55 55 56.5" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
        )}
        {mood === 'alert' && (
          <ellipse cx="50" cy="56.5" rx="3.4" ry="2.8" fill="#991b1b" stroke="#0f172a" strokeWidth="1.5" />
        )}

        {/* Face Accessories */}
        {appearance.accessory === 'freckles' && (
          <g fill="#9a5b3c" opacity="0.65">
            <circle cx="36" cy="51.5" r="0.8" />
            <circle cx="38.5" cy="53" r="0.8" />
            <circle cx="40.5" cy="51.2" r="0.8" />
            <circle cx="64" cy="51.5" r="0.8" />
            <circle cx="61.5" cy="53" r="0.8" />
            <circle cx="59.5" cy="51.2" r="0.8" />
          </g>
        )}

        {appearance.accessory === 'star-cheek' && (
          <path
            d="M62 50 L62.9 51.8 L64.8 52 L63.3 53.3 L63.7 55.2 L62 54.2 L60.3 55.2 L60.7 53.3 L59.2 52 L61.1 51.8 Z"
            fill="#fbbf24"
            stroke="#0f172a"
            strokeWidth="0.6"
          />
        )}

        {appearance.accessory === 'glasses' && (
          <g stroke="#0f172a" strokeWidth="1.8">
            <rect x="34.5" y="42" width="12" height="9" rx="3" fill="#ffffff" fillOpacity="0.16" />
            <rect x="53.5" y="42" width="12" height="9" rx="3" fill="#ffffff" fillOpacity="0.16" />
            <line x1="46.5" y1="46" x2="53.5" y2="46" />
          </g>
        )}

        {appearance.accessory === 'headset' && (
          <g>
            <path d="M26 52 Q31 58 43 57" stroke="#334155" strokeWidth="2" strokeLinecap="round" fill="none" />
            <circle cx="44" cy="57" r="2" fill="#0f172a" stroke={moodRing} strokeWidth="1" />
          </g>
        )}

        {/* Visor Tint + Cartoon Glass Shine */}
        <rect x="22" y="21" width="56" height="47" rx="22" fill={visor.fill} opacity={visor.opacity} />
        <path
          d="M28 31 C33 25, 42 24, 48 25"
          stroke="#ffffff"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.45"
        />
        <circle cx="31" cy="36" r="1.4" fill="#ffffff" opacity="0.45" />
      </g>
    </svg>
  );
}
