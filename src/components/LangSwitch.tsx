import { LANGS, useLang, setLang } from "@/i18n";
import { chooseLang } from "@/i18n/account";

/** Two-option language switch (Italiano / English). */
export function LangSwitch({
  className = "",
  local = false,
}: {
  className?: string;
  local?: boolean;
}) {
  const lang = useLang();
  return (
    <div
      role="radiogroup"
      aria-label="Lingua / Language"
      className={`inline-flex rounded-full border border-border bg-panel/80 p-0.5 backdrop-blur ${className}`}
    >
      {LANGS.map((l) => (
        <button
          key={l.value}
          type="button"
          role="radio"
          aria-checked={lang === l.value}
          lang={l.value}
          onClick={() => (local ? setLang(l.value) : chooseLang(l.value))}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${lang === l.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
