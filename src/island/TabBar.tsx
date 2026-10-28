import { motion } from "motion/react";
import type { Tab } from "../machine/island-machine";
import { NoteIcon } from "../modules/media/icons";
import { ClipboardIcon } from "../modules/clipboard/icons";
import { TrayIcon } from "../modules/shelf/icons";
import "./tabs.css";

/** Height the tab bar adds on top of the open panel. */
export const TAB_BAR_HEIGHT = 32;

function ClockIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

interface TabBarProps {
  tab: Tab;
  hasMedia: boolean;
  shelfCount: number;
  clipboardCount: number;
  onSelect(tab: Tab): void;
}

/** Whether a tab is offered: home always; the others once they hold something, or while shown. */
export function tabShown(id: Tab, current: Tab, count: number): boolean {
  return id === "home" || count > 0 || id === current;
}

/** Icon tabs above the open panel; the active one sits on a soft pill. */
export function TabBar({ tab, hasMedia, shelfCount, clipboardCount, onSelect }: TabBarProps) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "home" as Tab, label: hasMedia ? "Lecture" : "Heure", icon: hasMedia ? <NoteIcon size={17} /> : <ClockIcon /> },
    { id: "shelf" as Tab, label: "Shelf", icon: <TrayIcon size={18} />, badge: shelfCount },
    { id: "clipboard" as Tab, label: "Presse-papiers", icon: <ClipboardIcon size={17} />, badge: clipboardCount },
  ].filter((t) => tabShown(t.id, tab, t.badge ?? 0));
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tab === t.id}
          aria-label={t.label}
          title={t.label}
          className={`tab ${tab === t.id ? "tab--active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(t.id);
          }}
        >
          {tab === t.id && (
            <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
          )}
          <span className="tab-icon">{t.icon}</span>
          {t.badge ? <span className="tab-badge">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
