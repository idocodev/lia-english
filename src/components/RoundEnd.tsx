import { useEffect } from 'react'
import type { Store } from '../App'
import { sayHebrew } from '../audio/audio'
import { levelOf, xpOf, XP_PER_STAR, XP_PER_STICKER } from '../engine/progress'
import { Icon, StarGlyph } from './Icon'
import { Mascot } from './Mascot'
import { Sparkles } from './Sparkles'

/** The end of a round: stars, XP, the new sticker, "level up" when she went up. Same look as the sound game's. */
export function RoundEnd({
  store,
  stars,
  length,
  levelBefore,
  sticker,
  onAgain,
}: {
  store: Store
  stars: number
  length: number
  levelBefore: number
  sticker: string
  onAgain: () => void
}) {
  const { data, go } = store
  const level = levelOf(xpOf(data)).level

  // "You went up a level!" when she did, then "you got a new sticker!". Once, on arrival.
  useEffect(() => {
    void (async () => {
      if (level > levelBefore) await sayHebrew('level-up')
      await sayHebrew('new-sticker')
    })()
  }, [])

  return (
    <main className="screen end-screen">
      <div className="end-burst">
        <Sparkles count={24} spread={170} />
        <Mascot size={140} mood="cheer" />
      </div>
      <p className="end-kicker">האתגר הושלם</p>
      <h1>{stars >= length - 1 ? 'וואו, ליה!' : 'כל הכבוד, ליה!'}</h1>
      {level > levelBefore && <p className="level-up">עלית לרמה {level}!</p>}
      <div className="end-stats">
        <div className="end-stat">
          <StarGlyph size={28} />
          <b>
            {stars}/{length}
          </b>
          <span>תשובות בול</span>
        </div>
        <div className="end-stat end-stat-xp">
          <span className="xp-glyph">XP</span>
          <b dir="ltr">+{stars * XP_PER_STAR + XP_PER_STICKER}</b>
          <span>נקודות</span>
        </div>
      </div>
      <div className="new-sticker">
        <span className="new-sticker-label">פריט חדש לאוסף!</span>
        <span className="new-sticker-art">{sticker}</span>
      </div>
      <div className="end-actions">
        <button className="btn btn-primary btn-big" onClick={onAgain}>
          <Icon name="replay" /> עוד סיבוב
        </button>
        <button className="btn btn-soft btn-big" onClick={() => go('/play')}>
          <Icon name="play" /> משחק אחר
        </button>
      </div>
    </main>
  )
}
