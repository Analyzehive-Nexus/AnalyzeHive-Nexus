"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  MessageCircle,
  Globe,
  Share2,
  TrendingUp,
  Zap,
  Search,
  Target,
  Radio,
  ExternalLink,
  Radar,
  ShieldCheck,
  ChevronRight,
  X
} from "lucide-react";
import NetworkGraph, { Node, Link } from "../../components/NetworkGraph";
import { api } from "@/lib/api";

/* ------------------ DATA ------------------ */

interface Signal {
  id: number;
  source: string;
  time: string;
  title: string;
  sentiment: string;
  impact: string;
}

const sourceIcons: Record<string, typeof Activity> = {
  PubMed: Activity,
  "Twitter/X": MessageCircle,
  "News Alert": Globe,
  LinkedIn: Share2,
  MarketWatch: TrendingUp,
  Regulatory: ShieldCheck,
};

const stats = [
  { label: "Active Signals", value: "127", trend: "+23 today", trendColor: "text-green-400", chart: [20, 35, 25, 45, 30, 60, 50, 75, 65, 80] },
  { label: "Competitor Campaigns", value: "8", trend: "5 new", trendColor: "text-green-400", chart: [10, 15, 12, 18, 20, 25, 22, 30, 28, 35] },
  { label: "Market Share \u0394", value: "-0.3%", trend: "This quarter", trendColor: "text-red-400", chart: [60, 58, 55, 53, 50, 48, 45, 42, 40, 38] },
  { label: "Intelligence Score", value: "92%", trend: "Coverage", trendColor: "text-green-400", chart: [85, 87, 86, 88, 89, 90, 91, 91, 92, 92] },
];

/* ------------------ GRAPH DATA ------------------ */

const initialNodes: (Node & { region: 'regional' | 'global' })[] = [
    { id: 'YOU', x: 400, y: 300, label: 'YOU', type: 'internal', status: 'safe', value: 40, region: 'global' },
    { id: 'A', x: 200, y: 150, label: 'Competitor A', type: 'competitor', status: 'critical', value: 25, region: 'regional' },
    { id: 'B', x: 250, y: 450, label: 'Competitor B', type: 'competitor', status: 'safe', value: 25, region: 'regional' },
    { id: 'C', x: 650, y: 400, label: 'Market C', type: 'market', status: 'warning', value: 25, region: 'global' },
    { id: 'D', x: 600, y: 100, label: 'Supplier D', type: 'threat', status: 'warning', value: 25, region: 'global' },
    { id: 'E', x: 100, y: 350, label: 'Emerging E', type: 'competitor', status: 'neutral', value: 15, region: 'regional' },
    { id: 'F', x: 700, y: 250, label: 'Regulator F', type: 'threat', status: 'safe', value: 20, region: 'global' },
  ];
  
const initialLinks: Link[] = [
    { source: 'YOU', target: 'A', activity: 'high' },
    { source: 'YOU', target: 'B', activity: 'medium' },
    { source: 'YOU', target: 'C', activity: 'low' },
    { source: 'YOU', target: 'D', activity: 'medium' },
    { source: 'A', target: 'E', activity: 'low' },
    { source: 'C', target: 'F', activity: 'medium' },
    { source: 'B', target: 'C', activity: 'low' },
    { source: 'D', target: 'A', activity: 'low' },
  ];

/* ------------------ HELPERS ------------------ */

// Micro-chart component
const Sparkline = ({ data, color }: { data: number[], color: string }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d - min) / range) * 100;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 100 100" className="w-[80px] h-[30px] overflow-visible">
      <polyline 
        points={points} 
        fill="none" 
        stroke={color} 
        strokeWidth="3" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

/* ------------------ PAGE ------------------ */

export default function MarketRadarPage() {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [filter, setFilter] = useState<'all' | 'regional' | 'global'>('all');

  const [signals, setSignals] = useState<Signal[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSignalId, setExpandedSignalId] = useState<number | null>(null);

  const [analysis, setAnalysis] = useState<{
    summary: string;
    recentActivity: string[];
    recommendation: string;
  } | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  useEffect(() => {
    const params = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : "";
    api
      .get<{ signals: Signal[] }>(`/api/market-radar/signals${params}`)
      .then((data) => setSignals(data.signals))
      .catch(() => setSignals([]));
  }, [searchQuery]);

  useEffect(() => {
    setAnalysis(null);
  }, [selectedNode?.id]);

  const loadAnalysis = () => {
    if (!selectedNode) return;
    setAnalysisLoading(true);
    api
      .get<{ summary: string; recentActivity: string[]; recommendation: string }>(
        `/api/market-radar/nodes/${selectedNode.id}/analysis`
      )
      .then(setAnalysis)
      .catch(() => setAnalysis(null))
      .finally(() => setAnalysisLoading(false));
  };

  // Helper for sentiment color
  const getSentimentColor = (s: string) => {
    switch (s) {
      case "positive": return "text-[#7cff4e] border-[#7cff4e]/20 bg-[#7cff4e]/5";
      case "critical": return "text-red-400 border-red-500/20 bg-red-500/5";
      default: return "text-blue-400 border-blue-500/20 bg-blue-500/5";
    }
  };

  // Filter nodes based on selection
  const filteredNodes = initialNodes.filter(node => 
    filter === 'all' || node.id === 'YOU' || node.region === filter
  );

  // Filter links to only show connections between visible nodes
  const filteredLinks = initialLinks.filter(link => 
    filteredNodes.find(n => n.id === link.source) && 
    filteredNodes.find(n => n.id === link.target)
  );

  return (
    <div className="relative w-full bg-transparent overflow-hidden">
      
      {/* Main Content */}
      <div className="relative z-10 p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto text-slate-300">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-up delay-0">
          <div>
            <div className="flex items-center gap-2 text-sm text-[#94a3b8] mb-1">
              <span>Dashboard</span>
              <span className="text-[#334155]">/</span>
              <span>Market Radar</span>
              <span className="text-[#334155]">/</span>
              <span className="text-[#7cff4e]">Competitor Intelligence</span>
            </div>
            <h1 className="text-2xl font-semibold text-[#e6eaf0] tracking-tight flex items-center gap-2">
              Market Radar
              <span className="text-xs px-2 py-0.5 rounded border border-[#7cff4e]/30 bg-[#7cff4e]/10 text-[#7cff4e]">v3.0</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1e293b]/50 border border-[#334155] text-xs font-medium text-[#7cff4e]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7cff4e] animate-pulse" />
                Neural Network: Active
             </div>
             <button 
                onClick={() => setIsScanning(!isScanning)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${isScanning ? 'bg-[#7cff4e]/10 border-[#7cff4e] text-[#7cff4e]' : 'bg-[#1e293b]/50 border-[#334155] text-[#94a3b8]'}`}
             >
                <Radar className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning ? 'Scanning Active' : 'Scan Paused'}
             </button>
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1e293b]/50 border border-[#334155] text-xs font-medium text-[#94a3b8]">
                <Zap className="w-3 h-3" />
                Live Feed
             </div>
          </div>
        </header>

        {/* STATS ROW */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div 
              key={i}
              className={`
                group relative p-5 rounded-xl border border-[#1e293b] bg-[#0f141b]/60 backdrop-blur-sm 
                hover:border-[#7cff4e]/30 transition-all duration-300 card-3d-hover animate-fade-in-up
              `}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#7cff4e]/0 to-[#7cff4e]/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
              
              <div className="relative z-10 flex justify-between items-end">
                <div>
                    <p className="text-sm font-medium text-[#64748b] mb-1">{stat.label}</p>
                    <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-bold text-white tracking-tight">{stat.value}</h3>
                    </div>
                    <span className={`text-xs font-medium ${stat.trendColor}`}>
                        {stat.trend}
                    </span>
                </div>
                {/* Sparkline */}
                <Sparkline 
                    data={stat.chart} 
                    color={stat.trendColor.includes('red') ? '#f87171' : '#7cff4e'} 
                />
              </div>
            </div>
          ))}
        </section>

        {/* MAIN VISUALIZATION ROW */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[650px] lg:h-[600px]">
          
          {/* NETWORK GRAPH (2 cols) */}
          <div className="lg:col-span-2 relative w-full h-full rounded-2xl border border-[#1e293b] bg-[#0f141b]/80 backdrop-blur-md overflow-hidden card-3d-hover animate-fade-in-up delay-300 shadow-2xl">
             {/* Graph Header */}
             <div className="absolute top-0 left-0 right-0 p-5 flex items-center justify-between z-20 border-b border-[#1e293b]/50 bg-[#0f141b]/50 pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto">
                  <div className="p-1.5 rounded-lg bg-[#7cff4e]/10 shadow-[0_0_15px_rgba(124,255,78,0.15)]">
                    <Radio className="w-4 h-4 text-[#7cff4e]" />
                  </div>
                  <h3 className="font-semibold text-white tracking-wide">Competitive Network Graph</h3>
                </div>
                <div className="flex gap-1.5 pointer-events-auto bg-[#0b0f14]/50 p-1 rounded-xl border border-[#334155]/50 backdrop-blur-sm">
                    {['all', 'regional', 'global'].map((f) => (
                        <button 
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`
                                relative px-3 py-1.5 rounded-lg transition-all duration-300 text-xs font-medium capitalize
                                ${filter === f 
                                    ? 'text-[#0b0f14] bg-[#7cff4e] shadow-[0_0_15px_rgba(124,255,78,0.3)]' 
                                    : 'text-[#94a3b8] hover:text-white hover:bg-white/5'}
                            `}
                        >
                            {f}
                        </button>
                    ))}
                </div>
             </div>

             {/* GRAPH VISUALIZATION COMPONENT */}
             <div className="absolute inset-0 pt-16 pb-4 px-4 bg-[#0b0f14]">
                <div key={filter} className="w-full h-full animate-fade-in">
                    <NetworkGraph 
                        nodes={filteredNodes} 
                        links={filteredLinks} 
                        isScanning={isScanning}
                        onNodeSelect={setSelectedNode}
                    />
                </div>
             </div>

             {/* Detail Panel Overlay (Appears when node selected) */}
             <div className={`absolute top-20 right-5 w-72 bg-[#0f141b]/95 border border-[#1e293b] backdrop-blur-xl rounded-xl p-5 shadow-2xl transform transition-all duration-300 z-30 ${selectedNode ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'}`}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h4 className="text-white font-semibold text-lg">{selectedNode?.label}</h4>
                        <span className="text-[10px] text-[#64748b] uppercase tracking-wider">{selectedNode?.type} Entity</span>
                    </div>
                    <button onClick={() => setSelectedNode(null)} className="text-[#64748b] hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#1e293b]/50 p-2.5 rounded-lg">
                            <span className="text-[#94a3b8] text-[10px] block mb-1">Status</span> 
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize inline-block ${
                                selectedNode?.status === 'critical' ? 'bg-red-500/10 text-red-500' : 
                                selectedNode?.status === 'safe' ? 'bg-green-500/10 text-green-500' : 
                                'bg-blue-500/10 text-blue-500'
                            }`}>
                                {selectedNode?.status}
                            </span>
                        </div>
                        <div className="bg-[#1e293b]/50 p-2.5 rounded-lg">
                            <span className="text-[#94a3b8] text-[10px] block mb-1">Influence</span> 
                            <span className="text-white font-mono text-xs">{selectedNode?.value ? selectedNode.value * 2 : 0}%</span>
                        </div>
                    </div>

                    <div className="bg-[#1e293b]/30 p-3 rounded-lg border border-[#334155]/30">
                        <h5 className="text-xs font-medium text-[#e2e8f0] mb-2 flex items-center gap-2">
                            <Activity className="w-3 h-3 text-[#7cff4e]" /> Recent Activity
                        </h5>
                        {analysis ? (
                          <>
                            <p className="text-[11px] text-[#94a3b8] leading-relaxed mb-2">{analysis.summary}</p>
                            {analysis.recentActivity.length > 0 && (
                              <ul className="space-y-1 mb-2">
                                {analysis.recentActivity.map((a, i) => (
                                  <li key={i} className="text-[10px] text-[#94a3b8] flex gap-1.5">
                                    <span className="text-[#7cff4e]">•</span> {a}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <p className="text-[11px] text-[#7cff4e] leading-relaxed">{analysis.recommendation}</p>
                          </>
                        ) : (
                          <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                              Detected 3 major signals in the past 24h. High correlation with regional pricing updates.
                          </p>
                        )}
                    </div>

                    <button
                      onClick={loadAnalysis}
                      disabled={analysisLoading}
                      className="w-full py-2 bg-[#7cff4e] hover:bg-[#4ade80] text-[#0b0f14] font-bold text-xs rounded-lg shadow-lg shadow-[#7cff4e]/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-60"
                    >
                        {analysisLoading ? "Analyzing…" : "Full Analysis"}
                        {!analysisLoading && <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />}
                    </button>
                </div>
             </div>

             {/* Legend */}
             <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between text-xs text-[#94a3b8] px-4 pointer-events-none z-20">
                <div className="flex items-center gap-4 pointer-events-auto bg-[#0f141b]/80 p-2 rounded-lg border border-[#1e293b]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#f87171]"></div>
                    <span>Critical</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#fbbf24]"></div>
                    <span>Warning</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#4ade80]"></div>
                    <span>Safe</span>
                  </div>
                </div>
             </div>
          </div>

          {/* SOCIAL FEED */}
          <div className="relative w-full h-full rounded-2xl border border-[#1e293b] bg-[#0f141b]/80 backdrop-blur-md overflow-hidden flex flex-col card-3d-hover animate-fade-in-up delay-500">
             
             {/* Feed Header */}
             <div className="flex-none p-5 border-b border-[#1e293b]/50 bg-[#0f141b]/50">
               <div className="flex items-center justify-between mb-1">
                 <div className="flex items-center gap-2">
                   <Target className="w-4 h-4 text-[#7cff4e]" />
                   <h3 className="font-semibold text-white">Live Social Listening</h3>
                 </div>
                 <div className="flex items-center gap-1">
                   <span className="w-1.5 h-1.5 rounded-full bg-[#7cff4e] animate-pulse"></span>
                   <span className="text-[10px] font-bold text-[#7cff4e] tracking-widest uppercase">LIVE</span>
                 </div>
               </div>
               {/* Search/Filter Bar */}
               <div className="mt-3 relative group">
                 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748b] group-focus-within:text-[#7cff4e] transition-colors" />
                 <input
                   type="text"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   placeholder="Filter signals..."
                   className="w-full bg-[#1e293b]/40 border border-[#334155]/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#7cff4e]/50 focus:bg-[#1e293b]/60 transition-all"
                 />
               </div>
             </div>

             {/* Feed Content */}
             <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {signals.length === 0 && (
                  <p className="text-xs text-[#64748b] text-center py-6">No signals match your filter.</p>
                )}
                {signals.map((signal, idx) => {
                  const Icon = sourceIcons[signal.source] ?? Activity;
                  const isExpanded = expandedSignalId === signal.id;
                  return (
                    <div
                      key={signal.id}
                      onClick={() => setExpandedSignalId(isExpanded ? null : signal.id)}
                      className="group p-4 rounded-xl border border-[#1e293b]/60 bg-[#1e293b]/20 hover:bg-[#1e293b]/40 hover:border-[#7cff4e]/20 transition-all cursor-pointer animate-fade-in-up"
                      style={{ animationDelay: `${idx * 150}ms` }}
                    >
                       <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded bg-[#0b0f14] border border-[#334155]">
                                <Icon className="w-3 h-3 text-[#94a3b8]" />
                            </div>
                            <span className="text-xs font-medium text-[#e2e8f0]">{signal.source}</span>
                          </div>
                          <div className="flex flex-col items-end">
                             <span className="text-[10px] text-[#64748b]">{signal.time}</span>
                             {idx === 0 && <span className="text-[9px] text-[#7cff4e] font-bold animate-pulse">NEW</span>}
                          </div>
                       </div>

                       <p className={`text-sm text-[#cbd5e1] leading-relaxed mb-3 group-hover:text-white transition-colors ${isExpanded ? "" : "line-clamp-2"}`}>
                         {signal.title}
                       </p>

                       <div className="flex items-center justify-between">
                         <div className={`text-[10px] px-2 py-0.5 rounded border capitalize flex items-center gap-1.5 ${getSentimentColor(signal.sentiment)}`}>
                            <span className={`w-1 h-1 rounded-full ${signal.sentiment === 'positive' ? 'bg-[#7cff4e]' : signal.sentiment === 'critical' ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                            {signal.sentiment} Impact
                         </div>
                         <div className="flex items-center gap-1 text-[10px] text-[#7cff4e] opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                           {isExpanded ? "Collapse" : "View Details"} <ExternalLink className="w-3 h-3" />
                         </div>
                       </div>
                    </div>
                  );
                })}
                <div className="text-center py-4">
                    <div className="inline-block h-4 w-4 border-2 border-[#334155] border-t-[#7cff4e] rounded-full animate-spin"></div>
                </div>
             </div>
          </div>

        </section>
      </div>
    </div>
  );
}
