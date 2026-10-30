// Each child logs in with a name and a password (login() in supabase/schema.sql); the first
// time, they pick the password (register(), only for an account made for them). The answer is
// the child's player key, which the device keeps: it stays logged in, offline too, until logout.
// Nothing in the app shows without it, and the build carries no key of its own.

import type { KeyValue } from './sync'

export type Backend = { url: string; anonKey: string }
export type Account = { playerKey: string; name: string }

export function readBackend(env: Record<string, string | undefined> = import.meta.env): Backend | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  return url && anonKey ? { url, anonKey } : null
}

const ACCOUNT = 'lia-english:account:v1'

export function loadAccount(store: Pick<Storage, 'getItem'> = localStorage): Account | null {
  try {
    const a = JSON.parse(store.getItem(ACCOUNT) ?? 'null') as Partial<Account> | null
    return a && typeof a.playerKey === 'string' && a.playerKey && typeof a.name === 'string' ? { playerKey: a.playerKey, name: a.name } : null
  } catch {
    return null
  }
}

export function saveAccount(a: Account, store: KeyValue = localStorage) {
  store.setItem(ACCOUNT, JSON.stringify(a))
}

export function forgetAccount(store: Pick<Storage, 'removeItem'> = localStorage) {
  store.removeItem(ACCOUNT)
}

export type LoginResult =
  | { ok: true; account: Account }
  | { ok: false; reason: 'wrong' | 'needs_password' | 'unknown' | 'already_registered' | 'weak' | 'locked' | 'offline' | 'unavailable' }

const RAISED = { too_many_attempts: 'locked', already_registered: 'already_registered', weak_password: 'weak' } as const

/** Logs in; `needs_password` means the child has no password yet and should register. */
export const login = (backend: Backend | null, name: string, password: string, fetchFn: typeof fetch = fetch) =>
  call('login', backend, name, password, fetchFn)

/** Sets the first password of an account with none; then the child is logged in. */
export const register = (backend: Backend | null, name: string, password: string, fetchFn: typeof fetch = fetch) =>
  call('register', backend, name, password, fetchFn)

async function call(fn: 'login' | 'register', backend: Backend | null, name: string, password: string, fetchFn: typeof fetch): Promise<LoginResult> {
  if (!backend) return { ok: false, reason: 'unavailable' }
  let res: Response
  try {
    res = await fetchFn(`${backend.url.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: backend.anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ p_name: name, p_password: password }),
    })
  } catch {
    return { ok: false, reason: 'offline' }
  }
  const body = (await res.json().catch(() => null)) as { player_key?: unknown; name?: unknown; needs_password?: unknown; message?: unknown } | null
  if (!res.ok) return { ok: false, reason: RAISED[String(body?.message) as keyof typeof RAISED] ?? 'unavailable' }
  if (body?.needs_password === true) return { ok: false, reason: 'needs_password' }
  if (!body || typeof body.player_key !== 'string' || !body.player_key) return { ok: false, reason: fn === 'login' ? 'wrong' : 'unknown' }
  return { ok: true, account: { playerKey: body.player_key, name: typeof body.name === 'string' && body.name ? body.name : name.trim() } }
}
