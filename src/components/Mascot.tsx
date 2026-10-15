// Mimi, the app's own bunny (original artwork, no licensed characters).
type Props = { size?: number; mood?: 'happy' | 'cheer' | 'think'; className?: string }

export function Mascot({ size = 120, mood = 'happy', className }: Props) {
  const cheer = mood === 'cheer'
  return (
    <svg
      className={`mascot ${cheer ? 'mascot-cheer' : ''} ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="מימי הארנבונה"
    >
      {/* ears */}
      <g className="mascot-ears">
        <ellipse cx="42" cy="28" rx="11" ry="26" fill="#fff" stroke="#e8c6d6" strokeWidth="2" transform="rotate(-12 42 28)" />
        <ellipse cx="42" cy="30" rx="5.5" ry="18" fill="#ffc4d6" transform="rotate(-12 42 30)" />
        <ellipse cx="78" cy="28" rx="11" ry="26" fill="#fff" stroke="#e8c6d6" strokeWidth="2" transform="rotate(12 78 28)" />
        <ellipse cx="78" cy="30" rx="5.5" ry="18" fill="#ffc4d6" transform="rotate(12 78 30)" />
      </g>
      {/* bow */}
      <g transform="translate(84 46)">
        <path d="M0 0 L-12 -8 L-12 8 Z" fill="#c9a7e8" />
        <path d="M0 0 L12 -8 L12 8 Z" fill="#c9a7e8" />
        <circle r="4" fill="#b48ddb" />
      </g>
      {/* head */}
      <ellipse cx="60" cy="76" rx="38" ry="34" fill="#fff" stroke="#e8c6d6" strokeWidth="2" />
      {/* cheeks */}
      <ellipse cx="38" cy="86" rx="7" ry="4.5" fill="#ffb7c5" opacity="0.8" />
      <ellipse cx="82" cy="86" rx="7" ry="4.5" fill="#ffb7c5" opacity="0.8" />
      {/* eyes */}
      {cheer ? (
        <>
          <path d="M40 74 q6 -7 12 0" stroke="#4a3b52" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M68 74 q6 -7 12 0" stroke="#4a3b52" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="46" cy="73" rx="5" ry="6" fill="#4a3b52" />
          <ellipse cx="74" cy="73" rx="5" ry="6" fill="#4a3b52" />
          <circle cx="48" cy="70.5" r="1.8" fill="#fff" />
          <circle cx="76" cy="70.5" r="1.8" fill="#fff" />
        </>
      )}
      {/* nose + mouth */}
      <path d="M56 84 h8 l-4 4 z" fill="#ff8fab" />
      <path
        d={mood === 'think' ? 'M54 94 h12' : 'M53 92 q7 7 14 0'}
        stroke="#4a3b52"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}
