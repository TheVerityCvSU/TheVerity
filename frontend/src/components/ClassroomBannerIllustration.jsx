
/**
 * Reusable banner illustration SVG component for classroom cards and headers.
 * Renders the distinctive vector artwork corresponding to each classroom theme preset.
 */
export default function ClassroomBannerIllustration({
  themeId = 'emerald_books',
  style = {},
  opacity = 1
}) {
  const baseStyle = {
    pointerEvents: 'none',
    opacity,
    ...style
  };

  if (themeId === 'ocean_academia') {
    return (
      <svg
        viewBox="0 0 400 240"
        fill="none"
        preserveAspectRatio="xMaxYMid meet"
        style={baseStyle}
        aria-hidden="true"
      >
        <circle cx="280" cy="120" r="140" fill="#0d47a1" opacity="0.4" />
        <path d="M220 180 L280 60 L340 180" stroke="#60a5fa" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="280" cy="60" r="12" fill="#93c5fd" />
        <path d="M235 150 L325 150" stroke="#93c5fd" strokeWidth="4" />
        <rect x="180" y="80" width="80" height="90" rx="8" fill="#1e3a8a" transform="rotate(-15 180 80)" />
        <line x1="190" y1="100" x2="245" y2="90" stroke="#60a5fa" strokeWidth="3" />
        <line x1="195" y1="120" x2="250" y2="110" stroke="#60a5fa" strokeWidth="3" />
      </svg>
    );
  }

  if (themeId === 'royal_violet') {
    return (
      <svg
        viewBox="0 0 400 240"
        fill="none"
        preserveAspectRatio="xMaxYMid meet"
        style={baseStyle}
        aria-hidden="true"
      >
        <circle cx="300" cy="120" r="150" fill="#581c87" opacity="0.4" />
        <path d="M230 160 C210 100, 350 70, 340 170 C330 200, 250 200, 230 160 Z" fill="#9333ea" />
        <circle cx="260" cy="140" r="8" fill="#f43f5e" />
        <circle cx="280" cy="115" r="8" fill="#38bdf8" />
        <circle cx="310" cy="130" r="8" fill="#facc15" />
        <rect x="200" y="50" width="16" height="130" rx="6" fill="#c084fc" transform="rotate(35 200 50)" />
      </svg>
    );
  }

  if (themeId === 'warm_amber') {
    return (
      <svg
        viewBox="0 0 400 240"
        fill="none"
        preserveAspectRatio="xMaxYMid meet"
        style={baseStyle}
        aria-hidden="true"
      >
        <circle cx="300" cy="120" r="140" fill="#9a3412" opacity="0.4" />
        <rect x="220" y="70" width="100" height="120" rx="10" fill="#f97316" transform="rotate(-12 220 70)" />
        <rect x="240" y="90" width="95" height="115" rx="10" fill="#fed7aa" transform="rotate(15 240 90)" />
        <path d="M220 180 Q270 120 330 70" stroke="#ffedd5" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (themeId === 'midnight_slate') {
    return (
      <svg
        viewBox="0 0 400 240"
        fill="none"
        preserveAspectRatio="xMaxYMid meet"
        style={baseStyle}
        aria-hidden="true"
      >
        <circle cx="290" cy="120" r="140" fill="#1e293b" opacity="0.6" />
        <rect x="210" y="60" width="150" height="100" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="3" />
        <circle cx="225" cy="74" r="3" fill="#ef4444" />
        <circle cx="235" cy="74" r="3" fill="#eab308" />
        <circle cx="245" cy="74" r="3" fill="#22c55e" />
        <path d="M235 110 L250 125 L235 140" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="260" y1="140" x2="280" y2="140" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  // Default: emerald_books
  return (
    <svg
      viewBox="0 0 420 240"
      fill="none"
      preserveAspectRatio="xMaxYMid meet"
      style={baseStyle}
      aria-hidden="true"
    >
      <circle cx="310" cy="120" r="150" fill="#0d5d28" opacity="0.45" />

      <g transform="translate(230, 40) rotate(-28)">
        <rect x="-10" y="-10" width="130" height="150" rx="10" fill="#0f5132" />
        <rect x="0" y="0" width="115" height="135" rx="6" fill="#c6f6d5" />
        <line x1="15" y1="25" x2="100" y2="25" stroke="#9ae6b4" strokeWidth="2.5" />
        <line x1="15" y1="45" x2="100" y2="45" stroke="#9ae6b4" strokeWidth="2.5" />
        <line x1="15" y1="65" x2="100" y2="65" stroke="#9ae6b4" strokeWidth="2.5" />
        <line x1="15" y1="85" x2="100" y2="85" stroke="#9ae6b4" strokeWidth="2.5" />
        <line x1="15" y1="105" x2="100" y2="105" stroke="#9ae6b4" strokeWidth="2.5" />
        <path d="M55 0 L55 90 L62 82 L70 90 L70 0 Z" fill="#fb923c" />
      </g>

      <g transform="translate(270, 75) rotate(14)">
        <rect x="-8" y="-8" width="140" height="145" rx="10" fill="#1e293b" />
        <rect x="0" y="0" width="128" height="132" rx="6" fill="#f8fafc" />
        <line x1="15" y1="25" x2="110" y2="25" stroke="#e2e8f0" strokeWidth="2.5" />
        <line x1="15" y1="45" x2="110" y2="45" stroke="#e2e8f0" strokeWidth="2.5" />
        <line x1="15" y1="65" x2="110" y2="65" stroke="#e2e8f0" strokeWidth="2.5" />
        <line x1="15" y1="85" x2="110" y2="85" stroke="#e2e8f0" strokeWidth="2.5" />
        <line x1="15" y1="105" x2="110" y2="105" stroke="#e2e8f0" strokeWidth="2.5" />

        <path d="M90 0 L90 75 L98 68 L106 75 L106 0 Z" fill="#ef4444" />

        <g transform="translate(-15, 30) rotate(-42)">
          <rect x="0" y="0" width="140" height="24" rx="4" fill="#f43f5e" />
          {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130].map(x => (
            <line key={x} x1={x} y1="0" x2={x} y2={x % 20 === 0 ? "10" : "6"} stroke="white" strokeWidth="1.5" />
          ))}
        </g>
      </g>
    </svg>
  );
}
