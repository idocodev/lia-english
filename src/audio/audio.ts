// Audio seam: every sound in the app goes through this module.
// A recorded file (public/audio/...) always wins; the browser's speech engine is the fallback.
// To use recordings, add files and set `audio` on a letter in content/letters.ts,
// or drop files named by convention (see recordedUrl) and list them in RECORDED.

import type { Letter } from '../content/letters'

/** Ids of letters that have recordings by convention: audio/<id>.mp3 and audio/<id>-phrase.mp3. */
const RECORDED = new Set<string>([])

const base = import.meta.env.BASE_URL

function recordedUrl(letter: Letter, kind: 'sound' | 'phrase'): string | undefined {
  const explicit = letter.audio?.[kind]
  if (explicit) return `${base}audio/${explicit}`
  if (RECORDED.has(letter.id)) return `${base}audio/${letter.id}${kind === 'phrase' ? '-phrase' : ''}.mp3`
  return undefined
}

let englishVoice: SpeechSynthesisVoice | undefined
let hebrewVoice: SpeechSynthesisVoice | undefined

function loadVoices() {
  if (!('speechSynthesis' in window)) return
  const voices = speechSynthesis.getVoices()
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
  // Prefer a natural-sounding US female voice when available.
  englishVoice =
    en.find((v) => /en-us/i.test(v.lang) && /samantha|female|zira|google us/i.test(v.name)) ??
    en.find((v) => /en-us/i.test(v.lang)) ??
    en[0]
  hebrewVoice = voices.find((v) => /^(he|iw)/i.test(v.lang))
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices()
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
}

let current: HTMLAudioElement | undefined

export function stop() {
  current?.pause()
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}

function playFile(url: string): Promise<void> {
  return new Promise((resolve) => {
    const a = new Audio(url)
    current = a
    a.onended = () => resolve()
    a.onerror = () => resolve()
    a.play().catch(() => resolve())
  })
}

function speak(text: string, lang: 'en' | 'he' = 'en', rate = 0.8): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === 'en' ? 'en-US' : 'he-IL'
    const voice = lang === 'en' ? englishVoice : hebrewVoice
    if (voice) u.voice = voice
    u.rate = rate
    u.pitch = 1.1
    u.onend = () => resolve()
    u.onerror = () => resolve()
    // Safety net: some browsers never fire onend.
    setTimeout(resolve, 2500 + text.length * 120)
    speechSynthesis.speak(u)
  })
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The pure letter sound: /g/. */
export async function playSound(letter: Letter) {
  const url = recordedUrl(letter, 'sound')
  return url ? playFile(url) : speak(letter.ttsSound, 'en', 0.7)
}

/** "G says /g/, like goat." */
export async function playPhrase(letter: Letter) {
  const url = recordedUrl(letter, 'phrase')
  if (url) return playFile(url)
  await speak(`${letter.upper} says`, 'en')
  await playSound(letter)
  await pause(150)
  await speak(`like ${letter.keyword.word}`, 'en')
}

export async function playWord(word: string) {
  return speak(word, 'en', 0.8)
}

/** Short Hebrew praise/instructions, only if the device has a Hebrew voice. */
export async function sayHebrew(text: string) {
  if (hebrewVoice) return speak(text, 'he', 1)
}

/** "This is /g/, and this is /e/" - used after a mix-up. */
export async function playContrast(a: Letter, b: Letter, onFocus: (id: string) => void) {
  // Each letter stays highlighted for at least a moment, even when speech is unavailable.
  onFocus(a.id)
  await Promise.all([speak('This is', 'en').then(() => playSound(a)), pause(1100)])
  await pause(300)
  onFocus(b.id)
  await Promise.all([speak('and this is', 'en').then(() => playSound(b)), pause(1100)])
  await pause(200)
  onFocus('')
}

// Tiny synthesized chimes for feedback (no files needed).
let ctx: AudioContext | undefined
export function chime(kind: 'yay' | 'soft') {
  try {
    ctx ??= new AudioContext()
    const notes = kind === 'yay' ? [784, 988, 1319] : [392, 330]
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator()
      const g = ctx!.createGain()
      o.type = 'sine'
      o.frequency.value = f
      const t = ctx!.currentTime + i * 0.09
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      o.connect(g).connect(ctx!.destination)
      o.start(t)
      o.stop(t + 0.4)
    })
  } catch {
    // Audio is a nicety; never break the game for it.
  }
}
