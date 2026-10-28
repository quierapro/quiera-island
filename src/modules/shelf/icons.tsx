interface IconProps {
  size?: number;
}

/** An open tray: the Shelf. */
export function TrayIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
