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

/** Purple header for inner screens: round white back button, stars, optional big title. */
export function TopBar({
  onBack,
  stars,
  bump,
  title,
  children,
}: {
  onBack?: () => void
  stars: number
  bump?: number
  title?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="topbar">
      <div className="topbar-row">
        {onBack ? (
          <button className="back-btn" onClick={onBack} aria-label="חזרה">
            <Icon name="back" size={26} />
          </button>
        ) : (
          <span />
        )}
        <div className="topbar-mid">{children}</div>
        <StarCount stars={stars} bump={bump} />
      </div>
      {title && <h1 className="topbar-title">{title}</h1>}
    </header>
  )
}
