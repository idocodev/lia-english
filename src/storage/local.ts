// The device's own save (localStorage) is the source of truth and works offline. It is the
// logged-in child's (a save from before accounts goes to the first login), and logout clears it.
// sync.ts pushes what changes here to Supabase as events
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

export const GAMES = ['sound', 'word-pick', 'word-build'] as const
export type GameId = (typeof GAMES)[number]

/**
 * A first-try answer in a game. `id` is unique per answer (synced as is); `round` groups a round's answers.
 * In the word games, target and chosen are words (in the cloud: letter = the word, chosen = the picked
 * word, or the word as her first wrong tile spelled it), and the round id starts with the game id.
 */
export type GameEvent = Attempt & { game: GameId; id: string; round?: string }

/** A round id for a word game says which game it was, for readers that only see the round (the dashboard). */
export const roundIdFor = (game: GameId) => (game === 'sound' ? newId() : `${game}:${newId()}`)

/** Which game an answer from the cloud came from: its own column, else its round id, else the sound game. */
export function gameOf(game: string | null | undefined, round?: string | null): GameId {
  if (GAMES.includes(game as GameId)) return game as GameId
  const prefix = round?.split(':')[0]
  return GAMES.includes(prefix as GameId) ? (prefix as GameId) : 'sound'
}

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

/** On logout: the device's save belonged to that child. */
export function clearSave() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Blocked storage: nothing was kept anyway.
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
