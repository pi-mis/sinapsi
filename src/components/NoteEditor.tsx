import { useState } from "react";
import { X, LockKeyhole, Save } from "lucide-react";
import { Button } from "./ui/button";
import { saveNote, type Note, type NoteInput } from "@/notes/data";
import { toast } from "sonner";
import { tr, useT } from "@/i18n";
import { canonicalType, EDITOR_TYPES, useTypeLabel } from "@/i18n/types";
export function NoteEditor({
  note,
  onClose,
  onSaved,
}: {
  note?: Note;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const t = useT();
  const typeLabel = useTypeLabel();
  const [value, setValue] = useState<NoteInput>({
    title: note?.title ?? "",
    content: note?.content ?? "",
    type: note?.type ?? "idea",
    is_private: note?.is_private ?? false,
    pinned: note?.pinned ?? false,
    event_date: note?.event_date ?? null,
  });
  // The type is shown (and typed) in the user's language, stored with its Italian name.
  const [type, setType] = useState(() => typeLabel(value.type));
  const [busy, setBusy] = useState(false);
  const field =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:border-ring sm:text-sm";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-title"
    >
      <form
        className="panel-shadow flex max-h-[92dvh] w-full max-w-xl flex-col rounded-lg border border-border bg-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            onSaved(await saveNote({ ...value, type: canonicalType(type) || "idea" }, note?.id));
            toast.success(t("Nota salvata"));
          } catch (err) {
            toast.error(tr((err as Error).message));
          } finally {
            setBusy(false);
          }
        }}
      >
        <header className="flex items-center justify-between border-b border-border p-4">
          <h2 id="editor-title" className="text-lg font-light">
            {note ? t("Modifica nota") : t("Nuova nota")}
          </h2>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("Chiudi editor")}
            onClick={onClose}
          >
            <X />
          </Button>
        </header>
        <div className="space-y-4 overflow-y-auto p-5">
          <label className="block space-y-1 text-xs text-muted-foreground">
            <span>{t("Titolo")}</span>
            <input
              aria-label={t("Titolo")}
              className={field}
              value={value.title}
              onChange={(e) => setValue({ ...value, title: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-xs text-muted-foreground">
            <span>{t("Testo originale")}</span>
            <textarea
              autoFocus
              required
              aria-label={t("Testo originale")}
              className={`${field} min-h-48 resize-y`}
              value={value.content}
              onChange={(e) => setValue({ ...value, content: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>{t("Tipo")}</span>
              <input
                list="note-types"
                aria-label={t("Tipo")}
                className={field}
                value={type}
                onChange={(e) => setType(e.target.value)}
              />
              <datalist id="note-types">
                {EDITOR_TYPES.map((k) => (
                  <option key={k} value={typeLabel(k)} />
                ))}
              </datalist>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>{t("Data evento")}</span>
              <input
                type="date"
                aria-label={t("Data evento")}
                className={field}
                value={value.event_date ?? ""}
                onChange={(e) => setValue({ ...value, event_date: e.target.value || null })}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value.is_private}
                onChange={(e) => setValue({ ...value, is_private: e.target.checked })}
              />
              <LockKeyhole className="size-4 text-muted-foreground" />
              {t("Privata")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value.pinned}
                onChange={(e) => setValue({ ...value, pinned: e.target.checked })}
              />
              {t("In evidenza")}
            </label>
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("Annulla")}
          </Button>
          <Button type="submit" disabled={busy}>
            <Save />
            {busy ? t("Salvataggio…") : t("Salva nota")}
          </Button>
        </footer>
      </form>
    </div>
  );
}
