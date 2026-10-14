import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { GraphData, GNode } from "./data";
import {
  DUST_FRAGMENT,
  DUST_VERTEX,
  HALO_FRAGMENT,
  HALO_VERTEX,
  NEBULA_FRAGMENT,
  NEBULA_VERTEX,
  NEURON_FRAGMENT,
  NEURON_VERTEX,
  SYNAPSE_FRAGMENT,
  SYNAPSE_VERTEX,
} from "./shaders";

export type QualityLevel = 0 | 1 | 2 | 3;
export type ViewCommand = { action: "reset" | "in" | "out"; tick: number };
type Props = {
  data: GraphData;
  quality: QualityLevel;
  reducedMotion: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  command: ViewCommand;
  mode: "pan" | "orbit";
  highlighted: string[] | null;
  /** Decorative, non-interactive version (login background): slow rotation, no labels. */
  ambient?: boolean;
  /** Positioning classes for the canvas wrapper (defaults to full screen). */
  className?: string;
};
type Palette = ReturnType<typeof palette>;
type Uniforms = Record<
  "uTime" | "uFloat" | "uPulse" | "uBreath" | "uHalo" | "uPx" | "uDpr" | "uNebula" | "uLevel",
  { value: number }
>;

const SEGMENTS = 12;
/** Above this many neurons, geometry gets lighter so thousands of notes stay fluid. */
const LARGE_GRAPH = 1500;
const NEAR_LABELS = 10;
const FLOAT = 0.045;

function palette() {
  const css = getComputedStyle(document.documentElement);
  return {
    background: css.getPropertyValue("--graph-background").trim() || "#080a0e",
    edge: css.getPropertyValue("--graph-edge").trim() || "#778391",
    colors: Array.from(
      { length: 6 },
      (_, i) => css.getPropertyValue(`--graph-${i + 1}`).trim() || "#91c9c5",
    ),
  };
}

/** Constellation hue when known, otherwise the theme palette (demo and not-yet-clustered notes). */
function nodeColor(n: GNode, colors: Palette) {
  if (n.hue != null) return new THREE.Color().setHSL(n.hue, 0.78, 0.6);
  return new THREE.Color(colors.colors[((n.cluster % 6) + 6) % 6]);
}

/** Stable pseudo-random phase in [0, 1) from an id, so each neuron floats its own way. */
function phaseOf(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

let sizeScale = 1;
const radiusOf = (n: GNode) => (0.06 + n.weight * 0.12) * sizeScale;

/**
 * 1 for small graphs, down to 0.3 for thousands of neurons: light is additive,
 * so dense graphs need dimmer, smaller glows to stay readable (and cheaper).
 */
function densityOf(count: number) {
  return Math.min(1, Math.max(0.3, Math.sqrt(250 / Math.max(1, count))));
}
const isCoarse = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

export default function GraphScene(props: Props) {
  const colors = useMemo(palette, []);
  const mobile = useMemo(isCoarse, []);
  const [hoverTitle, setHoverTitle] = useState<string | null>(null);
  const density = densityOf(props.data.nodes.length);
  sizeScale = 0.7 + 0.3 * density;
  const labels = useLabels(props.data, props.selectedId);
  const labelEls = useRef<(HTMLDivElement | null)[]>([]);
  const nearEls = useRef<(HTMLDivElement | null)[]>([]);
  return (
    <div
      className={`${props.className ?? "absolute inset-0"}${props.ambient ? " pointer-events-none" : ""}`}
    >
      <Canvas
        dpr={mobile ? [1, 1.5] : [1, 2]}
        frameloop={props.reducedMotion ? "demand" : "always"}
        camera={{ position: [0, 0, 14], fov: 42, near: 0.01, far: 500 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        onPointerMissed={() => !props.ambient && props.onSelect(null)}
      >
        <color attach="background" args={[colors.background]} />
        <Scene {...props} colors={colors} onHoverTitle={setHoverTitle} />
        {!props.ambient && (
          <LabelProjector
            labels={labels}
            elements={labelEls}
            nodes={props.data.nodes}
            selectedId={props.selectedId}
            near={nearEls}
          />
        )}
        <Controls {...props} />
        <EffectComposer multisampling={mobile ? 0 : 4}>
          <Bloom
            mipmapBlur
            intensity={0.95 * (0.45 + 0.55 * density)}
            luminanceThreshold={0.5}
            luminanceSmoothing={0.25}
            radius={0.75}
          />
          <Vignette offset={0.3} darkness={0.72} />
        </EffectComposer>
      </Canvas>
      {!props.ambient && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {Array.from({ length: NEAR_LABELS }, (_, i) => (
            <div
              key={`near${i}`}
              ref={(el) => {
                nearEls.current[i] = el;
              }}
              className="graph-near-label absolute left-0 top-0"
              style={{ opacity: 0 }}
            />
          ))}
          {labels.map((l, i) => (
            <div
              key={l.key}
              ref={(el) => {
                labelEls.current[i] = el;
              }}
              className={
                l.kind === "cluster"
                  ? "graph-cluster-label absolute left-0 top-0"
                  : "graph-label absolute left-0 top-0"
              }
              style={{ opacity: 0, ...(l.color ? { color: l.color } : {}) }}
            >
              {l.text}
            </div>
          ))}
        </div>
      )}
      {!props.ambient && hoverTitle && (
        <div className="pointer-events-none absolute left-1/2 top-36 z-10 max-w-[80%] -translate-x-1/2 rounded-md border border-border bg-panel px-3 py-2 text-xs panel-shadow">
          {hoverTitle}
        </div>
      )}
    </div>
  );
}

function Controls({ data, selectedId, reducedMotion, command, mode, ambient }: Props) {
  const ref = useRef<OrbitControlsType>(null);
  const { camera, size, invalidate } = useThree();
  const destination = useRef<{ target: THREE.Vector3; position: THREE.Vector3 } | null>(null);
  const bounds = useMemo(() => {
    const box = new THREE.Box3();
    data.nodes.forEach((n) => box.expandByPoint(new THREE.Vector3(n.x, n.y, n.z)));
    const center = box.getCenter(new THREE.Vector3());
    const span = box.getSize(new THREE.Vector3());
    const aspect = size.width / size.height;
    // Portrait phones: fill more of the screen instead of fitting the full width with wide margins.
    const fitX = aspect < 0.8 ? 1.4 : 1.6;
    const distance = Math.max(5, span.y * 1.6, (span.x * fitX) / aspect, span.z + 4);
    return { center, distance };
  }, [data.nodes, size.width, size.height]);
  const initial = useRef(false);
  useEffect(() => {
    if (initial.current) return;
    initial.current = true;
    destination.current = {
      target: bounds.center,
      position: bounds.center.clone().add(new THREE.Vector3(0, 0, bounds.distance)),
    };
    invalidate();
  }, [bounds, invalidate]);
  useEffect(() => {
    if (!selectedId || !ref.current) return;
    const node = data.nodes.find((n) => n.id === selectedId);
    if (!node) return;
    const target = new THREE.Vector3(node.x, node.y, node.z);
    const offset = camera.position
      .clone()
      .sub(ref.current.target)
      .normalize()
      .multiplyScalar(Math.max(4, Math.min(8, camera.position.distanceTo(ref.current.target))));
    destination.current = { target, position: target.clone().add(offset) };
    invalidate();
  }, [selectedId, camera, data.nodes, invalidate]);
  useEffect(() => {
    if (!command.tick || !ref.current) return;
    const target = command.action === "reset" ? bounds.center.clone() : ref.current.target.clone();
    const offset =
      command.action === "reset"
        ? new THREE.Vector3(0, 0, bounds.distance)
        : camera.position
            .clone()
            .sub(target)
            .multiplyScalar(command.action === "in" ? 0.75 : 1.35);
    destination.current = { target, position: target.clone().add(offset) };
    invalidate();
  }, [command, bounds, camera, invalidate]);
  useFrame((_, rawDelta) => {
    const controls = ref.current;
    const next = destination.current;
    if (!controls || !next) return;
    const amount = reducedMotion ? 1 : 1 - Math.exp(-9 * Math.min(rawDelta, 0.05));
    controls.target.lerp(next.target, amount);
    camera.position.lerp(next.position, amount);
    controls.update();
    if (
      camera.position.distanceTo(next.position) < 0.005 &&
      controls.target.distanceTo(next.target) < 0.005
    )
      destination.current = null;
    else invalidate();
  });
  if (ambient)
    return (
      <OrbitControls
        ref={ref}
        makeDefault
        enableZoom={false}
        enablePan={false}
        enableRotate={false}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.35}
      />
    );
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      screenSpacePanning
      zoomToCursor
      minDistance={0.8}
      maxDistance={150}
      rotateSpeed={0.55}
      panSpeed={0.8}
      zoomSpeed={0.7}
      mouseButtons={{
        LEFT: mode === "pan" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: mode === "pan" ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
      }}
      touches={{
        ONE: mode === "pan" ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
      onStart={() => {
        destination.current = null;
      }}
    />
  );
}

function Scene(props: Props & { colors: Palette; onHoverTitle: (title: string | null) => void }) {
  const { data, selectedId, highlighted, colors, reducedMotion, ambient } = props;
  const [hover, setHover] = useState<number | null>(null);
  const { size, viewport, camera, invalidate } = useThree();
  const resolution = useMemo(() => ({ value: new THREE.Vector2(1, 1) }), []);
  const uniforms = useMemo<Uniforms>(
    () => ({
      uTime: { value: 0 },
      uFloat: { value: FLOAT },
      uPulse: { value: 1 },
      uBreath: { value: 1 },
      uHalo: { value: 0.5 },
      uPx: { value: 600 },
      uDpr: { value: 1 },
      uNebula: { value: 0.16 },
      uLevel: { value: 1 },
    }),
    [],
  );
  useEffect(() => {
    const density = densityOf(data.nodes.length);
    uniforms.uHalo.value = 0.5 * density;
    uniforms.uLevel.value = 0.35 + 0.65 * density;
    invalidate();
  }, [data.nodes.length, uniforms, invalidate]);
  useEffect(() => {
    uniforms.uFloat.value = reducedMotion ? 0 : FLOAT;
    uniforms.uPulse.value = reducedMotion ? 0 : 1;
    uniforms.uBreath.value = reducedMotion ? 0 : 1;
    invalidate();
  }, [reducedMotion, uniforms, invalidate]);
  useEffect(() => {
    const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
    uniforms.uPx.value = (size.height * viewport.dpr) / (2 * Math.tan(fov / 2));
    uniforms.uDpr.value = viewport.dpr;
    resolution.value.set(size.width / 2, size.height / 2);
    invalidate();
  }, [size.width, size.height, viewport.dpr, camera, uniforms, resolution, invalidate]);
  useFrame((_, delta) => {
    if (!reducedMotion) uniforms.uTime.value += Math.min(delta, 0.05);
  });

  const focus = ambient
    ? -1
    : hover == null
      ? data.nodes.findIndex((n) => n.id === selectedId)
      : hover;
  const active = useMemo(() => {
    const set = new Set<number>();
    if (focus >= 0) {
      set.add(focus);
      data.edges.forEach((e) => {
        if (e.a === focus) set.add(e.b);
        if (e.b === focus) set.add(e.a);
      });
    }
    return set;
  }, [focus, data.edges]);
  const matches = useMemo(() => (highlighted ? new Set(highlighted) : null), [highlighted]);
  const base = useMemo(() => data.nodes.map((n) => nodeColor(n, colors)), [data.nodes, colors]);
  /** Final per-neuron colour, dimmed when something else is in focus. */
  const shaded = useMemo(
    () =>
      base.map((c, i) => {
        const n = data.nodes[i]!;
        const dim = (active.size && !active.has(i)) || (matches && !matches.has(n.id));
        return dim
          ? c.clone().multiplyScalar(0.16)
          : i === focus
            ? c.clone().multiplyScalar(1.5)
            : c;
      }),
    [base, data.nodes, active, matches, focus],
  );
  const phases = useMemo(() => Float32Array.from(data.nodes, (n) => phaseOf(n.id)), [data.nodes]);
  /** Per-synapse state: 0 normal, 1 dimmed, 2 touching the neuron in focus. */
  const edgeState = useMemo(
    () =>
      Uint8Array.from(data.edges, (e) => {
        if (focus >= 0) return e.a === focus || e.b === focus ? 2 : 1;
        if (matches) {
          const a = data.nodes[e.a]?.id,
            b = data.nodes[e.b]?.id;
          return a && b && matches.has(a) && matches.has(b) ? 0 : 1;
        }
        return 0;
      }),
    [data.edges, data.nodes, focus, matches],
  );

  return (
    <group>
      <Dust uniforms={uniforms} animate={!reducedMotion} />
      <Nebulae data={data} uniforms={uniforms} />
      <Synapses
        data={data}
        colors={base}
        state={edgeState}
        phases={phases}
        uniforms={uniforms}
        resolution={resolution}
      />
      <Halos data={data} colors={shaded} phases={phases} uniforms={uniforms} />
      <Neurons
        data={data}
        colors={shaded}
        focus={focus}
        phases={phases}
        uniforms={uniforms}
        interactive={!ambient}
        onHover={(i) => {
          setHover(i);
          props.onHoverTitle(i == null ? null : (data.nodes[i]?.title ?? null));
        }}
        onSelect={props.onSelect}
      />
    </group>
  );
}

function Neurons({
  data,
  colors,
  focus,
  phases,
  uniforms,
  interactive,
  onHover,
  onSelect,
}: {
  data: GraphData;
  colors: THREE.Color[];
  focus: number;
  phases: Float32Array;
  uniforms: Uniforms;
  interactive: boolean;
  onHover: (index: number | null) => void;
  onSelect: (id: string | null) => void;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const geometry = useMemo(() => {
    const light = data.nodes.length > LARGE_GRAPH || isCoarse();
    const g = light ? new THREE.SphereGeometry(1, 18, 12) : new THREE.SphereGeometry(1, 32, 24);
    g.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
    return g;
  }, [phases, data.nodes.length]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: uniforms.uTime, uFloat: uniforms.uFloat, uBreath: uniforms.uBreath },
        vertexShader: NEURON_VERTEX,
        fragmentShader: NEURON_FRAGMENT,
      }),
    [uniforms],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const matrix = new THREE.Matrix4();
    data.nodes.forEach((n, i) => {
      const r = radiusOf(n) * (i === focus ? 1.35 : 1);
      matrix.makeScale(r, r, r).setPosition(n.x, n.y, n.z);
      m.setMatrixAt(i, matrix);
      m.setColorAt(i, colors[i]!);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    invalidate();
  }, [data.nodes, colors, focus, invalidate]);
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, data.nodes.length]}
      frustumCulled={false}
      {...(interactive
        ? {
            onPointerOver: () => {
              document.body.style.cursor = "pointer";
            },
            onPointerOut: () => {
              onHover(null);
              document.body.style.cursor = "auto";
            },
            onPointerMove: (e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              if (e.instanceId != null && e.pointerType === "mouse") onHover(e.instanceId);
            },
            onClick: (e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              const node = e.instanceId == null ? null : data.nodes[e.instanceId];
              if (node && e.delta < 8) onSelect(node.id);
            },
          }
        : {})}
    />
  );
}

/** Soft additive glow around each neuron; bloom does the rest. Colours update in place. */
function Halos({
  data,
  colors,
  phases,
  uniforms,
}: {
  data: GraphData;
  colors: THREE.Color[];
  phases: Float32Array;
  uniforms: Uniforms;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const geometry = useMemo(() => {
    const n = data.nodes.length;
    const pos = new Float32Array(n * 3),
      size = new Float32Array(n);
    data.nodes.forEach((node, i) => {
      pos.set([node.x, node.y, node.z], i * 3);
      size[i] = radiusOf(node) * 7;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    return g;
  }, [data.nodes, phases]);
  useLayoutEffect(() => {
    const attr = geometry.getAttribute("aColor") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    colors.forEach((c, i) => arr.set([c.r, c.g, c.b], i * 3));
    attr.needsUpdate = true;
    invalidate();
  }, [geometry, colors, invalidate]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: uniforms.uTime,
          uFloat: uniforms.uFloat,
          uPx: uniforms.uPx,
          uHalo: uniforms.uHalo,
        },
        vertexShader: HALO_VERTEX,
        fragmentShader: HALO_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/**
 * Curved ribbons with real thickness that follow their neurons and carry pulses.
 * The geometry is built once per graph; focus and search only rewrite `aState`.
 */
function Synapses({
  data,
  colors,
  state,
  phases,
  uniforms,
  resolution,
}: {
  data: GraphData;
  colors: THREE.Color[];
  state: Uint8Array;
  phases: Float32Array;
  uniforms: Uniforms;
  resolution: { value: THREE.Vector2 };
}) {
  const invalidate = useThree((s) => s.invalidate);
  const segments = data.edges.length > 4000 ? 8 : SEGMENTS;
  const perEdge = segments * 4;
  const geometry = useMemo(() => {
    const count = data.edges.length * perEdge;
    const pos = new Float32Array(count * 3),
      a = new Float32Array(count * 3),
      b = new Float32Array(count * 3),
      bend = new Float32Array(count * 3),
      color = new Float32Array(count * 3),
      ph = new Float32Array(count * 2),
      t = new Float32Array(count),
      tn = new Float32Array(count),
      side = new Float32Array(count),
      seed = new Float32Array(count),
      strength = new Float32Array(count),
      st = new Float32Array(count);
    const index = new Uint32Array(data.edges.length * segments * 6);
    const dir = new THREE.Vector3(),
      perp = new THREE.Vector3(),
      perp2 = new THREE.Vector3(),
      up = new THREE.Vector3(0, 1, 0),
      x = new THREE.Vector3(1, 0, 0);
    let v = 0,
      k = 0;
    data.edges.forEach((e, ei) => {
      const na = data.nodes[e.a],
        nb = data.nodes[e.b];
      if (!na || !nb) return;
      dir.set(nb.x - na.x, nb.y - na.y, nb.z - na.z);
      const len = dir.length();
      dir.normalize();
      perp.crossVectors(dir, Math.abs(dir.y) > 0.9 ? x : up).normalize();
      perp2.crossVectors(dir, perp);
      const sd = phaseOf(`${na.id}:${nb.id}`);
      const angle = sd * Math.PI * 2;
      const amount = len * (0.08 + 0.1 * sd);
      const bx = (perp.x * Math.cos(angle) + perp2.x * Math.sin(angle)) * amount;
      const by = (perp.y * Math.cos(angle) + perp2.y * Math.sin(angle)) * amount;
      const bz = (perp.z * Math.cos(angle) + perp2.z * Math.sin(angle)) * amount;
      const c = colors[e.a]!.clone().lerp(colors[e.b]!, 0.5);
      const edgeSeed = (sd * 7.31 + ei * 0.618) % 1;
      for (let i = 0; i < segments; i++) {
        const t0 = i / segments,
          t1 = (i + 1) / segments;
        const first = v;
        for (const [tt, other, sideValue] of [
          [t0, t1, -1],
          [t0, t1, 1],
          [t1, t0, -1],
          [t1, t0, 1],
        ] as const) {
          pos.set(
            [na.x + (nb.x - na.x) * tt, na.y + (nb.y - na.y) * tt, na.z + (nb.z - na.z) * tt],
            v * 3,
          );
          a.set([na.x, na.y, na.z], v * 3);
          b.set([nb.x, nb.y, nb.z], v * 3);
          bend.set([bx, by, bz], v * 3);
          color.set([c.r, c.g, c.b], v * 3);
          ph.set([phases[e.a]!, phases[e.b]!], v * 2);
          t[v] = tt;
          tn[v] = other;
          side[v] = sideValue;
          seed[v] = edgeSeed;
          strength[v] = e.score;
          v++;
        }
        index.set([first, first + 1, first + 2, first + 2, first + 1, first + 3], k);
        k += 6;
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aA", new THREE.BufferAttribute(a, 3));
    g.setAttribute("aB", new THREE.BufferAttribute(b, 3));
    g.setAttribute("aBend", new THREE.BufferAttribute(bend, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    g.setAttribute("aPhases", new THREE.BufferAttribute(ph, 2));
    g.setAttribute("aT", new THREE.BufferAttribute(t, 1));
    g.setAttribute("aTn", new THREE.BufferAttribute(tn, 1));
    g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aStrength", new THREE.BufferAttribute(strength, 1));
    g.setAttribute("aState", new THREE.BufferAttribute(st, 1));
    g.setIndex(new THREE.BufferAttribute(index.subarray(0, k), 1));
    return g;
  }, [data, colors, phases, segments, perEdge]);
  useLayoutEffect(() => {
    const attr = geometry.getAttribute("aState") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let e = 0; e < state.length; e++) arr.fill(state[e]!, e * perEdge, (e + 1) * perEdge);
    attr.needsUpdate = true;
    invalidate();
  }, [geometry, state, perEdge, invalidate]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: uniforms.uTime,
          uFloat: uniforms.uFloat,
          uPulse: uniforms.uPulse,
          uLevel: uniforms.uLevel,
          uDpr: uniforms.uDpr,
          uResolution: resolution,
        },
        vertexShader: SYNAPSE_VERTEX,
        fragmentShader: SYNAPSE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [uniforms, resolution],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

/** One glowing cloud per constellation: the brain reads as nebulae from afar. */
function Nebulae({ data, uniforms }: { data: GraphData; uniforms: Uniforms }) {
  const geometry = useMemo(() => {
    const groups = data.constellations.flatMap((c) => {
      const members = data.nodes.filter((n) => n.cluster === c.id);
      if (members.length < 3) return [];
      const centre = members
        .reduce((s, n) => s.add(new THREE.Vector3(n.x, n.y, n.z)), new THREE.Vector3())
        .divideScalar(members.length);
      const spread = Math.sqrt(
        members.reduce(
          (s, n) => s + centre.distanceToSquared(new THREE.Vector3(n.x, n.y, n.z)),
          0,
        ) / members.length,
      );
      return [
        {
          centre,
          size: Math.max(1.2, spread * 3.2),
          color: new THREE.Color().setHSL(c.hue, 0.7, 0.55),
        },
      ];
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        groups.flatMap((x) => x.centre.toArray()),
        3,
      ),
    );
    g.setAttribute(
      "aSize",
      new THREE.Float32BufferAttribute(
        groups.map((x) => x.size),
        1,
      ),
    );
    g.setAttribute(
      "aColor",
      new THREE.Float32BufferAttribute(
        groups.flatMap((x) => x.color.toArray()),
        3,
      ),
    );
    return g;
  }, [data.constellations, data.nodes]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uPx: uniforms.uPx, uNebula: uniforms.uNebula },
        vertexShader: NEBULA_VERTEX,
        fragmentShader: NEBULA_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={-1} />;
}

/** Faint twinkling dust far behind the brain, for depth. */
function Dust({ uniforms, animate }: { uniforms: Uniforms; animate: boolean }) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => {
    let s = 12345;
    const random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    const n = 1400;
    const pos = new Float32Array(n * 3),
      phase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = 22 + random() * 45,
        th = random() * Math.PI * 2,
        ph = Math.acos(2 * random() - 1);
      pos.set(
        [r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)],
        i * 3,
      );
      phase[i] = random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: uniforms.uTime },
        vertexShader: DUST_VERTEX,
        fragmentShader: DUST_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, delta) => {
    if (animate && group.current) group.current.rotation.y += Math.min(delta, 0.05) * 0.006;
  });
  return (
    <group ref={group}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}

type Label = {
  key: string;
  kind: "cluster" | "node";
  text: string;
  color: string | null;
  position: THREE.Vector3;
};

/** Constellation names (above their group) and the title of the selected neuron. */
function useLabels(data: GraphData, selectedId: string | null): Label[] {
  return useMemo(() => {
    const out: Label[] = data.constellations.flatMap((c) => {
      const members = data.nodes.filter((n) => n.cluster === c.id);
      if (members.length < 2) return [];
      const centre = members
        .reduce((s, n) => s.add(new THREE.Vector3(n.x, n.y, n.z)), new THREE.Vector3())
        .divideScalar(members.length);
      const top = Math.max(...members.map((n) => n.y + radiusOf(n)));
      return [
        {
          key: `c${c.id}`,
          kind: "cluster" as const,
          text: c.label,
          color: `hsl(${Math.round(c.hue * 360)} 80% 80%)`,
          position: centre.setY(top + 0.35),
        },
      ];
    });
    const selected = selectedId ? data.nodes.find((n) => n.id === selectedId) : null;
    if (selected)
      out.push({
        key: `n${selected.id}`,
        kind: "node",
        text: selected.title,
        color: null,
        position: new THREE.Vector3(selected.x, selected.y + radiusOf(selected) + 0.18, selected.z),
      });
    return out;
  }, [data.constellations, data.nodes, selectedId]);
}

const NEAR_DISTANCE = 4.5;

/**
 * Projects label anchors to the screen every frame and moves plain DOM nodes,
 * without React re-renders or extra React roots. Level of detail: constellation
 * names fade out up close, while the titles of the nearest neurons fade in.
 */
function LabelProjector({
  labels,
  elements,
  nodes,
  selectedId,
  near,
}: {
  labels: Label[];
  elements: React.MutableRefObject<(HTMLDivElement | null)[]>;
  nodes: GNode[];
  selectedId: string | null;
  near: React.MutableRefObject<(HTMLDivElement | null)[]>;
}) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  const tick = useRef(0);
  const chosen = useRef<{ index: number; distance: number }[]>([]);
  useFrame(() => {
    labels.forEach((l, i) => {
      const el = elements.current[i];
      if (!el) return;
      v.copy(l.position).project(camera);
      const behind = v.z > 1;
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      const depth = camera.position.distanceTo(l.position);
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      const far = Math.max(0.35, Math.min(0.95, 14 / depth));
      const close = Math.min(1, Math.max(0, (depth - 2.2) / 2.5));
      el.style.opacity = behind ? "0" : l.kind === "node" ? "1" : String(far * close);
    });

    // Every few frames, pick the nearest visible neurons to name.
    if (tick.current++ % 6 === 0) {
      const found: { index: number; distance: number }[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]!;
        if (n.id === selectedId) continue;
        v.set(n.x, n.y, n.z);
        const distance = camera.position.distanceTo(v);
        if (distance > NEAR_DISTANCE) continue;
        v.project(camera);
        if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
        found.push({ index: i, distance });
      }
      chosen.current = found.sort((a, b) => a.distance - b.distance).slice(0, NEAR_LABELS);
    }
    for (let k = 0; k < NEAR_LABELS; k++) {
      const el = near.current[k];
      if (!el) continue;
      const pick = chosen.current[k];
      const n = pick ? nodes[pick.index] : undefined;
      if (!pick || !n) {
        el.style.opacity = "0";
        continue;
      }
      if (el.dataset["id"] !== n.id) {
        el.dataset["id"] = n.id;
        el.textContent = n.title;
      }
      v.set(n.x, n.y - radiusOf(n) - 0.05, n.z).project(camera);
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, 0)`;
      el.style.opacity = String(Math.min(0.9, Math.max(0, (NEAR_DISTANCE - pick.distance) / 1.6)));
    }
  });
  return null;
}
