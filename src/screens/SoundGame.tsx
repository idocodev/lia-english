import { useEffect, useRef, useState } from 'react'
import type { Store } from '../App'
import { Mascot } from '../components/Mascot'
import { Sparkles } from '../components/Sparkles'
import { TopBar } from '../components/TopBar'
import { FlameGlyph, Icon, StarGlyph } from '../components/Icon'
import { CONFUSION_PAIRS, LETTERS, LETTER_BY_ID, SAME_SOUND, type LetterId } from '../content/letters'
import { nextSticker } from '../content/stickers'
import { Round, type Question } from '../engine/engine'
import { levelOf, xpOf, XP_PER_STAR, XP_PER_STICKER } from '../engine/progress'
import { chime, playContrast, playSound, sayHebrew, stop } from '../audio/audio'

const ROUND_LENGTH = 10
const PRAISE = ['בול!', 'מעולה!', 'בדיוק!', 'יש!', 'אלופה!', 'אש!']
// Spoken praise only now and then (every 2nd-3rd right answer), so it stays special.
const SPOKEN_PRAISE = ['kol-hakavod', 'meule', 'wow'] as const
const praiseGap = () => 2 + Math.floor(Math.random() * 2)
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Feedback = { chosen: string; ok: boolean } | null

export function SoundGame({ store }: { store: Store }) {
  const [n, setN] = useState(0)
  return <Game key={n} store={store} onAgain={() => setN((x) => x + 1)} />
}

function Game({ store, onAgain }: { store: Store; onAgain: () => void }) {
  const { data, update, go } = store
  const roundRef = useRef<Round | null>(null)
  if (!roundRef.current) {
    roundRef.current = new Round(
      data.progress,
      LETTERS.map((l) => l.id),
      { confusionPairs: CONFUSION_PAIRS, sameSound: SAME_SOUND },
      Math.random,
      ROUND_LENGTH,
    )
  }
  const round = roundRef.current

  const [q, setQ] = useState<Question>(() => round.next())
  const [firstTry, setFirstTry] = useState(true)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [focus, setFocus] = useState('')
  const [busy, setBusy] = useState(false)
  const [roundStars, setRoundStars] = useState(0)
  const [praise, setPraise] = useState('')
  const [sticker, setSticker] = useState<string | null>(null)
  const [results, setResults] = useState<boolean[]>([])
  const [combo, setCombo] = useState(0)
  const [levelBefore] = useState(() => levelOf(xpOf(data)).level)
  const praiseIn = useRef(praiseGap())
  const praiseNext = useRef(Math.floor(Math.random() * SPOKEN_PRAISE.length))
  const missedLast = useRef(false)

  const target = LETTER_BY_ID[q.target as LetterId]

  // Play the sound for each new question: the round opens with "which sound do you hear?",
  // and a question after a miss with "listen carefully".
  useEffect(() => {
    let live = true
    const intro = round.asked === 0 ? 'which-sound' : missedLast.current ? 'listen' : null
    missedLast.current = false
    const t = setTimeout(async () => {
      if (intro) await sayHebrew(intro)
      if (live) playSound(target)
    }, 450)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [q, target, round])

  useEffect(() => () => stop(), [])

  // End of round: "you went up a level!" when she did, then "you got a new sticker!".
  useEffect(() => {
    if (!sticker) return
    void (async () => {
      if (levelOf(xpOf(data)).level > levelBefore) await sayHebrew('level-up')
      await sayHebrew('new-sticker')
    })()
    // Once per round end; data is already updated with the new sticker here.
  }, [sticker])

  const choose = async (id: string) => {
    if (busy || sticker) return
    stop()
    const ok = id === q.target
    if (firstTry) {
      const progress = round.answer(q, id)
      update((s) => ({
        ...s,
        progress,
        stars: s.stars + (ok ? 1 : 0),
        events: [...s.events, { game: 'sound', target: q.target, chosen: id, correct: ok, at: new Date().toISOString() }],
      }))
      setResults((r) => [...r, ok])
      if (ok) setRoundStars((n) => n + 1)
      setCombo((c) => (ok ? c + 1 : 0))
    }
    setFeedback({ chosen: id, ok })

    if (ok) {
      chime('yay')
      setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
      setBusy(true)
      let spoken: Promise<void> = Promise.resolve()
      if (--praiseIn.current <= 0 && !round.done) {
        praiseIn.current = praiseGap()
        const clip = SPOKEN_PRAISE[praiseNext.current++ % SPOKEN_PRAISE.length]
        spoken = pause(250).then(() => sayHebrew(clip))
      }
      // The next question's sound waits for the praise to finish.
      await Promise.all([spoken, pause(1300)])
      setBusy(false)
      setFeedback(null)
      setPraise('')
      if (round.done) finish()
      else {
        setFirstTry(true)
        setQ(round.next())
      }
    } else {
      // No red "wrong": "almost! let's try again" (first miss only), then both sounds side by side.
      chime('soft')
      setBusy(true)
      if (firstTry) {
        missedLast.current = true
        await pause(250)
        await sayHebrew('almost')
      }
      setFirstTry(false)
      await playContrast(target, LETTER_BY_ID[id as LetterId], setFocus)
      setBusy(false)
      setFeedback(null)
    }
  }

  const finish = () => {
    const s = nextSticker(data.stickers)
    setSticker(s)
    chime('yay')
    update((d) => ({ ...d, stickers: d.stickers.includes(s) ? d.stickers : [...d.stickers, s] }))
  }

  if (sticker) {
    const level = levelOf(xpOf(data)).level
    const roundXp = roundStars * XP_PER_STAR + XP_PER_STICKER
    return (
      <main className="screen end-screen">
        <div className="end-burst">
          <Sparkles count={24} spread={170} />
          <Mascot size={140} mood="cheer" />
        </div>
        <p className="end-kicker">האתגר הושלם</p>
        <h1>{roundStars >= 8 ? 'וואו, ליה!' : 'כל הכבוד, ליה!'}</h1>
        {level > levelBefore && <p className="level-up">עלית לרמה {level}!</p>}
        <div className="end-stats">
          <div className="end-stat">
            <StarGlyph size={28} />
            <b>
              {roundStars}/{ROUND_LENGTH}
            </b>
            <span>תשובות בול</span>
          </div>
          <div className="end-stat end-stat-xp">
            <span className="xp-glyph">XP</span>
            <b dir="ltr">+{roundXp}</b>
            <span>נקודות</span>
          </div>
        </div>
        <div className="new-sticker">
          <span className="new-sticker-label">פריט חדש לאוסף!</span>
          <span className="new-sticker-art">{sticker}</span>
        </div>
        <div className="end-actions">
          <button className="btn btn-primary btn-big" onClick={onAgain}>
            <Icon name="replay" /> עוד סיבוב
          </button>
          <button className="btn btn-soft btn-big" onClick={() => go('/')}>
            <Icon name="home" /> הביתה
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="screen inner game-screen">
      <TopBar onBack={() => go('/')} stars={data.stars} bump={data.stars}>
        <div className="dots" role="img" aria-label={`שאלה ${Math.min(results.length + 1, ROUND_LENGTH)} מתוך ${ROUND_LENGTH}`}>
          {Array.from({ length: ROUND_LENGTH }, (_, i) => (
            <span key={i} className={`dot ${i < results.length ? (results[i] ? 'dot-ok' : 'dot-miss') : ''} ${i === results.length ? 'dot-now' : ''}`} />
          ))}
        </div>
      </TopBar>

      <div className="sheet">
        <section className="game-prompt">
          {combo >= 2 && (
            <span className="combo" key={combo}>
              <FlameGlyph size={20} /> {combo} ברצף
            </span>
          )}
          <Mascot size={86} mood={feedback?.ok ? 'cheer' : feedback ? 'think' : 'happy'} />
          <div className="bubble bubble-small">
            {praise ? <b>{praise}</b> : feedback && !feedback.ok ? <span>כמעט! הקשיבי להבדל בין שני הצלילים</span> : <span>איזו אות עושה את הצליל ששמעת?</span>}
          </div>
        </section>

        <button className="listen-btn" onClick={() => !busy && playSound(target)} aria-label="להשמיע שוב">
          <span className="listen-icon">
            <Icon name="speaker" size={30} />
          </span>
          <span>להשמיע שוב</span>
        </button>

        <div className={`options options-${q.options.length}`} dir="ltr">
          {q.options.map((id, i) => {
            const l = LETTER_BY_ID[id as LetterId]
            const state = feedback?.ok && id === q.target ? 'opt-right' : feedback && !feedback.ok && id === feedback.chosen ? 'opt-miss' : ''
            return (
              <button
                key={`${q.target}-${id}-${round.asked}`}
                className={`option opt-tone-${i % 3} ${state} ${focus === id ? 'opt-focus' : ''}`}
                onClick={() => choose(id)}
                lang="en"
                aria-label={l.upper}
              >
                {state === 'opt-right' && (
                  <>
                    <Sparkles />
                    <span className="xp-pop" dir="ltr">
                      {firstTry ? `+${XP_PER_STAR} XP` : '✓'}
                    </span>
                  </>
                )}
                <span className="opt-lower">{l.lower}</span>
                <span className="opt-upper">{l.upper}</span>
              </button>
            )
          })}
        </div>
      </div>
    </main>
  )
}
