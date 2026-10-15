import { getLang, t } from "@/i18n";
/** Events from an iCalendar file or feed (Google Calendar, iCloud, Outlook). */

export type CalendarEvent = {
  uid: string;
  summary: string;
  description: string;
  location: string;
  start: Date;
  allDay: boolean;
};

function unescapeIcs(value: string) {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\([,;\\])/g, "$1")
    .trim();
}

function parseIcsDate(value: string, params: string): { date: Date; allDay: boolean } | null {
  const v = value.trim();
  if (/VALUE=DATE(?!-)/i.test(params) || /^\d{8}$/.test(v)) {
    const m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
    return m ? { date: new Date(+m[1]!, +m[2]! - 1, +m[3]!), allDay: true } : null;
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!m) return null;
  const parts = [+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +(m[6] ?? 0)] as const;
  // UTC when marked Z; otherwise the event's own zone, approximated as the device's.
  const date = m[7] ? new Date(Date.UTC(...parts)) : new Date(...parts);
  return Number.isNaN(date.getTime()) ? null : { date, allDay: false };
}

export function parseIcs(text: string): CalendarEvent[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
  const events: CalendarEvent[] = [];
  let current: Map<string, { value: string; params: string }> | null = null;
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) current = new Map();
    else if (/^END:VEVENT/i.test(line) && current) {
      const start = current.get("DTSTART");
      const parsed = start ? parseIcsDate(start.value, start.params) : null;
      const status = current.get("STATUS")?.value.toUpperCase();
      if (parsed && status !== "CANCELLED") {
        events.push({
          uid:
            current.get("UID")?.value || `${current.get("SUMMARY")?.value ?? ""}@${start!.value}`,
          summary: unescapeIcs(current.get("SUMMARY")?.value ?? "") || "Evento",
          description: unescapeIcs(current.get("DESCRIPTION")?.value ?? ""),
          location: unescapeIcs(current.get("LOCATION")?.value ?? ""),
          start: parsed.date,
          allDay: parsed.allDay,
        });
      }
      current = null;
    } else if (current) {
      const idx = line.indexOf(":");
      if (idx <= 0) continue;
      const [name = "", ...params] = line.slice(0, idx).split(";");
      const key = name.toUpperCase();
      if (!current.has(key))
        current.set(key, { value: line.slice(idx + 1), params: params.join(";") });
    }
  }
  return events;
}

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

/** The note text for an event. */
export function eventContent(e: CalendarEvent): string {
  const day =
    getLang() === "en"
      ? e.start.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : `${e.start.getDate()} ${MONTHS[e.start.getMonth()]} ${e.start.getFullYear()}`;
  const when = `${day}${
    e.allDay
      ? ""
      : `, ${String(e.start.getHours()).padStart(2, "0")}:${String(e.start.getMinutes()).padStart(2, "0")}`
  }`;
  return [
    t("Quando: {when}", { when }),
    e.location && t("Dove: {place}", { place: e.location }),
    e.description && `\n${e.description.slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n");
}
