import type { LetterId } from './letters'

export type Word = {
  /** The word, lower case: also its id, its letters and its clip (public/audio/words/<id>.mp3 if recorded, else Kokoro's en/word-<id>.mp3). */
  id: string
  /** The OpenMoji picture (hexcode); bundled as public/pictures/<id>.svg by scripts/get-pictures.mjs. */
  openmoji: string
}

/**
 * First words: short words built only from single letter sounds (CVC, plus ant and egg),
 * each with a clear OpenMoji picture. A word without a picture that reads at a glance is left out.
 *
 * To add a word: add it here with its OpenMoji hexcode (openmoji.org, pick the colour one), then
 *   node scripts/get-pictures.mjs                                     # the picture
 *   .cache/kokoro-venv/bin/python -I scripts/gen-audio.py --words     # its clip, keeps the others
 * and bump CACHE in public/sw.js. words.test.ts fails until both exist.
 * Digraph words (sh/ch/th) and theme packs will come as more lists like this one.
 */
export const WORDS: Word[] = [
  { id: 'cat', openmoji: '1F431' },
  { id: 'hat', openmoji: '1F3A9' },
  { id: 'cap', openmoji: '1F9E2' },
  { id: 'bat', openmoji: '1F987' },
  { id: 'rat', openmoji: '1F400' },
  { id: 'can', openmoji: '1F96B' },
  { id: 'fan', openmoji: '1FAAD' },
  { id: 'van', openmoji: '1F690' },
  { id: 'map', openmoji: '1F5FA' },
  { id: 'bag', openmoji: '1F45C' },
  { id: 'jam', openmoji: '1FAD9-200D-1F7E5' },
  { id: 'ant', openmoji: '1F41C' },
  { id: 'pen', openmoji: '1F58A' },
  { id: 'hen', openmoji: '1F414' },
  { id: 'bed', openmoji: '1F6CF' },
  { id: 'leg', openmoji: '1F9B5' },
  { id: 'web', openmoji: '1F578' },
  { id: 'egg', openmoji: '1F95A' },
  { id: 'pig', openmoji: '1F416' },
  { id: 'pin', openmoji: '1F4CC' },
  { id: 'dog', openmoji: '1F436' },
  { id: 'fox', openmoji: '1F98A' },
  { id: 'box', openmoji: '1F4E6' },
  { id: 'log', openmoji: '1FAB5' },
  { id: 'sun', openmoji: '2600' },
  { id: 'bus', openmoji: '1F68D' },
  { id: 'bug', openmoji: '1F41E' },
  { id: 'cup', openmoji: '1F964' },
  { id: 'tub', openmoji: '1F6C1' },
]

export const WORD_BY_ID = Object.fromEntries(WORDS.map((w) => [w.id, w])) as Record<string, Word>

/** Pictures too alike to offer side by side (both small creatures). */
export const NOT_TOGETHER: [string, string][] = [['ant', 'bug']]

export const lettersOf = (word: string) => [...word] as LetterId[]

export const pictureUrl = (id: string) => `${import.meta.env.BASE_URL}pictures/${id}.svg`

/** The words she can sound out: every letter in the sound game's pool. All of them, once she has all 26. */
export function wordPool(letterPool: string[]): string[] {
  const known = new Set(letterPool)
  const ok = WORDS.filter((w) => lettersOf(w.id).every((l) => known.has(l))).map((w) => w.id)
  return ok.length >= 6 ? ok : WORDS.map((w) => w.id)
}
