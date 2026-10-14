/// <reference lib="webworker" />
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceX,
  forceY,
  forceZ,
} from "d3-force-3d";

export type LayoutIn = {
  nodes: {
    id: string;
    x?: number | null;
    y?: number | null;
    z?: number | null;
    fixed?: boolean;
    cluster?: number | null;
  }[];
  links: { source: string; target: string; score: number }[];
  iterations?: number;
};
export type LayoutOut = { positions: Record<string, [number, number, number]> };

const RADIUS = 5;
/** Distance of constellation anchors from the centre, in simulation units. */
const ANCHOR_RADIUS = 110;

/** Points spread evenly on a sphere (Fibonacci lattice). */
function spherePoint(i: number, n: number): [number, number, number] {
  if (n <= 1) return [0, 0, 0];
  const y = 1 - (2 * (i + 0.5)) / n;
  const r = Math.sqrt(1 - y * y);
  const t = i * Math.PI * (3 - Math.sqrt(5));
  return [Math.cos(t) * r * ANCHOR_RADIUS, y * ANCHOR_RADIUS, Math.sin(t) * r * ANCHOR_RADIUS];
}

/**
 * Each constellation gets an anchor its members are gently pulled towards: the centre
 * of its already-placed members if any, otherwise a free point on a sphere.
 */
function anchorsFor(nodes: LayoutIn["nodes"]): Map<number, [number, number, number]> {
  const clusters = [...new Set(nodes.flatMap((n) => (n.cluster != null ? [n.cluster] : [])))].sort(
    (a, b) => a - b,
  );
  const anchors = new Map<number, [number, number, number]>();
  clusters.forEach((c, i) => {
    const placed = nodes.filter((n) => n.cluster === c && n.fixed && n.x != null);
    if (placed.length) {
      let sx = 0,
        sy = 0,
        sz = 0;
      for (const n of placed) {
        sx += (n.x ?? 0) * 40;
        sy += (n.y ?? 0) * 40;
        sz += (n.z ?? 0) * 40;
      }
      anchors.set(c, [sx / placed.length, sy / placed.length, sz / placed.length]);
    } else anchors.set(c, spherePoint(i, clusters.length));
  });
  return anchors;
}

self.onmessage = (ev: MessageEvent<LayoutIn>) => {
  const { nodes, links, iterations = 300 } = ev.data;
  const sim = nodes.map((n) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const o: any = { id: n.id, cluster: n.cluster ?? null };
    if (n.x != null) {
      o.x = n.x * 40;
      o.y = (n.y ?? 0) * 40;
      o.z = (n.z ?? 0) * 40;
      if (n.fixed) {
        o.fx = o.x;
        o.fy = o.y;
        o.fz = o.z;
      }
    }
    return o;
  });
  const simulation = forceSimulation(sim, 3)
    .force(
      "link",
      forceLink(links.map((l) => ({ ...l })))
        .id((d: { id: string }) => d.id)
        .distance((l: { score: number }) => 18 / (0.15 + l.score))
        .strength((l: { score: number }) => 0.2 + l.score * 0.8),
    )
    .force("charge", forceManyBody().strength(-40).distanceMax(250))
    .force("center", forceCenter(0, 0, 0).strength(0.05))
    .stop();
  const anchors = anchorsFor(nodes);
  if (anchors.size > 1) {
    type Sim = { cluster: number | null };
    const pull = (axis: 0 | 1 | 2) => (d: Sim) =>
      d.cluster != null ? (anchors.get(d.cluster)?.[axis] ?? 0) : 0;
    const strength = (d: Sim) => (d.cluster != null && anchors.has(d.cluster) ? 0.06 : 0);
    simulation
      .force("cx", forceX(pull(0)).strength(strength))
      .force("cy", forceY(pull(1)).strength(strength))
      .force("cz", forceZ(pull(2)).strength(strength));
  }
  for (let i = 0; i < iterations; i++) simulation.tick();

  // Normalize into scene units (radius ~5).
  let maxR = 1;
  for (const n of sim as { x: number; y: number; z: number }[]) {
    maxR = Math.max(maxR, Math.hypot(n.x, n.y, n.z));
  }
  const s = nodes.some((n) => n.fixed) ? 1 / 40 : RADIUS / maxR;
  const positions: LayoutOut["positions"] = {};
  for (const n of sim as { id: string; x: number; y: number; z: number }[]) {
    positions[n.id] = [n.x * s, n.y * s, n.z * s];
  }
  (self as unknown as Worker).postMessage({ positions } satisfies LayoutOut);
};
