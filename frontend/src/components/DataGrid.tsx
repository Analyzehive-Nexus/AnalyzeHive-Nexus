"use client"; // Indicates to Next.js that this component should be rendered on the client side

// Import React's memo for performance optimization (prevents re-renders if props haven't changed)
import { memo, useState } from "react";

// Define the shape of a Column object
type Column = {
  key: string;   // Unique identifier for the column
  label: string; // Display text for the column header
};

// The shape of a Row. Cells are primitives - wide enough for CSV imports and
// the mock data alike, without giving up type safety the way `any` did.
export type Cell = string | number | boolean | null | undefined;
export type Row = Record<string, Cell>;

const PAGE_SIZE = 5;

// Helper function to determine the color classes based on the risk level string.
const getRiskColor = (risk: string) => {
  if (!risk) return "bg-sunken text-subtle border-line";
  const lowerRisk = risk.toLowerCase();
  if (lowerRisk.includes("high"))
    return "bg-danger-tint text-danger border-danger-line";
  if (lowerRisk.includes("medium"))
    return "bg-warn-tint text-warn border-warn-line";
  return "bg-ok-tint text-ok border-ok-line";
};

// Helper function to determine the color classes based on the status string.
const getStatusColor = (status: string) => {
  if (!status) return "bg-sunken text-subtle";
  if (status === "In-Transit") return "bg-info-tint text-info";
  if (status === "Quarantined") return "bg-warn-tint text-warn";
  return "bg-ok-tint text-ok";
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
  // Adjusted during render rather than in an effect: an effect would paint the
  // stale page first and then cascade a second render.
  const [prevData, setPrevData] = useState(data);
  if (prevData !== data) {
    setPrevData(data);
    setPage(1);
  }

  const currentPage = Math.min(page, totalPages);
  const pageRows = data.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="rounded-xl bg-surface border border-line overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-elevated text-subtle">
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
              className="border-t border-line hover:bg-elevated transition cursor-pointer"
            >
              <td className="px-4 py-4">
                <div className="w-4 h-4 rounded-full border border-line-strong" />
              </td>

              {columns.map((col) => {
                const value = row[col.key];

                // Specific styling for certain columns
                if (col.key === "sku") {
                  return (
                    <td key={col.key} className="px-4 py-4 font-mono text-fg whitespace-nowrap">
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
                  <td key={col.key} className="px-4 py-4 text-fg">
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}

          {pageRows.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-subtle">
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination Section */}
      <div className="flex justify-between items-center px-4 py-4 border-t border-line text-sm text-muted">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="disabled:opacity-30 disabled:cursor-not-allowed hover:text-fg transition"
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
                  ? "w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center"
                  : "hover:text-fg transition"
              }
            >
              {n}
            </button>
          ))}
        </div>

        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="disabled:opacity-30 disabled:cursor-not-allowed hover:text-fg transition"
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
