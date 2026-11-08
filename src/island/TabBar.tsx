import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { Tab } from "../machine/island-machine";
import { NoteIcon } from "../modules/media/icons";
import { ClipboardIcon } from "../modules/clipboard/icons";
import { BellIcon } from "../modules/notifications/icons";
import { SlidersIcon } from "../modules/controls/icons";
import { TrayIcon } from "../modules/shelf/icons";
import { TimerIcon } from "../modules/timer/TimerViews";
import { CalendarIcon } from "../modules/calendar/CalendarViews";
import { MirrorIcon } from "../modules/mirror/MirrorView";
import { AgentsIcon } from "../modules/agents/AgentsViews";
import { useT, type Messages } from "../i18n";
import { orderTabs, tabShown } from "./tabs";
import { openSettings } from "../ipc/settings";
import "./tabs.css";

/** Height the tab bar adds on top of the open panel. */
export const TAB_BAR_HEIGHT = 32;

export function ClockIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

/** Each tab's name and icon; home shows the player, or the clock without music. */
export function tabFace(id: Tab, labels: Messages["tabs"], hasMedia: boolean): { label: string; icon: ReactNode } {
  switch (id) {
    case "home":
      return hasMedia ? { label: labels.playing, icon: <NoteIcon size={17} /> } : { label: labels.clock, icon: <ClockIcon /> };
    case "timer":
      return { label: labels.timer, icon: <TimerIcon size={17} /> };
    case "calendar":
      return { label: labels.calendar, icon: <CalendarIcon size={17} /> };
    case "agents":
      return { label: labels.agents, icon: <AgentsIcon size={17} /> };
    case "controls":
      return { label: labels.controls, icon: <SlidersIcon size={17} /> };
    case "mirror":
      return { label: labels.mirror, icon: <MirrorIcon size={17} /> };
    case "notifications":
      return { label: labels.notifications, icon: <BellIcon size={17} /> };
    case "shelf":
      return { label: labels.shelf, icon: <TrayIcon size={18} /> };
    case "clipboard":
      return { label: labels.clipboard, icon: <ClipboardIcon size={17} /> };
  }
}

interface TabBarProps {
  tab: Tab;
  hasMedia: boolean;
  /** What each tab holds, shown as a badge. */
  counts: Partial<Record<Tab, number>>;
  /** A badge other than the count, when they differ (agents: those waiting). */
  badges?: Partial<Record<Tab, number>>;
  /** From the settings: the tabs' order and the hidden ones. */
  order: readonly string[];
  hidden: readonly string[];
  onSelect(tab: Tab): void;
}

/** Icon tabs above the open panel; the active one sits on a soft pill. */
export function TabBar({ tab, hasMedia, counts, badges, order, hidden, onSelect }: TabBarProps) {
  const labels = useT().tabs;
  const tabs = orderTabs(order).filter((def) => tabShown(def, tab, counts[def.id] ?? 0, hidden));
  return (
    <div className="tabs" role="tablist">
      {tabs.map(({ id }) => {
        const { label, icon } = tabFace(id, labels, hasMedia);
        // The agenda counts only to be shown, not as a badge.
        const badge = id === "calendar" ? 0 : (badges?.[id] ?? counts[id]);
        return (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            aria-label={label}
            title={label}
            className={`tab ${tab === id ? "tab--active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(id);
            }}
          >
            {tab === id && (
              <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
            )}
            <span className="tab-icon">{icon}</span>
            {badge ? <span className="tab-badge">{badge}</span> : null}
          </button>
        );
      })}
      {/* Not a tab: the settings, in their own window. */}
      <button
        className="tab tab--settings"
        aria-label={labels.settings}
        title={labels.settings}
        onClick={(e) => {
          e.stopPropagation();
          openSettings().catch(() => {});
        }}
      >
        <span className="tab-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
          </svg>
        </span>
      </button>
    </div>
  );
}
