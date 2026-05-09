interface Props {
  glowing?: boolean;
  size?: number;
}

export function DeviceIcon({ glowing = false, size = 64 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="dev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1c2046" />
          <stop offset="100%" stopColor="#0b0d20" />
        </linearGradient>
      </defs>
      <rect x="14" y="14" width="36" height="36" rx="4" fill="url(#dev)" stroke="#5b8def" strokeWidth="1.5" />
      <rect x="20" y="20" width="24" height="14" rx="1" fill="#02030a" stroke="#1c2046" />
      <circle cx="24" cy="42" r="2" fill={glowing ? "#4dd0e1" : "#1c2046"} />
      <circle cx="32" cy="42" r="2" fill={glowing ? "#a78bfa" : "#1c2046"} />
      <circle cx="40" cy="42" r="2" fill={glowing ? "#f472b6" : "#1c2046"} />
      <text x="32" y="30" fontSize="6" textAnchor="middle" fill="#4dd0e1" fontFamily="monospace">
        ARMORY
      </text>
    </svg>
  );
}
