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
import { palette } from "@/lib/theme";

// Recharts calls this with a loosely-typed payload; narrow it to what we read.
interface TooltipEntry {
  value?: number | string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
  valueLabel = "Entropy",
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  valueLabel?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-line p-3 rounded-lg shadow-overlay">
        <p className="text-xs text-muted mb-1 font-medium">Day {label}</p>
        <p className="text-lg font-bold text-fg flex items-center gap-2">
          {payload[0].value} <span className="text-[10px] font-normal text-accent bg-accent-tint px-1.5 py-0.5 rounded">{valueLabel}</span>
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
  title?: string;
  subtitle?: string;
  badge?: string;
  /** Label for the tooltip's value, e.g. "Rs lakh at risk". */
  valueLabel?: string;
}

function InventoryChart({
  data,
  selectedDay,
  onSelectDay,
  title = "Inventory entropy",
  subtitle = "Real-time fluctuation analysis",
  badge = "LIVE 30D",
  valueLabel = "Entropy",
}: InventoryChartProps) {
  return (
    <div className="h-full rounded-2xl bg-surface backdrop-blur-sm border border-line p-5 relative overflow-hidden group hover:border-accent-line transition-colors duration-500">
      
      {/* Chart Title */}
      <div className="relative z-10 flex justify-between items-start mb-6">
        <div>
          <h3 className="font-semibold text-fg flex items-center gap-2">
            {title}
            {selectedDay && (
              <span className="text-[10px] bg-accent-tint text-accent px-2 py-0.5 rounded-full animate-fade-in-up">
                 Filter: Day {selectedDay}
              </span>
            )}
          </h3>
          <p className="text-xs text-subtle mt-1">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 bg-accent-tint border border-accent-line rounded-lg">
           <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
           <span className="text-[10px] text-accent font-medium tracking-wide">{badge}</span>
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
                <stop offset="5%" stopColor={palette.accent} stopOpacity={0.18} />
                <stop offset="95%" stopColor={palette.accent} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid 
              stroke={palette.line} 
              vertical={false} 
              strokeDasharray="4 4" 
            />
            
            <XAxis 
              dataKey="day" 
              stroke={palette.line}
              tick={{ fill: palette.subtle, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis 
              stroke={palette.line}
              tick={{ fill: palette.subtle, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            
            <Tooltip 
              content={<CustomTooltip valueLabel={valueLabel} />} 
              cursor={{ stroke: palette.faint, strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            
            {/* Highlight Selected Day */}
            {selectedDay && (
               <ReferenceLine x={selectedDay} stroke={palette.accent} strokeWidth={1} strokeDasharray="3 3" />
            )}

            <Area
              type="monotone"
              dataKey="value"
              stroke={palette.accent}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorValue)"
              animationDuration={1500}
              activeDot={{ r: 5, fill: palette.surface, stroke: palette.accent, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(InventoryChart);
