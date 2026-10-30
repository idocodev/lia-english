// Hooks the logged-in child's save up to their cloud copy (see sync.ts).
// Without config (a build with no backend) this does nothing at all.

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { mergeRemote } from './journal'
import type { Saved } from './local'
import { Syncer, type SyncConfig } from './sync'

/** Returns flush(): resolves true once everything is in the cloud (for logout). */
export function useCloudSave(config: SyncConfig | null, data: Saved, setData: Dispatch<SetStateAction<Saved>>) {
  const syncer = useRef<Syncer | null>(null)
  // The save as last handed to the syncer; until it is ready, the save at start.
  const tracked = useRef(data)
  const latest = useRef(data)
  latest.current = data

  useEffect(() => {
    if (!config) return
    let live = true
    let cleanup = () => {}
    void import('./remote').then(({ supabaseRemote }) => {
      if (!live) return
      const s = new Syncer(supabaseRemote(config), localStorage)
      syncer.current = s
      s.seed(latest.current)
      s.track(tracked.current, latest.current)
      tracked.current = latest.current
      void s.flush()
      void s.pull().then((remote) => {
        if (live && remote?.length) setData((d) => mergeRemote(d, remote))
      })
      const online = () => void s.flush()
      window.addEventListener('online', online)
      cleanup = () => {
        window.removeEventListener('online', online)
        s.stop()
      }
    })
    return () => {
      live = false
      syncer.current = null
      cleanup()
    }
  }, [config, setData])

  useEffect(() => {
    const s = syncer.current
    if (!s || tracked.current === data) return
    s.track(tracked.current, data)
    tracked.current = data
  }, [data])

  return useCallback(async () => {
    const s = syncer.current
    return s ? s.flush() : !config
  }, [config])
}
