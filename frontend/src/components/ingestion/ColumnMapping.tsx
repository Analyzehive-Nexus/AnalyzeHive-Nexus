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

  const assigned = Object.values(mapping).filter(Boolean);

  // Two CSV columns pointing at the same system field used to pass validation
  // and then silently overwrite each other during the remap, losing a column.
  const duplicateFields = SYSTEM_FIELDS.filter(
    (f) => assigned.filter((key) => key === f.key).length > 1
  );

  const missingRequired = SYSTEM_FIELDS.filter(
    (f) => f.required && !assigned.includes(f.key)
  );

  const isValid = missingRequired.length === 0 && duplicateFields.length === 0;

  return (
    <section className="max-w-2xl mb-10">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-fg">Map CSV Columns</h3>
        <p className="text-xs text-muted mt-1">
          Match uploaded columns to system fields.
        </p>
      </div>

      <div className="space-y-3">
        {columns.map((col) => (
          <div
            key={col}
            className="flex items-center justify-between rounded-lg bg-elevated border border-line px-4 py-3"
          >
            <span className="text-sm text-fg">{col}</span>

            <select
              className="bg-surface border border-line text-sm text-fg rounded-md px-2 py-1"
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
                <option
                  key={f.key}
                  value={f.key}
                  disabled={mapping[col] !== f.key && assigned.includes(f.key)}
                >
                  {f.label}
                  {mapping[col] !== f.key && assigned.includes(f.key)
                    ? " (already mapped)"
                    : ""}
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

      {/* Validation feedback - a disabled button with no reason is a dead end. */}
      {(missingRequired.length > 0 || duplicateFields.length > 0) && (
        <div className="mt-4 space-y-1">
          {missingRequired.length > 0 && (
            <p className="text-[11px] text-muted">
              Still required: {missingRequired.map((f) => f.label).join(", ")}
            </p>
          )}
          {duplicateFields.length > 0 && (
            <p className="text-[11px] text-danger">
              Mapped more than once: {duplicateFields.map((f) => f.label).join(", ")}
            </p>
          )}
        </div>
      )}

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
              ? "bg-accent text-white"
              : "bg-sunken text-subtle cursor-not-allowed"
          }
        `}
      >
        Confirm Mapping
      </button>
    </section>
  );
}
