// Import the DataGrid component which is a reusable table component
import DataGrid, { type Row } from "@/components/DataGrid";

// A single batch row. Structurally compatible with DataGrid's Row.
export interface Batch extends Row {
  sku: string;
  name: string;
  risk: string;
  day: string;
}

// The ActiveBatchesTable component definition.
// It acts as a wrapper around the generic DataGrid to provide specific columns and behavior.
export default function ActiveBatchesTable({
  data,        // The array of batch data to display
  onSelectDay, // Callback function when a day is selected (via row click)
}: {
  data: Batch[];
  onSelectDay: (day: string) => void; // Function signature for the onSelectDay prop
}) {
  // Render the DataGrid with specific configuration for Active Batches
  return (
    <DataGrid
      // Define the columns specific to this table view
      columns={[
        { key: "sku", label: "SKU" },       // Column for Stock Keeping Unit
        { key: "name", label: "Product" },  // Column for Product Name
        { key: "risk", label: "Risk" },     // Column for Risk Level
      ]}
      // Pass the data down to the grid
      data={data}
      // Handle row click events: extract the 'day' from the row data and call
      // the parent's handler.
      onRowClick={(row: Row) => onSelectDay(String(row.day ?? ""))}
    />
  );
}
