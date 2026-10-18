// Game layer on top of the saved data: XP, levels, streaks and badges.
// Everything is derived from what is already stored (stars, stickers, seen letters,
// the events log, the engine's progress), so nothing new is saved and old saves just work.

import type { Progress } from './engine'

export type ProgressInput = {
  stars: number
  stickers: string[]
  seenLetters: string[]
  progress: Progress
  events: { at: string }[]
}

export const XP_PER_STAR = 10
export const XP_PER_STICKER = 25
export const XP_PER_LETTER = 5

export function xpOf(d: Pick<ProgressInput, 'stars' | 'stickers' | 'seenLetters'>): number {
  return d.stars * XP_PER_STAR + d.stickers.length * XP_PER_STICKER + d.seenLetters.length * XP_PER_LETTER
}

/** XP needed to go from `level` to `level + 1`: 100, 150, 200, ... */
export const levelStep = (level: number) => 100 + 50 * (level - 1)

export type LevelInfo = { level: number; into: number; need: number }

export function levelOf(xp: number): LevelInfo {
  let level = 1
  let left = Math.max(0, xp)
  while (left >= levelStep(level)) {
    left -= levelStep(level)
    level++
  }
  return { level, into: left, need: levelStep(level) }
}

/** Local calendar day, YYYY-MM-DD. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const prevDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d - 1))
}

export type Streak = { current: number; best: number; playedToday: boolean }

/** Days in a row with at least one game answer. The current streak survives until the end of tomorrow. */
export function streakOf(events: { at: string }[], now: Date): Streak {
  const days = new Set(events.map((e) => dayKey(new Date(e.at))))
  const today = dayKey(now)
  const playedToday = days.has(today)

  let current = 0
  for (let k = playedToday ? today : prevDay(today); days.has(k); k = prevDay(k)) current++

  let best = 0
  for (const k of days) {
    if (days.has(prevDay(k))) continue
    let run = 0
    for (let j = k; days.has(j); ) {
      run++
      const [y, m, d] = j.split('-').map(Number)
      j = dayKey(new Date(y, m - 1, d + 1))
    }
    best = Math.max(best, run)
  }
  return { current, best: Math.max(best, current), playedToday }
}

export type Badge = { id: string; icon: string; name: string; how: string; earned: boolean }

export function badgesOf(d: ProgressInput, totalLetters: number, now: Date): Badge[] {
  const box = (id: string) => d.progress.items[id]?.box ?? 1
  const streak = streakOf(d.events, now)
  return [
    { id: 'first-round', icon: '🚀', name: 'סיבוב ראשון', how: 'לסיים סיבוב במשחק', earned: d.stickers.length >= 1 },
    { id: 'explorer', icon: '🧭', name: 'חוקרת אותיות', how: 'לפתוח את כל כרטיסי האותיות', earned: d.seenLetters.length >= totalLetters },
    { id: 'eg-master', icon: '🎯', name: 'אלופת E/G', how: 'לזהות נכון את E ואת G כמה פעמים', earned: box('e') >= 3 && box('g') >= 3 },
    { id: 'stars-50', icon: '⭐', name: '50 כוכבים', how: 'לאסוף 50 כוכבים', earned: d.stars >= 50 },
    { id: 'streak-3', icon: '🔥', name: '3 ימים ברצף', how: 'לשחק 3 ימים ברצף', earned: streak.best >= 3 },
    { id: 'collector', icon: '💎', name: 'אספנית', how: 'לאסוף 5 פריטים', earned: d.stickers.length >= 5 },
  ]
}
