// The save as an append-only log of events, for the cloud copy: pure functions, no storage
// and no network (unit-tested in journal.test.ts).
//
// Every event has an id made once, so sending it twice or merging it twice changes nothing:
// answers carry their own id, a sticker or an opened letter card is keyed by what it is.

import { emptyProgress, recordAttempt } from '../engine/engine'
import { MAX_EVENTS, type GameEvent, type Saved } from './local'

export type SyncEvent =
  | { kind: 'answer'; id: string; at: string; game: 'sound'; letter: string; chosen: string; correct: boolean; round?: string }
  | { kind: 'letter_seen'; id: string; at: string; letter: string }
  | { kind: 'sticker'; id: string; at: string; sticker: string }

const answerOf = (e: GameEvent): SyncEvent => ({
  kind: 'answer',
  id: e.id,
  at: e.at,
  game: e.game,
  letter: e.target,
  chosen: e.chosen,
  correct: e.correct,
  ...(e.round ? { round: e.round } : {}),
})

const gameEventOf = (e: Extract<SyncEvent, { kind: 'answer' }>): GameEvent => ({
  id: e.id,
  game: e.game,
  target: e.letter,
  chosen: e.chosen,
  correct: e.correct,
  at: e.at,
  ...(e.round ? { round: e.round } : {}),
})

const seenOf = (letter: string, at: string): SyncEvent => ({ kind: 'letter_seen', id: `seen-${letter}`, at, letter })
const stickerOf = (sticker: string, at: string): SyncEvent => ({ kind: 'sticker', id: `sticker-${sticker}`, at, sticker })

/** What `next` added over `prev`, as events to send. Stickers and cards have no time of their own: `now`. */
export function eventsBetween(prev: Saved, next: Saved, now: string): SyncEvent[] {
  if (prev === next) return []
  const answers = new Set(prev.events.map((e) => e.id))
  // A millisecond apart, so another device lists them in the same order.
  const t = Date.parse(now)
  const at = (i: number) => new Date(t + i).toISOString()
  return [
    ...next.events.filter((e) => !answers.has(e.id)).map(answerOf),
    ...next.seenLetters.filter((l) => !prev.seenLetters.includes(l)).map((l, i) => seenOf(l, at(i))),
    ...next.stickers.filter((s) => !prev.stickers.includes(s)).map((s, i) => stickerOf(s, at(i))),
  ]
}

const byTime = <T extends { at: string; id: string }>(a: T, b: T) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1)

/**
 * Brings events from the cloud (other devices, or this one's earlier life) into the save.
 * Returns `s` itself when nothing is new. Stars, the adaptive boxes, stickers and opened
 * cards all follow from the merged events; XP, levels, streak and badges follow from those.
 */
export function mergeRemote(s: Saved, remote: SyncEvent[]): Saved {
  const have = new Set(s.events.map((e) => e.id))
  // A full local log was trimmed to its newest MAX_EVENTS: older answers are already counted in it.
  const oldest = s.events.length >= MAX_EVENTS ? s.events.reduce((m, e) => (e.at < m ? e.at : m), s.events[0].at) : ''
  const answers = remote
    .filter((e): e is Extract<SyncEvent, { kind: 'answer' }> => e.kind === 'answer')
    .filter((e) => !have.has(e.id) && e.at >= oldest)
  const sorted = [...remote].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  const stickers = [...new Set([...s.stickers, ...sorted.flatMap((e) => (e.kind === 'sticker' ? [e.sticker] : []))])]
  const seenLetters = [...new Set([...s.seenLetters, ...sorted.flatMap((e) => (e.kind === 'letter_seen' ? [e.letter] : []))])]

  if (!answers.length && stickers.length === s.stickers.length && seenLetters.length === s.seenLetters.length) return s
  if (!answers.length) return { ...s, stickers, seenLetters }

  // Replay everything in time order: exact while the log is whole, and a close
  // approximation (new answers on top of the trimmed log) once it is full.
  const events = [...s.events, ...answers.map(gameEventOf)].sort(byTime)
  const progress = s.events.length < MAX_EVENTS ? events.reduce(recordAttempt, emptyProgress()) : [...answers].sort(byTime).map(gameEventOf).reduce(recordAttempt, s.progress)
  return {
    ...s,
    stars: s.stars + answers.filter((e) => e.correct).length,
    stickers,
    seenLetters,
    progress,
    events,
  }
}

// Outbox: events waiting to be sent, kept on the device until the cloud has them.

export function addToOutbox(outbox: SyncEvent[], events: SyncEvent[]): SyncEvent[] {
  if (!events.length) return outbox
  const ids = new Set(outbox.map((e) => e.id))
  const fresh = events.filter((e) => !ids.has(e.id) && (ids.add(e.id), true))
  return fresh.length ? [...outbox, ...fresh] : outbox
}

export function removeFromOutbox(outbox: SyncEvent[], sent: SyncEvent[]): SyncEvent[] {
  const ids = new Set(sent.map((e) => e.id))
  return outbox.filter((e) => !ids.has(e.id))
}
