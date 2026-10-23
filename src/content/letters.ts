export type LetterId = 's' | 'a' | 't' | 'p' | 'i' | 'n' | 'm' | 'd' | 'g' | 'o' | 'c' | 'k' | 'e'

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

/** First set, in phonics teaching order (spec §2). `e` is included for E/G practice. */
export const LETTERS: Letter[] = [
  { id: 's', upper: 'S', lower: 's', nameHe: 'אֵס', sound: '/s/', soundHe: 'סְ', ttsSound: 'sss', keyword: { word: 'sun', emoji: '☀️' } },
  { id: 'a', upper: 'A', lower: 'a', nameHe: 'אֵיי', sound: '/a/', soundHe: 'אַ', ttsSound: 'ah', keyword: { word: 'apple', emoji: '🍎' } },
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
]

export const LETTER_BY_ID = Object.fromEntries(LETTERS.map((l) => [l.id, l])) as Record<LetterId, Letter>

/**
 * Pairs Lia is known (or likely) to confuse. Pairs whose letters are not both in
 * the set yet (b/d, p/q) are kept so they activate as soon as the letters are added.
 */
export const CONFUSION_PAIRS: [string, string][] = [
  ['e', 'g'],
  ['b', 'd'],
  ['p', 'q'],
]

/** Letters that make the same sound can't be told apart by ear: never offer them together. */
export const SAME_SOUND: [string, string][] = [['c', 'k']]
