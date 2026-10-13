import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html, Environment, Lightformer } from "@react-three/drei";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { GraphData } from "./data";

export type QualityLevel = 0 | 1 | 2 | 3;
export type ViewCommand = { action: "reset" | "in" | "out"; tick: number };
type Props = { data: GraphData; quality: QualityLevel; reducedMotion: boolean; selectedId: string | null; onSelect: (id: string | null) => void; command: ViewCommand; mode: "pan" | "orbit"; highlighted: string[] | null };

function palette() {
  const css = getComputedStyle(document.documentElement);
  return { background: css.getPropertyValue("--graph-background").trim(), edge: css.getPropertyValue("--graph-edge").trim(), light: css.getPropertyValue("--graph-light").trim(), colors: Array.from({ length: 6 }, (_, i) => css.getPropertyValue(`--graph-${i + 1}`).trim()) };
}

export default function GraphScene(props: Props) {
  const colors = useMemo(palette, []);
  return <Canvas dpr={props.quality === 2 ? [1, 1.5] : [1, 2]} frameloop="demand" camera={{ position: [0, 0, 14], fov: 42, near: 0.01, far: 500 }} gl={{ antialias: true, powerPreference: "high-performance" }} onPointerMissed={() => props.onSelect(null)}>
    <color attach="background" args={[colors.background]} />
    <ambientLight intensity={0.9} />
    <directionalLight position={[5, 8, 10]} intensity={2.2} color={colors.light} />
    <Environment resolution={64}><Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} /><Lightformer intensity={1.5} color={colors.colors[0] ?? colors.light} position={[-5, 1, 3]} rotation-y={Math.PI / 2} scale={[8, 8, 1]} /></Environment>
    <Brain {...props} colors={colors} />
    <Controls {...props} />
  </Canvas>;
}

function Controls({ data, selectedId, reducedMotion, command, mode }: Props) {
  const ref = useRef<OrbitControlsType>(null);
  const { camera, size, invalidate } = useThree();
  const destination = useRef<{ target: THREE.Vector3; position: THREE.Vector3 } | null>(null);
  const bounds = useMemo(() => {
    const box = new THREE.Box3();
    data.nodes.forEach(n => box.expandByPoint(new THREE.Vector3(n.x, n.y, n.z)));
    const center = box.getCenter(new THREE.Vector3());
    const span = box.getSize(new THREE.Vector3());
    const distance = Math.max(5, span.y * 1.6, span.x * 1.6 / (size.width / size.height), span.z + 4);
    return { center, distance };
  }, [data.nodes, size.width, size.height]);
  const initial = useRef(false);
  useEffect(() => {
    if (initial.current) return;
    initial.current = true;
    destination.current = { target: bounds.center, position: bounds.center.clone().add(new THREE.Vector3(0, 0, bounds.distance)) };
    invalidate();
  }, [bounds, invalidate]);
  useEffect(() => {
    if (!selectedId || !ref.current) return;
    const node = data.nodes.find(n => n.id === selectedId);
    if (!node) return;
    const target = new THREE.Vector3(node.x, node.y, node.z);
    const offset = camera.position.clone().sub(ref.current.target).normalize().multiplyScalar(Math.max(4, Math.min(8, camera.position.distanceTo(ref.current.target))));
    destination.current = { target, position: target.clone().add(offset) };
    invalidate();
  }, [selectedId, camera, data.nodes, invalidate]);
  useEffect(() => {
    if (!command.tick || !ref.current) return;
    const target = command.action === "reset" ? bounds.center.clone() : ref.current.target.clone();
    const offset = command.action === "reset" ? new THREE.Vector3(0, 0, bounds.distance) : camera.position.clone().sub(target).multiplyScalar(command.action === "in" ? 0.75 : 1.35);
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
    if (camera.position.distanceTo(next.position) < 0.005 && controls.target.distanceTo(next.target) < 0.005) destination.current = null;
    else invalidate();
  });
  return <OrbitControls ref={ref} makeDefault enableDamping dampingFactor={0.12} screenSpacePanning zoomToCursor minDistance={0.8} maxDistance={150} rotateSpeed={0.55} panSpeed={0.8} zoomSpeed={0.7} mouseButtons={{ LEFT: mode === "pan" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: mode === "pan" ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN }} touches={{ ONE: mode === "pan" ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }} onStart={() => { destination.current = null; }} />;
}

function Brain({ data, selectedId, onSelect, highlighted, colors }: Props & { colors: ReturnType<typeof palette> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const [hover, setHover] = useState<number | null>(null);
  const invalidate = useThree(s => s.invalidate);
  const focus = hover == null ? data.nodes.findIndex(n => n.id === selectedId) : hover;
  const active = useMemo(() => {
    const set = new Set<number>();
    if (focus >= 0) { set.add(focus); data.edges.forEach(e => { if (e.a === focus) set.add(e.b); if (e.b === focus) set.add(e.a); }); }
    return set;
  }, [focus, data.edges]);
  const matches = useMemo(() => highlighted ? new Set(highlighted) : null, [highlighted]);
  useEffect(() => {
    if (!mesh.current) return;
    const matrix = new THREE.Matrix4();
    data.nodes.forEach((n, i) => {
      const radius = (0.055 + n.weight * 0.1) * (i === focus ? 1.4 : 1);
      matrix.makeScale(radius, radius, radius).setPosition(n.x, n.y, n.z);
      mesh.current?.setMatrixAt(i, matrix);
      const color = new THREE.Color(colors.colors[((n.cluster % 6) + 6) % 6]);
      if ((active.size && !active.has(i)) || (matches && !matches.has(n.id))) color.multiplyScalar(0.24);
      mesh.current?.setColorAt(i, color);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
    invalidate();
  }, [data.nodes, colors, focus, active, matches, invalidate]);
  const geometry = useMemo(() => {
    const positions: number[] = [], shades: number[] = [];
    data.edges.forEach(e => {
      const a = data.nodes[e.a], b = data.nodes[e.b];
      if (!a || !b) return;
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const color = new THREE.Color(focus >= 0 && (e.a === focus || e.b === focus) ? colors.colors[((a.cluster % 6) + 6) % 6] : colors.edge);
      color.multiplyScalar(focus >= 0 && e.a !== focus && e.b !== focus ? 0.12 : 0.45 + e.score * 0.4);
      color.toArray(shades, shades.length); color.toArray(shades, shades.length);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(shades, 3));
    return geo;
  }, [data, colors, focus]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const focusedNode = focus >= 0 ? data.nodes[focus] : undefined;
  return <group>
    <lineSegments geometry={geometry}><lineBasicMaterial vertexColors transparent opacity={0.6} /></lineSegments>
    <instancedMesh ref={mesh} args={[undefined, undefined, data.nodes.length]} frustumCulled={false} onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHover(null); document.body.style.cursor = "auto"; }} onPointerMove={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); if (e.instanceId != null) setHover(e.instanceId); }} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); const node = e.instanceId == null ? null : data.nodes[e.instanceId]; if (node && e.delta < 5) onSelect(node.id); }}>
      <sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial roughness={0.24} metalness={0.35} />
    </instancedMesh>
    <Html position={focusedNode ? [focusedNode.x, focusedNode.y + 0.22, focusedNode.z] : [0, 0, 0]} center zIndexRange={[8, 0]}>{focusedNode && <div className="graph-label">{focusedNode.title}</div>}</Html>
  </group>;
}
