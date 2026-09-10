"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BatteryLow, MapPin, Radio, Snowflake, Thermometer, Truck,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import KpiTile from "@/components/dashboard/KpiTile";
import { api } from "@/lib/api";
import { formatRelative } from "@/lib/format";

/* ------------------------------------------------------------------ types */

interface Shipment {
  id: string;
  carrier: string | null;
  mode: string;
  status: string;
  tempBand: { minC: number | null; maxC: number | null };
  origin: string | null;
  destination: string | null;
  region: string | null;
  departedAt: string | null;
  eta: string | null;
  loggerCount: number;
  lastTempC: number | null;
  lastPingAt: string | null;
  position: { lat: number; lng: number } | null;
  openAnomalies: number;
  excursionReadings: number;
  inBand: boolean;
}

interface Summary {
  loggers: { total: number; reporting: number; silent: number; lowBattery: number };
  shipments: { inTransit: number; exceptions: number };
  anomalies: {
    id: number; shipmentId: string; kind: string;
    severity: string; detail: string; detectedAt: string | null;
  }[];
}

const ANOMALY_LABEL: Record<string, string> = {
  customs_delay: "Customs delay",
  port_congestion: "Port congestion",
  temp_excursion: "Temperature excursion",
  route_deviation: "Route deviation",
  logger_silent: "Logger silent",
};

const SEVERITY_STYLE: Record<string, string> = {
  critical: "border-danger-line bg-danger-tint text-danger",
  high: "border-danger-line bg-danger-tint text-danger",
  medium: "border-warn-line bg-warn-tint text-warn",
  low: "border-info-line bg-info-tint text-info",
};

/* ------------------------------------------------------------------- page */

export default function LiveOperationsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.get<Summary>("/api/cold-chain/summary")
        .then((d) => !cancelled && setSummary(d)).catch(() => {});
      api.get<{ shipments: Shipment[] }>("/api/cold-chain/shipments")
        .then((d) => !cancelled && setShipments(d.shipments)).catch(() => {});
    };
    load();
    // Telemetry is the point of this screen, so it refreshes on its own.
    const timer = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const active = useMemo(
    () => shipments.find((s) => s.id === selected) ?? null,
    [shipments, selected]
  );

  return (
    <div className="space-y-8 text-muted">
      <PageHeader />

      {/* ---------------------------------------------------------- KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Active in-transit loggers"
          value={summary ? `${summary.loggers.reporting}/${summary.loggers.total}` : "—"}
          sublabel="reporting GPS and temperature"
          goodDirection="neutral"
          icon={Radio}
          emphasis
        />
        <KpiTile
          label="Active route anomalies"
          value={summary ? String(summary.anomalies.length) : "—"}
          sublabel={summary ? `${summary.shipments.exceptions} shipments in exception` : undefined}
          goodDirection="neutral"
          icon={AlertTriangle}
          emphasis={(summary?.anomalies.length ?? 0) > 0}
        />
        <KpiTile
          label="Shipments in transit"
          value={summary ? String(summary.shipments.inTransit) : "—"}
          sublabel="including customs hold"
          goodDirection="neutral"
          icon={Truck}
        />
        <KpiTile
          label="Loggers needing attention"
          value={summary ? String(summary.loggers.silent + summary.loggers.lowBattery) : "—"}
          sublabel={summary
            ? `${summary.loggers.silent} silent · ${summary.loggers.lowBattery} low battery`
            : undefined}
          goodDirection="neutral"
          icon={BatteryLow}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ------------------------------------------------ fleet table */}
        <section className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-sm font-semibold text-fg">In-transit fleet</h2>
              <p className="text-xs text-subtle">
                Live cold-chain telemetry, refreshed every 30 seconds
              </p>
            </div>

            <div className="max-h-[28rem] overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-elevated text-xs text-subtle">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Shipment</th>
                    <th className="px-5 py-3 text-left font-medium">Lane</th>
                    <th className="px-5 py-3 text-right font-medium">Temp</th>
                    <th className="px-5 py-3 text-right font-medium">ETA</th>
                    <th className="px-5 py-3 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelected(s.id === selected ? null : s.id)}
                      className={`cursor-pointer border-t border-line transition hover:bg-elevated ${
                        s.id === selected ? "bg-accent-tint" : ""
                      }`}
                    >
                      <td className="px-5 py-3">
                        <span className="block font-mono text-xs text-fg">{s.id}</span>
                        <span className="block text-xs text-subtle">{s.carrier}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted">
                        {s.origin} → {s.destination}
                        <span className="ml-1 capitalize text-subtle">· {s.mode}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs tabular-nums ${
                            // No reading is "unknown", not "out of band" - a
                            // delivered shipment with no logger is not an alarm.
                            s.lastTempC === null
                              ? "border-line bg-elevated text-subtle"
                              : s.inBand
                                ? "border-ok-line bg-ok-tint text-ok"
                                : "border-danger-line bg-danger-tint text-danger"
                          }`}
                        >
                          <Thermometer className="h-3 w-3" aria-hidden="true" />
                          {s.lastTempC === null ? "—" : `${s.lastTempC.toFixed(1)}°C`}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-subtle">
                          band {s.tempBand.minC}…{s.tempBand.maxC}°C
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-muted">
                        {formatRelative(s.eta)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] capitalize ${
                            s.status === "exception"
                              ? "border-danger-line bg-danger-tint text-danger"
                              : s.status === "customs"
                                ? "border-warn-line bg-warn-tint text-warn"
                                : s.status === "delivered"
                                  ? "border-line bg-elevated text-subtle"
                                  : "border-ok-line bg-ok-tint text-ok"
                          }`}
                        >
                          {s.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {shipments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-subtle">
                        No shipments are being tracked.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {active && (
              <div className="border-t border-line bg-elevated px-5 py-4">
                <h3 className="mb-2 text-xs font-semibold text-fg">{active.id} detail</h3>
                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <span className="text-subtle">
                    Loggers <span className="block text-fg">{active.loggerCount}</span>
                  </span>
                  <span className="text-subtle">
                    Out-of-band readings{" "}
                    <span className={`block ${active.inBand ? "text-fg" : "text-danger"}`}>
                      {active.excursionReadings}
                    </span>
                  </span>
                  <span className="text-subtle">
                    Last ping <span className="block text-fg">{formatRelative(active.lastPingAt)}</span>
                  </span>
                  <span className="text-subtle">
                    Position{" "}
                    <span className="block font-mono text-fg">
                      {active.position
                        ? `${active.position.lat.toFixed(3)}, ${active.position.lng.toFixed(3)}`
                        : "—"}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* -------------------------------------------------- anomalies */}
        <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
            <Snowflake className="h-4 w-4 text-subtle" aria-hidden="true" /> Route anomalies
          </h2>
          <p className="mb-4 text-xs text-subtle">Unresolved, most severe first</p>

          <ul className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {(summary?.anomalies ?? []).map((a) => (
              <li
                key={a.id}
                className={`rounded-lg border p-3 ${SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.low}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">
                    {ANOMALY_LABEL[a.kind] ?? a.kind}
                  </span>
                  <span className="font-mono text-[10px] opacity-80">{a.shipmentId}</span>
                </div>
                <p className="mt-1 text-xs opacity-90">{a.detail}</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                  <MapPin className="h-2.5 w-2.5" aria-hidden="true" />
                  {formatRelative(a.detectedAt)}
                </p>
              </li>
            ))}
            {summary?.anomalies.length === 0 && (
              <li className="text-sm text-subtle">No open anomalies. All lanes nominal.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
