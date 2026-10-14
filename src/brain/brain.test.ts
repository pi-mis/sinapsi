import { describe, it, expect } from "vitest";
import {
  groupOf,
  mayContainIntents,
  reminderKey,
  remindersToIcs,
  runAfter,
  validDate,
  validTime,
  weekKey,
  type Reminder,
} from "./reminders";
import {
  cleanReadme,
  prettyName,
  repoContent,
  repoKey,
  type GitHubRepo,
} from "@/connectors/github";

describe("reminders", () => {
  it("validates dates and times strictly", () => {
    expect(validDate("2026-11-02")).toBe("2026-11-02");
    expect(validDate("2026-02-30")).toBeNull();
    expect(validDate("2/11/2026")).toBeNull();
    expect(validTime("09:30")).toBe("09:30");
    expect(validTime("25:00")).toBeNull();
  });
  it("groups by due date relative to today", () => {
    const today = "2026-10-14";
    const g = (due: string | null) => groupOf({ text: "x", due, source: "manuale" }, today);
    expect(g("2026-10-13")).toBe("scaduti");
    expect(g("2026-10-14")).toBe("oggi");
    expect(g("2026-10-21")).toBe("settimana");
    expect(g("2026-10-22")).toBe("poi");
    expect(g(null)).toBe("senza data");
  });
  it("orders undated reminders last and computes ISO weeks from Monday", () => {
    expect(runAfter(null) > runAfter("2099-01-01")).toBe(true);
    expect(weekKey("2026-10-14")).toBe("2026-10-12");
    expect(weekKey("2026-10-18")).toBe("2026-10-12");
    expect(weekKey("2026-10-19")).toBe("2026-10-19");
  });
  it("matches reminders regardless of accents and punctuation", () => {
    expect(reminderKey("Iscriviti al corso di chitarra!")).toBe(
      reminderKey("iscriviti al  corso di CHITARRA"),
    );
    expect(reminderKey("Città")).toBe("citta");
  });
  it("spends AI calls only on texts that talk about plans or dates", () => {
    expect(
      mayContainIntents("Voglio iscrivermi al corso di chitarra dell'università musicale"),
    ).toBe(true);
    expect(mayContainIntents("Consegna entro il 30/11")).toBe(true);
    expect(mayContainIntents("Il wabi-sabi è la bellezza dell'imperfetto")).toBe(false);
  });
  it("builds a valid iCal feed with alarms, skipping undated and closed reminders", () => {
    const r = (
      id: string,
      due: string | null,
      status = "open",
      time: string | null = null,
    ): Reminder => ({
      id,
      note_id: null,
      status,
      payload: {
        text: `Promemoria, ${id}; con virgole`,
        due,
        time,
        source: "manuale",
        url: id === "a" ? "https://example.com" : null,
      },
    });
    const ics = remindersToIcs(
      [
        r("a", "2026-10-24"),
        r("b", "2026-10-25", "open", "18:30"),
        r("c", null),
        r("d", "2026-10-26", "done"),
      ],
      "https://app.example/",
      new Date("2026-10-14T10:00:00Z"),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261024");
    expect(ics).toContain("DTEND;VALUE=DATE:20261025");
    expect(ics).toContain("DTSTART:20261025T183000");
    expect(ics).toContain("TRIGGER:-PT30M");
    expect(ics).toContain(String.raw`SUMMARY:Promemoria\, a\; con virgole`);
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
});

describe("GitHub connector", () => {
  const repo: GitHubRepo = {
    id: 1,
    name: "cv-chatbot-portfolio",
    full_name: "pi-mis/cv-chatbot-portfolio",
    description: "Il mio CV come chatbot",
    html_url: "https://github.com/pi-mis/cv-chatbot-portfolio",
    homepage: null,
    language: "TypeScript",
    topics: ["portfolio", "ai"],
    stargazers_count: 0,
    fork: false,
    archived: false,
    private: false,
    pushed_at: "2026-09-28T07:00:31Z",
    created_at: "2026-09-01T00:00:00Z",
  };
  it("turns a repository into readable note text", () => {
    const text = repoContent(repo, [
      {
        sha: "1",
        commit: {
          message: "Aggiunge la chat\n\ndettagli",
          author: { date: "2026-09-28T07:00:00Z" },
        },
      },
    ]);
    expect(text).toContain("Il mio CV come chatbot");
    expect(text).toContain("Repository: https://github.com/pi-mis/cv-chatbot-portfolio");
    expect(text).toContain("Temi: portfolio, ai");
    expect(text).toMatch(/^- \d{1,2}\/\d{1,2}\/2026 Aggiunge la chat$/m);
    expect(prettyName(repo.name)).toBe("Cv chatbot portfolio");
  });
  it("strips badges, images and HTML from READMEs", () => {
    const md =
      "# Sinapsi\n[![build](https://x/badge.svg)](https://x)\n![shot](a.png)\n<p align=center>Ciao</p>\nVedi [la demo](https://demo).";
    const out = cleanReadme(md);
    expect(out).toContain("# Sinapsi");
    expect(out).toContain("Ciao");
    expect(out).toContain("Vedi la demo.");
    expect(out).not.toMatch(/badge|png|https|<p|\[\]/);
  });
  it("only uses distinctive names to link mentions", () => {
    expect(repoKey("sinapsi")).toBe("sinapsi");
    expect(repoKey("cv-chatbot-portfolio")).toBe("cv chatbot portfolio");
    expect(repoKey("app")).toBeNull();
  });
});
