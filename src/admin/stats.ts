// What the parent dashboard shows about a child, worked out from their event log the same way
// the game works out its own screens (mergeRemote -> XP, level, streak, badges), so the numbers
// match what the child sees. Pure functions (stats.test.ts).

import { LETTERS } from '../content/letters'
import { badgesOf, dayKey, levelOf, streakOf, xpOf, type Badge, type LevelInfo, type Streak } from '../engine/progress'
import type { SyncEvent } from '../storage/journal'
import { mergeRemote } from '../storage/journal'
import { freshSave, type Saved } from '../storage/local'
import type { AdminEvent, ChildRecord } from './api'

export function toSyncEvent(r: AdminEvent): SyncEvent | null {
  const at = new Date(r.at).toISOString()
  if (r.kind === 'answer' && r.letter && r.chosen && r.correct !== null)
    return { kind: 'answer', id: r.id, at, game: 'sound', letter: r.letter, chosen: r.chosen, correct: r.correct, ...(r.round_id ? { round: r.round_id } : {}) }
  if (r.kind === 'letter_seen' && r.letter) return { kind: 'letter_seen', id: r.id, at, letter: r.letter }
  if (r.kind === 'sticker' && r.sticker) return { kind: 'sticker', id: r.id, at, sticker: r.sticker }
  return null
}

/** A letter counts as mastered from Leitner box 4 (several right in a row lately). */
export const MASTERED_BOX = 4
/** Weak: at least this many answers and under 70% right. */
const WEAK_MIN = 3
const WEAK_BELOW = 0.7

export type LetterRow = {
  id: string
  upper: string
  right: number
  wrong: number
  accuracy: number | null
  box: number
  seen: boolean
  mastered: boolean
  weak: boolean
}

export type Confusion = { target: string; chosen: string; count: number }
export type RoundRow = { id: string; at: string; answers: number; right: number }
export type DayRow = { day: string; answers: number; right: number }

export type ChildSummary = {
  id: string
  name: string
  loginNames: string[]
  hasPassword: boolean
  save: Saved
  answers: number
  right: number
  accuracy: number | null
  lastPlayed: string | null
  daysPlayed: number
  streak: Streak
  xp: number
  level: LevelInfo
  lettersSeen: number
  lettersMastered: number
  totalLetters: number
}

export function summarize(c: ChildRecord, now: Date): ChildSummary {
  const save = mergeRemote(freshSave(), c.events.map(toSyncEvent).filter((e): e is SyncEvent => !!e))
  const right = save.events.filter((e) => e.correct).length
  const last = c.events.reduce<string | null>((m, e) => (!m || e.at > m ? e.at : m), null)
  const xp = xpOf(save)
  return {
    id: c.id,
    name: c.display_name,
    loginNames: c.login_names,
    hasPassword: c.has_password,
    save,
    answers: save.events.length,
    right,
    accuracy: save.events.length ? right / save.events.length : null,
    lastPlayed: last && new Date(last).toISOString(),
    daysPlayed: new Set(save.events.map((e) => dayKey(new Date(e.at)))).size,
    streak: streakOf(save.events, now),
    xp,
    level: levelOf(xp),
    lettersSeen: LETTERS.filter((l) => save.seenLetters.includes(l.id) || save.progress.items[l.id]).length,
    lettersMastered: LETTERS.filter((l) => (save.progress.items[l.id]?.box ?? 0) >= MASTERED_BOX).length,
    totalLetters: LETTERS.length,
  }
}

export function letterRows(s: Saved): LetterRow[] {
  return LETTERS.map((l) => {
    const it = s.progress.items[l.id]
    const right = it?.correct ?? 0
    const wrong = it?.wrong ?? 0
    const n = right + wrong
    const accuracy = n ? right / n : null
    return {
      id: l.id,
      upper: l.upper,
      right,
      wrong,
      accuracy,
      box: it?.box ?? 0,
      seen: s.seenLetters.includes(l.id) || n > 0,
      mastered: (it?.box ?? 0) >= MASTERED_BOX,
      weak: n >= WEAK_MIN && accuracy !== null && accuracy < WEAK_BELOW,
    }
  })
}

/** Most frequent mix-ups: "target>chosen" = heard the target, picked the chosen. */
export function confusionsOf(s: Saved, max = 5): Confusion[] {
  return Object.entries(s.progress.confusions)
    .map(([k, count]) => {
      const [target, chosen] = k.split('>')
      return { target, chosen, count }
    })
    .sort((a, b) => b.count - a.count || a.target.localeCompare(b.target))
    .slice(0, max)
}

/** Newest rounds first. Answers without a round (old saves) are left out. */
export function recentRounds(s: Saved, max = 8): RoundRow[] {
  const by = new Map<string, RoundRow>()
  for (const e of s.events) {
    if (!e.round) continue
    const r = by.get(e.round) ?? { id: e.round, at: e.at, answers: 0, right: 0 }
    r.answers++
    if (e.correct) r.right++
    if (e.at < r.at) r.at = e.at
    by.set(e.round, r)
  }
  return [...by.values()].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, max)
}

/** One row per local day for the last `days` days, oldest first, including days with no play. */
export function dailyActivity(s: Saved, now: Date, days = 30): DayRow[] {
  const rows: DayRow[] = []
  const index = new Map<string, DayRow>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const row = { day: dayKey(d), answers: 0, right: 0 }
    rows.push(row)
    index.set(row.day, row)
  }
  for (const e of s.events) {
    const row = index.get(dayKey(new Date(e.at)))
    if (!row) continue
    row.answers++
    if (e.correct) row.right++
  }
  return rows
}

export const badges = (s: Saved, now: Date): Badge[] => badgesOf(s, LETTERS.length, now)

/** "היום", "אתמול", "לפני 3 ימים", or a date. */
export function relativeDay(iso: string | null, now: Date): string {
  if (!iso) return 'עוד לא שיחק/ה'
  const a = new Date(iso)
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 86400000)
  if (days <= 0) return 'היום'
  if (days === 1) return 'אתמול'
  if (days < 14) return `לפני ${days} ימים`
  return a.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' })
}

export const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)
