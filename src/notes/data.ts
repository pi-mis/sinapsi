import { t } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
export type Note = Tables<"notes">;
export type NoteSummary = Pick<
  Note,
  "id" | "title" | "type" | "is_private" | "pinned" | "event_date" | "created_at"
>;
export async function listNotes(): Promise<NoteSummary[]> {
  const out: NoteSummary[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("notes")
      .select("id,title,type,is_private,pinned,event_date,created_at")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(t("Impossibile caricare le note. Riprova."));
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
export async function readNote(id: string) {
  const { data, error } = await supabase.from("notes").select("*").eq("id", id).single();
  if (error) throw new Error(t("Impossibile aprire la nota."));
  return data;
}
export type NoteInput = {
  title: string;
  content: string;
  type: string;
  is_private: boolean;
  pinned: boolean;
  event_date: string | null;
};
export async function saveNote(input: NoteInput, id?: string) {
  if (!input.content.trim()) throw new Error(t("Scrivi il testo della nota."));
  const value = {
    ...input,
    title:
      input.title.trim() || input.content.trim().split("\n")[0]?.slice(0, 80) || t("Senza titolo"),
    ai_status: "pending",
  }; // embeddings are computed on-device, so private notes are linked too; they are never sent to Groq
  const query = id
    ? supabase.from("notes").update(value).eq("id", id)
    : supabase.from("notes").insert(value);
  const { data, error } = await query.select("id").single();
  if (error) throw new Error(t("La nota non è stata salvata. Il testo rimane disponibile."));
  return data.id;
}
export async function deleteNote(id: string) {
  // Attachments are not tied to the note by a foreign key: remove their files first.
  const { purgeAttachments } = await import("@/attachments/attachments.functions");
  await purgeAttachments({ data: { noteId: id } });
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw new Error(t("Impossibile eliminare la nota."));
}
