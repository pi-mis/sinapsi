/** Contacts from a vCard export (iPhone, Google, Outlook) or LinkedIn's Connections.csv. */

export type ContactInput = {
  full_name: string;
  email: string | null;
  company: string | null;
  position: string | null;
  url: string | null;
  connected_on: string | null;
};

function unfold(text: string) {
  return text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "");
}

function unescapeV(value: string) {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\([,;\\])/g, "$1")
    .trim();
}

export function parseVCards(text: string): ContactInput[] {
  const out: ContactInput[] = [];
  for (const block of unfold(text)
    .split(/BEGIN:VCARD/i)
    .slice(1)) {
    const props = new Map<string, string>();
    for (const line of block.split("\n")) {
      const idx = line.indexOf(":");
      if (idx <= 0) continue;
      const key = line.slice(0, idx).split(";")[0]!.split(".").pop()!.toUpperCase();
      if (!props.has(key)) props.set(key, unescapeV(line.slice(idx + 1)));
    }
    let name = props.get("FN") ?? "";
    if (!name && props.get("N")) {
      const [last = "", first = ""] = props.get("N")!.split(";");
      name = `${first} ${last}`.trim();
    }
    if (!name) continue;
    out.push({
      full_name: name,
      email: props.get("EMAIL") || null,
      company: props.get("ORG")?.split(";")[0] || null,
      position: props.get("TITLE") || null,
      url: props.get("URL") || null,
      connected_on: null,
    });
  }
  return out;
}

/** Minimal RFC 4180 CSV parser (quoted fields, commas and newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function linkedinDate(value: string): string | null {
  const m = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const month = MONTHS[m[2]!.toLowerCase()];
  return month ? `${m[3]}-${String(month).padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : null;
}

/** LinkedIn "Connections.csv": a few lines of notes, then First Name,Last Name,URL,Email Address,Company,Position,Connected On. */
export function parseLinkedInCsv(text: string): ContactInput[] {
  const rows = parseCsv(text.replace(/^\ufeff/, ""));
  const header = rows.findIndex(
    (r) => r.some((c) => /first name/i.test(c)) && r.some((c) => /last name/i.test(c)),
  );
  if (header < 0) return [];
  const cols = rows[header]!.map((c) => c.trim().toLowerCase());
  const at = (r: string[], name: string) => {
    const i = cols.indexOf(name);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  return rows.slice(header + 1).flatMap((r) => {
    const name = `${at(r, "first name")} ${at(r, "last name")}`.trim();
    if (!name) return [];
    return [
      {
        full_name: name,
        email: at(r, "email address") || null,
        company: at(r, "company") || null,
        position: at(r, "position") || null,
        url: at(r, "url") || null,
        connected_on: linkedinDate(at(r, "connected on")),
      },
    ];
  });
}

/** Lower-case, accent-free, single-spaced: used to match names in notes and to deduplicate. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
