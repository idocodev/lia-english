// The word games' choices: which pictures to offer, which letter tiles to lay out.
// Pure functions (words.test.ts).

import { CONFUSION_PAIRS, SAME_SOUND } from '../content/letters'
import { NOT_TOGETHER, lettersOf } from '../content/words'
import { shuffle, type Progress, type Rng } from './engine'

const VOWELS = ['a', 'e', 'i', 'o', 'u']

/** How many sounds two words differ by, position for position (Infinity if their lengths differ). */
export function soundsApart(a: string, b: string): number {
  if (a.length !== b.length) return Infinity
  return [...a].filter((ch, i) => ch !== b[i]).length
}

const together = (a: string, b: string) => !NOT_TOGETHER.some(([x, y]) => (x === a && y === b) || (x === b && y === a))

/**
 * Pictures for "listen & pick": the target and `count - 1` others. Words one sound away
 * (cat/hat/cap) come first, then words she has mixed it up with, then any.
 */
export function pickPictures(p: Progress, target: string, pool: string[], count: number, rng: Rng): string[] {
  const candidates = shuffle(
    pool.filter((w) => w !== target && together(w, target)),
    rng,
  )
  const score = (w: string) => {
    const near = soundsApart(target, w) === 1 ? 10 : soundsApart(target, w) === 2 ? 2 : 0
    const mixed = (p.confusions[`${target}>${w}`] ?? 0) + (p.confusions[`${w}>${target}`] ?? 0)
    return near + mixed * 3
  }
  // Stable sort: ties keep their shuffled order, so the same near words don't always come.
  const others = candidates.sort((a, b) => score(b) - score(a)).slice(0, count - 1)
  return shuffle([target, ...others], rng)
}

/**
 * Letter tiles for "build the word": its letters plus `extra` that don't belong.
 * One is another short vowel (the hard part for a Hebrew speaker), the other a letter
 * she confuses with one of the word's (b/d, v/w...), else any consonant.
 * Never a letter that sounds like one in the word (c/k), which she couldn't tell apart by ear.
 */
export function buildTiles(word: string, extra: number, rng: Rng): string[] {
  const letters = lettersOf(word)
  const banned = new Set<string>(letters)
  for (const [a, b] of SAME_SOUND) {
    if (banned.has(a)) banned.add(b)
    if (banned.has(b)) banned.add(a)
  }
  const free = (l: string) => !banned.has(l)
  const vowels = shuffle(VOWELS.filter(free), rng)
  const partners = shuffle(
    CONFUSION_PAIRS.flatMap(([a, b]) => (letters.includes(a as never) ? [b] : letters.includes(b as never) ? [a] : [])).filter(free),
    rng,
  )
  const consonants = shuffle([...'bdfghjlmnprstvwz'].filter(free), rng)
  const picks: string[] = []
  for (const l of [vowels[0], ...partners, ...consonants]) {
    if (picks.length >= extra) break
    if (l && !picks.includes(l)) picks.push(l)
  }
  return shuffle([...letters, ...picks], rng)
}

/** Distractor count: one while a word is new, two once she has it right. */
export const extraTiles = (p: Progress, word: string) => ((p.items[word]?.box ?? 1) >= 2 ? 2 : 1)

/** The word as her first wrong tile would have spelled it ("cot" for an o in cat), for the log. */
export const misspelled = (word: string, slot: number, letter: string) => word.slice(0, slot) + letter + word.slice(slot + 1)
