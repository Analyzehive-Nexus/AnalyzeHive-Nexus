"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

/**
 * The one KPI tile used across the workspace.
 *
 * `goodDirection` exists because "up" is not universally good: capital saved
 * rising is progress, value-at-risk rising is not. Colouring both green would
 * be actively misleading on an executive screen.
 */
export default function KpiTile({
  label,
  value,
  sublabel,
  changePct,
  goodDirection = "up",
  icon: Icon,
  emphasis = false,
}: {
  label: string;
  value: string;
  sublabel?: string;
  changePct?: number | null;
  goodDirection?: "up" | "down" | "neutral";
  icon?: LucideIcon;
  emphasis?: boolean;
}) {
  const hasChange = changePct !== null && changePct !== undefined && Number.isFinite(changePct);
  const rising = hasChange && changePct! > 0;
  const flat = hasChange && changePct === 0;

  const tone =
    !hasChange || flat || goodDirection === "neutral"
      ? "text-subtle"
      : (rising && goodDirection === "up") || (!rising && goodDirection === "down")
        ? "text-ok"
        : "text-danger";

  const Arrow = flat ? Minus : rising ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className={`rounded-xl border bg-surface p-5 shadow-card ${
        emphasis ? "border-accent-line" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />}
      </div>

      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-fg">{value}</p>

      <div className="mt-2 flex items-center gap-2 text-xs">
        {hasChange && (
          <span className={`inline-flex items-center gap-0.5 font-medium ${tone}`}>
            <Arrow className="h-3 w-3" aria-hidden="true" />
            {Math.abs(changePct!).toFixed(1)}%
          </span>
        )}
        {sublabel && <span className="text-subtle">{sublabel}</span>}
      </div>
    </div>
  );
}
