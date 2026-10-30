// The parent dashboard's side of supabase/schema.sql: admin_login / admin_register answer an
// admin key, and the admin_* functions take it. Plain fetch, like account.ts (no supabase-js).
// The key is kept for this browser session only (sessionStorage), so a child who later opens
// the app on the parent's phone doesn't land in the dashboard.

import type { Backend } from '../storage/account'

export type AdminSession = { adminKey: string; name: string }

export type AdminEvent = {
  id: string
  kind: 'answer' | 'letter_seen' | 'sticker'
  at: string
  letter: string | null
  chosen: string | null
  correct: boolean | null
  round_id: string | null
  sticker: string | null
}

export type ChildRecord = {
  id: string
  name: string
  display_name: string
  login_names: string[]
  has_password: boolean
  created_at: string
  events: AdminEvent[]
}

const SESSION = 'lia-english:admin:v1'

export function loadSession(store: Pick<Storage, 'getItem'> = sessionStorage): AdminSession | null {
  try {
    const s = JSON.parse(store.getItem(SESSION) ?? 'null') as Partial<AdminSession> | null
    return s && typeof s.adminKey === 'string' && s.adminKey && typeof s.name === 'string' ? { adminKey: s.adminKey, name: s.name } : null
  } catch {
    return null
  }
}

export const saveSession = (s: AdminSession, store: Pick<Storage, 'setItem'> = sessionStorage) => store.setItem(SESSION, JSON.stringify(s))
export const forgetSession = (store: Pick<Storage, 'removeItem'> = sessionStorage) => store.removeItem(SESSION)

export type AdminProblem = 'wrong' | 'needs_password' | 'unknown' | 'already_registered' | 'weak' | 'locked' | 'offline' | 'unavailable' | 'not_admin' | 'name_taken' | 'bad_name'

const RAISED: Record<string, AdminProblem> = {
  too_many_attempts: 'locked',
  already_registered: 'already_registered',
  weak_password: 'weak',
  not_admin: 'not_admin',
  name_taken: 'name_taken',
  bad_name: 'bad_name',
}

export class AdminError extends Error {
  constructor(readonly problem: AdminProblem) {
    super(problem)
  }
}

async function rpc<T>(backend: Backend | null, fn: string, args: Record<string, unknown>, fetchFn: typeof fetch): Promise<T> {
  if (!backend) throw new AdminError('unavailable')
  let res: Response
  try {
    res = await fetchFn(`${backend.url.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: backend.anonKey, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    })
  } catch {
    throw new AdminError('offline')
  }
  const body = (await res.json().catch(() => null)) as T & { message?: unknown }
  if (!res.ok) throw new AdminError(RAISED[String(body?.message)] ?? 'unavailable')
  return body
}

export type AdminLoginResult = { ok: true; session: AdminSession } | { ok: false; reason: AdminProblem }

/** admin_login, or admin_register the first time; `needs_password` means: pick one. */
export async function adminLogin(backend: Backend | null, mode: 'login' | 'register', name: string, password: string, fetchFn: typeof fetch = fetch): Promise<AdminLoginResult> {
  try {
    const body = await rpc<{ admin_key?: unknown; name?: unknown; needs_password?: unknown } | null>(
      backend,
      mode === 'login' ? 'admin_login' : 'admin_register',
      { p_name: name, p_password: password },
      fetchFn,
    )
    if (body?.needs_password === true) return { ok: false, reason: 'needs_password' }
    if (!body || typeof body.admin_key !== 'string' || !body.admin_key) return { ok: false, reason: mode === 'login' ? 'wrong' : 'unknown' }
    return { ok: true, session: { adminKey: body.admin_key, name: typeof body.name === 'string' && body.name ? body.name : name.trim() } }
  } catch (e) {
    return { ok: false, reason: e instanceof AdminError ? e.problem : 'unavailable' }
  }
}

export const fetchChildren = (backend: Backend | null, s: AdminSession, fetchFn: typeof fetch = fetch) =>
  rpc<ChildRecord[]>(backend, 'admin_children', { p_admin_key: s.adminKey }, fetchFn)

export const resetPassword = (backend: Backend | null, s: AdminSession, childId: string, fetchFn: typeof fetch = fetch) =>
  rpc<boolean>(backend, 'admin_reset_password', { p_admin_key: s.adminKey, p_child: childId }, fetchFn)

export const addChild = (backend: Backend | null, s: AdminSession, displayName: string, names: string[], fetchFn: typeof fetch = fetch) =>
  rpc<{ id: string }>(backend, 'admin_add_child', { p_admin_key: s.adminKey, p_display_name: displayName, p_names: names }, fetchFn)
