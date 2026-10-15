// Adaptive practice engine: pure functions, no DOM, no storage (unit-tested in engine.test.ts).

export type ItemState = {
  /** Leitner box 1..5. New items start in box 1. */
  box: number
  correct: number
  wrong: number
  lastSeen?: string
}

export type Progress = {
  items: Record<string, ItemState>
  /** "target>chosen" -> count, e.g. "g>e": chose e when the answer was g. */
  confusions: Record<string, number>
}

export type Attempt = { target: string; chosen: string; correct: boolean; at: string }

export type Rng = () => number

export const emptyProgress = (): Progress => ({ items: {}, confusions: {} })

const itemOf = (p: Progress, id: string): ItemState => p.items[id] ?? { box: 1, correct: 0, wrong: 0 }

export function recordAttempt(p: Progress, a: Attempt): Progress {
  const prev = itemOf(p, a.target)
  const next: ItemState = a.correct
    ? { ...prev, box: Math.min(5, prev.box + 1), correct: prev.correct + 1, lastSeen: a.at }
    : { ...prev, box: 1, wrong: prev.wrong + 1, lastSeen: a.at }
  const confusions = { ...p.confusions }
  if (!a.correct) {
    const key = `${a.target}>${a.chosen}`
    confusions[key] = (confusions[key] ?? 0) + 1
  }
  return { items: { ...p.items, [a.target]: next }, confusions }
}

/** How much a letter needs practice: low boxes and recent mistakes weigh more. */
export function weightOf(p: Progress, id: string): number {
  const it = itemOf(p, id)
  const boxWeight = [0, 6, 4, 2.5, 1.5, 1][it.box] ?? 1
  const missedAsTarget = Object.entries(p.confusions)
    .filter(([k]) => k.startsWith(`${id}>`))
    .reduce((s, [, n]) => s + n, 0)
  return boxWeight + Math.min(missedAsTarget, 6)
}

export function weightedPick<T>(items: T[], weight: (t: T) => number, rng: Rng): T {
  const ws = items.map(weight)
  const total = ws.reduce((a, b) => a + b, 0)
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= ws[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

const pairKey = (a: string, b: string) => [a, b].sort().join('|')

export type DistractorRules = {
  confusionPairs: [string, string][]
  sameSound: [string, string][]
}

/**
 * Picks wrong options for a target. Known confusion pairs and letters she
 * actually mixed up come first; the rest is random from the pool.
 */
export function pickDistractors(
  p: Progress,
  target: string,
  pool: string[],
  count: number,
  rules: DistractorRules,
  rng: Rng,
): string[] {
  const banned = new Set(rules.sameSound.filter((pr) => pr.includes(target)).flat())
  banned.add(target)
  const candidates = pool.filter((id) => !banned.has(id))

  const score = (id: string) => {
    const pair = rules.confusionPairs.some((pr) => pairKey(pr[0], pr[1]) === pairKey(target, id)) ? 10 : 0
    const mixed = (p.confusions[`${target}>${id}`] ?? 0) + (p.confusions[`${id}>${target}`] ?? 0)
    return pair + mixed * 3
  }
  const prioritized = candidates.filter((id) => score(id) > 0).sort((a, b) => score(b) - score(a))
  const rest = shuffle(candidates.filter((id) => score(id) === 0), rng)
  return [...prioritized, ...rest].slice(0, count)
}

export function shuffle<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export type Question = { target: string; options: string[] }

/**
 * A practice round. Picks targets by weight, avoids immediate repeats, and
 * brings a missed letter back 2-3 questions later (spec §4e).
 */
export class Round {
  readonly length: number
  asked = 0
  correctCount = 0
  private retryQueue: { id: string; dueAt: number }[] = []
  private last?: string

  constructor(
    public progress: Progress,
    private pool: string[],
    private rules: DistractorRules,
    private rng: Rng = Math.random,
    length = 10,
  ) {
    this.length = length
  }

  get done() {
    return this.asked >= this.length
  }

  next(): Question {
    const dueIdx = this.retryQueue.findIndex((r) => r.dueAt <= this.asked && r.id !== this.last)
    let target: string
    if (dueIdx >= 0) {
      target = this.retryQueue.splice(dueIdx, 1)[0].id
    } else {
      // Letters waiting for their retry come back on schedule, not at random.
      const waiting = new Set(this.retryQueue.map((r) => r.id))
      const fresh = this.pool.filter((id) => id !== this.last && !waiting.has(id))
      const choices = fresh.length ? fresh : this.pool.filter((id) => id !== this.last)
      target = weightedPick(choices, (id) => weightOf(this.progress, id), this.rng)
    }
    this.last = target
    // Start with 2 options; 3 once the letter is getting stable.
    const optionCount = itemOf(this.progress, target).box >= 2 ? 3 : 2
    const distractors = pickDistractors(this.progress, target, this.pool, optionCount - 1, this.rules, this.rng)
    return { target, options: shuffle([target, ...distractors], this.rng) }
  }

  /** Record the first answer to a question. Returns the updated progress. */
  answer(q: Question, chosen: string, at = new Date().toISOString()): Progress {
    const correct = chosen === q.target
    this.asked++
    if (correct) this.correctCount++
    else this.retryQueue.push({ id: q.target, dueAt: this.asked + 2 })
    this.progress = recordAttempt(this.progress, { target: q.target, chosen, correct, at })
    return this.progress
  }
}
