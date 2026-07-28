"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { memo } from "react";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="backdrop-blur-xl bg-[#0b0f14]/90 border border-[#334155]/50 p-3 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <p className="text-xs text-[#94a3b8] mb-1 font-medium">Day {label}</p>
        <p className="text-lg font-bold text-white flex items-center gap-2">
          {payload[0].value} <span className="text-[10px] font-normal text-[#7cff4e] bg-[#7cff4e]/10 px-1.5 py-0.5 rounded">Entropy</span>
        </p>
      </div>
    );
  }
  return null;
};

interface InventoryChartProps {
  data: { day: string; value: number }[];
  selectedDay: string | null;
  onSelectDay?: (day: string | null) => void;
}

function InventoryChart({
  data,
  selectedDay,
  onSelectDay
}: InventoryChartProps) {
  return (
    <div className="h-full rounded-2xl bg-[#0f141b]/60 backdrop-blur-sm border border-[#1e293b] p-5 relative overflow-hidden group hover:border-[#7cff4e]/30 transition-colors duration-500">
      
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#7cff4e]/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Chart Title */}
      <div className="relative z-10 flex justify-between items-start mb-6">
        <div>
          <h3 className="font-semibold text-white flex items-center gap-2">
            Inventory Entropy
            {selectedDay && (
              <span className="text-[10px] bg-[#7cff4e]/20 text-[#7cff4e] px-2 py-0.5 rounded-full animate-fade-in-up">
                 Filter: Day {selectedDay}
              </span>
            )}
          </h3>
          <p className="text-xs text-[#64748b] mt-1">Real-time fluctuation analysis</p>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 bg-[#7cff4e]/5 border border-[#7cff4e]/20 rounded-lg">
           <span className="w-1.5 h-1.5 rounded-full bg-[#7cff4e] animate-pulse" />
           <span className="text-[10px] text-[#7cff4e] font-medium tracking-wide">LIVE 30D</span>
        </div>
      </div>

      {/* Chart Container */}
      <div className="h-[250px] lg:h-[calc(100%-60px)] w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart 
            data={data} 
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            onClick={(e) => {
              if (e && e.activeLabel && onSelectDay) {
                // Toggle: if clicking same day, clear it, else set it
                const clickedDay = String(e.activeLabel);
                onSelectDay(clickedDay === selectedDay ? null : clickedDay);
              }
            }}
          >
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7cff4e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#7cff4e" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid 
              stroke="rgba(255,255,255,0.03)" 
              vertical={false} 
              strokeDasharray="4 4" 
            />
            
            <XAxis 
              dataKey="day" 
              stroke="#475569" 
              tick={{ fill: "#64748b", fontSize: 10 }} 
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis 
              stroke="#475569" 
              tick={{ fill: "#64748b", fontSize: 10 }} 
              tickLine={false}
              axisLine={false}
            />
            
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ stroke: '#7cff4e', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            
            {/* Highlight Selected Day */}
            {selectedDay && (
               <ReferenceLine x={selectedDay} stroke="#7cff4e" strokeWidth={1} strokeDasharray="3 3" />
            )}

            <Area
              type="monotone"
              dataKey="value"
              stroke="#7cff4e"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorValue)"
              animationDuration={1500}
              activeDot={{ r: 6, fill: "#0b0f14", stroke: "#7cff4e", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(InventoryChart);
