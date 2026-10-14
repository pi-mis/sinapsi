/**
 * Tunable constants for the semantic layer (Fase 3).
 *
 * Embeddings are computed locally in the browser with multilingual-e5-small
 * (384 dimensions, MIT licence). The database column is vector(768), so
 * vectors are zero-padded: cosine similarity between padded vectors is
 * identical to the original, so no migration is needed.
 *
 * e5 models produce compressed similarity scores (unrelated texts often sit
 * around 0.75–0.80), so the thresholds below are calibrated for that range.
 * If connections feel too sparse or too dense, these are the knobs to turn.
 */
export const EMBED_MODEL = "Xenova/multilingual-e5-small";
export const EMBED_LIB_URL: string =
  import.meta.env["VITE_EMBED_LIB_URL"] ||
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js";
export const MODEL_DIM = 384;
export const DB_DIM = 768;
/** Characters of a note sent to the embedding model (e5-small reads ~512 tokens). */
export const EMBED_MAX_CHARS = 1800;

/** Neighbours requested from match_notes for every new or edited note. */
export const LINK_CANDIDATES = 12;
/** Maximum semantic synapses created per note. */
export const LINK_TOP_K = 5;
/** Minimum cosine similarity for a synapse. */
export const LINK_MIN_SIM = 0.82;
/** A note with no neighbour above LINK_MIN_SIM still links to its best match above this. */
export const LINK_FALLBACK_SIM = 0.78;
/** Similarity range mapped to the 0–1 edge score used for thickness and layout. */
export const SCORE_FLOOR = 0.8;
export const SCORE_CEIL = 0.95;

/** Minimum similarity for a note to be used as context by the AI chat. */
export const RAG_MIN_SIM = 0.8;
export const RAG_MAX_NOTES = 10;

/** Real constellations start at this id so they never collide with demo clusters (0–5). */
export const CLUSTER_ID_BASE = 10;
/** Below this many embedded notes, no constellations are computed. */
export const CLUSTER_MIN_NOTES = 6;
export const CLUSTER_MAX = 14;
