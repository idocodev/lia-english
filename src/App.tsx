import { useCallback, useEffect, useState } from 'react'
import { load, save, type Saved } from './storage/local'
import { Home } from './screens/Home'
import { LetterList } from './screens/LetterList'
import { LetterCard } from './screens/LetterCard'
import { SoundGame } from './screens/SoundGame'
import { Badges } from './screens/Badges'
import { Collection } from './screens/Collection'
import { BottomNav } from './components/BottomNav'
import { stop } from './audio/audio'

// Tiny hash router: #/, #/letters, #/letter/g, #/game, #/badges, #/collection. Keeps the Android back button working.
function useRoute(): [string, (to: string) => void] {
  const read = () => window.location.hash.replace(/^#/, '') || '/'
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => {
      stop()
      setRoute(read())
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((to: string) => {
    window.location.hash = to
  }, [])
  return [route, go]
}

export type Store = {
  data: Saved
  update: (fn: (s: Saved) => Saved) => void
  go: (to: string) => void
}

export function App() {
  const [route, go] = useRoute()
  const [data, setData] = useState<Saved>(load)
  const update = useCallback((fn: (s: Saved) => Saved) => setData((s) => fn(s)), [])
  useEffect(() => save(data), [data])

  const store: Store = { data, update, go }
  const letterMatch = route.match(/^\/letter\/(\w)$/)
  const tabbed = ['/', '/letters', '/badges', '/collection'].includes(route)

  // Status bar matches the screen: white on home, purple under the inner headers.
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', route === '/' ? '#f6f4fd' : '#9157f0')
  }, [route])

  return (
    <div className="app">
      {route === '/letters' ? (
        <LetterList store={store} />
      ) : letterMatch ? (
        <LetterCard store={store} id={letterMatch[1]} key={letterMatch[1]} />
      ) : route === '/game' ? (
        <SoundGame store={store} />
      ) : route === '/badges' ? (
        <Badges store={store} />
      ) : route === '/collection' ? (
        <Collection store={store} />
      ) : (
        <Home store={store} />
      )}
      {tabbed && <BottomNav route={route} go={go} />}
    </div>
  )
}
