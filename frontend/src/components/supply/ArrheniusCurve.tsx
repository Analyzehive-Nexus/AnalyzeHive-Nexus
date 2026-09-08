"use client";

import { memo } from "react";
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { palette } from "@/lib/theme";

export interface CurvePoint { tempC: number; shelfLifeDays: number; relativeRate: number }

/**
 * Arrhenius degradation curve: remaining shelf life against temperature.
 *
 * The shape is the point - degradation rate rises exponentially with
 * temperature, so a lane a few degrees warmer is not a few percent worse. The
 * reference line marks the temperature the shelf life was qualified at.
 */
function ArrheniusCurve({
  curve,
  referenceTempC,
  laneAmbientC,
  transitHours,
}: {
  curve: CurvePoint[];
  referenceTempC: number;
  laneAmbientC?: number | null;
  transitHours?: number | null;
}) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={curve} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="arrFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={palette.accent} stopOpacity={0.18} />
              <stop offset="95%" stopColor={palette.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={palette.line} vertical={false} strokeDasharray="4 4" />
          <XAxis
            dataKey="tempC"
            stroke={palette.line}
            tick={{ fill: palette.subtle, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}°`}
          />
          <YAxis
            stroke={palette.line}
            tick={{ fill: palette.subtle, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: palette.surface,
              border: `1px solid ${palette.line}`,
              borderRadius: 8,
              fontSize: 12,
              color: palette.fg,
            }}
            formatter={(value) => [`${Number(value)} days`, "Shelf life"] as [string, string]}
            labelFormatter={(l) => `${l} °C`}
          />
          <ReferenceLine
            x={referenceTempC}
            stroke={palette.faint}
            strokeDasharray="3 3"
            label={{ value: "qualified", fontSize: 9, fill: palette.subtle, position: "top" }}
          />
          {/* Where the selected lane would actually sit. */}
          {laneAmbientC !== null && laneAmbientC !== undefined && (
            <ReferenceLine
              x={laneAmbientC}
              stroke={palette.danger}
              strokeDasharray="3 3"
              label={{
                value: transitHours ? `lane · ${transitHours}h` : "lane",
                fontSize: 9,
                fill: palette.danger,
                position: "top",
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="shelfLifeDays"
            stroke={palette.accent}
            strokeWidth={2.5}
            fill="url(#arrFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(ArrheniusCurve);
