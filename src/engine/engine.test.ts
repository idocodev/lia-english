import { describe, expect, it } from 'vitest'
import { emptyProgress, pickDistractors, recordAttempt, Round, weightOf } from './engine'

const rules = { confusionPairs: [['e', 'g']] as [string, string][], sameSound: [['c', 'k']] as [string, string][] }
const pool = ['s', 'a', 't', 'g', 'e', 'c', 'k']

// Deterministic RNG.
const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

describe('recordAttempt', () => {
  it('moves up a box when correct and back to box 1 when wrong', () => {
    let p = recordAttempt(emptyProgress(), { target: 'g', chosen: 'g', correct: true, at: 't' })
    p = recordAttempt(p, { target: 'g', chosen: 'g', correct: true, at: 't' })
    expect(p.items.g.box).toBe(3)
    p = recordAttempt(p, { target: 'g', chosen: 'e', correct: false, at: 't' })
    expect(p.items.g.box).toBe(1)
    expect(p.confusions['g>e']).toBe(1)
  })

  it('weighs missed letters more', () => {
    let p = emptyProgress()
    for (let i = 0; i < 3; i++) p = recordAttempt(p, { target: 's', chosen: 's', correct: true, at: 't' })
    p = recordAttempt(p, { target: 'g', chosen: 'e', correct: false, at: 't' })
    expect(weightOf(p, 'g')).toBeGreaterThan(weightOf(p, 's'))
  })
})

describe('pickDistractors', () => {
  it('offers the confusion pair first', () => {
    const d = pickDistractors(emptyProgress(), 'g', pool, 1, rules, seeded())
    expect(d).toEqual(['e'])
  })

  it('never offers letters with the same sound together', () => {
    for (let s = 1; s < 50; s++) {
      const d = pickDistractors(emptyProgress(), 'c', pool, 2, rules, seeded(s))
      expect(d).not.toContain('k')
      expect(d).not.toContain('c')
    }
  })

  it('prefers letters she actually mixed up', () => {
    const p = recordAttempt(emptyProgress(), { target: 's', chosen: 't', correct: false, at: 'x' })
    expect(pickDistractors(p, 's', pool, 1, rules, seeded())).toEqual(['t'])
  })
})

describe('Round', () => {
  it('runs the set number of questions without immediate repeats', () => {
    const r = new Round(emptyProgress(), pool, rules, seeded(7), 10)
    let prev = ''
    while (!r.done) {
      const q = r.next()
      expect(q.target).not.toBe(prev)
      expect(q.options).toContain(q.target)
      expect(new Set(q.options).size).toBe(q.options.length)
      prev = q.target
      r.answer(q, q.target)
    }
    expect(r.correctCount).toBe(10)
  })

  it('brings a missed letter back two questions later', () => {
    const r = new Round(emptyProgress(), pool, rules, seeded(3), 10)
    const q = r.next()
    r.answer(q, q.options.find((o) => o !== q.target)!)
    const a = r.next()
    r.answer(a, a.target)
    const b = r.next()
    r.answer(b, b.target)
    expect(r.next().target).toBe(q.target)
  })
})
