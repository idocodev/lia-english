import { describe, expect, it, vi } from 'vitest'
import { forgetAccount, loadAccount, login, readBackend, register, saveAccount } from './account'

const BACKEND = { url: 'https://x.supabase.co/', anonKey: 'pub' }
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

describe('readBackend', () => {
  it('needs the url and the publishable key, and no player key', () => {
    expect(readBackend({})).toBeNull()
    expect(readBackend({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull()
    expect(readBackend({ VITE_SUPABASE_URL: ' https://x.supabase.co ', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual({ url: 'https://x.supabase.co', anonKey: 'k' })
  })
})

describe('login', () => {
  it('calls the login function with the name and password and answers the account', async () => {
    const f = reply(200, { player_key: 'key-123', name: 'ליה' })
    expect(await login(BACKEND, 'Lia', 'pw', f)).toEqual({ ok: true, account: { playerKey: 'key-123', name: 'ליה' } })
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://x.supabase.co/rest/v1/rpc/login')
    expect(init.headers.apikey).toBe('pub')
    expect(JSON.parse(init.body)).toEqual({ p_name: 'Lia', p_password: 'pw' })
  })

  it('tells a wrong password, too many tries, offline and no backend apart', async () => {
    expect(await login(BACKEND, 'Lia', 'x', reply(200, null))).toEqual({ ok: false, reason: 'wrong' })
    expect(await login(BACKEND, 'Lia', 'x', reply(400, { code: 'P0001', message: 'too_many_attempts' }))).toEqual({ ok: false, reason: 'locked' })
    expect(await login(BACKEND, 'Lia', 'x', reply(500, {}))).toEqual({ ok: false, reason: 'unavailable' })
    const offline = vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch
    expect(await login(BACKEND, 'Lia', 'x', offline)).toEqual({ ok: false, reason: 'offline' })
    expect(await login(null, 'Lia', 'x')).toEqual({ ok: false, reason: 'unavailable' })
  })
})

describe('register', () => {
  it('calls register and answers the account, or why not', async () => {
    const f = reply(200, { player_key: 'key-123', name: 'ליה' })
    expect(await register(BACKEND, 'ליה', 'pw12', f)).toEqual({ ok: true, account: { playerKey: 'key-123', name: 'ליה' } })
    expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('https://x.supabase.co/rest/v1/rpc/register')
    expect(await register(BACKEND, 'x', 'pw12', reply(200, null))).toEqual({ ok: false, reason: 'unknown' })
    expect(await register(BACKEND, 'Lia', 'pw12', reply(400, { message: 'already_registered' }))).toEqual({ ok: false, reason: 'already_registered' })
    expect(await register(BACKEND, 'Lia', 'p', reply(400, { message: 'weak_password' }))).toEqual({ ok: false, reason: 'weak' })
  })

  it('login says when the child has no password yet', async () => {
    expect(await login(BACKEND, 'Lia', 'x', reply(200, { needs_password: true }))).toEqual({ ok: false, reason: 'needs_password' })
  })
})

describe('the stored account', () => {
  it('round-trips, ignores junk and is forgotten on logout', () => {
    const m = new Map<string, string>()
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
    expect(loadAccount(store)).toBeNull()
    saveAccount({ playerKey: 'k', name: 'ליה' }, store)
    expect(loadAccount(store)).toEqual({ playerKey: 'k', name: 'ליה' })
    forgetAccount(store)
    expect(loadAccount(store)).toBeNull()
    m.set('lia-english:account:v1', '{nope')
    expect(loadAccount(store)).toBeNull()
  })
})
