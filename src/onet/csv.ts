// Minimal RFC-4180 CSV parser: quoted fields, embedded commas/quotes/newlines.
// Fails loudly on structurally malformed rows instead of guessing.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const push = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    push();
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const char = text[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
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
      if (field.length > 0) throw new Error(`Malformed CSV: quote inside unquoted field at offset ${i}`);
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      push();
      i += 1;
      continue;
    }
    if (char === "\r") {
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
  if (inQuotes) throw new Error("Malformed CSV: unterminated quoted field at end of input");
  if (field.length > 0 || row.length > 0) endRow();
  return rows;
}

export interface CsvTable {
  header: string[];
  rows: string[][];
  /** Column index by header name; throws on unknown column. */
  col(name: string): number;
}

export function parseCsvTable(text: string, requiredColumns: string[] = []): CsvTable {
  const parsed = parseCsv(text);
  if (parsed.length === 0) throw new Error("Malformed CSV: empty file");
  const header = parsed[0]!.map((name) => name.trim());
  const index = new Map(header.map((name, position) => [name, position]));
  for (const required of requiredColumns) {
    if (!index.has(required)) throw new Error(`Malformed CSV: missing required column "${required}" (found: ${header.join(", ")})`);
  }
  const width = header.length;
  const rows = parsed.slice(1).filter((row) => !(row.length === 1 && row[0] === ""));
  rows.forEach((row, rowIndex) => {
    if (row.length !== width) throw new Error(`Malformed CSV: row ${rowIndex + 2} has ${row.length} fields, expected ${width}`);
  });
  return {
    header,
    rows,
    col(name: string) {
      const position = index.get(name);
      if (position === undefined) throw new Error(`Unknown CSV column "${name}"`);
      return position;
    },
  };
}
