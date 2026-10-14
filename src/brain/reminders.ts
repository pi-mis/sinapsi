/**
 * Reminders live in the existing `jobs` table (no migration):
 *   kind = 'reminder', status 'open' | 'done' | 'dismissed'
 *   note_id → the note it comes from (cascade delete), run_after → when it is due
 *   payload  ReminderPayload
 * Weekly digests are `jobs` rows with kind = 'digest'. Pure helpers live here so
 * they can be tested and shared with the server feed.
 */

export type ReminderSource = "nota" | "whatsapp" | "manuale";
export type ReminderPayload = {
  text: string;
  /** YYYY-MM-DD, or null when the date is unknown. */
  due: string | null;
  /** HH:MM local time, optional. */
  time?: string | null;
  source: ReminderSource;
  /** Web search query to find a missing deadline. */
  query?: string | null;
  lookup?: "pending" | "done" | "failed";
  /** Page where the deadline was found. */
  url?: string | null;
  /** Short note from the lookup (e.g. "chiude il 15 novembre alle 12"). */
  detail?: string | null;
};
export type Reminder = {
  id: string;
  note_id: string | null;
  status: string;
  payload: ReminderPayload;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

export function validDate(value: unknown): string | null {
  if (typeof value !== "string" || !DATE.test(value)) return null;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : value;
}

export function validTime(value: unknown): string | null {
  return typeof value === "string" &&
    TIME.test(value) &&
    +value.slice(0, 2) < 24 &&
    +value.slice(3) < 60
    ? value
    : null;
}

/** When the reminder fires: the given time, otherwise 09:00 that day (UTC ISO string for timestamptz). */
export function runAfter(due: string | null, time?: string | null): string {
  if (!due) return "2999-12-31T00:00:00Z";
  const [h, m] = (time ?? "09:00").split(":").map(Number);
  const [y, mo, d] = due.split("-").map(Number);
  return new Date(y!, mo! - 1, d!, h, m).toISOString();
}

/** Comparable text, so a re-scan does not duplicate a reminder the user already has. */
export function reminderKey(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 80);
}

export type ReminderGroup = "scaduti" | "oggi" | "settimana" | "poi" | "senza data";

export function groupOf(r: ReminderPayload, today: string): ReminderGroup {
  if (!r.due) return "senza data";
  if (r.due < today) return "scaduti";
  if (r.due === today) return "oggi";
  const week = new Date(`${today}T12:00:00Z`);
  week.setUTCDate(week.getUTCDate() + 7);
  return r.due <= week.toISOString().slice(0, 10) ? "settimana" : "poi";
}

export function localToday(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Monday of the ISO week, used to generate one digest per week. */
export function weekKey(today: string): string {
  const d = new Date(`${today}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/** Cheap filter before spending an AI call: does the text talk about plans, deadlines or dates? */
const INTENT_CUES =
  /\b(voglio|vorrei|devo|dovrei|dobbiamo|bisogna|ricorda|ricordami|iscriv\w*|candidat\w*|applica\w*|application|deadline|scadenz\w*|entro|prenot\w*|appuntament\w*|esame|consegn\w*|pagare|rinnov\w*|chiamare|scrivere a|comprare|organizzare|domani|dopodomani|settimana prossima|mese prossimo|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|todo|to do)\b|\b\d{1,2}[/.]\d{1,2}([/.]\d{2,4})?\b/i;

export function mayContainIntents(text: string): boolean {
  return INTENT_CUES.test(text);
}

function icsEscape(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/([,;])/g, "\\$1");
}

/** Folds long lines at 74 octets as RFC 5545 requires (approximated by characters). */
function fold(line: string) {
  const out: string[] = [];
  for (let i = 0; i < line.length; i += 73) out.push((i ? " " : "") + line.slice(i, i + 73));
  return out.join("\r\n");
}

/** A calendar the user's phone can subscribe to: one event per dated, open reminder, with an alarm. */
export function remindersToIcs(reminders: Reminder[], appUrl: string, now = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sinapsi//Promemoria//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Sinapsi · Promemoria",
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const r of reminders) {
    const p = r.payload;
    if (r.status !== "open" || !p.due) continue;
    const day = p.due.replace(/-/g, "");
    const time = validTime(p.time);
    lines.push("BEGIN:VEVENT", `UID:${r.id}@sinapsi`, `DTSTAMP:${stamp}`);
    if (time) {
      lines.push(`DTSTART:${day}T${time.replace(":", "")}00`, "DURATION:PT30M");
    } else {
      const next = new Date(`${p.due}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      lines.push(
        `DTSTART;VALUE=DATE:${day}`,
        `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`,
      );
    }
    lines.push(fold(`SUMMARY:${icsEscape(p.text)}`));
    const description = [p.detail, p.url, `Apri in Sinapsi: ${appUrl}`].filter(Boolean).join("\n");
    lines.push(fold(`DESCRIPTION:${icsEscape(description)}`));
    if (p.url) lines.push(fold(`URL:${p.url}`));
    // All-day: 09:00 that morning; timed: 30 minutes before.
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${icsEscape(p.text)}`),
      `TRIGGER:${time ? "-PT30M" : "PT9H"}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
