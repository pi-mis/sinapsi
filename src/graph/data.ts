import { t } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { runLayout } from "./layout";

export type GNode = {
  id: string;
  title: string;
  type: string;
  weight: number;
  cluster: number;
  /** Constellation hue (0–1) when the cluster has been named; null for demo/unclustered notes. */
  hue: number | null;
  x: number;
  y: number;
  z: number;
};
export type GEdge = { a: number; b: number; score: number; kind: string };
export type Constellation = {
  id: number;
  label: string;
  summary: string | null;
  hue: number;
  count: number;
};
export type GraphData = {
  nodes: GNode[];
  edges: GEdge[];
  demoCount: number;
  constellations: Constellation[];
};

const PAGE = 1000;

async function fetchAll<T>(table: "notes" | "edges", columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(t("Impossibile caricare il grafo"));
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Loads only the lightweight graph fields; full note content loads on click. */
export async function loadGraph(): Promise<GraphData> {
  type NRow = {
    id: string;
    title: string;
    type: string;
    weight: number;
    cluster_id: number | null;
    pos_x: number | null;
    pos_y: number | null;
    pos_z: number | null;
    is_demo: boolean;
  };
  type ERow = { a: string; b: string; score: number; kind: string };
  const [rows, erows, crows] = await Promise.all([
    fetchAll<NRow>("notes", "id,title,type,weight,cluster_id,pos_x,pos_y,pos_z,is_demo"),
    fetchAll<ERow>("edges", "a,b,score,kind"),
    supabase.from("clusters").select("cluster_id,label,summary,hue,member_count"),
  ]);
  const constellations: Constellation[] = (crows.data ?? [])
    .filter((c) => c.hue != null)
    .map((c) => ({
      id: c.cluster_id,
      label: c.label ?? t("Costellazione {n}", { n: c.cluster_id }),
      summary: c.summary,
      hue: c.hue!,
      count: c.member_count,
    }))
    .sort((a, b) => b.count - a.count);
  const hueOf = new Map(constellations.map((c) => [c.id, c.hue]));

  // Layout only notes without saved positions; the rest stay fixed.
  const missing = rows.filter((r) => r.pos_x == null);
  if (missing.length) {
    const positions = await runLayout({
      nodes: rows.map((r) => ({
        id: r.id,
        x: r.pos_x,
        y: r.pos_y,
        z: r.pos_z,
        fixed: r.pos_x != null,
        cluster: r.cluster_id,
      })),
      links: erows.map((e) => ({ source: e.a, target: e.b, score: e.score })),
      iterations: rows.length === missing.length ? 300 : 60,
    });
    for (const r of missing) {
      const p = positions[r.id];
      if (!p) continue;
      [r.pos_x, r.pos_y, r.pos_z] = p;
      await supabase.from("notes").update({ pos_x: p[0], pos_y: p[1], pos_z: p[2] }).eq("id", r.id);
    }
  }

  const index = new Map<string, number>();
  const nodes: GNode[] = rows.map((r, i) => {
    index.set(r.id, i);
    return {
      id: r.id,
      title: (r.title || "Senza titolo").slice(0, 60),
      type: r.type,
      weight: r.weight,
      cluster: r.cluster_id ?? 0,
      hue: r.cluster_id != null ? (hueOf.get(r.cluster_id) ?? null) : null,
      x: r.pos_x ?? 0,
      y: r.pos_y ?? 0,
      z: r.pos_z ?? 0,
    };
  });
  const edges: GEdge[] = [];
  for (const e of erows) {
    const a = index.get(e.a);
    const b = index.get(e.b);
    if (a != null && b != null) edges.push({ a, b, score: e.score, kind: e.kind });
  }
  return { nodes, edges, demoCount: rows.filter((r) => r.is_demo).length, constellations };
}
