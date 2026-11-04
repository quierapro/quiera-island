/**
 * The plugins, as the island and the settings see them: the list found on
 * disk, what the running ones show, and the latest peek one sent.
 */
import { useSyncExternalStore } from "react";
import { getPluginViews, getPlugins, onPluginPeek, onPluginViews, onPlugins, type PluginInfo, type PluginPeekEvent, type PluginView } from "../../ipc/plugins";

/** Plugins' tabs and activities have ids `plugin:<id>`. */
export const PLUGIN_PREFIX = "plugin:";

let list: PluginInfo[] = [];
let views: PluginView[] = [];
let peek: PluginPeekEvent | null = null;
let started = false;
const listeners = new Set<() => void>();
const peekListeners = new Set<(peek: PluginPeekEvent) => void>();

function publish() {
  for (const l of listeners) l();
}

export function startPlugins(): void {
  if (started) return;
  started = true;
  // Listen first, then ask: a change between the two is not missed.
  onPlugins((next) => {
    list = next;
    publish();
  })
    .then(() => getPlugins())
    .then((next) => {
      list = next;
      publish();
    })
    .catch(() => {});
  onPluginViews((next) => {
    views = next;
    publish();
  })
    .then(() => getPluginViews())
    .then((next) => {
      views = next;
      publish();
    })
    .catch(() => {});
  onPluginPeek((next) => {
    peek = next;
    publish();
    for (const l of peekListeners) l(next);
  }).catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const usePluginList = (): PluginInfo[] => useSyncExternalStore(subscribe, () => list);
export const usePluginViews = (): PluginView[] => useSyncExternalStore(subscribe, () => views);
export const usePluginPeek = (): PluginPeekEvent | null => useSyncExternalStore(subscribe, () => peek);

/** Called with each new peek (to show it on the island). */
export function onPeek(listener: (peek: PluginPeekEvent) => void): () => void {
  peekListeners.add(listener);
  return () => peekListeners.delete(listener);
}
