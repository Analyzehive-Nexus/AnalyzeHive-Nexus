"use client"; // Indicates this is a Client Component

// Import memo for performance optimization
import { memo } from "react";

// StatCard component definition.
// Displays a single statistic with a title, value, and visual indicators.
function StatCard({
  title, // Title of the statistic (e.g., "Active Batches")
  value, // The value to display (e.g., "1,245")
}: {
  title: string;
  value: string;
}) {
  // Determine if the metric is "good" based on a simple heuristic (example logic)
  const isGood = value.includes("%") && parseFloat(value) > 90;

  // Determine if this card represents a "Risk" metric based on the title
  const isRisk = title.toLowerCase().includes("risk");

  // Determine the accent color based on the status (good, risk, or neutral)
  const accent = isGood ? "#7cff4e" : isRisk ? "#fbbf24" : "#60a5fa";

  // Render the card
  return (
    // Card container: relative positioning, dark background, border, padding, and a hover glow effect
    <div className="relative rounded-xl bg-[#0f141b] border border-white/5 p-5 glow-hover">
      {/* Accent glow bar at the top */}
      <div
        className="absolute inset-x-0 top-0 h-[2px] rounded-full"
        style={{ background: accent }} // Dynamic background color
      />

      {/* Title text */}
      <p className="text-xs uppercase tracking-wide text-[#9aa4b2]">{title}</p>

      {/* Value text */}
      <p
        className="mt-2 text-2xl font-semibold tracking-tight"
        style={{ color: accent }} // Color matches the accent
      >
        {value}
      </p>

      {/* Subtitle / Footer text */}
      <p className="mt-2 text-xs text-[#6b7280]">Compared to last week</p>
    </div>
  );
}

// Export the component wrapped in React.memo.
// This prevents the card from re-rendering if title/value props haven't changed.
export default memo(StatCard);
