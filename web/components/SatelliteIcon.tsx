interface Props {
  glowing?: boolean;
  size?: number;
}

export function SatelliteIcon({ glowing = false, size = 64 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={glowing ? "pulse-soft" : undefined}
      aria-hidden
    >
      <defs>
        <linearGradient id="solar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5b8def" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <radialGradient id="halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4dd0e1" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#4dd0e1" stopOpacity="0" />
        </radialGradient>
      </defs>
      {glowing && <circle cx="32" cy="32" r="30" fill="url(#halo)" />}
      <rect x="6" y="26" width="14" height="12" fill="url(#solar)" stroke="#1c2046" strokeWidth="1" />
      <rect x="44" y="26" width="14" height="12" fill="url(#solar)" stroke="#1c2046" strokeWidth="1" />
      <rect x="22" y="22" width="20" height="20" rx="2" fill="#0b0d20" stroke="#5b8def" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="4" fill="#4dd0e1" />
      <line x1="32" y1="22" x2="32" y2="14" stroke="#4dd0e1" strokeWidth="1.5" />
      <circle cx="32" cy="12" r="2" fill="#4dd0e1" />
    </svg>
  );
}
