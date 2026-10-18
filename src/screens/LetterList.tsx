import type { Store } from '../App'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import { LETTERS } from '../content/letters'

const TONES = [
  ['blue', 'blue'],
  ['peach', 'orange'],
  ['lavender', 'purple'],
] as const

export function LetterList({ store }: { store: Store }) {
  const { data, go } = store
  return (
    <main className="screen inner with-nav">
      <TopBar onBack={() => go('/')} stars={data.stars} title="כרטיסי אותיות" />
      <div className="sheet">
        <p className="hint">
          {data.seenLetters.length}/{LETTERS.length} נפתחו · בחרי אות ושמעי אותה
        </p>
        <div className="rows letter-rows">
          {LETTERS.map((l, i) => {
            const seen = data.seenLetters.includes(l.id)
            const [tone, circle] = TONES[i % 3]
            return (
              <button
                key={l.id}
                className={`row-card tone-${tone}`}
                onClick={() => go(`/letter/${l.id}`)}
                aria-label={`${l.upper} ${l.lower}${seen ? ', נפתחה' : ''}`}
              >
                <span className={`num-circle letter-circle c-${circle}`} lang="en">
                  {l.upper}
                  {l.lower}
                </span>
                <span className="row-main">
                  <span className="row-title" dir="ltr" lang="en">
                    {l.keyword.word}
                  </span>
                  <span className="row-sub">
                    הצליל: <bdi>{l.soundHe}</bdi>
                  </span>
                </span>
                <span className="row-emoji" aria-hidden>
                  {l.keyword.emoji}
                </span>
                {seen ? (
                  <span className="row-end row-check">
                    <Icon name="check" size={18} />
                  </span>
                ) : (
                  <span className="row-end row-new">חדש</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </main>
  )
}
