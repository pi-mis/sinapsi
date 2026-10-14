/**
 * Attachments live in the existing `sources` table, one row per attachment:
 *   kind   'image' | 'pdf' | 'audio' | 'text' | 'file' | 'link'
 *   uri    storage path `<userId>/<noteId>/<uuid>-<name>` (or the URL for links)
 *   folder the note id the attachment belongs to
 *   extracted_text  what the AI can read: PDF/text content, image description, transcript, link summary
 * Files are in the private Storage bucket below, reachable only through signed URLs.
 */
export const BUCKET = "attachments";
/** Groq's free-tier transcription limit is 25 MB; the same cap keeps uploads reasonable. */
export const MAX_BYTES = 25 * 1024 * 1024;
/** Text kept per attachment, and per note across all attachments (stored in notes.enriched). */
export const MAX_EXTRACT = 12000;
export const MAX_NOTE_EXTRACT = 8000;

export type AttachmentKind = "image" | "pdf" | "audio" | "text" | "file" | "link";

export function kindOf(mime: string, name: string): AttachmentKind {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("audio/") || ["m4a", "mp3", "wav", "ogg", "webm", "flac"].includes(ext))
    return "audio";
  if (mime.startsWith("text/") || ["md", "txt", "csv"].includes(ext)) return "text";
  return "file";
}

/** File names safe for storage paths; keeps the extension readable. */
export function safeName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (cleaned || "file").slice(-80);
}

/** The display name stored in the path after the uuid prefix. */
export function displayName(uri: string): string {
  if (uri.startsWith("whatsapp://")) return "Trascrizione WhatsApp";
  if (uri.startsWith("github://")) return "README";
  const last = uri.split("/").pop() ?? uri;
  return last.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "");
}

export function isStoragePath(uri: string, userId: string, noteId: string): boolean {
  return uri.startsWith(`${userId}/${noteId}/`) && !uri.includes("..");
}

/** Joins attachment texts into the note's `enriched` field (searchable and embedded). */
export function summarizeForNote(
  rows: { kind: string; uri: string | null; extracted_text: string | null }[],
): string | null {
  const parts = rows
    .filter((r) => r.extracted_text?.trim())
    .map((r) => {
      const label = r.kind === "link" ? (r.uri ?? "link") : displayName(r.uri ?? "");
      return `[${r.kind}] ${label}\n${r.extracted_text!.trim()}`;
    });
  if (!parts.length) return null;
  const text = parts.join("\n\n");
  return text.length > MAX_NOTE_EXTRACT ? `${text.slice(0, MAX_NOTE_EXTRACT)}…` : text;
}
