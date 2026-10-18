import type { Store } from '../App'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import { LETTERS } from '../content/letters'

export function LetterList({ store }: { store: Store }) {
  const { data, go } = store
  return (
    <main className="screen">
      <TopBar onBack={() => go('/')} stars={data.stars}>
        <h1 className="screen-title">כרטיסי אותיות</h1>
      </TopBar>
      <p className="hint">
        {data.seenLetters.length}/{LETTERS.length} נפתחו · בחרי אות ושמעי אותה
      </p>
      <div className="letter-grid" dir="ltr">
        {LETTERS.map((l, i) => {
          const seen = data.seenLetters.includes(l.id)
          return (
            <button
              key={l.id}
              className={`letter-tile tint-${i % 4} ${seen ? 'tile-done' : ''}`}
              onClick={() => go(`/letter/${l.id}`)}
              aria-label={`${l.upper} ${l.lower}${seen ? ', נפתחה' : ''}`}
            >
              <span className="tile-letters" lang="en">
                {l.upper}
                {l.lower}
              </span>
              <span className="tile-emoji">{l.keyword.emoji}</span>
              {seen && (
                <span className="tile-seen">
                  <Icon name="check" size={16} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </main>
  )
}
