import { describe, expect, it } from 'vitest'
import { emptyProgress, recordAttempt } from '../engine/engine'
import { addToOutbox, eventsBetween, mergeRemote, removeFromOutbox, type SyncEvent } from './journal'
import { freshSave, gameOf, legacyId, roundIdFor, type GameEvent, type Saved } from './local'

const NOW = '2026-10-30T10:00:00.000Z'
const answer = (id: string, at: string, target: string, chosen = target, round = 'r1'): GameEvent => ({
  id,
  round,
  game: 'sound',
  target,
  chosen,
  correct: target === chosen,
  at,
})

/** A save as the game builds it: stars and boxes follow the answers. */
function played(events: GameEvent[], extra: Partial<Saved> = {}): Saved {
  return {
    ...freshSave(),
    stars: events.filter((e) => e.correct).length,
    progress: events.reduce(recordAttempt, emptyProgress()),
    events,
    ...extra,
  }
}

const A1 = answer('a1', '2026-10-29T09:00:00.000Z', 'g')
const A2 = answer('a2', '2026-10-29T09:00:05.000Z', 'e', 'g')
const B1 = answer('b1', '2026-10-30T08:00:00.000Z', 'g')
const B2 = answer('b2', '2026-10-30T08:00:04.000Z', 'e')

describe('eventsBetween', () => {
  it('turns new answers, opened cards and stickers into events', () => {
    const prev = played([A1], { seenLetters: ['s'], stickers: ['🦄'] })
    const next = played([A1, A2], { seenLetters: ['s', 'a'], stickers: ['🦄', '🌈'] })
    expect(eventsBetween(prev, next, NOW)).toEqual([
      { kind: 'answer', id: 'a2', at: A2.at, game: 'sound', letter: 'e', chosen: 'g', correct: false, round: 'r1' },
      { kind: 'letter_seen', id: 'seen-a', at: NOW, letter: 'a' },
      { kind: 'sticker', id: 'sticker-🌈', at: NOW, sticker: '🌈' },
    ])
  })
  it('is empty when nothing changed', () => {
    const s = played([A1])
    expect(eventsBetween(s, s, NOW)).toEqual([])
    expect(eventsBetween(s, { ...s, stars: s.stars }, NOW)).toEqual([])
  })
})

const toEvents = (s: Saved) => eventsBetween(freshSave(), s, NOW)

describe('mergeRemote', () => {
  it('rebuilds the whole save on a fresh device', () => {
    const original = played([A1, A2, B1, B2], { seenLetters: ['g', 'e'], stickers: ['🦄', '🌈'] })
    const merged = mergeRemote(freshSave(), toEvents(original))
    expect(merged.stars).toBe(original.stars)
    expect(merged.progress).toEqual(original.progress)
    expect(merged.events).toEqual(original.events)
    expect(merged.seenLetters).toEqual(['g', 'e'])
    expect(merged.stickers).toEqual(['🦄', '🌈'])
  })

  it('combines two devices that played apart, in time order, without duplicates', () => {
    const here = played([A1, B2], { stickers: ['🦄'] })
    const cloud = toEvents(played([A2, B1, A1], { stickers: ['🦄', '🐱'] }))
    const merged = mergeRemote(here, cloud)
    expect(merged.events.map((e) => e.id)).toEqual(['a1', 'a2', 'b1', 'b2'])
    expect(merged.stars).toBe(3)
    expect(merged.progress).toEqual(played([A1, A2, B1, B2]).progress)
    expect(merged.stickers).toEqual(['🦄', '🐱'])
  })

  it('is idempotent: merging the same events again changes nothing', () => {
    const cloud = toEvents(played([A1, A2], { seenLetters: ['g'] }))
    const once = mergeRemote(played([B1]), cloud)
    expect(mergeRemote(once, cloud)).toBe(once)
    expect(mergeRemote(once, [...cloud, ...cloud])).toBe(once)
  })

  it('keeps the same save when the cloud has nothing new', () => {
    const s = played([A1, A2], { seenLetters: ['g'] })
    expect(mergeRemote(s, toEvents(s))).toBe(s)
    expect(mergeRemote(s, [])).toBe(s)
  })

  it('matches answers saved before ids existed', () => {
    const old = { game: 'sound' as const, target: 'g', chosen: 'g', correct: true, at: A1.at }
    const here = played([{ ...old, id: legacyId(old) }])
    const cloud = toEvents(here)
    expect(mergeRemote(here, cloud)).toBe(here)
  })
})

describe('outbox', () => {
  const e = (id: string): SyncEvent => ({ kind: 'letter_seen', id, at: NOW, letter: id })
  it('adds each event once and removes what was sent', () => {
    let box = addToOutbox([], [e('1'), e('2')])
    box = addToOutbox(box, [e('2'), e('3'), e('3')])
    expect(box.map((x) => x.id)).toEqual(['1', '2', '3'])
    expect(addToOutbox(box, [e('1')])).toBe(box)
    expect(removeFromOutbox(box, [e('1'), e('3')]).map((x) => x.id)).toEqual(['2'])
  })
})

describe('word game answers', () => {
  it('round-trip through the cloud with their game, the word in letter and chosen', () => {
    const round = roundIdFor('word-build')
    const e: GameEvent = { id: 'w1', round, game: 'word-build', target: 'cat', chosen: 'cot', correct: false, at: '2026-11-13T10:00:00.000Z' }
    const next = { ...freshSave(), events: [e], progress: recordAttempt(emptyProgress(), e) }
    const [sent] = eventsBetween(freshSave(), next, e.at)
    expect(sent).toMatchObject({ kind: 'answer', game: 'word-build', letter: 'cat', chosen: 'cot', correct: false })
    const merged = mergeRemote(freshSave(), [sent])
    expect(merged.events[0]).toMatchObject({ game: 'word-build', target: 'cat', chosen: 'cot' })
    expect(merged.progress.confusions['cat>cot']).toBe(1)
  })

  it('know their game from the column, else from the round id (the dashboard sees only that)', () => {
    expect(gameOf('word-pick', null)).toBe('word-pick')
    expect(gameOf(null, roundIdFor('word-build'))).toBe('word-build')
    expect(gameOf(null, 'a1b2c3')).toBe('sound')
    expect(gameOf(null, null)).toBe('sound')
    expect(gameOf('chess', null)).toBe('sound')
  })
})
