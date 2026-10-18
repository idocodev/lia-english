import type { Store } from '../App'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import { LETTERS } from '../content/letters'
import { badgesOf } from '../engine/progress'

const TONES = ['lavender', 'blue', 'peach'] as const

export function Badges({ store }: { store: Store }) {
  const { data, go } = store
  const badges = badgesOf(data, LETTERS.length, new Date())
  const earned = badges.filter((b) => b.earned).length
  return (
    <main className="screen inner with-nav">
      <TopBar onBack={() => go('/')} stars={data.stars} title="התגים שלי" />
      <div className="sheet">
        <p className="hint">
          {earned}/{badges.length} תגים נאספו
        </p>
        <ul className="rows badge-list">
          {badges.map((b, i) => (
            <li key={b.id} className={`row-card tone-${TONES[i % 3]} ${b.earned ? '' : 'row-locked'}`}>
              <span className={`num-circle badge-circle c-${['purple', 'blue', 'orange'][i % 3]}`}>{b.earned ? b.icon : <Icon name="lock" size={22} />}</span>
              <span className="row-main">
                <span className="row-title">{b.name}</span>
                <span className="row-sub">{b.how}</span>
              </span>
              {b.earned && (
                <span className="row-end row-check">
                  <Icon name="check" size={20} />
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
