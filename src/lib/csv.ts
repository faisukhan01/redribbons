// Small CSV helpers — client-side export via Blob download

function escapeCSV(value: string | number | null): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Quote when containing quotes, commas, newlines; double embedded quotes
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCSV(headers: string[], rows: Array<Array<string | number | null>>): string {
  const lines = [headers.map(escapeCSV).join(",")];
  for (const row of rows) lines.push(row.map(escapeCSV).join(","));
  // BOM so Excel opens the file with correct encoding
  return "\uFEFF" + lines.join("\r\n");
}

export function downloadCSV(filename: string, headers: string[], rows: Array<Array<string | number | null>>): void {
  const csv = toCSV(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** e.g. "2026-09-21" */
export function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
