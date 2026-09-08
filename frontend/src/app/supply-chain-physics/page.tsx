"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock, FileText,
  Package, Snowflake, ThermometerSun, TrendingDown, Truck, X,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import KpiTile from "@/components/dashboard/KpiTile";
import ArrheniusCurve, { type CurvePoint } from "@/components/supply/ArrheniusCurve";
import { api } from "@/lib/api";
import { useCurrency } from "@/lib/currency";
import { formatDays } from "@/lib/format";

/* ------------------------------------------------------------------ types */

interface Lane {
  laneId: number;
  mode: string;
  transitHours: number;
  reeferAvailable: boolean;
  ambientMaxC: number | null;
  freightCostMinor: number;
  salvageValueMinor: number;
  netSalvageMinor: number;
  netSalvageYieldPct: number | null;
  thermalRunwayHours: number | null;
  thermalRunwayBreached: boolean;
}

interface Simulation {
  sku: string;
  units: number;
  unitValueMinor: number;
  source: {
    onHand: number;
    safetyStockUnits: number;
    remainingAfterTransfer: number;
    inducesStockout: boolean;
    shortfallUnits: number;
  };
  options: Lane[];
}

interface Stability {
  sku: string; name: string; referenceTempC: number;
  referenceShelfDays: number; potencyFloorPct: number; curve: CurvePoint[];
}

interface WatchItem {
  sku: string; batchCode: string | null; name: string; quantity: number;
  daysToExpiry: number; valueMinor: number; location: string; status: string;
}

/**
 * Hours stop being readable past a few days. The comparison that matters is
 * against transit time, so keep hours while they are decision-relevant and
 * switch to days once the buffer is comfortable.
 */
function formatRunway(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "—";
  if (hours < 72) return `${Math.round(hours)} h`;
  const days = hours / 24;
  return days < 400 ? `${Math.round(days)} d` : `${(days / 365).toFixed(1)} yr`;
}

const ORIGIN = "wh-north";
const DESTINATION = "wh-west";

/* ------------------------------------------------------------------- page */

function SupplyChainContent() {
  const params = useSearchParams();
  const { format } = useCurrency();

  // A batch selected on the Command Centre arrives as ?sku=; otherwise the
  // first watchlist row is a sensible default.
  const skuParam = params.get("sku");

  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [sku, setSku] = useState<string | null>(skuParam);
  const [units, setUnits] = useState(2000);
  const [sim, setSim] = useState<Simulation | null>(null);
  const [stability, setStability] = useState<Stability | null>(null);
  const [laneId, setLaneId] = useState<number | null>(null);

  const [stoOpen, setStoOpen] = useState(false);
  const [stoBusy, setStoBusy] = useState(false);
  const [stoResult, setStoResult] = useState<{ id: number; status: string; detail: string } | null>(null);
  const [stoError, setStoError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ watchlist: WatchItem[] }>("/api/supply-chain/watchlist")
      .then((d) => {
        if (cancelled) return;
        setWatchlist(d.watchlist);
        setSku((current) => current ?? d.watchlist[0]?.sku ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!sku) return;
    let cancelled = false;
    const qs = `sku=${encodeURIComponent(sku)}&origin=${ORIGIN}&destination=${DESTINATION}&units=${units}`;
    api
      .get<Simulation>(`/api/supply-chain/simulate?${qs}`)
      .then((d) => {
        if (cancelled) return;
        setSim(d);
        setLaneId((current) => current ?? d.options[0]?.laneId ?? null);
        // Switching SKU can leave the slider above the new stock level, which
        // would simulate moving more units than exist. Clamp rather than let
        // the shortfall figure go negative.
        setUnits((u) => (u > d.source.onHand ? d.source.onHand : u));
      })
      .catch(() => !cancelled && setSim(null));
    return () => { cancelled = true; };
  }, [sku, units]);

  useEffect(() => {
    if (!sku) return;
    let cancelled = false;
    api
      .get<Stability>(`/api/supply-chain/arrhenius/${encodeURIComponent(sku)}`)
      .then((d) => !cancelled && setStability(d))
      .catch(() => !cancelled && setStability(null));
    return () => { cancelled = true; };
  }, [sku]);

  const lane = useMemo(
    () => sim?.options.find((o) => o.laneId === laneId) ?? sim?.options[0] ?? null,
    [sim, laneId]
  );

  const selectedBatch = useMemo(
    () => watchlist.find((w) => w.sku === sku) ?? null,
    [watchlist, sku]
  );

  const raiseSto = useCallback(async () => {
    if (!sku) return;
    setStoBusy(true);
    setStoError(null);
    try {
      const res = await api.post<{ id: number; status: string; detail: string }>(
        "/api/supply-chain/sto",
        { origin: ORIGIN, destination: DESTINATION, sku, units }
      );
      setStoResult(res);
    } catch (e) {
      setStoError(e instanceof Error ? e.message : "Could not raise the Stock Transport Order");
    } finally {
      setStoBusy(false);
    }
  }, [sku, units]);

  const maxUnits = sim?.source.onHand ?? 5000;

  return (
    <div className="space-y-8 text-muted">
      <PageHeader />

      {/* --------------------------------------------------------- KPI row */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Net salvage yield"
          value={lane?.netSalvageYieldPct !== null && lane?.netSalvageYieldPct !== undefined
            ? `${lane.netSalvageYieldPct.toFixed(1)}%`
            : "—"}
          sublabel="revenue recovered minus freight"
          changePct={lane?.netSalvageYieldPct ?? null}
          goodDirection="up"
          icon={TrendingDown}
          emphasis
        />
        <KpiTile
          label="Thermal runway"
          value={formatRunway(lane?.thermalRunwayHours)}
          sublabel={lane ? `transit needs ${lane.transitHours} h` : undefined}
          goodDirection="neutral"
          icon={ThermometerSun}
          emphasis={lane?.thermalRunwayBreached}
        />
        <KpiTile
          label="Stockout risk at source"
          value={sim ? (sim.source.inducesStockout ? "Induced" : "Clear") : "—"}
          sublabel={sim
            ? sim.source.inducesStockout
              ? `${sim.source.shortfallUnits} units below safety stock`
              : `${sim.source.remainingAfterTransfer} units remain`
            : undefined}
          goodDirection="neutral"
          icon={AlertTriangle}
          emphasis={sim?.source.inducesStockout}
        />
        <KpiTile
          label="Value in transfer"
          value={format(lane?.salvageValueMinor, { compact: true })}
          sublabel={sim ? `${sim.units.toLocaleString()} units @ ${format(sim.unitValueMinor)}` : undefined}
          goodDirection="neutral"
          icon={Package}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ------------------------------------------------- simulator */}
        <section className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-fg">Redistribution simulator</h2>
                <p className="text-xs text-subtle">
                  Warehouse North → Warehouse West
                  {selectedBatch && ` · ${selectedBatch.name}`}
                </p>
              </div>
              <select
                value={sku ?? ""}
                onChange={(e) => { setSku(e.target.value); setLaneId(null); }}
                className="rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-fg focus:border-accent focus:outline-none"
              >
                {watchlist.map((w) => (
                  <option key={w.sku} value={w.sku}>
                    {w.name} ({w.batchCode ?? w.sku})
                  </option>
                ))}
              </select>
            </div>

            {/* units */}
            <label className="mb-2 flex items-center justify-between text-xs">
              <span className="text-subtle">Units to transfer</span>
              <span className="font-mono tabular-nums text-fg">{units.toLocaleString()}</span>
            </label>
            <input
              type="range"
              min={0}
              max={maxUnits}
              step={50}
              value={Math.min(units, maxUnits)}
              onChange={(e) => setUnits(Number(e.target.value))}
              className="mb-1 w-full accent-[var(--color-accent)]"
              aria-label="Units to transfer"
            />
            <div className="mb-6 flex justify-between text-[11px] text-subtle">
              <span>0</span>
              <span>on hand: {maxUnits.toLocaleString()}</span>
            </div>

            {sim?.source.inducesStockout && (
              <div className="mb-5 flex items-start gap-2 rounded-lg border border-danger-line bg-danger-tint p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-xs text-danger">
                  <span className="font-semibold">Stockout risk inversion.</span>{" "}
                  This transfer leaves {sim.source.remainingAfterTransfer.toLocaleString()} units at
                  the source, {sim.source.shortfallUnits.toLocaleString()} below its safety stock of{" "}
                  {sim.source.safetyStockUnits.toLocaleString()}. Solving expiry at the destination
                  would create a shortage here.
                </p>
              </div>
            )}

            {/* freight lanes */}
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">
              Freight & transit
            </h3>
            <div className="space-y-2">
              {(sim?.options ?? []).map((o) => {
                const active = o.laneId === lane?.laneId;
                return (
                  <button
                    key={o.laneId}
                    onClick={() => setLaneId(o.laneId)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      active
                        ? "border-accent-line bg-accent-tint"
                        : "border-line bg-elevated hover:border-line-strong"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-medium capitalize text-fg">
                        <Truck className="h-4 w-4 text-subtle" aria-hidden="true" />
                        {o.mode}
                        {o.reeferAvailable ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-info-line bg-info-tint px-2 py-0.5 text-[10px] font-medium text-info">
                            <Snowflake className="h-2.5 w-2.5" aria-hidden="true" /> Reefer
                          </span>
                        ) : (
                          <span className="rounded-full border border-warn-line bg-warn-tint px-2 py-0.5 text-[10px] font-medium text-warn">
                            Ambient only
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-subtle">{o.transitHours} h transit</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <span className="text-subtle">
                        Freight <span className="block text-fg">{format(o.freightCostMinor)}</span>
                      </span>
                      <span className="text-subtle">
                        Net <span className={`block ${o.netSalvageMinor < 0 ? "text-danger" : "text-fg"}`}>
                          {format(o.netSalvageMinor)}
                        </span>
                      </span>
                      <span className="text-subtle">
                        Yield <span className={`block ${(o.netSalvageYieldPct ?? 0) < 0 ? "text-danger" : "text-ok"}`}>
                          {o.netSalvageYieldPct === null ? "—" : `${o.netSalvageYieldPct.toFixed(1)}%`}
                        </span>
                      </span>
                      <span className="text-subtle">
                        Ambient max <span className="block text-fg">{o.ambientMaxC ?? "—"} °C</span>
                      </span>
                    </div>
                    {o.thermalRunwayBreached && (
                      <p className="mt-2 text-[11px] text-danger">
                        Without refrigeration the payload breaches its potency floor before arrival.
                      </p>
                    )}
                  </button>
                );
              })}
              {sim?.options.length === 0 && (
                <p className="text-sm text-subtle">No freight lane exists between these warehouses.</p>
              )}
            </div>

            <button
              onClick={() => { setStoResult(null); setStoError(null); setStoOpen(true); }}
              disabled={!sim || units <= 0}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-accent-hover disabled:opacity-50"
            >
              Approve transfer <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* ------------------------------------------ Arrhenius */}
          <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <div className="mb-1 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-fg">API degradation kinetics</h2>
              {stability && (
                <span className="text-xs text-subtle">
                  potency floor {stability.potencyFloorPct}%
                </span>
              )}
            </div>
            <p className="mb-4 text-xs text-subtle">
              {stability
                ? `Arrhenius projection for ${stability.name}. Qualified at ${stability.referenceShelfDays} days / ${stability.referenceTempC} °C.`
                : "No stability profile for this SKU."}
            </p>
            {stability && (
              <ArrheniusCurve
                curve={stability.curve}
                referenceTempC={stability.referenceTempC}
                laneAmbientC={lane?.reeferAvailable ? null : lane?.ambientMaxC}
                transitHours={lane?.transitHours ?? null}
              />
            )}
          </div>
        </section>

        {/* --------------------------------------------- expiry watchlist */}
        <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
            <Clock className="h-4 w-4 text-subtle" aria-hidden="true" /> Expiry watchlist
          </h2>
          <p className="mb-4 text-xs text-subtle">Ordered by days remaining</p>
          <ul className="space-y-2">
            {watchlist.slice(0, 10).map((w) => (
              <li key={w.batchCode ?? w.sku}>
                <button
                  onClick={() => { setSku(w.sku); setLaneId(null); }}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    w.sku === sku
                      ? "border-accent-line bg-accent-tint"
                      : "border-line bg-elevated hover:border-line-strong"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-fg">{w.name}</span>
                      <span className="block font-mono text-[11px] text-subtle">
                        {w.batchCode} · {w.location}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${
                        w.status === "Critical"
                          ? "border-danger-line bg-danger-tint text-danger"
                          : w.status === "Warning"
                            ? "border-warn-line bg-warn-tint text-warn"
                            : "border-ok-line bg-ok-tint text-ok"
                      }`}
                    >
                      {formatDays(w.daysToExpiry)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-subtle">
                    {w.quantity.toLocaleString()} units · {format(w.valueMinor)}
                  </p>
                </button>
              </li>
            ))}
            {watchlist.length === 0 && (
              <li className="text-sm text-subtle">No batches are being tracked.</li>
            )}
          </ul>
        </section>
      </div>

      {/* ------------------------------------------------ STO write-back */}
      {stoOpen &&
        typeof document !== "undefined" &&
        createPortal(
          // Portal, not in-tree fixed: ancestors here create stacking contexts.
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
            onClick={() => setStoOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="w-full max-w-lg rounded-xl border border-line bg-surface p-6 shadow-overlay"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <FileText className="h-4 w-4 text-subtle" aria-hidden="true" />
                  Raise SAP Stock Transport Order
                </h3>
                <button
                  onClick={() => setStoOpen(false)}
                  className="text-subtle transition hover:text-fg"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {!stoResult ? (
                <>
                  <dl className="space-y-2 rounded-lg border border-line bg-elevated p-4 text-sm">
                    {[
                      ["Material", selectedBatch?.name ?? sku ?? "—"],
                      ["Quantity", `${units.toLocaleString()} units`],
                      ["Supplying plant", "Warehouse North – Ludhiana"],
                      ["Receiving plant", "Warehouse West – Bhiwandi"],
                      ["Freight mode", lane ? `${lane.mode} · ${lane.transitHours} h` : "—"],
                      ["Freight cost", lane ? format(lane.freightCostMinor) : "—"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-4">
                        <dt className="text-subtle">{k}</dt>
                        <dd className="text-right text-fg">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  {sim?.source.inducesStockout && (
                    <p className="mt-3 rounded-lg border border-danger-line bg-danger-tint p-3 text-xs text-danger">
                      This transfer drops the source below its safety stock. Approving it records
                      that decision against your name in the Part 11 audit trail.
                    </p>
                  )}
                  {stoError && (
                    <p className="mt-3 text-xs text-danger">{stoError}</p>
                  )}

                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      onClick={() => setStoOpen(false)}
                      className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-elevated"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={raiseSto}
                      disabled={stoBusy}
                      className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
                    >
                      {stoBusy ? "Submitting…" : "Confirm and raise STO"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-ok" aria-hidden="true" />
                  <p className="text-sm font-medium text-fg">
                    Stock Transport Order #{stoResult.id} queued
                  </p>
                  <p className="mx-auto mt-2 max-w-sm text-xs text-subtle">{stoResult.detail}</p>
                  <button
                    onClick={() => setStoOpen(false)}
                    className="mt-5 rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-elevated"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default function SupplyChainPhysicsPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={<div className="text-sm text-subtle">Loading simulator…</div>}>
      <SupplyChainContent />
    </Suspense>
  );
}
