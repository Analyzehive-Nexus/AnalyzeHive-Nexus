"use client"; // Indicates this component runs on the client side

// Import React hooks for state management and memoization
import { useMemo, useState } from "react";
// Import subordinate dashboard components
import StatCard from "@/components/dashboard/StatCard";
import InventoryChart from "@/components/dashboard/InventoryChart";
import ActiveBatchesTable from "@/components/dashboard/ActiveBatchesTable";
import CriticalAlerts from "@/components/dashboard/CriticalAlerts";
import WorldMap from "@/components/dashboard/WorldMap";
import { ArrowUpDown, Filter, AlertTriangle } from "lucide-react";

/* ------------------ DATA ------------------ */

// Static data for the inventory chart.
// Exported so it can potentially be used in tests or other components.
// Keeping it outside the component prevents re-creation on every render.
export const inventoryData = [
  { day: "01", value: 32 },
  { day: "05", value: 48 },
  { day: "10", value: 65 },
  { day: "15", value: 82 },
  { day: "20", value: 54 },
  { day: "25", value: 96 },
  { day: "30", value: 70 },
];

// Static mock data for the table.
// In a real app, this would likely be fetched from an API.
const tableData = [
  { sku: "P-001245", name: "Amoxicillin", risk: "92% High", day: "10" },
  { sku: "P-001246", name: "Lisinopril", risk: "15% Low", day: "05" },
  { sku: "P-001247", name: "Atorvastatin", risk: "45% Medium", day: "20" },
  { sku: "P-001248", name: "Amoxicillin", risk: "92% High", day: "25" },
  { sku: "P-001249", name: "Lisinopril", risk: "15% Low", day: "30" },
];

/* ------------------ STYLES ------------------ */



/* ------------------ PAGE ------------------ */

// The main Dashboard Page component
export default function DashboardPage() {
  // State for toggling "Sort by Risk" functionality
  const [sortByRisk, setSortByRisk] = useState(false);
  // State for toggling "High Risk Only" filter
  const [filterHigh, setFilterHigh] = useState(false);
  // State for tracking the currently selected day (e.g. from chart or table)
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // useMemo hook to process the table data based on current filters/sorts.
  // This ensures the data is only re-calculated when 'sortByRisk' or 'filterHigh' changes.
  const processed = useMemo(() => {
    // Create a shallow copy of tableData to avoid mutating the original array
    let rows = [...tableData];

    // Apply filter: If filterHigh is true, keep only rows where risk includes "High"
    if (filterHigh) rows = rows.filter((r) => r.risk.includes("High"));
    
    // Apply sort: If sortByRisk is true, sort descending by the numeric value in the risk string
    if (sortByRisk) rows.sort((a, b) => parseInt(b.risk) - parseInt(a.risk));

    // Return the processed array
    return rows;
  }, [sortByRisk, filterHigh]);

  // Render the page content
  return (
    // Main wrapper: dark background, full viewport height, overflow hidden to prevent scrollbars from background effects
    <div className="relative w-full bg-transparent overflow-hidden">
      
      {/* ================= CONTENT ================= */}      
      {/* Main content container */}
      <div className="relative z-10 space-y-10 p-4 md:p-8 perspective-container text-slate-300 selection:bg-[#7cff4e]/30 selection:text-[#7cff4e]">
        
        {/* Header Section */}
        <header className="animate-fade-in-up delay-0">
          {/* Dashboard Title */}
          <h1 className="text-2xl font-semibold text-[#e6eaf0] flex items-center gap-2">
            <span className="w-2 h-2 bg-[#7cff4e] rounded-full animate-pulse inline-block md:hidden"></span>
            Nexus
          </h1>
          {/* Subtitle / Tagline */}
          <p className="text-sm text-[#9aa4b2]">
            Live operational intelligence
          </p>
        </header>

        {/* KPI CARDS SECTION */}
        {/* Responsive Grid: 1 col mobile -> 2 cols tablet -> 5 cols desktop */}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="animate-fade-in-up delay-100"><StatCard title="Active Batches" value="1,245" /></div>
          <div className="animate-fade-in-up delay-200"><StatCard title="Delivery Accuracy" value="98.5%" /></div>
          <div className="animate-fade-in-up delay-300"><StatCard title="Total Shipments" value="1,462" /></div>
          <div className="animate-fade-in-up delay-400"><StatCard title="Risk Exposure" value="3.5%" /></div>
          <div className="animate-fade-in-up delay-500"><StatCard title="Regions Live" value="4" /></div>
        </section>

        {/* CHART + MAP SECTION */}
        {/* Responsive Grid: Stack on mobile, Side-by-side on desktop */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[400px]">
          <div className="lg:col-span-2 h-[300px] lg:h-full card-3d-hover animate-fade-in-up delay-500">
            {/* Inventory Chart Component */}
            <InventoryChart 
              data={inventoryData} 
              selectedDay={selectedDay} 
              onSelectDay={setSelectedDay}
            />
          </div>

          <div className="h-[300px] lg:h-full card-3d-hover animate-fade-in-up delay-700">
             {/* World Map Component */}
             <WorldMap />
          </div>
        </section>

        {/* FILTERS & CONTROLS TOOLBAR */}
        {/* FILTERS SECTION */}
        <section className="flex flex-wrap items-center gap-4 animate-fade-in-up delay-700">
          
          {/* Sort Button */}
          <button
            onClick={() => setSortByRisk((s) => !s)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md border text-sm transition-all
              ${sortByRisk 
                ? "bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]" 
                : "border-white/10 text-[#9aa4b2] hover:bg-white/5"
              }
            `}
          >
            <ArrowUpDown className="w-4 h-4" />
            <span>Sort by Risk</span>
          </button>

          {/* Filter Button */}
          <button
            onClick={() => setFilterHigh((f) => !f)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md border text-sm transition-all
              ${filterHigh
                ? "bg-red-500/10 border-red-500/30 text-red-400" 
                : "border-white/10 text-[#9aa4b2] hover:bg-white/5"
              }
            `}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>High Risk Only</span>
          </button>

        </section>

        {/* TABLE + ALERTS SECTION */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card-3d-hover animate-fade-in-up delay-300">
            {/* Active Batches Table Component */}
            <ActiveBatchesTable data={processed} onSelectDay={setSelectedDay} />
          </div>

          <div className="card-3d-hover animate-fade-in-up delay-500">
             {/* Critical Alerts Component */}
             <CriticalAlerts />
          </div>
        </section>
      </div>
    </div>
  );
}
