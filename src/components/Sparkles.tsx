import { useMemo } from 'react'

// Drawn as SVG so they look the same on every device (no font glyphs needed).
const STAR = 'M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z'
const DIAMOND = 'M12 2 L20 12 L12 22 L4 12 Z'
const COLORS = ['#ffc83d', '#22b0f0', '#9157f0', '#ff5d8f', '#ff8a1f']

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
          diamond: i % 3 === 0,
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
            <path d={b.diamond ? DIAMOND : STAR} />
          </svg>
        </span>
      ))}
    </div>
  )
}
