import { useQuery } from "@tanstack/react-query";
import { X, Pencil, Trash2, LockKeyhole, Pin, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { explainSynapse } from "@/ai/ai.functions";
import { Attachments } from "./Attachments";
import { withOffline } from "@/lib/offline";
import { useState } from "react";
import { Button } from "./ui/button";
import { readNote, deleteNote, type Note } from "@/notes/data";
import type { GraphData, GNode } from "@/graph/data";
import { toast } from "sonner";
export function NotePanel({
  id,
  data,
  onClose,
  onSelect,
  onEdit,
  onDeleted,
  onContentChanged,
}: {
  id: string;
  data: GraphData;
  onClose: () => void;
  onSelect: (id: string) => void;
  onEdit: (note: Note) => void;
  onDeleted: () => void;
  onContentChanged: () => void;
}) {
  const {
    data: note,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["note", id],
    queryFn: () => withOffline(`note:${id}`, () => readNote(id)),
  });
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false);
  const idx = data.nodes.findIndex((n) => n.id === id);
  const linked = data.edges
    .filter((e) => e.a === idx || e.b === idx)
    .flatMap((e) => {
      const node = data.nodes[e.a === idx ? e.b : e.a];
      return node ? [{ node, score: e.score, kind: e.kind }] : [];
    })
    .sort((a, b) => b.score - a.score);
  const constellation = data.constellations.find((c) => c.id === data.nodes[idx]?.cluster);
  return (
    <aside className="panel-shadow fixed inset-0 z-40 flex flex-col overflow-hidden border border-border bg-card pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] md:inset-y-4 md:left-auto md:right-4 md:w-[380px] md:rounded-lg md:pb-0 md:pt-0">
      <header className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {constellation && (
              <span
                className="flex items-center gap-1.5"
                title={constellation.summary ?? undefined}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: `hsl(${Math.round(constellation.hue * 360)} 58% 64%)` }}
                />
                {constellation.label} ·
              </span>
            )}
            {note?.type ?? "nota"}
            {note?.is_private && <LockKeyhole className="size-3" />}
            {note?.pinned && <Pin className="size-3" />}
          </div>
          <h2 className="mt-2 break-words text-xl font-light">
            {note?.title || data.nodes[idx]?.title}
          </h2>
        </div>
        <Button onClick={onClose} aria-label="Chiudi nota" size="icon" variant="ghost">
          <X />
        </Button>
      </header>
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {isLoading && <p className="text-sm text-muted-foreground">Caricamento…</p>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {note && (
          <>
            <p className="text-xs text-muted-foreground">
              {new Date(note.created_at).toLocaleDateString("it-IT")}
              {note.event_date &&
                ` · Evento: ${new Date(note.event_date).toLocaleDateString("it-IT")}`}
            </p>
            <section>
              <h3 className="mb-3 text-xs text-muted-foreground">Originale</h3>
              <p className="whitespace-pre-wrap break-words text-sm leading-7">{note.content}</p>
            </section>
            <Attachments noteId={id} isPrivate={note.is_private} onChanged={onContentChanged} />
          </>
        )}
        <section>
          <h3 className="mb-2 text-xs text-muted-foreground">Connessioni · {linked.length}</h3>
          <ul className="space-y-1">
            {linked.map((l) => (
              <Synapse
                key={l.node.id}
                from={id}
                node={l.node}
                score={l.score}
                kind={l.kind}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </section>
      </div>
      {note && (
        <footer className="border-t border-border p-4">
          {confirm ? (
            <div className="space-y-3">
              <p className="text-sm">Eliminare questa nota e le sue connessioni?</p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setConfirm(false)}>
                  Annulla
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await deleteNote(id);
                      toast.success("Nota eliminata");
                      onDeleted();
                    } catch (e) {
                      toast.error((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Elimina nota
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => onEdit(note)}>
                <Pencil />
                Modifica
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Elimina nota"
                onClick={() => setConfirm(true)}
              >
                <Trash2 />
              </Button>
            </div>
          )}
        </footer>
      )}
    </aside>
  );
}

/** One connection: strength bar, jump to the note, and an on-demand AI explanation (cached on the edge). */
function Synapse({
  from,
  node,
  score,
  kind,
  onSelect,
}: {
  from: string;
  node: GNode;
  score: number;
  kind: string;
  onSelect: (id: string) => void;
}) {
  const explain = useServerFn(explainSynapse);
  const [state, setState] = useState<{ loading: boolean; text: string; error: string } | null>(
    null,
  );
  const ask = async () => {
    if (state?.text) return setState(null);
    setState({ loading: true, text: "", error: "" });
    try {
      const r = await explain({ data: { a: from, b: node.id } });
      setState({ loading: false, text: r.explanation, error: r.error });
    } catch {
      setState({ loading: false, text: "", error: "Spiegazione non disponibile." });
    }
  };
  return (
    <li className="rounded-md px-1 py-1.5">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          className="h-auto min-w-0 flex-1 justify-start whitespace-normal px-1 py-1 text-left font-normal"
          onClick={() => onSelect(node.id)}
        >
          {node.title}
        </Button>
        {(kind === "person" || kind === "thread" || kind === "project") && (
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
            {kind === "person" ? "persona" : kind === "project" ? "progetto" : "stessa chat"}
          </span>
        )}
        {kind === "semantic" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
            aria-expanded={!!state}
            onClick={() => void ask()}
          >
            <Sparkles />
            Perché?
          </Button>
        )}
      </div>
      <div className="mx-1 mt-1 h-0.5 rounded bg-border" aria-hidden>
        <div
          className="h-full rounded bg-muted-foreground/60"
          style={{ width: `${Math.round(Math.max(0.05, Math.min(1, score)) * 100)}%` }}
        />
      </div>
      {state && (
        <p
          className={`mx-1 mt-2 text-xs leading-5 ${state.error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {state.loading ? "Rifletto sul collegamento…" : state.error || state.text}
        </p>
      )}
    </li>
  );
}
