import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { clearSave, load, save, type Saved } from './storage/local'
import { useCloudSave } from './storage/useCloudSave'
import { forgetAccount, loadAccount, readBackend, saveAccount, type Account } from './storage/account'
import { forgetSync } from './storage/sync'
import { Login } from './screens/Login'
import { Home } from './screens/Home'
import { LetterList } from './screens/LetterList'
import { LetterCard } from './screens/LetterCard'
import { SoundGame } from './screens/SoundGame'
import { WordPick } from './screens/WordPick'
import { WordBuild } from './screens/WordBuild'
import { Play } from './screens/Play'
import { Badges } from './screens/Badges'
import { Collection } from './screens/Collection'
import { BottomNav } from './components/BottomNav'
import { stop } from './audio/audio'

// The parent dashboard (#/admin), loaded only when opened.
const AdminApp = lazy(() => import('./admin/Admin').then((m) => ({ default: m.AdminApp })))

// Tiny hash router: #/, #/letters, #/letter/g, #/play, #/game, #/words/pick, #/words/build, #/badges, #/collection, #/admin.... Keeps the Android back button working.
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
  account: Account
  logout: () => void
}

const backend = readBackend()

// No account, no app: the login screen until a child logs in on this device.
// #/admin is the parent dashboard, with its own login, whoever is logged in as a child.
export function App() {
  const [route] = useRoute()
  const [account, setAccount] = useState(() => loadAccount())
  if (route.startsWith('/admin'))
    return (
      <Suspense fallback={null}>
        <AdminApp backend={backend} route={route} />
      </Suspense>
    )
  if (!account)
    return (
      <Login
        backend={backend}
        onLogin={(a) => {
          saveAccount(a)
          window.location.hash = '/'
          setAccount(a)
        }}
      />
    )
  return (
    <Game
      key={account.playerKey}
      account={account}
      onLogout={() => {
        forgetAccount()
        forgetSync()
        clearSave()
        setAccount(null)
      }}
    />
  )
}

function Game({ account, onLogout }: { account: Account; onLogout: () => void }) {
  const [route, go] = useRoute()
  const [data, setData] = useState<Saved>(load)
  const update = useCallback((fn: (s: Saved) => Saved) => setData((s) => fn(s)), [])
  useEffect(() => save(data), [data])
  const config = useMemo(() => (backend ? { ...backend, playerKey: account.playerKey } : null), [account.playerKey])
  const flush = useCloudSave(config, data, setData)

  const logout = useCallback(async () => {
    const saved = await flush()
    const ask = saved ? 'לצאת מהחשבון?' : 'חלק מההתקדמות עוד לא נשמר (אין אינטרנט). אם יוצאים עכשיו הוא יימחק מהמכשיר. לצאת בכל זאת?'
    if (window.confirm(ask)) onLogout()
  }, [flush, onLogout])

  const store: Store = { data, update, go, account, logout: () => void logout() }
  const letterMatch = route.match(/^\/letter\/(\w)$/)
  const tabbed = ['/', '/letters', '/play', '/badges', '/collection'].includes(route)

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
      ) : route === '/play' ? (
        <Play store={store} />
      ) : route === '/words/pick' ? (
        <WordPick store={store} />
      ) : route === '/words/build' ? (
        <WordBuild store={store} />
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
