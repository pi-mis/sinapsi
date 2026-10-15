import { useCallback, useSyncExternalStore } from "react";
import {
  guessLang,
  isLang,
  LANG_COOKIE,
  translate,
  translateLoose,
  type Key,
  type Lang,
  type Params,
} from "./core";

export { LANGS, locale, type Key, type Lang } from "./core";

/**
 * Client-side language store. The user's explicit choice (localStorage, or the
 * account's `user_metadata.lang`) wins; otherwise the device language decides,
 * then the time zone, then the country of the connection (one cheap request).
 * The language is mirrored in a cookie so server functions answer in it too.
 */
const STORAGE = "sinapsi-lang";
const listeners = new Set<() => void>();
let current: Lang = "it";
let explicit = false;

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function apply(lang: Lang) {
  current = lang;
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  }
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  const stored = read(STORAGE);
  explicit = isLang(stored);
  current = isLang(stored)
    ? stored
    : guessLang({
        languages: navigator.languages?.length ? navigator.languages : [navigator.language],
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        country: read("sinapsi-country"),
      });
  apply(current);
  // An Italian connection on a non-Italian device: ask the edge for the country once.
  if (!explicit && current === "en" && read("sinapsi-country") === null) {
    fetch("/api/paese")
      .then((r) => (r.ok ? (r.json() as Promise<{ country?: string | null }>) : null))
      .then((body) => {
        const country = body?.country ?? "";
        try {
          localStorage.setItem("sinapsi-country", country);
        } catch {
          /* ignore */
        }
        if (!explicit && guessLang({ country }) === "it") apply("it");
      })
      .catch(() => {});
  }
}

export function getLang(): Lang {
  return current;
}

/** Sets the language chosen by the user (remembered on this device). */
export function setLang(lang: Lang) {
  explicit = true;
  try {
    localStorage.setItem(STORAGE, lang);
  } catch {
    /* ignore */
  }
  apply(lang);
}

/** Adopts the language saved on the account, unless this device already has a choice. */
export function adoptAccountLang(lang: unknown) {
  if (!explicit && isLang(lang) && lang !== current) setLang(lang);
}

export function hasExplicitLang() {
  return explicit;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => "it" as Lang);
}

export type T = (key: Key, params?: Params) => string;

/** `t("Testo italiano", { n: 3 })` in the current language; re-renders when it changes. */
export function useT(): T {
  const lang = useLang();
  return useCallback((key: Key, params?: Params) => translate(lang, key, params), [lang]);
}

/** Outside React (toasts from background work, parsers). */
export function t(key: Key, params?: Params): string {
  return translate(current, key, params);
}

/** Translates a message that may come from the server or a library, if it is known. */
export function tr(text: string): string {
  return translateLoose(current, text);
}
