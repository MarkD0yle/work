/**
 * Reads pasted or uploaded tabular text. A paste from a spreadsheet is tab-separated; a CSV file is
 * comma-separated with quoted cells. Both come back as rows of trimmed cell text.
 */
export function parseDelimited(text: string): string[][] {
  const body = text.replace(/^\uFEFF/, '');
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = firstLine.includes('\t')
    ? '\t'
    : firstLine.includes(',')
      ? ','
      : firstLine.includes(';')
        ? ';'
        : '\t';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i] as string;
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && body[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  // Blank lines (a trailing newline, an empty spreadsheet row) are not rows.
  return rows.filter((r) => r.some((c) => c !== ''));
}
