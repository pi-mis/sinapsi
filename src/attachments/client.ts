import { supabase } from "@/integrations/supabase/client";
import { BUCKET, MAX_BYTES, kindOf, summarizeForNote, type AttachmentKind } from "./kinds";
import { extractPdfText, extractPlainText } from "./extract";
import {
  addLink,
  analyzeAttachment,
  deleteAttachment,
  prepareUpload,
  registerAttachment,
} from "./attachments.functions";

export type Attachment = {
  id: string;
  kind: AttachmentKind;
  uri: string;
  extracted_text: string | null;
  created_at: string;
};

export async function listAttachments(noteId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from("sources")
    .select("id,kind,uri,extracted_text,created_at")
    .eq("folder", noteId)
    .order("created_at");
  if (error) throw new Error("Impossibile leggere gli allegati.");
  return (data ?? []).flatMap((r) =>
    r.uri ? [{ ...r, uri: r.uri, kind: r.kind as AttachmentKind }] : [],
  );
}

/**
 * Copies the attachments' text into the note (notes.enriched) and marks it for
 * re-embedding, so files become searchable, linkable and usable by the chat.
 */
export async function syncNote(noteId: string) {
  const { data } = await supabase
    .from("sources")
    .select("kind,uri,extracted_text")
    .eq("folder", noteId)
    .order("created_at");
  const { error } = await supabase
    .from("notes")
    .update({ enriched: summarizeForNote(data ?? []), ai_status: "pending" })
    .eq("id", noteId);
  if (error) throw new Error("Impossibile aggiornare la nota.");
}

export type UploadStep = "reading" | "uploading" | "analyzing";

/** Uploads a file to a note: local extraction for PDF/text, AI reading for images and audio. */
export async function uploadFile(
  noteId: string,
  file: File,
  onStep: (step: UploadStep) => void,
): Promise<{ warning: string | null }> {
  if (file.size > MAX_BYTES) throw new Error(`"${file.name}" supera il limite di 25 MB.`);
  const kind = kindOf(file.type, file.name);
  let extracted: string | undefined;
  let warning: string | null = null;
  if (kind === "pdf" || kind === "text") {
    onStep("reading");
    try {
      extracted = kind === "pdf" ? await extractPdfText(file) : await extractPlainText(file);
      if (kind === "pdf" && !extracted)
        warning = "Il PDF non contiene testo selezionabile (forse è una scansione).";
    } catch {
      warning = "Non sono riuscito a leggere il testo del documento: l'ho salvato comunque.";
    }
  }
  onStep("uploading");
  const target = await prepareUpload({ data: { noteId, name: file.name, size: file.size } });
  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(target.path, target.token, file, {
      contentType: file.type || "application/octet-stream",
    });
  if (error) throw new Error(`Caricamento di "${file.name}" non riuscito.`);
  const { id } = await registerAttachment({
    data: {
      noteId,
      path: target.path,
      kind: kind === "link" ? "file" : kind,
      ...(extracted ? { extracted } : {}),
    },
  });
  if (kind === "image" || kind === "audio") {
    onStep("analyzing");
    const result = await analyzeAttachment({ data: { id } });
    if (result.error)
      warning = `${kind === "image" ? "Immagine" : "Audio"} salvato, ma l'AI non l'ha letto: ${result.error}`;
  }
  await syncNote(noteId);
  return { warning };
}

export async function attachLink(noteId: string, url: string) {
  const normalized = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
  const result = await addLink({ data: { noteId, url: normalized } });
  await syncNote(noteId);
  return result;
}

export async function removeAttachment(noteId: string, id: string) {
  await deleteAttachment({ data: { id } });
  await syncNote(noteId);
}
