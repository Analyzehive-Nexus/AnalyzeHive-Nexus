/**
 * Display formatting for values the API deliberately sends raw.
 *
 * The database stores timestamps, integer paise, and expiry dates - never
 * "2m ago", "₹52,000" or "120 days". Those are presentation: a stored "2m ago"
 * is wrong two minutes later, and a stored "₹52,000" cannot be summed or
 * sorted. Everything that turns data into words lives here.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now" / "12m ago" / "3h ago" / "Yesterday" / "4 days ago" / "10 Jan". */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";

  const elapsed = Date.now() - then;
  if (elapsed < 0) return formatDateTime(iso); // clock skew, or a future row
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < 2 * DAY) return "Yesterday";
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)} days ago`;
  return formatDate(iso);
}

/** "10 Jan · 13:42" - in the viewer's own timezone, which is why the API sends UTC. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(iso)} · ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** "10 Jan". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Integer paise -> "₹52,000". Money is never a float and never a stored string. */
export function formatInr(valueMinor: number | null | undefined): string {
  if (valueMinor === null || valueMinor === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(valueMinor / 100);
}

/** Days remaining, counted from today's date rather than frozen at write time. */
export function formatDays(days: number | null | undefined): string {
  if (days === null || days === undefined) return "—";
  if (days < 0) return "Expired";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** "99.99%", or "N/A" for a service that reports no uptime (e.g. in maintenance). */
export function formatUptime(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return "N/A";
  return `${pct.toFixed(2)}%`;
}

/** "24ms", or "--" when no probe has reported for that service yet. */
export function formatLatency(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "--";
  return `${ms}ms`;
}
