import type { Store } from '../App'
import { TopBar } from '../components/TopBar'
import { LETTERS } from '../content/letters'

export function LetterList({ store }: { store: Store }) {
  const { data, go } = store
  return (
    <main className="screen">
      <TopBar onBack={() => go('/')} stars={data.stars}>
        <h1 className="screen-title">כרטיסי אותיות</h1>
      </TopBar>
      <p className="hint">בחרי אות כדי לשמוע את הצליל שלה</p>
      <div className="letter-grid" dir="ltr">
        {LETTERS.map((l, i) => (
          <button
            key={l.id}
            className={`letter-tile tint-${i % 4}`}
            onClick={() => go(`/letter/${l.id}`)}
            aria-label={`${l.upper} ${l.lower}`}
          >
            <span className="tile-letters" lang="en">
              {l.upper}
              {l.lower}
            </span>
            <span className="tile-emoji">{l.keyword.emoji}</span>
            {data.seenLetters.includes(l.id) && <span className="tile-seen">✓</span>}
          </button>
        ))}
      </div>
    </main>
  )
}
