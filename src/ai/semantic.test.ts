import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("./ai.functions", () => ({ labelConstellations: vi.fn() }));
import {
  toPgVector,
  parsePgVector,
  similarityToScore,
  weightForContent,
  canonicalPair,
} from "./vector";
import { chooseK, kmeans, hueForIndex, representatives } from "./cluster";
import { pickNeighbours } from "./pipeline";
import { DB_DIM, MODEL_DIM, LINK_TOP_K } from "./config";

const unit = (v: number[]) => {
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};
const cos = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);

describe("vector encoding", () => {
  it("pads to the database width and preserves cosine similarity", () => {
    const a = unit(Array.from({ length: MODEL_DIM }, (_, i) => Math.sin(i)));
    const b = unit(Array.from({ length: MODEL_DIM }, (_, i) => Math.cos(i / 3)));
    const pa = toPgVector(a),
      pb = toPgVector(b);
    expect(pa.split(",")).toHaveLength(DB_DIM);
    const fa = pa.slice(1, -1).split(",").map(Number),
      fb = pb.slice(1, -1).split(",").map(Number);
    expect(cos(fa, fb)).toBeCloseTo(cos(a, b), 4);
    expect(parsePgVector(pa)).toHaveLength(MODEL_DIM);
    expect(parsePgVector(pa)![10]).toBeCloseTo(a[10]!, 5);
  });
  it("rejects broken vectors", () => {
    expect(() => toPgVector([NaN])).toThrow();
    expect(parsePgVector("[1,2]")).toBeNull();
    expect(parsePgVector(null)).toBeNull();
  });
  it("maps similarity, size and pair order sensibly", () => {
    expect(similarityToScore(0.5)).toBe(0.05);
    expect(similarityToScore(0.99)).toBe(1);
    expect(similarityToScore(0.875)).toBeGreaterThan(similarityToScore(0.84));
    expect(weightForContent(0)).toBe(0.15);
    expect(weightForContent(100000)).toBe(1);
    expect(weightForContent(600)).toBeGreaterThan(weightForContent(60));
    expect(canonicalPair("b", "a")).toEqual(["a", "b"]);
  });
});

describe("constellations", () => {
  it("chooses no clusters for tiny memories and caps large ones", () => {
    expect(chooseK(3)).toBe(0);
    expect(chooseK(20)).toBe(3);
    expect(chooseK(100000)).toBe(14);
  });
  it("separates clearly distinct groups deterministically", () => {
    const groups = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const vectors = groups.flatMap((g, gi) =>
      Array.from({ length: 8 }, (_, i) =>
        unit(g.map((x, d) => x + 0.08 * Math.sin(i * 7 + d + gi))),
      ),
    );
    const { assign } = kmeans(vectors, 3);
    for (let g = 0; g < 3; g++) expect(new Set(assign.slice(g * 8, g * 8 + 8)).size).toBe(1);
    expect(new Set(assign).size).toBe(3);
    expect(kmeans(vectors, 3).assign).toEqual(assign);
  });
  it("spreads hues and ranks representatives by closeness to the centroid", () => {
    const hues = Array.from({ length: 6 }, (_, i) => hueForIndex(i));
    expect(new Set(hues).size).toBe(6);
    hues.forEach((h) => {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    });
    const v = [unit([1, 0]), unit([1, 1]), unit([0, 1])];
    expect(representatives(v, [0, 1, 2], [1, 0], 2)).toEqual([0, 1]);
  });
});

describe("synapse selection", () => {
  it("keeps the strongest neighbours above threshold, capped", () => {
    const matches = Array.from({ length: 10 }, (_, i) => ({
      id: `n${i}`,
      similarity: 0.9 - i * 0.005,
    }));
    const picked = pickNeighbours(matches);
    expect(picked).toHaveLength(LINK_TOP_K);
    expect(picked[0]!.id).toBe("n0");
  });
  it("falls back to the single best match, or nothing when all are unrelated", () => {
    expect(
      pickNeighbours([
        { id: "a", similarity: 0.79 },
        { id: "b", similarity: 0.785 },
      ]).map((m) => m.id),
    ).toEqual(["a"]);
    expect(pickNeighbours([{ id: "a", similarity: 0.6 }])).toEqual([]);
  });
});
