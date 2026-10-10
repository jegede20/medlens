// MedLens logo: four rounded scanner corner brackets around a diagonal two-tone capsule.

export function LogoMark({ onDark = false, size = 40 }: { onDark?: boolean; size?: number }) {
  const bracket = onDark ? "#FFFFFF" : "#0B5C5C";
  const left = onDark ? "#3E9C93" : "#0B5C5C";
  return (
    <svg width={`${size / 18}rem`} height={`${size / 18}rem`} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <g stroke={bracket} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 15v-5a5 5 0 0 1 5-5h5" />
        <path d="M33 5h5a5 5 0 0 1 5 5v5" />
        <path d="M43 33v5a5 5 0 0 1-5 5h-5" />
        <path d="M15 43h-5a5 5 0 0 1-5-5v-5" />
      </g>
      <g transform="rotate(-45 24 24)">
        <path d="M24 18.5h-7.5a5.5 5.5 0 0 0 0 11H24z" fill={left} />
        <path d="M24 18.5h7.5a5.5 5.5 0 0 1 0 11H24z" fill="#E8A33D" />
        <path d="M27 21.6h3.6" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function Logo({ onDark = false, size = 40 }: { onDark?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark onDark={onDark} size={size} />
      <span className={`font-display text-[1.35rem] font-bold tracking-tight ${onDark ? "text-white" : "text-teal"}`}>MedLens</span>
    </span>
  );
}
