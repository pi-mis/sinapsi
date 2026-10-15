import { guessLang, translate, translateLoose } from "./core";
import { EN } from "./en";
import { canonicalType, typeLabel } from "./types";

describe("i18n", () => {
  it("defaults to Italian for Italian devices or connections, English otherwise", () => {
    expect(guessLang({ languages: ["it-IT", "en"] })).toBe("it");
    expect(guessLang({ languages: ["sv-SE", "it"] })).toBe("it");
    expect(guessLang({ languages: ["en-US"], timeZone: "Europe/Rome" })).toBe("it");
    expect(guessLang({ languages: ["en-US"], country: "IT" })).toBe("it");
    expect(guessLang({ languages: ["sv-SE"], timeZone: "Europe/Stockholm", country: "SE" })).toBe(
      "en",
    );
  });

  it("translates keys and fills placeholders", () => {
    expect(translate("it", "{n} note", { n: 3 })).toBe("3 note");
    expect(translate("en", "{n} note", { n: 3 })).toBe("3 notes");
    expect(translateLoose("en", "Nota non trovata.")).toBe("Note not found.");
    expect(translateLoose("en", "messaggio sconosciuto")).toBe("messaggio sconosciuto");
  });

  it("keeps every placeholder in the English text", () => {
    for (const [it, en] of Object.entries(EN)) {
      const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(names(en), it).toEqual(names(it));
    }
  });

  it("shows note types translated but stores them in Italian", () => {
    expect(typeLabel("ricordo", "en")).toBe("memory");
    expect(typeLabel("ricordo", "it")).toBe("ricordo");
    expect(canonicalType("Memory")).toBe("ricordo");
    expect(canonicalType("viaggio")).toBe("viaggio");
  });
});
