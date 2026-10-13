import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { GraphData } from "./data";

export type QualityLevel = 0 | 1 | 2 | 3; // 0 alta, 1 senza impulsi, 2 senza bloom, 3 pixel ratio ridotto

const DRIFT_GLSL = /* glsl */ `
uniform float uTime; uniform float uDrift;
vec3 drift(float s){
  return vec3(sin(uTime*0.11+s*6.2831), sin(uTime*0.093+s*12.13), cos(uTime*0.071+s*3.71)) * 0.15 * uDrift;
}`;

export function clusterColor(cluster: number, weight = 0.5) {
  const h = (cluster * 0.61803 + 0.08) % 1;
  const c = new THREE.Color().setHSL(h, 0.5, 0.6);
  // warm the tone and brighten heavier nodes
  c.lerp(new THREE.Color(1, 0.86, 0.66), 0.25);
  return c.multiplyScalar(0.7 + weight * 0.6);
}

type Props = {
  data: GraphData;
  quality: QualityLevel;
  reducedMotion: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onFps: (fps: number) => void;
};

export default function GraphScene(props: Props) {
  const [idle, setIdle] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 60000);
    };
    const vis = () => setHidden(document.hidden);
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("wheel", wake);
    window.addEventListener("keydown", wake);
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("wheel", wake);
      window.removeEventListener("keydown", wake);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const dpr: [number, number] = props.quality >= 3 ? [0.6, 0.75] : props.quality === 2 ? [1, 1] : [1, 2];
  const frameloop = hidden ? "never" : idle ? "demand" : "always";

  return (
    <Canvas
      dpr={dpr}
      frameloop={frameloop}
      camera={{ position: [0, 0, 11], fov: 55, near: 0.1, far: 200 }}
      gl={{ antialias: props.quality < 2, powerPreference: "high-performance", alpha: false }}
      onPointerMissed={() => props.onSelect(null)}
    >
      <color attach="background" args={["#000000"]} />
      {idle && !hidden && <IdleTicker />}
      <Brain {...props} />
      <Controls selectedId={props.selectedId} data={props.data} reducedMotion={props.reducedMotion} />
      <FpsMonitor onFps={props.onFps} />
      {props.quality < 2 && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.8} luminanceThreshold={0.2} luminanceSmoothing={0.3} mipmapBlur />
        </EffectComposer>
      )}
    </Canvas>
  );
}

function IdleTicker() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const i = setInterval(() => invalidate(), 1000 / 15);
    return () => clearInterval(i);
  }, [invalidate]);
  return null;
}

function FpsMonitor({ onFps }: { onFps: (fps: number) => void }) {
  const acc = useRef({ frames: 0, start: 0 });
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!acc.current.start) acc.current.start = t;
    acc.current.frames++;
    const dt = t - acc.current.start;
    if (dt >= 3) {
      onFps(acc.current.frames / dt);
      acc.current = { frames: 0, start: t };
    }
  });
  return null;
}

function Controls({
  selectedId,
  data,
  reducedMotion,
}: {
  selectedId: string | null;
  data: GraphData;
  reducedMotion: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null);
  const lastInteract = useRef(performance.now());
  const target = useRef(new THREE.Vector3());
  useEffect(() => {
    const n = data.nodes.find((x) => x.id === selectedId);
    target.current.set(n?.x ?? 0, n?.y ?? 0, n?.z ?? 0);
  }, [selectedId, data]);
  useFrame(() => {
    const c = ref.current;
    if (!c) return;
    c.target.lerp(target.current, 0.06);
    c.autoRotate = !reducedMotion && performance.now() - lastInteract.current > 10000;
    c.update();
  });
  return (
    <OrbitControls
      ref={ref}
      enableDamping
      dampingFactor={0.08}
      minDistance={1.5}
      maxDistance={30}
      autoRotateSpeed={0.15}
      onStart={() => (lastInteract.current = performance.now())}
      onEnd={() => (lastInteract.current = performance.now())}
    />
  );
}

function Brain({ data, quality, reducedMotion, selectedId, onSelect }: Props) {
  const { nodes, edges } = data;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hover, setHover] = useState<number | null>(null);

  const neighbors = useMemo(() => {
    const adj: number[][] = nodes.map(() => []);
    for (const e of edges) {
      adj[e.a]!.push(e.b);
      adj[e.b]!.push(e.a);
    }
    return adj;
  }, [nodes, edges]);

  const seeds = useMemo(() => {
    const s = new Float32Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) s[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1 + 0.5;
    return s;
  }, [nodes]);

  // ----- Nodes -----
  const nodeGeo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 1) as THREE.BufferGeometry;
    const colors = new Float32Array(nodes.length * 3);
    const weights = new Float32Array(nodes.length);
    nodes.forEach((n, i) => {
      clusterColor(n.cluster, n.weight).toArray(colors, i * 3);
      weights[i] = n.weight;
    });
    g.setAttribute("aColor", new THREE.InstancedBufferAttribute(colors, 3));
    g.setAttribute("aWeight", new THREE.InstancedBufferAttribute(weights, 1));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    g.setAttribute("aDim", new THREE.InstancedBufferAttribute(new Float32Array(nodes.length).fill(1), 1));
    g.setAttribute("aBoost", new THREE.InstancedBufferAttribute(new Float32Array(nodes.length), 1));
    return g;
  }, [nodes, seeds]);

  const nodeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uDrift: { value: 1 }, uPulse: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute vec3 aColor; attribute float aWeight; attribute float aSeed; attribute float aDim; attribute float aBoost;
          uniform float uPulse;
          varying vec3 vColor; varying float vI; varying vec3 vN;
          ${DRIFT_GLSL}
          void main(){
            float freq = 0.2 + 0.4 * fract(aSeed * 7.13);
            float p = 1.0 + uPulse * 0.15 * sin(6.2831 * freq * uTime + aSeed * 40.0);
            vI = (0.6 + 0.9 * aWeight) * p * aDim + aBoost * 1.6;
            vColor = aColor;
            vec4 wp = instanceMatrix * vec4(position * (1.0 + aBoost * 0.35), 1.0);
            wp.xyz += drift(aSeed);
            vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vColor; varying float vI; varying vec3 vN;
          void main(){
            float core = pow(abs(vN.z), 1.5);
            vec3 c = vColor * vI * (0.55 + 0.9 * core);
            gl_FragColor = vec4(c, 1.0);
          }`,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    const m = meshRef.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    nodes.forEach((n, i) => {
      const r = 0.04 + 0.16 * Math.pow(n.weight, 0.7);
      mat.makeScale(r, r, r).setPosition(n.x, n.y, n.z);
      m.setMatrixAt(i, mat);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [nodes]);

  // ----- Edges -----
  const edgeGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = edges.length * 2;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const alpha = new Float32Array(n);
    const seed = new Float32Array(n);
    const t = new Float32Array(n);
    const eSeed = new Float32Array(n);
    const KIND_TINT: Record<string, THREE.Color> = {
      semantic: new THREE.Color(1, 0.9, 0.75),
      tag: new THREE.Color(0.75, 0.9, 1),
      entity: new THREE.Color(0.9, 0.8, 1),
      source: new THREE.Color(0.8, 1, 0.85),
    };
    edges.forEach((e, i) => {
      const A = nodes[e.a]!;
      const B = nodes[e.b]!;
      const tint = KIND_TINT[e.kind] ?? KIND_TINT["semantic"]!;
      const ca = clusterColor(A.cluster, 0.4).lerp(tint, 0.5);
      const cb = clusterColor(B.cluster, 0.4).lerp(tint, 0.5);
      pos.set([A.x, A.y, A.z, B.x, B.y, B.z], i * 6);
      ca.toArray(col, i * 6);
      cb.toArray(col, i * 6 + 3);
      alpha[i * 2] = alpha[i * 2 + 1] = 0.05 + 0.3 * e.score;
      seed[i * 2] = seeds[e.a]!;
      seed[i * 2 + 1] = seeds[e.b]!;
      t[i * 2] = 0;
      t[i * 2 + 1] = 1;
      eSeed[i * 2] = eSeed[i * 2 + 1] = ((Math.sin(i * 78.233) * 43758.5453) % 1 + 1) % 1;
    });
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aT", new THREE.BufferAttribute(t, 1));
    g.setAttribute("aEdge", new THREE.BufferAttribute(eSeed, 1));
    g.setAttribute("aDim", new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
    return g;
  }, [edges, nodes, seeds]);

  const edgeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uDrift: { value: 1 }, uPulses: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute vec3 aColor; attribute float aAlpha; attribute float aSeed; attribute float aT; attribute float aEdge; attribute float aDim;
          varying vec3 vColor; varying float vAlpha; varying float vT; varying float vEdge;
          ${DRIFT_GLSL}
          void main(){
            vColor = aColor; vAlpha = aAlpha * aDim; vT = aT; vEdge = aEdge;
            vec3 p = position + drift(aSeed);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform float uPulses;
          varying vec3 vColor; varying float vAlpha; varying float vT; varying float vEdge;
          void main(){
            float g = 0.0;
            if (uPulses > 0.5 && fract(vEdge * 13.7) < 0.07) {
              float d = fract(uTime * (0.15 + 0.2 * vEdge) + vEdge);
              g = smoothstep(0.07, 0.0, abs(vT - d));
            }
            gl_FragColor = vec4(vColor * (1.0 + g * 2.5), vAlpha + g * 0.7);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  // ----- Hover / selection dimming -----
  useEffect(() => {
    const focus = hover ?? (selectedId ? nodes.findIndex((n) => n.id === selectedId) : -1);
    const nd = nodeGeo.getAttribute("aDim") as THREE.InstancedBufferAttribute;
    const ed = edgeGeo.getAttribute("aDim") as THREE.BufferAttribute;
    if (focus == null || focus < 0) {
      (nd.array as Float32Array).fill(1);
      (ed.array as Float32Array).fill(1);
    } else {
      const set = new Set([focus, ...neighbors[focus]!]);
      for (let i = 0; i < nodes.length; i++) (nd.array as Float32Array)[i] = set.has(i) ? 1.15 : 0.15;
      edges.forEach((e, i) => {
        const on = e.a === focus || e.b === focus;
        (ed.array as Float32Array)[i * 2] = (ed.array as Float32Array)[i * 2 + 1] = on ? 3 : 0.15;
      });
    }
    nd.needsUpdate = true;
    ed.needsUpdate = true;
  }, [hover, selectedId, nodes, edges, neighbors, nodeGeo, edgeGeo]);

  // ----- Animation: time, random strong pulse propagating to neighbours -----
  const boostStart = useMemo(() => new Float32Array(nodes.length).fill(-100), [nodes]);
  const nextBurst = useRef(2);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    nodeMat.uniforms.uTime.value = t;
    edgeMat.uniforms.uTime.value = t;
    nodeMat.uniforms.uDrift.value = reducedMotion ? 0 : 1;
    edgeMat.uniforms.uDrift.value = reducedMotion ? 0 : 1;
    nodeMat.uniforms.uPulse.value = reducedMotion ? 0 : 1;
    edgeMat.uniforms.uPulses.value = reducedMotion || quality >= 1 ? 0 : 1;
    if (reducedMotion || !nodes.length) return;

    if (t > nextBurst.current) {
      nextBurst.current = t + 2 + Math.random();
      const i = Math.floor(Math.random() * nodes.length);
      boostStart[i] = t;
      const A = nodes[i]!;
      for (const j of neighbors[i]!) {
        const B = nodes[j]!;
        const d = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
        boostStart[j] = Math.max(boostStart[j]!, t + 0.25 + d * 0.35);
      }
    }
    const attr = nodeGeo.getAttribute("aBoost") as THREE.InstancedBufferAttribute;
    const arr = attr.array as Float32Array;
    let changed = false;
    for (let i = 0; i < arr.length; i++) {
      const dt = t - boostStart[i]!;
      const v = dt < 0 || dt > 1.5 ? 0 : Math.exp(-Math.pow((dt - 0.25) / 0.3, 2)) * (boostStart[i] === t ? 1 : 0.8);
      if (v !== arr[i]) {
        arr[i] = v;
        changed = true;
      }
    }
    if (changed) attr.needsUpdate = true;
  });

  const hovered = hover != null ? (nodes[hover] ?? null) : null;

  return (
    <group>
      <Nebulae data={data} />
      <lineSegments geometry={edgeGeo} material={edgeMat} frustumCulled={false} />
      <instancedMesh
        ref={meshRef}
        args={[nodeGeo, nodeMat, nodes.length]}
        frustumCulled={false}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          if (e.instanceId != null && e.instanceId !== hover) setHover(e.instanceId);
        }}
        onPointerOut={() => setHover(null)}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.instanceId != null) onSelect(nodes[e.instanceId]!.id);
        }}
      />
      {hovered && (
        <Html position={[hovered.x, hovered.y, hovered.z]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
          <div className="glass -translate-y-6 whitespace-nowrap rounded-md px-2.5 py-1 text-xs text-foreground">
            {hovered.title}
          </div>
        </Html>
      )}
    </group>
  );
}

function Nebulae({ data }: { data: GraphData }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);

  const clouds = useMemo(() => {
    const by = new Map<number, { x: number; y: number; z: number; n: number; pts: number[][] }>();
    for (const n of data.nodes) {
      const c = by.get(n.cluster) ?? { x: 0, y: 0, z: 0, n: 0, pts: [] };
      c.x += n.x;
      c.y += n.y;
      c.z += n.z;
      c.n++;
      c.pts.push([n.x, n.y, n.z]);
      by.set(n.cluster, c);
    }
    return [...by.entries()]
      .filter(([, c]) => c.n >= 3)
      .map(([cluster, c]) => {
        const cx = c.x / c.n,
          cy = c.y / c.n,
          cz = c.z / c.n;
        let v = 0;
        for (const p of c.pts) v += (p[0] - cx) ** 2 + (p[1] - cy) ** 2 + (p[2] - cz) ** 2;
        const sd = Math.sqrt(v / c.n);
        return { cluster, pos: [cx, cy, cz] as [number, number, number], size: Math.max(1.2, sd * 3) };
      });
  }, [data.nodes]);

  return (
    <group>
      {clouds.map((c) => (
        <sprite key={c.cluster} position={c.pos} scale={[c.size, c.size, 1]}>
          <spriteMaterial
            map={texture}
            color={clusterColor(c.cluster, 0.3)}
            transparent
            opacity={0.09}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
}
