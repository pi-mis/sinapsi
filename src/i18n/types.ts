import { useCallback } from "react";
import { useLang, type Lang } from "./index";

/**
 * Note types are stored with their Italian name (the importers and the brain rely
 * on values like "evento" or "progetto"); they are only displayed translated.
 */
const TYPE_EN: Record<string, string> = {
  idea: "idea",
  concetto: "concept",
  libro: "book",
  ricetta: "recipe",
  ricordo: "memory",
  progetto: "project",
  musica: "music",
  evento: "event",
  persona: "person",
  gruppo: "group",
  conversazione: "conversation",
  nota: "note",
  link: "link",
};

/** Types offered when writing a note. */
export const EDITOR_TYPES = [
  "idea",
  "concetto",
  "libro",
  "ricetta",
  "ricordo",
  "progetto",
  "musica",
];

export const typeLabel = (type: string, lang: Lang) =>
  lang === "en" ? (TYPE_EN[type] ?? type) : type;

/** Maps a type typed in English back to its stored Italian name. */
export function canonicalType(input: string): string {
  const value = input.trim();
  const hit = Object.entries(TYPE_EN).find(([, en]) => en === value.toLowerCase());
  return hit ? hit[0] : value;
}

export function useTypeLabel() {
  const lang = useLang();
  return useCallback((type: string) => typeLabel(type, lang), [lang]);
}
