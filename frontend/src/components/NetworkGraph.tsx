"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Shield, 
  Globe, 
  Zap, 
  Server, 
  Database, 
  Smartphone,
  AlertTriangle,
  Radio
} from "lucide-react";

// Types
export interface Node {
  id: string;
  x: number;
  y: number;
  label: string;
  type: 'internal' | 'competitor' | 'market' | 'threat';
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
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSpeed = 0.001;
    const newScale = Math.min(Math.max(0.5, scale - e.deltaY * zoomSpeed), 3);
    setScale(newScale);
  };

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
        case 'safe': return '#4ade80'; // green-400
        case 'warning': return '#fbbf24'; // amber-400
        case 'critical': return '#f87171'; // red-400
        case 'neutral': return '#94a3b8'; // slate-400
        default: return '#94a3b8';
    }
  };

  return (
    <div className="w-full h-full relative bg-[#0b0f14] overflow-hidden rounded-xl border border-[#1e293b]">
        
        {/* Controls Overlay */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
            <button onClick={() => setScale(s => Math.min(s + 0.2, 3))} className="p-2 bg-[#1e293b]/80 text-white rounded hover:bg-[#334155]">+</button>
            <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-2 bg-[#1e293b]/80 text-white rounded hover:bg-[#334155]">-</button>
            <button onClick={() => {setScale(1); setOffset({x:0, y:0})}} className="p-2 bg-[#1e293b]/80 text-white rounded hover:bg-[#334155] text-xs">Reset</button>
        </div>

        <svg 
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`} 
            className="w-full h-full cursor-move"
            onMouseDown={handlePanStart}
            onMouseMove={handlePanMove}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}
            onWheel={handleWheel}
        >
            <defs>
                <filter id="glow-node">
                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" opacity="0.5" />
                </marker>
            </defs>

            {/* Transform Group (Zoom/Pan) */}
            <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
                
                <defs>
                     <linearGradient id="grad-scan" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="transparent" />
                        <stop offset="100%" stopColor="#7cff4e" />
                     </linearGradient>
                     <filter id="glow-node">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" opacity="0.5" />
                    </marker>
                    <style>
                        {`
                           /* Linear scan animations handled via SVG animate tags */
                        `}
                    </style>
                </defs>

                {/* Grid Background */}
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" opacity="0.3"/>
                </pattern>
                <rect width="2000" height="2000" x="-500" y="-500" fill="url(#grid)" />

                {/* Elegant Linear Scan Layer */}
                {isScanning && (
                    <g pointerEvents="none">
                       <defs>
                          <linearGradient id="soft-scan-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                             <stop offset="0%" stopColor="#7cff4e" stopOpacity="0" />
                             <stop offset="50%" stopColor="#7cff4e" stopOpacity="0.15" />
                             <stop offset="100%" stopColor="#7cff4e" stopOpacity="0" />
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
                           <line x1="0" y1="-2000" x2="0" y2="3000" stroke="#7cff4e" strokeWidth="1" strokeOpacity="0.5">
                                {/* Optional: Pulse opacity of the line */}
                                <animate attributeName="stroke-opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
                           </line>
                       </g>
                    </g>
                )}

                {/* Radar Pulse Effect (Centered on first node usually 'You') */}
                {nodes.length > 0 && (
                    <>
                        <circle cx={nodes[0].x} cy={nodes[0].y} r="300" stroke="#7cff4e" strokeWidth="1" strokeOpacity="0.05" fill="none" />
                        <circle cx={nodes[0].x} cy={nodes[0].y} r="150" stroke="#7cff4e" strokeWidth="1" strokeOpacity="0.1" fill="none" />
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
                                stroke={isHovered ? "#7cff4e" : "#334155"} 
                                strokeWidth={isHovered ? 2 : 1}
                                strokeOpacity={isHovered ? 0.8 : 0.4}
                                style={{ transition: "all 0.3s" }}
                            />
                            {/* Animated Particle Packet */}
                            {(isActive || isHovered) && (
                                <circle r="3" fill="#7cff4e">
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
                    const isSelected = false; // Can implement selection state
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
                            {/* Extra Glow for Center Node */}
                            {isCenter && (
                                <circle r={node.value + 30} fill="#7cff4e" fillOpacity="0.05" className="animate-pulse">
                                </circle>
                            )}

                            {/* Glow */}
                            {(isHovered || node.status === 'critical' || isCenter) && (
                                <circle r={node.value + 15} fill={isCenter ? '#7cff4e' : color} fillOpacity="0.1" filter="url(#glow-node)">
                                    <animate attributeName="r" values={`${node.value + 10};${node.value + 20};${node.value + 10}`} dur="2s" repeatCount="indefinite" />
                                </circle>
                            )}
                            
                            {/* Core Node */}
                            <circle 
                                r={node.value} 
                                fill="#0f141b" 
                                stroke={isCenter ? '#7cff4e' : color} 
                                strokeWidth={isHovered || isCenter ? 3 : 2}
                                className="transition-all duration-300"
                            />
                            
                            {/* Icon */}
                            <foreignObject x={-10} y={-10} width={20} height={20} className="pointer-events-none flex items-center justify-center text-white" style={{ overflow: 'visible' }}>
                                <div className={`flex items-center justify-center w-full h-full text-${isCenter ? '[#7cff4e]' : node.status === 'safe' ? 'green-400' : node.status === 'critical' ? 'red-400' : 'slate-400'}`}>
                                    {getIcon(node.type)}
                                </div>
                            </foreignObject>

                            {/* Label */}
                            <text 
                                y={node.value + 15} 
                                textAnchor="middle" 
                                fill={isHovered || isCenter ? "#fff" : "#94a3b8"} 
                                fontSize="12" 
                                fontWeight={isHovered || isCenter ? "bold" : "normal"}
                                className="pointer-events-none select-none"
                            >
                                {node.label}
                            </text>
                            
                            {/* Status Indicator Dot */}
                            {node.status === 'critical' && (
                                <circle cx={node.value * 0.707} cy={-node.value * 0.707} r="4" fill="#f87171" stroke="#0f141b" strokeWidth="1" />
                            )}
                        </g>
                    );
                })}
            </g>
        </svg>
    </div>
  );
}
