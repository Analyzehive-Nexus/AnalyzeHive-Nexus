"use client";

import { useState } from "react";
import UploadProgress from "./UploadProgress";

export default function FileDropZone({
  onParsed,
}: {
  onParsed: (
    cols: { key: string; label: string }[],
    rows: Record<string, string>[]
  ) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();

    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.trim().split("\n");
      const headers = lines[0].split(",").map((h) => h.trim());

      const rows = lines.slice(1).map((line) => {
        const values = line.split(",");
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = values[i]?.trim() || "";
        });
        return row;
      });

      onParsed(
        headers.map((h) => ({ key: h, label: h })),
        rows
      );
    };

    reader.readAsText(file);

    // demo-safe progress
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p === null || p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 12;
      });
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
        className="aspect-square w-[420px] rounded-2xl border-2 border-dashed border-white/10 bg-gradient-to-b from-[#0f141b] to-[#0b0f14] flex flex-col items-center justify-center cursor-pointer transition hover:border-[#7cff4e]/40"
      >
        {/* Icon */}
        <div
          className="w-14 h-14 mb-4 rounded-full bg-[#7cff4e]/10 flex items-center justify-center text-[#7cff4e] text-xl"
        >
          ⬆
        </div>

        {/* Primary Text */}
        <p className="text-sm font-medium text-[#e6eaf0] text-center">
          Drop your CSV file here
        </p>

        {/* Secondary Text */}
        <p className="text-xs text-[#9aa4b2] mt-1">or click to browse</p>

        {/* Hint */}
        <p className="text-[11px] text-[#6b7280] mt-4">
          Supported format: CSV · Max 50MB
        </p>

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
