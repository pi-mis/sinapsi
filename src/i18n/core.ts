import { EN } from "./en";

/**
 * Sinapsi speaks Italian and English. Strings are written in Italian in the code
 * (the Italian text is the key) and `EN` maps each of them to English, so a
 * missing translation is a type error. `{name}` placeholders are filled from params.
 */
export type Lang = "it" | "en";
export type Key = keyof typeof EN;
export type Params = Record<string, string | number>;

export const LANGS: { value: Lang; label: string }[] = [
  { value: "it", label: "Italiano" },
  { value: "en", label: "English" },
];

const fill = (text: string, params?: Params) =>
  params
    ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m))
    : text;

export function translate(lang: Lang, key: Key, params?: Params): string {
  return fill(lang === "en" ? EN[key] : key, params);
}

/** For text that may or may not be a known key (e.g. an error message from the server). */
export function translateLoose(lang: Lang, text: string): string {
  if (lang !== "en") return text;
  return (EN as Record<string, string>)[text] ?? text;
}

export const isLang = (v: unknown): v is Lang => v === "it" || v === "en";
export const locale = (lang: Lang) => (lang === "en" ? "en-GB" : "it-IT");
export const LANG_COOKIE = "sinapsi-lang";

/** Default language: Italian for an Italian device or an Italian connection, English otherwise. */
export function guessLang(input: {
  languages?: readonly string[];
  timeZone?: string;
  country?: string | null;
}): Lang {
  if ((input.languages ?? []).some((l) => l.toLowerCase().startsWith("it"))) return "it";
  if (input.timeZone === "Europe/Rome") return "it";
  if (input.country && ["IT", "SM", "VA"].includes(input.country.toUpperCase())) return "it";
  return "en";
}
