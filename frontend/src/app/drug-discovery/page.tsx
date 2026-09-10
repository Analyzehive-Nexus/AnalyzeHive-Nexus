"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Boxes, FlaskConical, Orbit, Target } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import KpiTile from "@/components/dashboard/KpiTile";
import { kindColor, type ModelEdge, type ModelNode } from "@/components/discovery/DiseaseModel3D";
import { api } from "@/lib/api";

/**
 * WebGL cannot render on the server, and the three.js bundle is large enough
 * that it should not sit in the shared chunk. Loading it only on this route,
 * client-side, keeps every other page unaffected.
 */
const DiseaseModel3D = dynamic(() => import("@/components/discovery/DiseaseModel3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-subtle">
      Loading 3D model…
    </div>
  ),
});

/* ------------------------------------------------------------------ types */

interface Program {
  id: string; name: string; therapeuticArea: string; target: string | null;
  phase: string; startedAt: string | null; ptrs: number | null;
  lead: string | null; modelCount: number; candidateCount: number;
}

interface ModelSummary {
  id: string; name: string; disease: string; modelType: string;
  program: string | null; summary: string | null;
}

interface ModelDetail extends ModelSummary {
  nodes: ModelNode[];
  edges: ModelEdge[];
}

interface Candidate {
  id: string; programId: string; program: string; codeName: string;
  bindingAffinityNm: number | null; selectivityFold: number | null;
  admetScore: number | null; status: string;
}

const STATUS_STYLE: Record<string, string> = {
  optimised: "border-ok-line bg-ok-tint text-ok",
  lead: "border-info-line bg-info-tint text-info",
  hit: "border-warn-line bg-warn-tint text-warn",
  screening: "border-line bg-elevated text-muted",
  dropped: "border-danger-line bg-danger-tint text-danger",
};

/* ------------------------------------------------------------------- page */

export default function DrugDiscoveryPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [modelId, setModelId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [selectedNode, setSelectedNode] = useState<ModelNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<{ programs: Program[] }>("/api/discovery/programs")
      .then((d) => !cancelled && setPrograms(d.programs)).catch(() => {});
    api.get<{ candidates: Candidate[] }>("/api/discovery/candidates")
      .then((d) => !cancelled && setCandidates(d.candidates)).catch(() => {});
    api.get<{ models: ModelSummary[] }>("/api/discovery/models")
      .then((d) => {
        if (cancelled) return;
        setModels(d.models);
        setModelId((cur) => cur ?? d.models[0]?.id ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!modelId) return;
    let cancelled = false;
    api
      .get<ModelDetail>(`/api/discovery/models/${modelId}`)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setSelectedNode(null);
      })
      .catch(() => {
        if (cancelled) return;
        setDetail(null);
        setSelectedNode(null);
      });
    return () => { cancelled = true; };
  }, [modelId]);

  const activePrograms = programs.filter((p) => p.phase !== "discovery").length;
  const leadCandidates = candidates.filter((c) => c.status === "lead" || c.status === "optimised").length;
  const meanPtrs = useMemo(() => {
    const withPtrs = programs.filter((p) => p.ptrs !== null);
    if (!withPtrs.length) return null;
    return withPtrs.reduce((s, p) => s + (p.ptrs ?? 0), 0) / withPtrs.length;
  }, [programs]);

  // Legend entries are derived from what the loaded model actually contains.
  const kinds = useMemo(
    () => [...new Set((detail?.nodes ?? []).map((n) => n.kind))],
    [detail]
  );

  return (
    <div className="space-y-8 text-muted">
      <PageHeader />

      {/* --------------------------------------------------------- KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          emphasis
          label="Active programmes"
          value={String(programs.length)}
          sublabel={`${activePrograms} past discovery phase`}
          goodDirection="neutral"
          icon={FlaskConical}
        />
        <KpiTile
          label="Lead & optimised compounds"
          value={String(leadCandidates)}
          sublabel={`${candidates.length} candidates screened`}
          goodDirection="neutral"
          icon={Boxes}
        />
        <KpiTile
          label="Mean PTRS"
          value={meanPtrs === null ? "—" : `${(meanPtrs * 100).toFixed(0)}%`}
          sublabel="probability of technical & regulatory success"
          goodDirection="neutral"
          icon={Target}
        />
        <KpiTile
          label="Disease models"
          value={String(models.length)}
          sublabel="3D pathway and protein maps"
          goodDirection="neutral"
          icon={Orbit}
        />
      </section>

      {/* ---------------------------------------------------- 3D viewer */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-fg">3D disease modelling</h2>
                <p className="truncate text-xs text-subtle">
                  {detail ? `${detail.name} · ${detail.disease}` : "Select a model"}
                </p>
              </div>
              <select
                value={modelId ?? ""}
                onChange={(e) => setModelId(e.target.value)}
                className="rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-fg focus:border-accent focus:outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.disease} ({m.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Drag to orbit, scroll to zoom, click a node to inspect. */}
            <div className="h-[420px] w-full bg-surface">
              {detail ? (
                <DiseaseModel3D
                  key={detail.id}
                  nodes={detail.nodes}
                  edges={detail.edges}
                  onSelect={setSelectedNode}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-subtle">
                  No model loaded.
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-5 py-3">
              {kinds.map((k) => (
                <span key={k} className="flex items-center gap-1.5 text-[11px] capitalize text-subtle">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: kindColor(k) }}
                    aria-hidden="true"
                  />
                  {k}
                </span>
              ))}
              <span className="ml-auto text-[11px] text-subtle">
                Drag to orbit · scroll to zoom · dashed edges are inhibitory
              </span>
            </div>
          </div>
        </div>

        {/* -------------------------------------------- inspector */}
        <div className="space-y-6">
          <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <h3 className="mb-3 text-sm font-semibold text-fg">
              {selectedNode ? selectedNode.label : "Model summary"}
            </h3>
            {selectedNode ? (
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-subtle">Entity type</dt>
                  <dd className="capitalize text-fg">{selectedNode.kind}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-subtle">Relative expression</dt>
                  <dd className="tabular-nums text-fg">
                    {(selectedNode.expression * 100).toFixed(0)}%
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-subtle">Interactions</dt>
                  <dd className="tabular-nums text-fg">
                    {(detail?.edges ?? []).filter(
                      (e) => e.source === selectedNode.id || e.target === selectedNode.id
                    ).length}
                  </dd>
                </div>
                <div className="pt-2">
                  <div className="h-2 overflow-hidden rounded-full bg-sunken">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${selectedNode.expression * 100}%`,
                        background: kindColor(selectedNode.kind),
                      }}
                    />
                  </div>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-subtle">
                {detail?.summary ?? "Select a node in the model to inspect it."}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <h3 className="mb-1 text-sm font-semibold text-fg">Programmes</h3>
            <p className="mb-4 text-xs text-subtle">Ordered by development phase</p>
            <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {programs.map((p) => (
                <li key={p.id} className="rounded-lg border border-line bg-elevated p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-fg">{p.name}</span>
                      <span className="block text-xs text-subtle">
                        {p.therapeuticArea}
                        {p.target && ` · ${p.target}`}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full border border-line-strong bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">
                      {p.phase}
                    </span>
                  </div>
                  {p.ptrs !== null && (
                    <p className="mt-1 text-[11px] text-subtle">
                      PTRS {(p.ptrs * 100).toFixed(0)}% · {p.candidateCount} candidates
                    </p>
                  )}
                </li>
              ))}
              {programs.length === 0 && (
                <li className="text-sm text-subtle">No programmes.</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- candidates */}
      <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-fg">Compound candidates</h2>
          <p className="text-xs text-subtle">
            Binding affinity is in nM — lower is a stronger binder.
          </p>
        </div>
        <div className="max-h-[28rem] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-elevated text-xs text-subtle">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Compound</th>
                <th className="px-5 py-3 text-left font-medium">Programme</th>
                <th className="px-5 py-3 text-right font-medium">Affinity (nM)</th>
                <th className="px-5 py-3 text-right font-medium">Selectivity</th>
                <th className="px-5 py-3 text-right font-medium">ADMET</th>
                <th className="px-5 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-5 py-3 font-mono text-xs text-fg">{c.codeName}</td>
                  <td className="px-5 py-3 text-xs text-muted">{c.program}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-fg">
                    {c.bindingAffinityNm?.toFixed(1) ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted">
                    {c.selectivityFold ? `${c.selectivityFold}×` : "—"}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted">
                    {c.admetScore?.toFixed(1) ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] capitalize ${
                        STATUS_STYLE[c.status] ?? STATUS_STYLE.screening
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
              {candidates.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-subtle">
                    No candidates.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
