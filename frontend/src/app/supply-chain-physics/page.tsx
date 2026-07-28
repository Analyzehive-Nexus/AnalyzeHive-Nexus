"use client";

import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Box,
  AlertTriangle,
  Clock,
  TrendingDown,
  ArrowRight,
  PackageCheck,
  ChevronRight,
  MoreVertical,
  RefreshCw,
  ClipboardList,
  Settings2,
  CheckCircle2,
  X
} from "lucide-react";
import { api } from "@/lib/api";

// --- Mock Data ---

interface WatchlistItem {
  sku: string;
  name: string;
  risk: string;
  value: string;
  location: string;
  status: string;
}

const initialWatchlist: WatchlistItem[] = [
  { sku: "SKU-9988", name: "Insulin Glargine 100U/ml", risk: "120 days", value: "₹52,000", location: "North", status: "Critical" },
  { sku: "SKU-7721", name: "Atorvastatin 40mg", risk: "145 days", value: "₹28,000", location: "West", status: "Warning" },
  { sku: "SKU-5532", name: "Metformin XR 1000mg", risk: "156 days", value: "₹15,000", location: "East", status: "Good" },
  { sku: "SKU-3345", name: "Omeprazole 20mg", risk: "180 days", value: "₹22,000", location: "South", status: "Good" },
];


// --- Styles ---
const floatAnimation = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  .animate-float {
    animation: float 6s ease-in-out infinite;
  }
`;
// --- Sub-Components ---

// 1. KPI Card
const PhysicsStatCard = ({ icon: Icon, value, label, subtext, alert = false }: any) => (
  <div className="bg-[#0f141b] border border-white/5 p-5 rounded-xl flex items-start justify-between relative overflow-hidden group hover:border-[#7cff4e]/30 transition-all duration-300">
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`w-5 h-5 ${alert ? 'text-[#7cff4e]' : 'text-[#7cff4e]'}`} />
        <h3 className="text-2xl font-bold text-[#e6eaf0]">{value}</h3>
      </div>
      <p className="text-xs text-[#94a3b8]">{label}</p>
    </div>
    {subtext && (
       <div className="text-right">
          <p className="text-[10px] text-[#94a3b8] mb-1">Impact</p>
          <p className="text-xs font-medium text-white">{subtext}</p>
       </div>
    )}
  </div>
);

// 2. Redistribution Simulator (Interactive)
const RedistributionSimulator = memo(() => {
  const [transferUnits, setTransferUnits] = useState(3000); 
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferComplete, setTransferComplete] = useState(false);
  const [alertAcknowledged, setAlertAcknowledged] = useState(false);
  
  // Dynamic Stock Levels (Simulated)
  const [stockNorth, setStockNorth] = useState(142);
  const [stockWest, setStockWest] = useState(68);

  // Adjustable simulation constants (editable via the "Adjust" panel)
  const [showAdjust, setShowAdjust] = useState(false);
  const [costPerUnit, setCostPerUnit] = useState(5.17);
  const TOTAL_AVAILABLE = 5240;

  // Review Plan panel
  const [showPlan, setShowPlan] = useState(false);
  const [plan, setPlan] = useState<{ summary: string; steps: string[] } | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  const openPlan = () => {
    setShowPlan(true);
    if (plan) return;
    setPlanLoading(true);
    api
      .get<{ summary: string; steps: string[] }>("/api/supply-chain/plan")
      .then(setPlan)
      .catch(() => setPlan({ summary: "Failed to load plan.", steps: [] }))
      .finally(() => setPlanLoading(false));
  };

  // Derived values
  const projectedSavings = Math.floor(transferUnits * costPerUnit).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const transferPercentage = Math.round((transferUnits / TOTAL_AVAILABLE) * 100);

  const handleApprove = () => {
      setIsTransferring(true);
      // Simulate network request / processing
      setTimeout(() => {
          setIsTransferring(false);
          setTransferComplete(true);
          
          // Update simulated stock levels based on transfer (simple approximation for visual feedback)
          const impact = Math.round((transferUnits / 3000) * 15); // ~15% shift for 3000 units
          setStockNorth(prev => prev - impact);
          setStockWest(prev => prev + impact);

          // Reset success state after a few seconds
          setTimeout(() => setTransferComplete(false), 3000);
      }, 1500);
  };

  return (
    <div className="bg-[#0f141b] border border-white/5 rounded-xl p-6 h-full flex flex-col relative overflow-hidden group">
       {/* Background Glow - Dynamic based on activity */}
       <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#7cff4e]/5 blur-[120px] transition-opacity duration-1000 ${isTransferring ? 'opacity-100 scale-125' : 'opacity-50'}`} />
       
       {/* Header */}
       <div className="flex justify-between items-start mb-8 relative z-10">
         <div>
            <h3 className="text-lg font-bold text-[#e6eaf0] flex items-center gap-2">
            <Box className="w-5 h-5 text-[#7cff4e]" /> Redistribution Simulator
            </h3>
         </div>
         <span className="text-[10px] font-bold text-[#7cff4e] bg-[#7cff4e]/10 px-2 py-1 rounded border border-[#7cff4e]/20 tracking-wider">
            AI RECOMMENDED
         </span>
       </div>

       {/* Simulation Flow Config */}
       <div className="flex items-center gap-4 relative z-10 mb-8">
          
          {/* Source Card */}
          <div className={`flex-1 transition-all duration-500 bg-[#1a0f0f] border p-5 rounded-2xl relative shadow-[0_0_30px_rgba(239,68,68,0.05)] ${alertAcknowledged ? 'border-white/10 opacity-75 grayscale' : 'border-red-500/30'}`}>
             <div className="flex justify-between items-start mb-4">
               <div>
                  <p className={`text-[10px] font-bold mb-1 flex items-center gap-1 uppercase tracking-widest ${alertAcknowledged ? 'text-[#94a3b8]' : 'text-red-500'}`}>
                  <AlertTriangle className="w-3 h-3" /> Source
                  </p>
                  <h4 className="text-xl font-bold text-white">Warehouse North</h4>
                  <p className="text-xs text-[#94a3b8]">Surplus - Risk Zone</p>
               </div>
             </div>
             
             <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                   <span className="text-[#64748b]">Stock Level</span>
                   <span className="text-white font-bold transition-all duration-1000">{stockNorth}%</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                   <span className="text-[#64748b]">Expiry Risk</span>
                   <span className={`font-bold uppercase ${alertAcknowledged ? 'text-[#94a3b8]' : 'text-red-500'}`}>High</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                   <span className="text-[#64748b]">Units Available</span>
                   <span className="text-white font-bold">5,240</span>
                </div>
             </div>

             {/* Action Button */}
             <button 
                onClick={() => setAlertAcknowledged(true)}
                disabled={alertAcknowledged}
                className={`w-full mt-4 text-[10px] font-bold py-2 rounded border transition flex items-center justify-between px-3 ${
                    alertAcknowledged 
                    ? 'bg-transparent border-white/5 text-[#64748b] cursor-default' 
                    : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                }`}
             >
               <span>{alertAcknowledged ? 'ACKNOWLEDGED' : 'ACKNOWLEDGE ALERT'}</span>
               {alertAcknowledged ? <CheckCircle2 className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
             </button>
          </div>

          {/* Central Transfer Icon (Float) */}
          <div className="z-20 flex flex-col items-center shrink-0 animate-float">
             <div className={`w-14 h-14 rounded-full bg-[#0b0f14] border-2 border-[#7cff4e] shadow-[0_0_20px_rgba(124,255,78,0.4)] flex items-center justify-center relative transition-all duration-300 ${isTransferring ? 'scale-110 border-white' : ''}`}>
                <div className={`absolute inset-0 rounded-full border border-[#7cff4e] opacity-20 ${isTransferring ? 'animate-ping' : ''}`} />
                <ArrowRight className={`w-6 h-6 text-[#7cff4e] transition-transform ${isTransferring ? 'translate-x-1' : ''}`} />
             </div>
             <span className="text-[9px] font-bold text-[#7cff4e] mt-2 tracking-widest bg-[#0b0f14] px-1">
                 {isTransferring ? 'MOVING...' : 'TRANSFER'}
             </span>
          </div>

          {/* Destination Card */}
          <div className="flex-1 bg-[#0f1d15] border border-green-500/30 p-5 rounded-2xl relative shadow-[0_0_30px_rgba(34,197,94,0.05)]">
             <div className="flex justify-between items-start mb-4">
               <div>
                  <p className="text-[10px] font-bold text-green-500 mb-1 flex items-center gap-1 uppercase tracking-widest">
                  <PackageCheck className="w-3 h-3" /> Destination
                  </p>
                  <h4 className="text-xl font-bold text-white">Warehouse West</h4>
                  <p className="text-xs text-[#94a3b8]">High Demand Zone</p>
               </div>
             </div>
             
             <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                   <span className="text-[#64748b]">Stock Level</span>
                   <span className="text-white font-bold transition-all duration-1000">{stockWest}%</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                   <span className="text-[#64748b]">Demand Trend</span>
                   <span className="text-green-400 font-bold">+24%</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                   <span className="text-[#64748b]">Capacity</span>
                   <span className="text-white font-bold">Available</span>
                </div>
             </div>

             {/* Action Button */}
             <button 
               onClick={() => setIsSyncing(!isSyncing)}
               className={`w-full mt-4 text-[10px] font-bold py-2 rounded border transition flex items-center justify-between px-3 ${
                 isSyncing ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20'
               }`}
             >
               <span className="flex items-center gap-2">
                 <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} /> 
                 {isSyncing ? 'SYNCING...' : 'CAPACITY SYNCING'}
               </span>
               <ChevronRight className="w-3 h-3" />
             </button>
          </div>

       </div>

       {/* Slider & Savings Panel */}
       <div className="flex-1 bg-white/[0.02] border-t border-white/5 -mx-6 -mb-6 p-6 mt-auto backdrop-blur-sm">
          <div className="flex justify-between items-end mb-4">
             <div>
                <p className="text-sm text-[#94a3b8] mb-1">Projected Savings</p>
                <div className="flex items-baseline gap-2">
                   <h2 className="text-4xl font-bold text-[#7cff4e] tracking-tight tabular-nums transition-all">{projectedSavings}</h2>
                   <span className="text-xs text-[#64748b]">by avoiding expiry</span>
                </div>
             </div>
             
             {/* secondary actions */}
             <div className="flex gap-2">
                <button
                  onClick={openPlan}
                  className="px-3 py-1.5 rounded border border-white/10 text-[10px] text-[#94a3b8] hover:text-white hover:bg-white/5 transition flex items-center gap-1"
                >
                   <ClipboardList className="w-3 h-3" /> Review Plan
                </button>
                <button
                  onClick={() => setShowAdjust((s) => !s)}
                  className={`px-3 py-1.5 rounded border text-[10px] transition flex items-center gap-1 ${showAdjust ? "border-[#7cff4e]/40 bg-[#7cff4e]/10 text-[#7cff4e]" : "border-white/10 text-[#94a3b8] hover:text-white hover:bg-white/5"}`}
                >
                   <Settings2 className="w-3 h-3" /> Adjust
                </button>
             </div>
          </div>

          {showAdjust && (
            <div className="mb-4 p-3 rounded-lg bg-black/20 border border-white/5 flex items-center justify-between">
              <label className="text-xs text-[#94a3b8]">Cost saved per unit ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(Math.max(0, Number(e.target.value)))}
                className="w-24 bg-[#0b0f14] border border-white/10 text-sm text-white rounded px-2 py-1 text-right focus:outline-none focus:border-[#7cff4e]/50"
              />
            </div>
          )}

          {showPlan &&
            createPortal(
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                onClick={() => setShowPlan(false)}
              >
                <div
                  className="w-full max-w-md rounded-xl bg-[#0f141b] border border-white/10 p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#e6eaf0]">Redistribution Plan</h3>
                    <button onClick={() => setShowPlan(false)} className="text-[#64748b] hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {planLoading ? (
                    <p className="text-xs text-[#94a3b8]">Loading plan…</p>
                  ) : (
                    <>
                      <p className="text-xs text-[#cbd5e1] leading-relaxed mb-4">{plan?.summary}</p>
                      <ol className="space-y-2">
                        {plan?.steps.map((step, i) => (
                          <li key={i} className="text-xs text-[#94a3b8] flex gap-2">
                            <span className="text-[#7cff4e] font-bold">{i + 1}.</span> {step}
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </div>
              </div>,
              document.body
            )}

          {/* Interactive Slider */}
          <div className="mb-6 relative h-8 flex items-center group/slider">
             {/* Slider Track */}
             <div className="absolute w-full h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-500 via-yellow-400 to-[#7cff4e]" style={{ width: `${transferPercentage}%` }} />
             </div>
             
             {/* Invisible Range Input for Interaction */}
             <input
               type="range"
               min="0"
               max={TOTAL_AVAILABLE}
               value={transferUnits}
               onChange={(e) => setTransferUnits(Number(e.target.value))}
               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
             />

             {/* Custom Thumb (simulated) */}
             <div 
               className="absolute w-5 h-5 bg-[#7cff4e] rounded-full border-2 border-white shadow-[0_0_15px_rgba(124,255,78,0.5)] flex items-center justify-center pointer-events-none transition-transform group-hover/slider:scale-110"
               style={{ left: `${transferPercentage}%`, transform: 'translateX(-50%)' }}
             >
               <div className="w-1.5 h-1.5 bg-[#0b0f14] rounded-full" />
             </div>
             
             {/* Value Label */}
             <div className="absolute top-1 text-center pointer-events-none transition-all duration-200" style={{ left: `${transferPercentage}%`, transform: 'translateX(-50%) translateY(-35px)' }}>
                <span className="text-lg font-bold text-white font-mono bg-[#0f141b]/90 px-2 py-0.5 rounded border border-[#7cff4e]/20">{transferUnits.toLocaleString()}</span>
             </div>
          </div> 
          
          <div className="flex items-center justify-between text-xs text-[#64748b] mb-4 font-mono">
             <span>Transfer {transferUnits} units from Warehouse North to Warehouse West?</span>
          </div>

          <button 
            onClick={handleApprove}
            disabled={isTransferring || transferComplete}
            className={`w-full font-bold text-sm py-3 rounded-lg shadow-[0_0_20px_rgba(124,255,78,0.2)] transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 ${
                transferComplete ? 'bg-green-500 text-white' : 
                isTransferring ? 'bg-[#7cff4e]/50 text-[#0b0f14] cursor-process' : 
                'bg-[#7cff4e] hover:bg-[#4ade80] text-[#0b0f14]'
            }`}
          >
             {transferComplete ? (
                 <> <CheckCircle2 className="w-4 h-4" /> Transfer Successful </>
             ) : isTransferring ? (
                 <> <RefreshCw className="w-4 h-4 animate-spin" /> Processing Transfer... </>
             ) : (
                 'Approve Transfer'
             )}
          </button>
       </div>

    </div>
  );
});

RedistributionSimulator.displayName = "RedistributionSimulator";

// 3. Expiry Watchlist
const ExpiryWatchlist = memo(() => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(initialWatchlist);
  const [expanded, setExpanded] = useState(false);
  const [loadingFull, setLoadingFull] = useState(false);

  const viewFullWatchlist = () => {
    if (expanded) {
      setExpanded(false);
      setWatchlist(initialWatchlist);
      return;
    }
    setLoadingFull(true);
    api
      .get<{ watchlist: WatchlistItem[] }>("/api/supply-chain/watchlist")
      .then((data) => {
        setWatchlist(data.watchlist);
        setExpanded(true);
      })
      .catch(() => {})
      .finally(() => setLoadingFull(false));
  };

  return (
    <div className="bg-[#0f141b] border border-white/5 rounded-xl p-6 h-full flex flex-col">
       <div className="flex justify-between items-center mb-6">
         <h3 className="text-base font-semibold text-[#e6eaf0] flex items-center gap-2">
           <Clock className="w-4 h-4 text-[#eab308]" /> Expiry Watchlist
         </h3>
         <MoreVertical className="w-4 h-4 text-[#64748b] cursor-pointer" />
       </div>

       <div className="flex-1 min-h-0 space-y-3 overflow-y-auto px-1 custom-scrollbar">
         {watchlist.map((item, idx) => (
           <div key={idx} className={`p-4 rounded-lg border flex justify-between items-center group transition-colors ${
             item.status === 'Critical' ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40' :
             item.status === 'Warning' ? 'bg-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/40' :
             'bg-green-500/5 border-green-500/20 hover:border-green-500/40'
           }`}>
             <div>
               <div className="flex items-center gap-2 mb-1">
                 <span className="text-[10px] text-[#64748b] font-mono">{item.sku}</span>
                 {item.status === 'Critical' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
               </div>
               <h4 className="text-sm font-bold text-[#e6eaf0]">{item.name}</h4>
               <p className="text-[10px] text-[#94a3b8] mt-1">Value at Risk: <span className="text-[#e6eaf0]">{item.value}</span></p>
             </div>
             
             <div className="text-right">
                <span className={`px-2 py-1 rounded text-[10px] font-bold border ${
                  item.status === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  item.status === 'Warning' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                  'bg-green-500/10 text-green-400 border-green-500/20'
                }`}>
                  {item.risk}
                </span>
                <p className="text-[10px] text-[#64748b] mt-2 text-right">{item.location}</p>
             </div>
           </div>
         ))}
       </div>
       
       <button
         onClick={viewFullWatchlist}
         disabled={loadingFull}
         className="mt-4 w-full text-xs text-[#7cff4e] hover:text-[#4ade80] flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
       >
          {loadingFull ? "Loading…" : expanded ? "Show Less" : "View Full Watchlist"} <ArrowRight className="w-3 h-3" />
       </button>
    </div>
  );
});

ExpiryWatchlist.displayName = "ExpiryWatchlist";

// --- Main Page Component ---

// --- Main Page Component ---

export default function SupplyChainPhysicsPage() {
  return (
    <div className="relative min-h-screen w-full bg-transparent overflow-hidden text-slate-300 selection:bg-[#7cff4e]/30 selection:text-[#7cff4e]">
      <style jsx global>{floatAnimation}</style>
      {/* ================= CONTENT ================= */}
      <div className="relative z-10 space-y-10 p-8 perspective-container">
        
        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center pb-2 border-b border-white/5 animate-fade-in-up delay-0">
          <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
            <span className="hover:text-white transition-colors cursor-pointer">Dashboard</span>
            <ChevronRight className="w-4 h-4" />
            <span className="hover:text-white transition-colors cursor-pointer">Supply Chain Physics</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-[#e6eaf0] font-medium">Redistribution</span>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 shadow-[0_0_10px_rgba(74,222,128,0.2)]">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
               </span>
               NVIDIA GPU Cluster: Active
             </div>
             <div className="text-xs text-[#64748b]">
               Last Sync: Salesforce (1m ago)
             </div>
          </div>
        </header>

        {/* KPI Grid */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 perspective-container">
          <div className="animate-fade-in-up delay-100">
            <PhysicsStatCard icon={Box} value="₹103Cr" label="Total Inventory Value" alert={true} />
          </div>
          <div className="animate-fade-in-up delay-200">
            <PhysicsStatCard icon={AlertTriangle} value="₹10Cr" label="At Risk Value" subtext="High Exposure" />
          </div>
          <div className="animate-fade-in-up delay-300">
             <PhysicsStatCard icon={Clock} value="45" label="Days to Critical" />
          </div>
          <div className="animate-fade-in-up delay-400">
             <PhysicsStatCard icon={TrendingDown} value="23%" label="Entropy Reduction" />
          </div>
        </section>

        {/* Main Content Split: row height follows the simulator's natural content height */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
          {/* Left: Simulator (3/5 width) */}
          <div className="lg:col-span-3 h-full min-h-0 animate-fade-in-up delay-500 card-3d-hover">
             <RedistributionSimulator />
          </div>

          {/* Right: Watchlist (2/5 width) */}
          <div className="lg:col-span-2 h-full min-h-0 animate-fade-in-up delay-700 card-3d-hover">
             <ExpiryWatchlist />
          </div>
        </section>

      </div>
    </div>
  );
}
