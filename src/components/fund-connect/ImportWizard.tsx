import { useMemo, useState } from "react";
import {
  autoMap,
  buildPreview,
  parseDelimited,
  rowEntries,
  SAMPLE_PASTE,
  type ColumnMapping,
  type Grid,
  type PreviewRow,
} from "../../lib/fundConnect/importer";
import { FIELDS, FIELD_BY_ID } from "../../lib/fundConnect/schema";

/* Import wizard — spec §2, build step 1.
 *
 * Three stops, none of them skippable: read the range, show the column
 * mapping (auto-detected, always editable), preview the mapped rows against
 * the target fields. Nothing is written to the form until the last button. */

type Step = "source" | "map" | "preview";

const STEPS: { id: Step; label: string }[] = [
  { id: "source", label: "1 · Source" },
  { id: "map", label: "2 · Column mapping" },
  { id: "preview", label: "3 · Preview" },
];

export default function ImportWizard({
  open,
  baseValues,
  onClose,
  onCommit,
}: {
  open: boolean;
  baseValues: Record<string, string>;
  onClose: () => void;
  onCommit: (
    entries: { fieldId: string; value: string }[],
    extraDrafts: { fieldId: string; value: string }[][],
  ) => void;
}) {
  const [step, setStep] = useState<Step>("source");
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [grid, setGrid] = useState<Grid>({ headers: [], rows: [] });
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [selectedRow, setSelectedRow] = useState(0);
  const [spawnRest, setSpawnRest] = useState(false);

  const preview = useMemo(
    () => (mapping.length ? buildPreview(grid, mapping, baseValues) : []),
    [grid, mapping, baseValues],
  );

  const mappedFieldIds = useMemo(
    () => mapping.filter((m) => m.fieldId).map((m) => m.fieldId as string),
    [mapping],
  );
  const unmapped = mapping.filter((m) => !m.fieldId).length;
  const chosen: PreviewRow | undefined = preview[selectedRow];

  if (!open) return null;

  function reset() {
    setStep("source");
    setText("");
    setFileName(null);
    setGrid({ headers: [], rows: [] });
    setMapping([]);
    setSelectedRow(0);
    setSpawnRest(false);
  }

  function readRange(raw: string) {
    const parsed = parseDelimited(raw);
    setGrid(parsed);
    setMapping(autoMap(parsed.headers));
    setSelectedRow(0);
    setStep("map");
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-900/40 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import from Excel"
        className="w-full max-w-5xl border border-neutral-200 bg-white shadow-2xl shadow-neutral-900/20"
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Import from Excel</h2>
            <p className="text-xs text-neutral-500">
              Imported values run the same validation as typed ones.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            Close
          </button>
        </header>

        <ol className="flex gap-1 border-b border-neutral-200 bg-neutral-50 px-5 py-2">
          {STEPS.map((s) => (
            <li
              key={s.id}
              className={`px-2 py-1 text-[11px] font-medium tracking-wide uppercase ${
                s.id === step ? "text-neutral-900" : "text-neutral-400"
              }`}
            >
              {s.label}
            </li>
          ))}
        </ol>

        {step === "source" && (
          <div className="flex flex-col gap-3 p-5">
            <div className="flex gap-2">
              {(["paste", "file"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                    mode === m
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-300 bg-white text-neutral-700"
                  }`}
                >
                  {m === "paste" ? "Paste a range" : "Upload a file"}
                </button>
              ))}
            </div>

            {mode === "paste" ? (
              <>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={8}
                  placeholder="Paste straight from Excel — headers in the first row."
                  className="w-full rounded-md border border-neutral-300 p-3 font-mono text-xs text-neutral-800"
                />
                <button
                  type="button"
                  onClick={() => setText(SAMPLE_PASTE)}
                  className="self-start text-xs font-medium text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
                >
                  Use the sample dealing sheet
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 rounded-md border border-dashed border-neutral-300 p-6 text-center">
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={(e) => onFile(e.target.files?.[0])}
                  className="mx-auto text-xs text-neutral-600"
                />
                {fileName && (
                  <p className="text-xs text-neutral-500">
                    {fileName} · {parseDelimited(text).rows.length} data rows read
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={text.trim() === ""}
                onClick={() => readRange(text)}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:bg-neutral-300"
              >
                Read columns
              </button>
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="flex flex-col gap-3 p-5">
            <p className="text-xs text-neutral-500">
              {grid.headers.length} columns read, {grid.rows.length} data rows.
              {unmapped > 0 && (
                <span className="text-amber-800">
                  {" "}
                  {unmapped} column{unmapped === 1 ? "" : "s"} could not be matched to a
                  field — map them or leave them out.
                </span>
              )}
            </p>
            <div className="max-h-96 overflow-y-auto border border-neutral-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-neutral-50 text-[10px] tracking-wide text-neutral-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 font-medium">Column in sheet</th>
                    <th className="px-3 py-2 font-medium">First value</th>
                    <th className="px-3 py-2 font-medium">Maps to field</th>
                    <th className="px-3 py-2 font-medium">Detected</th>
                  </tr>
                </thead>
                <tbody>
                  {mapping.map((m) => (
                    <tr key={m.index} className="border-t border-neutral-100">
                      <td className="px-3 py-1.5 font-medium text-neutral-800">{m.header}</td>
                      <td className="px-3 py-1.5 font-mono text-neutral-500">
                        {grid.rows[0]?.[m.index] || "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={m.fieldId ?? ""}
                          onChange={(e) =>
                            setMapping((prev) =>
                              prev.map((row) =>
                                row.index === m.index
                                  ? { ...row, fieldId: e.target.value || null, auto: false }
                                  : row,
                              ),
                            )
                          }
                          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs"
                        >
                          <option value="">— do not import —</option>
                          {FIELDS.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        {m.fieldId ? (
                          <span
                            className={`rounded-full px-2 py-[1px] text-[10px] font-medium tracking-wide uppercase ${
                              m.auto
                                ? "bg-neutral-100 text-neutral-600"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {m.auto ? "By header" : "Set by you"}
                          </span>
                        ) : (
                          <span className="text-[10px] tracking-wide text-neutral-400 uppercase">
                            Not imported
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep("source")}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600"
              >
                Back
              </button>
              <button
                type="button"
                disabled={mappedFieldIds.length === 0}
                onClick={() => setStep("preview")}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:bg-neutral-300"
              >
                Preview {Math.min(grid.rows.length, 5)} rows
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-3 p-5">
            <p className="text-xs text-neutral-500">
              The first {preview.length} mapped row{preview.length === 1 ? "" : "s"}, shown
              against the fields they would write. Pick the row for this record.
            </p>
            <div className="max-h-96 overflow-auto border border-neutral-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-neutral-50 text-[10px] tracking-wide text-neutral-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 font-medium">Target field</th>
                    {preview.map((row) => (
                      <th key={row.index} className="px-3 py-2 font-medium">
                        <label className="flex items-center gap-1.5 normal-case">
                          <input
                            type="radio"
                            name="fc-import-row"
                            checked={selectedRow === row.index}
                            onChange={() => setSelectedRow(row.index)}
                            className="h-3 w-3 accent-neutral-900"
                          />
                          <span className="text-[11px] font-semibold text-neutral-700">
                            Row {row.index + 1}
                          </span>
                          {row.errors > 0 && (
                            <span className="rounded-full bg-red-100 px-1.5 text-[10px] text-red-700">
                              {row.errors}
                            </span>
                          )}
                          {row.warnings > 0 && (
                            <span className="rounded-full bg-yellow-100 px-1.5 text-[10px] text-yellow-800">
                              {row.warnings}
                            </span>
                          )}
                        </label>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mappedFieldIds.map((fieldId) => (
                    <tr key={fieldId} className="border-t border-neutral-100">
                      <td className="px-3 py-1.5 font-medium text-neutral-700">
                        {FIELD_BY_ID[fieldId]?.label ?? fieldId}
                      </td>
                      {preview.map((row) => {
                        const cell = row.cells.find((c) => c.fieldId === fieldId);
                        const level = cell?.issue?.level;
                        return (
                          <td
                            key={row.index}
                            className={`px-3 py-1.5 align-top ${
                              level === "error"
                                ? "bg-red-50 text-red-800"
                                : level === "warning"
                                  ? "bg-yellow-50 text-yellow-900"
                                  : selectedRow === row.index
                                    ? "bg-neutral-50 text-neutral-800"
                                    : "text-neutral-600"
                            }`}
                          >
                            <span className="font-mono">{cell?.value || "—"}</span>
                            {cell?.note && (
                              <span className="block text-[10px] text-neutral-500">
                                was “{cell.raw}” · {cell.note}
                              </span>
                            )}
                            {cell?.issue && (
                              <span className="block text-[10px]">{cell.issue.message}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-neutral-600">
                <input
                  type="checkbox"
                  checked={spawnRest}
                  onChange={(e) => setSpawnRest(e.target.checked)}
                  className="h-3.5 w-3.5 accent-neutral-900"
                />
                Also raise drafts for the other {preview.length - 1} row
                {preview.length - 1 === 1 ? "" : "s"}
              </label>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep("map")}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600"
              >
                Back to mapping
              </button>
              <div className="flex items-center gap-3">
                {chosen && chosen.errors > 0 && (
                  <span className="text-xs text-red-700">
                    Row {selectedRow + 1} has {chosen.errors} value
                    {chosen.errors === 1 ? "" : "s"} that will land in error.
                  </span>
                )}
                <button
                  type="button"
                  disabled={!chosen}
                  onClick={() => {
                    if (!chosen) return;
                    onCommit(
                      rowEntries(chosen),
                      spawnRest
                        ? preview
                            .filter((r) => r.index !== selectedRow)
                            .map((r) => rowEntries(r))
                        : [],
                    );
                    reset();
                  }}
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:bg-neutral-300"
                >
                  Write {chosen ? rowEntries(chosen).length : 0} fields to the form
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
