import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SyncEvent } from './journal'
import { freshSave, type Saved } from './local'
import { forgetSync, Syncer, type KeyValue, type Remote } from './sync'

class Memory implements KeyValue {
  data = new Map<string, string>()
  getItem = (k: string) => this.data.get(k) ?? null
  setItem = (k: string, v: string) => void this.data.set(k, v)
}

/** A cloud that can go offline: pushes fail while `online` is false. */
class FakeCloud implements Remote {
  online = true
  rows = new Map<string, SyncEvent>()
  pushes = 0
  async push(events: SyncEvent[]) {
    this.pushes++
    if (!this.online) throw new Error('offline')
    for (const e of events) if (!this.rows.has(e.id)) this.rows.set(e.id, e)
  }
  async pull() {
    if (!this.online) throw new Error('offline')
    return [...this.rows.values()]
  }
}

const NOW = () => '2026-10-30T10:00:00.000Z'
const withSeen = (s: Saved, ...letters: string[]): Saved => ({ ...s, seenLetters: [...s.seenLetters, ...letters] })

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Syncer', () => {
  it('queues changes and sends them', async () => {
    const cloud = new FakeCloud()
    const sync = new Syncer(cloud, new Memory(), NOW)
    const s0 = freshSave()
    sync.track(s0, withSeen(s0, 'g'))
    expect(await sync.flush()).toBe(true)
    expect([...cloud.rows.keys()]).toEqual(['seen-g'])
  })

  it('keeps the outbox through a failure and a reload, and retries', async () => {
    const cloud = new FakeCloud()
    cloud.online = false
    const store = new Memory()
    const sync = new Syncer(cloud, store, NOW)
    sync.track(freshSave(), withSeen(freshSave(), 'g', 'e'))
    expect(await sync.flush()).toBe(false)
    expect(sync.pending).toHaveLength(2)

    // The app is closed and opened again, still offline.
    sync.stop()
    const again = new Syncer(cloud, store, NOW)
    expect(again.pending.map((e) => e.id)).toEqual(['seen-g', 'seen-e'])

    cloud.online = true
    expect(await again.flush()).toBe(true)
    expect([...cloud.rows.keys()].sort()).toEqual(['seen-e', 'seen-g'])
  })

  it('retries by itself after a failed send', async () => {
    const cloud = new FakeCloud()
    cloud.online = false
    const sync = new Syncer(cloud, new Memory(), NOW)
    sync.track(freshSave(), withSeen(freshSave(), 'g'))
    await vi.advanceTimersByTimeAsync(1_500) // first attempt fails
    expect(cloud.pushes).toBe(1)
    cloud.online = true
    await vi.advanceTimersByTimeAsync(5_000)
    expect(sync.pending).toHaveLength(0)
    expect(cloud.rows.has('seen-g')).toBe(true)
  })

  it('seeds the existing save once per device', async () => {
    const cloud = new FakeCloud()
    const store = new Memory()
    const s = withSeen(freshSave(), 's', 'a')
    new Syncer(cloud, store, NOW).seed(s)
    const sync = new Syncer(cloud, store, NOW)
    expect(sync.pending).toHaveLength(2)
    await sync.flush()
    sync.seed(s)
    expect(sync.pending).toHaveLength(0)
  })

  it('does not send back what it pulled', async () => {
    const cloud = new FakeCloud()
    cloud.rows.set('seen-g', { kind: 'letter_seen', id: 'seen-g', at: NOW(), letter: 'g' })
    const sync = new Syncer(cloud, new Memory(), NOW)
    expect(await sync.pull()).toHaveLength(1)
    sync.track(freshSave(), withSeen(freshSave(), 'g'))
    expect(sync.pending).toHaveLength(0)
  })

  it('pull answers null when offline', async () => {
    const cloud = new FakeCloud()
    cloud.online = false
    expect(await new Syncer(cloud, new Memory(), NOW).pull()).toBeNull()
  })
})

describe('forgetSync', () => {
  it('lets the next child on the device seed their own save', async () => {
    const store = Object.assign(new Memory(), { removeItem(this: Memory, k: string) { this.data.delete(k) } })
    const cloud = new FakeCloud()
    cloud.online = false
    const s = new Syncer(cloud, store, NOW)
    s.seed(withSeen(freshSave(), 'g'))
    expect(store.data.size).toBe(2)
    forgetSync(store)
    expect(store.data.size).toBe(0)
    expect(new Syncer(cloud, store, NOW).pending).toEqual([])
  })
})
