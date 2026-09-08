/**
 * Minimal RFC 4180 CSV parser.
 *
 * The previous implementation was `line.split(",")`, which corrupts every
 * column after any quoted field containing a comma - e.g. `"Acme, Inc"`.
 * Handles quoted fields, escaped quotes (`""`), embedded newlines, and both
 * LF and CRLF line endings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // escaped quote
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      endField();
      i += 1;
      continue;
    }
    if (char === "\r") {
      // Swallow CR; the following LF (or its absence) ends the row.
      if (text[i + 1] === "\n") i += 1;
      endRow();
      i += 1;
      continue;
    }
    if (char === "\n") {
      endRow();
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  // Flush the final field/row unless the file ended on a clean row break.
  if (field.length > 0 || row.length > 0) endRow();

  // Drop trailing blank rows produced by a trailing newline.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Parses CSV text into de-duplicated headers plus keyed row objects. */
export function parseCsvToRows(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const table = parseCsv(text);
  if (table.length === 0) return { headers: [], rows: [] };

  // Duplicate header names would silently collapse into one column, so
  // disambiguate them instead of losing data.
  const seen = new Map<string, number>();
  const headers = table[0].map((raw, index) => {
    const base = raw.trim() || `column_${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });

  const rows = table.slice(1).map((values) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? "";
    });
    return row;
  });

  return { headers, rows };
}
