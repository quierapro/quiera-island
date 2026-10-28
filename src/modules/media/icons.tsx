/**
 * Media glyphs drawn for Quiera: filled, rounded, optically centred.
 * (Bloom's are Apple SF Symbols, whose licence limits them to Apple
 * platforms, so none are reused.)
 */

interface IconProps {
  size?: number;
}

export function PlayIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {/* Shifted right: a triangle's visual centre sits left of its box centre. */}
      <path
        fill="currentColor"
        d="M8.5 5.2v13.6c0 .9 1 1.45 1.76.97l10.5-6.8a1.15 1.15 0 0 0 0-1.94L10.26 4.23c-.77-.48-1.76.07-1.76.97Z"
      />
    </svg>
  );
}

export function PauseIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect fill="currentColor" x="6" y="4.5" width="4.2" height="15" rx="1.4" />
      <rect fill="currentColor" x="13.8" y="4.5" width="4.2" height="15" rx="1.4" />
    </svg>
  );
}

/** Two triangles pointing forward; mirrored for "previous". */
export function SkipIcon({ size = 24, back = false }: IconProps & { back?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={back ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        fill="currentColor"
        d="M2.5 7.1v9.8c0 .78.85 1.26 1.52.86L11 13.6v3.3c0 .78.85 1.26 1.52.86l8.1-4.9a1 1 0 0 0 0-1.72l-8.1-4.9A1 1 0 0 0 11 7.1v3.3L4.02 6.24A1 1 0 0 0 2.5 7.1Z"
      />
    </svg>
  );
}

export function NoteIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.4 3.1 9.6 5.2A1.3 1.3 0 0 0 8.6 6.5v8.3a3.6 3.6 0 1 0 1.8 3.1V9.4l7.2-1.7v5.1a3.6 3.6 0 1 0 1.8 3.1V4.4a1.3 1.3 0 0 0-1-1.3Z"
      />
    </svg>
  );
}

export function ShuffleIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7h3.2c2.1 0 3.4 1 4.6 2.8l2.4 4.4c1.2 1.8 2.5 2.8 4.6 2.8H21" />
      <path d="M3 17h3.2c1.4 0 2.4-.45 3.3-1.3M14.5 8.3c.9-.85 1.9-1.3 3.3-1.3H21" />
      <path d="m18 4 3 3-3 3M18 14l3 3-3 3" />
    </svg>
  );
}

/** Repeat; `one` adds the "1" of repeat-track. */
export function RepeatIcon({ size = 24, one = false }: IconProps & { one?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H19M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H5" />
      <path d="m16 3 3 3-3 3M8 21l-3-3 3-3" />
      {one && <path d="M11.3 10.6 12.5 10v4.2" strokeWidth="1.6" />}
    </svg>
  );
}
