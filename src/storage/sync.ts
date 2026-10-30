// Cloud save: sends the save's new events to Supabase and brings other devices' events back.
// Only when the build has the three VITE_ values; without them nothing here runs and the
// app is exactly the offline app. A failed send stays in the outbox and is retried later.

import { addToOutbox, eventsBetween, removeFromOutbox, type SyncEvent } from './journal'
import { freshSave, type Saved } from './local'

export type SyncConfig = { url: string; anonKey: string; playerKey: string }

export function readConfig(env: Record<string, string | undefined> = import.meta.env): SyncConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  const playerKey = env.VITE_PLAYER_KEY?.trim()
  return url && anonKey && playerKey ? { url, anonKey, playerKey } : null
}

export interface Remote {
  push(events: SyncEvent[]): Promise<void>
  /** Every event of this player, oldest first. */
  pull(): Promise<SyncEvent[]>
}

export type KeyValue = Pick<Storage, 'getItem' | 'setItem'>

const OUTBOX = 'lia-english:outbox:v1'
const SEEDED = 'lia-english:synced-save:v1'
const BATCH = 200
const RETRY_MIN = 5_000
const RETRY_MAX = 5 * 60_000

export class Syncer {
  private outbox: SyncEvent[]
  private sending: Promise<void> | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private retry = RETRY_MIN
  /** Ids the cloud already has (pulled this session): never queued again. */
  private known = new Set<string>()

  constructor(
    private remote: Remote,
    private store: KeyValue,
    private now: () => string = () => new Date().toISOString(),
  ) {
    try {
      this.outbox = JSON.parse(store.getItem(OUTBOX) ?? '[]') as SyncEvent[]
    } catch {
      this.outbox = []
    }
  }

  get pending(): readonly SyncEvent[] {
    return this.outbox
  }

  /** The first time on this device with a backend: the whole save so far goes into the outbox. */
  seed(s: Saved) {
    if (this.store.getItem(SEEDED)) return
    this.add(eventsBetween(freshSave(), s, this.now()))
    this.store.setItem(SEEDED, '1')
  }

  /** The save changed from `prev` to `next`: queue what is new. */
  track(prev: Saved, next: Saved) {
    this.add(eventsBetween(prev, next, this.now()))
  }

  private add(events: SyncEvent[]) {
    const next = addToOutbox(this.outbox, events.filter((e) => !this.known.has(e.id)))
    if (next === this.outbox) return
    this.outbox = next
    this.persist()
    this.schedule(1_500)
  }

  private persist() {
    try {
      this.store.setItem(OUTBOX, JSON.stringify(this.outbox))
    } catch {
      // Storage full: the events still go out this session.
    }
  }

  private schedule(ms: number) {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), ms)
  }

  /** Sends the outbox in batches. Resolves true when it is empty. Never throws. */
  async flush(): Promise<boolean> {
    if (!this.sending) this.sending = this.send().finally(() => (this.sending = null))
    await this.sending
    return this.outbox.length === 0
  }

  private async send() {
    while (this.outbox.length) {
      const batch = this.outbox.slice(0, BATCH)
      try {
        await this.remote.push(batch)
      } catch {
        this.schedule(this.retry)
        this.retry = Math.min(this.retry * 2, RETRY_MAX)
        return
      }
      this.retry = RETRY_MIN
      this.outbox = removeFromOutbox(this.outbox, batch)
      this.persist()
    }
  }

  /** Events in the cloud, or null when it can't be reached (offline). */
  async pull(): Promise<SyncEvent[] | null> {
    try {
      const events = await this.remote.pull()
      for (const e of events) this.known.add(e.id)
      return events
    } catch {
      return null
    }
  }

  stop() {
    clearTimeout(this.timer)
  }
}
