import { useEffect, useRef, useState } from 'react'
import type { Store } from '../App'
import { FlameGlyph, Icon } from '../components/Icon'
import { Mascot } from '../components/Mascot'
import { RoundEnd } from '../components/RoundEnd'
import { Sparkles } from '../components/Sparkles'
import { TopBar } from '../components/TopBar'
import { pictureUrl } from '../content/words'
import { XP_PER_STAR } from '../engine/progress'
import { pickPictures } from '../engine/words'
import { chime, playWord, sayEnglish, sayHebrew, stop } from '../audio/audio'
import { useWordRound } from './useWordRound'

const ROUND_LENGTH = 8
const PRAISE = ['בול!', 'מעולה!', 'בדיוק!', 'יש!', 'אלופה!', 'אש!']
const SPOKEN_PRAISE = ['kol-hakavod', 'meule', 'wow'] as const
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** "שמע ובחר": she hears a word and picks its picture out of three. */
export function WordPick({ store }: { store: Store }) {
  const [n, setN] = useState(0)
  return <Game key={n} store={store} onAgain={() => setN((x) => x + 1)} />
}

function Game({ store, onAgain }: { store: Store; onAgain: () => void }) {
  const { data, go } = store
  const w = useWordRound(store, 'word-pick', ROUND_LENGTH, (t, pool, p, rng) => pickPictures(p, t, pool, 3, rng))
  const { q, round } = w
  const [firstTry, setFirstTry] = useState(true)
  const [feedback, setFeedback] = useState<{ chosen: string; ok: boolean } | null>(null)
  const [focus, setFocus] = useState('')
  const [busy, setBusy] = useState(false)
  const [praise, setPraise] = useState('')
  const missedLast = useRef(false)
  const praiseCount = useRef(0)

  // Each new word: "listen carefully" at the start and after a miss, then the word.
  useEffect(() => {
    let live = true
    const intro = round.asked === 0 || missedLast.current
    missedLast.current = false
    const t = setTimeout(async () => {
      if (intro) await sayHebrew('listen')
      if (live) await playWord(q.target)
    }, 450)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [q, round])

  useEffect(() => () => stop(), [])

  const choose = async (id: string) => {
    if (busy || w.sticker) return
    stop()
    const ok = id === q.target
    if (firstTry) w.answer(id)
    setFeedback({ chosen: id, ok })
    setBusy(true)
    if (ok) {
      chime('yay')
      setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
      const spoken = ++praiseCount.current % 3 === 0 && !round.done ? pause(250).then(() => sayHebrew(SPOKEN_PRAISE[(praiseCount.current / 3) % 3])) : playWord(q.target)
      await Promise.all([spoken, pause(1300)])
      setBusy(false)
      setFeedback(null)
      setPraise('')
      setFirstTry(true)
      if (round.done) chime('yay')
      w.next()
    } else {
      // "Almost!", then what she tapped is ("this is hat"), then the word again to find.
      chime('soft')
      if (firstTry) {
        missedLast.current = true
        await pause(250)
        await sayHebrew('almost')
      }
      setFirstTry(false)
      setFocus(id)
      await Promise.all([sayEnglish('This is').then(() => playWord(id)), pause(1200)])
      setFocus('')
      await pause(350)
      await playWord(q.target)
      setBusy(false)
      setFeedback(null)
    }
  }

  if (w.sticker) return <RoundEnd store={store} stars={w.stars} length={ROUND_LENGTH} levelBefore={w.levelBefore} sticker={w.sticker} onAgain={onAgain} />

  return (
    <main className="screen inner game-screen">
      <TopBar onBack={() => go('/play')} stars={data.stars} bump={data.stars}>
        <Dots results={w.results} length={ROUND_LENGTH} />
      </TopBar>

      <div className="sheet">
        <section className="game-prompt">
          {w.combo >= 2 && (
            <span className="combo" key={w.combo}>
              <FlameGlyph size={20} /> {w.combo} ברצף
            </span>
          )}
          <Mascot size={86} mood={feedback?.ok ? 'cheer' : feedback ? 'think' : 'happy'} />
          <div className="bubble bubble-small">
            {praise ? <b>{praise}</b> : feedback && !feedback.ok ? <span>כמעט! הקשיבי שוב למילה</span> : <span>איזו תמונה מתאימה למילה ששמעת?</span>}
          </div>
        </section>

        <button className="listen-btn" onClick={() => !busy && playWord(q.target)} aria-label="להשמיע שוב">
          <span className="listen-icon">
            <Icon name="speaker" size={30} />
          </span>
          <span>להשמיע שוב</span>
        </button>

        <div className="options options-3 pic-options" dir="ltr">
          {q.options.map((id, i) => {
            const state = feedback?.ok && id === q.target ? 'opt-right' : feedback && !feedback.ok && id === feedback.chosen ? 'opt-miss' : ''
            return (
              <button key={`${q.target}-${id}-${round.asked}`} className={`option pic-option opt-tone-${i % 3} ${state} ${focus === id ? 'opt-focus' : ''}`} onClick={() => choose(id)} aria-label={`תמונה ${i + 1}`}>
                {state === 'opt-right' && (
                  <>
                    <Sparkles />
                    <span className="xp-pop" dir="ltr">
                      {firstTry ? `+${XP_PER_STAR} XP` : '✓'}
                    </span>
                  </>
                )}
                <img src={pictureUrl(id)} alt="" draggable={false} />
              </button>
            )
          })}
        </div>
      </div>
    </main>
  )
}

export function Dots({ results, length }: { results: boolean[]; length: number }) {
  return (
    <div className="dots" role="img" aria-label={`שאלה ${Math.min(results.length + 1, length)} מתוך ${length}`}>
      {Array.from({ length }, (_, i) => (
        <span key={i} className={`dot ${i < results.length ? (results[i] ? 'dot-ok' : 'dot-miss') : ''} ${i === results.length ? 'dot-now' : ''}`} />
      ))}
    </div>
  )
}
