// The device's own save (localStorage) is the source of truth and works offline.
// When a backend is configured, sync.ts pushes what changes here to Supabase as events
// and merges events from other devices back in (journal.ts).

import { emptyProgress, type Attempt, type Progress } from '../engine/engine'

export type Saved = {
  version: 1
  stars: number
  stickers: string[]
  seenLetters: string[]
  progress: Progress
  events: GameEvent[]
}

/** A first-try answer in a game. `id` is unique per answer (synced as is); `round` groups a round's answers. */
export type GameEvent = Attempt & { game: 'sound'; id: string; round?: string }

const KEY = 'lia-english:v1'
export const MAX_EVENTS = 3000

export const freshSave = (): Saved => ({
  version: 1,
  stars: 0,
  stickers: [],
  seenLetters: [],
  progress: emptyProgress(),
  events: [],
})

export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return freshSave()
    const parsed = JSON.parse(raw) as Saved
    if (parsed.version !== 1) return freshSave()
    const s = { ...freshSave(), ...parsed }
    return { ...s, events: s.events.map((e) => (e.id ? e : { ...e, id: legacyId(e) })) }
  } catch {
    return freshSave()
  }
}

export function save(s: Saved) {
  const trimmed = s.events.length > MAX_EVENTS ? { ...s, events: s.events.slice(-MAX_EVENTS) } : s
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed))
  } catch {
    // Storage full or blocked (private mode): the game still works for this session.
  }
}

/** Saves from before events had ids: a stable id from the answer itself, the same on every load. */
export const legacyId = (e: Pick<Attempt, 'at' | 'target' | 'chosen'>) => `a-${e.at}-${e.target}-${e.chosen}`

export function newId(): string {
  // randomUUID needs iOS 15.4+; older tablets get the same from getRandomValues.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}
