import { describe, expect, it } from 'vitest'
import type { AdminEvent, ChildRecord } from './api'
import { confusionsOf, dailyActivity, letterRows, recentRounds, relativeDay, summarize } from './stats'

const now = new Date(2026, 9, 30, 20, 0)
const at = (daysAgo: number, min = 0) => new Date(2026, 9, 30 - daysAgo, 17, min).toISOString()
let n = 0
const answer = (daysAgo: number, letter: string, chosen: string, round = `r${daysAgo}`): AdminEvent => ({
  id: `a${n++}`, kind: 'answer', at: at(daysAgo, n), letter, chosen, correct: letter === chosen, round_id: round, sticker: null,
})

const child = (events: AdminEvent[]): ChildRecord => ({
  id: 'c1', name: 'Lia', display_name: 'ליה', login_names: ['lia', 'ליה'], has_password: true, created_at: at(10), events,
})

const events: AdminEvent[] = [
  answer(2, 'g', 'g'), answer(2, 'e', 'g'), answer(2, 'e', 'g'),
  answer(1, 'e', 'e'), answer(1, 'g', 'e'), answer(1, 's', 's'),
  answer(0, 'e', 'g'), answer(0, 's', 's'), answer(0, 's', 's'), answer(0, 's', 's'),
  { id: 'seen-a', kind: 'letter_seen', at: at(3), letter: 'a', chosen: null, correct: null, round_id: null, sticker: null },
  { id: 'sticker-🦄', kind: 'sticker', at: at(2, 50), letter: null, chosen: null, correct: null, round_id: null, sticker: '🦄' },
]

describe('parent dashboard stats', () => {
  const s = summarize(child(events), now)

  it('sums up a child like the game does', () => {
    expect(s).toMatchObject({ name: 'ליה', answers: 10, right: 6, daysPlayed: 3, lettersSeen: 4, lettersMastered: 1 })
    expect(s.accuracy).toBeCloseTo(0.6)
    expect(s.streak).toMatchObject({ current: 3, playedToday: true })
    expect(s.xp).toBe(6 * 10 + 25 + 5) // stars, one sticker, one opened card
    expect(s.lastPlayed).toBe(events[9].at)
  })

  it('flags weak letters and the usual mix-ups', () => {
    const rows = Object.fromEntries(letterRows(s.save).map((r) => [r.id, r]))
    expect(rows.e).toMatchObject({ right: 1, wrong: 3, weak: true, mastered: false })
    expect(rows.s).toMatchObject({ right: 4, wrong: 0, weak: false, mastered: true })
    expect(rows.a).toMatchObject({ seen: true, accuracy: null, weak: false })
    expect(rows.t.seen).toBe(false)
    expect(confusionsOf(s.save)).toEqual([
      { target: 'e', chosen: 'g', count: 3 },
      { target: 'g', chosen: 'e', count: 1 },
    ])
  })

  it('lists rounds newest first and every day of the range', () => {
    expect(recentRounds(s.save).map((r) => [r.id, r.answers, r.right])).toEqual([['r0', 4, 3], ['r1', 3, 2], ['r2', 3, 1]])
    const days = dailyActivity(s.save, now, 14)
    expect(days).toHaveLength(14)
    expect(days.slice(-3).map((d) => d.answers)).toEqual([3, 3, 4])
    expect(days[0].answers).toBe(0)
  })

  it('handles a child who never played', () => {
    const empty = summarize(child([]), now)
    expect(empty).toMatchObject({ answers: 0, accuracy: null, lastPlayed: null, daysPlayed: 0, xp: 0 })
    expect(relativeDay(null, now)).toBe('עוד לא שיחק/ה')
    expect(relativeDay(at(0), now)).toBe('היום')
    expect(relativeDay(at(1), now)).toBe('אתמול')
    expect(relativeDay(at(5), now)).toBe('לפני 5 ימים')
  })
})
