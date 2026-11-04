/**
 * The island's tabs, in one place: which exist, when each is offered, and
 * how the settings arrange them. Plugins' tabs join the built-in ones.
 */
import type { PluginInfo } from "../ipc/plugins";
import type { Tab } from "../machine/island-machine";

export interface TabDef {
  id: Tab;
  /** "always": offered even empty; "content": once it holds something. */
  when: "always" | "content";
  /** Home is where the island opens: it cannot be hidden. */
  hideable: boolean;
}

/** In their default order. */
export const TABS: readonly TabDef[] = [
  { id: "home", when: "always", hideable: false },
  { id: "timer", when: "always", hideable: true },
  { id: "controls", when: "always", hideable: true },
  { id: "notifications", when: "content", hideable: true },
  { id: "shelf", when: "content", hideable: true },
  { id: "clipboard", when: "content", hideable: true },
];

/** The tabs of the running plugins that have one, after the built-in ones. */
export function pluginTabs(plugins: readonly PluginInfo[]): TabDef[] {
  return plugins
    .filter((p) => p.running && p.tab)
    .map((p) => ({ id: `plugin:${p.id}` as Tab, when: p.tab!.when, hideable: true }));
}

/**
 * The tabs in the order the settings give, the ones they do not name after
 * them in the default order. Home always comes first: the island opens on it.
 */
export function orderTabs(order: readonly string[], plugins: readonly TabDef[] = []): TabDef[] {
  const all = [...TABS, ...plugins];
  const rank = (def: TabDef) => {
    if (def.id === "home") return -1;
    const at = order.indexOf(def.id);
    return at >= 0 ? at : order.length + all.indexOf(def);
  };
  return all.sort((a, b) => rank(a) - rank(b));
}

/**
 * Whether a tab is in the bar: not hidden in the settings, and offered by its
 * rule (`count`: what it holds). The tab on screen always is, so that what
 * the island opened on (a notification, the timer) keeps its tab.
 */
export function tabShown(def: TabDef, current: Tab, count: number, hidden: readonly string[]): boolean {
  if (def.id === current) return true;
  if (def.hideable && hidden.includes(def.id)) return false;
  return def.when === "always" || count > 0;
}
