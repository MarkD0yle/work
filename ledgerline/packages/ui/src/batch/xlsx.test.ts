import { describe, expect, it } from 'vitest';
import { readXlsx } from './xlsx';

/** Builds an uncompressed zip, which is all a test workbook needs. */
function zip(files: Record<string, string>): ArrayBuffer {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true);
    header.setUint32(18, data.length, true);
    header.setUint32(22, data.length, true);
    header.setUint16(26, nameBytes.length, true);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    local.push(new Uint8Array(header.buffer), nameBytes, data);
    central.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((n, part) => n + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Object.keys(files).length, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const parts = [...local, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out.buffer;
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const workbook = () =>
  zip({
    'xl/sharedStrings.xml': `<sst ${NS}><si><t>Id</t></si><si><t>Trade date</t></si><si><r><t>Quan</t></r><r><t>tity</t></r></si><si><t>T-0000042</t></si></sst>`,
    'xl/styles.xml': `<styleSheet ${NS}><numFmts><numFmt numFmtId="164" formatCode="dd\\-mmm\\-yy"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/><xf numFmtId="4"/></cellXfs></styleSheet>`,
    'xl/worksheets/sheet1.xml': `<worksheet ${NS}><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
      <row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" s="1"><v>46339</v></c><c r="C2" s="3"><v>1250000.5</v></c></row>
      <row r="3"></row>
      <row r="4"><c r="A4" t="inlineStr"><is><t>T-0000043</t></is></c><c r="B4" s="2"><v>45717</v></c><c r="D4" t="b"><v>1</v></c></row>
    </sheetData></worksheet>`,
  });

describe('readXlsx', () => {
  it('reads text, numbers, dates and booleans from the first worksheet, skipping empty rows', async () => {
    expect(await readXlsx(workbook())).toEqual([
      ['Id', 'Trade date', 'Quantity'],
      ['T-0000042', '2026-11-13', '1250000.5'],
      ['T-0000043', '2025-03-01', '', 'TRUE'],
    ]);
  });

  it('rejects a file that is not a workbook', async () => {
    await expect(
      readXlsx(
        new TextEncoder().encode('Id,Quantity\nT-1,5 and some padding to be long enough')
          .buffer as ArrayBuffer,
      ),
    ).rejects.toThrow();
  });
});
