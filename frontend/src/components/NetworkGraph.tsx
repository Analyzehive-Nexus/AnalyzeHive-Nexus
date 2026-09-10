"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Shield,
  Globe,
  Zap,
  Database,
  AlertTriangle,
  Truck,
} from "lucide-react";
import { palette } from "@/lib/theme";

// Types
export interface Node {
  id: string;
  x: number;
  y: number;
  label: string;
  type: 'internal' | 'competitor' | 'market' | 'threat' | 'supplier';
  status: 'safe' | 'warning' | 'critical' | 'neutral';
  value: number; // Size
  details?: string;
}

export interface Link {
  source: string;
  target: string;
  strength?: number;
  activity?: 'low' | 'medium' | 'high';
}

interface NetworkGraphProps {
  nodes: Node[];
  links: Link[];
  onNodeSelect?: (node: Node | null) => void;
  width?: number;
  height?: number;
  isScanning?: boolean;
}

export default function NetworkGraph({ 
  nodes: initialNodes, 
  links, 
  onNodeSelect,
  width = 800, 
  height = 500,
  isScanning = false
}: NetworkGraphProps) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // Pan offset
  const [scale, setScale] = useState(1); // Zoom scale
  const svgRef = useRef<SVGSVGElement>(null);
  const dragStartPos = useRef<{ x: number, y: number } | null>(null);

  // Icons map
  const getIcon = (type: string) => {
    switch(type) {
      case 'internal': return <Shield className="w-4 h-4" />;
      case 'competitor': return <Globe className="w-4 h-4" />;
      case 'market': return <Database className="w-4 h-4" />;
      case 'threat': return <AlertTriangle className="w-4 h-4" />;
      case 'supplier': return <Truck className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  // Draggable Logic for Nodes
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggingNode(nodeId);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggingNode) {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      
      const x = (e.clientX - svgRect.left - offset.x) / scale;
      const y = (e.clientY - svgRect.top - offset.y) / scale;

      setNodes(prev => prev.map(n => 
        n.id === draggingNode ? { ...n, x, y } : n
      ));
    }
  }, [draggingNode, offset, scale]);

  const handleMouseUp = () => {
    setDraggingNode(null);
  };

  // Pan Logic for Background
  const handlePanStart = (e: React.MouseEvent) => {
    if (draggingNode) return;
    dragStartPos.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handlePanMove = (e: React.MouseEvent) => {
    if (dragStartPos.current && !draggingNode) {
      setOffset({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y
      });
    }
  };

  const handlePanEnd = () => {
    dragStartPos.current = null;
  };

  // Zoom Logic
  //
  // Changing `scale` alone zooms around the SVG's (0,0) corner - at 2x+ that
  // pushes the content (centered around width/2, height/2) mostly or
  // entirely off-screen instead of magnifying what's visible. Keeping the
  // viewport's center point fixed on screen as scale changes is what makes
  // zooming feel like zooming rather than the graph vanishing.
  const applyZoom = useCallback(
    (nextScale: number) => {
      const clamped = Math.min(Math.max(0.5, nextScale), 3);
      const delta = clamped - scale;
      setOffset((prev) => ({
        x: prev.x - (width / 2) * delta,
        y: prev.y - (height / 2) * delta,
      }));
      setScale(clamped);
    },
    [scale, width, height]
  );

  // Attached manually with { passive: false }: React's JSX `onWheel` prop
  // registers a passive listener, so `preventDefault()` inside it is a
  // silent no-op (Chrome logs "Unable to preventDefault inside passive
  // event listener invocation") - the page scrolls underneath the graph
  // instead of the graph zooming.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.001;
      applyZoom(scale - e.deltaY * zoomSpeed);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyZoom, scale]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove]);

  // Color helpers
  const getStatusColor = (status: string) => {
    switch (status) {
        case 'safe': return palette.ok;
        case 'warning': return palette.warn;
        case 'critical': return palette.danger;
        case 'neutral': return palette.faint;
        default: return palette.faint;
    }
  };

  return (
    <div className="w-full h-full relative bg-surface overflow-hidden rounded-xl border border-line">
        
        {/* Controls Overlay */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
            <button onClick={() => applyZoom(scale + 0.2)} className="p-2 bg-sunken text-fg rounded hover:bg-line-strong">+</button>
            <button onClick={() => applyZoom(scale - 0.2)} className="p-2 bg-sunken text-fg rounded hover:bg-line-strong">-</button>
            <button onClick={() => {setScale(1); setOffset({x:0, y:0})}} className="p-2 bg-sunken text-fg rounded hover:bg-line-strong text-xs">Reset</button>
        </div>

        <svg 
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`} 
            className="w-full h-full cursor-move"
            onMouseDown={handlePanStart}
            onMouseMove={handlePanMove}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}
        >
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill={palette.faint} opacity="0.7" />
                </marker>
            </defs>

            {/* Transform Group (Zoom/Pan) */}
            <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
                
                <defs>
                     <linearGradient id="grad-scan" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="transparent" />
                        <stop offset="100%" stopColor={palette.accent} />
                     </linearGradient>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill={palette.faint} opacity="0.7" />
                    </marker>
                </defs>

                {/* Grid Background */}
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke={palette.line} strokeWidth="1"/>
                </pattern>
                <rect width="2000" height="2000" x="-500" y="-500" fill="url(#grid)" />

                {/* Elegant Linear Scan Layer */}
                {isScanning && (
                    <g pointerEvents="none">
                       <defs>
                          <linearGradient id="soft-scan-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                             <stop offset="0%" stopColor={palette.accent} stopOpacity="0" />
                             <stop offset="50%" stopColor={palette.accent} stopOpacity="0.10" />
                             <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
                          </linearGradient>
                       </defs>
                       
                       <g>
                           <animateTransform 
                                attributeName="transform" 
                                type="translate" 
                                from="-1000 0" 
                                to="3000 0" 
                                dur="10s" 
                                repeatCount="indefinite" 
                           />
                           
                           {/* Soft Wide Beam */}
                           <rect x="-150" y="-2000" width="300" height="5000" fill="url(#soft-scan-grad)" />
                           
                           {/* Sharp Center Line - subtle */}
                           <line x1="0" y1="-2000" x2="0" y2="3000" stroke={palette.accent} strokeWidth="1" strokeOpacity="0.35">
                                {/* Optional: Pulse opacity of the line */}
                                <animate attributeName="stroke-opacity" values="0.2;0.45;0.2" dur="2s" repeatCount="indefinite" />
                           </line>
                       </g>
                    </g>
                )}

                {/* Radar Pulse Effect (Centered on first node usually 'You') */}
                {nodes.length > 0 && (
                    <>
                        <circle cx={nodes[0].x} cy={nodes[0].y} r="300" stroke={palette.accentLine} strokeWidth="1" fill="none" />
                        <circle cx={nodes[0].x} cy={nodes[0].y} r="150" stroke={palette.accentLine} strokeWidth="1" fill="none" />
                    </>
                )}

                {/* Links */}
                {links.map((link, i) => {
                    const source = nodes.find(n => n.id === link.source);
                    const target = nodes.find(n => n.id === link.target);
                    if (!source || !target) return null;

                    const isHovered = hoveredNode === source.id || hoveredNode === target.id;
                    const isActive = link.activity === 'high';

                    return (
                        <g key={`${link.source}-${link.target}-${i}`} className="pointer-events-none">
                            <line 
                                x1={source.x} y1={source.y} 
                                x2={target.x} y2={target.y} 
                                stroke={isHovered ? palette.accent : palette.lineStrong}
                                strokeWidth={isHovered ? 2 : 1}
                                strokeOpacity={isHovered ? 0.9 : 1}
                                style={{ transition: "all 0.3s" }}
                            />
                            {/* Animated Particle Packet */}
                            {(isActive || isHovered) && (
                                <circle r="3" fill={palette.accent}>
                                    <animateMotion 
                                        dur={isActive ? "1.5s" : "3s"} 
                                        repeatCount="indefinite"
                                        path={`M${source.x},${source.y} L${target.x},${target.y}`}
                                    />
                                </circle>
                            )}
                        </g>
                    );
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                    const isHovered = hoveredNode === node.id;
                    const isCenter = node.type === 'internal'; // Identify "YOU"
                    const color = getStatusColor(node.status);
                    
                    return (
                        <g 
                            key={node.id} 
                            transform={`translate(${node.x}, ${node.y})`}
                            onMouseEnter={() => setHoveredNode(node.id)}
                            onMouseLeave={() => setHoveredNode(null)}
                            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                            onClick={() => onNodeSelect && onNodeSelect(node)}
                            className="cursor-pointer transition-all duration-300"
                            style={{ opacity: hoveredNode && hoveredNode !== node.id && !links.some(l => (l.source === node.id && l.target === hoveredNode) || (l.target === node.id && l.source === hoveredNode)) ? 0.3 : 1 }}
                        >
                            {/* Soft halo marking the "you" node */}
                            {isCenter && (
                                <circle r={node.value + 30} fill={palette.accent} fillOpacity="0.06" className="animate-pulse">
                                </circle>
                            )}

                            {/* Attention halo - a flat tint rather than a blur, which
                                reads as a smudge on a white ground. */}
                            {(isHovered || node.status === 'critical' || isCenter) && (
                                <circle r={node.value + 15} fill={isCenter ? palette.accent : color} fillOpacity="0.12">
                                    <animate attributeName="r" values={`${node.value + 10};${node.value + 20};${node.value + 10}`} dur="2s" repeatCount="indefinite" />
                                </circle>
                            )}
                            
                            {/* Core Node */}
                            <circle 
                                r={node.value} 
                                fill={palette.surface}
                                stroke={isCenter ? palette.accent : color}
                                strokeWidth={isHovered || isCenter ? 3 : 2}
                                className="transition-all duration-300"
                            />
                            
                            {/* Icon */}
                            <foreignObject x={-10} y={-10} width={20} height={20} className="pointer-events-none flex items-center justify-center text-fg" style={{ overflow: 'visible' }}>
                                <div className="flex items-center justify-center w-full h-full" style={{ color: isCenter ? palette.accent : color }}>
                                    {getIcon(node.type)}
                                </div>
                            </foreignObject>

                            {/* Label */}
                            <text 
                                y={node.value + 15} 
                                textAnchor="middle" 
                                fill={isHovered || isCenter ? palette.fg : palette.subtle}
                                fontSize="12" 
                                fontWeight={isHovered || isCenter ? "bold" : "normal"}
                                className="pointer-events-none select-none"
                            >
                                {node.label}
                            </text>
                            
                            {/* Status Indicator Dot */}
                            {node.status === 'critical' && (
                                <circle cx={node.value * 0.707} cy={-node.value * 0.707} r="4" fill={palette.danger} stroke={palette.surface} strokeWidth="1.5" />
                            )}
                        </g>
                    );
                })}
            </g>
        </svg>
    </div>
  );
}
