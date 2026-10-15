import { useMemo } from 'react'

// Drawn as SVG so they look the same on every device (no font glyphs needed).
const STAR = 'M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z'
const HEART = 'M12 21 C5 15 1 11.5 1 7.5 A5 5 0 0 1 12 5 A5 5 0 0 1 23 7.5 C23 11.5 19 15 12 21 Z'
const COLORS = ['#ffd166', '#ff8fab', '#c9a7e8', '#7fd8be', '#ffb4a2']

/** A short (<1s) burst of sparkles. Re-mount (change `key`) to replay. */
export function Sparkles({ count = 14, spread = 110 }: { count?: number; spread?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
        const dist = spread * (0.6 + Math.random() * 0.5)
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          color: COLORS[i % COLORS.length],
          size: 12 + Math.random() * 14,
          delay: Math.random() * 120,
          heart: i % 3 === 0,
        }
      }),
    [count, spread],
  )
  return (
    <div className="sparkles" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          style={
            {
              '--x': `${b.x}px`,
              '--y': `${b.y}px`,
              color: b.color,
              fontSize: b.size,
              animationDelay: `${b.delay}ms`,
            } as React.CSSProperties
          }
        >
          <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
            <path d={b.heart ? HEART : STAR} />
          </svg>
        </span>
      ))}
    </div>
  )
}
