interface AnzuLogoProps {
  variant?: "full" | "icon";
  scheme?: "light" | "dark";
  size?: number;
  className?: string;
  animate?: boolean;
  style?: React.CSSProperties;
}

export function AnzuLogo({
  variant = "full",
  scheme = "light",
  size = 32,
  className = "",
  animate = false,
  style,
}: AnzuLogoProps) {
  if (variant === "full") {
    return (
      <img
        src="/landing/anzu-logo.png"
        alt="Anzu Dynamics"
        height={size}
        style={{
          height: `${size}px`,
          width: "auto",
          borderRadius: `${Math.round(size * 0.18)}px`,
          display: "block",
          boxShadow: scheme === "light"
            ? "0 2px 8px rgba(249,115,22,0.22), 0 1px 3px rgba(0,0,0,0.10)"
            : "0 0 12px rgba(249,115,22,0.30)",
          animation: animate ? "phoenix-rise 600ms cubic-bezier(0.16,1,0.3,1) both" : undefined,
          ...style,
        }}
        className={className}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "block", flexShrink: 0, ...style }}
      aria-label="Anzu Dynamics"
      role="img"
    >
      <rect width="40" height="40" rx="9" fill="#F97316" />
      <g fill="#0F172A">
        <ellipse cx="20" cy="21" rx="4" ry="5.5" />
        <circle cx="20" cy="12.5" r="2.8" />
        <polygon points="20,8.5 18.6,11 21.4,11" />
        <path d="M 23.5 19 C 26 17.5 30 15 35.5 7 C 32 11.5 28 15 24.5 17 C 24 17.5 23.5 18 23.5 19 Z" />
        <path d="M 16.5 19 C 14 17.5 10 15 4.5 7 C 8 11.5 12 15 15.5 17 C 16 17.5 16.5 18 16.5 19 Z" />
        <path d="M 18.8 26 L 19.5 34.5 L 20 33 L 20.5 34.5 L 21.2 26 Z" />
        <path d="M 17 25.5 L 14.5 33.5 L 15.5 32 L 16 33.5 L 18.5 25 Z" />
        <path d="M 23 25.5 L 25.5 33.5 L 25 32 L 24.5 33.5 L 21.5 25 Z" />
      </g>
    </svg>
  );
}
