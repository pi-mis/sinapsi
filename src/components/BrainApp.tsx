import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, Sparkles } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { loadGraph } from "@/graph/data";
import { seedDemo, clearDemo } from "@/graph/demo";
import type { QualityLevel } from "@/graph/GraphScene";
import { NotePanel } from "./NotePanel";

const GraphScene = lazy(() => import("@/graph/GraphScene"));

type QualityChoice = "auto" | "alta" | "media" | "bassa" | "lista";
const LEVEL: Record<Exclude<QualityChoice, "auto" | "lista">, QualityLevel> = { alta: 0, media: 1, bassa: 2 };

export function BrainApp({ session }: { session: Session }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["graph"], queryFn: loadGraph });
  const [selected, setSelected] = useState<string | null>(null);
  const [choice, setChoice] = useState<QualityChoice>("auto");
  const [autoLevel, setAutoLevel] = useState<QualityLevel>(0);
  const [busy, setBusy] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const level: QualityLevel = choice === "auto" || choice === "lista" ? autoLevel : LEVEL[choice];

  const onFps = (fps: number) => {
    if (choice !== "auto") return;
    if (fps < 40) setAutoLevel((l) => (l < 3 ? ((l + 1) as QualityLevel) : l));
  };

  const toggleDemo = async () => {
    setBusy(true);
    try {
      if (data?.demoCount) await clearDemo();
      else await seedDemo(session.user.id);
      setSelected(null);
      await qc.invalidateQueries({ queryKey: ["graph"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sorted = useMemo(() => [...(data?.nodes ?? [])].sort((a, b) => b.weight - a.weight), [data]);

  return (
    <main className="fixed inset-0 bg-background">
      {data && data.nodes.length > 0 && choice !== "lista" && (
        <Suspense fallback={null}>
          <GraphScene
            data={data}
            quality={level}
            reducedMotion={reduced}
            selectedId={selected}
            onSelect={setSelected}
            onFps={onFps}
          />
        </Suspense>
      )}

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto">
          <div className="label-mono">Cervello digitale</div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {data ? `${data.nodes.length} note · ${data.edges.length} connessioni` : "…"}
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <select
            aria-label="Qualità grafica"
            value={choice}
            onChange={(e) => setChoice(e.target.value as QualityChoice)}
            className="glass h-8 rounded-md px-2 text-xs text-foreground"
          >
            <option value="auto">Qualità: auto</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="bassa">Bassa</option>
            <option value="lista">Solo lista</option>
          </select>
          <button
            onClick={toggleDemo}
            disabled={busy}
            className="glass flex h-8 items-center gap-1.5 rounded-md px-3 text-xs text-foreground hover:bg-accent disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {busy ? "Attendi…" : data?.demoCount ? "Cancella demo" : "Modalità demo"}
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            aria-label="Esci"
            className="glass flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {isLoading && <Center>Risveglio il cervello…</Center>}
      {error && <Center>{(error as Error).message}</Center>}
      {data && data.nodes.length === 0 && (
        <Center>
          <p className="text-2xl font-extralight text-foreground">Il cervello è ancora buio.</p>
          <p className="mt-2 text-sm text-muted-foreground">Accendi la modalità demo per vedere 60 note in 6 costellazioni.</p>
          <button
            onClick={toggleDemo}
            disabled={busy}
            className="pointer-events-auto mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Accendo…" : "Accendi la demo"}
          </button>
        </Center>
      )}

      {data && choice === "lista" && (
        <div className="absolute inset-0 overflow-y-auto px-4 pb-10 pt-20">
          <ul className="mx-auto max-w-2xl divide-y divide-border">
            {sorted.map((n) => (
              <li key={n.id}>
                <button onClick={() => setSelected(n.id)} className="flex w-full justify-between gap-3 py-3 text-left hover:text-primary">
                  <span className="truncate">{n.title}</span>
                  <span className="label-mono shrink-0">{n.type}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && data && (
        <NotePanel id={selected} data={data} onClose={() => setSelected(null)} onSelect={setSelected} />
      )}
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
