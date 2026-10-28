import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Mirrors `NotificationItem` in `src-tauri/src/notifications.rs`. */
export interface NotificationItem {
  id: number;
  app: string;
  title: string;
  body: string;
  arrivedAt: number;
  /** The app's icon URL. */
  icon: string | null;
}

export const getNotifications = () => invoke<NotificationItem[]>("notifications_items");
/** Opens the app that sent it (the notification is then done with). */
export const openNotification = (id: number) => invoke<void>("notification_open", { id });
/** Removes it here and from the Windows notification centre. */
export const dismissNotification = (id: number) => invoke<void>("notification_dismiss", { id });
export const clearNotifications = () => invoke<void>("notifications_clear");
/** Opens a web or mail link in the default browser. */
export const openLink = (url: string) => invoke<void>("open_link", { url });

export function onNotifications(callback: (items: NotificationItem[]) => void): Promise<UnlistenFn> {
  return listen<NotificationItem[]>("notifications://changed", (event) => callback(event.payload));
}
