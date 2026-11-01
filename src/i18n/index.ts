/**
 * Quiera's languages. Texts live in one dictionary per language: `fr` is
 * the source, and `en` must have every entry (its type is `fr`'s), so a
 * text missing in English fails the build.
 *
 * The language is the setting's, or for "system" Windows' display
 * language (the web view's navigator.language): French for French,
 * English for everything else.
 */
import { useSettings, settingsNow } from "../settings/store";
import type { Language } from "../ipc/settings";
import { fr } from "./fr";
import { en } from "./en";

export type Messages = typeof fr;
export type Lang = "fr" | "en";

export function resolveLang(setting: Language, system = navigator.language): Lang {
  if (setting === "fr" || setting === "en") return setting;
  return system.toLowerCase().startsWith("fr") ? "fr" : "en";
}

const DICTIONARIES: Record<Lang, Messages> = { fr, en };

/** The texts in the current language, re-rendering when it changes. */
export function useT(): Messages {
  return DICTIONARIES[resolveLang(useSettings().general.language)];
}

/** The texts now, outside React. */
export function tNow(): Messages {
  return DICTIONARIES[resolveLang(settingsNow().general.language)];
}

/** "fr-FR" or "en-GB": for dates, numbers and sorting. */
export function localeOf(lang: Lang): string {
  return lang === "fr" ? "fr-FR" : "en-GB";
}

export function useLang(): Lang {
  return resolveLang(useSettings().general.language);
}
