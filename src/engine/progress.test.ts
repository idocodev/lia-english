import { describe, expect, it } from 'vitest'
import { emptyProgress } from './engine'
import { badgesOf, levelOf, streakOf, xpOf } from './progress'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString()

describe('levels', () => {
  it('starts at level 1 and steps up 100, 150, 200', () => {
    expect(levelOf(0)).toEqual({ level: 1, into: 0, need: 100 })
    expect(levelOf(99).level).toBe(1)
    expect(levelOf(100)).toEqual({ level: 2, into: 0, need: 150 })
    expect(levelOf(250)).toEqual({ level: 3, into: 0, need: 200 })
  })
  it('derives XP from stars, stickers and seen letters', () => {
    expect(xpOf({ stars: 3, stickers: ['a'], seenLetters: ['s', 'a'] })).toBe(30 + 25 + 10)
  })
})

describe('streak', () => {
  const now = new Date(2026, 9, 18, 15)
  it('counts consecutive days ending today', () => {
    const s = streakOf([{ at: at(2026, 10, 16) }, { at: at(2026, 10, 17) }, { at: at(2026, 10, 18) }], now)
    expect(s).toEqual({ current: 3, best: 3, playedToday: true })
  })
  it('keeps yesterday\'s streak alive until she plays today', () => {
    const s = streakOf([{ at: at(2026, 10, 16) }, { at: at(2026, 10, 17) }], now)
    expect(s.current).toBe(2)
    expect(s.playedToday).toBe(false)
  })
  it('resets after a missed day but remembers the best', () => {
    const s = streakOf([{ at: at(2026, 10, 10) }, { at: at(2026, 10, 11) }, { at: at(2026, 10, 12) }, { at: at(2026, 10, 15) }], now)
    expect(s.current).toBe(0)
    expect(s.best).toBe(3)
  })
})

describe('badges', () => {
  it('earns E/G master only when both letters are solid', () => {
    const base = { stars: 0, stickers: [], seenLetters: [], events: [], progress: emptyProgress() }
    const eg = (box: number) => badgesOf({ ...base, progress: { confusions: {}, items: { e: { box, correct: 0, wrong: 0 }, g: { box: 3, correct: 0, wrong: 0 } } } }, 13, new Date()).find((b) => b.id === 'eg-master')!
    expect(eg(2).earned).toBe(false)
    expect(eg(3).earned).toBe(true)
  })
})
