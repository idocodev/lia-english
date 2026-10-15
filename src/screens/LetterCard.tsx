import { useEffect, useState } from 'react'
import type { Store } from '../App'
import { TopBar } from '../components/TopBar'
import { Sparkles } from '../components/Sparkles'
import { LETTERS, LETTER_BY_ID, type LetterId } from '../content/letters'
import { playPhrase, playSound, playWord, stop } from '../audio/audio'

export function LetterCard({ store, id }: { store: Store; id: string }) {
  const { data, update, go } = store
  const letter = LETTER_BY_ID[id as LetterId]
  const idx = LETTERS.findIndex((l) => l.id === id)
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    if (!letter) return
    if (!data.seenLetters.includes(letter.id)) {
      update((s) => ({ ...s, seenLetters: [...s.seenLetters, letter.id] }))
    }
    const t = setTimeout(() => playPhrase(letter), 350)
    return () => {
      clearTimeout(t)
      stop()
    }
  }, [letter])

  if (!letter) return null
  const prev = LETTERS[idx - 1]
  const next = LETTERS[idx + 1]

  const tap = (fn: () => void) => () => {
    stop()
    setPulse((p) => p + 1)
    fn()
  }

  return (
    <main className="screen card-screen">
      <TopBar onBack={() => go('/letters')} stars={data.stars}>
        <span className="card-count" dir="ltr">
          {idx + 1} / {LETTERS.length}
        </span>
      </TopBar>

      <div className="card-body">
        <button className="big-letter" onClick={tap(() => playSound(letter))} lang="en" aria-label="השמעת הצליל">
          {pulse > 0 && <Sparkles key={pulse} count={10} spread={90} />}
          <span className="big-letter-inner">
            <span className="upper">{letter.upper}</span>
            <span className="lower">{letter.lower}</span>
          </span>
        </button>

        <div className="card-side">
          <div className="name-vs-sound">
            <div className="nvs nvs-name">
              <span className="nvs-label">השם</span>
              <span className="nvs-value">{letter.nameHe}</span>
            </div>
            <div className="nvs nvs-sound">
              <span className="nvs-label">הצליל</span>
              <span className="nvs-value" dir="ltr" lang="en">
                {letter.sound}
              </span>
              <span className="nvs-he">({letter.soundHe})</span>
            </div>
          </div>

          <button className="keyword" onClick={tap(() => playWord(letter.keyword.word))} dir="ltr" lang="en">
            <span className="keyword-emoji">{letter.keyword.emoji}</span>
            <span className="keyword-word">
              <b>{letter.keyword.word[0]}</b>
              {letter.keyword.word.slice(1)}
            </span>
          </button>

          <div className="sound-buttons">
            <button className="btn btn-primary" onClick={tap(() => playSound(letter))}>
              🔊 הצליל
            </button>
            <button className="btn btn-soft" onClick={tap(() => playPhrase(letter))} dir="ltr" lang="en">
              ▶ {letter.upper} says {letter.sound}
            </button>
          </div>
          <p className="say-it">
            🎤 עכשיו את! תגידי בקול: <bdi dir="ltr">{letter.sound}</bdi>
          </p>
        </div>
      </div>

      <nav className="card-nav">
        <button className="btn btn-nav" disabled={!prev} onClick={() => prev && go(`/letter/${prev.id}`)}>
          <span aria-hidden>→</span>
          <span>הקודמת</span>
        </button>
        <button className="btn btn-nav" disabled={!next} onClick={() => next && go(`/letter/${next.id}`)}>
          <span>הבאה</span>
          <span aria-hidden>←</span>
        </button>
      </nav>
    </main>
  )
}
