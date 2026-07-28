"use client";

import { memo, useEffect, useState } from "react";
import {
  Activity,
  Server,
  Database,
  ShieldCheck,
  Cpu,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Terminal,
  RefreshCw,
  ChevronRight
} from "lucide-react";
import { api } from "@/lib/api";

interface Service {
  id: number;
  name: string;
  status: string;
  uptime: string;
  latency: string;
  region: string;
}

interface Incident {
  id: number;
  title: string;
  time: string;
  severity: string;
  status: string;
}

// --- Helpers ---

const StatusBadge = ({ status }: { status: string }) => {
  const styles = {
    Operational: "bg-green-500/10 text-green-400 border-green-500/20",
    Degraded: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    Maintenance: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Outage: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  // @ts-ignore
  const style = styles[status] || styles.Operational;

  return (
    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1.5 w-fit ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'Operational' ? 'bg-green-500' : status === 'Degraded' ? 'bg-yellow-500' : status === 'Maintenance' ? 'bg-blue-500' : 'bg-red-500'}`} />
      {status.toUpperCase()}
    </span>
  );
};

// --- Sub-Components ---

const SystemStatCard = ({ icon: Icon, label, value, subtext, status = "normal" }: any) => (
  <div className="bg-[#0f141b]/60 backdrop-blur-md border border-[#1e293b] p-5 rounded-2xl flex items-start justify-between group hover:border-[#7cff4e]/30 transition-all duration-300 animate-fade-in-up">
    <div>
      <p className="text-xs text-[#94a3b8] mb-1 uppercase tracking-wider font-semibold">{label}</p>
      <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
      <p className={`text-[10px] ${status === 'good' ? 'text-green-400' : 'text-yellow-400'}`}>{subtext}</p>
    </div>
    <div className={`p-3 rounded-xl bg-[#1e293b]/50 group-hover:bg-[#7cff4e]/10 transition-colors ${status === 'good' ? 'text-[#7cff4e]' : 'text-yellow-400'}`}>
      <Icon className="w-5 h-5" />
    </div>
  </div>
);

const ServiceGrid = memo(() => {
  const [services, setServices] = useState<Service[]>([]);
  const [refreshing, setRefreshing] = useState(true);

  const fetchServices = () => {
    setRefreshing(true);
    api
      .get<{ services: Service[] }>("/api/system-status/services")
      .then((data) => setServices(data.services))
      .catch(() => setServices([]))
      .finally(() => setRefreshing(false));
  };

  useEffect(() => {
    fetchServices();
  }, []);

  return (
    <div className="bg-[#0f141b]/60 backdrop-blur-md border border-[#1e293b] rounded-2xl p-6 h-full flex flex-col hover:border-[#7cff4e]/20 transition-colors">
       <div className="flex justify-between items-center mb-6">
         <div>
            <h3 className="text-base font-semibold text-[#e6eaf0] flex items-center gap-2">
              <Server className="w-4 h-4 text-[#7cff4e]" /> Service Status
            </h3>
            <p className="text-xs text-[#64748b]">Real-time component monitoring</p>
         </div>
         <button
           onClick={fetchServices}
           disabled={refreshing}
           className="p-2 rounded-lg bg-[#1e293b]/50 text-[#94a3b8] hover:text-white transition disabled:opacity-50"
         >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
         </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((svc, i) => (
            <div key={svc.id} className="p-4 rounded-xl border border-white/5 bg-[#161c24]/50 hover:bg-[#161c24] hover:border-[#7cff4e]/20 transition-all group animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
               <div className="flex justify-between items-start mb-3">
                  <StatusBadge status={svc.status} />
                  <span className="text-[10px] text-[#64748b] font-mono">{svc.region}</span>
               </div>
               <h4 className="text-sm font-semibold text-white mb-2 group-hover:text-[#7cff4e] transition-colors">{svc.name}</h4>
               <div className="flex items-center gap-4 text-xs">
                  <div className="flex flex-col">
                     <span className="text-[#64748b] text-[10px]">Uptime</span>
                     <span className="font-mono text-[#e6eaf0]">{svc.uptime}</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[#64748b] text-[10px]">Latency</span>
                     <span className={`font-mono font-medium ${parseInt(svc.latency) > 300 ? 'text-yellow-400' : 'text-[#e6eaf0]'}`}>{svc.latency}</span>
                  </div>
               </div>
            </div>
          ))}
       </div>
    </div>
  );
});
ServiceGrid.displayName = "ServiceGrid";

const IncidentLog = memo(() => {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    api
      .get<{ incidents: Incident[] }>("/api/system-status/incidents")
      .then((data) => setIncidents(data.incidents))
      .catch(() => setIncidents([]));
  }, []);

  return (
  <div className="bg-[#0f141b]/60 backdrop-blur-md border border-[#1e293b] rounded-2xl p-6 h-full flex flex-col hover:border-[#7cff4e]/20 transition-colors">
      <div className="flex justify-between items-center mb-6">
       <div>
          <h3 className="text-base font-semibold text-[#e6eaf0] flex items-center gap-2">
            <Activity className="w-4 h-4 text-yellow-400" /> Incident Log
          </h3>
          <p className="text-xs text-[#64748b]">Recent system events</p>
       </div>
     </div>

     <div className="flex-1 space-y-4">
        {incidents.map((inc, i) => (
           <div key={inc.id} className="relative pl-6 animate-fade-in-up" style={{ animationDelay: `${i * 150}ms` }}>
              {/* Timeline Line */}
              <div className="absolute left-[5px] top-2 bottom-0 w-px bg-[#1e293b] group-last:hidden" />
              {/* Dot */}
              <div className={`absolute left-0 top-2 w-2.5 h-2.5 rounded-full border-2 border-[#0b0f14] ${inc.severity === 'Medium' ? 'bg-yellow-400' : inc.severity === 'High' ? 'bg-red-500' : 'bg-[#64748b]'}`} />
              
              <div className="pb-4">
                 <div className="flex justify-between items-start">
                    <h4 className="text-sm font-medium text-[#e6eaf0]">{inc.title}</h4>
                    <span className="text-[10px] text-[#64748b] whitespace-nowrap">{inc.time}</span>
                 </div>
                 <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 ${inc.status === 'Resolved' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {inc.status}
                    </span>
                 </div>
              </div>
           </div>
        ))}
        
        <div className="pt-4 mt-auto border-t border-white/5">
           <div className="flex items-center gap-2 p-3 rounded bg-black/40 font-mono text-xs text-[#7cff4e]">
              <Terminal className="w-4 h-4" />
              <span className="opacity-80">System stable. All clusters nominal.</span>
              <span className="animate-pulse">_</span>
           </div>
        </div>
     </div>
  </div>
  );
});
IncidentLog.displayName = "IncidentLog";

// --- Main Page ---

export default function SystemStatusPage() {
  return (
    <div className="relative w-full bg-transparent overflow-hidden">
      
      <div className="relative z-10 p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto text-slate-300">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-up delay-0">
          <div>
            <div className="flex items-center gap-2 text-sm text-[#94a3b8] mb-1">
              <span>Dashboard</span>
              <span className="text-[#334155]">/</span>
              <span className="text-[#7cff4e]">System Status</span>
            </div>
            <h1 className="text-2xl font-semibold text-[#e6eaf0] tracking-tight flex items-center gap-2">
              System Health
              <span className="text-xs px-2 py-0.5 rounded border border-green-500/30 bg-green-500/10 text-green-400">All Systems Operational</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1e293b]/50 border border-[#334155] text-xs font-medium text-[#7cff4e]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7cff4e] animate-pulse" />
                Live Monitoring
             </div>
          </div>
        </header>

        {/* KPI CARDS */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
           {/* API Uptime */}
           <SystemStatCard icon={Activity} label="Global Uptime" value="99.98%" subtext="Target: 99.90%" status="good" />
           {/* Avg Latency */}
           <SystemStatCard icon={Clock} label="Avg Latency" value="42ms" subtext="-8ms vs yesterday" status="good" />
           {/* Database Health */}
           <SystemStatCard icon={Database} label="DB Throughput" value="12k ops/s" subtext="Optimal Load" status="good" />
           {/* Security */}
           <SystemStatCard icon={ShieldCheck} label="Threats Blocked" value="0" subtext="Last 24h: 0" status="good" />
        </section>

        {/* MAIN CONTENT */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[600px]">
           {/* Left: Service Grid (2 cols) */}
           <div className="lg:col-span-2 h-full card-3d-hover animate-fade-in-up delay-300">
              <ServiceGrid />
           </div>
           
           {/* Right: Incident Log (1 col) */}
           <div className="lg:col-span-1 h-full card-3d-hover animate-fade-in-up delay-500">
              <IncidentLog />
           </div>
        </section>

      </div>
    </div>
  );
}
