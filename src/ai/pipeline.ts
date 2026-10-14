import { supabase } from "@/integrations/supabase/client";
import { embed, noteText } from "./embed";
import { chooseK, hueForIndex, kmeans, representatives } from "./cluster";
import {
  CLUSTER_ID_BASE,
  LINK_CANDIDATES,
  LINK_FALLBACK_SIM,
  LINK_MIN_SIM,
  LINK_TOP_K,
} from "./config";
import {
  canonicalPair,
  parsePgVector,
  similarityToScore,
  toPgVector,
  weightForContent,
} from "./vector";
import { labelConstellations } from "./ai.functions";

/**
 * Client-side semantic pipeline. Runs in the browser because the embedding model
 * does: new or edited notes (ai_status = 'pending') get a vector, synapses to their
 * nearest neighbours, a size, and a constellation.
 */

export type PipelineStep =
  | { phase: "linking"; done: number; total: number }
  | { phase: "clustering" }
  | { phase: "labelling" };

const BATCH = 16;

export async function countPending(): Promise<number> {
  const { count, error } = await supabase
    .from("notes")
    .select("id", { count: "exact", head: true })
    .in("ai_status", ["pending", "skipped"]);
  if (error) throw new Error("Impossibile leggere lo stato delle note.");
  return count ?? 0;
}

/** Picks the neighbours that become synapses. */
export function pickNeighbours(matches: readonly { id: string; similarity: number }[]) {
  const sorted = [...matches].sort((a, b) => b.similarity - a.similarity);
  const strong = sorted.filter((m) => m.similarity >= LINK_MIN_SIM).slice(0, LINK_TOP_K);
  if (strong.length) return strong;
  const best = sorted[0];
  return best && best.similarity >= LINK_FALLBACK_SIM ? [best] : [];
}

async function linkNote(id: string, vector: string): Promise<number | null> {
  const { data: matches, error } = await supabase.rpc("match_notes", {
    query_embedding: vector,
    match_count: LINK_CANDIDATES,
    exclude_id: id,
  });
  if (error) throw new Error("Ricerca dei vicini non disponibile.");
  const neighbours = pickNeighbours(matches ?? []);
  const { error: delError } = await supabase
    .from("edges")
    .delete()
    .eq("kind", "semantic")
    .or(`a.eq.${id},b.eq.${id}`);
  if (delError) throw new Error("Impossibile aggiornare le connessioni.");
  if (neighbours.length) {
    const rows = neighbours.map((m) => {
      const [a, b] = canonicalPair(id, m.id);
      return {
        a,
        b,
        score: similarityToScore(m.similarity),
        kind: "semantic",
        components: { cosine: Math.round(m.similarity * 1000) / 1000 },
        explanation: null,
      };
    });
    const { error: upError } = await supabase.from("edges").upsert(rows, { onConflict: "a,b" });
    if (upError) throw new Error("Impossibile salvare le connessioni.");
  }
  // A new note joins the constellation of its closest neighbour until the next reclustering.
  const nearest = neighbours[0];
  if (!nearest) return null;
  const { data } = await supabase
    .from("notes")
    .select("cluster_id")
    .eq("id", nearest.id)
    .maybeSingle();
  return data?.cluster_id ?? null;
}

/** Embeds and links every pending note. Returns how many were processed. */
export async function processPending(report: (step: PipelineStep) => void): Promise<number> {
  const total = await countPending();
  if (!total) return 0;
  const seen = new Set<string>();
  let done = 0;
  report({ phase: "linking", done, total });
  for (;;) {
    const { data: notes, error } = await supabase
      .from("notes")
      .select("id,title,content")
      .in("ai_status", ["pending", "skipped"])
      .order("created_at")
      .limit(BATCH);
    if (error) throw new Error("Impossibile leggere le note da collegare.");
    const batch = (notes ?? []).filter((n) => !seen.has(n.id));
    if (!batch.length) break;
    batch.forEach((n) => seen.add(n.id));
    const vectors = await embed(batch.map((n) => noteText(n.title, n.content)));
    for (let i = 0; i < batch.length; i++) {
      const note = batch[i]!;
      try {
        const vector = toPgVector(vectors[i]!);
        const { error: upError } = await supabase
          .from("notes")
          .update({
            embedding: vector,
            weight: weightForContent(note.title.length + note.content.length),
            ai_status: "embedded",
          })
          .eq("id", note.id);
        if (upError) throw upError;
        const cluster = await linkNote(note.id, vector);
        if (cluster != null)
          await supabase.from("notes").update({ cluster_id: cluster }).eq("id", note.id);
      } catch {
        await supabase.from("notes").update({ ai_status: "error" }).eq("id", note.id);
      }
      report({ phase: "linking", done: ++done, total: Math.max(total, done) });
    }
  }
  return done;
}

type EmbeddedRow = { id: string; title: string; is_private: boolean; embedding: string | null };

async function loadEmbedded(): Promise<EmbeddedRow[]> {
  const out: EmbeddedRow[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from("notes")
      .select("id,title,is_private,embedding")
      .eq("is_demo", false)
      .not("embedding", "is", null)
      .order("id")
      .range(from, from + 499);
    if (error) throw new Error("Impossibile leggere i vettori delle note.");
    out.push(...(data as EmbeddedRow[]));
    if (data.length < 500) return out;
  }
}

/** Whether enough new notes have arrived since the last clustering, and whether it would be the first. */
export async function needsReclustering(): Promise<{ needed: boolean; first: boolean }> {
  const [{ count }, { data: clusters }] = await Promise.all([
    supabase
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("is_demo", false)
      .not("embedding", "is", null),
    supabase.from("clusters").select("member_count").gte("cluster_id", CLUSTER_ID_BASE),
  ]);
  const embedded = count ?? 0;
  const clustered = (clusters ?? []).reduce((s, c) => s + c.member_count, 0);
  if (!chooseK(embedded)) return { needed: false, first: false };
  return {
    needed: clustered === 0 || embedded >= Math.ceil(clustered * 1.2) + 2,
    first: clustered === 0,
  };
}

/**
 * Recomputes constellations from scratch: k-means on the local vectors, names from
 * Groq (titles of non-private notes only), evenly spread hues.
 * With `relayout`, positions are reset so the space reorganises around the new groups.
 */
export async function recluster(
  report: (step: PipelineStep) => void,
  options: { relayout?: boolean } = {},
) {
  report({ phase: "clustering" });
  const rows = await loadEmbedded();
  const items = rows.flatMap((r) => {
    const v = parsePgVector(r.embedding);
    return v ? [{ row: r, vector: v }] : [];
  });
  const k = chooseK(items.length);
  if (!k) return 0;
  const vectors = items.map((i) => i.vector);
  const { assign, centroids } = kmeans(vectors, k);
  const groups = centroids
    .map((centroid, c) => ({ centroid, members: assign.flatMap((a, i) => (a === c ? [i] : [])) }))
    .filter((g) => g.members.length > 0)
    .sort((a, b) => b.members.length - a.members.length)
    .map((g, index) => ({ ...g, id: CLUSTER_ID_BASE + index, hue: hueForIndex(index) }));

  report({ phase: "labelling" });
  const titlesFor = (g: (typeof groups)[number]) =>
    representatives(
      vectors,
      g.members.filter((i) => !items[i]!.row.is_private),
      g.centroid,
      8,
    ).map((i) => items[i]!.row.title.slice(0, 160));
  let labels: { id: number; label: string; summary: string }[] = [];
  try {
    labels = (
      await labelConstellations({
        data: { clusters: groups.map((g) => ({ id: g.id, titles: titlesFor(g) })) },
      })
    ).labels;
  } catch {
    labels = [];
  }

  for (const g of groups) {
    const ids = g.members.map((i) => items[i]!.row.id);
    for (let i = 0; i < ids.length; i += 150) {
      const patch = options.relayout
        ? { cluster_id: g.id, pos_x: null, pos_y: null, pos_z: null }
        : { cluster_id: g.id };
      const { error } = await supabase
        .from("notes")
        .update(patch)
        .in("id", ids.slice(i, i + 150));
      if (error) throw new Error("Impossibile salvare le costellazioni.");
    }
  }
  const { error: delError } = await supabase.from("clusters").delete().gte("cluster_id", 0);
  if (delError) throw new Error("Impossibile aggiornare le costellazioni.");
  const { error } = await supabase.from("clusters").insert(
    groups.map((g, index) => {
      const named = labels.find((l) => l.id === g.id);
      return {
        cluster_id: g.id,
        label: named?.label || `Costellazione ${index + 1}`,
        summary: named?.summary || null,
        hue: g.hue,
        member_count: g.members.length,
      };
    }),
  );
  if (error) throw new Error("Impossibile salvare le costellazioni.");
  return groups.length;
}
