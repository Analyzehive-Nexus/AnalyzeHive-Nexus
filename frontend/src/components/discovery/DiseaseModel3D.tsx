"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { palette } from "@/lib/theme";

/* ------------------------------------------------------------------ types */

export interface ModelNode {
  id: string; label: string; kind: string;
  x: number; y: number; z: number;
  radius: number; expression: number;
}
export interface ModelEdge {
  source: string; target: string; kind: string; weight: number;
}

/** Node colour by biological role, so the legend means something. */
const KIND_COLOR: Record<string, string> = {
  receptor: "#0369a1",
  transducer: "#7c3aed",
  enzyme: "#047857",
  kinase: "#b45309",
  metabolite: "#0891b2",
  zymogen: "#4f46e5",
  sensor: "#be123c",
  adaptor: "#9333ea",
  output: "#b91c1c",
};
export const kindColor = (kind: string) => KIND_COLOR[kind] ?? "#475569";

/* ------------------------------------------------------------- primitives */

function Node({
  node,
  hovered,
  dimmed,
  onHover,
  onSelect,
}: {
  node: ModelNode;
  hovered: boolean;
  dimmed: boolean;
  onHover: (id: string | null) => void;
  onSelect: (n: ModelNode) => void;
}) {
  const mesh = useRef<THREE.Mesh>(null);

  // Expression level drives a slow breathing scale, so a highly expressed
  // node reads as "active" without needing a separate legend.
  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 1.2 + node.x) * 0.03 * node.expression;
    const target = hovered ? 1.25 : pulse;
    mesh.current.scale.lerp(new THREE.Vector3(target, target, target), 0.15);
  });

  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh
        ref={mesh}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(node.id); }}
        onPointerOut={() => onHover(null)}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(node); }}
      >
        <sphereGeometry args={[node.radius, 32, 32]} />
        <meshStandardMaterial
          color={kindColor(node.kind)}
          roughness={0.35}
          metalness={0.1}
          transparent
          opacity={dimmed ? 0.25 : 1}
          emissive={kindColor(node.kind)}
          emissiveIntensity={hovered ? 0.45 : 0.12}
        />
      </mesh>

      {/* Labels are DOM, not textures - they stay crisp at any zoom. */}
      <Html
        center
        distanceFactor={9}
        position={[0, node.radius + 0.32, 0]}
        style={{ pointerEvents: "none" }}
      >
        <span
          className="whitespace-nowrap rounded px-1 text-[11px] font-medium"
          style={{
            color: hovered ? palette.fg : palette.muted,
            opacity: dimmed ? 0.3 : 1,
            background: hovered ? "rgba(255,255,255,0.92)" : "transparent",
          }}
        >
          {node.label}
        </span>
      </Html>
    </group>
  );
}

function Edges({
  nodes,
  edges,
  hoveredId,
}: {
  nodes: ModelNode[];
  edges: ModelEdge[];
  hoveredId: string | null;
}) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <>
      {edges.map((e, i) => {
        const a = byId.get(e.source);
        const b = byId.get(e.target);
        if (!a || !b) return null;
        const touched = hoveredId === e.source || hoveredId === e.target;
        // Inhibitory edges are visually distinct from activating ones - the
        // direction of an interaction is the whole point of a pathway map.
        const inhibitory = e.kind === "inhibits";
        return (
          <Line
            key={`${e.source}-${e.target}-${i}`}
            points={[[a.x, a.y, a.z], [b.x, b.y, b.z]]}
            color={touched ? palette.accent : inhibitory ? palette.danger : palette.lineStrong}
            lineWidth={touched ? 2.4 : 1 + e.weight}
            dashed={inhibitory}
            dashSize={0.18}
            gapSize={0.12}
            transparent
            opacity={hoveredId && !touched ? 0.2 : 0.85}
          />
        );
      })}
    </>
  );
}

/* ----------------------------------------------------------------- viewer */

export default function DiseaseModel3D({
  nodes,
  edges,
  onSelect,
}: {
  nodes: ModelNode[];
  edges: ModelEdge[];
  onSelect?: (n: ModelNode | null) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Neighbours of the hovered node stay lit; everything else dims, which is
  // what makes a dense pathway readable.
  const neighbours = useMemo(() => {
    if (!hoveredId) return null;
    const set = new Set<string>([hoveredId]);
    for (const e of edges) {
      if (e.source === hoveredId) set.add(e.target);
      if (e.target === hoveredId) set.add(e.source);
    }
    return set;
  }, [hoveredId, edges]);

  return (
    <Canvas
      camera={{ position: [0, 2.5, 11], fov: 45 }}
      dpr={[1, 2]}
      // Match the surrounding panel so the canvas does not read as a hole.
      onCreated={({ gl }) => gl.setClearColor(palette.surface)}
      onPointerMissed={() => onSelect?.(null)}
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[6, 8, 6]} intensity={1.1} />
      <directionalLight position={[-6, -4, -6]} intensity={0.35} />

      <Edges nodes={nodes} edges={edges} hoveredId={hoveredId} />

      {nodes.map((n) => (
        <Node
          key={n.id}
          node={n}
          hovered={hoveredId === n.id}
          dimmed={Boolean(neighbours) && !neighbours!.has(n.id)}
          onHover={setHoveredId}
          onSelect={(node) => onSelect?.(node)}
        />
      ))}

      <OrbitControls
        enablePan
        enableZoom
        minDistance={4}
        maxDistance={24}
        autoRotate={!hoveredId}
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
}
