import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { extractIntents, lookupDeadline } from "./brain.functions";
import { localToday, runAfter, type Reminder, type ReminderPayload } from "./reminders";

export async function listReminders(): Promise<(Reminder & { noteTitle: string | null })[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id,note_id,status,payload,notes(title)")
    .eq("kind", "reminder")
    .eq("status", "open")
    .order("run_after")
    .limit(300);
  if (error) throw new Error("Impossibile leggere i promemoria.");
  return (data ?? []).map((r) => ({
    id: r.id,
    note_id: r.note_id,
    status: r.status,
    payload: r.payload as unknown as ReminderPayload,
    noteTitle: (r.notes as { title: string } | null)?.title ?? null,
  }));
}

export async function addReminder(
  text: string,
  due: string | null,
  time: string | null,
  noteId: string | null = null,
) {
  const payload: ReminderPayload = {
    text: text.trim().slice(0, 140),
    due,
    time,
    source: "manuale",
  };
  const { error } = await supabase
    .from("jobs")
    .insert({
      kind: "reminder",
      status: "open",
      note_id: noteId,
      payload: payload as unknown as Json,
      run_after: runAfter(due, time),
    });
  if (error) throw new Error("Impossibile salvare il promemoria.");
}

export async function setReminderStatus(id: string, status: "done" | "dismissed" | "open") {
  const { error } = await supabase.from("jobs").update({ status }).eq("id", id);
  if (error) throw new Error("Impossibile aggiornare il promemoria.");
}

export async function rescheduleReminder(
  r: Reminder,
  due: string | null,
  time: string | null = r.payload.time ?? null,
) {
  const payload: ReminderPayload = { ...r.payload, due, time };
  const { error } = await supabase
    .from("jobs")
    .update({ payload: payload as unknown as Json, run_after: runAfter(due, time) })
    .eq("id", r.id);
  if (error) throw new Error("Impossibile spostare il promemoria.");
}

let scanning: Promise<void> = Promise.resolve();

/**
 * Reads new or edited notes for plans and deadlines, then searches the web for
 * missing dates. Runs in the background, one note at a time, and never throws.
 */
export function scanNotes(ids: string[], onChanged: () => void) {
  scanning = scanning.then(async () => {
    const today = localToday();
    const lookups: string[] = [];
    let created = 0;
    for (const noteId of ids.slice(0, 30)) {
      try {
        const r = await extractIntents({ data: { noteId, today } });
        created += r.created;
        lookups.push(...r.lookups);
        if ("error" in r && r.error && /limite/i.test(r.error)) break;
      } catch {
        /* the next save retries */
      }
    }
    if (created) onChanged();
    for (const id of lookups.slice(0, 5)) {
      try {
        if ((await lookupDeadline({ data: { id, today } })).found) onChanged();
      } catch {
        /* keep the reminder without a date */
      }
    }
  });
}

/** Retries web lookups that are still pending (e.g. the app was closed mid-search). */
export async function retryLookup(id: string) {
  return (await lookupDeadline({ data: { id, today: localToday() } })).found;
}

// ---------- Private calendar feed ----------

export async function feedToken(create: boolean): Promise<string | null> {
  const { data } = await supabase
    .from("sources")
    .select("id,uri")
    .eq("kind", "reminder_feed")
    .maybeSingle();
  if (data?.uri || !create) return data?.uri ?? null;
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const { error } = await supabase.from("sources").insert({ kind: "reminder_feed", uri: token });
  if (error) throw new Error("Impossibile creare il link del calendario.");
  return token;
}

/** Invalidates the old link (e.g. if it was shared by mistake). */
export async function rotateFeedToken(): Promise<string> {
  await supabase.from("sources").delete().eq("kind", "reminder_feed");
  return (await feedToken(true))!;
}

export function feedUrl(token: string, scheme: "https" | "webcal" = "https") {
  const url = new URL(`/api/promemoria/${token}.ics`, window.location.origin);
  return scheme === "webcal" ? url.href.replace(/^https?:/, "webcal:") : url.href;
}
