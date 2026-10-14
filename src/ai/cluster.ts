import { CLUSTER_MAX, CLUSTER_MIN_NOTES } from "./config";

/** Number of constellations for n notes: grows like sqrt(n/2), capped. */
export function chooseK(n: number): number {
  if (n < CLUSTER_MIN_NOTES) return 0;
  return Math.max(2, Math.min(CLUSTER_MAX, Math.round(Math.sqrt(n / 2))));
}

function dot(a: readonly number[], b: readonly number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

function normalize(v: number[]) {
  const n = Math.sqrt(dot(v, v)) || 1;
  for (let i = 0; i < v.length; i++) v[i] = v[i]! / n;
  return v;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export type Clustering = { assign: number[]; centroids: number[][] };

/**
 * Spherical k-means (cosine) with k-means++ seeding. Vectors must be normalised.
 * Deterministic for a given seed so the same notes produce the same constellations.
 */
export function kmeans(
  vectors: readonly (readonly number[])[],
  k: number,
  seed = 7,
  iterations = 30,
): Clustering {
  const n = vectors.length;
  if (!n || k <= 0) return { assign: [], centroids: [] };
  k = Math.min(k, n);
  const random = rng(seed);
  const centroids: number[][] = [[...vectors[Math.floor(random() * n)]!]];
  const best = new Array<number>(n).fill(Infinity);
  while (centroids.length < k) {
    const last = centroids[centroids.length - 1]!;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const d = Math.max(0, 1 - dot(vectors[i]!, last));
      best[i] = Math.min(best[i]!, d * d);
      total += best[i]!;
    }
    let r = random() * total;
    let pick = n - 1;
    for (let i = 0; i < n; i++) {
      r -= best[i]!;
      if (r <= 0) {
        pick = i;
        break;
      }
    }
    centroids.push([...vectors[pick]!]);
  }

  const assign = new Array<number>(n).fill(-1);
  for (let it = 0; it < iterations; it++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let bestC = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < k; c++) {
        const s = dot(vectors[i]!, centroids[c]!);
        if (s > bestSim) {
          bestSim = s;
          bestC = c;
        }
      }
      if (assign[i] !== bestC) {
        assign[i] = bestC;
        changed = true;
      }
    }
    const dim = vectors[0]!.length;
    const sums = Array.from({ length: k }, () => new Array<number>(dim).fill(0));
    const counts = new Array<number>(k).fill(0);
    for (let i = 0; i < n; i++) {
      const c = assign[i]!;
      counts[c]!++;
      const v = vectors[i]!;
      const s = sums[c]!;
      for (let d = 0; d < dim; d++) s[d] = s[d]! + v[d]!;
    }
    for (let c = 0; c < k; c++) {
      // An emptied cluster is re-seeded on the point farthest from its centroid.
      if (counts[c] === 0) {
        let far = 0;
        let farSim = Infinity;
        for (let i = 0; i < n; i++) {
          const s = dot(vectors[i]!, centroids[assign[i]!]!);
          if (s < farSim) {
            farSim = s;
            far = i;
          }
        }
        centroids[c] = [...vectors[far]!];
        assign[far] = c;
        changed = true;
      } else centroids[c] = normalize(sums[c]!);
    }
    if (!changed) break;
  }
  return { assign, centroids };
}

/** Evenly spread hues (golden angle) starting from teal, so neighbouring ids differ clearly. */
export function hueForIndex(index: number): number {
  return Math.round(((0.48 + index * 0.618034) % 1) * 1000) / 1000;
}

/** Indices of the members closest to the centroid: the most representative notes. */
export function representatives(
  vectors: readonly (readonly number[])[],
  members: readonly number[],
  centroid: readonly number[],
  count: number,
): number[] {
  return [...members]
    .sort((a, b) => dot(vectors[b]!, centroid) - dot(vectors[a]!, centroid))
    .slice(0, count);
}
