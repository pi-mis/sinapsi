/// <reference lib="webworker" />
import { forceSimulation, forceLink, forceManyBody, forceCenter } from "d3-force-3d";

export type LayoutIn = {
  nodes: { id: string; x?: number | null; y?: number | null; z?: number | null; fixed?: boolean }[];
  links: { source: string; target: string; score: number }[];
  iterations?: number;
};
export type LayoutOut = { positions: Record<string, [number, number, number]> };

const RADIUS = 5;

self.onmessage = (ev: MessageEvent<LayoutIn>) => {
  const { nodes, links, iterations = 300 } = ev.data;
  const sim = nodes.map((n) => {
    const o: Record<string, unknown> = { id: n.id };
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
  for (let i = 0; i < iterations; i++) simulation.tick();

  // Normalize into scene units (radius ~5).
  let maxR = 1;
  for (const n of sim as { x: number; y: number; z: number }[]) {
    maxR = Math.max(maxR, Math.hypot(n.x, n.y, n.z));
  }
  const s = RADIUS / maxR;
  const positions: LayoutOut["positions"] = {};
  for (const n of sim as { id: string; x: number; y: number; z: number }[]) {
    positions[n.id] = [n.x * s, n.y * s, n.z * s];
  }
  (self as unknown as Worker).postMessage({ positions } satisfies LayoutOut);
};
