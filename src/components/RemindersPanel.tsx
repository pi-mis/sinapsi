import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  X,
  Plus,
  Check,
  Clock,
  Globe,
  CalendarPlus,
  RefreshCw,
  Copy,
  Sparkles,
  BellRing,
  LoaderCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  addReminder,
  feedToken,
  feedUrl,
  listReminders,
  rescheduleReminder,
  retryLookup,
  rotateFeedToken,
  setReminderStatus,
} from "@/brain/client";
import { groupOf, localToday, type ReminderGroup } from "@/brain/reminders";
import { weeklyDigest } from "@/brain/brain.functions";

const GROUPS: { id: ReminderGroup; label: string }[] = [
  { id: "scaduti", label: "Scaduti" },
  { id: "oggi", label: "Oggi" },
  { id: "settimana", label: "Questa settimana" },
  { id: "poi", label: "Più avanti" },
  { id: "senza data", label: "Senza data" },
];
const field =
  "h-9 rounded-md border border-input bg-background px-2 text-base outline-none focus:border-ring sm:text-sm";

function shift(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localToday(d);
}

function humanDate(due: string, today: string) {
  if (due === today) return "oggi";
  if (due === shift(today, 1)) return "domani";
  return new Date(`${due}T12:00:00`).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function useReminders() {
  return useQuery({ queryKey: ["reminders"], queryFn: listReminders, staleTime: 60_000 });
}

/** Reminders, the weekly digest and the phone calendar subscription. */
export function RemindersPanel({
  onClose,
  onSelectNote,
}: {
  onClose: () => void;
  onSelectNote: (id: string) => void;
}) {
  const qc = useQueryClient();
  const today = localToday();
  const reminders = useReminders();
  const digestFn = useServerFn(weeklyDigest);
  const digest = useQuery({
    queryKey: ["digest", today],
    queryFn: () => digestFn({ data: { today } }),
    staleTime: 3_600_000,
    retry: false,
  });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ text: "", due: "", time: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [regen, setRegen] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["reminders"] });
  const act = async (id: string, job: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await job();
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const items = reminders.data ?? [];

  return (
    <aside
      className="panel-shadow fixed inset-0 z-40 flex flex-col overflow-hidden border border-border bg-card pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] md:inset-y-4 md:left-auto md:right-4 md:w-[400px] md:rounded-lg md:pb-0 md:pt-0"
      aria-label="Promemoria"
    >
      <header className="flex items-center justify-between border-b border-border p-5">
        <h2 className="text-xl font-light">Il tuo cervello, in parallelo</h2>
        <Button size="icon" variant="ghost" aria-label="Chiudi promemoria" onClick={onClose}>
          <X />
        </Button>
      </header>
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <section className="rounded-lg border border-border bg-background/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4 text-glow" />
              La tua settimana
            </h3>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              disabled={regen || digest.isFetching}
              onClick={async () => {
                setRegen(true);
                try {
                  qc.setQueryData(
                    ["digest", today],
                    await digestFn({ data: { today, force: true } }),
                  );
                } finally {
                  setRegen(false);
                }
              }}
            >
              <RefreshCw className={regen ? "animate-spin" : ""} />
              Rigenera
            </Button>
          </div>
          {digest.isLoading || regen ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Ripenso alla tua settimana…
            </p>
          ) : digest.data?.text ? (
            <>
              <p className="whitespace-pre-wrap text-sm leading-6">{digest.data.text}</p>
              {digest.data.notes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {digest.data.notes.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onSelectNote(n.id)}
                      className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent"
                    >
                      {n.title}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {digest.data?.error ||
                "Il riepilogo arriva quando ci sono note nuove nella settimana."}
            </p>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm">Promemoria{items.length ? ` · ${items.length}` : ""}</h3>
            {!adding && (
              <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
                <Plus />
                Aggiungi
              </Button>
            )}
          </div>
          {adding && (
            <form
              className="mb-4 space-y-2 rounded-md border border-border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.text.trim()) return;
                void act("new", async () => {
                  await addReminder(draft.text, draft.due || null, draft.time || null);
                  setDraft({ text: "", due: "", time: "" });
                  setAdding(false);
                });
              }}
            >
              <input
                autoFocus
                aria-label="Cosa ricordare"
                placeholder="Cosa devo ricordarti?"
                className={`${field} w-full`}
                value={draft.text}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  aria-label="Data"
                  className={`${field} min-w-0 flex-1`}
                  value={draft.due}
                  onChange={(e) => setDraft({ ...draft, due: e.target.value })}
                />
                <input
                  type="time"
                  aria-label="Ora"
                  className={`${field} w-28`}
                  value={draft.time}
                  disabled={!draft.due}
                  onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  Annulla
                </Button>
                <Button type="submit" size="sm" disabled={busy === "new"}>
                  Salva
                </Button>
              </div>
            </form>
          )}
          {reminders.isLoading && <p className="text-sm text-muted-foreground">Caricamento…</p>}
          {!reminders.isLoading && !items.length && (
            <p className="text-sm leading-6 text-muted-foreground">
              Nessun promemoria. Scrivi nelle note cosa vuoi fare (“voglio iscrivermi al corso di
              chitarra”, “consegna la tesi entro il 30”): l’AI li trova da sola e, se manca la data,
              la cerca sul web.
            </p>
          )}
          {GROUPS.map((g) => {
            const list = items.filter((r) => groupOf(r.payload, today) === g.id);
            if (!list.length) return null;
            return (
              <div key={g.id} className="mb-4">
                <h4
                  className={`mb-1.5 text-xs ${g.id === "scaduti" ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {g.label}
                </h4>
                <ul className="space-y-1.5">
                  {list.map((r) => {
                    const p = r.payload;
                    return (
                      <li
                        key={r.id}
                        className="rounded-md border border-border bg-background/40 p-2.5"
                      >
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            aria-label="Fatto"
                            title="Fatto"
                            disabled={busy === r.id}
                            onClick={() => act(r.id, () => setReminderStatus(r.id, "done"))}
                            className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-muted-foreground/50 hover:border-primary hover:bg-primary/20"
                          >
                            {busy === r.id ? (
                              <LoaderCircle className="size-3 animate-spin" />
                            ) : (
                              <Check className="size-3 opacity-0 hover:opacity-100" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-5">{p.text}</p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              {p.due && (
                                <span className={g.id === "scaduti" ? "text-destructive" : ""}>
                                  {humanDate(p.due, today)}
                                  {p.time ? ` · ${p.time}` : ""}
                                </span>
                              )}
                              {p.lookup === "pending" && (
                                <span className="flex items-center gap-1">
                                  <Globe className="size-3" />
                                  cerco la data…
                                </span>
                              )}
                              {p.lookup === "failed" && !p.due && (
                                <button
                                  type="button"
                                  className="flex items-center gap-1 underline-offset-2 hover:underline"
                                  onClick={() =>
                                    act(r.id, async () =>
                                      toast.message(
                                        (await retryLookup(r.id))
                                          ? "Data trovata."
                                          : "Non ho trovato una data affidabile.",
                                      ),
                                    )
                                  }
                                >
                                  <Globe className="size-3" />
                                  data non trovata · riprova
                                </button>
                              )}
                              {p.url && (
                                <a
                                  href={p.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 underline-offset-2 hover:underline"
                                >
                                  <Globe className="size-3" />
                                  fonte
                                </a>
                              )}
                              {r.note_id && r.noteTitle && (
                                <button
                                  type="button"
                                  className="max-w-[12rem] truncate underline-offset-2 hover:underline"
                                  onClick={() => onSelectNote(r.note_id!)}
                                >
                                  da “{r.noteTitle}”
                                </button>
                              )}
                            </p>
                            {p.detail && (
                              <p className="mt-1 text-xs text-muted-foreground">{p.detail}</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1 pl-7">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={busy === r.id}
                            onClick={() =>
                              act(r.id, () =>
                                rescheduleReminder(
                                  r,
                                  shift(p.due && p.due > today ? p.due : today, 1),
                                ),
                              )
                            }
                          >
                            <Clock />
                            {p.due ? "+1 giorno" : "Domani"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={busy === r.id}
                            onClick={() =>
                              act(r.id, () =>
                                rescheduleReminder(
                                  r,
                                  shift(p.due && p.due > today ? p.due : today, 7),
                                ),
                              )
                            }
                          >
                            +1 settimana
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto h-7 px-2 text-xs text-muted-foreground"
                            disabled={busy === r.id}
                            onClick={() => act(r.id, () => setReminderStatus(r.id, "dismissed"))}
                          >
                            Ignora
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>

        <PhoneSection />
      </div>
    </aside>
  );
}

/** Subscribing the phone's calendar to the private feed gives real notifications without an app. */
function PhoneSection() {
  const qc = useQueryClient();
  const token = useQuery({ queryKey: ["feed-token"], queryFn: () => feedToken(false) });
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const create = async (rotate = false) => {
    setBusy(true);
    try {
      qc.setQueryData(["feed-token"], rotate ? await rotateFeedToken() : await feedToken(true));
      if (rotate) toast.success("Nuovo link creato: quello vecchio non funziona più.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3 border-t border-border pt-5">
      <h3 className="flex items-center gap-2 text-sm">
        <BellRing className="size-4" />
        Notifiche sul telefono
      </h3>
      <p className="text-xs leading-5 text-muted-foreground">
        Iscrivi il calendario del telefono ai tuoi promemoria: arrivano come eventi con un avviso
        (alle 9 del giorno stesso, o 30 minuti prima se c’è un orario), anche quando Sinapsi è
        chiusa.
      </p>
      {token.data ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <a href={feedUrl(token.data, "webcal")}>
                <CalendarPlus />
                iPhone / Mac
              </a>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(feedUrl(token.data!));
                toast.success(
                  "Link copiato. In Google Calendar dal computer: Altri calendari → + → Da URL.",
                );
              }}
            >
              <Copy />
              Copia link (Google, Outlook)
            </Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Il link è privato: chi lo ha vede i tuoi promemoria. Funziona dall’indirizzo pubblicato
            dell’app.{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              disabled={busy}
              onClick={() => void create(true)}
            >
              Crea un nuovo link
            </button>
          </p>
        </div>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || token.isLoading}
          onClick={() => void create()}
        >
          <CalendarPlus />
          Collega al calendario del telefono
        </Button>
      )}
      {permission !== "unsupported" && permission !== "granted" && (
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-muted-foreground"
          onClick={async () => setPermission(await Notification.requestPermission())}
        >
          Avvisami anche nel browser quando apro Sinapsi
        </Button>
      )}
    </section>
  );
}
