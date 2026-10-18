import { describe, expect, it } from 'vitest'
import { LETTERS } from '../content/letters'
import CLIPS from './clips.gen.json'
import PRECACHE from '../../public/audio/en/manifest.json'

const clips = CLIPS as Record<string, string>
const onDisk = new Set(Object.keys(import.meta.glob('../../public/audio/en/*.mp3')).map((p) => p.replace('../../public/', '')))

describe('pre-generated clips', () => {
  it('cover every English phrase and word the app speaks (run scripts/gen-audio.py after adding letters)', () => {
    const texts = ['This is', 'and this is', ...LETTERS.flatMap((l) => [`${l.upper} says`, `like ${l.keyword.word}`, l.keyword.word])]
    expect(texts.filter((t) => !clips[t])).toEqual([])
  })

  it('point at files that exist and are all precached for offline use', () => {
    const files = Object.values(clips)
    expect(files.filter((f) => !onDisk.has(f))).toEqual([])
    expect(new Set(PRECACHE)).toEqual(new Set(files))
  })
})
