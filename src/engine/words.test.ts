import { describe, expect, it } from 'vitest'
import { emptyProgress, recordAttempt, Round } from './engine'
import { buildTiles, extraTiles, misspelled, pickPictures, soundsApart } from './words'

// Deterministic "random": a fixed sequence.
const seq = (...xs: number[]) => {
  let i = 0
  return () => xs[i++ % xs.length]
}

describe('word games', () => {
  it('count how many sounds apart two words are', () => {
    expect(soundsApart('cat', 'hat')).toBe(1)
    expect(soundsApart('cat', 'cap')).toBe(1)
    expect(soundsApart('cat', 'dog')).toBe(3)
    expect(soundsApart('cat', 'ants')).toBe(Infinity)
  })

  it('offer pictures one sound away first', () => {
    const pool = ['cat', 'hat', 'dog', 'sun', 'cap', 'bus', 'pig']
    for (let i = 0; i < 20; i++) {
      const opts = pickPictures(emptyProgress(), 'cat', pool, 3, Math.random)
      expect(opts).toHaveLength(3)
      expect(opts).toContain('cat')
      expect(opts.filter((w) => w !== 'cat').sort()).toEqual(['cap', 'hat'])
    }
  })

  it('offer a word she mixed it up with', () => {
    const p = recordAttempt(emptyProgress(), { target: 'sun', chosen: 'bus', correct: false, at: 'x' })
    const opts = pickPictures(p, 'sun', ['sun', 'bus', 'dog', 'pig', 'fox'], 3, Math.random)
    expect(opts).toContain('bus')
  })

  it('never put ant and bug side by side', () => {
    for (let i = 0; i < 30; i++) expect(pickPictures(emptyProgress(), 'ant', ['ant', 'bug', 'dog'], 3, Math.random)).not.toContain('bug')
  })

  it('lay out the word letters plus extras that are not in it and do not sound like them', () => {
    for (let i = 0; i < 50; i++) {
      const tiles = buildTiles('cat', 2, Math.random)
      expect(tiles).toHaveLength(5)
      for (const l of 'cat') expect(tiles).toContain(l)
      const extra = tiles.filter((l) => !'cat'.includes(l))
      expect(extra).toHaveLength(2)
      expect(extra).not.toContain('k') // sounds like c
      expect(extra.some((l) => 'eiou'.includes(l))).toBe(true) // another short vowel
    }
    // A double letter keeps both tiles.
    expect(buildTiles('egg', 1, seq(0.3, 0.6)).filter((l) => l === 'g')).toHaveLength(2)
  })

  it('add a second extra tile once the word is known', () => {
    const p = recordAttempt(emptyProgress(), { target: 'cat', chosen: 'cat', correct: true, at: 'x' })
    expect(extraTiles(emptyProgress(), 'cat')).toBe(1)
    expect(extraTiles(p, 'cat')).toBe(2)
  })

  it('spell her first wrong tile into the word for the log', () => {
    expect(misspelled('cat', 1, 'o')).toBe('cot')
    expect(misspelled('bed', 0, 'd')).toBe('ded')
  })

  it('bring a missed word back later in the round (Leitner, as with letters)', () => {
    const r = new Round(emptyProgress(), ['cat', 'dog', 'sun', 'pig', 'hat'], { confusionPairs: [], sameSound: [] }, Math.random, 6, (t) => [t])
    const q = r.next()
    expect(q.options).toEqual([q.target])
    r.answer(q, 'cot')
    expect(r.progress.items[q.target].box).toBe(1)
    expect(r.progress.confusions[`${q.target}>cot`]).toBe(1)
    const later: string[] = []
    for (let i = 0; i < 3; i++) {
      const x = r.next()
      r.answer(x, x.target)
      later.push(x.target)
    }
    expect(later).toContain(q.target)
  })
})
