// Mimi, the app's own bunny (original artwork, no licensed characters).
// Drawn as a bold-outline avatar with headphones: she's the listening coach.
// Bright palette: white fur, navy outline, sky-blue headphones.
type Props = { size?: number; mood?: 'happy' | 'cheer' | 'think'; className?: string }

const INK = '#1f2a5c'
const FUR = '#ffffff'
const INNER = '#ffb3cf'
const GEAR = '#22b0f0'

export function Mascot({ size = 120, mood = 'happy', className }: Props) {
  const cheer = mood === 'cheer'
  const think = mood === 'think'
  return (
    <svg className={`mascot ${cheer ? 'mascot-cheer' : ''} ${className ?? ''}`} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="מימי">
      {/* ears: one up, one folded, for some attitude */}
      <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
        <path d="M38 52 C30 30 30 10 40 6 C50 3 54 26 52 50 Z" fill={FUR} />
        <path d="M68 50 C70 30 78 14 92 12 C102 12 98 26 84 34 C78 38 76 44 76 52 Z" fill={FUR} />
      </g>
      <path d="M42 46 C37 30 38 16 42 13 C46 12 48 28 47 45 Z" fill={INNER} />
      <path d="M73 46 C75 34 81 22 90 18 C93 19 90 25 82 30 C77 34 75 40 75 46 Z" fill={INNER} />

      {/* headphone band */}
      <path d="M22 74 C22 42 98 42 98 74" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d="M22 74 C22 42 98 42 98 74" fill="none" stroke={GEAR} strokeWidth="4.5" strokeLinecap="round" />

      {/* head */}
      <path d="M60 44 C86 44 100 60 100 80 C100 100 84 112 60 112 C36 112 20 100 20 80 C20 60 34 44 60 44 Z" fill={FUR} stroke={INK} strokeWidth="3.5" />

      {/* ear cups */}
      <rect x="11" y="66" width="17" height="28" rx="8" fill={GEAR} stroke={INK} strokeWidth="3.5" />
      <rect x="92" y="66" width="17" height="28" rx="8" fill={GEAR} stroke={INK} strokeWidth="3.5" />

      {/* eyes */}
      {cheer ? (
        <g stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round">
          <path d="M40 80 q6 -8 12 0" />
          <path d="M68 80 q6 -8 12 0" />
        </g>
      ) : (
        <g>
          <ellipse cx="46" cy="79" rx="5.5" ry="7" fill={INK} />
          <ellipse cx="74" cy="79" rx="5.5" ry="7" fill={INK} />
          <circle cx={think ? 46 : 48} cy={think ? 75 : 76} r="2" fill="#fff" />
          <circle cx={think ? 74 : 76} cy={think ? 75 : 76} r="2" fill="#fff" />
          {/* confident brows */}
          <path d={think ? 'M39 68 l12 -2' : 'M40 69 q6 -3 12 0'} stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d={think ? 'M69 66 l12 2' : 'M68 69 q6 -3 12 0'} stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
      )}

      {/* nose + mouth */}
      <path d="M56.5 89 h7 l-3.5 3.5 z" fill="#ff5d8f" stroke="#ff5d8f" strokeWidth="1.5" strokeLinejoin="round" />
      {cheer ? (
        <path d="M51 96 q9 10 18 0 z" fill={INK} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      ) : (
        <path d={think ? 'M54 99 q4 -2 10 0' : 'M53 97 q7 6 14 0'} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
    </svg>
  )
}
