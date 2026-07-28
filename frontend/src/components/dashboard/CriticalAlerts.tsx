"use client";

import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";

interface Alert {
  id: number;
  level: "critical" | "warning";
  title: string;
  desc: string;
  time: string;
  detail: string;
}

const getLevelStyle = (level: string) => {
  if (level === "critical") return "border-red-500/30 bg-red-500/5";
  return "border-yellow-400/30 bg-yellow-400/5";
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
    <div className="rounded-xl bg-[#0f141b] border border-white/5 p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-medium text-[#e6eaf0]">Critical Alerts</h3>
          <p className="text-xs text-[#6b7280]">System-detected operational risks</p>
        </div>
        <span className="text-xs text-red-400">
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
                transition hover:bg-white/[0.02]
              `}
            >
              <span
                className={`
                  absolute top-4 left-4 w-2 h-2 rounded-full
                  ${alert.level === "critical" ? "bg-red-500 animate-pulse" : "bg-yellow-400"}
                `}
              />

              <div className="pl-6">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-[#e6eaf0]">{alert.title}</p>
                  <span className="text-[10px] uppercase tracking-wider text-[#6b7280]">
                    {alert.level}
                  </span>
                </div>

                <p className="text-xs text-[#9aa4b2] mt-1">{alert.desc}</p>

                {isExpanded && (
                  <p className="text-xs text-[#cbd5e1] mt-3 leading-relaxed border-t border-white/5 pt-3">
                    {alert.detail}
                  </p>
                )}

                <div className="flex items-center justify-between mt-3">
                  <span className="text-[11px] text-[#6b7280]">{alert.time}</span>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                    className="text-xs text-[#7cff4e] opacity-0 group-hover:opacity-100 transition"
                  >
                    {isExpanded ? "Hide details" : "Investigate →"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && alerts.length === 0 && (
          <p className="text-xs text-[#6b7280]">No active alerts.</p>
        )}
      </div>

      <button
        onClick={() => setCenterOpen(true)}
        className="mt-5 w-full py-2 text-xs rounded-md border border-white/10 text-[#9aa4b2] hover:bg-white/5 hover:text-[#e6eaf0] transition"
      >
        Open alert center
      </button>

      {centerOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setCenterOpen(false)}
          >
            <div
              className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl bg-[#0f141b] border border-white/10 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#e6eaf0]">Alert Center</h3>
                <button
                  onClick={() => setCenterOpen(false)}
                  className="text-xs text-[#9aa4b2] hover:text-white"
                >
                  Close
                </button>
              </div>
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div key={alert.id} className={`p-4 rounded-lg border ${getLevelStyle(alert.level)}`}>
                    <p className="text-sm font-medium text-[#e6eaf0]">{alert.title}</p>
                    <p className="text-xs text-[#9aa4b2] mt-1">{alert.desc}</p>
                    <p className="text-xs text-[#cbd5e1] mt-2 leading-relaxed">{alert.detail}</p>
                    <span className="text-[11px] text-[#6b7280] block mt-2">{alert.time}</span>
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
