import type { ReactNode } from 'react'
import { Icon, StarGlyph } from './Icon'

export function StarCount({ stars, bump }: { stars: number; bump?: number }) {
  return (
    <div className="chip chip-stars" key={bump} aria-label={`${stars} כוכבים`}>
      <StarGlyph />
      <span>{stars}</span>
    </div>
  )
}

export function TopBar({ onBack, stars, bump, children }: { onBack?: () => void; stars: number; bump?: number; children?: ReactNode }) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label="חזרה">
          <Icon name="back" size={28} />
        </button>
      ) : (
        <span />
      )}
      <div className="topbar-mid">{children}</div>
      <StarCount stars={stars} bump={bump} />
    </header>
  )
}
