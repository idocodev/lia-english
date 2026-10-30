// The parent dashboard (#/admin): its own login (admins, not children), then every child's
// progress. Loaded on demand, so the children's app doesn't carry it.

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { STICKERS } from '../content/stickers'
import type { Backend } from '../storage/account'
import {
  AdminError,
  addChild,
  adminLogin,
  fetchChildren,
  forgetSession,
  loadSession,
  resetPassword,
  saveSession,
  type AdminProblem,
  type AdminSession,
  type ChildRecord,
} from './api'
import {
  badges,
  confusionsOf,
  dailyActivity,
  letterRows,
  pct,
  recentRounds,
  relativeDay,
  summarize,
  type ChildSummary,
  type DayRow,
} from './stats'

const ERRORS: Record<AdminProblem | 'mismatch', string> = {
  wrong: 'השם או הסיסמה לא נכונים.',
  needs_password: 'עוד אין לך סיסמה. בוחרים אחת עכשיו.',
  unknown: 'אין חשבון הורה בשם הזה.',
  already_registered: 'לחשבון הזה כבר יש סיסמה. נכנסים איתה.',
  weak: 'הסיסמה צריכה להיות לפחות 6 תווים.',
  mismatch: 'שתי הסיסמאות לא זהות.',
  locked: 'יותר מדי ניסיונות. מחכים 10 דקות ומנסים שוב.',
  offline: 'אין חיבור לאינטרנט.',
  unavailable: 'משהו לא עובד כרגע. נסו שוב עוד מעט.',
  not_admin: 'החיבור פג. נכנסים שוב.',
  name_taken: 'אחד משמות הכניסה כבר תפוס.',
  bad_name: 'צריך שם תצוגה ולפחות שם כניסה אחד (עד 40 תווים).',
}

export function AdminApp({ backend, route }: { backend: Backend | null; route: string }) {
  const [session, setSession] = useState(loadSession)

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#9157f0')
  }, [])

  const logout = useCallback(() => {
    forgetSession()
    setSession(null)
  }, [])

  if (!session)
    return (
      <AdminLogin
        backend={backend}
        onLogin={(s) => {
          saveSession(s)
          setSession(s)
        }}
      />
    )
  return <Dashboard backend={backend} session={session} route={route} onLogout={logout} />
}

// ---------- login ----------

function AdminLogin({ backend, onLogin }: { backend: Backend | null; onLogin: (s: AdminSession) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<AdminProblem | 'mismatch' | null>(null)

  const switchTo = (m: 'login' | 'register', why: AdminProblem | null = null) => {
    setMode(m)
    setPassword('')
    setAgain('')
    setProblem(why)
  }
  const ready = name.trim() && password && (mode === 'login' || again)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !ready) return
    if (mode === 'register' && password !== again) return setProblem('mismatch')
    if (mode === 'register' && password.length < 6) return setProblem('weak')
    setBusy(true)
    setProblem(null)
    const res = await adminLogin(backend, mode, name, password)
    setBusy(false)
    if (res.ok) return onLogin(res.session)
    if (res.reason === 'needs_password') return switchTo('register', 'needs_password')
    if (res.reason === 'already_registered') return switchTo('login', 'already_registered')
    setProblem(res.reason)
    if (res.reason === 'wrong') setPassword('')
  }

  const pw = (value: string, set: (v: string) => void, label: string, autoComplete: string) => (
    <label className="field">
      <span>{label}</span>
      <input type="password" value={value} onChange={(e) => set(e.target.value)} autoComplete={autoComplete} dir="ltr" maxLength={100} />
    </label>
  )

  return (
    <main className="login admin-login">
      <div className="admin-login-icon" aria-hidden>
        📊
      </div>
      <form className="login-card" onSubmit={submit}>
        <h1>{mode === 'login' ? 'כניסת הורים' : 'בחירת סיסמה'}</h1>
        <p className="login-sub">{mode === 'login' ? 'לוח ההתקדמות של הילדים' : 'בפעם הראשונה בוחרים סיסמה (לפחות 6 תווים)'}</p>
        <label className="field">
          <span>שם</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoCapitalize="off" autoCorrect="off" spellCheck={false} dir="auto" maxLength={40} />
        </label>
        {pw(password, setPassword, mode === 'login' ? 'סיסמה' : 'סיסמה חדשה', mode === 'login' ? 'current-password' : 'new-password')}
        {mode === 'register' && pw(again, setAgain, 'שוב את הסיסמה', 'new-password')}
        {problem && (
          <p className="login-error" role="alert">
            {ERRORS[problem]}
          </p>
        )}
        <button className="btn btn-primary btn-wide login-go" type="submit" disabled={busy || !ready}>
          {busy ? 'רגע...' : mode === 'login' ? 'כניסה' : 'שמירה וכניסה'}
        </button>
        <button type="button" className="switch-btn" onClick={() => switchTo(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'פעם ראשונה? בוחרים סיסמה' : 'כבר יש לי סיסמה'}
        </button>
        <a className="switch-btn admin-back-link" href="#/">
          חזרה למשחק
        </a>
      </form>
    </main>
  )
}

// ---------- dashboard ----------

type Load = { state: 'loading' } | { state: 'error'; problem: AdminProblem } | { state: 'ready'; children: ChildRecord[]; at: Date }

function Dashboard({ backend, session, route, onLogout }: { backend: Backend | null; session: AdminSession; route: string; onLogout: () => void }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })

  const refresh = useCallback(async () => {
    try {
      const children = await fetchChildren(backend, session)
      setLoad({ state: 'ready', children, at: new Date() })
    } catch (e) {
      const problem = e instanceof AdminError ? e.problem : 'unavailable'
      if (problem === 'not_admin') return onLogout()
      setLoad((l) => (l.state === 'ready' ? l : { state: 'error', problem }))
    }
  }, [backend, session, onLogout])

  useEffect(() => {
    void refresh()
    const on = () => document.visibilityState === 'visible' && void refresh()
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [refresh])

  const summaries = useMemo(() => (load.state === 'ready' ? load.children.map((c) => summarize(c, load.at)) : []), [load])
  const childMatch = route.match(/^\/admin\/child\/([\w-]+)$/)
  const go = (to: string) => (window.location.hash = to)

  if (load.state !== 'ready')
    return (
      <AdminFrame title="לוח הורים" onLogout={onLogout}>
        {load.state === 'loading' ? (
          <p className="hint">טוען...</p>
        ) : (
          <>
            <p className="login-error">{ERRORS[load.problem]}</p>
            <button className="btn btn-soft" onClick={() => void refresh()}>
              לנסות שוב
            </button>
          </>
        )}
      </AdminFrame>
    )

  if (route === '/admin/new')
    return (
      <AdminFrame title="ילד/ה חדש/ה" onBack={() => go('/admin')} onLogout={onLogout}>
        <AddChild
          onAdd={async (show, names) => {
            const { id } = await addChild(backend, session, show, names)
            await refresh()
            go(`/admin/child/${id}`)
          }}
        />
      </AdminFrame>
    )

  if (childMatch) {
    const s = summaries.find((c) => c.id === childMatch[1])
    if (s)
      return (
        <AdminFrame title={s.name} onBack={() => go('/admin')} onLogout={onLogout}>
          <ChildDetail
            s={s}
            now={load.at}
            onReset={async () => {
              await resetPassword(backend, session, s.id)
              await refresh()
            }}
          />
        </AdminFrame>
      )
  }

  return (
    <AdminFrame title="לוח הורים" sub={`שלום ${session.name}`} onLogout={onLogout}>
      <ul className="rows">
        {summaries.map((s) => (
          <li key={s.id}>
            <ChildCard s={s} now={load.at} onOpen={() => go(`/admin/child/${s.id}`)} />
          </li>
        ))}
      </ul>
      {!summaries.length && <p className="hint">עוד אין ילדים.</p>}
      <button className="btn btn-soft btn-wide" onClick={() => go('/admin/new')}>
        + ילד/ה חדש/ה
      </button>
      <p className="admin-foot">
        עודכן {load.at.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} ·{' '}
        <button className="link-btn" onClick={() => void refresh()}>
          רענון
        </button>
      </p>
    </AdminFrame>
  )
}

function AdminFrame({ title, sub, onBack, onLogout, children }: { title: string; sub?: string; onBack?: () => void; onLogout: () => void; children: ReactNode }) {
  return (
    <div className="app">
      <main className="screen inner admin">
        <header className="topbar">
          <div className="topbar-row">
            {onBack ? (
              <button className="back-btn" onClick={onBack} aria-label="חזרה">
                <Icon name="back" size={26} />
              </button>
            ) : (
              <span />
            )}
            <span className="admin-kicker">{sub ?? 'לוח הורים'}</span>
            <button className="admin-logout" onClick={onLogout}>
              יציאה
            </button>
          </div>
          <h1 className="topbar-title">{title}</h1>
        </header>
        <div className="sheet">{children}</div>
      </main>
    </div>
  )
}

function Stat({ icon, label, value, sub }: { icon: string; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-label">
        <span aria-hidden>{icon}</span> {label}
      </span>
      <b className="stat-value">{value}</b>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}

function ChildCard({ s, now, onOpen }: { s: ChildSummary; now: Date; onOpen: () => void }) {
  return (
    <button className="child-card" onClick={onOpen}>
      <div className="child-card-head">
        <span className="child-avatar" aria-hidden>
          {s.name.slice(0, 1)}
        </span>
        <div className="row-main">
          <span className="row-title">{s.name}</span>
          <span className="row-sub">
            משחק אחרון: {relativeDay(s.lastPlayed, now)}
            {!s.hasPassword && ' · עוד בלי סיסמה'}
          </span>
        </div>
        <Icon name="next" size={22} />
      </div>
      <div className="stats">
        <Stat icon="🔥" label="רצף" value={s.streak.current} sub={`שיא ${s.streak.best}`} />
        <Stat icon="📅" label="ימי משחק" value={s.daysPlayed} />
        <Stat icon="🎯" label="דיוק" value={pct(s.accuracy)} sub={`${s.answers} תשובות`} />
        <Stat icon="⭐" label="רמה" value={s.level.level} sub={`${s.xp} XP`} />
        <Stat icon="🔤" label="אותיות" value={`${s.lettersSeen}/${s.totalLetters}`} sub={`${s.lettersMastered} שולטים`} />
      </div>
    </button>
  )
}

// ---------- one child ----------

function ChildDetail({ s, now, onReset }: { s: ChildSummary; now: Date; onReset: () => Promise<void> }) {
  const letters = letterRows(s.save)
  const weak = letters.filter((l) => l.weak)
  const confusions = confusionsOf(s.save)
  const rounds = recentRounds(s.save)
  const days = dailyActivity(s.save, now, 30)
  const earned = badges(s.save, now)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const reset = async () => {
    if (!window.confirm(`לאפס את הסיסמה של ${s.name}? בכניסה הבאה בוחרים סיסמה חדשה (כדאי לעשות את זה רק כשעומדים להיכנס).`)) return
    setBusy(true)
    try {
      await onReset()
      setNote(`הסיסמה אופסה. נכנסים עם השם ${s.loginNames[0] ?? s.name} ובוחרים סיסמה חדשה.`)
    } catch (e) {
      setNote(ERRORS[e instanceof AdminError ? e.problem : 'unavailable'])
    }
    setBusy(false)
  }

  return (
    <>
      <p className="row-sub">
        משחק אחרון: {relativeDay(s.lastPlayed, now)} · שמות כניסה: <span dir="auto">{s.loginNames.join(', ')}</span>
      </p>
      <div className="stats">
        <Stat icon="🔥" label="רצף" value={s.streak.current} sub={`שיא ${s.streak.best}`} />
        <Stat icon="📅" label="ימי משחק" value={s.daysPlayed} />
        <Stat icon="✍️" label="תשובות" value={s.answers} sub={`${s.right} נכונות`} />
        <Stat icon="🎯" label="דיוק" value={pct(s.accuracy)} />
        <Stat icon="⭐" label="רמה" value={s.level.level} sub={`${s.xp} XP`} />
        <Stat icon="🔤" label="אותיות" value={`${s.lettersSeen}/${s.totalLetters}`} sub={`${s.lettersMastered} שולטים`} />
      </div>

      <section className="admin-section">
        <h2 className="section-title">פעילות ב-30 הימים האחרונים</h2>
        <ActivityChart days={days} />
      </section>

      <section className="admin-section">
        <h2 className="section-title">מה צריך חיזוק</h2>
        {weak.length || confusions.length ? (
          <ul className="focus-list">
            {weak.map((l) => (
              <li key={l.id}>
                <span className="tag tag-weak">⚠ חלש</span>
                <span lang="en" className="focus-letter">
                  {l.upper}
                </span>
                {pct(l.accuracy)} נכון ({l.right} מתוך {l.right + l.wrong})
              </li>
            ))}
            {confusions.map((c) => (
              <li key={`${c.target}>${c.chosen}`}>
                <span className="tag tag-mix">↔ בלבול</span>
                כשצריך{' '}
                <span lang="en" className="focus-letter">
                  {c.target.toUpperCase()}
                </span>{' '}
                בחר/ה{' '}
                <span lang="en" className="focus-letter">
                  {c.chosen.toUpperCase()}
                </span>{' '}
                · {c.count} {c.count === 1 ? 'פעם' : 'פעמים'}
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">{s.answers ? 'אין אותיות חלשות כרגע 👏' : 'עוד אין מספיק משחק.'}</p>
        )}
      </section>

      <section className="admin-section">
        <h2 className="section-title">דיוק לפי אות</h2>
        <ul className="letter-acc">
          {letters.map((l) => (
            <li key={l.id} className={l.seen ? '' : 'unseen'}>
              <span lang="en" className="la-letter">
                {l.upper}
              </span>
              <span className="la-bar" aria-hidden>
                <span style={{ width: `${Math.round((l.accuracy ?? 0) * 100)}%` }} />
              </span>
              <span className="la-num">{l.right + l.wrong ? `${pct(l.accuracy)} · ${l.right}/${l.right + l.wrong}` : l.seen ? 'נפתח, בלי תשובות' : 'לא נפתח'}</span>
              {l.weak ? <span className="tag tag-weak">⚠ חלש</span> : l.mastered ? <span className="tag tag-good">✓ שולט/ת</span> : <span className="tag tag-none" />}
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-section">
        <h2 className="section-title">סיבובים אחרונים</h2>
        {rounds.length ? (
          <ul className="round-list">
            {rounds.map((r) => (
              <li key={r.id}>
                <span>
                  {relativeDay(r.at, now)}, {new Date(r.at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <b>
                  {r.right}/{r.answers}
                </b>
                <span className="la-bar" aria-hidden>
                  <span style={{ width: `${Math.round((r.right / r.answers) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">עוד אין סיבובים.</p>
        )}
      </section>

      <section className="admin-section">
        <h2 className="section-title">
          מדבקות ({s.save.stickers.length}/{STICKERS.length})
        </h2>
        {s.save.stickers.length ? <p className="admin-stickers">{s.save.stickers.join(' ')}</p> : <p className="hint">עוד אין מדבקות.</p>}
        <ul className="admin-badges">
          {earned.map((b) => (
            <li key={b.id} className={b.earned ? 'earned' : ''} title={b.how}>
              <span aria-hidden>{b.icon}</span> {b.name} {b.earned ? '✓' : ''}
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-section">
        <h2 className="section-title">חשבון</h2>
        <p className="row-sub">{s.hasPassword ? 'יש סיסמה.' : 'עוד אין סיסמה: בכניסה הראשונה בוחרים אחת.'}</p>
        {note && <p className="login-error">{note}</p>}
        {s.hasPassword && (
          <button className="btn btn-soft" onClick={() => void reset()} disabled={busy}>
            איפוס סיסמה
          </button>
        )}
      </section>
    </>
  )
}

const WEEKDAY = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
const dayLabel = (key: string, withWeekday = true) => {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${withWeekday ? `יום ${WEEKDAY[dt.getDay()]} ` : ''}${d}.${m}`
}

/** Answers per day, one bar per day (today on the left: the chart reads right to left like the page). */
function ActivityChart({ days }: { days: DayRow[] }) {
  const [sel, setSel] = useState(days.length - 1)
  const W = 320
  const H = 120
  const pad = 18
  const max = Math.max(5, ...days.map((d) => d.answers))
  const slot = W / days.length
  const bw = Math.max(3, slot - 3)
  const cur = days[sel]
  // Right to left: the oldest day at the right edge.
  const x = (i: number) => W - (i + 1) * slot + (slot - bw) / 2
  const bar = (i: number, v: number) => {
    const h = Math.max(v ? 3 : 0, (v / max) * (H - pad))
    const r = Math.min(4, bw / 2, h)
    const x0 = x(i)
    const y0 = H - h
    return `M${x0},${H} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + bw - r} Q${x0 + bw},${y0} ${x0 + bw},${y0 + r} V${H} Z`
  }
  const total = days.reduce((a, d) => a + d.answers, 0)
  const active = days.filter((d) => d.answers).length

  return (
    <div className="chart">
      <p className="chart-readout" aria-live="polite">
        <b>{dayLabel(cur.day)}</b>: {cur.answers ? `${cur.answers} תשובות, ${pct(cur.right / cur.answers)} נכון` : 'לא שיחק/ה'}
      </p>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="chart-svg" role="img" aria-label={`${total} תשובות ב-${active} ימים מתוך ${days.length}`}>
        <text x={W} y={10} className="chart-axis" textAnchor="end">
          {max}
        </text>
        <line x1={0} x2={W} y1={pad - 4} y2={pad - 4} className="chart-grid" />
        {days.map((d, i) => d.answers > 0 && <path key={d.day} d={bar(i, d.answers)} className={i === sel ? 'chart-bar on' : 'chart-bar'} />)}
        <line x1={0} x2={W} y1={H} y2={H} className="chart-base" />
        {days.map((d, i) => (
          <rect
            key={d.day}
            x={W - (i + 1) * slot}
            y={0}
            width={slot}
            height={H + 18}
            fill="transparent"
            onPointerEnter={() => setSel(i)}
            onClick={() => setSel(i)}
          />
        ))}
        <text x={W} y={H + 14} className="chart-axis" textAnchor="end">
          {dayLabel(days[0].day, false)}
        </text>
        <text x={0} y={H + 14} className="chart-axis" textAnchor="start">
          היום
        </text>
      </svg>
      <p className="chart-foot">
        {total} תשובות ב-{active} ימים
      </p>
      <table className="sr-only">
        <caption>תשובות לפי יום</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th>{dayLabel(d.day)}</th>
              <td>{d.answers}</td>
              <td>{d.right}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------- add a child ----------

function AddChild({ onAdd }: { onAdd: (show: string, names: string[]) => Promise<void> }) {
  const [show, setShow] = useState('')
  const [names, setNames] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<AdminProblem | null>(null)
  const list = (names.trim() ? names : show).split(/[,،\n]/).map((n) => n.trim()).filter(Boolean)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !show.trim() || !list.length) return
    setBusy(true)
    setProblem(null)
    try {
      await onAdd(show.trim(), list)
    } catch (err) {
      setProblem(err instanceof AdminError ? err.problem : 'unavailable')
      setBusy(false)
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label className="field">
        <span>שם (כמו שיופיע במשחק)</span>
        <input value={show} onChange={(e) => setShow(e.target.value)} dir="auto" maxLength={40} placeholder="נועם" />
      </label>
      <label className="field">
        <span>שמות כניסה, מופרדים בפסיק</span>
        <input value={names} onChange={(e) => setNames(e.target.value)} dir="auto" maxLength={200} autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={show ? show : 'noam, נועם'} />
      </label>
      <p className="row-sub">
        בכניסה הראשונה הילד/ה מקליד/ה אחד משמות הכניסה ובוחר/ת סיסמה.
        {list.length > 0 && (
          <>
            {' '}
            שמות כניסה: <b dir="auto">{list.join(', ')}</b>
          </>
        )}
      </p>
      {problem && <p className="login-error">{ERRORS[problem]}</p>}
      <button className="btn btn-primary btn-wide" type="submit" disabled={busy || !show.trim() || !list.length}>
        {busy ? 'רגע...' : 'יצירת חשבון'}
      </button>
    </form>
  )
}
