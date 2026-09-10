"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronRight,
  Database,
  ShieldAlert,
  Thermometer,
  Wallet,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import KpiTile from "@/components/dashboard/KpiTile";
import InventoryChart from "@/components/dashboard/InventoryChart";
import CriticalAlerts from "@/components/dashboard/CriticalAlerts";
import WorldMap from "@/components/dashboard/WorldMap";
import { api } from "@/lib/api";
import { useCurrency } from "@/lib/currency";
import { useFilters } from "@/lib/filters";
import { formatDays, formatRelative } from "@/lib/format";

/* ------------------------------------------------------------------ types */

interface Kpis {
  grossValueAtRisk: {
    valueMinor: number; unitsAtRisk: number; changePct: number | null; windowDays: number;
  };
  capitalSaved: { valueMinor: number; changePct: number | null };
  coldChain: { meanExcursionVarianceC: number; excursionReadings: number };
  erpSync: { system: string; lastSyncAt: string | null; latencyMs: number; status: string; isLive: boolean }[];
  series: { date: string; valueAtRiskMinor: number; capitalSavedMinor: number }[];
}

interface WatchlistItem {
  sku: string;
  batchCode: string | null;
  name: string;
  quantity: number;
  daysToExpiry: number;
  valueMinor: number;
  location: string;
  status: string;
}

/* ------------------------------------------------------------------- page */

export default function CommandCentrePage() {
  const router = useRouter();
  const { format } = useCurrency();
  const { range, region, rangeLabel } = useFilters();

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [batches, setBatches] = useState<WatchlistItem[]>([]);
  const [sortByRisk, setSortByRisk] = useState(false);
  const [filterHigh, setFilterHigh] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Kpis>(`/api/command-center/kpis?range=${range}&region=${region}`)
      .then((d) => !cancelled && setKpis(d))
      .catch(() => !cancelled && setKpis(null));
    return () => { cancelled = true; };
  }, [range, region]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ watchlist: WatchlistItem[] }>("/api/supply-chain/watchlist")
      .then((d) => !cancelled && setBatches(d.watchlist))
      .catch(() => !cancelled && setBatches([]));
    return () => { cancelled = true; };
  }, []);

  /**
   * A batch row is a lead, not a readout: clicking one carries the SKU into
   * the Redistribution Simulator with the batch preselected. Previously the
   * table was inert.
   */
  const openInSimulator = useCallback(
    (item: WatchlistItem) => {
      const params = new URLSearchParams({ sku: item.sku });
      if (item.batchCode) params.set("batch", item.batchCode);
      router.push(`/supply-chain-physics?${params.toString()}`);
    },
    [router]
  );

  const rows = useMemo(() => {
    let list = [...batches];
    if (filterHigh) list = list.filter((b) => b.status === "Critical");
    // Fewest days remaining first is "highest risk first".
    if (sortByRisk) list.sort((a, b) => a.daysToExpiry - b.daysToExpiry);
    return list.slice(0, 8);
  }, [batches, sortByRisk, filterHigh]);

  // The chart wants a compact series; the API returns one point per day.
  const chartData = useMemo(
    () =>
      (kpis?.series ?? []).map((p) => ({
        day: p.date.slice(8, 10),
        value: Math.round(p.valueAtRiskMinor / 100 / 100000), // paise -> Rs lakh
      })),
    [kpis]
  );

  const worstSync = useMemo(() => {
    if (!kpis?.erpSync?.length) return null;
    return [...kpis.erpSync].sort((a, b) => b.latencyMs - a.latencyMs)[0];
  }, [kpis]);

  return (
    <div className="space-y-8 text-muted">
      <PageHeader />

      {/* ----------------------------------------------------- executive KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          emphasis
          label="Gross value at expiry risk"
          value={format(kpis?.grossValueAtRisk.valueMinor, { compact: true })}
          sublabel={`${(kpis?.grossValueAtRisk.unitsAtRisk ?? 0).toLocaleString()} units in ${kpis?.grossValueAtRisk.windowDays ?? 150}-day window`}
          changePct={kpis?.grossValueAtRisk.changePct}
          goodDirection="down"
          icon={ShieldAlert}
        />
        <KpiTile
          emphasis
          label="Capital saved"
          value={format(kpis?.capitalSaved.valueMinor, { compact: true })}
          sublabel={`vs. expiry, ${rangeLabel.toLowerCase()}`}
          changePct={kpis?.capitalSaved.changePct}
          goodDirection="up"
          icon={Wallet}
        />
        <KpiTile
          label="Mean cold-chain variance"
          value={kpis ? `${kpis.coldChain.meanExcursionVarianceC.toFixed(2)} °C` : "—"}
          sublabel={`${kpis?.coldChain.excursionReadings ?? 0} readings out of band`}
          goodDirection="neutral"
          icon={Thermometer}
        />
        <KpiTile
          label="ERP sync latency"
          value={worstSync ? `${(worstSync.latencyMs / 1000).toFixed(1)}s` : "—"}
          sublabel={worstSync ? `slowest: ${worstSync.system}` : undefined}
          goodDirection="neutral"
          icon={Database}
        />
      </section>

      {/* ------------------------------------------------------- ERP freshness */}
      <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-fg">Systems of record</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(kpis?.erpSync ?? []).map((s) => (
            <div key={s.system} className="rounded-lg border border-line bg-elevated p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-fg">{s.system}</p>
                <span className="flex shrink-0 items-center gap-1.5">
                  {s.isLive && (
                    <span className="rounded-full border border-ok-line bg-ok-tint px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ok">
                      Live
                    </span>
                  )}
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      s.status === "healthy" ? "bg-ok" : s.status === "lagging" ? "bg-warn" : "bg-danger"
                    }`}
                    aria-hidden="true"
                  />
                </span>
              </div>
              <p className="mt-1 text-xs text-subtle">
                {formatRelative(s.lastSyncAt)} · {s.latencyMs} ms
              </p>
            </div>
          ))}
          {!kpis && <p className="text-sm text-subtle">Loading systems of record…</p>}
        </div>
      </section>

      {/* -------------------------------------------------------- chart + map */}
      <section className="grid h-auto grid-cols-1 gap-6 lg:h-[400px] lg:grid-cols-3">
        <div className="h-[300px] lg:col-span-2 lg:h-full">
          <InventoryChart
            data={chartData}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            title="Capital at expiry risk"
            subtitle={`Gross value exposed, ${rangeLabel.toLowerCase()} (₹ lakh)`}
            badge={rangeLabel.toUpperCase()}
            valueLabel="₹ lakh"
          />
        </div>
        <div className="h-[300px] lg:h-full">
          <WorldMap />
        </div>
      </section>

      {/* ------------------------------------------------- actionable batches */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-fg">Batches at risk</h2>
                <p className="text-xs text-subtle">Select a batch to model a redistribution</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortByRisk((v) => !v)}
                  aria-pressed={sortByRisk}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                    sortByRisk
                      ? "border-accent-line bg-accent-tint text-accent"
                      : "border-line-strong bg-surface text-muted hover:text-fg"
                  }`}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" /> Sort by risk
                </button>
                <button
                  onClick={() => setFilterHigh((v) => !v)}
                  aria-pressed={filterHigh}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                    filterHigh
                      ? "border-danger-line bg-danger-tint text-danger"
                      : "border-line-strong bg-surface text-muted hover:text-fg"
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Critical only
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-elevated text-xs text-subtle">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Batch</th>
                    <th className="px-5 py-3 text-left font-medium">Product</th>
                    <th className="px-5 py-3 text-right font-medium">Expiry</th>
                    <th className="px-5 py-3 text-right font-medium">Value</th>
                    <th className="px-5 py-3 text-right font-medium sr-only">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr
                      key={b.batchCode ?? b.sku}
                      onClick={() => openInSimulator(b)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && openInSimulator(b)}
                      className="group cursor-pointer border-t border-line transition hover:bg-elevated"
                    >
                      <td className="px-5 py-3 font-mono text-xs text-fg">{b.batchCode ?? "—"}</td>
                      <td className="px-5 py-3 text-fg">
                        {b.name}
                        <span className="ml-2 text-xs text-subtle">{b.location}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            b.status === "Critical"
                              ? "border-danger-line bg-danger-tint text-danger"
                              : b.status === "Warning"
                                ? "border-warn-line bg-warn-tint text-warn"
                                : "border-ok-line bg-ok-tint text-ok"
                          }`}
                        >
                          {formatDays(b.daysToExpiry)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-fg">
                        {format(b.valueMinor)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <ChevronRight
                          className="ml-auto h-4 w-4 text-faint transition group-hover:translate-x-0.5 group-hover:text-accent"
                          aria-hidden="true"
                        />
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-subtle">
                        No batches match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <CriticalAlerts />
        </div>
      </section>
    </div>
  );
}
