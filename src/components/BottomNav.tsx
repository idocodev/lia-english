import { Icon, type IconName } from './Icon'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'בית', icon: 'home' },
  { to: '/letters', label: 'אותיות', icon: 'book' },
  { to: '/badges', label: 'תגים', icon: 'medal' },
  { to: '/collection', label: 'אוסף', icon: 'gift' },
]

/** White tab bar with a raised round "play" button in the middle. */
export function BottomNav({ route, go }: { route: string; go: (to: string) => void }) {
  const tab = (t: (typeof TABS)[number]) => (
    <button key={t.to} className={`tab ${route === t.to ? 'tab-on' : ''}`} onClick={() => go(t.to)} aria-current={route === t.to ? 'page' : undefined}>
      <Icon name={t.icon} size={26} />
      <span>{t.label}</span>
    </button>
  )
  return (
    <nav className="bottom-nav" aria-label="ניווט">
      {TABS.slice(0, 2).map(tab)}
      <button className="tab-play" onClick={() => go('/game')} aria-label="אתגר הצלילים">
        <Icon name="play" size={30} />
      </button>
      {TABS.slice(2).map(tab)}
    </nav>
  )
}
