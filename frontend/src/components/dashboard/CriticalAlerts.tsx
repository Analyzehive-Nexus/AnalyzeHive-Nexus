"use client";

import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

interface Alert {
  id: number;
  level: "critical" | "warning";
  title: string;
  desc: string;
  createdAt: string | null;
  detail: string;
}

const getLevelStyle = (level: string) => {
  if (level === "critical") return "border-danger-line bg-danger-tint";
  return "border-warn-line bg-warn-tint";
};

function CriticalAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [centerOpen, setCenterOpen] = useState(false);

  useEffect(() => {
    api
      .get<{ alerts: Alert[] }>("/api/alerts")
      .then((data) => setAlerts(data.alerts))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-xl bg-surface border border-line p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-medium text-fg">Critical Alerts</h3>
          <p className="text-xs text-subtle">System-detected operational risks</p>
        </div>
        <span className="text-xs text-danger">
          {loading ? "…" : `${alerts.length} active`}
        </span>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const isExpanded = expandedId === alert.id;
          return (
            <div
              key={alert.id}
              className={`
                group relative p-4 rounded-lg border
                ${getLevelStyle(alert.level)}
                transition hover:bg-elevated
              `}
            >
              <span
                className={`
                  absolute top-4 left-4 w-2 h-2 rounded-full
                  ${alert.level === "critical" ? "bg-danger animate-pulse" : "bg-warn"}
                `}
              />

              <div className="pl-6">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-fg">{alert.title}</p>
                  <span className="text-[10px] uppercase tracking-wider text-subtle">
                    {alert.level}
                  </span>
                </div>

                <p className="text-xs text-muted mt-1">{alert.desc}</p>

                {isExpanded && (
                  <p className="text-xs text-muted mt-3 leading-relaxed border-t border-line pt-3">
                    {alert.detail}
                  </p>
                )}

                <div className="flex items-center justify-between mt-3">
                  <span className="text-[11px] text-subtle">{formatDateTime(alert.createdAt)}</span>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                    className="text-xs text-accent opacity-0 group-hover:opacity-100 transition"
                  >
                    {isExpanded ? "Hide details" : "Investigate →"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && alerts.length === 0 && (
          <p className="text-xs text-subtle">No active alerts.</p>
        )}
      </div>

      <button
        onClick={() => setCenterOpen(true)}
        className="mt-5 w-full py-2 text-xs rounded-md border border-line text-muted hover:bg-elevated hover:text-fg transition"
      >
        Open alert center
      </button>

      {centerOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            onClick={() => setCenterOpen(false)}
          >
            <div
              className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl bg-surface border border-line shadow-overlay p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-fg">Alert Center</h3>
                <button
                  onClick={() => setCenterOpen(false)}
                  className="text-xs text-muted hover:text-fg"
                >
                  Close
                </button>
              </div>
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div key={alert.id} className={`p-4 rounded-lg border ${getLevelStyle(alert.level)}`}>
                    <p className="text-sm font-medium text-fg">{alert.title}</p>
                    <p className="text-xs text-muted mt-1">{alert.desc}</p>
                    <p className="text-xs text-muted mt-2 leading-relaxed">{alert.detail}</p>
                    <span className="text-[11px] text-subtle block mt-2">{formatDateTime(alert.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default memo(CriticalAlerts);
