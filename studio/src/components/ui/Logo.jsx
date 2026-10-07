// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright 2026 TraxDinosaur

/**
 * The TriceraSync mark: three three triceratops horns swept into a play triangle — the triceratops
 * behind the name, and the forward motion of playback. Drawn on a 48×48 grid so it stays legible
 * down to favicon size.
 */
export function LogoMark({ size = 28, className = "", withBackdrop = false }) {
  const id = "vsg";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} x1="8" y1="10" x2="40" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB020" />
          <stop offset="1" stopColor="#FF4D1F" />
        </linearGradient>
      </defs>
      {withBackdrop && <rect width="48" height="48" rx="11" fill="#0D0C0F" />}
      <path d="M8 9 Q17 9 26 18 Q17 15 8 15 Z" fill={`url(#${id})`} />
      <path d="M8 20.5 Q24.5 20.5 41 24 Q24.5 27.5 8 27.5 Z" fill={`url(#${id})`} />
      <path d="M8 33 Q17 33 26 30 Q17 39 8 39 Z" fill={`url(#${id})`} />
    </svg>
  );
}

/** Mark plus wordmark, for the header. */
export function Logo({ size = 26, className = "" }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      <span className="font-display text-[17px] font-bold tracking-tight">
        Tricera<span className="text-accent">Sync</span>
      </span>
    </span>
  );
}
