"use client";

import { memo, useEffect, useState, useCallback } from "react";
import {
  Cpu,
  Activity,
  Server,
  Database,
  Terminal,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatLatency, formatRelative, formatUptime } from "@/lib/format";
import PageHeader from "@/components/PageHeader";

interface Service {
  id: number;
  name: string;
  status: string;
  uptimePct: number | null;
  latencyMs: number | null;
  region: string;
}

interface Incident {
  id: number;
  title: string;
  startedAt: string | null;
  severity: string;
  status: string;
}

// --- Helpers ---

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    Operational: "bg-ok-tint text-ok border-ok-line",
    Degraded: "bg-warn-tint text-warn border-warn-line",
    Maintenance: "bg-info-tint text-info border-info-line",
    Outage: "bg-danger-tint text-danger border-danger-line",
  };
  const style = styles[status] ?? styles.Operational;

  return (
    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1.5 w-fit ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'Operational' ? 'bg-ok' : status === 'Degraded' ? 'bg-warn' : status === 'Maintenance' ? 'bg-info' : 'bg-danger'}`} />
      {status.toUpperCase()}
    </span>
  );
};

// --- Sub-Components ---


const ServiceGrid = memo(() => {
  const [services, setServices] = useState<Service[]>([]);
  const [refreshing, setRefreshing] = useState(true);

  // Split so the mount effect only kicks off the request. Calling
  // fetchServices() straight from the effect set state synchronously, which
  // is a cascading render (and redundant - `refreshing` already starts true).
  const loadServices = useCallback(
    () =>
      api
        .get<{ services: Service[] }>("/api/system-status/services")
        .then((data) => setServices(data.services))
        .catch(() => setServices([]))
        .finally(() => setRefreshing(false)),
    []
  );

  const fetchServices = () => {
    setRefreshing(true);
    void loadServices();
  };

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  return (
    <div className="bg-surface backdrop-blur-md border border-line rounded-2xl p-6 h-full min-h-0 flex flex-col hover:border-accent-line transition-colors">
       <div className="flex justify-between items-center mb-6">
         <div>
            <h3 className="text-base font-semibold text-fg flex items-center gap-2">
              <Server className="w-4 h-4 text-accent" /> Service Status
            </h3>
            <p className="text-xs text-subtle">Real-time component monitoring</p>
         </div>
         <button
           onClick={fetchServices}
           disabled={refreshing}
           className="p-2 rounded-lg bg-sunken text-muted hover:text-fg transition disabled:opacity-50"
         >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
         </button>
       </div>

       <div className="min-h-0 flex-1 overflow-y-auto pr-1">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((svc, i) => (
              <div key={svc.id} className="p-4 rounded-xl border border-line bg-elevated hover:bg-elevated hover:border-accent-line transition-all group animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
                 <div className="flex justify-between items-start mb-3">
                    <StatusBadge status={svc.status} />
                    <span className="text-[10px] text-subtle font-mono">{svc.region}</span>
                 </div>
                 <h4 className="text-sm font-semibold text-fg mb-2 group-hover:text-accent transition-colors">{svc.name}</h4>
                 <div className="flex items-center gap-4 text-xs">
                    <div className="flex flex-col">
                       <span className="text-subtle text-[10px]">Uptime</span>
                       <span className="font-mono text-fg">{formatUptime(svc.uptimePct)}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-subtle text-[10px]">Latency</span>
                       <span className={`font-mono font-medium ${(svc.latencyMs ?? 0) > 300 ? 'text-warn' : 'text-fg'}`}>{formatLatency(svc.latencyMs)}</span>
                    </div>
                 </div>
              </div>
            ))}
         </div>
       </div>
    </div>
  );
});
ServiceGrid.displayName = "ServiceGrid";

const IncidentLog = memo(() => {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    api
      .get<{ incidents: Incident[] }>("/api/system-status/incidents")
      .then((data) => setIncidents(data.incidents))
      .catch(() => setIncidents([]));
  }, []);

  return (
  <div className="bg-surface backdrop-blur-md border border-line rounded-2xl p-6 h-full min-h-0 flex flex-col hover:border-accent-line transition-colors">
      <div className="flex justify-between items-center mb-6">
       <div>
          <h3 className="text-base font-semibold text-fg flex items-center gap-2">
            <Activity className="w-4 h-4 text-warn" /> Incident Log
          </h3>
          <p className="text-xs text-subtle">Recent system events</p>
       </div>
     </div>

     <div className="flex flex-1 min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {incidents.map((inc, i) => (
             <div key={inc.id} className="relative pl-6 animate-fade-in-up" style={{ animationDelay: `${i * 150}ms` }}>
                {/* Timeline Line */}
                <div className="absolute left-[5px] top-2 bottom-0 w-px bg-sunken group-last:hidden" />
                {/* Dot */}
                <div className={`absolute left-0 top-2 w-2.5 h-2.5 rounded-full border-2 border-line ${inc.severity === 'Medium' ? 'bg-warn' : inc.severity === 'High' ? 'bg-danger' : 'bg-faint'}`} />

                <div className="pb-4">
                   <div className="flex justify-between items-start">
                      <h4 className="text-sm font-medium text-fg">{inc.title}</h4>
                      <span className="text-[10px] text-subtle whitespace-nowrap">{formatRelative(inc.startedAt)}</span>
                   </div>
                   <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded bg-elevated border border-line ${inc.status === 'Resolved' ? 'text-ok' : 'text-warn'}`}>
                        {inc.status}
                      </span>
                   </div>
                </div>
             </div>
          ))}
        </div>

        <div className="pt-4 mt-4 border-t border-line shrink-0">
           <div className="flex items-center gap-2 p-3 rounded bg-elevated border border-line font-mono text-xs text-accent">
              <Terminal className="w-4 h-4" />
              <span className="opacity-80">System stable. All clusters nominal.</span>
              <span className="animate-pulse">_</span>
           </div>
        </div>
     </div>
  </div>
  );
});
IncidentLog.displayName = "IncidentLog";

// --- Main Page ---

export default function SystemStatusPage() {
  return (
    <div className="space-y-8 text-muted">

        {/* The old header asserted "All Systems Operational" and "Live
            Monitoring" as static text regardless of what the services
            actually reported. The Service Status panel below is the honest
            answer, so the claim is not repeated up here. */}
        <PageHeader />

        {/* KPI CARDS */}
        <PlatformTelemetry />

        {/* MAIN CONTENT */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[600px]">
           {/* Left: Service Grid (2 cols) */}
           <div className="lg:col-span-2 h-full min-h-0 card-3d-hover animate-fade-in-up delay-300">
              <ServiceGrid />
           </div>

           {/* Right: Incident Log (1 col) */}
           <div className="lg:col-span-1 h-full min-h-0 card-3d-hover animate-fade-in-up delay-500">
              <IncidentLog />
           </div>
        </section>

    </div>
  );
}


/* ------------------------------------------------------------------------ */

interface InferenceModel {
  model: string; p50Ms: number; p95Ms: number;
  queueDepth: number; gpuUtilPct: number | null;
}

interface IngestionSource {
  source: string; recordsPerSec: number; backlogRecords: number;
}

/**
 * Platform-specific telemetry.
 *
 * The four cards here used to be hardcoded strings ("99.98%", "42ms"). For
 * this estate the numbers that matter are how fast the models behind Triton
 * are answering and whether the distributor feed is keeping up.
 */
function PlatformTelemetry() {
  const [models, setModels] = useState<InferenceModel[]>([]);
  const [sources, setSources] = useState<IngestionSource[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.get<{ models: InferenceModel[] }>("/api/system-status/inference")
      .then((d) => !cancelled && setModels(d.models)).catch(() => {});
    api.get<{ sources: IngestionSource[] }>("/api/system-status/ingestion")
      .then((d) => !cancelled && setSources(d.sources)).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const totalThroughput = sources.reduce((s, x) => s + x.recordsPerSec, 0);
  const totalBacklog = sources.reduce((s, x) => s + x.backlogRecords, 0);
  const worst = [...models].sort((a, b) => b.p95Ms - a.p95Ms)[0] ?? null;

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ------------------------------------------ Triton inference */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
        <div className="mb-1 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-subtle" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-fg">Inference latency on Triton</h2>
        </div>
        <p className="mb-4 text-xs text-subtle">
          {worst ? `Slowest p95: ${worst.model} at ${worst.p95Ms.toFixed(0)} ms` : "Loading models…"}
        </p>
        <ul className="space-y-2">
          {models.map((m) => (
            <li key={m.model} className="rounded-lg border border-line bg-elevated p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs text-fg">{m.model}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  p50 {m.p50Ms.toFixed(0)} ms · p95 {m.p95Ms.toFixed(0)} ms
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-subtle">
                <span>queue {m.queueDepth}</span>
                {m.gpuUtilPct !== null && (
                  <span className="flex flex-1 items-center gap-2">
                    GPU
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                      <span
                        className={`block h-full rounded-full ${
                          m.gpuUtilPct > 85 ? "bg-warn" : "bg-accent"
                        }`}
                        style={{ width: `${m.gpuUtilPct}%` }}
                      />
                    </span>
                    {m.gpuUtilPct.toFixed(0)}%
                  </span>
                )}
              </div>
            </li>
          ))}
          {models.length === 0 && <li className="text-sm text-subtle">No inference metrics.</li>}
        </ul>
      </div>

      {/* ------------------------------------------ ingestion pipeline */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
        <div className="mb-1 flex items-center gap-2">
          <Database className="h-4 w-4 text-subtle" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-fg">Pipeline ingestion rate</h2>
        </div>
        <p className="mb-4 text-xs text-subtle">
          {totalThroughput.toLocaleString(undefined, { maximumFractionDigits: 0 })} records/s across
          all feeds · {totalBacklog.toLocaleString()} queued
        </p>
        <ul className="space-y-2">
          {sources.map((x) => (
            <li key={x.source} className="rounded-lg border border-line bg-elevated p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-fg">{x.source}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {x.recordsPerSec.toLocaleString(undefined, { maximumFractionDigits: 0 })} rec/s
                </span>
              </div>
              {x.backlogRecords > 0 && (
                <p className="mt-1 text-[11px] text-warn">
                  {x.backlogRecords.toLocaleString()} records backlogged
                </p>
              )}
            </li>
          ))}
          {sources.length === 0 && <li className="text-sm text-subtle">No ingestion metrics.</li>}
        </ul>
      </div>
    </section>
  );
}
