// Runs supabase/schema.sql in PGlite (real Postgres in wasm) with Supabase's anon role,
// and checks the player_key policies the app relies on.
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
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

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon nologin; create role authenticated nologin;`)
  await db.exec(schema)
  await db.exec(schema) // re-runnable
})

describe('schema.sql', () => {
  it('lets a player register and append events with their own key', async () => {
    await asAnon(KEY, `insert into players (player_key) values ($1) on conflict do nothing`, [KEY])
    await asAnon(KEY, `insert into players (player_key) values ($1) on conflict do nothing`, [KEY])
    await insertAnswer(KEY, 'a1', 'g', true)
    await insertAnswer(KEY, 'a2', 'e', false)
    await insertAnswer(KEY, 'a1', 'g', true) // re-sent: no-op
    const rows = await asAnon<{ id: string }>(KEY, `select id from play_events order by id`)
    expect(rows.map((r) => r.id)).toEqual(['a1', 'a2'])
  })

  it('hides rows from other keys and from requests without a key', async () => {
    await asAnon(OTHER, `insert into players (player_key) values ($1)`, [OTHER])
    expect(await asAnon(OTHER, `select * from play_events`)).toEqual([])
    expect(await asAnon(null, `select * from play_events`)).toEqual([])
    expect(await asAnon(null, `select * from players`)).toEqual([])
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
})
