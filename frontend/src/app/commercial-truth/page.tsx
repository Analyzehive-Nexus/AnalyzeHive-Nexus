"use client";

import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  PhoneCall,
  AlertTriangle,
  Users,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  FileText,
  Search,
  Filter
} from "lucide-react";
import { api } from "@/lib/api";

// --- Types ---

interface HierarchyItem {
  id: string;
  name: string;
  role: string;
  teamSize: number;
  initials: string;
  color: string;
  reported: number;
  verified: number;
  status: string;
  region: string;
}

interface AuditLogEntry {
  timestamp: string;
  event: string;
}

type Region = "all" | "North" | "South" | "East" | "West";

// --- Mock Data ---

const nlpHighlights = [
  { type: "success", text: "Discussed clinical efficacy data from Phase III trials" },
  { type: "success", text: "Addressed patient dosage concerns with evidence" },
  { type: "error", text: "No objection handling observed" },
  { type: "success", text: "Follow-up commitment secured" },
];

const stats = [
  { label: "Total Calls Verified", value: "12,847", trend: "+8.4% this week", trendColor: "text-green-400", icon: PhoneCall, chart: [40, 35, 55, 60, 50, 70, 80, 75, 85, 90] },
  { label: "Fake Reports", value: "234", trend: "-12% vs last month", trendColor: "text-green-400", icon: AlertTriangle, chart: [60, 55, 50, 45, 40, 35, 30, 25, 20, 15] }, // Green because down is good for alerts
  { label: "Audit Score", value: "78%", trend: "+5% improvement", trendColor: "text-green-400", icon: ShieldCheck, chart: [65, 68, 70, 72, 71, 74, 76, 75, 77, 78] },
];

// --- Helpers ---

const Sparkline = ({ data, color }: { data: number[], color: string }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d - min) / range) * 100;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 100 100" className="w-[60px] h-[30px] overflow-visible opacity-80">
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

// --- Sub-Components ---

// 1. Hierarchy Audit Table
const HierarchyTable = memo(({ region }: { region: Region }) => {
  const [hierarchyData, setHierarchyData] = useState<HierarchyItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "high-risk" | "verified">("all");
  const [auditLogs, setAuditLogs] = useState<Record<string, AuditLogEntry[]>>({});
  const [auditLoading, setAuditLoading] = useState<string | null>(null);

  useEffect(() => {
    const params = region === "all" ? "" : `?region=${region}`;
    api
      .get<{ hierarchy: HierarchyItem[] }>(`/api/commercial-truth/hierarchy${params}`)
      .then((data) => setHierarchyData(data.hierarchy))
      .catch(() => setHierarchyData([]));
  }, [region]);

  const loadAuditLog = (id: string) => {
    if (auditLogs[id]) return; // already loaded
    setAuditLoading(id);
    api
      .get<{ log: AuditLogEntry[] }>(`/api/commercial-truth/audit/${id}/log`)
      .then((data) => setAuditLogs((prev) => ({ ...prev, [id]: data.log })))
      .catch(() => setAuditLogs((prev) => ({ ...prev, [id]: [] })))
      .finally(() => setAuditLoading(null));
  };

  const filteredData = hierarchyData.filter(item => {
    if (filter === "high-risk") return item.status === "Flagged";
    if (filter === "verified") return item.status === "Verified";
    return true;
  });

  return (
    <div className="bg-[#0f141b]/60 backdrop-blur-md border border-[#1e293b] rounded-2xl p-0 h-full flex flex-col overflow-hidden relative shadow-xl transition-all hover:border-[#7cff4e]/20">
       
       {/* Header */}
       <div className="flex flex-col gap-4 p-5 border-b border-[#1e293b]/50 bg-[#0f141b]/40">
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="p-2 rounded-lg bg-[#7cff4e]/10">
                  <Users className="w-4 h-4 text-[#7cff4e]" />
               </div>
               <div>
                  <h3 className="font-semibold text-white">Field Force Audit</h3>
                  <p className="text-xs text-[#64748b]">Live verification status</p>
               </div>
            </div>
            {/* Filter Tabs */}
            <div className="flex p-1 bg-[#1e293b]/50 rounded-lg">
                {[ 
                { id: 'all', label: 'All' },
                { id: 'high-risk', label: 'High Risk' },
                { id: 'verified', label: 'Verified' }
                ].map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id as any)}
                    className={`
                    text-[10px] px-3 py-1 rounded-md transition-all font-medium
                    ${filter === tab.id 
                        ? 'bg-[#7cff4e]/10 text-[#7cff4e] shadow-sm' 
                        : 'text-[#64748b] hover:text-[#e6eaf0]'}
                    `}
                >
                    {tab.label}
                </button>
                ))}
            </div>
         </div>
       </div>

       {/* List */}
       <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3 custom-scrollbar">
         {filteredData.map((item, idx) => {
           const gap = item.reported - item.verified;
           const isExpanded = expandedId === item.id;
           const trustScore = 100 - (item.reported - item.verified);

           return (
             <div
               key={item.id}
               onClick={() => setExpandedId(isExpanded ? null : item.id)}
               className={`
                 relative rounded-xl border transition-all duration-300 cursor-pointer group overflow-hidden
                 ${isExpanded 
                   ? 'bg-[#1e293b]/40 border-[#7cff4e]/30 shadow-[0_4px_20px_rgba(0,0,0,0.4)]' 
                   : 'bg-[#1e293b]/10 border-white/5 hover:border-white/10 hover:bg-[#1e293b]/30'}
               `}
             >
               <div className="p-4">
                 <div className="flex justify-between items-center mb-4">
                   <div className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg ${item.color} bg-opacity-80`}>
                       {item.initials}
                     </div>
                     <div>
                       <h4 className="text-sm font-medium text-[#e6eaf0] group-hover:text-white transition-colors">{item.name}</h4>
                       <p className="text-xs text-[#94a3b8] flex items-center gap-1">
                          {item.role} 
                          <span className="w-1 h-1 rounded-full bg-[#64748b]" /> 
                          {item.teamSize} reports
                       </p>
                     </div>
                   </div>
                   
                   <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                     item.status === 'Verified' 
                       ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                       : 'bg-red-500/10 text-red-400 border-red-500/20'
                   }`}>
                     {item.status.toUpperCase()}
                   </span>
                 </div>

                 {/* Bar Comparison */}
                 <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-[10px] text-[#94a3b8] mb-1">
                        <span>Reported Count</span>
                        <span className="text-right">AI Verified Count</span>
                    </div>
                    <div className="relative h-2 bg-[#0b0f14] rounded-full overflow-hidden flex">
                        {/* Reported Bar */}
                        <div className="h-full bg-blue-500/50 rounded-l-full" style={{ width: '50%' }}></div>
                        {/* Verified Bar */}
                        <div className={`h-full ${item.verified < 80 ? 'bg-red-500' : 'bg-[#7cff4e]'} rounded-r-full shadow-[0_0_10px_currentColor]`} style={{ width: '50%' }}></div>
                        
                        {/* Center Line visual helper */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
                    </div>
                    <div className="flex justify-between text-xs font-bold text-white">
                        <span>{item.reported}</span>
                        <span className={item.verified < 80 ? 'text-red-400' : 'text-[#7cff4e]'}>{item.verified}</span>
                    </div>
                 </div>
               </div>

               {/* Expanded Details */}
               <div className={`
                    bg-[#0f141b]/50 border-t border-white/5 px-4 overflow-hidden transition-all duration-300 ease-in-out
                    ${isExpanded ? 'max-h-40 py-4 opacity-100' : 'max-h-0 py-0 opacity-0'}
               `}>
                  <div className="flex gap-4">
                      {/* Trust Gauge */}
                      <div className="w-20 flex flex-col items-center justify-center p-2 rounded bg-white/5 border border-white/5">
                          <span className="text-xl font-bold text-white">{trustScore}%</span>
                          <span className="text-[9px] text-[#94a3b8] uppercase">Trust Score</span>
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-between">
                          <p className="text-xs text-[#cbd5e1] leading-relaxed">
                            {gap > 15
                                ? "Critical: Creating false visit logs. GPS timestamps do not match reported clinic locations."
                                : "No anomalies detected. Reporting cadence aligns with field movement."
                            }
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); loadAuditLog(item.id); }}
                            className="self-end text-[10px] text-[#7cff4e] hover:underline flex items-center gap-1 mt-2"
                          >
                             {auditLoading === item.id ? "Loading…" : "Full Audit Log"} <ChevronRight className="w-3 h-3" />
                          </button>
                      </div>
                  </div>
                  {auditLogs[item.id] && (
                    <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
                      {auditLogs[item.id].length === 0 ? (
                        <p className="text-[10px] text-[#64748b]">No log entries found.</p>
                      ) : (
                        auditLogs[item.id].map((entry, i) => (
                          <div key={i} className="flex gap-2 text-[10px]">
                            <span className="text-[#64748b] whitespace-nowrap">{entry.timestamp}</span>
                            <span className="text-[#94a3b8]">{entry.event}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
               </div>
             </div>
           );
         })}
       </div>
    </div>
  );
});

HierarchyTable.displayName = "HierarchyTable";

// 2. Transcript Analysis
const TranscriptAnalysis = memo(() => {
  return (
    <div className="bg-[#0f141b]/60 backdrop-blur-md border border-[#1e293b] rounded-2xl p-6 h-full flex flex-col relative overflow-hidden transition-all hover:border-[#7cff4e]/20 group">
       {/* Ambient glow */}
       <div className="absolute -right-20 -top-20 w-40 h-40 bg-[#7cff4e]/5 blur-3xl group-hover:bg-[#7cff4e]/10 transition-colors" />

       <div className="flex justify-between items-center mb-6 relative z-10">
         <div className="flex items-center gap-2">
             <div className="p-2 rounded-lg bg-[#7cff4e]/10">
                <FileText className="w-4 h-4 text-[#7cff4e]" />
             </div>
             <div>
                <h3 className="font-semibold text-white">Transcript Analysis</h3>
                <p className="text-xs text-[#64748b]">Real-time NLP processing</p>
             </div>
         </div>
       </div>
       
       <div className="bg-[#1e293b]/30 rounded-xl p-4 mb-4 border border-[#334155]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold border border-indigo-500/30">
                 VS
             </div>
             <div>
               <p className="text-sm font-medium text-white">Vikram Sharma</p>
               <p className="text-xs text-[#94a3b8]">Sales Rep ID: #8832</p>
             </div>
          </div>
          <div className="text-right">
              <span className="block text-xs text-[#7cff4e] font-bold">LIVE</span>
              <span className="text-[10px] text-[#64748b]">12:42 min</span>
          </div>
       </div>

       <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
          <p className="text-[10px] uppercase tracking-wider text-[#64748b] mb-3 font-semibold flex items-center gap-2">
             <Search className="w-3 h-3" /> Key Insights Detected
          </p>
          <div className="space-y-2">
             {nlpHighlights.map((hl, idx) => (
               <div key={idx} className={`p-3 rounded-lg border text-xs leading-relaxed animate-fade-in-up ${
                 hl.type === 'success' ? 'bg-green-500/5 border-green-500/10 text-green-200' : 'bg-red-500/5 border-red-500/10 text-red-200'
               }`} style={{ animationDelay: `${idx * 150}ms` }}>
                  <div className="flex gap-2">
                      {hl.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                      {hl.text}
                  </div>
               </div>
             ))}
          </div>
       </div>

       <div className="mt-6 pt-4 border-t border-[#1e293b] flex justify-between items-center">
         <div>
            <span className="text-xs text-[#94a3b8] block">Clinical Depth Score</span>
            <div className="flex gap-0.5 mt-1">
                {[1,2,3,4,5].map(i => <div key={i} className={`w-3 h-1 rounded-full ${i <= 4 ? 'bg-[#7cff4e]' : 'bg-[#334155]'}`} />)}
            </div>
         </div>
         <span className="text-2xl font-bold text-[#7cff4e]">7.2<span className="text-sm text-[#64748b] font-normal">/10</span></span>
       </div>
    </div>
  );
});

TranscriptAnalysis.displayName = "TranscriptAnalysis";

// --- Main Page ---

export default function CommercialTruthPage() {
  const [region, setRegion] = useState<Region>("all");
  const [regionMenuOpen, setRegionMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const regions: Region[] = ["all", "North", "South", "East", "West"];

  const toggleRegionMenu = () => {
    if (!regionMenuOpen && filterBtnRef.current) {
      const rect = filterBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 8, left: rect.right - 160 });
    }
    setRegionMenuOpen((o) => !o);
  };

  return (
    <div className="relative w-full bg-transparent overflow-hidden">

      <div className="relative z-10 p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto text-slate-300">

        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-up delay-0">
          <div>
            <div className="flex items-center gap-2 text-sm text-[#94a3b8] mb-1">
              <span>Dashboard</span>
              <span className="text-[#334155]">/</span>
              <span>Commercial Truth</span>
              <span className="text-[#334155]">/</span>
              <span className="text-[#7cff4e]">Field Force Audit</span>
            </div>
            <h1 className="text-2xl font-semibold text-[#e6eaf0] tracking-tight flex items-center gap-2">
              Commercial Truth
              <span className="text-xs px-2 py-0.5 rounded border border-[#7cff4e]/30 bg-[#7cff4e]/10 text-[#7cff4e]">v1.4</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1e293b]/50 border border-[#334155] text-xs font-medium text-[#7cff4e]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7cff4e] animate-pulse" />
                Audit Engine: Online
             </div>
             <div className="relative">
               <button
                 ref={filterBtnRef}
                 onClick={toggleRegionMenu}
                 className={`p-2 rounded-full border transition ${region !== "all" ? "border-[#7cff4e]/40 bg-[#7cff4e]/10 text-[#7cff4e]" : "border-[#334155] bg-[#1e293b]/50 text-[#94a3b8] hover:text-white"}`}
               >
                  <Filter className="w-4 h-4" />
               </button>
               {regionMenuOpen &&
                 createPortal(
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setRegionMenuOpen(false)} />
                     <div
                       style={{ top: menuPos.top, left: menuPos.left }}
                       className="fixed w-40 rounded-lg bg-[#0f141b] border border-[#1e293b] shadow-xl z-50 overflow-hidden"
                     >
                       {regions.map((r) => (
                         <button
                           key={r}
                           onClick={() => { setRegion(r); setRegionMenuOpen(false); }}
                           className={`w-full text-left px-3 py-2 text-xs transition ${region === r ? "bg-[#7cff4e]/10 text-[#7cff4e]" : "text-[#94a3b8] hover:bg-white/5 hover:text-white"}`}
                         >
                           {r === "all" ? "All Regions" : r}
                         </button>
                       ))}
                     </div>
                   </>,
                   document.body
                 )}
             </div>
          </div>
        </header>

        {/* KPI CARDS */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.map((stat, i) => {
                const Icon = stat.icon;
                return (
                    <div 
                        key={i} 
                        className="p-5 rounded-2xl bg-[#0f141b]/60 backdrop-blur-md border border-[#1e293b] hover:border-[#7cff4e]/30 transition-all duration-300 group animate-fade-in-up" 
                        style={{ animationDelay: `${i * 100}ms` }}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 rounded-lg bg-[#1e293b]/50 text-[#94a3b8] group-hover:text-[#7cff4e] group-hover:bg-[#7cff4e]/10 transition-colors">
                                <Icon className="w-5 h-5" />
                            </div>
                            <Sparkline data={stat.chart} color={stat.trendColor.includes("red") ? "#ef4444" : "#4ade80"} />
                        </div>
                        <div>
                            <h3 className="text-3xl font-bold text-white tracking-tight">{stat.value}</h3>
                            <p className="text-xs text-[#94a3b8] mt-1">{stat.label}</p>
                            <p className={`text-xs font-medium mt-0.5 ${stat.trendColor}`}>{stat.trend}</p>
                        </div>
                    </div>
                );
            })}
        </section>

        {/* MAIN SPLIT */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px] lg:h-[700px]">
          {/* Left: Table */}
          <div className="lg:col-span-2 h-full min-h-0 card-3d-hover animate-fade-in-up delay-300">
             <HierarchyTable region={region} />
          </div>

          {/* Right: Analysis */}
          <div className="h-full min-h-0 card-3d-hover animate-fade-in-up delay-500">
             <TranscriptAnalysis />
          </div>
        </section>

      </div>
    </div>
  );
}
