import type { Store } from '../App'
import { Mascot } from '../components/Mascot'
import { FlameGlyph, Icon } from '../components/Icon'
import { StarCount } from '../components/TopBar'
import { LETTERS } from '../content/letters'
import { STICKERS } from '../content/stickers'
import { badgesOf, levelOf, streakOf, xpOf } from '../engine/progress'

export function Home({ store }: { store: Store }) {
  const { data, go } = store
  const now = new Date()
  const { level, into, need } = levelOf(xpOf(data))
  const streak = streakOf(data.events, now)
  const badges = badgesOf(data, LETTERS.length, now)
  const earned = badges.filter((b) => b.earned).length
  const slots = Math.max(10, Math.ceil(data.stickers.length / 5) * 5)

  const streakLine = streak.playedToday
    ? 'שיחקת היום, הרצף נשמר!'
    : streak.current > 0
      ? 'שחקי היום כדי לשמור על הרצף'
      : 'סיבוב אחד היום מתחיל רצף'

  return (
    <main className="screen home">
      <section className="profile">
        <div className="avatar">
          <Mascot size={92} />
        </div>
        <div className="profile-main">
          <h1>היי ליה!</h1>
          <div className="level-row">
            <span className="level-badge">רמה {level}</span>
            <span className="xp-text" dir="ltr">
              {into}/{need} XP
            </span>
          </div>
          <div className="xp-bar" role="progressbar" aria-label="התקדמות לרמה הבאה" aria-valuemin={0} aria-valuemax={need} aria-valuenow={into}>
            <span style={{ width: `${(into / need) * 100}%` }} />
          </div>
        </div>
        <StarCount stars={data.stars} />
      </section>

      <section className={`streak ${streak.current > 0 ? 'streak-on' : ''}`}>
        <FlameGlyph size={40} lit={streak.current > 0} />
        <div>
          <b>
            {streak.current} {streak.current === 1 ? 'יום' : 'ימים'} ברצף
          </b>
          <span>{streakLine}</span>
        </div>
      </section>

      <section className="activities" aria-label="משימות">
        <button className="activity activity-cards" onClick={() => go('/letters')}>
          <span className="activity-art" dir="ltr" lang="en">
            Aa
          </span>
          <span className="activity-text">
            <span className="activity-title">כרטיסי אותיות</span>
            <span className="activity-sub">
              {data.seenLetters.length}/{LETTERS.length} אותיות נפתחו
            </span>
          </span>
          <span className="activity-go" aria-hidden>
            <Icon name="next" />
          </span>
        </button>
        <button className="activity activity-game" onClick={() => go('/game')}>
          <span className="activity-art">
            <Icon name="speaker" size={44} />
          </span>
          <span className="activity-text">
            <span className="activity-title">אתגר הצלילים</span>
            <span className="activity-sub">
              10 שאלות · עד <bdi dir="ltr">125 XP</bdi>
            </span>
          </span>
          <span className="activity-go" aria-hidden>
            <Icon name="play" />
          </span>
        </button>
      </section>

      <section className="panel badges-panel" aria-label="תגים">
        <h2>
          תגים <span className="panel-count">{earned}/{badges.length}</span>
        </h2>
        <ul className="badge-grid">
          {badges.map((b) => (
            <li key={b.id} className={`badge ${b.earned ? 'badge-earned' : ''}`} title={b.how}>
              <span className="badge-icon">{b.earned ? b.icon : <Icon name="lock" size={22} />}</span>
              <span className="badge-name">{b.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel sticker-shelf" aria-label="האוסף שלי">
        <h2>
          האוסף שלי{' '}
          <span className="panel-count">
            {data.stickers.length}/{STICKERS.length}
          </span>
        </h2>
        <div className="sticker-row">
          {Array.from({ length: slots }, (_, i) => (
            <span key={i} className={`sticker ${data.stickers[i] ? '' : 'sticker-empty'}`}>
              {data.stickers[i] ?? '?'}
            </span>
          ))}
        </div>
        <p className="shelf-hint">כל אתגר שמסתיים = פריט חדש לאוסף</p>
      </section>
    </main>
  )
}
