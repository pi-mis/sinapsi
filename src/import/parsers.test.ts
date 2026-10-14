import { describe, it, expect } from "vitest";
import { parseWhatsApp, toSessions, transcript, chatNameFromFile, isoDay } from "./whatsapp";
import { parseVCards, parseLinkedInCsv, normalizeName } from "./contacts";
import { parseIcs, eventContent } from "./ics";
import { stableId } from "./ids";

describe("WhatsApp", () => {
  it("parses iOS exports with multi-line messages and skips system lines", () => {
    const text = [
      "[14/10/26, 10:23:45] Luca: \u200eI messaggi e le chiamate sono crittografati end-to-end.",
      "[14/10/26, 10:24:01] Luca: Ciao! Ci vediamo a Dubrovnik?",
      "Partiamo il 24",
      "[14/10/26, 10:25:12] Pietro: Sì, prendo il volo",
      "[14/10/26, 10:26:00] Pietro: \u200eimmagine omessa",
    ].join("\n");
    const chat = parseWhatsApp(text);
    expect(chat.messages).toHaveLength(3);
    expect(chat.messages[0]!.text).toBe("Ciao! Ci vediamo a Dubrovnik?\nPartiamo il 24");
    expect(chat.messages[0]!.at.getMonth()).toBe(9);
    expect(chat.messages[2]!.text).toBe("[media]");
    expect(chat.participants.map((p) => p.name).sort()).toEqual(["Luca", "Pietro"]);
  });
  it("parses Android exports, AM/PM and US dates", () => {
    const chat = parseWhatsApp(
      "14/10/26, 22:05 - Mamma: Buonanotte\n10/14/26, 9:05 PM - Pietro: Notte!\nLuca ha aggiunto Marco",
    );
    expect(chat.messages).toHaveLength(2);
    expect(chat.messages[0]!.at.getHours()).toBe(22);
    expect(chat.messages[1]!.at.getDate()).toBe(14);
    expect(chat.messages[1]!.at.getHours()).toBe(21);
  });
  it("splits conversations on long pauses and merges when there are too many", () => {
    const at = (d: number, h: number) => new Date(2026, 9, d, h);
    const msgs = [at(1, 10), at(1, 11), at(2, 20), at(5, 9), at(5, 9), at(9, 9)].map((d) => ({
      at: d,
      sender: "a",
      text: "x",
    }));
    expect(toSessions(msgs).map((s) => s.messages.length)).toEqual([2, 1, 2, 1]);
    const merged = toSessions(msgs, 8, 2);
    expect(merged).toHaveLength(2);
    expect(merged.reduce((n, s) => n + s.messages.length, 0)).toBe(6);
    expect(isoDay(merged[0]!.start)).toBe("2026-10-01");
  });
  it("trims long transcripts keeping both ends", () => {
    const msgs = Array.from({ length: 400 }, (_, i) => ({
      at: new Date(2026, 0, 1, 10, i % 60),
      sender: "a",
      text: `messaggio ${i}`,
    }));
    const t = transcript(toSessions(msgs, 48)[0]!, 2000);
    expect(t.length).toBeLessThan(2100);
    expect(t).toContain("messaggio 0");
    expect(t).toContain("messaggio 399");
  });
  it("reads the chat name from the file name", () => {
    expect(chatNameFromFile("Chat WhatsApp con Luca Rossi.txt")).toBe("Luca Rossi");
    expect(chatNameFromFile("WhatsApp Chat - Viaggio Balcani.zip")).toBe("Viaggio Balcani");
    expect(chatNameFromFile("_chat.txt")).toBeNull();
  });
});

describe("contacts", () => {
  it("parses vCards with folded lines and escapes", () => {
    const vcf =
      "BEGIN:VCARD\nVERSION:3.0\nFN:Giulia Bianchi\nORG:BDO Italia;Audit\nTITLE:Manager\nitem1.EMAIL;type=INTERNET:giulia@example.com\nNOTE:riga uno\\n riga\n  due\nEND:VCARD\nBEGIN:VCARD\nN:Rossi;Marco;;;\nEND:VCARD";
    const c = parseVCards(vcf);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({
      full_name: "Giulia Bianchi",
      company: "BDO Italia",
      position: "Manager",
      email: "giulia@example.com",
    });
    expect(c[1]!.full_name).toBe("Marco Rossi");
  });
  it("parses LinkedIn Connections.csv after its notes preamble", () => {
    const csv =
      'Notes:\n"When exporting your connection data, you may notice..."\n\nFirst Name,Last Name,URL,Email Address,Company,Position,Connected On\nAnna,Verdi,https://www.linkedin.com/in/anna,,"Acme, Inc.",Analyst,14 Oct 2026\n';
    const c = parseLinkedInCsv(csv);
    expect(c).toEqual([
      {
        full_name: "Anna Verdi",
        email: null,
        company: "Acme, Inc.",
        position: "Analyst",
        url: "https://www.linkedin.com/in/anna",
        connected_on: "2026-10-14",
      },
    ]);
  });
  it("normalises names for matching", () => {
    expect(normalizeName("  Niccolò  D'Amico ")).toBe("niccolo d amico");
  });
});

describe("calendar", () => {
  it("parses events, all-day dates, folded lines and skips cancelled ones", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:abc@google.com",
      "DTSTART:20261024T080000Z",
      "SUMMARY:Volo per Dubrovnik",
      "DESCRIPTION:Porta il passaporto\\, e la crema",
      " solare",
      "LOCATION:Arlanda",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:all-day",
      "DTSTART;VALUE=DATE:20261102",
      "SUMMARY:Rientro",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:gone",
      "DTSTART:20261103T100000",
      "STATUS:CANCELLED",
      "SUMMARY:Annullato",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const events = parseIcs(ics);
    expect(events.map((e) => e.summary)).toEqual(["Volo per Dubrovnik", "Rientro"]);
    expect(events[0]!.start.toISOString()).toBe("2026-10-24T08:00:00.000Z");
    expect(events[0]!.description).toBe("Porta il passaporto, e la cremasolare");
    expect(events[1]!.allDay).toBe(true);
    expect(eventContent(events[1]!)).toBe("Quando: 2 novembre 2026");
    expect(eventContent(events[0]!)).toContain("Dove: Arlanda");
  });
});

describe("stable ids", () => {
  it("are deterministic, user-scoped and UUID-shaped", async () => {
    const a = await stableId("u1", "event:x");
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await stableId("u1", "event:x")).toBe(a);
    expect(await stableId("u2", "event:x")).not.toBe(a);
  });
});
