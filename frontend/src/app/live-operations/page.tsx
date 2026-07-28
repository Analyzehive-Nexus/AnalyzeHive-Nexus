"use client";

import { memo, useState, useEffect } from "react";
import WorldMap from "@/components/dashboard/WorldMap";
import { Radio, ShieldCheck, AlertTriangle, Zap, Server, Activity } from "lucide-react";

// --- Mock Data ---

const liveEvents = [
  { id: 1, type: "success", msg: "Node US-East-1 synchronized", time: "00:01s" },
  { id: 2, type: "info", msg: "Data packet received from SG-Node", time: "00:03s" },
  { id: 3, type: "warning", msg: "Latency spike in EU-West cluster", time: "00:12s" },
  { id: 4, type: "success", msg: "Backup routing confirmed", time: "00:15s" },
  { id: 5, type: "info", msg: "Inventory batch #9921 tracked", time: "00:22s" },
  { id: 6, type: "error", msg: "Connection timeout: Node JP-4", time: "00:45s" },
  { id: 7, type: "success", msg: "Reconnection attempt successful", time: "00:48s" },
  { id: 8, type: "info", msg: "Audit log updated", time: "01:02s" },
];

const regions = [
  { name: "North America", status: "Operational", load: "42%", latency: "24ms" },
  { name: "Europe West", status: "Degraded", load: "89%", latency: "145ms" },
  { name: "Asia Pacific", status: "Operational", load: "31%", latency: "88ms" },
  { name: "South America", status: "Maintenance", load: "0%", latency: "--" },
];

// --- Styles ---



// --- Sub-Components ---

// 1. Live Stats Ticker
const StatusTicker = ({ label, value, unit, icon: Icon, status = "normal" }: any) => (
  <div className="flex items-center gap-3 bg-[#0b0f14]/80 border border-white/5 p-3 rounded-lg hover:border-[#7cff4e]/30 transition-colors group">
    <div className={`w-8 h-8 rounded bg-white/5 flex items-center justify-center ${status === 'warning' ? 'text-yellow-400' : 'text-[#7cff4e]'}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider">{label}</p>
      <p className="text-lg font-mono font-semibold text-[#e6eaf0]">
        {value} <span className="text-xs font-normal text-[#64748b]">{unit}</span>
      </p>
    </div>
  </div>
);

// 2. Real-time Event Feed
const EventFeed = () => {
  return (
    <div className="h-full bg-[#0b0f14] border border-white/5 rounded-xl p-0 flex flex-col overflow-hidden hover:border-[#7cff4e]/30 transition-colors shadow-2xl shadow-black/50">
      <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
        <h3 className="text-sm font-semibold text-[#e6eaf0] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#7cff4e]" /> Live Event Stream
        </h3>
        <span className="flex h-2 w-2">
           <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
           <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
        {liveEvents.map((evt) => (
          <div key={evt.id} className="flex gap-3 items-start animate-in fade-in slide-in-from-left-2 duration-300">
             <span className="text-[#64748b] min-w-[50px]">{evt.time}</span>
             <div className="flex-1">
               <p className={`
                 ${evt.type === 'success' ? 'text-green-400' : 
                   evt.type === 'error' ? 'text-red-400' : 
                   evt.type === 'warning' ? 'text-yellow-400' : 'text-blue-400'}
               `}>
                 {evt.type.toUpperCase()}
               </p>
               <p className="text-[#94a3b8]">{evt.msg}</p>
             </div>
          </div>
        ))}
        {/* Faux infinite scroll fade */}
        <div className="h-8 bg-gradient-to-t from-[#0b0f14] to-transparent sticky bottom-0" />
      </div>
    </div>
  );
};

// 3. Region Status Cards
const RegionStatus = () => (
   <div className="grid grid-cols-1 gap-3">
      {regions.map((region) => (
        <div key={region.name} className="bg-[#0b0f14] border border-white/5 p-4 rounded-lg flex items-center justify-between group hover:bg-white/[0.02] transition-colors">
          <div>
            <p className="text-xs font-semibold text-[#e6eaf0]">{region.name}</p>
            <p className="text-[10px] text-[#64748b] mt-0.5">Latency: {region.latency}</p>
          </div>
          <div className="text-right">
             <div className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                region.status === 'Operational' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                region.status === 'Degraded' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                'bg-red-500/10 text-red-400 border-red-500/20'
             }`}>
               {region.status}
             </div>
             <p className="text-[10px] text-[#64748b] mt-1">Load: {region.load}</p>
          </div>
        </div>
      ))}
   </div>
);

// --- Main Page ---

// --- Main Page ---

export default function LiveOperationsPage() {
  const [mapScale, setMapScale] = useState(110);

  return (
    <div className="relative min-h-screen w-full bg-transparent overflow-hidden">

      <div className="relative z-10 p-8 space-y-10 perspective-container text-slate-300 selection:bg-[#7cff4e]/30 selection:text-[#7cff4e]">
        
        {/* Header Row */}
        <header className="animate-fade-in-up delay-0">
            <h1 className="text-2xl font-semibold text-[#e6eaf0] flex items-center gap-3">
              <Radio className="w-6 h-6 text-[#7cff4e]" />
              Live Operations Center
            </h1>
            <p className="text-sm text-[#94a3b8] mt-1">Real-time infrastructure monitoring & command</p>
        </header>
          
        {/* KPI Grid - Matching Dashboard Sizing & Spacing */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="animate-fade-in-up delay-100"><StatusTicker icon={Zap} label="System Load" value="42" unit="%" /></div>
            <div className="animate-fade-in-up delay-200"><StatusTicker icon={Server} label="Active Nodes" value="1,024" unit="" /></div>
            <div className="animate-fade-in-up delay-300"><StatusTicker icon={ShieldCheck} label="Sec. Status" value="Secure" unit="" /></div>
            <div className="animate-fade-in-up delay-400"><StatusTicker icon={Activity} label="Throughput" value="8.4" unit="GB/s" /></div>
            <div className="animate-fade-in-up delay-500"><StatusTicker icon={Radio} label="Uptime" value="99.9" unit="%" /></div>
        </div>

        {/* Main Workspace (Grid) */}
        {/* Standardized to h-[400px] to match Dashboard Chart Height */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]"> 
          
          {/* Left: Interactive Map (2/3 width) */}
          <section className="lg:col-span-2 h-full flex flex-col gap-4 animate-fade-in-up delay-500">
             {/* Map Container */}
             <div className="flex-1 min-h-0 rounded-2xl border border-white/5 overflow-hidden shadow-2xl relative group bg-[#161c24] card-3d-hover">
                {/* Overlay UI */}
                <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                   <button
                     onClick={() => setMapScale((s) => Math.min(400, s + 30))}
                     className="p-2 bg-black/50 backdrop-blur border border-white/10 rounded-lg text-white hover:bg-white/10 transition"
                   >
                     +
                   </button>
                   <button
                     onClick={() => setMapScale((s) => Math.max(60, s - 30))}
                     className="p-2 bg-black/50 backdrop-blur border border-white/10 rounded-lg text-white hover:bg-white/10 transition"
                   >
                     -
                   </button>
                </div>

                <WorldMap scale={mapScale} />
             </div>
          </section>

          {/* Right: Sidebar Infos (1/3 width) */}
          <section className="h-full flex flex-col gap-6 animate-fade-in-up delay-700">
            <div className="flex-1 min-h-0 card-3d-hover">
               <EventFeed />
            </div>
          </section>

        </div>

        {/* Region Status Row - New Row for consistency (like Table row in Dashboard) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="md:col-span-1">
              <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-4 px-1">Regional Health</h3>
              <RegionStatus />
           </div>
           {/* Placeholder for future expansion or another widget */}
           <div className="md:col-span-2 bg-[#0b0f14] border border-white/5 rounded-xl p-6 flex items-center justify-center text-[#94a3b8] text-sm border-dashed">
              System Diagnostics & Calibration Module (Offline)
           </div>
        </div>

      </div>
    </div>
  );
}
