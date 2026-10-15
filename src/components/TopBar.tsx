import type { ReactNode } from 'react'

export function StarCount({ stars, bump }: { stars: number; bump?: number }) {
  return (
    <div className="star-count" key={bump} aria-label={`${stars} כוכבים`}>
      <span className="star-icon">⭐</span>
      <span>{stars}</span>
    </div>
  )
}

export function TopBar({ onBack, stars, bump, children }: { onBack?: () => void; stars: number; bump?: number; children?: ReactNode }) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label="חזרה">
          →
        </button>
      ) : (
        <span />
      )}
      <div className="topbar-mid">{children}</div>
      <StarCount stars={stars} bump={bump} />
    </header>
  )
}
