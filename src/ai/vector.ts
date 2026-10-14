import { DB_DIM, MODEL_DIM, SCORE_CEIL, SCORE_FLOOR } from "./config";

/** Serialises a model vector for a pgvector(768) column, zero-padding the tail. */
export function toPgVector(vector: readonly number[]): string {
  if (vector.length > DB_DIM) throw new Error("Vettore troppo lungo");
  const parts: string[] = new Array(DB_DIM);
  for (let i = 0; i < DB_DIM; i++) {
    const v = vector[i] ?? 0;
    if (!Number.isFinite(v)) throw new Error("Vettore non valido");
    parts[i] = i < vector.length ? v.toFixed(6) : "0";
  }
  return `[${parts.join(",")}]`;
}

/** Parses a pgvector string back into the model-sized vector. */
export function parsePgVector(value: string | null | undefined, dim = MODEL_DIM): number[] | null {
  if (!value) return null;
  const parts = value.replace(/^\[|\]$/g, "").split(",");
  if (parts.length < dim) return null;
  const out = new Array<number>(dim);
  for (let i = 0; i < dim; i++) {
    const v = Number(parts[i]);
    if (!Number.isFinite(v)) return null;
    out[i] = v;
  }
  return out;
}

/** Maps a raw cosine similarity to the 0–1 synapse strength. */
export function similarityToScore(sim: number): number {
  const t = (sim - SCORE_FLOOR) / (SCORE_CEIL - SCORE_FLOOR);
  return Math.round(Math.min(1, Math.max(0.05, t)) * 1000) / 1000;
}

/** Neuron size grows with content, logarithmically so long notes don't dwarf the rest. */
export function weightForContent(length: number): number {
  const t = Math.log10(1 + Math.max(0, length) / 60) / Math.log10(1 + 4000 / 60);
  return Math.round((0.15 + 0.85 * Math.min(1, t)) * 1000) / 1000;
}

/** Edges are stored once per pair; this keeps (a, b) in a stable order. */
export function canonicalPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}
