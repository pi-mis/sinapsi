import { getLang, t } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { summarizeForNote } from "@/attachments/kinds";
import type { Json } from "@/integrations/supabase/types";
import { localToday, runAfter } from "@/brain/reminders";
import { canonicalPair } from "@/ai/vector";
import { stableId } from "./ids";
import { isoDay, toSessions, transcript, type ChatMessage } from "./whatsapp";
import { normalizeName, type ContactInput } from "./contacts";
import { eventContent, parseIcs, type CalendarEvent } from "./ics";
import { fetchCalendar, summarizeConversation } from "./import.functions";

/**
 * Client-side import runners. They write through the user's own Supabase session
 * (RLS), give imported items deterministic ids (no duplicates on re-import) and
 * leave new notes `pending`, so the semantic pipeline links them afterwards.
 */

export type Progress = (message: string, done?: number, total?: number) => void;
type Edge = { a: string; b: string; score: number; kind: string };

const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];
const humanDay = (d: Date) =>
  getLang() === "en"
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

async function existingIds(ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase
      .from("notes")
      .select("id")
      .in("id", ids.slice(i, i + 150));
    if (error) throw new Error(t("Impossibile leggere le note esistenti."));
    data.forEach((r) => found.add(r.id));
  }
  return found;
}

async function addEdges(edges: Edge[]) {
  const seen = new Set<string>();
  const rows = edges.flatMap((e) => {
    if (e.a === e.b) return [];
    const [a, b] = canonicalPair(e.a, e.b);
    const key = `${a}|${b}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ a, b, score: e.score, kind: e.kind }];
  });
  for (let i = 0; i < rows.length; i += 500) {
    // Existing synapses (e.g. semantic ones) are kept as they are.
    const { error } = await supabase
      .from("edges")
      .upsert(rows.slice(i, i + 500), { onConflict: "a,b", ignoreDuplicates: true });
    if (error) throw new Error(t("Impossibile salvare i collegamenti."));
  }
}

/** A person (or group) neuron, private by default: it holds other people's details. */
async function ensurePerson(
  userId: string,
  name: string,
  details: string,
  type = "persona",
): Promise<string> {
  const id = await stableId(userId, `person:${normalizeName(name)}`);
  const { data } = await supabase.from("notes").select("id").eq("id", id).maybeSingle();
  if (!data) {
    const { error } = await supabase.from("notes").insert({
      id,
      title: name,
      content: details || name,
      type,
      is_private: true,
      ai_status: "pending",
    });
    if (error) throw new Error(t("Impossibile creare la persona."));
  }
  return id;
}

// ---------- WhatsApp ----------

export async function importWhatsApp(options: {
  userId: string;
  chatName: string;
  me: string | null;
  messages: ChatMessage[];
  participants: string[];
  useAI: boolean;
  report: Progress;
}): Promise<{ created: number; skipped: number; aiFailures: number }> {
  const { userId, chatName, me, report } = options;
  let useAI = options.useAI;
  const sessions = toSessions(options.messages);
  const ids = await Promise.all(
    sessions.map((s) =>
      stableId(userId, `whatsapp:${normalizeName(chatName)}:${s.start.toISOString()}`),
    ),
  );
  const existing = await existingIds(ids);
  const others = options.participants.filter((p) => p !== me);
  const hub =
    others.length === 1
      ? await ensurePerson(
          userId,
          others[0]!,
          t("Persona dalla chat WhatsApp «{chat}».", { chat: chatName }),
        )
      : await ensurePerson(
          userId,
          chatName,
          t("Chat di gruppo WhatsApp con {names}.", { names: others.slice(0, 12).join(", ") }),
          "gruppo",
        );

  let created = 0;
  let aiFailures = 0;
  const today = localToday();
  const edges: Edge[] = [];
  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i]!;
    const id = ids[i]!;
    edges.push({ a: id, b: hub, score: 0.6, kind: "person" });
    if (i > 0) edges.push({ a: ids[i - 1]!, b: id, score: 0.5, kind: "thread" });
    if (existing.has(id)) continue;
    report(
      t("Conversazione {n} di {total}", { n: i + 1, total: sessions.length }),
      i,
      sessions.length,
    );
    const text = transcript(session, 10000);
    const header = t("Chat WhatsApp con {chat} · {day}", {
      chat: chatName,
      day: humanDay(session.start),
    });
    let title = `${chatName} · ${humanDay(session.start)}`;
    let content = `${header}\n\n${text.slice(0, 800)}${text.length > 800 ? "…" : ""}`;
    let commitments: { text: string; due: string | null }[] = [];
    if (useAI) {
      const result = await summarizeConversation({
        data: { chat: chatName, me, day: isoDay(session.start), transcript: text },
      });
      if (result.error) {
        aiFailures++;
        // A rate or daily limit would fail every remaining call: finish locally instead.
        if (/limit/i.test(result.error)) useAI = false;
      } else {
        title = result.title || title;
        commitments = result.commitments;
        content = [
          header,
          "",
          result.summary,
          ...(result.commitments.length
            ? [
                "",
                t("Impegni:"),
                ...result.commitments.map((c) => `- ${c.text}${c.due ? ` (${c.due})` : ""}`),
              ]
            : []),
        ].join("\n");
      }
    }
    const uri = `whatsapp://${encodeURIComponent(chatName)}/${session.start.toISOString()}`;
    const { error } = await supabase.from("notes").insert({
      id,
      title: title.slice(0, 120),
      content,
      type: "conversazione",
      event_date: isoDay(session.start),
      is_private: !options.useAI,
      ai_status: "pending",
      enriched: summarizeForNote([{ kind: "text", uri, extracted_text: text }]),
    });
    if (error) throw new Error(t("Impossibile salvare una conversazione."));
    await supabase.from("sources").insert({ kind: "text", uri, folder: id, extracted_text: text });
    // Commitments that are still ahead become reminders linked to the conversation.
    const upcoming = commitments.filter((c) => !c.due || c.due >= today);
    if (upcoming.length)
      await supabase.from("jobs").insert(
        upcoming.map((c) => ({
          kind: "reminder",
          status: "open",
          note_id: id,
          run_after: runAfter(c.due),
          payload: { text: c.text, due: c.due, source: "whatsapp" } as unknown as Json,
        })),
      );
    created++;
  }
  report(t("Collego le conversazioni…"));
  await addEdges(edges);
  return { created, skipped: sessions.length - created, aiFailures };
}

// ---------- Contacts and people ----------

export async function importContacts(userId: string, contacts: ContactInput[], report: Progress) {
  report(t("Leggo la rubrica esistente…"));
  const { data: current, error } = await supabase.from("contacts").select("full_name,email");
  if (error) throw new Error(t("Impossibile leggere i contatti."));
  const known = new Set(
    (current ?? []).flatMap(
      (c) => [normalizeName(c.full_name), c.email?.toLowerCase()].filter(Boolean) as string[],
    ),
  );
  const fresh = contacts.filter((c) => {
    const keys = [normalizeName(c.full_name), c.email?.toLowerCase()].filter(Boolean) as string[];
    if (keys.some((k) => known.has(k))) return false;
    keys.forEach((k) => known.add(k));
    return true;
  });
  for (let i = 0; i < fresh.length; i += 500) {
    report(t("Salvo i contatti…"), i, fresh.length);
    const { error: insertError } = await supabase.from("contacts").insert(fresh.slice(i, i + 500));
    if (insertError) throw new Error(t("Impossibile salvare i contatti."));
  }
  const linked = await linkPeople(userId, report);
  return { added: fresh.length, duplicates: contacts.length - fresh.length, linked };
}

/** All word n-grams (2–4 words) of a text, for fast full-name lookups. */
function ngrams(text: string): Set<string> {
  const words = normalizeName(text).split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i < words.length; i++)
    for (let n = 2; n <= 4 && i + n <= words.length; n++) out.add(words.slice(i, i + n).join(" "));
  return out;
}

/**
 * Finds contacts mentioned by full name in notes and turns them into person
 * neurons linked to those notes. Single first names are ignored (too ambiguous).
 */
export async function linkPeople(userId: string, report: Progress): Promise<number> {
  report(t("Cerco le persone nelle note…"));
  const { data: contacts } = await supabase
    .from("contacts")
    .select("full_name,company,position,email,url");
  const people = (contacts ?? [])
    .map((c) => ({ ...c, key: normalizeName(c.full_name) }))
    .filter((c) => c.key.split(" ").length >= 2 && c.key.split(" ").length <= 4);
  if (!people.length) return 0;
  const notes: { id: string; type: string; grams: Set<string> }[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from("notes")
      .select("id,type,title,content,enriched")
      .eq("is_demo", false)
      .order("id")
      .range(from, from + 499);
    if (error) throw new Error(t("Impossibile leggere le note."));
    for (const n of data)
      if (n.type !== "persona" && n.type !== "gruppo")
        notes.push({
          id: n.id,
          type: n.type,
          grams: ngrams(`${n.title} ${n.content} ${n.enriched ?? ""}`),
        });
    if (data.length < 500) break;
  }
  const edges: Edge[] = [];
  let linked = 0;
  for (const person of people) {
    const mentions = notes.filter((n) => n.grams.has(person.key));
    if (!mentions.length) continue;
    const details = [
      person.position && person.company
        ? `${person.position} · ${person.company}`
        : person.position || person.company,
      person.email,
      person.url,
    ]
      .filter(Boolean)
      .join("\n");
    const id = await ensurePerson(userId, person.full_name, details);
    mentions.forEach((m) => edges.push({ a: id, b: m.id, score: 0.6, kind: "person" }));
    linked++;
  }
  await addEdges(edges);
  return linked;
}

// ---------- Calendar ----------

const MAX_EVENTS = 1500;

/** Creates or updates event notes; unchanged events are left alone (no re-embedding). */
export async function importEvents(userId: string, events: CalendarEvent[], report: Progress) {
  const now = Date.now();
  const chosen = [...events]
    .sort((a, b) => Math.abs(a.start.getTime() - now) - Math.abs(b.start.getTime() - now))
    .slice(0, MAX_EVENTS);
  const rows = await Promise.all(
    chosen.map(async (e) => ({
      id: await stableId(userId, `event:${e.uid}:${e.start.toISOString()}`),
      title: e.summary.slice(0, 120),
      content: eventContent(e),
      type: "evento",
      event_date: isoDay(e.start),
    })),
  );
  const current = new Map<string, { title: string; content: string; event_date: string | null }>();
  for (let i = 0; i < rows.length; i += 150) {
    const { data } = await supabase
      .from("notes")
      .select("id,title,content,event_date")
      .in(
        "id",
        rows.slice(i, i + 150).map((r) => r.id),
      );
    data?.forEach((r) => current.set(r.id, r));
  }
  const changed = rows.filter((r) => {
    const c = current.get(r.id);
    return !c || c.title !== r.title || c.content !== r.content || c.event_date !== r.event_date;
  });
  for (let i = 0; i < changed.length; i += 200) {
    report(t("Salvo gli eventi…"), i, changed.length);
    const { error } = await supabase.from("notes").upsert(
      changed.slice(i, i + 200).map((r) => ({ ...r, ai_status: "pending" })),
      { onConflict: "id" },
    );
    if (error) throw new Error(t("Impossibile salvare gli eventi."));
  }
  return {
    saved: changed.length,
    unchanged: rows.length - changed.length,
    skipped: events.length - chosen.length,
  };
}

export type CalendarFeed = { id: string; url: string; lastSync: string | null; name: string };

export async function listCalendars(): Promise<CalendarFeed[]> {
  const { data } = await supabase
    .from("sources")
    .select("id,uri,extracted_text")
    .eq("kind", "calendar")
    .order("created_at");
  return (data ?? []).flatMap((r) => {
    if (!r.uri) return [];
    let meta: { lastSync?: string; name?: string } = {};
    try {
      meta = JSON.parse(r.extracted_text ?? "{}");
    } catch {
      meta = {};
    }
    return [
      {
        id: r.id,
        url: r.uri,
        lastSync: meta.lastSync ?? null,
        name: meta.name ?? new URL(r.uri.replace(/^webcals?:/i, "https:")).hostname,
      },
    ];
  });
}

const FEED_PAST_DAYS = 60;
const FEED_FUTURE_DAYS = 365;
const FEED_EVERY_HOURS = 6;

async function syncFeed(
  userId: string,
  feed: { id: string; url: string; name?: string },
  report: Progress,
) {
  report(t("Scarico il calendario…"));
  const { ics } = await fetchCalendar({ data: { url: feed.url } });
  const now = Date.now();
  const events = parseIcs(ics).filter((e) => {
    const t = e.start.getTime();
    return t > now - FEED_PAST_DAYS * 86400_000 && t < now + FEED_FUTURE_DAYS * 86400_000;
  });
  const name = /X-WR-CALNAME:(.+)/i.exec(ics)?.[1]?.trim() || feed.name || "Calendario";
  const result = await importEvents(userId, events, report);
  await supabase
    .from("sources")
    .update({ extracted_text: JSON.stringify({ lastSync: new Date().toISOString(), name }) })
    .eq("id", feed.id);
  return result;
}

/** Saves a calendar link (e.g. Google Calendar's secret iCal address) and syncs it once. */
export async function addCalendar(userId: string, url: string, report: Progress) {
  const { data, error } = await supabase
    .from("sources")
    .insert({ kind: "calendar", uri: url.trim(), extracted_text: "{}" })
    .select("id")
    .single();
  if (error) throw new Error(t("Impossibile salvare il calendario."));
  try {
    return await syncFeed(userId, { id: data.id, url: url.trim() }, report);
  } catch (e) {
    await supabase.from("sources").delete().eq("id", data.id);
    throw e;
  }
}

export async function removeCalendar(id: string) {
  const { error } = await supabase.from("sources").delete().eq("id", id).eq("kind", "calendar");
  if (error) throw new Error(t("Impossibile rimuovere il calendario."));
}

/** Syncs linked calendars that have not been synced for a while (or all, with `force`). Returns notes saved. */
export async function syncCalendars(
  userId: string,
  report: Progress,
  force = false,
): Promise<number> {
  let saved = 0;
  for (const feed of await listCalendars()) {
    const age = feed.lastSync ? Date.now() - new Date(feed.lastSync).getTime() : Infinity;
    if (!force && age < FEED_EVERY_HOURS * 3600_000) continue;
    try {
      saved += (await syncFeed(userId, feed, report)).saved;
    } catch {
      // A feed that is temporarily unreachable is retried at the next opening.
    }
  }
  return saved;
}
