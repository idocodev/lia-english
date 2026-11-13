import { useEffect, useRef, useState } from 'react'
import type { Store } from '../App'
import { FlameGlyph, Icon } from '../components/Icon'
import { Mascot } from '../components/Mascot'
import { RoundEnd } from '../components/RoundEnd'
import { Sparkles } from '../components/Sparkles'
import { TopBar } from '../components/TopBar'
import { LETTER_BY_ID, type LetterId } from '../content/letters'
import { lettersOf, pictureUrl } from '../content/words'
import { XP_PER_STAR } from '../engine/progress'
import { buildTiles, extraTiles, misspelled } from '../engine/words'
import { chime, playBlend, playSound, playWord, sayHebrew, stop } from '../audio/audio'
import { useWordRound } from './useWordRound'
import { Dots } from './WordPick'

const ROUND_LENGTH = 6
const PRAISE = ['בנית את זה!', 'מעולה!', 'בול!', 'אלופה!', 'יש!', 'וואו!']
const SPOKEN_PRAISE = ['kol-hakavod', 'meule', 'wow'] as const
/** After this many wrong tiles on one slot, the right tile glows. */
const HINT_AFTER = 2
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))
const letter = (id: string) => LETTER_BY_ID[id as LetterId]

/**
 * "בנה את המילה": she hears the word and sees its picture, then taps letter tiles into
 * the slots, left to right. Each tile says its sound. A wrong tile shakes and goes back.
 * When the word is built, the app blends it slowly (c - a - t) and says it whole.
 */
export function WordBuild({ store }: { store: Store }) {
  const [n, setN] = useState(0)
  return <Game key={n} store={store} onAgain={() => setN((x) => x + 1)} />
}

function Game({ store, onAgain }: { store: Store; onAgain: () => void }) {
  const { data, go } = store
  // One option per question: the word itself. Its tiles are laid out by the board, per word.
  const w = useWordRound(store, 'word-build', ROUND_LENGTH, (t) => [t])

  if (w.sticker) return <RoundEnd store={store} stars={w.stars} length={ROUND_LENGTH} levelBefore={w.levelBefore} sticker={w.sticker} onAgain={onAgain} />

  return (
    <main className="screen inner game-screen build-screen">
      <TopBar onBack={() => go('/play')} stars={data.stars} bump={data.stars}>
        <Dots results={w.results} length={ROUND_LENGTH} />
      </TopBar>
      <Board key={w.qn} w={w} store={store} />
    </main>
  )
}

/** One word: its picture, its slots and the letter tray. Mounted fresh for each word. */
function Board({ w, store }: { w: ReturnType<typeof useWordRound>; store: Store }) {
  const { q, round } = w
  const word = q.target
  const letters = lettersOf(word)

  const [tiles] = useState<string[]>(() => buildTiles(word, extraTiles(store.data.progress, word), Math.random))
  const [placed, setPlaced] = useState<(number | null)[]>(() => letters.map(() => null)) // slot -> tile index
  const [miss, setMiss] = useState<{ tile: number; n: number } | null>(null)
  const [slotMisses, setSlotMisses] = useState(0)
  const [blendFocus, setBlendFocus] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [praise, setPraise] = useState('')
  const firstMiss = useRef<string | null>(null)
  const saidAlmost = useRef(false)

  const slot = placed.findIndex((p) => p === null) // the slot to fill next; -1 when built
  const hintTile = slotMisses >= HINT_AFTER && slot >= 0 ? tiles.findIndex((t, i) => t === letters[slot] && !placed.includes(i)) : -1

  // The word, once the board is up ("listen" first at the start of the round).
  useEffect(() => {
    let live = true
    const t = setTimeout(async () => {
      if (round.asked === 0) await sayHebrew('listen')
      if (live) await playWord(word)
    }, 450)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [])

  useEffect(() => () => stop(), [])

  const tap = async (i: number) => {
    if (busy || done || slot < 0 || placed.includes(i)) return
    stop()
    const l = tiles[i]
    if (l === letters[slot]) {
      const next = placed.map((p, s) => (s === slot ? i : p))
      setPlaced(next)
      setSlotMisses(0)
      setMiss(null)
      if (next.every((p) => p !== null)) return complete()
      void playSound(letter(l))
      return
    }
    // Wrong letter: the tile shakes and says its own sound, then stays in the tray.
    firstMiss.current ??= misspelled(word, slot, l)
    setMiss({ tile: i, n: Date.now() })
    setSlotMisses((m) => m + 1)
    chime('soft')
    setBusy(true)
    await Promise.all([playSound(letter(l)), pause(500)])
    if (!saidAlmost.current) {
      saidAlmost.current = true
      await sayHebrew('almost')
    }
    setBusy(false)
  }

  const complete = async () => {
    setBusy(true)
    setDone(true)
    w.answer(firstMiss.current ?? word)
    await pause(350)
    // Blend: each sound with its slot lit, then the whole word, then the party.
    await playBlend(word, letters.map(letter), setBlendFocus)
    chime('yay')
    setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
    const spoken = w.qn % 2 === 1 && !round.done ? sayHebrew(SPOKEN_PRAISE[Math.floor(w.qn / 2) % 3]) : Promise.resolve()
    await Promise.all([spoken, pause(1500)])
    if (round.done) chime('yay')
    w.next()
  }

  const replayWord = () => !busy && playWord(word)
  const allLit = blendFocus === -1 || (done && blendFocus === null && !!praise)
  const firstTryOk = !firstMiss.current

  return (
    <div className="sheet">
      <section className="game-prompt">
        {w.combo >= 2 && (
          <span className="combo" key={w.combo}>
            <FlameGlyph size={20} /> {w.combo} ברצף
          </span>
        )}
        <Mascot size={64} mood={praise ? 'cheer' : slotMisses ? 'think' : 'happy'} />
        <div className="bubble bubble-small">{praise ? <b>{praise}</b> : done ? <span>בואי נקרא יחד...</span> : slotMisses ? <span>כמעט! הקשיבי לצלילים</span> : <span>בני את המילה: לחצי על האותיות לפי הסדר</span>}</div>
      </section>

      <button className={`build-picture ${praise ? 'build-picture-done' : ''}`} onClick={replayWord} aria-label="להשמיע את המילה">
        {praise && <Sparkles count={18} spread={130} />}
        <img src={pictureUrl(word)} alt="" draggable={false} />
        <span className="build-speaker">
          <Icon name="speaker" size={22} />
        </span>
      </button>

      <div className={`slots ${allLit ? 'slots-done' : ''}`} dir="ltr" lang="en" aria-label="המילה">
        {letters.map((_, s) => {
          const t = placed[s]
          const shake = miss && s === slot
          return (
            <span
              key={`${s}-${shake ? miss.n : 0}`}
              className={`slot ${t !== null ? 'slot-full' : ''} ${s === slot && !done ? 'slot-now' : ''} ${blendFocus === s ? 'slot-focus' : ''} ${shake ? 'slot-miss' : ''}`}
            >
              {t !== null ? tiles[t] : ''}
            </span>
          )
        })}
        {praise && (
          <span className="xp-pop" dir="ltr">
            {firstTryOk ? `+${XP_PER_STAR} XP` : '✓'}
          </span>
        )}
      </div>

      <div className="tray" dir="ltr" lang="en">
        {tiles.map((l, i) => {
          const used = placed.includes(i)
          const shake = miss?.tile === i
          return (
            <button
              key={`${i}-${shake ? miss.n : 0}`}
              className={`letter-tile tile-tone-${i % 3} ${used ? 'letter-tile-used' : ''} ${shake ? 'letter-tile-miss' : ''} ${i === hintTile ? 'letter-tile-hint' : ''}`}
              onClick={() => tap(i)}
              disabled={used || done}
              aria-label={l}
            >
              {l}
            </button>
          )
        })}
      </div>

      <button className="listen-btn listen-btn-small" onClick={replayWord} aria-label="להשמיע שוב">
        <span className="listen-icon">
          <Icon name="speaker" size={26} />
        </span>
        <span>להשמיע שוב</span>
      </button>
    </div>
  )
}
