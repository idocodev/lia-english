export type LetterId =
  | 's' | 'a' | 't' | 'p' | 'i' | 'n' | 'm' | 'd' | 'g' | 'o' | 'c' | 'k' | 'e'
  | 'h' | 'r' | 'u' | 'l' | 'f' | 'b' | 'j' | 'z' | 'w' | 'v' | 'y' | 'x' | 'q'

export type Letter = {
  id: LetterId
  upper: string
  lower: string
  /** The letter's NAME, as Lia already knows it (Hebrew transliteration). */
  nameHe: string
  /** The letter's SOUND in phonics notation. */
  sound: string
  /** A Hebrew hint for the sound, so name and sound are clearly separated. */
  soundHe: string
  /**
   * What the speech engine says to approximate the pure sound.
   * Only used until a recording exists (see audio/).
   */
  ttsSound: string
  keyword: { word: string; emoji: string }
  /** Optional recorded audio under public/audio/. When set, it wins over TTS. */
  audio?: { sound?: string; phrase?: string }
}

/**
 * All 26, in phonics teaching order (spec §2, the Jolly Phonics/SATPIN tradition).
 * The first set (s..k, plus `e` for E/G practice) is always in the sound game; a later
 * letter joins the game once she has opened its card (see gamePool).
 * x is taught as /ks/ (fox), q as "qu" /kw/ (queen), y as the consonant /y/ (yes).
 */
export const LETTERS: Letter[] = [
  { id: 's', upper: 'S', lower: 's', nameHe: 'אֵס', sound: '/s/', soundHe: 'סְ', ttsSound: 'sss', keyword: { word: 'sun', emoji: '☀️' } },
  { id: 'a', upper: 'A', lower: 'a', nameHe: 'אֵיי', sound: '/a/', soundHe: 'אַ', ttsSound: 'ah', keyword: { word: 'apple', emoji: '🍎' }, audio: { sound: 'a.mp3' } },
  { id: 't', upper: 'T', lower: 't', nameHe: 'טִי', sound: '/t/', soundHe: 'טְ', ttsSound: 'tuh', keyword: { word: 'tiger', emoji: '🐯' } },
  { id: 'p', upper: 'P', lower: 'p', nameHe: 'פִּי', sound: '/p/', soundHe: 'פְּ', ttsSound: 'puh', keyword: { word: 'pig', emoji: '🐷' } },
  { id: 'i', upper: 'I', lower: 'i', nameHe: 'אַיי', sound: '/i/', soundHe: 'אִ', ttsSound: 'ih', keyword: { word: 'insect', emoji: '🐞' } },
  { id: 'n', upper: 'N', lower: 'n', nameHe: 'אֵן', sound: '/n/', soundHe: 'נְ', ttsSound: 'nnn', keyword: { word: 'nose', emoji: '👃' } },
  { id: 'm', upper: 'M', lower: 'm', nameHe: 'אֵם', sound: '/m/', soundHe: 'מְ', ttsSound: 'mmm', keyword: { word: 'mouse', emoji: '🐭' }, audio: { sound: 'm.mp3' } },
  { id: 'd', upper: 'D', lower: 'd', nameHe: 'דִּי', sound: '/d/', soundHe: 'דְּ', ttsSound: 'duh', keyword: { word: 'dog', emoji: '🐶' } },
  { id: 'g', upper: 'G', lower: 'g', nameHe: 'גִ׳י', sound: '/g/', soundHe: 'גְּ', ttsSound: 'guh', keyword: { word: 'goat', emoji: '🐐' } },
  { id: 'o', upper: 'O', lower: 'o', nameHe: 'אוֹ', sound: '/o/', soundHe: 'אָ', ttsSound: 'aw', keyword: { word: 'octopus', emoji: '🐙' } },
  { id: 'c', upper: 'C', lower: 'c', nameHe: 'סִי', sound: '/k/', soundHe: 'קְ', ttsSound: 'kuh', keyword: { word: 'cat', emoji: '🐱' } },
  { id: 'k', upper: 'K', lower: 'k', nameHe: 'קֵיי', sound: '/k/', soundHe: 'קְ', ttsSound: 'kuh', keyword: { word: 'koala', emoji: '🐨' } },
  { id: 'e', upper: 'E', lower: 'e', nameHe: 'אִי', sound: '/e/', soundHe: 'אֶ', ttsSound: 'eh', keyword: { word: 'elephant', emoji: '🐘' } },
  { id: 'h', upper: 'H', lower: 'h', nameHe: 'אֵייץ׳', sound: '/h/', soundHe: 'הְ', ttsSound: 'hh', keyword: { word: 'hat', emoji: '🎩' } },
  { id: 'r', upper: 'R', lower: 'r', nameHe: 'אַר', sound: '/r/', soundHe: 'רְ', ttsSound: 'rrr', keyword: { word: 'robot', emoji: '🤖' } },
  { id: 'u', upper: 'U', lower: 'u', nameHe: 'יוּ', sound: '/u/', soundHe: 'אַ', ttsSound: 'uh', keyword: { word: 'umbrella', emoji: '☂️' } },
  { id: 'l', upper: 'L', lower: 'l', nameHe: 'אֵל', sound: '/l/', soundHe: 'לְ', ttsSound: 'lll', keyword: { word: 'lion', emoji: '🦁' } },
  { id: 'f', upper: 'F', lower: 'f', nameHe: 'אֵף', sound: '/f/', soundHe: 'פְ', ttsSound: 'fff', keyword: { word: 'fish', emoji: '🐟' } },
  { id: 'b', upper: 'B', lower: 'b', nameHe: 'בִּי', sound: '/b/', soundHe: 'בְּ', ttsSound: 'buh', keyword: { word: 'bus', emoji: '🚌' } },
  { id: 'j', upper: 'J', lower: 'j', nameHe: 'גֵ׳יי', sound: '/j/', soundHe: 'גְ׳', ttsSound: 'juh', keyword: { word: 'juice', emoji: '🧃' } },
  { id: 'z', upper: 'Z', lower: 'z', nameHe: 'זֵד', sound: '/z/', soundHe: 'זְ', ttsSound: 'zzz', keyword: { word: 'zebra', emoji: '🦓' } },
  { id: 'w', upper: 'W', lower: 'w', nameHe: 'דַאבֶּל יוּ', sound: '/w/', soundHe: 'ו׳', ttsSound: 'wuh', keyword: { word: 'wolf', emoji: '🐺' } },
  { id: 'v', upper: 'V', lower: 'v', nameHe: 'וִי', sound: '/v/', soundHe: 'וְ', ttsSound: 'vvv', keyword: { word: 'volcano', emoji: '🌋' } },
  { id: 'y', upper: 'Y', lower: 'y', nameHe: 'וַואי', sound: '/y/', soundHe: 'יְ', ttsSound: 'yuh', keyword: { word: 'yes', emoji: '👍' } },
  { id: 'x', upper: 'X', lower: 'x', nameHe: 'אֵקְס', sound: '/ks/', soundHe: 'קְס', ttsSound: 'ks', keyword: { word: 'fox', emoji: '🦊' } },
  { id: 'q', upper: 'Q', lower: 'q', nameHe: 'קְיוּ', sound: '/kw/', soundHe: 'קְו׳', ttsSound: 'kw', keyword: { word: 'queen', emoji: '👸' } },
]

export const LETTER_BY_ID = Object.fromEntries(LETTERS.map((l) => [l.id, l])) as Record<LetterId, Letter>

/**
 * Pairs Lia is known (or likely) to confuse: offered together first in the sound game.
 * e/g and g/j by their names, b/d and p/q by shape, v/w and u/a by ear (Hebrew has neither pair).
 */
export const CONFUSION_PAIRS: [string, string][] = [
  ['e', 'g'],
  ['b', 'd'],
  ['p', 'q'],
  ['v', 'w'],
  ['u', 'a'],
  ['g', 'j'],
]

/** Letters that make the same sound can't be told apart by ear: never offer them together. */
export const SAME_SOUND: [string, string][] = [['c', 'k']]

/** Always in the sound game; the letters after it join as their cards are opened. */
export const FIRST_SET = LETTERS.slice(0, LETTERS.findIndex((l) => l.id === 'e') + 1).map((l) => l.id)

/** The letters the sound game asks about: the first set plus every later letter she has met. */
export function gamePool(seenLetters: string[]): LetterId[] {
  return LETTERS.filter((l) => FIRST_SET.includes(l.id) || seenLetters.includes(l.id)).map((l) => l.id)
}
