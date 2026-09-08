"use client";

import { useState } from "react";
import FileDropZone from "@/components/ingestion/FileDropZone";
import ColumnMapping from "@/components/ingestion/ColumnMapping";
import PageHeader from "@/components/PageHeader";
import DataGrid from "@/components/DataGrid";
import { api } from "@/lib/api";

type Step = "upload" | "mapping" | "preview";

interface UploadResult {
  id: string;
  receivedRows: number;
  receivedColumns: number;
  receivedAt: string;
}

export default function DataConnectionPage() {
  const [step, setStep] = useState<Step>("upload");
  const [rawColumns, setRawColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [filename, setFilename] = useState<string>("");

  const [columns, setColumns] = useState<{ key: string; label: string }[]>([]);
  const [data, setData] = useState<Record<string, string>[]>([]);

  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleParsed = (
    cols: { key: string; label: string }[],
    rows: Record<string, string>[],
    name: string
  ) => {
    setRawColumns(cols.map((c) => c.key));
    setRawRows(rows);
    setFilename(name);
    setStep("mapping");
  };

  const handleMappingConfirm = async (
    mapped: { original: string; key: string; label: string }[]
  ) => {
    const mappedColumns = mapped.map((m) => ({ key: m.key, label: m.label }));
    const mappedRows = rawRows.map((row) => {
      const newRow: Record<string, string> = {};
      mapped.forEach((m) => {
        newRow[m.key] = row[m.original];
      });
      return newRow;
    });

    setColumns(mappedColumns);
    setData(mappedRows);
    setStep("preview");
    setUploading(true);
    setUploadError(null);

    try {
      const result = await api.post<UploadResult>("/api/ingestion/upload", {
        // `original` is the CSV's own header; the backend keeps it beside the
        // mapped key so a remap does not need a re-upload.
        columns: mapped.map((m) => ({ key: m.key, label: m.label, original: m.original })),
        rows: mappedRows,
        filename,
      });
      setUploadResult(result);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setRawColumns([]);
    setRawRows([]);
    setColumns([]);
    setData([]);
    setUploadResult(null);
    setUploadError(null);
  };

  return (
    <div className="space-y-8 text-muted">
      <PageHeader
        actions={
          step !== "upload" && (
            <button
              onClick={reset}
              className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-elevated hover:text-fg"
            >
              Start over
            </button>
          )
        }
      />

      {/* Step 1: Upload */}
      {step === "upload" && (
        <section>
          <FileDropZone onParsed={handleParsed} />
        </section>
      )}

      {/* Step 2: Column Mapping */}
      {step === "mapping" && (
        <ColumnMapping columns={rawColumns} onConfirm={handleMappingConfirm} />
      )}

      {/* Step 3: Preview + Upload status */}
      {step === "preview" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-fg">Data Preview</h3>
            {uploading && <span className="text-xs text-muted">Uploading…</span>}
            {uploadResult && (
              <span className="text-xs text-accent">
                Uploaded {uploadResult.receivedRows} rows at{" "}
                {new Date(uploadResult.receivedAt).toLocaleTimeString()}
              </span>
            )}
            {uploadError && <span className="text-xs text-danger">{uploadError}</span>}
          </div>
          <DataGrid columns={columns} data={data} />
        </section>
      )}
    </div>
  );
}
