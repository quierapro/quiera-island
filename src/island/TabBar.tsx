import { motion } from "motion/react";
import type { Tab } from "../machine/island-machine";
import { NoteIcon } from "../modules/media/icons";
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
  onSelect(tab: Tab): void;
}

/** Icon tabs above the open panel; the active one sits on a soft pill. */
export function TabBar({ tab, hasMedia, shelfCount, onSelect }: TabBarProps) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "home", label: hasMedia ? "Lecture" : "Heure", icon: hasMedia ? <NoteIcon size={17} /> : <ClockIcon /> },
    { id: "shelf", label: "Shelf", icon: <TrayIcon size={18} />, badge: shelfCount },
  ];
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
