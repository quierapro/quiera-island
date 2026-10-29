/** The app's own glyphs (src/modules/…/icons.tsx), plus a few for the page. */

interface IconProps {
  size?: number;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function PlayIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M8.5 5.2v13.6c0 .9 1 1.45 1.76.97l10.5-6.8a1.15 1.15 0 0 0 0-1.94L10.26 4.23c-.77-.48-1.76.07-1.76.97Z" />
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

export function SkipIcon({ size = 24, back = false }: IconProps & { back?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={back ? { transform: "scaleX(-1)" } : undefined}>
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
      <path fill="currentColor" d="M18.4 3.1 9.6 5.2A1.3 1.3 0 0 0 8.6 6.5v8.3a3.6 3.6 0 1 0 1.8 3.1V9.4l7.2-1.7v5.1a3.6 3.6 0 1 0 1.8 3.1V4.4a1.3 1.3 0 0 0-1-1.3Z" />
    </svg>
  );
}

export function ShuffleIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <path d="M3 7h3.2c2.1 0 3.4 1 4.6 2.8l2.4 4.4c1.2 1.8 2.5 2.8 4.6 2.8H21" />
      <path d="M3 17h3.2c1.4 0 2.4-.45 3.3-1.3M14.5 8.3c.9-.85 1.9-1.3 3.3-1.3H21" />
      <path d="m18 4 3 3-3 3M18 14l3 3-3 3" />
    </svg>
  );
}

export function RepeatIcon({ size = 24, one = false }: IconProps & { one?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H19M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H5" />
      <path d="m16 3 3 3-3 3M8 21l-3-3 3-3" />
      {one && <path d="M11.3 10.6 12.5 10v4.2" strokeWidth="1.6" />}
    </svg>
  );
}

export function ClockIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function SlidersIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.9} aria-hidden="true">
      <path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
      <circle cx="15" cy="8" r="2" />
      <circle cx="9" cy="16" r="2" />
    </svg>
  );
}

export function WifiIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <path d="M3.5 9.5a12 12 0 0 1 17 0M6.5 12.8a7.5 7.5 0 0 1 11 0M9.5 16a3 3 0 0 1 5 0" />
      <circle cx="12" cy="19" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function BluetoothIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <path d="m7 7.5 10 9-5 4.5v-18l5 4.5-10 9" />
    </svg>
  );
}

export function SpeakerIcon({ size = 24, muted = false }: IconProps & { muted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" />
      {muted ? <path d="m16 9.5 5 5m0-5-5 5" /> : <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10" />}
    </svg>
  );
}

export function HeadphonesIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <path d="M4 15v-3a8 8 0 0 1 16 0v3M4 15a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2v-3Zm16 0a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2v-3Z" />
    </svg>
  );
}

export function TrayIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.9} aria-hidden="true">
      <path d="M3.5 13.5 6 5.8A2 2 0 0 1 7.9 4.5h8.2A2 2 0 0 1 18 5.8l2.5 7.7" />
      <path d="M3.5 13.5V17a2.5 2.5 0 0 0 2.5 2.5h12a2.5 2.5 0 0 0 2.5-2.5v-3.5h-4.8a.8.8 0 0 0-.7.45l-.6 1.1a.8.8 0 0 1-.7.45h-3.4a.8.8 0 0 1-.7-.45l-.6-1.1a.8.8 0 0 0-.7-.45Z" />
    </svg>
  );
}

export function CloseIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function ClipboardIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.9} aria-hidden="true">
      <rect x="5.5" y="5" width="13" height="15.5" rx="2.5" />
      <path d="M9 5V4.3a1.3 1.3 0 0 1 1.3-1.3h3.4A1.3 1.3 0 0 1 15 4.3V5" />
      <path d="M9 11h6M9 14.5h4" />
    </svg>
  );
}

export function LinkIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  );
}

export function CheckIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function BellIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={1.9} aria-hidden="true">
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}

export function SearchIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={2.2} aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function GlobeIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5Z" />
    </svg>
  );
}

export function GearIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.1-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2.1 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.1 1.2L10 21h4l.5-2.6a7 7 0 0 0 2.1-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
    </svg>
  );
}

export function EqualsIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={2.4} aria-hidden="true">
      <path d="M6 9.5h12M6 14.5h12" />
    </svg>
  );
}

export function CapsIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={2.2} aria-hidden="true">
      <path d="M12 4 4.5 12H9v4h6v-4h4.5L12 4ZM9 20h6" />
    </svg>
  );
}

export function ChevronIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={2.2} aria-hidden="true">
      <path d="m7 9.5 5 5 5-5" />
    </svg>
  );
}

/** A file's glyph in the launcher and the Shelf, by kind. */
export function FileGlyph({ kind, size = 26 }: { kind: string; size?: number }) {
  const color =
    kind === "image" ? "#ff9f0a" : kind === "video" ? "#bf5af2" : kind === "music" ? "#ff375f" : "#0a84ff";
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <path d="M6 2.5h9.5L21 8v14.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 5 22.5v-18A2 2 0 0 1 6 2.5Z" fill="#e9e9ee" />
      <path d="M15.5 2.5V7a1 1 0 0 0 1 1H21" fill="#c9c9d1" />
      <rect x="7.5" y="14" width="11" height="6.5" rx="1.6" fill={color} />
      {kind === "video" && <path d="m11.6 15.6 3 1.65-3 1.65Z" fill="#fff" />}
      {kind === "music" && <circle cx="13" cy="17.25" r="1.5" fill="#fff" />}
      {kind === "image" && <path d="m9 19.5 2.6-3 1.8 2 1.2-1.3 2 2.3Z" fill="#fff" />}
      {kind === "document" && <path d="M9.5 16.3h7M9.5 18.3h5" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />}
    </svg>
  );
}
