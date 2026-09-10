"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, CheckCircle2, MapPinOff, ShieldCheck, TrendingUp,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import KpiTile from "@/components/dashboard/KpiTile";
import AudioWaveform, { type Snippet } from "@/components/commercial/AudioWaveform";
import { api } from "@/lib/api";
import { formatRelative } from "@/lib/format";

/* ------------------------------------------------------------------ types */

interface Visit {
  id: string;
  visitedAt: string | null;
  repId: string;
  repName: string;
  hcpName: string;
  clinicName: string | null;
  geo: {
    verified: boolean; distanceM: number | null;
    geofenceRadiusM: number; spoofScore: number;
  };
  triangulation: { unitsBefore: number; unitsAfter: number; liftPct: number | null };
  recordingId: string | null;
}

interface Recording {
  id: string; durationMs: number; audioUrl: string | null;
  waveform: number[]; snippets: Snippet[];
}

interface Objection {
  category: string; total: number; handled: number; handledPct: number;
}

interface RepEffectiveness {
  repId: string; repName: string; dpri: number; geoSpoofRatePct: number;
  conversions: number; detractions: number; conversionRatio: number | null;
}

const OBJECTION_LABEL: Record<string, string> = {
  price_sensitivity: "Price sensitivity",
  efficacy_doubt: "Efficacy doubt",
  competitor_loyalty: "Competitor loyalty",
  safety_concern: "Safety concern",
  formulary_restriction: "Formulary restriction",
  supply_reliability: "Supply reliability",
};

/* ------------------------------------------------------------------- page */

export default function CommercialTruthPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [objections, setObjections] = useState<Objection[]>([]);
  const [reps, setReps] = useState<RepEffectiveness[]>([]);
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const [selectedVisit, setSelectedVisit] = useState<string | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [activeSnippet, setActiveSnippet] = useState<Snippet | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ visits: Visit[] }>(`/api/commercial-truth/visits${onlyFlagged ? "?flagged=1" : ""}`)
      .then((d) => {
        if (cancelled) return;
        setVisits(d.visits);
        setSelectedVisit((cur) => cur ?? d.visits.find((v) => v.recordingId)?.id ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [onlyFlagged]);

  useEffect(() => {
    let cancelled = false;
    api.get<{ objections: Objection[] }>("/api/commercial-truth/objections")
      .then((d) => !cancelled && setObjections(d.objections)).catch(() => {});
    api.get<{ reps: RepEffectiveness[] }>("/api/commercial-truth/effectiveness")
      .then((d) => !cancelled && setReps(d.reps)).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedVisit) return;
    let cancelled = false;
    api
      .get<Recording>(`/api/commercial-truth/visits/${selectedVisit}/recording`)
      .then((d) => {
        if (cancelled) return;
        setRecording(d);
        // Clear the previous visit's selection only once the new recording is
        // in hand, so the panel never shows a snippet from the wrong call.
        setActiveSnippet(null);
      })
      .catch(() => {
        if (cancelled) return;
        setRecording(null);
        setActiveSnippet(null);
      });
    return () => { cancelled = true; };
  }, [selectedVisit]);

  /* ------------------------------------------------------------- KPIs */

  const spoofRate = useMemo(() => {
    if (visits.length === 0) return null;
    return (visits.filter((v) => !v.geo.verified).length / visits.length) * 100;
  }, [visits]);

  const meanDpri = useMemo(() => {
    if (reps.length === 0) return null;
    return reps.reduce((s, r) => s + r.dpri, 0) / reps.length;
  }, [reps]);

  const conversionRatio = useMemo(() => {
    const c = reps.reduce((s, r) => s + r.conversions, 0);
    const d = reps.reduce((s, r) => s + r.detractions, 0);
    return d === 0 ? null : c / d;
  }, [reps]);

  const unhandledObjections = useMemo(
    () => objections.reduce((s, o) => s + (o.total - o.handled), 0),
    [objections]
  );

  const activeVisit = useMemo(
    () => visits.find((v) => v.id === selectedVisit) ?? null,
    [visits, selectedVisit]
  );

  return (
    <div className="space-y-8 text-muted">
      <PageHeader
        actions={
          <button
            onClick={() => setOnlyFlagged((v) => !v)}
            aria-pressed={onlyFlagged}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              onlyFlagged
                ? "border-danger-line bg-danger-tint text-danger"
                : "border-line-strong bg-surface text-muted hover:text-fg"
            }`}
          >
            <MapPinOff className="h-3.5 w-3.5" aria-hidden="true" />
            Geo-fence failures only
          </button>
        }
      />

      {/* --------------------------------------------------------- KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          emphasis
          label="Doctor prescription rate index"
          value={meanDpri === null ? "—" : meanDpri.toFixed(1)}
          sublabel="post-visit script lift · 100 = no change"
          changePct={meanDpri === null ? null : meanDpri - 100}
          goodDirection="up"
          icon={TrendingUp}
        />
        <KpiTile
          emphasis
          label="Geo-spoofing detection rate"
          value={spoofRate === null ? "—" : `${spoofRate.toFixed(1)}%`}
          sublabel="pings outside the clinic radius"
          goodDirection="neutral"
          icon={MapPinOff}
        />
        <KpiTile
          label="Conversion : detraction"
          value={conversionRatio === null ? "—" : `${conversionRatio.toFixed(2)}×`}
          sublabel="net sentiment change post-call"
          goodDirection="neutral"
          icon={Activity}
        />
        <KpiTile
          label="Unhandled objections"
          value={String(unhandledObjections)}
          sublabel={`${objections.reduce((s, o) => s + o.total, 0)} raised in period`}
          goodDirection="neutral"
          icon={AlertTriangle}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ------------------------------------- visits + triangulation */}
        <section className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-sm font-semibold text-fg">
                Visit verification &amp; stockist triangulation
              </h2>
              <p className="text-xs text-subtle">
                A claimed visit is cross-checked against the clinic geofence and against
                secondary sales at the linked stockist in the following week.
              </p>
            </div>

            <div className="max-h-[28rem] overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-elevated text-xs text-subtle">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Rep / HCP</th>
                    <th className="px-5 py-3 text-right font-medium">Geo-fence</th>
                    <th className="px-5 py-3 text-right font-medium">Secondary sales</th>
                    <th className="px-5 py-3 text-right font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr
                      key={v.id}
                      onClick={() => setSelectedVisit(v.id)}
                      className={`cursor-pointer border-t border-line transition hover:bg-elevated ${
                        v.id === selectedVisit ? "bg-accent-tint" : ""
                      }`}
                    >
                      <td className="px-5 py-3">
                        <span className="block text-fg">{v.repName}</span>
                        <span className="block text-xs text-subtle">
                          {v.hcpName}{v.clinicName ? ` · ${v.clinicName}` : ""}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {v.geo.verified ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-ok-line bg-ok-tint px-2 py-0.5 text-xs text-ok">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            {v.geo.distanceM} m
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-danger-line bg-danger-tint px-2 py-0.5 text-xs text-danger">
                            <MapPinOff className="h-3 w-3" aria-hidden="true" />
                            {v.geo.distanceM} m
                          </span>
                        )}
                        <span className="mt-0.5 block text-[10px] text-subtle">
                          fence {v.geo.geofenceRadiusM} m · spoof {(v.geo.spoofScore * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {v.triangulation.liftPct === null ? (
                          <span className="text-xs text-subtle">no baseline</span>
                        ) : (
                          <span
                            className={`text-xs font-medium tabular-nums ${
                              v.triangulation.liftPct > 0 ? "text-ok" : "text-danger"
                            }`}
                          >
                            {v.triangulation.liftPct > 0 ? "+" : ""}
                            {v.triangulation.liftPct}%
                          </span>
                        )}
                        <span className="mt-0.5 block text-[10px] text-subtle tabular-nums">
                          {v.triangulation.unitsBefore} → {v.triangulation.unitsAfter} units
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-subtle">
                        {formatRelative(v.visitedAt)}
                      </td>
                    </tr>
                  ))}
                  {visits.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm text-subtle">
                        No visits match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ------------------------------------------ audio review */}
          <div className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-fg">Call audio review</h2>
                <p className="text-xs text-subtle">
                  {activeVisit
                    ? `${activeVisit.repName} → ${activeVisit.hcpName}`
                    : "Select a visit to review"}
                </p>
              </div>
            </div>

            {recording ? (
              <>
                <AudioWaveform
                  waveform={recording.waveform}
                  durationMs={recording.durationMs}
                  snippets={recording.snippets}
                  audioUrl={recording.audioUrl}
                  activeSnippetId={activeSnippet?.id ?? null}
                  onSelectSnippet={setActiveSnippet}
                />

                <ul className="mt-5 space-y-2">
                  {recording.snippets.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => setActiveSnippet(s)}
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          activeSnippet?.id === s.id ? "border-accent-line bg-accent-tint" : "border-line bg-elevated"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-fg">{s.label}</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] capitalize ${
                              s.severity === "critical"
                                ? "border-danger-line bg-danger-tint text-danger"
                                : s.severity === "warning"
                                  ? "border-warn-line bg-warn-tint text-warn"
                                  : s.severity === "positive"
                                    ? "border-ok-line bg-ok-tint text-ok"
                                    : "border-info-line bg-info-tint text-info"
                            }`}
                          >
                            {s.severity}
                          </span>
                        </div>
                        {s.transcript && <p className="mt-1 text-xs text-muted">{s.transcript}</p>}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-subtle">
                No recording is attached to this visit.
              </p>
            )}
          </div>
        </section>

        {/* ------------------------------------------ side: objections + reps */}
        <section className="space-y-6">
          <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
              <ShieldCheck className="h-4 w-4 text-subtle" aria-hidden="true" /> HCP objections
            </h2>
            <p className="mb-4 text-xs text-subtle">Categorised resistance, with handling rate</p>
            <ul className="space-y-3">
              {objections.map((o) => (
                <li key={o.category}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-fg">{OBJECTION_LABEL[o.category] ?? o.category}</span>
                    <span className="tabular-nums text-subtle">
                      {o.handled}/{o.total} handled
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-sunken">
                    <div
                      className={`h-full rounded-full ${
                        o.handledPct >= 70 ? "bg-ok" : o.handledPct >= 40 ? "bg-warn" : "bg-danger"
                      }`}
                      style={{ width: `${o.handledPct}%` }}
                    />
                  </div>
                </li>
              ))}
              {objections.length === 0 && (
                <li className="text-sm text-subtle">No objections recorded.</li>
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <h2 className="mb-1 text-sm font-semibold text-fg">Representative effectiveness</h2>
            <p className="mb-4 text-xs text-subtle">Current period</p>
            <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {reps.map((r) => (
                <li key={r.repId} className="rounded-lg border border-line bg-elevated p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-fg">{r.repName}</span>
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        r.dpri >= 100 ? "text-ok" : "text-danger"
                      }`}
                    >
                      DPRI {r.dpri.toFixed(1)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-subtle">
                    spoof {r.geoSpoofRatePct}% · {r.conversions} conversions /{" "}
                    {r.detractions} detractions
                    {r.conversionRatio !== null && ` · ${r.conversionRatio.toFixed(2)}×`}
                  </p>
                </li>
              ))}
              {reps.length === 0 && <li className="text-sm text-subtle">No data for this period.</li>}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
