import { invoke } from "@tauri-apps/api/core";

/** First launch: the island welcomes the user. */
export const welcomeNeeded = () => invoke<boolean>("welcome_needed");
/** The welcome ended; it will not come back. */
export const welcomeDone = () => invoke<void>("welcome_done");
/** Opens the launcher, as its shortcut does. */
export const openLauncher = () => invoke<void>("launcher_open");
