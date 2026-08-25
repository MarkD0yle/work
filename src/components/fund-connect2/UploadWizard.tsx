import { useMemo, useRef, useState } from "react";
import {
  autoMap,
  buildPreview,
  parseDelimited,
  rowEntries,
  SAMPLE_PASTE,
  type ColumnMapping,
  type Grid,
} from "../../lib/fundConnect2/importer";
import { FIELDS, isRequiredAt } from "../../lib/fundConnect2/schema";
import { blankValues } from "../../lib/fundConnect2/engine";

/* Upload wizard — the FC2 entry point. Upload → validate, one step at a time.
 *
 * Four steps, each answering one question in plain language:
 *   1  Upload      what did we receive, and is it structurally sound?
 *   2  Map columns which column feeds which field — shown in three groups
 *                  (recognised / not recognised / required but absent), every
 *                  mapping editable, nothing guessed silently
 *   3  Check data  what will actually be written — original vs normalised
 *                  value per cell, validated like typed input, fixable inline
 *   4  Confirm     what happens on commit, before it happens
 *
 * The importer pipeline (parse / auto-map / normalise / validate) is shared
 * with Fund Connect — the wizard only stages and presents it.
 */

export type WizardDraft = {
  title: string;
  entries: { fieldId: string; value: string }[];
  errors: number;
};

const STEPS = ["Upload", "Map columns", "Check data", "Confirm"];

type StructuralIssue = { level: "error" | "warning"; message: string };

/** Pre-flight checks on the raw text — before any mapping is attempted. */
function structuralChecks(raw: string, grid: Grid): StructuralIssue[] {
  const issues: StructuralIssue[] = [];
  if (grid.headers.length === 0) {
    issues.push({ level: "error", message: "Nothing to read — the file has no header row." });
    return issues;
  }
  if (grid.rows.length === 0) {
    issues.push({ level: "error", message: "A header row was found, but no data rows under it." });
  }
  const empty = grid.headers.filter((h) => h.trim() === "").length;
  if (empty > 0) {
    issues.push({
      level: "warning",
      message: `${empty} column${empty === 1 ? " has" : "s have"} no header name — ${empty === 1 ? "it" : "they"} cannot be auto-matched.`,
    });
  }
  const seen = new Set<string>();
  for (const h of grid.headers) {
    const key = h.trim().toLowerCase();
    if (key && seen.has(key)) {
      issues.push({ level: "warning", message: `Duplicate column header "${h}" — only the first is auto-matched.` });
    }
    seen.add(key);
  }
  const delimiter = raw.split("\n")[0]?.includes("\t") ? "\t" : ",";
  const lines = raw.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "");
  const shortRows = lines
    .slice(1)
    .map((line, i) => ({ row: i + 1, cells: line.split(delimiter).length }))
    .filter((r) => r.cells !== grid.headers.length);
  if (shortRows.length > 0) {
    issues.push({
      level: "warning",
      message: `Row${shortRows.length === 1 ? "" : "s"} ${shortRows
        .slice(0, 4)
        .map((r) => r.row)
        .join(", ")}${shortRows.length > 4 ? "…" : ""} ${shortRows.length === 1 ? "has" : "have"} a different number of cells than the header — short rows are padded with blanks.`,
    });
  }
  return issues;
}

export default function UploadWizard({
  open,
  onClose,
  onCommit,
  onBlank,
}: {
  open: boolean;
  onClose: () => void;
  onCommit: (drafts: WizardDraft[]) => void;
  /** "Start a blank draft instead" — skips the upload entirely. */
  onBlank: () => void;
}) {
  const [step, setStep] = useState(0);
  const [rawText, setRawText] = useState("");
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  /** Cell fixes made in step 3, keyed `${rowIndex}:${columnIndex}`. */
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const effectiveGrid: Grid | null = useMemo(() => {
    if (!grid) return null;
    if (Object.keys(overrides).length === 0) return grid;
    return {
      headers: grid.headers,
      rows: grid.rows.map((row, r) =>
        row.map((cell, c) => overrides[`${r}:${c}`] ?? cell),
      ),
    };
  }, [grid, overrides]);

  const preview = useMemo(() => {
    if (!effectiveGrid) return [];
    return buildPreview(effectiveGrid, mapping, blankValues(), effectiveGrid.rows.length);
  }, [effectiveGrid, mapping]);

  const structural = useMemo(
    () => (grid ? structuralChecks(rawText, grid) : []),
    [rawText, grid],
  );

  const mappedIds = new Set(mapping.filter((m) => m.fieldId).map((m) => m.fieldId as string));
  const matched = mapping.filter((m) => m.fieldId);
  const unmatched = mapping.filter((m) => !m.fieldId);
  const missingRequired = FIELDS.filter(
    (f) => isRequiredAt(f, "submit") && f.importAliases.length > 0 && !mappedIds.has(f.id),
  );

  const included = preview.filter((row) => !excluded.has(row.index));
  const totalErrors = included.reduce((n, r) => n + r.errors, 0);
  const totalFields = included.reduce((n, r) => n + r.cells.filter((c) => c.value !== "").length, 0);

  function reset() {
    setStep(0);
    setRawText("");
    setSourceName(null);
    setGrid(null);
    setMapping([]);
    setOverrides({});
    setExcluded(new Set());
    setEditing(null);
  }

  function close() {
    reset();
    onClose();
  }

  function ingest(text: string, name: string | null) {
    setRawText(text);
    setSourceName(name);
    const parsed = parseDelimited(text);
    setGrid(parsed);
    setMapping(autoMap(parsed.headers));
    setOverrides({});
    setExcluded(new Set());
  }

  function remap(index: number, fieldId: string | null) {
    setMapping((prev) =>
      prev.map((m) =>
        m.index === index
          ? { ...m, fieldId, auto: false }
          : // A field can feed only one column — stealing it unmaps the other.
            m.fieldId === fieldId
            ? { ...m, fieldId: null, auto: false }
            : m,
      ),
    );
  }

  function draftTitle(row: (typeof preview)[number]): string {
    const value = (id: string) => row.cells.find((c) => c.fieldId === id)?.value ?? "";
    const long = value("fundLongName");
    if (long) return long;
    const fund = value("fundCode");
    const side = value("side");
    if (!fund && !side) return "Uploaded ETF setup";
    return [fund, side].filter(Boolean).join(" · ");
  }

  function commit() {
    onCommit(
      included.map((row) => ({
        title: draftTitle(row),
        entries: rowEntries(row),
        errors: row.errors,
      })),
    );
    reset();
  }

  if (!open) return null;

  const hasBlockingIssue = structural.some((s) => s.level === "error");
  const canNext =
    step === 0 ? grid !== null && !hasBlockingIssue : step === 3 ? false : true;

  return (
    <div role="dialog" aria-modal="true" aria-label="Upload instructions" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close upload wizard"
        onClick={close}
        className="absolute inset-0 cursor-default bg-neutral-900/40"
      />
      <div className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-2xl">
        <span aria-hidden className="h-1 w-full shrink-0 bg-neutral-900" />

        {/* Stepper */}
        <header className="flex items-center gap-3 border-b border-neutral-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900">Upload instructions</h2>
          <ol className="ml-auto flex items-center gap-1.5">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-1.5">
                {i > 0 && <span className="h-px w-4 bg-neutral-200" aria-hidden />}
                <span
                  className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    i === step
                      ? "bg-neutral-900 text-white"
                      : i < step
                        ? "text-neutral-900"
                        : "text-neutral-400"
                  }`}
                >
                  <span className="tabular-nums">{i + 1}</span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M4.28 4.28a.75.75 0 0 1 1.06 0L10 8.94l4.66-4.66a.75.75 0 1 1 1.06 1.06L11.06 10l4.66 4.66a.75.75 0 1 1-1.06 1.06L10 11.06l-4.66 4.66a.75.75 0 1 1-1.06-1.06L8.94 10 4.28 5.34a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* ---------------- Step 1 · Upload ---------------- */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-neutral-500">
                Paste a range straight out of Excel, or choose a saved .csv / .tsv file.
                Nothing is written yet — the next two steps show exactly what the upload
                would do, and let you correct it first.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-md border border-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-900 hover:text-white"
                >
                  Choose file…
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => ingest(String(reader.result ?? ""), file.name);
                    reader.readAsText(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => ingest(SAMPLE_PASTE, "sample dealing sheet")}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Use the sample sheet
                </button>
                {sourceName && (
                  <span className="text-[11px] text-neutral-500">
                    Reading <span className="font-medium text-neutral-800">{sourceName}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    onBlank();
                  }}
                  className="ml-auto text-[11px] text-neutral-400 underline underline-offset-2 hover:text-neutral-700"
                >
                  or start a blank draft instead
                </button>
              </div>
              <textarea
                value={rawText}
                onChange={(e) => ingest(e.target.value, null)}
                rows={7}
                placeholder={"Fund Code\tShare Class\tQuantity\t…\nGB00FCAP01\tAcc GBP\t61,250\t…"}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-[11px] leading-relaxed text-neutral-800"
              />

              {grid && (
                <div className="border border-neutral-200 bg-neutral-50 px-3.5 py-3">
                  <p className="text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
                    What was recognised
                  </p>
                  <p className="mt-1 text-xs text-neutral-700">
                    <span className="font-semibold tabular-nums">{grid.rows.length}</span> data row
                    {grid.rows.length === 1 ? "" : "s"} ·{" "}
                    <span className="font-semibold tabular-nums">{grid.headers.length}</span> columns ·{" "}
                    {rawText.split("\n")[0]?.includes("\t")
                      ? "tab-separated (a pasted Excel range)"
                      : "comma-separated"}
                  </p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {structural.length === 0 && (
                      <li className="text-xs text-neutral-600">
                        ✓ Structure looks sound — every row lines up with the header.
                      </li>
                    )}
                    {structural.map((s, i) => (
                      <li
                        key={i}
                        className={`text-xs ${s.level === "error" ? "text-red-700" : "text-amber-800"}`}
                      >
                        {s.level === "error" ? "✕" : "△"} {s.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ---------------- Step 2 · Map columns ---------------- */}
          {step === 1 && grid && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-neutral-500">
                Each column feeds one form field. Auto-matches show how they were made —
                change any of them. A column mapped to nothing is ignored, visibly.
              </p>

              <section>
                <h3 className="text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
                  Recognised — {matched.length} of {mapping.length} columns
                </h3>
                <ul className="mt-1.5 divide-y divide-neutral-100 border border-neutral-200">
                  {matched.map((m) => (
                    <li key={m.index} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-40 truncate font-mono text-xs text-neutral-800">{m.header}</span>
                      <span className="text-neutral-300" aria-hidden>→</span>
                      <select
                        value={m.fieldId ?? ""}
                        onChange={(e) => remap(m.index, e.target.value || null)}
                        className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-800"
                        aria-label={`Field for column ${m.header}`}
                      >
                        <option value="">— ignore this column —</option>
                        {FIELDS.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <span className="ml-auto text-[10px] text-neutral-400">
                        {m.auto ? "matched by header name" : "mapped by you"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {unmatched.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-semibold tracking-wide text-amber-800 uppercase">
                    Not recognised — map by hand, or leave ignored
                  </h3>
                  <ul className="mt-1.5 divide-y divide-amber-100 border border-amber-300 bg-amber-50/40">
                    {unmatched.map((m) => (
                      <li key={m.index} className="flex items-center gap-3 px-3 py-2">
                        <span className="w-40 truncate font-mono text-xs text-neutral-800">
                          {m.header || <em className="text-neutral-400">(no header)</em>}
                        </span>
                        <span className="text-neutral-300" aria-hidden>→</span>
                        <select
                          value=""
                          onChange={(e) => e.target.value && remap(m.index, e.target.value)}
                          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-800"
                          aria-label={`Field for column ${m.header || "unnamed"}`}
                        >
                          <option value="">— ignored —</option>
                          {FIELDS.filter((f) => !mappedIds.has(f.id)).map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                        <span className="ml-auto text-[10px] text-amber-800">
                          this column will not be imported
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {missingRequired.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
                    Required, but not in this file
                  </h3>
                  <p className="mt-1.5 border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                    {missingRequired.map((f) => f.label).join(" · ")} — no column matched.
                    The drafts are still created; these fields are filled in on the form
                    before submitting.
                  </p>
                </section>
              )}
            </div>
          )}

          {/* ---------------- Step 3 · Check data ---------------- */}
          {step === 2 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-neutral-500">
                One card per row — original value on the left of the arrow when the
                upload had to reshape it. Uploaded values are validated exactly like
                typed ones. Click a value to correct it here; untick a row to leave it
                out.
              </p>
              {preview.map((row) => {
                const off = excluded.has(row.index);
                return (
                  <div
                    key={row.index}
                    className={`border ${off ? "border-neutral-200 opacity-50" : row.errors > 0 ? "border-red-200" : "border-neutral-200"} bg-white`}
                  >
                    <div className="flex items-center gap-2.5 border-b border-neutral-100 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!off}
                        onChange={() =>
                          setExcluded((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.index)) next.delete(row.index);
                            else next.add(row.index);
                            return next;
                          })
                        }
                        className="h-3.5 w-3.5 accent-neutral-900"
                        aria-label={`Include row ${row.index + 1}`}
                      />
                      <span className="text-xs font-semibold text-neutral-900">
                        Row {row.index + 1} · {draftTitle(row) || "Uploaded instruction"}
                      </span>
                      {row.errors > 0 && (
                        <span className="rounded-full bg-red-100 px-1.5 text-[11px] font-medium text-red-700">
                          {row.errors} error{row.errors === 1 ? "" : "s"}
                        </span>
                      )}
                      {row.warnings > 0 && (
                        <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-medium text-amber-800">
                          {row.warnings} warning{row.warnings === 1 ? "" : "s"}
                        </span>
                      )}
                      {row.errors === 0 && row.warnings === 0 && (
                        <span className="text-[11px] text-neutral-400">clean</span>
                      )}
                    </div>
                    {!off && (
                      <ul className="grid grid-cols-1 gap-x-6 px-3 py-1.5 sm:grid-cols-2">
                        {row.cells
                          .filter((c) => c.raw !== "" || c.issue)
                          .map((cell) => {
                            const col = mapping.find((m) => m.fieldId === cell.fieldId);
                            const key = `${row.index}:${col?.index ?? -1}`;
                            const isEditing = editing === key;
                            return (
                              <li key={cell.fieldId} className="flex flex-col gap-0.5 border-b border-neutral-50 py-1.5 last:border-b-0">
                                <div className="flex items-baseline gap-2">
                                  <span className="w-32 shrink-0 truncate text-[11px] text-neutral-400">
                                    {cell.label}
                                  </span>
                                  {isEditing ? (
                                    <input
                                      autoFocus
                                      defaultValue={cell.raw}
                                      onBlur={(e) => {
                                        setOverrides((prev) => ({ ...prev, [key]: e.target.value }));
                                        setEditing(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                        if (e.key === "Escape") setEditing(null);
                                      }}
                                      className="w-40 rounded-md border border-neutral-400 bg-white px-1.5 py-0.5 font-mono text-xs text-neutral-900"
                                      aria-label={`Correct ${cell.label}`}
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => col && setEditing(key)}
                                      title="Click to correct this value"
                                      className={`truncate rounded px-1 py-0.5 text-left font-mono text-xs hover:bg-neutral-100 ${
                                        cell.issue?.level === "error"
                                          ? "text-red-700"
                                          : "text-neutral-900"
                                      }`}
                                    >
                                      {cell.note && cell.raw !== cell.value && (
                                        <span className="text-neutral-400 line-through">{cell.raw} </span>
                                      )}
                                      {cell.value || "—"}
                                    </button>
                                  )}
                                </div>
                                {cell.note && (
                                  <span className="pl-34 text-[10px] text-neutral-400">{cell.note}</span>
                                )}
                                {cell.issue && (
                                  <span
                                    className={`text-[11px] leading-snug ${
                                      cell.issue.level === "error" ? "text-red-700" : "text-amber-800"
                                    }`}
                                  >
                                    {cell.issue.message}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ---------------- Step 4 · Confirm ---------------- */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="border border-neutral-200 bg-neutral-50 px-4 py-3.5">
                <p className="text-sm text-neutral-800">
                  <span className="font-semibold tabular-nums">{included.length}</span> draft
                  {included.length === 1 ? "" : "s"} will be created —{" "}
                  <span className="font-semibold tabular-nums">{totalFields}</span> field
                  {totalFields === 1 ? "" : "s"} written by the upload, none retyped.
                </p>
                <p className="mt-1 text-xs text-neutral-600">
                  {totalErrors > 0 ? (
                    <>
                      <span className="font-semibold text-red-700">{totalErrors} error{totalErrors === 1 ? "" : "s"}</span>{" "}
                      remain{totalErrors === 1 ? "s" : ""} — the drafts are still created,
                      and the form shows exactly which fields to fix before they can be
                      submitted.
                    </>
                  ) : (
                    "No validation errors — each draft is ready to finish and submit."
                  )}
                </p>
              </div>
              <ul className="divide-y divide-neutral-100 border border-neutral-200">
                {included.map((row) => (
                  <li key={row.index} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="text-xs font-medium text-neutral-900">{draftTitle(row)}</span>
                    <span className="text-[11px] text-neutral-400">
                      {row.cells.filter((c) => c.value !== "").length} fields
                    </span>
                    {row.errors > 0 ? (
                      <span className="ml-auto rounded-full bg-red-100 px-1.5 text-[11px] font-medium text-red-700">
                        {row.errors} to fix in the form
                      </span>
                    ) : (
                      <span className="ml-auto text-[11px] text-neutral-400">clean</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-neutral-400">
                Every written field is audited as “import”, and any later hand-edit on
                top of one is re-badged “modified · verify”.
              </p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3">
          <button
            type="button"
            onClick={() => (step === 0 ? close() : setStep(step - 1))}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
          >
            {step === 0 ? "Cancel" : "Back"}
          </button>
          <div className="flex items-center gap-3">
            {step === 2 && (
              <span className="text-[11px] text-neutral-500">
                {included.length} of {preview.length} rows selected
                {totalErrors > 0 && ` · ${totalErrors} error${totalErrors === 1 ? "" : "s"} open`}
              </span>
            )}
            {step < 3 ? (
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setStep(step + 1)}
                className="rounded-md bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={included.length === 0}
                onClick={commit}
                className="rounded-md bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300"
              >
                Create {included.length} draft{included.length === 1 ? "" : "s"}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
