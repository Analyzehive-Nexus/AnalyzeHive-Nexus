"use client";

import { useState } from "react";
import FileDropZone from "@/components/ingestion/FileDropZone";
import ColumnMapping from "@/components/ingestion/ColumnMapping";
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

  const [columns, setColumns] = useState<{ key: string; label: string }[]>([]);
  const [data, setData] = useState<Record<string, string>[]>([]);

  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleParsed = (cols: { key: string; label: string }[], rows: Record<string, string>[]) => {
    setRawColumns(cols.map((c) => c.key));
    setRawRows(rows);
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
        columns: mappedColumns,
        rows: mappedRows,
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
    <>
      {/* Page Header */}
      <section className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#e6eaf0]">Data Connection</h2>
          <p className="text-sm text-[#9aa4b2] mt-2 max-w-xl">
            Upload structured CSV files, map columns to system fields, and push
            them to the backend before ingestion.
          </p>
        </div>
        {step !== "upload" && (
          <button
            onClick={reset}
            className="text-xs px-3 py-1.5 rounded-md border border-white/10 text-[#9aa4b2] hover:text-white hover:bg-white/5 transition"
          >
            Start over
          </button>
        )}
      </section>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <section className="mb-12">
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
            <h3 className="text-sm font-medium text-[#e6eaf0]">Data Preview</h3>
            {uploading && <span className="text-xs text-[#9aa4b2]">Uploading…</span>}
            {uploadResult && (
              <span className="text-xs text-[#7cff4e]">
                Uploaded {uploadResult.receivedRows} rows at{" "}
                {new Date(uploadResult.receivedAt).toLocaleTimeString()}
              </span>
            )}
            {uploadError && <span className="text-xs text-red-400">{uploadError}</span>}
          </div>
          <DataGrid columns={columns} data={data} />
        </section>
      )}
    </>
  );
}
