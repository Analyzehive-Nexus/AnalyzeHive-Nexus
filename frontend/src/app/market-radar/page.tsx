"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Beaker, CalendarClock, FlaskConical, Gavel, Layers, Radar, TrendingUp,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import KpiTile from "@/components/dashboard/KpiTile";
import NetworkGraph, { type Node as GraphNode } from "@/components/NetworkGraph";
import { api } from "@/lib/api";
import { useCurrency } from "@/lib/currency";
import { formatRelative } from "@/lib/format";

/* ------------------------------------------------------------------ types */

interface Patent {
  id: string; molecule: string; brand: string | null; holder: string;
  market: string; exclusivityType: string; expiryDate: string;
  daysToExpiry: number; annualValueMinor: number;
  therapeuticArea: string | null; lapsed: boolean;
}

interface RegEvent {
  id: number; authority: string; kind: string; product: string;
  ceilingPriceMinor: number | null; previousPriceMinor: number | null;
  changePct: number | null; detail: string | null;
  effectiveFrom: string; publishedAt: string | null;
}

interface Placement {
  id: number; network: string; product: string; tier: number;
  previousTier: number | null; direction: string;
  changedAt: string | null; region: string | null;
}

interface SovArea {
  therapeuticArea: string;
  companies: { company: string; sovPct: number; isOwn: boolean }[];
  ownSovPct: number | null;
}

interface Trial {
  id: string; sponsor: string; molecule: string; therapeuticArea: string | null;
  phase: string; status: string; estCompletion: string | null;
  scheduleDeltaDays: number; accelerating: boolean; isOwn: boolean;
}

interface NetworkNode {
  id: string;
  name: string;
  kind: string;
  status: string;
}

interface NodeAnalysis {
  summary: string;
  recommendation: string;
  generatedAt: string | null;
  recentActivity: string[];
}

interface Signal {
  id: number;
  source: string;
  title: string;
  sentiment: string;
  impact: string;
  detectedAt: string | null;
}

/* --------------------------------------------------------------- sections */

/** Urgency band for an LOE countdown. Under a year is a planning horizon. */
function cliffTone(days: number) {
  if (days < 0) return "border-danger-line bg-danger-tint text-danger";
  if (days < 120) return "border-danger-line bg-danger-tint text-danger";
  if (days < 365) return "border-warn-line bg-warn-tint text-warn";
  return "border-line bg-elevated text-muted";
}

/**
 * Positions nodes for the competitive-network map. `network_nodes` has no
 * x/y (that is a presentation concern) and `kind` is a classification, not a
 * hierarchy - there is no single "us" node the data guarantees - so nodes
 * are grouped into one angular sector per kind rather than a fabricated hub
 * and spoke. There is also no edges table, so this deliberately returns no
 * links: showing a connection between two nodes would assert a relationship
 * this data does not actually have.
 */
const KIND_ORDER = ["internal", "competitor", "market", "supplier"] as const;
// 3 per ring, not more: at a radius this canvas can actually fit, more than
// 3 labelled circles sharing a ring's arc start touching.
const NODES_PER_RING = 3;

function layoutNetwork(raw: NetworkNode[]): GraphNode[] {
  const width = 760;
  const height = 460;
  const cx = width / 2;
  const cy = height / 2;
  const sectorAngle = (Math.PI * 2) / KIND_ORDER.length;

  const byKind = new Map<string, NetworkNode[]>();
  for (const n of raw) {
    const list = byKind.get(n.kind) ?? [];
    list.push(n);
    byKind.set(n.kind, list);
  }

  const nodes: GraphNode[] = [];
  KIND_ORDER.forEach((kind, sectorIndex) => {
    const group = byKind.get(kind) ?? [];
    const startAngle = sectorIndex * sectorAngle;
    group.forEach((n, i) => {
      const ring = Math.floor(i / NODES_PER_RING);
      const ringStart = ring * NODES_PER_RING;
      const ringCount = Math.min(group.length - ringStart, NODES_PER_RING);
      const posInRing = i - ringStart;
      // Nodes fill 80% of their sector's arc, leaving a gap so adjacent
      // sectors do not visually blur together.
      const angle =
        startAngle + sectorAngle * 0.1 + (posInRing / Math.max(ringCount, 1)) * sectorAngle * 0.8;
      const radius = 100 + ring * 85;
      nodes.push({
        id: n.id,
        label: n.name,
        type: (KIND_ORDER as readonly string[]).includes(n.kind)
          ? (n.kind as GraphNode["type"])
          : "market",
        status: n.status as GraphNode["status"],
        // Sized by what the data actually says is urgent, not an invented score.
        value: n.status === "critical" ? 18 : 14,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });
  });
  return nodes;
}

export default function MarketRadarPage() {
  const { format } = useCurrency();

  const [patents, setPatents] = useState<Patent[]>([]);
  const [events, setEvents] = useState<RegEvent[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [sov, setSov] = useState<SovArea[]>([]);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [isScanning, setIsScanning] = useState(true);

  const [networkNodes, setNetworkNodes] = useState<NetworkNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<NodeAnalysis | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [signalQuery, setSignalQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const get = <T,>(url: string, set: (v: T) => void) =>
      api.get<T>(url).then((d) => !cancelled && set(d)).catch(() => {});

    get<{ patents: Patent[] }>("/api/market-radar/patents", (d) => setPatents(d.patents));
    get<{ events: RegEvent[] }>("/api/market-radar/regulatory", (d) => setEvents(d.events));
    get<{ placements: Placement[] }>("/api/market-radar/formulary", (d) => setPlacements(d.placements));
    get<{ areas: SovArea[] }>("/api/market-radar/share-of-voice", (d) => setSov(d.areas));
    get<{ trials: Trial[] }>("/api/market-radar/trials", (d) => setTrials(d.trials));
    get<{ nodes: NetworkNode[] }>("/api/market-radar/nodes", (d) => setNetworkNodes(d.nodes));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const qs = signalQuery ? `?q=${encodeURIComponent(signalQuery)}` : "";
    api
      .get<{ signals: Signal[] }>(`/api/market-radar/signals${qs}`)
      .then((d) => !cancelled && setSignals(d.signals))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [signalQuery]);

  useEffect(() => {
    // No setState here when cleared: the analysis panel is already gated on
    // `selectedNode` (derived, not stored), so it disappears immediately -
    // this stale `analysis` just never renders until a new node resolves.
    if (!selectedNodeId) return;
    let cancelled = false;
    api
      .get<NodeAnalysis>(`/api/market-radar/nodes/${selectedNodeId}/analysis`)
      .then((d) => !cancelled && setAnalysis(d))
      .catch(() => !cancelled && setAnalysis(null));
    return () => { cancelled = true; };
  }, [selectedNodeId]);

  const graphNodes = useMemo(() => layoutNetwork(networkNodes), [networkNodes]);
  const handleNodeSelect = useCallback((node: GraphNode | null) => {
    setSelectedNodeId(node?.id ?? null);
  }, []);
  const selectedNode = useMemo(
    () => networkNodes.find((n) => n.id === selectedNodeId) ?? null,
    [networkNodes, selectedNodeId]
  );

  const nextCliff = useMemo(
    () => patents.filter((p) => !p.lapsed).sort((a, b) => a.daysToExpiry - b.daysToExpiry)[0] ?? null,
    [patents]
  );
  const exposedValue = useMemo(
    () => patents.filter((p) => p.daysToExpiry < 365).reduce((sum, p) => sum + p.annualValueMinor, 0),
    [patents]
  );
  const promotions = useMemo(
    () => placements.filter((p) => p.direction === "promoted").length,
    [placements]
  );
  const acceleratingRivals = useMemo(
    () => trials.filter((t) => !t.isOwn && t.accelerating).length,
    [trials]
  );

  return (
    <div className="space-y-8 text-muted">
      <PageHeader
        actions={
          <button
            onClick={() => setIsScanning((v) => !v)}
            aria-pressed={isScanning}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              isScanning
                ? "border-accent-line bg-accent-tint text-accent"
                : "border-line-strong bg-surface text-muted hover:text-fg"
            }`}
          >
            <Radar className={`h-3.5 w-3.5 ${isScanning ? "animate-radar-spin" : ""}`} aria-hidden="true" />
            {isScanning ? "Scanning" : "Scan paused"}
          </button>
        }
      />

      {/* --------------------------------------------------------- KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          emphasis
          label="Next patent cliff"
          value={nextCliff ? `${nextCliff.daysToExpiry} days` : "—"}
          sublabel={nextCliff ? `${nextCliff.molecule} · ${nextCliff.holder}` : undefined}
          goodDirection="neutral"
          icon={CalendarClock}
        />
        <KpiTile
          emphasis
          label="Revenue facing LOE"
          value={format(exposedValue, { compact: true })}
          sublabel="exclusivity lapsing within 12 months"
          goodDirection="neutral"
          icon={Gavel}
        />
        <KpiTile
          label="Formulary promotions"
          value={String(promotions)}
          sublabel={`${placements.length} placement changes tracked`}
          goodDirection="neutral"
          icon={Layers}
        />
        <KpiTile
          label="Rivals ahead of schedule"
          value={String(acceleratingRivals)}
          sublabel={`${trials.filter((t) => !t.isOwn).length} competitor trials tracked`}
          goodDirection="neutral"
          icon={FlaskConical}
        />
      </section>

      {/* ------------------------------------------- competitive network */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card lg:col-span-2">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-fg">Competitive network</h2>
            <p className="text-xs text-subtle">
              Grouped by classification - internal, competitor, market, supplier. Drag to
              reposition, scroll to zoom, click a node for its analysis.
            </p>
          </div>
          <div className="h-[420px]">
            {graphNodes.length > 0 ? (
              <NetworkGraph
                nodes={graphNodes}
                links={[]}
                onNodeSelect={handleNodeSelect}
                isScanning={isScanning}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-subtle">
                Loading network…
              </div>
            )}
          </div>
          {selectedNode && (
            <div className="border-t border-line bg-elevated px-5 py-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold capitalize text-fg">
                  {selectedNode.name} <span className="text-subtle">· {selectedNode.kind}</span>
                </h3>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="text-xs text-subtle hover:text-fg"
                >
                  Close
                </button>
              </div>
              {analysis ? (
                <>
                  <p className="text-xs text-muted">{analysis.summary}</p>
                  <p className="mt-2 text-xs font-medium text-fg">{analysis.recommendation}</p>
                  {analysis.recentActivity.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {analysis.recentActivity.map((a, i) => (
                        <li key={i} className="text-[11px] text-subtle">
                          • {a}
                        </li>
                      ))}
                    </ul>
                  )}
                  {analysis.generatedAt && (
                    <p className="mt-2 text-[10px] text-subtle">
                      Generated {formatRelative(analysis.generatedAt)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-subtle">Loading analysis…</p>
              )}
            </div>
          )}
        </section>

        {/* ------------------------------------------------- signals feed */}
        <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-1 text-sm font-semibold text-fg">Signals</h2>
          <p className="mb-3 text-xs text-subtle">Search by source or headline</p>
          <input
            type="search"
            value={signalQuery}
            onChange={(e) => setSignalQuery(e.target.value)}
            placeholder="Search signals…"
            className="mb-4 w-full rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs text-fg focus:border-accent focus:outline-none"
          />
          <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {signals.map((s) => (
              <li key={s.id} className="rounded-lg border border-line bg-elevated p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded border border-line-strong bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                    {s.source}
                  </span>
                  <span
                    className={`text-[10px] font-medium capitalize ${
                      s.sentiment === "critical"
                        ? "text-danger"
                        : s.sentiment === "positive"
                          ? "text-ok"
                          : "text-subtle"
                    }`}
                  >
                    {s.sentiment}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-fg">{s.title}</p>
                <p className="mt-1 text-[10px] text-subtle">
                  {s.impact} impact · {formatRelative(s.detectedAt)}
                </p>
              </li>
            ))}
            {signals.length === 0 && <li className="text-sm text-subtle">No signals match.</li>}
          </ul>
        </section>
      </div>

      {/* ---------------------------------------------- patent cliff table */}
      <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-fg">Patent cliff / loss of exclusivity</h2>
          <p className="text-xs text-subtle">
            When generic competition can enter each market. Countdown recalculates daily.
          </p>
        </div>
        <div className="max-h-[28rem] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-elevated text-xs text-subtle">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Molecule</th>
                <th className="px-5 py-3 text-left font-medium">Holder</th>
                <th className="px-5 py-3 text-left font-medium">Type</th>
                <th className="px-5 py-3 text-right font-medium">Annual value</th>
                <th className="px-5 py-3 text-right font-medium">LOE</th>
              </tr>
            </thead>
            <tbody>
              {patents.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <span className="block text-fg">{p.molecule}</span>
                    <span className="block text-xs text-subtle">
                      {p.brand} · {p.therapeuticArea}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted">{p.holder}</td>
                  <td className="px-5 py-3 text-xs capitalize text-subtle">
                    {p.exclusivityType.replace("_", " ")} · {p.market}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-fg">
                    {format(p.annualValueMinor, { compact: true })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${cliffTone(p.daysToExpiry)}`}>
                      {p.lapsed ? "Lapsed" : `${p.daysToExpiry} d`}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-subtle">{p.expiryDate}</span>
                  </td>
                </tr>
              ))}
              {patents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-subtle">
                    No exclusivity data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ------------------------------------------- regulatory feed */}
        <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
            <Gavel className="h-4 w-4 text-subtle" aria-hidden="true" /> Regulatory & pricing
          </h2>
          <p className="mb-4 text-xs text-subtle">
            NPPA/DPCO ceiling revisions and CDSCO/FDA/EMA actions
          </p>
          <ul className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {events.map((e) => (
              <li key={e.id} className="rounded-lg border border-line bg-elevated p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="rounded border border-line-strong bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                      {e.authority}
                    </span>
                    <span className="text-sm text-fg">{e.product}</span>
                  </span>
                  {e.changePct !== null ? (
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        e.changePct < 0 ? "text-danger" : e.changePct > 0 ? "text-ok" : "text-subtle"
                      }`}
                    >
                      {e.changePct > 0 ? "+" : ""}{e.changePct}%
                    </span>
                  ) : (
                    <span className="text-xs capitalize text-subtle">{e.kind.replace("_", " ")}</span>
                  )}
                </div>
                {e.ceilingPriceMinor !== null && (
                  <p className="mt-1 text-xs text-subtle">
                    Ceiling {format(e.ceilingPriceMinor)}
                    {e.previousPriceMinor !== null && (
                      <span className="ml-1 line-through opacity-60">
                        {format(e.previousPriceMinor)}
                      </span>
                    )}
                  </p>
                )}
                {e.detail && <p className="mt-1 text-xs text-muted">{e.detail}</p>}
                <p className="mt-1 text-[10px] text-subtle">
                  effective {e.effectiveFrom} · published {formatRelative(e.publishedAt)}
                </p>
              </li>
            ))}
            {events.length === 0 && <li className="text-sm text-subtle">No regulatory events.</li>}
          </ul>
        </section>

        {/* ------------------------------------------- formulary shifts */}
        <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
            <Layers className="h-4 w-4 text-subtle" aria-hidden="true" /> Formulary placement
          </h2>
          <p className="mb-4 text-xs text-subtle">
            Tier movement in hospital networks. Tier 1 is the most favourable.
          </p>
          <ul className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {placements.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-elevated p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">{p.product}</p>
                  <p className="truncate text-xs text-subtle">
                    {p.network}{p.region ? ` · ${p.region}` : ""} · {formatRelative(p.changedAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                    p.direction === "promoted"
                      ? "border-ok-line bg-ok-tint text-ok"
                      : p.direction === "demoted"
                        ? "border-danger-line bg-danger-tint text-danger"
                        : "border-line bg-surface text-subtle"
                  }`}
                >
                  {p.previousTier !== null && p.previousTier !== p.tier
                    ? `T${p.previousTier} → T${p.tier}`
                    : `Tier ${p.tier}`}
                </span>
              </li>
            ))}
            {placements.length === 0 && <li className="text-sm text-subtle">No placement changes.</li>}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ------------------------------------------ share of voice */}
        <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
            <TrendingUp className="h-4 w-4 text-subtle" aria-hidden="true" /> Share of voice
          </h2>
          <p className="mb-4 text-xs text-subtle">By therapeutic area, current period</p>
          <div className="max-h-[28rem] space-y-5 overflow-y-auto pr-1">
            {sov.map((area) => (
              <div key={area.therapeuticArea}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-fg">{area.therapeuticArea}</span>
                  <span className="text-xs text-subtle">
                    ours {area.ownSovPct === null ? "—" : `${area.ownSovPct}%`}
                  </span>
                </div>
                <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                  {area.companies.map((c) => (
                    <div key={c.company} className="flex items-center gap-2">
                      <span
                        className={`w-32 shrink-0 truncate text-[11px] ${
                          c.isOwn ? "font-semibold text-accent" : "text-subtle"
                        }`}
                      >
                        {c.company}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                        <div
                          className={`h-full rounded-full ${c.isOwn ? "bg-accent" : "bg-line-strong"}`}
                          style={{ width: `${Math.min(c.sovPct * 2, 100)}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted">
                        {c.sovPct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {sov.length === 0 && <p className="text-sm text-subtle">No share-of-voice data.</p>}
          </div>
        </section>

        {/* ------------------------------------------ trial velocity */}
        <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
            <Beaker className="h-4 w-4 text-subtle" aria-hidden="true" /> Clinical trial velocity
          </h2>
          <p className="mb-4 text-xs text-subtle">
            Progression against each sponsor&apos;s original plan
          </p>
          <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {trials.map((t) => (
              <li
                key={t.id}
                className={`rounded-lg border p-3 ${
                  t.isOwn ? "border-accent-line bg-accent-tint" : "border-line bg-elevated"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-fg">
                    {t.molecule}
                    <span className="ml-2 text-xs text-subtle">{t.sponsor}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded border border-line-strong bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                      Phase {t.phase}
                    </span>
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        t.accelerating ? "text-danger" : "text-subtle"
                      }`}
                    >
                      {t.scheduleDeltaDays > 0 ? "+" : ""}{t.scheduleDeltaDays} d
                    </span>
                  </span>
                </div>
                <p className="mt-1 text-[11px] capitalize text-subtle">
                  {t.status} · est. completion {t.estCompletion ?? "—"}
                  {/* Ahead of plan is a competitive threat, not good news. */}
                  {t.accelerating && !t.isOwn && " · running ahead of plan"}
                </p>
              </li>
            ))}
            {trials.length === 0 && <li className="text-sm text-subtle">No trials tracked.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
