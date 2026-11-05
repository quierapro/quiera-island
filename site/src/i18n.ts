/**
 * The page's two languages: French at quiera.eu, English at quiera.eu/en/.
 * Texts are written side by side where they are used, French first:
 * `tr("Télécharger", "Download")`.
 */
import { createContext, useContext } from "react";

export type Lang = "fr" | "en";

export const LangContext = createContext<Lang>("fr");

export function useLang(): Lang {
  return useContext(LangContext);
}

export type Tr = (fr: string, en: string) => string;

export const translate =
  (lang: Lang): Tr =>
  (fr, en) =>
    lang === "fr" ? fr : en;

/** The text in the page's language. */
export function useTr(): Tr {
  return translate(useLang());
}

/** Dates and numbers as each language writes them. */
export const localeOf = (lang: Lang) => (lang === "fr" ? "fr-FR" : "en-GB");

/** From this language's page to the site's root (the legal pages, the other language). */
export const rootOf = (lang: Lang) => (lang === "fr" ? "./" : "../");
