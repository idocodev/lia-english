import { describe, expect, it } from 'vitest'
import { LETTER_BY_ID } from './letters'
import { NOT_TOGETHER, WORDS, lettersOf, wordPool } from './words'
import CLIPS from '../audio/clips.gen.json'
import PICTURES from '../../public/pictures/manifest.json'

const pictures = new Set(Object.keys(import.meta.glob('../../public/pictures/*.svg')).map((p) => p.replace('../../public/', '')))

describe('words', () => {
  it('are unique, lower case and built only from letters she knows', () => {
    const ids = WORDS.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.filter((id) => !/^[a-z]{2,5}$/.test(id) || lettersOf(id).some((l) => !LETTER_BY_ID[l]))).toEqual([])
  })

  it('each have a bundled picture, precached for offline (node scripts/get-pictures.mjs)', () => {
    expect(WORDS.filter((w) => !pictures.has(`pictures/${w.id}.svg`)).map((w) => w.id)).toEqual([])
    expect(new Set(PICTURES)).toEqual(pictures)
  })

  it('each have a spoken clip (scripts/gen-audio.py --words)', () => {
    expect(WORDS.filter((w) => !(CLIPS as Record<string, string>)[w.id]).map((w) => w.id)).toEqual([])
  })

  it('keep apart only words that exist', () => {
    expect(NOT_TOGETHER.flat().filter((id) => !WORDS.some((w) => w.id === id))).toEqual([])
  })

  it('offer only words whose letters are all in the game, or all of them while there are too few', () => {
    expect(wordPool([...'satpinmdgocke'])).toEqual(['cat', 'cap', 'can', 'map', 'ant', 'pen', 'egg', 'pig', 'pin', 'dog'])
    expect(wordPool(['s', 'a', 't'])).toHaveLength(WORDS.length)
    expect(wordPool([...'abcdefghijklmnopqrstuvwxyz'])).toHaveLength(WORDS.length)
  })
})
