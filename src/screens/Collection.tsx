import type { Store } from '../App'
import { TopBar } from '../components/TopBar'
import { STICKERS } from '../content/stickers'

export function Collection({ store }: { store: Store }) {
  const { data, go } = store
  const slots = Math.max(STICKERS.length, data.stickers.length)
  return (
    <main className="screen inner with-nav">
      <TopBar onBack={() => go('/')} stars={data.stars} title="האוסף שלי" />
      <div className="sheet">
        <p className="hint">
          {data.stickers.length}/{STICKERS.length} פריטים · כל אתגר שמסתיים = פריט חדש
        </p>
        <div className="sticker-grid">
          {Array.from({ length: slots }, (_, i) => (
            <span key={i} className={`sticker ${data.stickers[i] ? `tone-${['lavender', 'blue', 'peach'][i % 3]}` : 'sticker-empty'}`}>
              {data.stickers[i] ?? '?'}
            </span>
          ))}
        </div>
        <button className="btn btn-primary btn-wide" onClick={() => go('/game')}>
          לאתגר הבא
        </button>
      </div>
    </main>
  )
}
