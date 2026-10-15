// All progress lives on the device for now (localStorage). Phase 2 can sync the
// append-only `events` log to a backend and recompute everything from it.

import { emptyProgress, type Attempt, type Progress } from '../engine/engine'

export type Saved = {
  version: 1
  stars: number
  stickers: string[]
  seenLetters: string[]
  progress: Progress
  events: (Attempt & { game: 'sound' })[]
}

const KEY = 'lia-english:v1'
const MAX_EVENTS = 3000

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
    return parsed.version === 1 ? { ...freshSave(), ...parsed } : freshSave()
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
