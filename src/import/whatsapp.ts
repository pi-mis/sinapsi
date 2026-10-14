/**
 * Parser for WhatsApp "Export chat" files (iOS and Android, Italian and other
 * locales). Everything runs on the device; only the per-conversation text is
 * later sent to the AI for a summary, and only if the user chooses so.
 */

export type ChatMessage = { at: Date; sender: string; text: string };
export type ChatSession = { start: Date; end: Date; messages: ChatMessage[] };
export type ParsedChat = {
  messages: ChatMessage[];
  participants: { name: string; count: number }[];
};

// [14/10/26, 10:23:45] Nome: testo   (iOS)
// 14/10/26, 10:23 - Nome: testo      (Android)
const LINE =
  /^\u200e?\[?(\d{1,4})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?\]?\s*(?:[-–]\s*)?(.*)$/;
const SYSTEM =
  /crittografat|end-to-end|are encrypted|codice di sicurezza|security code|questo messaggio è stato eliminato|hai eliminato questo messaggio|this message was deleted|you deleted this message/i;
const MEDIA =
  /^\u200e?(<.*(omess|omitted|allegato|attached).*>|.*(immagine|video|audio|sticker|GIF|documento) omess[oa]|.*(image|video|audio|sticker|GIF|document) omitted)/i;

function toDate(
  a: number,
  b: number,
  y: number,
  h: number,
  m: number,
  s: number,
  ampm: string | undefined,
): Date | null {
  let day = a,
    month = b,
    year = y;
  if (a > 999) {
    // yyyy-mm-dd
    year = a;
    month = b;
    day = y;
  } else if (b > 12 && a <= 12) {
    // US month/day
    month = a;
    day = b;
  }
  if (year < 100) year += 2000;
  let hour = h;
  if (ampm) {
    const pm = /p/i.test(ampm);
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  const d = new Date(year, month - 1, day, hour, m, s);
  return Number.isNaN(d.getTime()) || month > 12 || day > 31 ? null : d;
}

export function parseWhatsApp(text: string): ParsedChat {
  const messages: ChatMessage[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/[\u202a-\u202f\u200f]/g, "");
    const match = LINE.exec(line);
    const date = match
      ? toDate(
          +match[1]!,
          +match[2]!,
          +match[3]!,
          +match[4]!,
          +match[5]!,
          +(match[6] ?? 0),
          match[7],
        )
      : null;
    if (match && date) {
      const rest = match[8] ?? "";
      const colon = rest.indexOf(": ");
      if (colon <= 0 || colon > 60) continue; // system line without a sender
      const sender = rest.slice(0, colon).trim();
      let body = rest.slice(colon + 2).trim();
      if (SYSTEM.test(body) && body.length < 140) continue;
      if (MEDIA.test(body)) body = "[media]";
      messages.push({ at: date, sender, text: body });
    } else if (messages.length && line.trim()) {
      messages[messages.length - 1]!.text += `\n${line}`;
    }
  }
  const counts = new Map<string, number>();
  for (const m of messages) counts.set(m.sender, (counts.get(m.sender) ?? 0) + 1);
  const participants = [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  return { messages, participants };
}

/**
 * Splits a chat into conversations: a pause longer than `gapHours` starts a new
 * one. If there are more than `max`, the smallest neighbours are merged.
 */
export function toSessions(messages: ChatMessage[], gapHours = 8, max = 40): ChatSession[] {
  const sessions: ChatSession[] = [];
  for (const m of messages) {
    const last = sessions[sessions.length - 1];
    if (last && m.at.getTime() - last.end.getTime() <= gapHours * 3600_000) {
      last.messages.push(m);
      last.end = m.at;
    } else sessions.push({ start: m.at, end: m.at, messages: [m] });
  }
  while (sessions.length > max) {
    let best = 0;
    let bestSize = Infinity;
    for (let i = 0; i < sessions.length - 1; i++) {
      const size = sessions[i]!.messages.length + sessions[i + 1]!.messages.length;
      if (size < bestSize) {
        bestSize = size;
        best = i;
      }
    }
    const a = sessions[best]!,
      b = sessions[best + 1]!;
    sessions.splice(best, 2, {
      start: a.start,
      end: b.end,
      messages: [...a.messages, ...b.messages],
    });
  }
  return sessions;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A readable transcript, trimmed to `limit` characters keeping beginning and end. */
export function transcript(session: ChatSession, limit = 10000): string {
  const lines = session.messages.map(
    (m) =>
      `${isoDay(m.at)} ${pad(m.at.getHours())}:${pad(m.at.getMinutes())} ${m.sender}: ${m.text}`,
  );
  const full = lines.join("\n");
  if (full.length <= limit) return full;
  const half = Math.floor(limit / 2);
  return `${full.slice(0, half)}\n[…]\n${full.slice(-half)}`;
}

/** Chat name from the exported file name ("Chat WhatsApp con Luca.txt", "WhatsApp Chat - Luca.zip"). */
export function chatNameFromFile(name: string): string | null {
  const base = name.replace(/\.(txt|zip)$/i, "");
  const m = /(?:chat whatsapp con|whatsapp chat (?:with|-)|whatsapp chat)\s*[-–]?\s*(.+)$/i.exec(
    base,
  );
  return m?.[1]?.trim() || null;
}
