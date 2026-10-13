import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { GraphData } from "@/graph/data";

export function NotePanel({
  id,
  data,
  onClose,
  onSelect,
}: {
  id: string;
  data: GraphData;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const { data: note, isLoading, error } = useQuery({
    queryKey: ["note", id],
    queryFn: async () => {
      const { data: n, error: e } = await supabase
        .from("notes")
        .select("id,title,content,enriched,type,ai_status,created_at,open_count")
        .eq("id", id)
        .single();
      if (e) throw new Error("Impossibile aprire la nota");
      void supabase
        .from("notes")
        .update({ open_count: (n.open_count ?? 0) + 1, last_opened_at: new Date().toISOString() })
        .eq("id", id);
      return n;
    },
  });

  const idx = data.nodes.findIndex((n) => n.id === id);
  const linked = data.edges
    .filter((e) => e.a === idx || e.b === idx)
    .map((e) => ({ node: data.nodes[e.a === idx ? e.b : e.a], score: e.score, kind: e.kind }))
    .sort((a, b) => b.score - a.score);

  return (
    <aside className="glass fixed inset-0 z-30 flex flex-col overflow-hidden md:inset-y-3 md:left-auto md:right-3 md:w-[400px] md:rounded-2xl animate-in slide-in-from-right-8 fade-in duration-300">
      <header className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="min-w-0">
          <div className="label-mono">{note?.type ?? "nota"}</div>
          <h2 className="mt-1 text-xl font-light leading-snug text-foreground">
            {note?.title || data.nodes[idx]?.title}
          </h2>
        </div>
        <button onClick={onClose} aria-label="Chiudi" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {isLoading && <p className="text-sm text-muted-foreground">Caricamento…</p>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {note && (
          <>
            <section>
              <div className="label-mono mb-2">Originale</div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{note.content}</p>
            </section>
            <section>
              <div className="label-mono mb-2">Versione AI</div>
              {note.enriched ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{note.enriched}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {note.ai_status === "pending" ? "In elaborazione…" : "Non ancora disponibile."}
                </p>
              )}
            </section>
          </>
        )}
        <section>
          <div className="label-mono mb-2">Collegate ({linked.length})</div>
          <ul className="space-y-1">
            {linked.map((l) => (
              <li key={l.node.id}>
                <button
                  onClick={() => onSelect(l.node.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="truncate text-foreground/90">{l.node.title}</span>
                  <span className="shrink-0 font-mono text-[0.7rem] text-muted-foreground">
                    {l.kind} · {l.score.toFixed(2)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}
