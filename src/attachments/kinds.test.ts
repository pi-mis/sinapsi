import { describe, it, expect } from "vitest";
import {
  kindOf,
  safeName,
  displayName,
  isStoragePath,
  summarizeForNote,
  MAX_NOTE_EXTRACT,
} from "./kinds";
import { noteText } from "@/ai/embed";
import { EMBED_MAX_CHARS } from "@/ai/config";

const U = "11111111-1111-4111-8111-111111111111";
const N = "22222222-2222-4222-8222-222222222222";

describe("attachments", () => {
  it("recognises kinds from mime type or extension", () => {
    expect(kindOf("image/jpeg", "a.jpg")).toBe("image");
    expect(kindOf("", "Tesi.PDF")).toBe("pdf");
    expect(kindOf("audio/mp4", "vocale.m4a")).toBe("audio");
    expect(kindOf("", "vocale.webm")).toBe("audio");
    expect(kindOf("text/markdown", "note.md")).toBe("text");
    expect(kindOf("application/zip", "x.zip")).toBe("file");
  });
  it("builds safe storage names and reads them back", () => {
    expect(safeName("Città di Dubrovnik (1).jpg")).toBe("Citta-di-Dubrovnik-1-.jpg");
    expect(safeName("///")).toBe("file");
    expect(displayName(`${U}/${N}/0a1b2c3d-1111-4111-8111-111111111111-foto.jpg`)).toBe("foto.jpg");
  });
  it("only accepts paths inside the user's note folder", () => {
    expect(isStoragePath(`${U}/${N}/x-a.pdf`, U, N)).toBe(true);
    expect(isStoragePath(`${N}/${U}/x-a.pdf`, U, N)).toBe(false);
    expect(isStoragePath(`${U}/${N}/../other`, U, N)).toBe(false);
  });
  it("summarises attachment texts for the note, capped", () => {
    expect(summarizeForNote([{ kind: "pdf", uri: "a", extracted_text: "  " }])).toBeNull();
    const text = summarizeForNote([
      { kind: "link", uri: "https://example.com", extracted_text: "Titolo\nRiassunto" },
      {
        kind: "pdf",
        uri: `${U}/${N}/0a1b2c3d-1111-4111-8111-111111111111-tesi.pdf`,
        extracted_text: "x".repeat(20000),
      },
    ])!;
    expect(text.startsWith("[link] https://example.com\nTitolo")).toBe(true);
    expect(text).toContain("[pdf] tesi.pdf");
    expect(text.length).toBeLessThanOrEqual(MAX_NOTE_EXTRACT + 1);
  });
  it("gives attachments room in the embedding text without exceeding the budget", () => {
    const t = noteText("Titolo", "a".repeat(5000), "b".repeat(5000));
    expect(t.length).toBeLessThanOrEqual(EMBED_MAX_CHARS + 2);
    expect(t).toContain("b".repeat(100));
    expect(noteText("T", "breve", "c".repeat(5000))).toContain("breve\nccc");
    expect(noteText("T", "solo testo")).toBe("T\nsolo testo");
  });
});
