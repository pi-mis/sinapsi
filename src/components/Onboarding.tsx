import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  FileText,
  Github,
  Globe,
  Image as ImageIcon,
  Link2,
  MessageCircle,
  Mic,
  Type,
  Users,
  X,
} from "lucide-react";
import { buildDemoGraph } from "@/graph/demo";
import type { GraphData } from "@/graph/data";
import type { ViewCommand } from "@/graph/GraphScene";
import { Button } from "./ui/button";

const GraphScene = lazy(() => import("@/graph/GraphScene"));

/**
 * First-run tour, played over a live demo brain that grows, lights up and
 * dissolves. Seven short scenes; tap or arrow keys to move, Esc to skip.
 */

const LABELS: Record<string, string> = {
  libro: "Libri",
  ricetta: "Ricette",
  ricordo: "Ricordi",
  progetto: "Progetti",
  concetto: "Idee",
  musica: "Musica",
};
const GUITAR = "demo-5-9";
const PATAGONIA = "demo-2-7";
const ICELAND = "demo-2-2";

type Scene = {
  duration: number;
  title: string;
  body: string;
  focus?: string;
  highlight?: (data: GraphData) => string[];
  visual?: "content" | "chat" | "connectors" | "reminder";
};

const clusterIds = (type: string) => (data: GraphData) =>
  data.nodes.filter((n) => n.type === type).map((n) => n.id);

const SCENES: Scene[] = [
  {
    duration: 5600,
    title: "Ciao, questo è Sinapsi.",
    body: "Il tuo cervello ha 86 miliardi di neuroni e dimentica comunque dove hai messo le chiavi. Questo ne ha quanti ne vuoi e non dimentica niente.",
  },
  {
    duration: 7000,
    title: "Ogni idea è un neurone",
    body: "Un’intuizione, un ricordo, un progetto, la ricetta della nonna. Dentro ci metti quello che serve, e più cose contiene, più il neurone cresce.",
    focus: GUITAR,
    visual: "content",
  },
  {
    duration: 6800,
    title: "Le idee si collegano da sole",
    body: "Non devi archiviare niente. L’AI legge le note e unisce quelle che si somigliano con le sinapsi; i temi diventano costellazioni colorate.",
    highlight: clusterIds("ricordo"),
  },
  {
    duration: 8600,
    title: "Chiedi alla tua memoria",
    body: "Risponde solo con quello che hai scritto tu, e ti dice da quale nota l’ha preso.",
    highlight: () => [PATAGONIA, ICELAND],
    visual: "chat",
  },
  {
    duration: 8400,
    title: "Si riempie quasi da solo",
    body: "Importa chat di WhatsApp, calendario e contatti. Collega GitHub: ogni repository diventa un progetto con README e ultimi commit, e si aggiorna da solo mentre ci lavori.",
    highlight: clusterIds("progetto"),
    visual: "connectors",
  },
  {
    duration: 7400,
    title: "E lavora mentre non ci pensi",
    body: "Scrivi “voglio iscrivermi al corso di chitarra” e Sinapsi crea un promemoria. Se la scadenza non la sai, la cerca sul web.",
    focus: GUITAR,
    visual: "reminder",
  },
  {
    duration: 7600,
    title: "Ora tocca a te",
    body: "Questa era una demo e adesso sparisce. Puoi riguardarla quando vuoi dal menu ⋯, con “Carica demo” o “Rivedi l’introduzione”.",
  },
];

/** The demo brain limited to its first `count` neurons (constellations appear one after another). */
function prefix(full: GraphData, count: number): GraphData {
  const nodes = full.nodes.slice(0, count);
  const ids = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    edges: full.edges.filter((e) => e.a < count && e.b < count),
    demoCount: nodes.length,
    constellations: full.constellations
      .filter((c) => nodes.filter((n) => n.cluster === c.id && ids.has(n.id)).length >= 2)
      .map((c) => ({
        ...c,
        label: LABELS[full.nodes.find((n) => n.cluster === c.id)?.type ?? ""] ?? c.label,
      })),
  };
}

function useTyped(text: string, active: boolean, delay = 600, speed = 26) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (!active) {
      setShown("");
      return;
    }
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i++;
      setShown(text.slice(0, i));
      if (i < text.length) timer = setTimeout(tick, speed);
    };
    timer = setTimeout(tick, delay);
    return () => clearTimeout(timer);
  }, [text, active, delay, speed]);
  return shown;
}

export function Onboarding({ onDone }: { onDone: (createNote: boolean) => void }) {
  const full = useMemo(buildDemoGraph, []);
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(reduced ? full.nodes.length : 0);
  const [command, setCommand] = useState<ViewCommand>({ action: "reset", tick: 0 });
  const [leaving, setLeaving] = useState(false);
  const scene = SCENES[index]!;
  const last = index === SCENES.length - 1;

  const finish = useCallback(
    (createNote = false) => {
      setLeaving(true);
      setTimeout(() => onDone(createNote), reduced ? 0 : 650);
    },
    [onDone, reduced],
  );
  const next = useCallback(() => (last ? finish() : setIndex((i) => i + 1)), [last, finish]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // The brain grows in the first scene and dissolves in the last one.
  const countRef = useRef(count);
  useEffect(() => {
    if (reduced) return;
    const target = last ? 0 : full.nodes.length;
    const timer = setInterval(
      () => {
        const c = countRef.current;
        if (c === target) {
          clearInterval(timer);
          return;
        }
        const n = Math.max(0, Math.min(full.nodes.length, c + (last ? -5 : 5)));
        countRef.current = n;
        setCount(n);
        setCommand((cmd) => ({ action: "reset", tick: cmd.tick + 1 }));
      },
      last ? 110 : 190,
    );
    return () => clearInterval(timer);
  }, [last, full.nodes.length, reduced]);

  // Camera back to the whole brain when a scene has no focus.
  useEffect(() => {
    if (!scene.focus && index > 0) setCommand((cmd) => ({ action: "reset", tick: cmd.tick + 1 }));
  }, [index, scene.focus]);

  // Scenes advance by themselves.
  useEffect(() => {
    const timer = setTimeout(next, scene.duration);
    return () => clearTimeout(timer);
  }, [index, scene.duration, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") back();
      else if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, finish]);

  const data = useMemo(() => prefix(full, Math.max(count, 1)), [full, count]);
  const highlighted = useMemo(
    () => (scene.highlight ? scene.highlight(full) : null),
    [scene, full],
  );

  return (
    <div
      className={`onboarding fixed inset-0 z-[60] bg-background transition-opacity duration-700 ${leaving ? "opacity-0" : "opacity-100"}`}
      role="dialog"
      aria-modal="true"
      aria-label="Introduzione a Sinapsi"
    >
      <Suspense fallback={null}>
        <div className="pointer-events-none absolute inset-0">
          <GraphScene
            data={data}
            quality={0}
            reducedMotion={reduced}
            selectedId={scene.focus ?? null}
            onSelect={() => {}}
            command={command}
            mode="orbit"
            highlighted={highlighted}
            className="absolute inset-x-0 top-0 bottom-[28%] sm:inset-0 sm:left-[22%]"
          />
        </div>
      </Suspense>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent sm:bg-gradient-to-r sm:from-background sm:via-background/40 sm:to-transparent" />

      {/* Tap zones: left half goes back, right half goes on. */}
      <button
        type="button"
        aria-label="Indietro"
        className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize"
        onClick={back}
      />
      <button
        type="button"
        aria-label="Avanti"
        className="absolute inset-y-0 right-0 w-2/3 cursor-e-resize"
        onClick={next}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {SCENES.map((s, i) => (
            <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-foreground/15">
              <div
                key={i === index ? `run-${index}` : `idle-${i}`}
                className={`h-full rounded-full bg-foreground/80 ${i === index ? "onboarding-progress" : ""}`}
                style={{
                  width: i < index ? "100%" : i === index ? undefined : "0%",
                  animationDuration: `${s.duration}ms`,
                }}
              />
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="pointer-events-auto h-8 px-2 text-xs text-muted-foreground"
          onClick={() => finish()}
        >
          <X />
          Salta
        </Button>
      </div>

      <section
        key={index}
        className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:bottom-auto sm:left-0 sm:top-1/2 sm:w-[min(34rem,46vw)] sm:-translate-y-1/2 sm:px-12 sm:pb-0"
        aria-live="polite"
      >
        <h2 className="onboarding-in text-[2rem] font-extralight leading-[1.1] tracking-tight sm:text-5xl">
          {scene.title}
        </h2>
        <p
          className="onboarding-in mt-4 max-w-[32rem] text-[15px] leading-relaxed text-muted-foreground sm:text-base"
          style={{ animationDelay: "120ms" }}
        >
          {scene.body}
        </p>
        <div className="onboarding-in mt-6" style={{ animationDelay: "260ms" }}>
          {scene.visual === "content" && <ContentKinds />}
          {scene.visual === "chat" && <ChatDemo />}
          {scene.visual === "connectors" && <Connectors />}
          {scene.visual === "reminder" && <ReminderDemo />}
          {last && (
            <Button className="pointer-events-auto h-11 px-6" onClick={() => finish(true)}>
              Crea la tua prima idea
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function ContentKinds() {
  const kinds = [
    { icon: Type, label: "Testo" },
    { icon: ImageIcon, label: "Foto" },
    { icon: FileText, label: "PDF" },
    { icon: Mic, label: "Vocali" },
    { icon: Link2, label: "Link" },
  ];
  return (
    <ul className="flex flex-wrap gap-2">
      {kinds.map((k, i) => (
        <li
          key={k.label}
          className="onboarding-pop flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1.5 text-sm backdrop-blur"
          style={{ animationDelay: `${450 + i * 140}ms` }}
        >
          <k.icon className="size-4 text-muted-foreground" />
          {k.label}
        </li>
      ))}
    </ul>
  );
}

function ChatDemo() {
  const question = "Cosa avevo pensato per la Patagonia?";
  const answer =
    "Torres del Paine a novembre, con il vento costante. È collegata a “Islanda in camper”: a quanto pare ti piacciono i posti dove il cappello vola via.";
  const q = useTyped(question, true, 500, 34);
  const a = useTyped(answer, q.length === question.length, 500, 18);
  return (
    <div className="max-w-[30rem] space-y-2 text-sm">
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-primary-foreground">
        {q || " "}
      </div>
      {q.length === question.length && (
        <div className="w-fit max-w-[92%] rounded-2xl rounded-bl-sm border border-border bg-card/80 px-3.5 py-2 leading-6 backdrop-blur">
          {a}
          {a.length < answer.length && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/60 align-middle" />
          )}
        </div>
      )}
    </div>
  );
}

function Connectors() {
  const sources = [
    { icon: MessageCircle, label: "WhatsApp" },
    { icon: CalendarDays, label: "Calendario" },
    { icon: Users, label: "Contatti" },
  ];
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-2">
        {sources.map((s, i) => (
          <li
            key={s.label}
            className="onboarding-pop flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1.5 text-sm backdrop-blur"
            style={{ animationDelay: `${450 + i * 140}ms` }}
          >
            <s.icon className="size-4 text-muted-foreground" />
            {s.label}
          </li>
        ))}
      </ul>
      <div
        className="onboarding-pop flex w-fit items-center gap-3 rounded-xl border border-border bg-card/80 px-4 py-3 backdrop-blur"
        style={{ animationDelay: "1000ms" }}
      >
        <Github className="size-6 shrink-0" />
        <div className="text-sm leading-5">
          <div>sinapsi</div>
          <div className="text-xs text-muted-foreground">
            README, 12 commit questa settimana, aggiornato da solo
          </div>
        </div>
      </div>
    </div>
  );
}

function ReminderDemo() {
  const [found, setFound] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    timer.current = setTimeout(() => setFound(true), 2200);
    return () => clearTimeout(timer.current);
  }, []);
  return (
    <div
      className="onboarding-pop flex w-fit max-w-[30rem] items-start gap-3 rounded-xl border border-border bg-card/80 px-4 py-3 backdrop-blur"
      style={{ animationDelay: "500ms" }}
    >
      <Bell className="mt-0.5 size-5 shrink-0 text-glow" />
      <div className="text-sm leading-5">
        <div>Iscriviti al corso di chitarra</div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Globe className="size-3.5" />
          {found ? (
            <span className="onboarding-in">
              Scadenza trovata: le iscrizioni chiudono il 15 novembre
            </span>
          ) : (
            "Cerco la scadenza sul web…"
          )}
        </div>
      </div>
    </div>
  );
}
