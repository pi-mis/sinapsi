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
  Github,
  KeyRound,
} from "lucide-react";
import {
  addGitHub,
  listGitHub,
  removeGitHub,
  syncGitHub,
  type GitHubAccount,
} from "@/connectors/run";
import { Button } from "./ui/button";
import { Rich } from "./Rich";
import { locale, t as tNow, tr, useLang, useT } from "@/i18n";
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

type Tab = "whatsapp" | "contacts" | "calendar" | "github";
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
  const t = useT();
  const report: Progress = (message, done, total) =>
    setStatus({ message, ...(done != null ? { done } : {}), ...(total != null ? { total } : {}) });
  const run = async (job: () => Promise<string>) => {
    setStatus({ message: t("Un momento…") });
    try {
      const message = await job();
      toast.success(message);
      onImported();
    } catch (e) {
      toast.error(tr((e as Error).message));
    } finally {
      setStatus(null);
    }
  };
  const busy = status !== null;
  const tabs = [
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { id: "contacts", label: t("Contatti"), icon: Users },
    { id: "calendar", label: t("Calendario"), icon: CalendarDays },
    { id: "github", label: "GitHub", icon: Github },
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
            {t("Riempi il cervello")}
          </h2>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("Chiudi")}
            disabled={busy}
            onClick={onClose}
          >
            <X />
          </Button>
        </header>
        <nav
          className="flex gap-1 overflow-x-auto border-b border-border p-2 [scrollbar-width:none]"
          aria-label={t("Fonte")}
        >
          {tabs.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={tab === item.id ? "secondary" : "ghost"}
              aria-pressed={tab === item.id}
              disabled={busy}
              onClick={() => setTab(item.id)}
            >
              <item.icon />
              {item.label}
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
          {tab === "github" && <GitHubTab userId={userId} busy={busy} run={run} report={report} />}
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
    if (!first) throw new Error(tNow("Lo zip non contiene la chat (.txt)."));
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
  const t = useT();
  const lang = useLang();
  const sessions = chat ? toSessions(chat.messages).length : 0;
  const load = async (file: File) => {
    try {
      const { text, name } = await readChatFile(file);
      const parsed = parseWhatsApp(text);
      if (!parsed.messages.length)
        throw new Error(t("Non ho trovato messaggi: è un'esportazione di WhatsApp?"));
      const others = parsed.participants.map((p) => p.name);
      setChat({ name: name ?? others.slice(0, 3).join(", "), auto: !name, ...parsed });
      setMe("");
    } catch (e) {
      toast.error(tr((e as Error).message));
    }
  };
  return (
    <>
      <p className={hint}>
        <Rich
          text={t(
            "In WhatsApp apri la chat → nome in alto → **Esporta chat** → **Senza media**, e carica qui il file (.zip o .txt). Ogni conversazione diventa un neurone con la sua trascrizione, collegato alla persona o al gruppo.",
          )}
        />
      </p>
      <FilePicker
        accept=".txt,.zip,text/plain,application/zip"
        label={chat ? t("Scegli un'altra chat") : t("Scegli la chat esportata")}
        disabled={busy}
        onFile={load}
      />
      {chat && (
        <div className="space-y-4 rounded-md border border-border p-4">
          <p className="text-sm">
            {t("{n} messaggi dal {from} al {to}", {
              n: chat.messages.length,
              from: chat.messages[0]!.at.toLocaleDateString(locale(lang)),
              to: chat.messages[chat.messages.length - 1]!.at.toLocaleDateString(locale(lang)),
            })}{" "}
            → <b>{t("{n} conversazioni", { n: sessions })}</b>
          </p>
          <label className="block space-y-1 text-xs text-muted-foreground">
            <span>{t("Nome della chat")}</span>
            <input
              className={field}
              value={chat.name}
              onChange={(e) => setChat({ ...chat, name: e.target.value, auto: false })}
            />
          </label>
          <label className="block space-y-1 text-xs text-muted-foreground">
            <span>{t("Tu chi sei nella chat?")}</span>
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
              <option value="">{t("Scegli…")}</option>
              {chat.participants.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} ({t("{n} messaggi", { n: p.count })})
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
              {t("Riassumi ogni conversazione con l'AI")}
              <span className={`block ${hint}`}>
                {useAI
                  ? t(
                      "I messaggi di ogni conversazione vengono inviati a Groq per il riassunto (circa {n} delle tue richieste AI di oggi). Contengono anche i messaggi degli altri: importa solo chat che ti senti di condividere così.",
                      { n: sessions },
                    )
                  : t(
                      "Nessun messaggio lascia il dispositivo: le conversazioni diventano note private con la trascrizione.",
                    )}
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
                return (
                  t("{n} conversazioni importate", { n: r.created }) +
                  (r.skipped ? t(", {n} già presenti", { n: r.skipped }) : "") +
                  (r.aiFailures ? t(" ({n} senza riassunto AI)", { n: r.aiFailures }) : "") +
                  "."
                );
              })
            }
          >
            {t("Importa {n} conversazioni", { n: sessions })}
          </Button>
        </div>
      )}
    </>
  );
}

function ContactsTab({ userId, busy, run, report }: TabProps) {
  const [contacts, setContacts] = useState<ContactInput[] | null>(null);
  const t = useT();
  const load = async (file: File) => {
    const text = await file.text();
    const parsed = /\.csv$/i.test(file.name) ? parseLinkedInCsv(text) : parseVCards(text);
    if (!parsed.length) toast.error(t("Non ho trovato contatti nel file."));
    else setContacts(parsed);
  };
  return (
    <>
      <p className={hint}>
        <Rich
          text={t(
            "Carica la rubrica come **vCard (.vcf)** — iPhone: app Contatti → Elenchi → tieni premuto → Esporta; Google Contatti: Esporta → vCard — oppure il file **Connections.csv** di LinkedIn (Impostazioni → Privacy dei dati → Ottieni una copia dei tuoi dati → Collegamenti).",
          )}
        />
      </p>
      <p className={hint}>
        {t(
          "Le persone citate per nome e cognome nelle tue note diventano neuroni privati collegati a quelle note. I contatti non vengono mai inviati all'AI.",
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <FilePicker
          accept=".vcf,.csv,text/vcard,text/csv"
          label={t("Scegli il file dei contatti")}
          disabled={busy}
          onFile={load}
        />
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            run(async () =>
              t("{n} persone collegate alle note.", { n: await linkPeople(userId, report) }),
            )
          }
        >
          <Link2 />
          {t("Ricollega le persone")}
        </Button>
      </div>
      {contacts && (
        <div className="space-y-3 rounded-md border border-border p-4">
          <p className="text-sm">
            {t("{n} contatti trovati, ad esempio {names}.", {
              n: contacts.length,
              names: contacts
                .slice(0, 3)
                .map((c) => c.full_name)
                .join(", "),
            })}
          </p>
          <Button
            className="w-full"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await importContacts(userId, contacts, report);
                setContacts(null);
                return (
                  t("{n} contatti aggiunti", { n: r.added }) +
                  (r.duplicates ? t(" ({n} già presenti)", { n: r.duplicates }) : "") +
                  "; " +
                  t("{n} persone collegate alle note.", { n: r.linked })
                );
              })
            }
          >
            {t("Importa {n} contatti", { n: contacts.length })}
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
  const t = useT();
  const lang = useLang();
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
        <h3 className="text-sm">{t("Collega un calendario che si aggiorna da solo")}</h3>
        <p className={hint}>
          <Rich
            text={t(
              "Google Calendar (dal computer): Impostazioni → il tuo calendario → **Indirizzo segreto in formato iCal**. Funziona anche con i calendari iCloud pubblici. Sinapsi lo controlla ogni 6 ore quando apri l'app, dai 2 mesi passati ai 12 futuri.",
            )}
          />
        </p>
        <p className={hint}>
          {t(
            "È un link privato: chi lo possiede vede i tuoi eventi. Qui resta salvato solo nel tuo account.",
          )}
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
              return t("Calendario collegato: {n} eventi salvati.", { n: r.saved });
            });
          }}
        >
          <input
            type="url"
            inputMode="url"
            placeholder="https://calendar.google.com/…/basic.ics"
            aria-label={t("Link iCal")}
            className={`${field} min-w-0 flex-1`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button type="submit" disabled={busy || !url.trim()}>
            {t("Collega")}
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
                      ? t("Aggiornato {date}", {
                          date: new Date(f.lastSync).toLocaleString(locale(lang)),
                        })
                      : t("Mai aggiornato")}
                  </span>
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t("Aggiorna ora")}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const n = await syncCalendars(userId, report, true);
                      await refresh();
                      return t("{n} eventi aggiornati.", { n });
                    })
                  }
                >
                  <RefreshCw />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t("Scollega il calendario")}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await removeCalendar(f.id);
                      await refresh();
                      return t("Calendario scollegato (gli eventi già importati restano).");
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
        <h3 className="text-sm">{t("Oppure importa un file .ics una volta sola")}</h3>
        <FilePicker
          accept=".ics,text/calendar"
          label={t("Scegli il file .ics")}
          disabled={busy}
          onFile={async (f) => {
            const parsed = parseIcs(await f.text());
            if (!parsed.length) toast.error(t("Non ho trovato eventi nel file."));
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
                return (
                  t("{n} eventi salvati", { n: r.saved }) +
                  (r.unchanged ? t(", {n} già presenti", { n: r.unchanged }) : "") +
                  (r.skipped ? t(", {n} esclusi (limite 1500)", { n: r.skipped }) : "") +
                  "."
                );
              })
            }
          >
            {t("Importa {n} eventi", { n: events.length })}
          </Button>
        )}
        <p className={hint}>
          {t("Gli eventi ricorrenti compaiono una sola volta, alla prima data.")}
        </p>
      </section>
    </>
  );
}

function GitHubTab({ userId, busy, run, report }: TabProps) {
  const [accounts, setAccounts] = useState<GitHubAccount[]>([]);
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [withToken, setWithToken] = useState(false);
  const t = useT();
  const lang = useLang();
  const refresh = () =>
    listGitHub()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  useEffect(() => {
    void refresh();
  }, []);
  const summary = (r: { updated: number; total: number; limited: boolean }) =>
    t("{n} progetti aggiornati su {total}", { n: r.updated, total: r.total }) +
    (r.limited ? t(" (limite di GitHub raggiunto: il resto al prossimo aggiornamento)") : "") +
    ".";
  return (
    <>
      <p className={hint}>
        <Rich
          text={t(
            "Ogni repository diventa un neurone **progetto** con descrizione, README e ultimi commit, collegato alle note che lo citano per nome. Si aggiorna da solo ogni 6 ore quando apri Sinapsi: vengono riletti solo i repository modificati.",
          )}
        />
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!username.trim() && !token.trim()) return;
          void run(async () => {
            const r = await addGitHub(userId, username, withToken ? token : null, report);
            setUsername("");
            setToken("");
            await refresh();
            return t("GitHub collegato: {summary}", { summary: summary(r) });
          });
        }}
      >
        <input
          aria-label={t("Utente GitHub")}
          placeholder={t("Il tuo utente GitHub (es. pi-mis)")}
          autoCapitalize="none"
          autoCorrect="off"
          className={field}
          value={username}
          disabled={withToken}
          onChange={(e) => setUsername(e.target.value)}
        />
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={withToken}
            onChange={(e) => setWithToken(e.target.checked)}
          />
          <span>
            {t("Includi i repository privati")}
            <span className={`block ${hint}`}>
              <Rich
                text={t(
                  "Serve un token in sola lettura: GitHub → Settings → Developer settings → Fine-grained tokens, accesso ai tuoi repository con permessi **Contents: read** e **Metadata: read**. I repository privati diventano note private, mai inviate all’AI. Il token resta salvato nel tuo account e non finisce nelle esportazioni.",
                )}
              />
            </span>
          </span>
        </label>
        {withToken && (
          <input
            type="password"
            aria-label={t("Token GitHub")}
            placeholder="github_pat_…"
            autoComplete="off"
            className={field}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={busy || (withToken ? !token.trim() : !username.trim())}
        >
          {withToken ? <KeyRound /> : <Github />}
          {t("Collega GitHub")}
        </Button>
      </form>
      {accounts.length > 0 && (
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <Github className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  {a.login}
                  {a.hasToken ? t(" · anche privati") : ""}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("{n} progetti", { n: a.repos })} ·{" "}
                  {a.lastSync
                    ? t("aggiornato {date}", {
                        date: new Date(a.lastSync).toLocaleString(locale(lang)),
                      })
                    : t("mai aggiornato")}
                </span>
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("Aggiorna ora")}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await syncGitHub(userId, a.id, report, true);
                    await refresh();
                    return summary(r);
                  })
                }
              >
                <RefreshCw />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("Scollega GitHub")}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await removeGitHub(a.id);
                    await refresh();
                    return t("GitHub scollegato (i progetti già importati restano).");
                  })
                }
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
