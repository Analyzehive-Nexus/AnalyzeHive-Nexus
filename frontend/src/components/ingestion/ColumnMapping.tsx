"use client";

import { useState } from "react";
import FieldBadge from "./FieldBadge";

const SYSTEM_FIELDS = [
  { key: "sku", label: "SKU ID", required: true },
  { key: "name", label: "Product Name", required: true },
  { key: "risk", label: "Risk Score", required: false },
  { key: "location", label: "Location", required: false },
];

export default function ColumnMapping({
  columns,
  onConfirm,
}: {
  columns: string[];
  onConfirm: (mapped: { original: string; key: string; label: string }[]) => void;
}) {
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const isValid = SYSTEM_FIELDS.filter((f) => f.required).every((f) =>
    Object.values(mapping).includes(f.key)
  );

  return (
    <section className="max-w-2xl mb-10">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-[#e6eaf0]">Map CSV Columns</h3>
        <p className="text-xs text-[#9aa4b2] mt-1">
          Match uploaded columns to system fields.
        </p>
      </div>

      <div className="space-y-3">
        {columns.map((col) => (
          <div
            key={col}
            className="flex items-center justify-between rounded-lg bg-[#161c24] border border-white/5 px-4 py-3"
          >
            <span className="text-sm text-[#e6eaf0]">{col}</span>

            <select
              className="bg-[#0f141b] border border-white/10 text-sm text-[#e6eaf0] rounded-md px-2 py-1"
              value={mapping[col] || ""}
              onChange={(e) =>
                setMapping((prev) => ({
                  ...prev,
                  [col]: e.target.value,
                }))
              }
            >
              <option value="">— Select field —</option>
              {SYSTEM_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* System fields legend */}
      <div className="flex gap-2 mt-4 flex-wrap">
        {SYSTEM_FIELDS.map((f) => (
          <FieldBadge key={f.key} label={f.label} required={f.required} />
        ))}
      </div>

      {/* Confirm */}
      <button
        disabled={!isValid}
        onClick={() =>
          onConfirm(
            Object.entries(mapping)
              .filter(([, key]) => key)
              .map(([original, key]) => ({
                original,
                key,
                label: SYSTEM_FIELDS.find((f) => f.key === key)?.label || key,
              }))
          )
        }
        className={`
          mt-6 px-4 py-2 rounded-md text-sm font-medium
          ${
            isValid
              ? "bg-[#7cff4e] text-black"
              : "bg-white/10 text-[#6b7280] cursor-not-allowed"
          }
        `}
      >
        Confirm Mapping
      </button>
    </section>
  );
}
