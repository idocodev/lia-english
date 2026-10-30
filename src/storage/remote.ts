// The Supabase side of the cloud save (supabase/schema.sql). Loaded on demand, only when the
// build is configured, so the offline app never downloads supabase-js.

import { createClient } from '@supabase/supabase-js'
import type { SyncEvent } from './journal'
import type { Remote, SyncConfig } from './sync'

type Row = {
  player_key: string
  id: string
  kind: SyncEvent['kind']
  at: string
  game: string | null
  letter: string | null
  chosen: string | null
  correct: boolean | null
  round_id: string | null
  sticker: string | null
}

export function toRow(playerKey: string, e: SyncEvent): Row {
  const row: Row = { player_key: playerKey, id: e.id, kind: e.kind, at: e.at, game: null, letter: null, chosen: null, correct: null, round_id: null, sticker: null }
  if (e.kind === 'answer') Object.assign(row, { game: e.game, letter: e.letter, chosen: e.chosen, correct: e.correct, round_id: e.round ?? null })
  if (e.kind === 'letter_seen') row.letter = e.letter
  if (e.kind === 'sticker') row.sticker = e.sticker
  return row
}

export function fromRow(r: Row): SyncEvent | null {
  // Postgres hands back its own timestamp format; the save uses ISO strings.
  const at = new Date(r.at).toISOString()
  if (r.kind === 'answer' && r.letter && r.chosen && r.correct !== null)
    return { kind: 'answer', id: r.id, at, game: 'sound', letter: r.letter, chosen: r.chosen, correct: r.correct, ...(r.round_id ? { round: r.round_id } : {}) }
  if (r.kind === 'letter_seen' && r.letter) return { kind: 'letter_seen', id: r.id, at, letter: r.letter }
  if (r.kind === 'sticker' && r.sticker) return { kind: 'sticker', id: r.id, at, sticker: r.sticker }
  return null
}

const PAGE = 1000

export function supabaseRemote(cfg: SyncConfig): Remote {
  const db = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-player-key': cfg.playerKey } },
  })
  let registered = false
  const check = <T extends { error: { message: string } | null }>(res: T) => {
    if (res.error) throw new Error(res.error.message)
    return res
  }

  return {
    async push(events) {
      if (!registered) {
        check(await db.from('players').upsert({ player_key: cfg.playerKey }, { onConflict: 'player_key', ignoreDuplicates: true }))
        registered = true
      }
      check(
        await db
          .from('play_events')
          .upsert(events.map((e) => toRow(cfg.playerKey, e)), { onConflict: 'player_key,id', ignoreDuplicates: true }),
      )
    },
    async pull() {
      const out: SyncEvent[] = []
      for (let from = 0; ; from += PAGE) {
        const { data } = check(
          await db.from('play_events').select('*').eq('player_key', cfg.playerKey).order('at').order('id').range(from, from + PAGE - 1),
        )
        const rows = (data ?? []) as Row[]
        for (const r of rows) {
          const e = fromRow(r)
          if (e) out.push(e)
        }
        if (rows.length < PAGE) return out
      }
    },
  }
}
