// Runs supabase/schema.sql in PGlite (real Postgres in wasm) with Supabase's anon role,
// and checks the login and the player_key policies the app relies on.
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { beforeAll, describe, expect, it } from 'vitest'

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
const KEY = 'lia-test-key-0123456789abcdef'
const OTHER = 'someone-else-0123456789abcdef'

let db: PGlite

/** Runs `sql` as the anon role with the given x-player-key header, as PostgREST would. */
async function asAnon<T>(key: string | null, sql: string, params: unknown[] = []) {
  await db.exec('begin')
  try {
    await db.query(`select set_config('request.headers', $1, true)`, [JSON.stringify(key ? { 'x-player-key': key } : {})])
    await db.exec('set local role anon')
    const res = await db.query<T>(sql, params)
    await db.exec('commit')
    return res.rows
  } catch (e) {
    await db.exec('rollback')
    throw e
  }
}

const insertAnswer = (key: string, id: string, letter: string, correct: boolean) =>
  asAnon(
    key,
    `insert into play_events (player_key, id, kind, at, game, letter, chosen, correct, round_id)
     values ($1, $2, 'answer', now(), 'sound', $3, $3, $4, 'r1') on conflict (player_key, id) do nothing`,
    [key, id, letter, correct],
  )

type Answer = { player_key?: string; name?: string; needs_password?: boolean } | null
const call = (fn: 'login' | 'register', name: string | null, password: string | null) =>
  asAnon<{ r: Answer }>(null, `select public.${fn}($1, $2) as r`, [name, password]).then((rows) => rows[0].r)
const login = (name: string | null, password: string | null) => call('login', name, password)
const register = (name: string | null, password: string | null) => call('register', name, password)

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(`create role anon nologin; create role authenticated nologin;`)
  await db.exec(schema)
  // Accounts are made by the owner, as in "Adding a child".
  // Lia's has no password yet: she picks it (register).
  for (const [key, name, show, names] of [
    [KEY, 'Lia', 'ליה', ['lia', 'ליה']],
    [OTHER, 'Noam', 'נועם', ['noam']],
  ] as const) {
    await db.query(`insert into players (player_key, name, display_name) values ($1, $2, $3)`, [key, name, show])
    for (const n of names) await db.query(`insert into player_names (name_lc, player_key) values ($1, $2)`, [n, key])
  }
  await db.query(`update players set password_hash = extensions.crypt('other-pw', extensions.gen_salt('bf', 4)) where name = 'Noam'`)
  await db.exec(schema) // re-runnable, and keeps the accounts
})

describe('register and login', () => {
  it('sends a child with no password yet to register, which only works for an existing account', async () => {
    expect(await login('ליה', 'anything')).toEqual({ needs_password: true })
    expect(await register('stranger', 'pass1')).toBeNull()
    await expect(register('Lia', 'ab')).rejects.toThrow(/weak_password/)
    expect(await register(' ליה ', 'bunny7')).toEqual({ player_key: KEY, name: 'ליה' })
    await expect(register('lia', 'taken-over')).rejects.toThrow(/already_registered/)
    await expect(register('noam', 'taken-over')).rejects.toThrow(/already_registered/)
    expect(await login('lia', 'taken-over')).toBeNull()
    await expect(asAnon(null, `select public.login_failed('lia')`)).rejects.toThrow(/permission denied/)
  })

  it('answers the key and name for a right name and password, in any case and spacing, by any of its names', async () => {
    expect(await login('Lia', 'bunny7')).toEqual({ player_key: KEY, name: 'ליה' })
    expect(await login('  LIA ', 'bunny7')).toEqual({ player_key: KEY, name: 'ליה' })
    expect(await login('ליה', 'bunny7')).toEqual({ player_key: KEY, name: 'ליה' })
    expect(await login('noam', 'other-pw')).toEqual({ player_key: OTHER, name: 'נועם' })
  })

  it('answers null for a wrong password, an unknown name or nothing', async () => {
    expect(await login('Lia', 'bunny8')).toBeNull()
    expect(await login('Lia', 'other-pw')).toBeNull()
    expect(await login('nobody', 'bunny7')).toBeNull()
    expect(await login(null, null)).toBeNull()
  })

  it('keeps accounts, names and hashes out of the app\'s reach', async () => {
    for (const t of ['players', 'player_names', 'login_failures']) {
      await expect(asAnon(KEY, `select * from ${t}`)).rejects.toThrow(/permission denied/)
      await expect(asAnon(KEY, `insert into ${t} values ('x')`)).rejects.toThrow(/permission denied/)
    }
  })

  it('stops guessing after 10 failures for a name, and a success clears them', async () => {
    await db.exec(`delete from login_failures`)
    for (let i = 0; i < 9; i++) expect(await login('noam', `guess-${i}`)).toBeNull()
    expect(await login('noam', 'other-pw')).not.toBeNull() // cleared
    for (let i = 0; i < 10; i++) expect(await login('noam', `guess-${i}`)).toBeNull()
    await expect(login('noam', 'other-pw')).rejects.toThrow(/too_many_attempts/)
    expect(await login('lia', 'bunny7')).not.toBeNull() // other names unaffected
    await db.exec(`delete from login_failures`)
  })
})

describe('schema.sql', () => {
  it('lets a logged-in player append events with their own key', async () => {
    await insertAnswer(KEY, 'a1', 'g', true)
    await insertAnswer(KEY, 'a2', 'e', false)
    await insertAnswer(KEY, 'a1', 'g', true) // re-sent: no-op
    const rows = await asAnon<{ id: string }>(KEY, `select id from play_events order by id`)
    expect(rows.map((r) => r.id)).toEqual(['a1', 'a2'])
  })

  it('hides rows from other keys and from requests without a key', async () => {
    expect(await asAnon(OTHER, `select * from play_events`)).toEqual([])
    expect(await asAnon(null, `select * from play_events`)).toEqual([])
  })

  it('refuses writes under someone else\'s key, and updates or deletes', async () => {
    await expect(asAnon(KEY, `insert into play_events (player_key, id, kind, at) values ($1, 'x1', 'sticker', now())`, [OTHER])).rejects.toThrow()
    await expect(asAnon(null, `insert into play_events (player_key, id, kind, at) values ($1, 'x2', 'sticker', now())`, [KEY])).rejects.toThrow()
    await expect(asAnon(KEY, `update play_events set correct = true`)).rejects.toThrow()
    await expect(asAnon(KEY, `delete from play_events`)).rejects.toThrow()
  })

  it('gives the dashboard views per letter and per round', async () => {
    const letters = await asAnon<{ letter: string; right_answers: number; wrong_answers: number }>(
      KEY,
      `select letter, right_answers::int, wrong_answers::int from letter_stats order by letter`,
    )
    expect(letters).toEqual([
      { letter: 'e', right_answers: 0, wrong_answers: 1 },
      { letter: 'g', right_answers: 1, wrong_answers: 0 },
    ])
    const rounds = await asAnon<{ answers: number }>(KEY, `select answers::int from rounds`)
    expect(rounds).toEqual([{ answers: 2 }])
  })

  it('moves a player\'s events along when the key is rotated, and the old key reads nothing', async () => {
    const NEW = 'lia-rotated-key-0123456789abcdef'
    await db.query(`update players set player_key = $1 where player_key = $2`, [NEW, KEY])
    expect(await asAnon(KEY, `select id from play_events`)).toEqual([])
    expect((await asAnon<{ id: string }>(NEW, `select id from play_events order by id`)).map((r) => r.id)).toEqual(['a1', 'a2'])
    expect(await login('ליה', 'bunny7')).toEqual({ player_key: NEW, name: 'ליה' })
    await db.query(`update players set player_key = $1 where player_key = $2`, [KEY, NEW])
  })
})
