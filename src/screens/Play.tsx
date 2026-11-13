import type { Store } from '../App'
import { Icon } from '../components/Icon'
import { TopBar } from '../components/TopBar'
import { pictureUrl } from '../content/words'
import { PictureCredit } from './Credits'

/** Every game in one place: the raised play button in the tab bar opens it. */
export function Play({ store }: { store: Store }) {
  const { data, go } = store
  return (
    <main className="screen inner with-nav">
      <TopBar onBack={() => go('/')} stars={data.stars} title="בואי נשחק" />
      <div className="sheet">
        <div className="rows">
          <GameRow tone="peach" circle="orange" n={1} title="אתגר הצלילים" sub="איזו אות עושה את הצליל?" count="10 שאלות" onClick={() => go('/game')} />
          <GameRow tone="blue" circle="blue" n={2} title="שמע ובחר" sub="שומעים מילה ובוחרים תמונה" count="8 מילים" picture="cat" onClick={() => go('/words/pick')} />
          <GameRow tone="lavender" circle="purple" n={3} title="בנה את המילה" sub="שומעים מילה ובונים אותה מאותיות" count="6 מילים" picture="sun" onClick={() => go('/words/build')} />
        </div>
        <PictureCredit />
      </div>
    </main>
  )
}

export function GameRow(props: { tone: string; circle: string; n: number; title: string; sub: string; count: string; picture?: string; onClick: () => void }) {
  return (
    <button className={`row-card tone-${props.tone}`} onClick={props.onClick}>
      <span className={`num-circle c-${props.circle}`}>{props.n}</span>
      <span className="row-main">
        <span className="row-title">{props.title}</span>
        <span className="row-sub">{props.sub}</span>
      </span>
      <span className="row-end row-end-icon">
        {props.picture ? <img className="row-picture" src={pictureUrl(props.picture)} alt="" /> : <Icon name="play" size={22} />}
        <span>{props.count}</span>
      </span>
    </button>
  )
}
