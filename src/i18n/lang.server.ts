import { getRequest } from "@tanstack/react-start/server";
import { isLang, LANG_COOKIE, translate, type Key, type Lang, type Params } from "./core";

/** The language of the current request: the app's cookie, else the browser's languages. */
export function requestLang(): Lang {
  const headers = getRequest()?.headers;
  const cookie = headers?.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=(\\w+)`));
  if (match && isLang(match[1])) return match[1];
  return (headers?.get("accept-language") ?? "").toLowerCase().startsWith("it") ? "it" : "en";
}

/** Server-side translation in the request's language. */
export function st(key: Key, params?: Params): string {
  return translate(requestLang(), key, params);
}

/** How prompts name the language the AI must write in. */
export function languageName(lang: Lang = requestLang()): string {
  return lang === "en" ? "inglese (English)" : "italiano";
}
