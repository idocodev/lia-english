import type { Store } from '../App'
import { Mascot } from '../components/Mascot'
import { FlameGlyph, Icon } from '../components/Icon'
import { StarCount } from '../components/TopBar'
import { LETTERS } from '../content/letters'
import { STICKERS } from '../content/stickers'
import { levelOf, streakOf, xpOf } from '../engine/progress'

export function Home({ store }: { store: Store }) {
  const { data, go } = store
  const now = new Date()
  const { level, into, need } = levelOf(xpOf(data))
  const streak = streakOf(data.events, now)

  const streakLine = streak.playedToday ? 'שיחקת היום, הרצף נשמר!' : streak.current > 0 ? 'שחקי היום כדי לשמור על הרצף' : 'סיבוב אחד היום מתחיל רצף'

  // Letters she hasn't opened yet come first, then the rest.
  const today = [...LETTERS.filter((l) => !data.seenLetters.includes(l.id)), ...LETTERS.filter((l) => data.seenLetters.includes(l.id))].slice(0, 6)

  return (
    <main className="screen home with-nav">
      <header className="home-top">
        <h1>היי ליה!</h1>
        <div className="home-chips">
          <div className={`chip chip-streak ${streak.current > 0 ? 'chip-lit' : ''}`} aria-label={`${streak.current} ימים ברצף`}>
            <FlameGlyph lit={streak.current > 0} />
            <span>{streak.current}</span>
          </div>
          <StarCount stars={data.stars} />
        </div>
      </header>

      <section className="hero">
        <div className="hero-text">
          <h2>אתגר הצלילים</h2>
          <p>{streakLine}</p>
          <button className="pill-btn" onClick={() => go('/game')}>
            בואי נשחק
          </button>
        </div>
        <div className="hero-art" aria-hidden>
          <span className="hero-spark s1" />
          <span className="hero-spark s2" />
          <span className="hero-spark s3" />
          <Mascot size={118} />
        </div>
      </section>

      <section className="row-card tone-lavender level-card" aria-label="הרמה שלי">
        <span className="num-circle c-purple">{level}</span>
        <div className="row-main">
          <span className="row-title">רמה {level}</span>
          <div className="bar" role="progressbar" aria-label="התקדמות לרמה הבאה" aria-valuemin={0} aria-valuemax={need} aria-valuenow={into}>
            <span style={{ width: `${(into / need) * 100}%` }} />
          </div>
        </div>
        <span className="row-end" dir="ltr">
          <b>{into}</b>/{need} XP
        </span>
      </section>

      <section aria-label="אותיות להיום">
        <h2 className="section-title">אותיות להיום</h2>
        <div className="tiles">
          {today.map((l) => (
            <button key={l.id} className="tile" onClick={() => go(`/letter/${l.id}`)} aria-label={`${l.upper} ${l.lower}`}>
              <span className="tile-art">
                <span aria-hidden>{l.keyword.emoji}</span>
                {data.seenLetters.includes(l.id) && (
                  <span className="tile-seen">
                    <Icon name="check" size={14} />
                  </span>
                )}
              </span>
              <span className="tile-label" lang="en">
                {l.upper}
                {l.lower}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section aria-label="משימות">
        <h2 className="section-title">המשימות שלך</h2>
        <div className="rows">
          <button className="row-card tone-blue" onClick={() => go('/letters')}>
            <span className="num-circle c-blue">1</span>
            <span className="row-main">
              <span className="row-title">כרטיסי אותיות</span>
              <span className="bar bar-blue">
                <span style={{ width: `${(data.seenLetters.length / LETTERS.length) * 100}%` }} />
              </span>
            </span>
            <span className="row-end" dir="ltr">
              <b>{data.seenLetters.length}</b>/{LETTERS.length}
            </span>
          </button>
          <button className="row-card tone-peach" onClick={() => go('/game')}>
            <span className="num-circle c-orange">2</span>
            <span className="row-main">
              <span className="row-title">אתגר הצלילים</span>
              <span className="row-big">10 שאלות</span>
            </span>
            <span className="row-end row-end-icon">
              <Icon name="timer" size={22} />
              <bdi dir="ltr">125 XP</bdi>
            </span>
          </button>
          <button className="row-card tone-lavender" onClick={() => go('/collection')}>
            <span className="num-circle c-purple">3</span>
            <span className="row-main">
              <span className="row-title">האוסף שלי</span>
              <span className="bar">
                <span style={{ width: `${(data.stickers.length / STICKERS.length) * 100}%` }} />
              </span>
            </span>
            <span className="row-end" dir="ltr">
              <b>{data.stickers.length}</b>/{STICKERS.length}
            </span>
          </button>
        </div>
      </section>
    </main>
  )
}
