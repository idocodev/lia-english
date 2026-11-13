// What both word games share: a Leitner round over the words she can sound out,
// first-try answers into the save (stars, boxes, events for the cloud), dots, combo and the sticker.

import { useRef, useState } from 'react'
import type { Store } from '../App'
import { gamePool } from '../content/letters'
import { nextSticker } from '../content/stickers'
import { wordPool } from '../content/words'
import { Round, type Progress, type Question, type Rng } from '../engine/engine'
import { levelOf, xpOf } from '../engine/progress'
import { roundIdFor, newId, type GameId } from '../storage/local'

export function useWordRound(store: Store, game: GameId, length: number, makeOptions: (target: string, pool: string[], p: Progress, rng: Rng) => string[]) {
  const { data, update } = store
  const roundRef = useRef<Round | null>(null)
  if (!roundRef.current) {
    const pool = wordPool(gamePool(data.seenLetters))
    roundRef.current = new Round(data.progress, pool, { confusionPairs: [], sameSound: [] }, Math.random, length, (t, p, rng) => makeOptions(t, pool, p, rng))
  }
  const round = roundRef.current
  const [q, setQ] = useState<Question>(() => round.next())
  const [qn, setQn] = useState(0) // question number, for keying per-word state
  const [results, setResults] = useState<boolean[]>([])
  const [combo, setCombo] = useState(0)
  const [stars, setStars] = useState(0)
  const [sticker, setSticker] = useState<string | null>(null)
  const [levelBefore] = useState(() => levelOf(xpOf(data)).level)
  const [roundId] = useState(() => roundIdFor(game))

  /** Her first answer to the current word; `chosen` is the word she picked or spelled. */
  const answer = (chosen: string) => {
    const ok = chosen === q.target
    const progress = round.answer(q, chosen)
    update((s) => ({
      ...s,
      progress,
      stars: s.stars + (ok ? 1 : 0),
      events: [...s.events, { id: newId(), round: roundId, game, target: q.target, chosen, correct: ok, at: new Date().toISOString() }],
    }))
    setResults((r) => [...r, ok])
    if (ok) setStars((n) => n + 1)
    setCombo((c) => (ok ? c + 1 : 0))
  }

  /** On to the next word, or the end of the round. */
  const next = () => {
    if (!round.done) {
      setQ(round.next())
      setQn((n) => n + 1)
      return
    }
    const s = nextSticker(data.stickers)
    setSticker(s)
    update((d) => ({ ...d, stickers: d.stickers.includes(s) ? d.stickers : [...d.stickers, s] }))
  }

  return { round, q, qn, results, combo, stars, sticker, levelBefore, answer, next }
}
