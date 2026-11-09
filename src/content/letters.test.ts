import { describe, expect, it } from 'vitest'
import { CONFUSION_PAIRS, FIRST_SET, LETTERS, SAME_SOUND, gamePool } from './letters'

describe('letters', () => {
  it('cover the whole alphabet once', () => {
    expect(LETTERS.map((l) => l.id).sort().join('')).toBe('abcdefghijklmnopqrstuvwxyz')
  })

  it('pair only letters that exist', () => {
    const ids = new Set(LETTERS.map((l) => l.id))
    expect([...CONFUSION_PAIRS, ...SAME_SOUND].flat().filter((id) => !ids.has(id as never))).toEqual([])
  })

  it('start the game with the first set and add later letters as their cards are opened', () => {
    expect(FIRST_SET.join('')).toBe('satpinmdgocke')
    expect(gamePool([])).toEqual(FIRST_SET)
    expect(gamePool(['s', 'r', 'h'])).toEqual([...FIRST_SET, 'h', 'r'])
  })
})
