import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { Tab } from "../machine/island-machine";
import { NoteIcon } from "../modules/media/icons";
import { ClipboardIcon } from "../modules/clipboard/icons";
import { BellIcon } from "../modules/notifications/icons";
import { SlidersIcon } from "../modules/controls/icons";
import { TrayIcon } from "../modules/shelf/icons";
import { TimerIcon } from "../modules/timer/TimerViews";
import { useT, type Messages } from "../i18n";
import type { PluginInfo } from "../ipc/plugins";
import { orderTabs, pluginTabs, tabShown } from "./tabs";
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
export function tabFace(id: Tab, labels: Messages["tabs"], hasMedia: boolean, plugins: readonly PluginInfo[] = []): { label: string; icon: ReactNode } {
  switch (id) {
    case "home":
      return hasMedia ? { label: labels.playing, icon: <NoteIcon size={17} /> } : { label: labels.clock, icon: <ClockIcon /> };
    case "timer":
      return { label: labels.timer, icon: <TimerIcon size={17} /> };
    case "controls":
      return { label: labels.controls, icon: <SlidersIcon size={17} /> };
    case "notifications":
      return { label: labels.notifications, icon: <BellIcon size={17} /> };
    case "shelf":
      return { label: labels.shelf, icon: <TrayIcon size={18} /> };
    case "clipboard":
      return { label: labels.clipboard, icon: <ClipboardIcon size={17} /> };
    default: {
      const plugin = plugins.find((p) => `plugin:${p.id}` === id);
      return { label: plugin?.name ?? id.slice("plugin:".length), icon: <span className="tab-emoji">{plugin?.icon ?? "🧩"}</span> };
    }
  }
}

interface TabBarProps {
  tab: Tab;
  hasMedia: boolean;
  /** What each tab holds, shown as a badge. */
  counts: Partial<Record<Tab, number>>;
  /** From the settings: the tabs' order and the hidden ones. */
  order: readonly string[];
  hidden: readonly string[];
  plugins: readonly PluginInfo[];
  onSelect(tab: Tab): void;
}

/** Icon tabs above the open panel; the active one sits on a soft pill. */
export function TabBar({ tab, hasMedia, counts, order, hidden, plugins, onSelect }: TabBarProps) {
  const labels = useT().tabs;
  const tabs = orderTabs(order, pluginTabs(plugins)).filter((def) => tabShown(def, tab, counts[def.id] ?? 0, hidden));
  return (
    <div className="tabs" role="tablist">
      {tabs.map(({ id }) => {
        const { label, icon } = tabFace(id, labels, hasMedia, plugins);
        // Plugins' tabs count only to be shown, not as a badge.
        const badge = id.startsWith("plugin:") ? 0 : counts[id];
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
    </div>
  );
}
