// Small line icons drawn as SVG, so the UI looks the same on every device.
const PATHS = {
  // Points right: "back" in a right-to-left app.
  back: 'M9 5l7 7-7 7',
  next: 'M15 5l-7 7 7 7',
  speaker: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z M15.5 9a4 4 0 0 1 0 6 M18 6.5a7.5 7.5 0 0 1 0 11',
  play: 'M8 5.5v13l10-6.5z',
  home: 'M4 11l8-6.5 8 6.5 M6.5 9.5V19h11V9.5',
  replay: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3 M4.5 4.5v4h4',
  mic: 'M12 4a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-5 0v-5A2.5 2.5 0 0 1 12 4z M6.5 11a5.5 5.5 0 0 0 11 0 M12 16.5V20',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3 M5.5 11h13v9h-13z',
  book: 'M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z M12 6.5v13',
  medal: 'M8 3.5l2.5 5.5 M16 3.5L13.5 9 M12 9.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10z M12 12.5v4',
  gift: 'M4.5 10h15v3.5h-15z M6 13.5V20h12v-6.5 M12 10v10 M12 10C10 6 6.5 6 7 8.5S12 10 12 10z M12 10c2-4 5.5-4 5-1.5S12 10 12 10z',
  timer: 'M12 8v5l3 2 M10 3h4 M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const filled = name === 'play'
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

/** Filled game glyphs for counters (stars, streak, XP). */
export function StarGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z"
        fill="#ffc83d"
        stroke="#e09a00"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function FlameGlyph({ size = 22, lit = true }: { size?: number; lit?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2.5c1 3.5 5.5 6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.5 1.3-4.2 2.6-5.4.2 1.6 1 2.7 2 3.2C10.6 8.5 11 5.5 12 2.5z"
        fill={lit ? '#ff7a2f' : '#c9c4dc'}
      />
      <path d="M12 12.5c1.4 1.4 2.5 2.5 2.5 4a2.5 2.5 0 0 1-5 0c0-1.5 1.1-2.6 2.5-4z" fill={lit ? '#ffd23f' : '#e4e1ef'} />
    </svg>
  )
}
