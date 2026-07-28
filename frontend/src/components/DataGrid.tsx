"use client"; // Indicates to Next.js that this component should be rendered on the client side

// Import React's memo for performance optimization (prevents re-renders if props haven't changed)
import { memo, useEffect, useState } from "react";

// Define the shape of a Column object
type Column = {
  key: string;   // Unique identifier for the column
  label: string; // Display text for the column header
};

// Define the shape of a Row object (representing a data item)
// Using Record<string, any> allows for more flexibility with different data sources
type Row = Record<string, any>;

const PAGE_SIZE = 5;

// Helper function to determine the color classes based on the risk level string.
const getRiskColor = (risk: string) => {
  if (!risk) return "bg-gray-500/15 text-gray-400 border-white/5";
  const lowerRisk = risk.toLowerCase();
  if (lowerRisk.includes("high"))
    return "bg-red-500/15 text-red-400 border-red-500/30";
  if (lowerRisk.includes("medium"))
    return "bg-yellow-400/15 text-yellow-300 border-yellow-400/30";
  return "bg-green-500/15 text-green-400 border-green-500/30";
};

// Helper function to determine the color classes based on the status string.
const getStatusColor = (status: string) => {
  if (!status) return "bg-gray-500/15 text-gray-400";
  if (status === "In-Transit") return "bg-blue-500/15 text-blue-300";
  if (status === "Quarantined") return "bg-yellow-500/15 text-yellow-300";
  return "bg-green-500/15 text-green-400";
};

// The DataGrid Component definition
function DataGrid({
  columns,
  data,
  onRowClick,
  onRowHover,
  onRowLeave,
}: {
  columns: Column[];
  data: Row[];
  onRowClick?: (row: Row) => void;
  onRowHover?: (row: Row) => void;
  onRowLeave?: () => void;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));

  // Reset to page 1 whenever the underlying data set changes (new filter,
  // new upload, etc.) so we never get stuck on a now out-of-range page.
  useEffect(() => {
    setPage(1);
  }, [data]);

  const currentPage = Math.min(page, totalPages);
  const pageRows = data.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="rounded-xl bg-[#0f141b] border border-white/5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#0b0f14] text-[#9aa4b2]">
          <tr>
            <th className="w-10"></th>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {pageRows.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              onMouseEnter={() => onRowHover?.(row)}
              onMouseLeave={() => onRowLeave?.()}
              className="border-t border-white/5 hover:bg-white/4 transition cursor-pointer"
            >
              <td className="px-4 py-4">
                <div className="w-4 h-4 rounded-full border border-white/30" />
              </td>

              {columns.map((col) => {
                const value = row[col.key];

                // Specific styling for certain columns
                if (col.key === "sku") {
                  return (
                    <td key={col.key} className="px-4 py-4 font-mono text-[#e6eaf0] whitespace-nowrap">
                      {value}
                    </td>
                  );
                }

                if (col.key === "risk") {
                  return (
                    <td key={col.key} className="px-4 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs border ${getRiskColor(String(value))}`}>
                        {value}
                      </span>
                    </td>
                  );
                }

                if (col.key === "status") {
                  return (
                    <td key={col.key} className="px-4 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(String(value))}`}>
                        {value}
                      </span>
                    </td>
                  );
                }

                return (
                  <td key={col.key} className="px-4 py-4 text-[#e6eaf0]">
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}

          {pageRows.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-[#6b7280]">
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination Section */}
      <div className="flex justify-between items-center px-4 py-4 border-t border-white/5 text-sm text-[#9aa4b2]">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="disabled:opacity-30 disabled:cursor-not-allowed hover:text-[#e6eaf0] transition"
        >
          Previous
        </button>

        <div className="flex gap-3 items-center">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={
                n === currentPage
                  ? "w-8 h-8 rounded-full bg-[#22c55e] text-black flex items-center justify-center"
                  : "hover:text-[#e6eaf0] transition"
              }
            >
              {n}
            </button>
          ))}
        </div>

        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="disabled:opacity-30 disabled:cursor-not-allowed hover:text-[#e6eaf0] transition"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// Export the component wrapped in React.memo to prevent unnecessary re-renders.
// This is especially useful for tables with many rows.
export default memo(DataGrid);
