// Audio seam: every sound in the app goes through this module.
// Order of preference: a recorded file (public/audio/...), then a pre-generated Kokoro clip
// (public/audio/en/, voice af_heart, made by scripts/gen-audio.py), then the browser's speech engine.
// To use recordings, add files and set `audio` on a letter in content/letters.ts,
// or drop files named by convention (see recordedUrl) and list them in RECORDED.

import type { Letter } from '../content/letters'
import CLIPS from './clips.gen.json'

/** Ids of letters that have recordings by convention: audio/<id>.mp3 and audio/<id>-phrase.mp3. */
const RECORDED = new Set<string>([])

const base = import.meta.env.BASE_URL

function recordedUrl(letter: Letter, kind: 'sound' | 'phrase'): string | undefined {
  const explicit = letter.audio?.[kind]
  if (explicit) return `${base}audio/${explicit}`
  if (RECORDED.has(letter.id)) return `${base}audio/${letter.id}${kind === 'phrase' ? '-phrase' : ''}.mp3`
  return undefined
}

/** Pre-generated clip for an English text ("G says", "goat") or a letter sound ("sound:g"). */
function clipUrl(key: string): string | undefined {
  const file = (CLIPS as Record<string, string>)[key]
  return file ? `${base}${file}` : undefined
}

let englishVoice: SpeechSynthesisVoice | undefined

function loadVoices() {
  if (!('speechSynthesis' in window)) return
  const voices = speechSynthesis.getVoices()
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
  // Prefer a natural-sounding US female voice when available.
  englishVoice =
    en.find((v) => /en-us/i.test(v.lang) && /samantha|female|zira|google us/i.test(v.name)) ??
    en.find((v) => /en-us/i.test(v.lang)) ??
    en[0]
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices()
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
}

// Files play through Web Audio: once a tap has woken the context, clips can follow each other
// without a tap of their own (iOS would refuse a new <audio> started after an await).
let ctx: AudioContext | undefined
function audioCtx(): AudioContext | undefined {
  try {
    ctx ??= new AudioContext()
  } catch {
    // No Web Audio: files are skipped and speech takes over.
  }
  return ctx
}

if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown']) {
    window.addEventListener(ev, () => void audioCtx()?.resume(), { capture: true })
  }
}

const buffers = new Map<string, Promise<AudioBuffer | undefined>>()
function load(c: AudioContext, url: string) {
  let p = buffers.get(url)
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
      .then((b) => c.decodeAudioData(b))
      .catch(() => {
        buffers.delete(url)
        return undefined
      })
    buffers.set(url, p)
  }
  return p
}

let current: AudioBufferSourceNode | undefined

export function stop() {
  try {
    current?.stop()
  } catch {
    // Already stopped.
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}

/** Plays a file; resolves false if it could not be played (no tap yet, missing, offline and uncached). */
async function playFile(url: string): Promise<boolean> {
  const c = audioCtx()
  if (!c) return false
  if (c.state !== 'running') {
    // resume() never settles before the first tap in some browsers: don't wait on it for long.
    await Promise.race([c.resume().catch(() => {}), pause(300)])
    if ((c.state as AudioContextState) !== 'running') return false
  }
  const buffer = await load(c, url)
  if (!buffer) return false
  return new Promise((resolve) => {
    const src = c.createBufferSource()
    src.buffer = buffer
    src.connect(c.destination)
    src.onended = () => resolve(true)
    current = src
    src.start()
  })
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

function speak(text: string, rate = 0.8): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    if (englishVoice) u.voice = englishVoice
    u.rate = rate
    u.pitch = 1.1
    u.onend = () => resolve()
    u.onerror = () => resolve()
    // Safety net: some browsers never fire onend.
    setTimeout(resolve, 2500 + text.length * 120)
    speechSynthesis.speak(u)
  })
}

/** English text: its pre-generated clip when there is one, else the speech engine. */
async function sayEnglish(text: string, rate = 0.8): Promise<void> {
  const url = clipUrl(text)
  if (url && (await playFile(url))) return
  return speak(text, rate)
}

/** The pure letter sound: /g/. */
export async function playSound(letter: Letter) {
  for (const url of [recordedUrl(letter, 'sound'), clipUrl(`sound:${letter.id}`)]) {
    if (url && (await playFile(url))) return
  }
  return speak(letter.ttsSound, 0.7)
}

/** "G says /g/, like goat." */
export async function playPhrase(letter: Letter) {
  const url = recordedUrl(letter, 'phrase')
  if (url && (await playFile(url))) return
  await sayEnglish(`${letter.upper} says`)
  await playSound(letter)
  await pause(150)
  await sayEnglish(`like ${letter.keyword.word}`)
}

export async function playWord(word: string) {
  return sayEnglish(word)
}

/** Ido's recorded Hebrew feedback, in public/audio/he/<id>.mp3. */
export const HEBREW_CLIPS = [
  'kol-hakavod', // כל הכבוד!
  'meule', // מעולה!
  'wow', // וואו, איזה יופי!
  'almost', // כמעט! בואי ננסה שוב
  'listen', // תקשיבי טוב
  'which-sound', // איזה צליל את שומעת?
  'level-up', // עלית רמה!
  'new-sticker', // קיבלת מדבקה חדשה!
] as const
export type HebrewClip = (typeof HEBREW_CLIPS)[number]

/** A Hebrew feedback clip. Files only: the device's Hebrew speech voice is never used. */
export async function sayHebrew(id: HebrewClip) {
  await playFile(`${base}audio/he/${id}.mp3`)
}

/** "This is /g/, and this is /e/" - used after a mix-up. */
export async function playContrast(a: Letter, b: Letter, onFocus: (id: string) => void) {
  // Each letter stays highlighted for at least a moment, even when speech is unavailable.
  onFocus(a.id)
  await Promise.all([sayEnglish('This is').then(() => playSound(a)), pause(1100)])
  await pause(300)
  onFocus(b.id)
  await Promise.all([sayEnglish('and this is').then(() => playSound(b)), pause(1100)])
  await pause(200)
  onFocus('')
}

// Tiny synthesized chimes for feedback (no files needed).
export function chime(kind: 'yay' | 'soft') {
  try {
    const ctx = audioCtx()
    if (!ctx) return
    const notes = kind === 'yay' ? [784, 988, 1319] : [392, 330]
    notes.forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      const t = ctx.currentTime + i * 0.09
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + 0.4)
    })
  } catch {
    // Audio is a nicety; never break the game for it.
  }
}
