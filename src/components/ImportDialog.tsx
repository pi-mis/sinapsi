import { useEffect, useRef, useState } from "react";
import { unzipSync } from "fflate";
import { toast } from "sonner";
import {
  X,
  MessageCircle,
  Users,
  CalendarDays,
  Upload,
  LoaderCircle,
  RefreshCw,
  Trash2,
  Link2,
} from "lucide-react";
import { Button } from "./ui/button";
import { parseWhatsApp, toSessions, chatNameFromFile, type ChatMessage } from "@/import/whatsapp";
import { parseLinkedInCsv, parseVCards, type ContactInput } from "@/import/contacts";
import { parseIcs, type CalendarEvent } from "@/import/ics";
import {
  addCalendar,
  importContacts,
  importEvents,
  importWhatsApp,
  linkPeople,
  listCalendars,
  removeCalendar,
  syncCalendars,
  type CalendarFeed,
  type Progress,
} from "@/import/run";

type Tab = "whatsapp" | "contacts" | "calendar";
type Status = { message: string; done?: number; total?: number } | null;

const field =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:border-ring sm:text-sm";
const hint = "text-xs leading-5 text-muted-foreground";

/** Import centre: WhatsApp chats, contacts (vCard / LinkedIn) and calendars (.ics file or live iCal link). */
export function ImportDialog({
  userId,
  onClose,
  onImported,
}: {
  userId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [tab, setTab] = useState<Tab>("whatsapp");
  const [status, setStatus] = useState<Status>(null);
  const report: Progress = (message, done, total) =>
    setStatus({ message, ...(done != null ? { done } : {}), ...(total != null ? { total } : {}) });
  const run = async (job: () => Promise<string>) => {
    setStatus({ message: "Un momento…" });
    try {
      const message = await job();
      toast.success(message);
      onImported();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStatus(null);
    }
  };
  const busy = status !== null;
  const tabs = [
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { id: "contacts", label: "Contatti", icon: Users },
    { id: "calendar", label: "Calendario", icon: CalendarDays },
  ] as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-title"
    >
      <div className="panel-shadow flex max-h-[92dvh] w-full max-w-lg flex-col rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border p-4">
          <h2 id="import-title" className="text-lg font-light">
            Riempi il cervello
          </h2>
          <Button size="icon" variant="ghost" aria-label="Chiudi" disabled={busy} onClick={onClose}>
            <X />
          </Button>
        </header>
        <nav className="flex gap-1 border-b border-border p-2" aria-label="Fonte">
          {tabs.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={tab === t.id ? "secondary" : "ghost"}
              aria-pressed={tab === t.id}
              disabled={busy}
              onClick={() => setTab(t.id)}
            >
              <t.icon />
              {t.label}
            </Button>
          ))}
        </nav>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {tab === "whatsapp" && (
            <WhatsAppTab userId={userId} busy={busy} run={run} report={report} />
          )}
          {tab === "contacts" && (
            <ContactsTab userId={userId} busy={busy} run={run} report={report} />
          )}
          {tab === "calendar" && (
            <CalendarTab userId={userId} busy={busy} run={run} report={report} />
          )}
        </div>
        {status && (
          <footer className="border-t border-border p-4" role="status">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {status.message}
            </div>
            {status.total ? (
              <div className="mt-2 h-1 overflow-hidden rounded bg-border">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${Math.round(((status.done ?? 0) / status.total) * 100)}%` }}
                />
              </div>
            ) : null}
          </footer>
        )}
      </div>
    </div>
  );
}

type TabProps = {
  userId: string;
  busy: boolean;
  run: (job: () => Promise<string>) => Promise<void>;
  report: Progress;
};

function FilePicker({
  accept,
  label,
  disabled,
  onFile,
}: {
  accept: string;
  label: string;
  disabled: boolean;
  onFile: (f: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant="secondary" disabled={disabled} onClick={() => input.current?.click()}>
        <Upload />
        {label}
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        aria-label={label}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </>
  );
}

async function readChatFile(file: File): Promise<{ text: string; name: string | null }> {
  if (/\.zip$/i.test(file.name) || file.type.includes("zip")) {
    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (f) => /\.txt$/i.test(f.name),
    });
    const names = Object.keys(entries).sort(
      (a, b) =>
        (/_chat\.txt$/i.test(b) ? 1 : 0) - (/_chat\.txt$/i.test(a) ? 1 : 0) ||
        entries[b]!.length - entries[a]!.length,
    );
    const first = names[0];
    if (!first) throw new Error("Lo zip non contiene la chat (.txt).");
    return {
      text: new TextDecoder().decode(entries[first]),
      name: chatNameFromFile(file.name) ?? chatNameFromFile(first.split("/").pop() ?? ""),
    };
  }
  return { text: await file.text(), name: chatNameFromFile(file.name) };
}

function WhatsAppTab({ userId, busy, run, report }: TabProps) {
  const [chat, setChat] = useState<{
    name: string;
    auto: boolean;
    messages: ChatMessage[];
    participants: { name: string; count: number }[];
  } | null>(null);
  const [me, setMe] = useState("");
  const [useAI, setUseAI] = useState(true);
  const sessions = chat ? toSessions(chat.messages).length : 0;
  const load = async (file: File) => {
    try {
      const { text, name } = await readChatFile(file);
      const parsed = parseWhatsApp(text);
      if (!parsed.messages.length)
        throw new Error("Non ho trovato messaggi: è un'esportazione di WhatsApp?");
      const others = parsed.participants.map((p) => p.name);
      setChat({ name: name ?? others.slice(0, 3).join(", "), auto: !name, ...parsed });
      setMe("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <>
      <p className={hint}>
        In WhatsApp apri la chat → nome in alto → <b>Esporta chat</b> → <b>Senza media</b>, e carica
        qui il file (.zip o .txt). Ogni conversazione diventa un neurone con la sua trascrizione,
        collegato alla persona o al gruppo.
      </p>
      <FilePicker
        accept=".txt,.zip,text/plain,application/zip"
        label={chat ? "Scegli un'altra chat" : "Scegli la chat esportata"}
        disabled={busy}
        onFile={load}
      />
      {chat && (
        <div className="space-y-4 rounded-md border border-border p-4">
          <p className="text-sm">
            {chat.messages.length} messaggi dal {chat.messages[0]!.at.toLocaleDateString("it-IT")}{" "}
            al {chat.messages[chat.messages.length - 1]!.at.toLocaleDateString("it-IT")} →{" "}
            <b>{sessions} conversazioni</b>
          </p>
          <label className="block space-y-1 text-xs text-muted-foreground">
            <span>Nome della chat</span>
            <input
              className={field}
              value={chat.name}
              onChange={(e) => setChat({ ...chat, name: e.target.value, auto: false })}
            />
          </label>
          <label className="block space-y-1 text-xs text-muted-foreground">
            <span>Tu chi sei nella chat?</span>
            <select
              className={field}
              value={me}
              onChange={(e) => {
                const value = e.target.value;
                setMe(value);
                // Without a name in the file, the chat is named after the other participants.
                if (chat.auto)
                  setChat({
                    ...chat,
                    name: chat.participants
                      .map((p) => p.name)
                      .filter((n) => n !== value)
                      .slice(0, 3)
                      .join(", "),
                  });
              }}
            >
              <option value="">Scegli…</option>
              {chat.participants.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} ({p.count} messaggi)
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
            />
            <span>
              Riassumi ogni conversazione con l'AI
              <span className={`block ${hint}`}>
                {useAI
                  ? `I messaggi di ogni conversazione vengono inviati a Groq per il riassunto (circa ${sessions} delle tue richieste AI di oggi). Contengono anche i messaggi degli altri: importa solo chat che ti senti di condividere così.`
                  : "Nessun messaggio lascia il dispositivo: le conversazioni diventano note private con la trascrizione."}
              </span>
            </span>
          </label>
          <Button
            className="w-full"
            disabled={busy || !me || !chat.name.trim()}
            onClick={() =>
              run(async () => {
                const r = await importWhatsApp({
                  userId,
                  chatName: chat.name.trim(),
                  me,
                  messages: chat.messages,
                  participants: chat.participants.map((p) => p.name),
                  useAI,
                  report,
                });
                setChat(null);
                return `${r.created} conversazioni importate${r.skipped ? `, ${r.skipped} già presenti` : ""}${r.aiFailures ? ` (${r.aiFailures} senza riassunto AI)` : ""}.`;
              })
            }
          >
            Importa {sessions} conversazioni
          </Button>
        </div>
      )}
    </>
  );
}

function ContactsTab({ userId, busy, run, report }: TabProps) {
  const [contacts, setContacts] = useState<ContactInput[] | null>(null);
  const load = async (file: File) => {
    const text = await file.text();
    const parsed = /\.csv$/i.test(file.name) ? parseLinkedInCsv(text) : parseVCards(text);
    if (!parsed.length) toast.error("Non ho trovato contatti nel file.");
    else setContacts(parsed);
  };
  return (
    <>
      <p className={hint}>
        Carica la rubrica come <b>vCard (.vcf)</b> — iPhone: app Contatti → Elenchi → tieni premuto
        → Esporta; Google Contatti: Esporta → vCard — oppure il file <b>Connections.csv</b> di
        LinkedIn (Impostazioni → Privacy dei dati → Ottieni una copia dei tuoi dati → Collegamenti).
      </p>
      <p className={hint}>
        Le persone citate per nome e cognome nelle tue note diventano neuroni privati collegati a
        quelle note. I contatti non vengono mai inviati all'AI.
      </p>
      <div className="flex flex-wrap gap-2">
        <FilePicker
          accept=".vcf,.csv,text/vcard,text/csv"
          label="Scegli il file dei contatti"
          disabled={busy}
          onFile={load}
        />
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            run(async () => `${await linkPeople(userId, report)} persone collegate alle note.`)
          }
        >
          <Link2 />
          Ricollega le persone
        </Button>
      </div>
      {contacts && (
        <div className="space-y-3 rounded-md border border-border p-4">
          <p className="text-sm">
            {contacts.length} contatti trovati, ad esempio{" "}
            {contacts
              .slice(0, 3)
              .map((c) => c.full_name)
              .join(", ")}
            .
          </p>
          <Button
            className="w-full"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await importContacts(userId, contacts, report);
                setContacts(null);
                return `${r.added} contatti aggiunti${r.duplicates ? ` (${r.duplicates} già presenti)` : ""}; ${r.linked} persone collegate alle note.`;
              })
            }
          >
            Importa {contacts.length} contatti
          </Button>
        </div>
      )}
    </>
  );
}

function CalendarTab({ userId, busy, run, report }: TabProps) {
  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const refresh = () =>
    listCalendars()
      .then(setFeeds)
      .catch(() => setFeeds([]));
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <>
      <section className="space-y-3">
        <h3 className="text-sm">Collega un calendario che si aggiorna da solo</h3>
        <p className={hint}>
          Google Calendar (dal computer): Impostazioni → il tuo calendario →{" "}
          <b>Indirizzo segreto in formato iCal</b>. Funziona anche con i calendari iCloud pubblici.
          Sinapsi lo controlla ogni 6 ore quando apri l'app, dai 2 mesi passati ai 12 futuri.
        </p>
        <p className={hint}>
          È un link privato: chi lo possiede vede i tuoi eventi. Qui resta salvato solo nel tuo
          account.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!url.trim()) return;
            void run(async () => {
              const r = await addCalendar(userId, url, report);
              setUrl("");
              await refresh();
              return `Calendario collegato: ${r.saved} eventi salvati.`;
            });
          }}
        >
          <input
            type="url"
            inputMode="url"
            placeholder="https://calendar.google.com/…/basic.ics"
            aria-label="Link iCal"
            className={`${field} min-w-0 flex-1`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button type="submit" disabled={busy || !url.trim()}>
            Collega
          </Button>
        </form>
        {feeds.length > 0 && (
          <ul className="space-y-2">
            {feeds.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{f.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {f.lastSync
                      ? `Aggiornato ${new Date(f.lastSync).toLocaleString("it-IT")}`
                      : "Mai aggiornato"}
                  </span>
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Aggiorna ora"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const n = await syncCalendars(userId, report, true);
                      await refresh();
                      return `${n} eventi aggiornati.`;
                    })
                  }
                >
                  <RefreshCw />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Scollega il calendario"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await removeCalendar(f.id);
                      await refresh();
                      return "Calendario scollegato (gli eventi già importati restano).";
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3 border-t border-border pt-4">
        <h3 className="text-sm">Oppure importa un file .ics una volta sola</h3>
        <FilePicker
          accept=".ics,text/calendar"
          label="Scegli il file .ics"
          disabled={busy}
          onFile={async (f) => {
            const parsed = parseIcs(await f.text());
            if (!parsed.length) toast.error("Non ho trovato eventi nel file.");
            else setEvents(parsed);
          }}
        />
        {events && (
          <Button
            className="w-full"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await importEvents(userId, events, report);
                setEvents(null);
                return `${r.saved} eventi salvati${r.unchanged ? `, ${r.unchanged} già presenti` : ""}${r.skipped ? `, ${r.skipped} esclusi (limite 1500)` : ""}.`;
              })
            }
          >
            Importa {events.length} eventi
          </Button>
        )}
        <p className={hint}>Gli eventi ricorrenti compaiono una sola volta, alla prima data.</p>
      </section>
    </>
  );
}
