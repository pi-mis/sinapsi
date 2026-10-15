import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  LogOut,
  Sparkles,
  Plus,
  Search,
  ArrowUp,
  X,
  Network,
  List,
  CalendarDays,
  Move,
  Rotate3D,
  Focus,
  ZoomIn,
  ZoomOut,
  Download,
  Upload,
  MoreHorizontal,
  LockKeyhole,
  Pin,
  Orbit,
  LoaderCircle,
  RefreshCw,
  KeyRound,
  Inbox,
  Bell,
  MessagesSquare,
  WifiOff,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { loadGraph } from "@/graph/data";
import { seedDemo, clearDemo } from "@/graph/demo";
import type { ViewCommand } from "@/graph/GraphScene";
import { NotePanel } from "./NotePanel";
import { NoteEditor } from "./NoteEditor";
import { Button } from "./ui/button";
import { listNotes, type Note } from "@/notes/data";
import { searchIdeas } from "@/notes/search.functions";
import { exportArchive, readZip, restoreArchive, type Archive } from "@/notes/archive";
import { usePipeline, describeStatus } from "@/ai/usePipeline";
import { embed } from "@/ai/embed";
import { ImportDialog } from "./ImportDialog";
import { syncConnectors } from "@/connectors/run";
import { RemindersPanel, useReminders } from "./RemindersPanel";
import { scanNotes } from "@/brain/client";
import { groupOf, localToday, weekKey } from "@/brain/reminders";
import { clearOffline, onOfflineCopy, withOffline } from "@/lib/offline";
import { Onboarding } from "./Onboarding";
import { amIAdmin } from "@/admin/admin.functions";
import { Link } from "@tanstack/react-router";
import { adoptAccountLang, locale, tr, useLang, useT } from "@/i18n";
import { useTypeLabel } from "@/i18n/types";
import { LangSwitch } from "./LangSwitch";
const GraphScene = lazy(() => import("@/graph/GraphScene"));
export function BrainApp({ session }: { session: Session }) {
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
  const typeLabel = useTypeLabel();
  // A language chosen on another device follows the account.
  useEffect(
    () => adoptAccountLang(session.user.user_metadata?.["lang"]),
    [session.user.user_metadata],
  );
  const graph = useQuery({ queryKey: ["graph"], queryFn: () => withOffline("graph", loadGraph) });
  const notes = useQuery({ queryKey: ["notes"], queryFn: () => withOffline("notes", listNotes) });
  const [offline, setOffline] = useState(false);
  useEffect(() => onOfflineCopy(setOffline), []);
  // First access: the animated tour (remembered on the account, so it shows once per person).
  const [tour, setTour] = useState(() => {
    if (session.user.user_metadata?.["onboarded_at"]) return false;
    try {
      return localStorage.getItem(`sinapsi-onboarded-${session.user.id}`) !== "1";
    } catch {
      return true;
    }
  });
  const adminFn = useServerFn(amIAdmin);
  const admin = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => adminFn(),
    staleTime: Infinity,
    retry: false,
  });
  const endTour = async (createNote: boolean) => {
    setTour(false);
    if (createNote) setEditor("new");
    try {
      localStorage.setItem(`sinapsi-onboarded-${session.user.id}`, "1");
    } catch {
      /* ignore */
    }
    void supabase.auth.updateUser({ data: { onboarded_at: new Date().toISOString() } });
    // The tour leaves the demo: demo notes loaded earlier are removed too.
    if (graph.data?.demoCount) {
      try {
        await clearDemo();
        await refresh();
      } catch {
        /* the demo can still be removed from the menu */
      }
    }
    toast.message(t("Demo chiusa"), {
      description: t(
        "La puoi riattivare quando vuoi dal menu ⋯ → Carica demo, o rivedere l’introduzione.",
      ),
      duration: 7000,
    });
  };
  // Back online: reload everything and let the brain catch up.
  useEffect(() => {
    const back = () => {
      void refresh().then(() => pipeline.run());
    };
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [selected, setSelected] = useState<string | null>(null),
    [editor, setEditor] = useState<Note | "new" | null>(null);
  const [view, setView] = useState<"graph" | "list" | "timeline">("graph"),
    [mode, setMode] = useState<"pan" | "orbit">(() =>
      typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
        ? "orbit"
        : "pan",
    );
  const [command, setCommand] = useState<ViewCommand>({ action: "reset", tick: 0 });
  const [busy, setBusy] = useState(false),
    [menu, setMenu] = useState(false),
    [reduced, setReduced] = useState(false);
  const [query, setQuery] = useState(""),
    [searchMode, setSearchMode] = useState<"keyword" | "ai">("keyword"),
    [searching, setSearching] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof searchIdeas>> | null>(null);
  const [cluster, setCluster] = useState<number | null>(null),
    [legend, setLegend] = useState(true),
    [passwordOpen, setPasswordOpen] = useState(false),
    [importOpen, setImportOpen] = useState(false),
    [remindersOpen, setRemindersOpen] = useState(false);
  const [thread, setThread] = useState<{ q: string; a: string }[]>([]);
  const [filter, setFilter] = useState("all"),
    [privateOnly, setPrivateOnly] = useState(false),
    [imported, setImported] = useState<Archive | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const search = useServerFn(searchIdeas);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["graph"] }),
      qc.invalidateQueries({ queryKey: ["notes"] }),
      qc.invalidateQueries({ queryKey: ["note"] }),
    ]);
  };
  const refreshReminders = () => {
    void qc.invalidateQueries({ queryKey: ["reminders"] });
  };
  // New or edited notes are read for plans and deadlines in the background.
  const pipeline = usePipeline(refresh, (ids) => scanNotes(ids, refreshReminders));
  // Connectors (calendars, GitHub) refresh themselves when the app opens, at most every few hours.
  useEffect(() => {
    syncConnectors(session.user.id, () => {})
      .then((n) => {
        if (n) void refresh().then(() => pipeline.run());
      })
      .catch(() => {});
  }, [session.user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const reminders = useReminders();
  const today = localToday();
  const dueCount = (reminders.data ?? []).filter((r) =>
    ["scaduti", "oggi"].includes(groupOf(r.payload, today)),
  ).length;
  const [digestSeen, setDigestSeen] = useState(() => {
    try {
      return localStorage.getItem("sinapsi-digest-seen");
    } catch {
      return null;
    }
  });
  const newDigest = digestSeen !== weekKey(today);
  // Once a day, a browser notification for what is due (only if the user allowed it).
  useEffect(() => {
    if (!dueCount || typeof Notification === "undefined" || Notification.permission !== "granted")
      return;
    try {
      if (localStorage.getItem("sinapsi-notified") === today) return;
      localStorage.setItem("sinapsi-notified", today);
    } catch {
      return;
    }
    new Notification("Sinapsi", {
      body:
        dueCount === 1
          ? t("Hai 1 promemoria per oggi.")
          : t("Hai {n} promemoria per oggi.", { n: dueCount }),
      icon: "/favicon.ico",
    });
  }, [dueCount, today, t]);
  const statusText = describeStatus(pipeline.status, pipeline.model);
  const reorganize = async () => {
    setMenu(false);
    setCluster(null);
    const groups = await pipeline.run({ reorganize: true });
    if (!groups) toast.message(t("Servono almeno 6 note collegate per formare le costellazioni."));
  };
  const highlighted = useMemo(
    () =>
      result
        ? result.results.map((r) => r.id)
        : cluster != null && graph.data
          ? graph.data.nodes.filter((n) => n.cluster === cluster).map((n) => n.id)
          : null,
    [result, cluster, graph.data],
  );
  const toggleDemo = async () => {
    setBusy(true);
    try {
      if (graph.data?.demoCount) await clearDemo();
      else await seedDemo(session.user.id, lang);
      setSelected(null);
      await refresh();
    } catch (e) {
      toast.error(tr((e as Error).message));
    } finally {
      setBusy(false);
    }
  };
  const rows = useMemo(
    () =>
      (notes.data ?? [])
        .filter(
          (n) =>
            (filter === "all" || n.type === filter) &&
            (!privateOnly || n.is_private) &&
            (!result || result.results.some((r) => r.id === n.id)),
        )
        .sort((a, b) =>
          view === "timeline"
            ? (b.event_date ?? b.created_at).localeCompare(a.event_date ?? a.created_at)
            : Number(b.pinned) - Number(a.pinned),
        ),
    [notes.data, filter, privateOnly, result, view],
  );
  const move = (action: ViewCommand["action"]) => setCommand((c) => ({ action, tick: c.tick + 1 }));
  return (
    <main className="fixed inset-0 bg-background text-foreground">
      {tour && <Onboarding onDone={(createNote) => void endTour(createNote)} />}
      {!tour && graph.data && graph.data.nodes.length > 0 && view === "graph" && (
        <Suspense
          fallback={
            <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
              {t("Apertura del grafo…")}
            </div>
          }
        >
          <GraphScene
            data={graph.data}
            quality={0}
            reducedMotion={reduced}
            selectedId={selected}
            onSelect={setSelected}
            command={command}
            mode={mode}
            highlighted={highlighted}
          />
        </Suspense>
      )}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 border-b border-border/40 bg-background/70 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl sm:gap-3 sm:px-5 sm:py-4">
        <div className="pointer-events-auto">
          <h1 className="text-lg font-light tracking-wide">Sinapsi</h1>
          <p className="mt-1 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            {graph.data ? (
              <>
                {t("{n} note", { n: graph.data.nodes.length })}
                <span className="hidden sm:inline">
                  {" · "}
                  {t("{n} connessioni", { n: graph.data.edges.length })}
                </span>
              </>
            ) : (
              t("Caricamento…")
            )}
          </p>
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <nav className="flex border-r border-border pr-1 sm:pr-2" aria-label={t("Vista")}>
            {(
              [
                { value: "graph", icon: Network, label: t("Grafo") },
                { value: "list", icon: List, label: t("Elenco") },
                { value: "timeline", icon: CalendarDays, label: "Timeline" },
              ] as const
            ).map((v) => (
              <Button
                key={v.value}
                size="icon"
                variant={view === v.value ? "secondary" : "ghost"}
                title={v.label}
                aria-label={v.label}
                aria-pressed={view === v.value}
                onClick={() => setView(v.value)}
              >
                <v.icon />
              </Button>
            ))}
          </nav>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={dueCount ? t("Promemoria, {n} per oggi", { n: dueCount }) : t("Promemoria")}
            title={t("Promemoria e riepilogo")}
            onClick={() => {
              setRemindersOpen(true);
              setMenu(false);
              try {
                localStorage.setItem("sinapsi-digest-seen", weekKey(today));
              } catch {
                /* ignore */
              }
              setDigestSeen(weekKey(today));
            }}
          >
            <Bell />
            {dueCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-4 text-white">
                {dueCount}
              </span>
            ) : (
              newDigest && <span className="absolute right-1 top-1 size-2 rounded-full bg-glow" />
            )}
          </Button>
          <Button onClick={() => setEditor("new")} size="sm">
            <Plus />
            <span className="hidden sm:inline">{t("Nuova nota")}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("Altre azioni")}
            title={t("Altre azioni")}
            onClick={() => setMenu(!menu)}
          >
            <MoreHorizontal />
          </Button>
        </div>
        {menu && (
          <div className="panel-shadow pointer-events-auto absolute right-4 top-full mt-2 w-60 rounded-lg border border-border bg-popover p-1">
            <Button
              variant="ghost"
              className="w-full justify-start"
              disabled={busy}
              onClick={toggleDemo}
            >
              <Sparkles />
              {graph.data?.demoCount ? t("Rimuovi demo") : t("Carica demo")}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                setMenu(false);
                setTour(true);
              }}
            >
              <PlayCircle />
              {t("Rivedi l’introduzione")}
            </Button>
            {admin.data?.admin && (
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link to="/admin">
                  <ShieldCheck />
                  {t("Amministrazione")}
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              className="h-auto min-h-9 w-full justify-start whitespace-normal py-2 text-left"
              onClick={() => {
                setMenu(false);
                setImportOpen(true);
              }}
            >
              <Inbox />
              {t("Importa e collega (chat, contatti, calendario, GitHub)")}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              disabled={pipeline.status.kind === "busy"}
              onClick={() => void reorganize()}
            >
              <Orbit />
              {t("Riorganizza costellazioni")}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const count = await exportArchive();
                  toast.success(t("Esportate {n} note", { n: count }));
                } catch (e) {
                  toast.error(tr((e as Error).message));
                } finally {
                  setBusy(false);
                  setMenu(false);
                }
              }}
            >
              <Download />
              {t("Esporta tutto")}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => input.current?.click()}
            >
              <Upload />
              {t("Ripristina archivio ZIP")}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                setMenu(false);
                setPasswordOpen(true);
              }}
            >
              <KeyRound />
              {t("Imposta password")}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={async () => {
                await clearOffline();
                const { error } = await supabase.auth.signOut();
                if (error) toast.error(t("Impossibile uscire."));
              }}
            >
              <LogOut />
              {t("Esci")}
            </Button>
            <div className="mt-1 border-t border-border px-2 pb-1 pt-2">
              <LangSwitch />
            </div>
          </div>
        )}
      </header>
      <input
        ref={input}
        type="file"
        accept=".zip"
        className="hidden"
        aria-label={t("Importa archivio ZIP")}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            setImported(readZip(new Uint8Array(await file.arrayBuffer())));
            setMenu(false);
          } catch (err) {
            toast.error(tr((err as Error).message));
          }
        }}
      />
      {graph.isLoading && (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          {t("Caricamento delle note…")}
        </div>
      )}
      {graph.error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">{tr(graph.error.message)}</p>
          <Button variant="outline" onClick={() => graph.refetch()}>
            {t("Riprova")}
          </Button>
        </div>
      )}
      {graph.data?.nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-5">
          <Network className="size-9 text-muted-foreground" />
          <h2 className="text-center text-2xl font-light">
            {t("Le tue idee, uno spazio tutto loro.")}
          </h2>
          <Button onClick={() => setEditor("new")}>
            <Plus />
            {t("Nuova nota")}
          </Button>
          <Button variant="ghost" onClick={toggleDemo} disabled={busy}>
            {t("Carica demo")}
          </Button>
        </div>
      )}
      {view !== "graph" && (
        <div className="absolute inset-0 overflow-y-auto px-4 pb-40 pt-[calc(env(safe-area-inset-top)+6rem)] sm:px-5 sm:pt-28">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="text-xl font-light">
                {view === "timeline" ? "Timeline" : t("Tutte le note")}
              </h2>
              <div className="flex items-center gap-3">
                <select
                  className="h-8 max-w-36 rounded-md border border-input bg-background px-2 text-xs"
                  aria-label={t("Filtra per tipo")}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">{t("Tutti i tipi")}</option>
                  {[...new Set(notes.data?.map((n) => n.type))].map((type) => (
                    <option key={type} value={type}>
                      {typeLabel(type)}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={privateOnly}
                    onChange={(e) => setPrivateOnly(e.target.checked)}
                  />
                  {t("Private")}
                </label>
              </div>
            </div>
            {!rows.length && (
              <p className="text-sm text-muted-foreground">{t("Nessuna nota corrispondente.")}</p>
            )}
            <ul className="divide-y divide-border">
              {rows.map((n) => (
                <li key={n.id}>
                  <Button
                    variant="ghost"
                    onClick={() => setSelected(n.id)}
                    className="h-auto w-full justify-between gap-4 rounded-none px-1 py-4 text-left font-normal"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{n.title || t("Senza titolo")}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {typeLabel(n.type)} ·{" "}
                        {new Date(
                          view === "timeline" ? (n.event_date ?? n.created_at) : n.created_at,
                        ).toLocaleDateString(locale(lang))}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-2 text-muted-foreground">
                      {n.is_private && <LockKeyhole />}
                      {n.pinned && <Pin />}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {view === "graph" && !!graph.data?.constellations.length && (
        <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4.6rem)] z-20 flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:hidden">
          {graph.data.constellations.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={cluster === c.id}
              onClick={() => {
                setResult(null);
                setCluster(cluster === c.id ? null : c.id);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs backdrop-blur ${cluster === c.id ? "border-foreground/40 bg-accent" : "border-border bg-panel/80"}`}
            >
              <span
                className="size-2 rounded-full"
                style={{ background: `hsl(${Math.round(c.hue * 360)} 78% 60%)` }}
              />
              {c.label}
            </button>
          ))}
        </div>
      )}
      {view === "graph" && !!graph.data?.constellations.length && (
        <div className="absolute bottom-32 right-5 z-20 hidden w-60 rounded-md border border-border bg-panel p-2 panel-shadow sm:block">
          <button
            type="button"
            className="flex w-full items-center justify-between px-1 pb-1 text-xs text-muted-foreground"
            aria-expanded={legend}
            onClick={() => setLegend(!legend)}
          >
            <span>
              {t("Costellazioni")} · {graph.data.constellations.length}
            </span>
            <span>{legend ? "–" : "+"}</span>
          </button>
          {legend && (
            <ul className="max-h-64 overflow-y-auto">
              {graph.data.constellations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    title={c.summary ?? c.label}
                    aria-pressed={cluster === c.id}
                    onClick={() => {
                      setResult(null);
                      setCluster(cluster === c.id ? null : c.id);
                    }}
                    className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-accent ${cluster === c.id ? "bg-accent" : ""}`}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: `hsl(${Math.round(c.hue * 360)} 78% 60%)` }}
                    />
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{c.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {view === "graph" && (
        <div className="absolute bottom-[calc(8.5rem+env(safe-area-inset-bottom))] left-3 z-20 flex flex-col gap-1 rounded-md border border-border bg-panel p-1 panel-shadow sm:bottom-32 sm:left-5">
          <Button
            size="icon"
            variant={mode === "pan" ? "secondary" : "ghost"}
            aria-label={t("Sposta")}
            title={t("Sposta")}
            onClick={() => setMode("pan")}
          >
            <Move />
          </Button>
          <Button
            size="icon"
            variant={mode === "orbit" ? "secondary" : "ghost"}
            aria-label={t("Ruota")}
            title={t("Ruota")}
            onClick={() => setMode("orbit")}
          >
            <Rotate3D />
          </Button>
          <div className="my-1 hidden border-t border-border sm:block" />
          <Button
            size="icon"
            variant="ghost"
            className="hidden sm:inline-flex"
            aria-label={t("Zoom avanti")}
            title={t("Zoom avanti")}
            onClick={() => move("in")}
          >
            <ZoomIn />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="hidden sm:inline-flex"
            aria-label={t("Zoom indietro")}
            title={t("Zoom indietro")}
            onClick={() => move("out")}
          >
            <ZoomOut />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("Centra grafo")}
            title={t("Centra grafo")}
            onClick={() => {
              setSelected(null);
              move("reset");
            }}
          >
            <Focus />
          </Button>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-4 sm:pb-5">
        <div className="pointer-events-auto mx-auto max-w-2xl">
          {offline && (
            <div
              className="mx-auto mb-2 flex w-fit max-w-full items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-muted-foreground panel-shadow"
              role="status"
            >
              <WifiOff className="size-3.5 shrink-0" />
              {t(
                "Sei offline: vedi l’ultima copia salvata, le modifiche tornano quando sei connesso.",
              )}
            </div>
          )}
          {statusText && !offline && (
            <div
              className="mx-auto mb-2 flex w-fit max-w-full items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs panel-shadow"
              role="status"
            >
              {pipeline.status.kind === "error" ? (
                <>
                  <span className="text-destructive" title={statusText}>
                    {statusText}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onClick={() => void pipeline.retry()}
                  >
                    <RefreshCw />
                    {t("Riprova")}
                  </Button>
                </>
              ) : (
                <>
                  <LoaderCircle className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                  <span className="truncate text-muted-foreground">{statusText}</span>
                </>
              )}
            </div>
          )}
          {result && (
            <div className="panel-shadow mb-2 max-h-[45dvh] overflow-y-auto rounded-lg border border-border bg-panel p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {result.error
                    ? t("Ricerca")
                    : thread.length > 1
                      ? t("Conversazione · {n} domande", { n: thread.length })
                      : t("{n} idee trovate", { n: result.results.length })}
                </span>
                <div className="flex items-center gap-1">
                  {thread.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setThread([]);
                        setResult(null);
                        setQuery("");
                      }}
                    >
                      <MessagesSquare />
                      {t("Nuova conversazione")}
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("Chiudi risultati")}
                    onClick={() => {
                      setResult(null);
                      setThread([]);
                    }}
                  >
                    <X />
                  </Button>
                </div>
              </div>
              {thread.slice(0, -1).map((turn, i) => (
                <div key={i} className="mb-3 border-b border-border pb-3">
                  <p className="text-xs font-medium text-muted-foreground">{turn.q}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                    {turn.a}
                  </p>
                </div>
              ))}
              {thread.length > 0 && result.answer && (
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {thread[thread.length - 1]!.q}
                </p>
              )}
              {result.error && <p className="text-sm text-destructive">{tr(result.error)}</p>}
              {result.answer && (
                <p className="mb-3 whitespace-pre-wrap text-sm leading-6">{result.answer}</p>
              )}
              {!result.error && !result.answer && !result.results.length && (
                <p className="text-sm text-muted-foreground">{t("Nessuna idea trovata.")}</p>
              )}
              {result.results.map((r) => (
                <Button
                  key={r.id}
                  variant="ghost"
                  className="h-auto w-full justify-between whitespace-normal py-2 text-left font-normal"
                  onClick={() => setSelected(r.id)}
                >
                  <span>{r.title}</span>
                  <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                    {typeLabel(r.type)}
                  </span>
                </Button>
              ))}
            </div>
          )}
          <form
            className="panel-shadow flex items-center gap-2 rounded-lg border border-border bg-panel p-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!query.trim() || searching) return;
              setSearching(true);
              try {
                const history = searchMode === "ai" ? thread.slice(-3) : [];
                let embedding: number[] | undefined;
                if (searchMode === "ai") {
                  try {
                    embedding = (
                      await embed([
                        history.length ? `${history[history.length - 1]!.q} ${query}` : query,
                      ])
                    )[0];
                  } catch {
                    embedding = undefined;
                  }
                }
                setCluster(null);
                const res = await search({
                  data: {
                    query,
                    mode: searchMode,
                    ...(embedding ? { embedding } : {}),
                    ...(history.length ? { history } : {}),
                  },
                });
                setResult(res);
                if (searchMode === "ai" && res.answer && !res.error) {
                  setThread((prev) => [...prev, { q: query, a: res.answer }].slice(-6));
                  setQuery("");
                }
              } catch {
                toast.error(t("Ricerca non disponibile. Riprova."));
              } finally {
                setSearching(false);
              }
            }}
          >
            <Search className="ml-2 size-4 shrink-0 text-muted-foreground" />
            <input
              className="min-w-0 flex-1 bg-transparent px-1 py-3 text-base outline-none sm:text-sm"
              aria-label={t("Cerca idee")}
              placeholder={
                searchMode === "ai"
                  ? thread.length
                    ? t("Continua la conversazione…")
                    : t("Chiedi alla tua memoria…")
                  : t("Cerca tra le idee…")
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value && !thread.length) setResult(null);
              }}
            />
            <Button
              type="button"
              variant={searchMode === "ai" ? "secondary" : "ghost"}
              size="sm"
              className="shrink-0"
              title={
                searchMode === "ai"
                  ? t("Risposte AI attive: tocca per cercare per parole")
                  : t("Attiva le risposte AI dalla tua memoria")
              }
              aria-pressed={searchMode === "ai"}
              onClick={() => setSearchMode(searchMode === "ai" ? "keyword" : "ai")}
            >
              <Sparkles className={searchMode === "ai" ? "text-glow" : ""} />
              AI
            </Button>
            <Button
              type="submit"
              size="icon"
              aria-label={t("Avvia ricerca")}
              disabled={searching || !query.trim()}
            >
              {searching ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <ArrowUp />
              )}
            </Button>
          </form>
        </div>
      </div>
      {selected && graph.data && (
        <NotePanel
          key={selected}
          id={selected}
          data={graph.data}
          onClose={() => setSelected(null)}
          onSelect={setSelected}
          onEdit={setEditor}
          onDeleted={() => {
            setSelected(null);
            setResult(null);
            void refresh();
          }}
          onContentChanged={() => {
            void refresh().then(() => pipeline.run());
          }}
        />
      )}
      {editor && (
        <NoteEditor
          {...(editor === "new" ? {} : { note: editor })}
          onClose={() => setEditor(null)}
          onSaved={(id) => {
            setEditor(null);
            setSelected(id);
            setResult(null);
            void refresh().then(() => pipeline.run());
          }}
        />
      )}
      {imported && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t("Conferma importazione")}
        >
          <div className="panel-shadow w-full max-w-md space-y-5 rounded-lg border border-border bg-card p-6">
            <h2 className="text-xl font-light">{t("Importa archivio")}</h2>
            <p className="text-sm text-muted-foreground">
              {t(
                "{notes} note e {edges} connessioni verificate. Le note già presenti nello stesso archivio saranno ripristinate, senza duplicati.",
                { notes: imported.tables.notes.length, edges: imported.tables.edges.length },
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setImported(null)}>
                {t("Annulla")}
              </Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const count = await restoreArchive(imported);
                    setImported(null);
                    setSelected(null);
                    setResult(null);
                    await refresh();
                    void pipeline.run();
                    toast.success(t("Ripristinate {n} note", { n: count }));
                  } catch (e) {
                    toast.error(tr((e as Error).message));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? t("Importazione…") : t("Importa")}
              </Button>
            </div>
          </div>
        </div>
      )}
      {passwordOpen && <PasswordDialog onClose={() => setPasswordOpen(false)} />}
      {remindersOpen && (
        <RemindersPanel
          onClose={() => setRemindersOpen(false)}
          onSelectNote={(id) => {
            setRemindersOpen(false);
            setSelected(id);
          }}
        />
      )}
      {importOpen && (
        <ImportDialog
          userId={session.user.id}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            void refresh().then(() => pipeline.run());
          }}
        />
      )}
    </main>
  );
}

/** Lets accounts created with the email link add a password, so the next sign-in needs no email. */
function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  const t = useT();
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-title"
    >
      <form
        className="panel-shadow w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password.length < 8) {
            toast.error(t("Usa almeno 8 caratteri."));
            return;
          }
          setBusy(true);
          const { error } = await supabase.auth.updateUser({ password });
          setBusy(false);
          if (error) toast.error(t("Non sono riuscito a salvare la password. Riprova."));
          else {
            toast.success(t("Password impostata: da ora puoi entrare con email e password."));
            onClose();
          }
        }}
      >
        <h2 id="password-title" className="text-xl font-light">
          {t("Imposta una password")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("Così la prossima volta entri con email e password, senza aspettare il link.")}
        </p>
        <input
          type="password"
          autoFocus
          autoComplete="new-password"
          aria-label={t("Nuova password")}
          placeholder={t("Almeno 8 caratteri")}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:border-ring sm:text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("Annulla")}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t("Salvataggio…") : t("Salva")}
          </Button>
        </div>
      </form>
    </div>
  );
}
