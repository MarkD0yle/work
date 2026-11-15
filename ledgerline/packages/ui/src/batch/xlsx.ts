/**
 * A small reader for .xlsx files: the first worksheet as rows of cell text. It reads values only
 * (text, numbers, dates, booleans), not formulas or formatting. Dates come back as ISO `YYYY-MM-DD`.
 * An .xlsx file is a zip of XML parts, so this needs no library: the browser inflates and parses it.
 */

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  offset: number;
}

function entries(view: DataView): ZipEntry[] {
  let end = view.byteLength - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error('Not a zip file');
  const total = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const out: ZipEntry[] = [];
  for (let i = 0; i < total && view.getUint32(at, true) === 0x02014b50; i += 1) {
    const nameLength = view.getUint16(at + 28, true);
    out.push({
      name: decoder.decode(new Uint8Array(view.buffer, view.byteOffset + at + 46, nameLength)),
      method: view.getUint16(at + 10, true),
      compressedSize: view.getUint32(at + 20, true),
      offset: view.getUint32(at + 42, true),
    });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return out;
}

async function readEntry(view: DataView, entry: ZipEntry): Promise<string> {
  const start =
    entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
  const data = new Uint8Array(view.buffer, view.byteOffset + start, entry.compressedSize);
  if (entry.method === 0) return new TextDecoder().decode(data);
  if (entry.method !== 8) throw new Error(`Unsupported compression in ${entry.name}`);
  const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

/** Days since 1970-01-01 to an ISO date, by integer arithmetic (no `Date`, so no time zones). */
function isoFromDays(days: number): string {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
/** Excel counts days from 1899-12-30; day 25,569 is 1970-01-01. */
const EXCEL_EPOCH_OFFSET = 25569;

const BUILT_IN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
const looksLikeDate = (code: string) => /[dmy]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ''));

function dateStyles(stylesXml: string | undefined): Set<number> {
  const styles = new Set<number>();
  if (!stylesXml) return styles;
  const doc = new DOMParser().parseFromString(stylesXml, 'application/xml');
  const custom = new Map<number, string>();
  for (const f of doc.getElementsByTagName('numFmt'))
    custom.set(parseInt(f.getAttribute('numFmtId') ?? '', 10), f.getAttribute('formatCode') ?? '');
  const xfs = doc.getElementsByTagName('cellXfs')[0]?.getElementsByTagName('xf') ?? [];
  [...xfs].forEach((xf, index) => {
    const id = parseInt(xf.getAttribute('numFmtId') ?? '0', 10);
    if (BUILT_IN_DATE_FORMATS.has(id) || looksLikeDate(custom.get(id) ?? '')) styles.add(index);
  });
  return styles;
}

const columnIndex = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

/** Reads the first worksheet of an .xlsx file. Rejects when the file is not a readable workbook. */
export async function readXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const view = new DataView(buffer);
  const files = new Map(entries(view).map((e) => [e.name, e]));
  const read = (name: string) => {
    const entry = files.get(name);
    return entry ? readEntry(view, entry) : Promise.resolve(undefined);
  };
  const sheetName = [...files.keys()]
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
  if (!sheetName) throw new Error('No worksheet found');
  const [sheetXml, sharedXml, stylesXml] = await Promise.all([
    read(sheetName),
    read('xl/sharedStrings.xml'),
    read('xl/styles.xml'),
  ]);
  const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
  const textOf = (node: Element) =>
    [...node.getElementsByTagName('t')].map((t) => t.textContent ?? '').join('');
  const shared = sharedXml ? [...parse(sharedXml).getElementsByTagName('si')].map(textOf) : [];
  const dates = dateStyles(stylesXml);

  const rows: string[][] = [];
  for (const row of parse(sheetXml as string).getElementsByTagName('row')) {
    const cells: string[] = [];
    for (const c of row.getElementsByTagName('c')) {
      const type = c.getAttribute('t');
      const raw = c.getElementsByTagName('v')[0]?.textContent ?? '';
      let text = raw;
      if (type === 's') text = shared[parseInt(raw, 10)] ?? '';
      else if (type === 'inlineStr') text = textOf(c);
      else if (type === 'b') text = raw === '1' ? 'TRUE' : 'FALSE';
      else if (raw !== '' && type !== 'str' && dates.has(parseInt(c.getAttribute('s') ?? '-1', 10)))
        text = isoFromDays(parseInt(raw, 10) - EXCEL_EPOCH_OFFSET);
      cells[columnIndex(c.getAttribute('r') ?? '')] = text.trim();
    }
    const filled = Array.from(cells, (cell) => cell ?? '');
    if (filled.some((cell) => cell !== '')) rows.push(filled);
  }
  return rows;
}
