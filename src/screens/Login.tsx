import { useEffect, useState, type FormEvent } from 'react'
import { Mascot } from '../components/Mascot'
import { login, register, type Account, type Backend, type LoginResult } from '../storage/account'

type Problem = Extract<LoginResult, { ok: false }>['reason'] | 'mismatch'

const ERRORS: Record<Problem, string> = {
  wrong: 'השם או הסיסמה לא נכונים. נסו שוב!',
  needs_password: 'עוד אין לך סיסמה. בואו נבחר אחת!',
  unknown: 'לא מצאנו את השם הזה. בודקים שהוא כתוב נכון?',
  already_registered: 'לשם הזה כבר יש סיסמה. נכנסים איתה.',
  weak: 'הסיסמה צריכה להיות לפחות 4 אותיות או מספרים.',
  mismatch: 'שתי הסיסמאות לא אותו דבר. נסו שוב.',
  locked: 'יותר מדי ניסיונות. מחכים כמה דקות ומנסים שוב.',
  offline: 'אין אינטרנט כרגע. בפעם הראשונה צריך אינטרנט כדי להיכנס.',
  unavailable: 'משהו לא עובד כרגע. נסו שוב עוד מעט.',
}

/**
 * The first screen on a device: the child's name and password. The first time, the child
 * picks the password (typed twice); a login with no password yet switches here by itself.
 */
export function Login({ backend, onLogin }: { backend: Backend | null; onLogin: (a: Account) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#9157f0')
  }, [])

  const switchTo = (m: 'login' | 'register', why: Problem | null = null) => {
    setMode(m)
    setPassword('')
    setAgain('')
    setProblem(why)
  }

  const ready = name.trim() && password && (mode === 'login' || again)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !ready) return
    if (mode === 'register' && password !== again) {
      setProblem('mismatch')
      setAgain('')
      return
    }
    if (mode === 'register' && password.length < 4) return setProblem('weak')
    setBusy(true)
    setProblem(null)
    const res = await (mode === 'login' ? login : register)(backend, name, password)
    setBusy(false)
    if (res.ok) return onLogin(res.account)
    if (res.reason === 'needs_password') return switchTo('register', 'needs_password')
    if (res.reason === 'already_registered') return switchTo('login', 'already_registered')
    setProblem(res.reason)
    if (res.reason === 'wrong') setPassword('')
  }

  const passwordInput = (value: string, set: (v: string) => void, label: string, autoComplete: string) => (
    <label className="field">
      <span>{label}</span>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => set(e.target.value)}
        autoComplete={autoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        dir="ltr"
        maxLength={100}
      />
    </label>
  )

  return (
    <main className="login">
      <div className="login-art" aria-hidden>
        <span className="hero-spark s1" />
        <span className="hero-spark s2" />
        <span className="hero-spark s3" />
        <Mascot size={132} mood={problem === 'wrong' || problem === 'mismatch' ? 'think' : mode === 'register' ? 'cheer' : 'happy'} />
      </div>
      <form className="login-card" onSubmit={submit}>
        <h1>{mode === 'login' ? 'היי! מי פה?' : 'בוחרים סיסמה'}</h1>
        <p className="login-sub">{mode === 'login' ? 'מכניסים שם וסיסמה, ומתחילים לשחק' : 'סיסמה סודית שקל לזכור. כותבים אותה פעמיים.'}</p>
        <label className="field">
          <span>השם שלי</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            dir="auto"
            maxLength={40}
          />
        </label>
        {passwordInput(password, setPassword, mode === 'login' ? 'סיסמה' : 'סיסמה חדשה', mode === 'login' ? 'current-password' : 'new-password')}
        {mode === 'register' && passwordInput(again, setAgain, 'שוב את אותה סיסמה', 'new-password')}
        <button type="button" className="show-btn" onClick={() => setShow((s) => !s)} aria-pressed={show}>
          {show ? '🙈 להסתיר את הסיסמה' : '👀 להראות את הסיסמה'}
        </button>
        {problem && (
          <p className="login-error" role="alert">
            {ERRORS[problem]}
          </p>
        )}
        <button className="btn btn-primary btn-wide login-go" type="submit" disabled={busy || !ready}>
          {busy ? 'רגע...' : mode === 'login' ? 'כניסה' : 'שומרים ונכנסים'}
        </button>
        <button type="button" className="switch-btn" onClick={() => switchTo(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'פעם ראשונה כאן? בוחרים סיסמה' : 'כבר יש לי סיסמה'}
        </button>
      </form>
      <a className="parents-link" href="#/admin">
        כניסת הורים
      </a>
    </main>
  )
}
