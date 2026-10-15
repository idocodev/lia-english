import type { Store } from '../App'
import { Mascot } from '../components/Mascot'
import { StarCount } from '../components/TopBar'
import { STICKERS } from '../content/stickers'

export function Home({ store }: { store: Store }) {
  const { data, go } = store
  const slots = Math.max(10, Math.ceil(data.stickers.length / 5) * 5)
  return (
    <main className="screen home">
      <header className="topbar">
        <span />
        <span />
        <StarCount stars={data.stars} />
      </header>

      <section className="hello">
        <Mascot size={150} />
        <div className="bubble">
          <h1>היי ליה! 👋</h1>
          <p>מה נלמד היום?</p>
        </div>
      </section>

      <section className="activities">
        <button className="activity activity-cards" onClick={() => go('/letters')}>
          <span className="activity-art" dir="ltr" lang="en">
            Aa
          </span>
          <span className="activity-title">כרטיסי אותיות</span>
          <span className="activity-sub">לשמוע איך כל אות נשמעת</span>
        </button>
        <button className="activity activity-game" onClick={() => go('/game')}>
          <span className="activity-art">👂</span>
          <span className="activity-title">משחק הצלילים</span>
          <span className="activity-sub">איזו אות עושה את הצליל?</span>
        </button>
      </section>

      <section className="sticker-shelf" aria-label="המדבקות שלי">
        <h2>המדבקות שלי</h2>
        <div className="sticker-row">
          {Array.from({ length: slots }, (_, i) => (
            <span key={i} className={`sticker ${data.stickers[i] ? '' : 'sticker-empty'}`}>
              {data.stickers[i] ?? '?'}
            </span>
          ))}
        </div>
        <p className="shelf-hint">
          {data.stickers.length}/{STICKERS.length} · כל סיבוב במשחק = מדבקה חדשה
        </p>
      </section>
    </main>
  )
}
