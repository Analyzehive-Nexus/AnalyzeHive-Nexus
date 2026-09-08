"use client";

import { useEffect, useRef, useState } from "react";
import UploadProgress from "./UploadProgress";
import { parseCsvToRows } from "@/lib/csv";

const MAX_FILE_BYTES = 50 * 1024 * 1024; // matches the "Max 50MB" hint below

export default function FileDropZone({
  onParsed,
}: {
  onParsed: (
    cols: { key: string; label: string }[],
    rows: Record<string, string>[],
    filename: string
  ) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // An in-flight progress ticker would otherwise keep firing after unmount.
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleFile = (file: File) => {
    setError(null);

    // The 50MB cap was advertised but never enforced - a larger file would
    // silently lock the tab up in FileReader.
    if (file.size > MAX_FILE_BYTES) {
      setError(
        `File is ${(file.size / 1024 / 1024).toFixed(1)}MB - the limit is 50MB.`
      );
      setProgress(null);
      return;
    }

    const reader = new FileReader();

    const stopTicker = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    reader.onload = () => {
      stopTicker();
      setProgress(100);

      const { headers, rows } = parseCsvToRows(reader.result as string);

      if (headers.length === 0) {
        setError("That file has no readable rows.");
        setProgress(null);
        return;
      }

      onParsed(
        headers.map((h) => ({ key: h, label: h })),
        rows,
        file.name
      );
    };

    reader.onerror = () => {
      stopTicker();
      setError("Could not read that file.");
      setProgress(null);
    };

    reader.readAsText(file);

    // demo-safe progress
    setProgress(0);
    stopTicker();
    intervalRef.current = setInterval(() => {
      // Clamp at 100: incrementing first and testing after used to paint a
      // 108% bar for one tick.
      setProgress((p) => Math.min(100, (p ?? 0) + 12));
    }, 180);
  };

  return (
    <div className="flex justify-center">
      <div
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".csv";
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleFile(file);
          };
          input.click();
        }}
        className="aspect-square w-[420px] rounded-2xl border-2 border-dashed border-line bg-gradient-to-b from-surface to-canvas flex flex-col items-center justify-center cursor-pointer transition hover:border-accent-line"
      >
        {/* Icon */}
        <div
          className="w-14 h-14 mb-4 rounded-full bg-accent-tint flex items-center justify-center text-accent text-xl"
        >
          ⬆
        </div>

        {/* Primary Text */}
        <p className="text-sm font-medium text-fg text-center">
          Drop your CSV file here
        </p>

        {/* Secondary Text */}
        <p className="text-xs text-muted mt-1">or click to browse</p>

        {/* Hint */}
        <p className="text-[11px] text-subtle mt-4">
          Supported format: CSV · Max 50MB
        </p>

        {/* Error */}
        {error && (
          <p className="text-[11px] text-danger mt-3 px-6 text-center">{error}</p>
        )}

        {/* Progress */}
        {progress !== null && (
          <div className="w-2/3 mt-6">
            <UploadProgress progress={progress} />
          </div>
        )}
      </div>
    </div>
  );
}
