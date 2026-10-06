import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chip, RadioPills } from "../kit";
import { btnGhost, btnPrimary, btnSecondary, inputClass } from "../styles";
import { DrillForm } from "./DrillForm";
import { DialogFrame, FundAccordion, ParentFooter, SectionIntro } from "./FundSetupFrame";
import { FieldView } from "./ShareClassFields";
import { FIELD_INDEX, QUESTIONS, SECTIONS, canSave, type RadioField, type ShareClass } from "./share-class";
import {
  IMPORT_FILE,
  KIND_META,
  cellSummary,
  collectIssues,
  groupIssues,
  importNotes,
  importShareClasses,
  type CellStatus,
  type Issue,
  type IssueGroup,
  type IssueKind,
} from "./import-review";

/* Alternative G — Import review ("everything at once").
 *
 * The ten classes were not typed in: they came from a spreadsheet. So the
 * section is no longer a table plus an editor but a review surface:
 *
 *   1  a summary strip — file, counts of ready / needs-attention classes
 *      and of blank / unrecognised / invalid cells
 *   2  an attention queue grouped BY FIELD, because spreadsheet problems
 *      run down columns: one "set all" answers every class with a blank
 *      gate question; typos get a one-click suggestion; an input in the
 *      wrong format is corrected in place
 *   3  a question × class matrix — fifteen rows, ten columns — showing each
 *      answer and, for a Yes, how many of its four inputs are filled, with
 *      problem cells tinted and outliers dotted; any cell opens a popover
 *      with that question and its inputs
 *
 * "Open" on a class pushes the same drill-in form as alternative F for the
 * rare full edit, footnoted with any answer the spreadsheet could not map.
 * The parent dialog cannot be saved while anything needs attention. */

type View = { kind: "review" } | { kind: "form"; draft: ShareClass; step: number };
type CellTarget = { rowId: string; fieldKey: string; rect: DOMRect };

export default function ImportReviewExample() {
  const [imported] = useState(() => importShareClasses());
  const raw = imported.raw;
  const [rows, setRows] = useState<ShareClass[]>(imported.rows);
  const [classFilter, setClassFilter] = useState<"all" | "attention">("all");
  const [fieldFilter, setFieldFilter] = useState<"all" | "issues">("all");
  const [cell, setCell] = useState<CellTarget | null>(null);
  const [view, setView] = useState<View>({ kind: "review" });
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  const issues = useMemo(() => collectIssues(rows, raw), [rows, raw]);
  const groups = useMemo(() => groupIssues(issues), [issues]);
  const issuesByRow = useMemo(() => {
    const m = new Map<string, Issue[]>();
    for (const i of issues) m.set(i.rowId, [...(m.get(i.rowId) ?? []), i]);
    return m;
  }, [issues]);

  const attention = rows.filter((r) => issuesByRow.has(r.id));
  const counts = (Object.keys(KIND_META) as IssueKind[]).reduce(
    (acc, k) => ({ ...acc, [k]: issues.filter((i) => i.kind === k).length }),
    {} as Record<IssueKind, number>,
  );

  function setValue(rowId: string, key: string, value: string) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, [key]: value } } : r)));
  }
  function setMany(rowIds: string[], key: string, value: string) {
    const ids = new Set(rowIds);
    setRows((prev) => prev.map((r) => (ids.has(r.id) ? { ...r, values: { ...r.values, [key]: value } } : r)));
  }
  function openRow(row: ShareClass) {
    setCell(null);
    setView({ kind: "form", draft: structuredClone(row), step: 0 });
  }
  function back() {
    setView({ kind: "review" });
  }
  function patchDraft(key: string, value: string) {
    setView((v) => (v.kind === "form" ? { ...v, draft: { ...v.draft, values: { ...v.draft.values, [key]: value } } } : v));
  }
  function goto(step: number) {
    setView((v) => (v.kind === "form" ? { ...v, step: Math.max(0, Math.min(SECTIONS.length - 1, step)) } : v));
  }
  function saveDraft() {
    if (view.kind !== "form" || !canSave(view.draft)) return;
    const d = view.draft;
    setRows((prev) => prev.map((r) => (r.id === d.id ? d : r)));
    setFlash(d.id);
    setView({ kind: "review" });
  }
  const closeCell = useCallback(() => setCell(null), []);

  const inForm = view.kind === "form";
  const cellRow = cell ? rows.find((r) => r.id === cell.rowId) : undefined;
  const cellQuestion = cell ? (FIELD_INDEX[cell.fieldKey]?.field as RadioField | undefined) : undefined;

  return (
    <DialogFrame
      title={inForm ? view.draft.label : "Fund set-up"}
      description={
        inForm
          ? `Editing imported class · step ${view.step + 1} of ${SECTIONS.length} · ${SECTIONS[view.step].label}`
          : "New sub-fund · Halden Global Credit Fund"
      }
      crumbs={
        inForm
          ? [
              { label: "Fund set-up", onClick: back },
              { label: "Share classes", onClick: back },
              { label: "Import review", onClick: back },
              { label: view.draft.label },
            ]
          : undefined
      }
      footer={
        inForm ? (
          <>
            <button type="button" onClick={back} className={`${btnGhost} mr-auto`}>
              ← Back to import review
            </button>
            <button type="button" onClick={() => goto(view.step - 1)} disabled={view.step === 0} className={btnSecondary}>
              Back
            </button>
            {view.step === SECTIONS.length - 1 ? (
              <button type="button" onClick={saveDraft} disabled={!canSave(view.draft)} className={btnPrimary}>
                Save share class
              </button>
            ) : (
              <button type="button" onClick={() => goto(view.step + 1)} className={btnPrimary}>
                Next · {SECTIONS[view.step + 1]?.label}
              </button>
            )}
          </>
        ) : (
          <ParentFooter shareClasses={rows} blockers={attention.length} />
        )
      }
    >
      <FundAccordion shareClasses={rows} hidden={inForm}>
        <SectionIntro>
          Ten classes were imported from a spreadsheet. Every yes/no answer that could be read already is; what
          could not — and every blank or badly formatted input behind a Yes — is listed below, grouped by field so
          one choice can fix several classes. Click any cell in the matrix to change it.
        </SectionIntro>

        <ImportSummary total={rows.length} attention={attention.length} counts={counts} />

        <div className="mt-4">
          <IssueQueue
            groups={groups}
            rows={rows}
            onSet={setValue}
            onSetMany={setMany}
            onOpen={(id) => openRow(rows.find((r) => r.id === id)!)}
          />
        </div>

        <div className="mt-4">
          <ImportMatrix
            rows={rows}
            raw={raw}
            issuesByRow={issuesByRow}
            classFilter={classFilter}
            fieldFilter={fieldFilter}
            onClassFilter={setClassFilter}
            onFieldFilter={setFieldFilter}
            flash={flash}
            activeCell={cell}
            onCell={(rowId, fieldKey, rect) => setCell({ rowId, fieldKey, rect })}
            onOpen={openRow}
          />
        </div>
      </FundAccordion>

      {inForm && (
        <DrillForm
          key={view.draft.id}
          draft={view.draft}
          step={view.step}
          onStep={goto}
          onChange={patchDraft}
          notes={importNotes(view.draft, raw[view.draft.id])}
        />
      )}

      {cell && cellRow && cellQuestion && (
        <CellPopover
          target={cell}
          row={cellRow}
          question={cellQuestion}
          cells={raw[cellRow.id] ?? {}}
          issues={(issuesByRow.get(cellRow.id) ?? []).filter((i) => i.question.key === cellQuestion.key)}
          onChange={(key, value) => setValue(cellRow.id, key, value)}
          onOpen={() => openRow(cellRow)}
          onClose={closeCell}
        />
      )}
    </DialogFrame>
  );
}

/* ───────────── 1 · Summary strip ───────────── */

function ImportSummary({ total, attention, counts }: { total: number; attention: number; counts: Record<IssueKind, number> }) {
  const ready = total - attention;
  const items = counts.blank + counts.unrecognised + counts.invalid;
  return (
    <div className="grid gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-3 lg:grid-cols-7">
      <div className="bg-white px-4 py-3 sm:col-span-3 lg:col-span-2">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Imported from</div>
        <div className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="h-4 w-4 text-emerald-700">
            <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Zm3.75 6.25a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" />
          </svg>
          {IMPORT_FILE.name}
        </div>
        <div className="mt-0.5 text-[11px] text-neutral-500">
          Sheet “{IMPORT_FILE.sheet}” · {total} rows · {IMPORT_FILE.when}
        </div>
        <div className="mt-2 flex gap-2">
          <button type="button" className={btnSecondary}>
            Re-import
          </button>
          <button type="button" className={btnGhost}>
            Export issues
          </button>
        </div>
      </div>
      <Stat label="Ready" value={ready} sub={`of ${total} classes`} tone={ready === total ? "good" : "neutral"} />
      <Stat label="Need attention" value={attention} sub={`${items} item${items === 1 ? "" : "s"}`} tone={attention ? "warn" : "good"} />
      <Stat label="Blank" value={counts.blank} sub="required cells" tone={counts.blank ? "warn" : "neutral"} />
      <Stat label="Unrecognised" value={counts.unrecognised} sub="not yes / no" tone={counts.unrecognised ? "bad" : "neutral"} />
      <Stat label="Invalid" value={counts.invalid} sub="wrong format" tone={counts.invalid ? "bad" : "neutral"} />
    </div>
  );
}

const STAT_TONE = {
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-red-700",
  neutral: "text-neutral-900",
} as const;

function Stat({ label, value, sub, tone }: { label: string; value: number; sub: string; tone: keyof typeof STAT_TONE }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${STAT_TONE[tone]}`}>{value}</div>
      <div className="text-[11px] text-neutral-500">{sub}</div>
    </div>
  );
}

/* ───────────── 2 · Attention queue ───────────── */

function IssueQueue({
  groups,
  rows,
  onSet,
  onSetMany,
  onOpen,
}: {
  groups: IssueGroup[];
  rows: ShareClass[];
  onSet: (rowId: string, key: string, value: string) => void;
  onSetMany: (rowIds: string[], key: string, value: string) => void;
  onOpen: (rowId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const classes = new Set(groups.flatMap((g) => g.items.map((i) => i.rowId))).size;
  const valueOf = (rowId: string, key: string) => rows.find((r) => r.id === rowId)?.values[key];

  if (groups.length === 0) {
    return (
      <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
        <span aria-hidden className="h-2 w-2 bg-emerald-500" />
        Nothing needs attention — every question is answered and every input behind a Yes is filled and well-formed.
      </div>
    );
  }

  return (
    <section aria-label="Needs attention" className="border border-amber-300 bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-neutral-200 bg-amber-50/60 px-4 py-2.5">
        <h4 className="text-[11px] font-semibold tracking-widest text-neutral-800 uppercase">Needs attention</h4>
        <span className="text-xs text-neutral-600 tabular-nums">
          {total} item{total === 1 ? "" : "s"} across {classes} class{classes === 1 ? "" : "es"}
        </span>
        <span className="ml-auto text-[11px] text-neutral-500">Grouped by field — one choice can fix several classes.</span>
      </header>
      <ul className="divide-y divide-neutral-200">
        {groups.map((g) => {
          const open = !collapsed.has(g.key);
          const isAnswer = g.field.kind === "radio";
          const kindCounts = (Object.keys(KIND_META) as IssueKind[])
            .map((k) => ({ k, n: g.items.filter((i) => i.kind === k).length }))
            .filter((x) => x.n > 0);
          return (
            <li key={g.key}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(g.key)) next.delete(g.key);
                      else next.add(g.key);
                      return next;
                    })
                  }
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-90" : ""}`}>
                    <path
                      fillRule="evenodd"
                      d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-neutral-900">
                      {isAnswer ? g.field.label : `${g.question.short} · ${g.field.label}`}
                    </span>
                    <span className="block text-[11px] text-neutral-500">
                      {SECTIONS.find((s) => s.id === g.section)?.label}
                      {!isAnswer && <> · input behind “{g.question.label}”</>} · {g.items.length} class{g.items.length === 1 ? "" : "es"}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {kindCounts.map(({ k, n }) => (
                      <Chip key={k} tone={KIND_META[k].tone}>
                        {n} {KIND_META[k].label.toLowerCase()}
                      </Chip>
                    ))}
                  </span>
                </button>
                {isAnswer && g.items.length > 1 && g.field.kind === "radio" && (
                  <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                    <span>Answer for all {g.items.length}</span>
                    <RadioPills
                      name={`bulk-${g.key}`}
                      label={`${g.field.label} — answer for all affected classes`}
                      value={undefined}
                      options={g.field.options}
                      onChange={(v) => onSetMany(g.items.map((i) => i.rowId), g.key, v)}
                      size="xs"
                    />
                  </div>
                )}
              </div>
              {open && (
                <ul className="divide-y divide-neutral-100 border-t border-neutral-100 bg-neutral-50/60">
                  {g.items.map((it) => (
                    <IssueRow key={it.id} issue={it} current={valueOf(it.rowId, it.field.key)} onSet={onSet} onOpen={() => onOpen(it.rowId)} />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function IssueRow({
  issue: it,
  current,
  onSet,
  onOpen,
}: {
  issue: Issue;
  current: string | undefined;
  onSet: (rowId: string, key: string, value: string) => void;
  onOpen: () => void;
}) {
  const f = it.field;
  const meta = KIND_META[it.kind];
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 pl-11">
      <span className="w-28 shrink-0 text-xs font-medium text-neutral-900">{it.rowLabel}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Chip tone={meta.tone}>{it.kind === "blank" ? "blank cell" : `“${it.raw}”`}</Chip>
        {it.detail && <span className="text-[11px] text-red-700">{it.detail}</span>}
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {it.suggestion && (
          <button
            type="button"
            onClick={() => onSet(it.rowId, f.key, it.suggestion!)}
            className={`${btnSecondary} border-sky-300 text-sky-800 hover:bg-sky-50`}
          >
            Use “{it.suggestion}”
          </button>
        )}
        {f.kind === "radio" ? (
          <RadioPills
            name={`q-${it.id}`}
            label={`${f.label} for ${it.rowLabel}`}
            value={current}
            options={f.options}
            onChange={(v) => onSet(it.rowId, f.key, v)}
            size="xs"
          />
        ) : (
          <span className="flex items-center gap-1.5">
            <input
              aria-label={`${f.label} for ${it.rowLabel}`}
              type={f.type ?? "text"}
              inputMode={f.numeric ? "decimal" : undefined}
              className={`${inputClass} w-44 py-1 text-xs ${it.kind === "invalid" ? "border-red-400" : ""}`}
              placeholder={f.placeholder}
              value={current ?? ""}
              onChange={(e) => onSet(it.rowId, f.key, e.target.value)}
            />
            {f.unit && <span className="text-[11px] text-neutral-500">{f.unit}</span>}
          </span>
        )}
      </span>
      <button type="button" onClick={onOpen} className={btnGhost}>
        Open
      </button>
    </li>
  );
}

/* ───────────── 3 · Question × class matrix ───────────── */

const CELL_TONE: Record<CellStatus, string> = {
  ok: "text-neutral-800 hover:bg-neutral-100",
  blank: "bg-amber-50 text-amber-700 hover:bg-amber-100",
  unrecognised: "bg-red-50 text-red-700 hover:bg-red-100",
  invalid: "bg-red-50 text-red-700 hover:bg-red-100",
};

function ImportMatrix({
  rows,
  raw,
  issuesByRow,
  classFilter,
  fieldFilter,
  onClassFilter,
  onFieldFilter,
  flash,
  activeCell,
  onCell,
  onOpen,
}: {
  rows: ShareClass[];
  raw: Record<string, Record<string, string>>;
  issuesByRow: Map<string, Issue[]>;
  classFilter: "all" | "attention";
  fieldFilter: "all" | "issues";
  onClassFilter: (v: "all" | "attention") => void;
  onFieldFilter: (v: "all" | "issues") => void;
  flash: string | null;
  activeCell: CellTarget | null;
  onCell: (rowId: string, fieldKey: string, rect: DOMRect) => void;
  onOpen: (row: ShareClass) => void;
}) {
  const cols = classFilter === "all" ? rows : rows.filter((r) => issuesByRow.has(r.id));
  const attentionCount = rows.filter((r) => issuesByRow.has(r.id)).length;

  // Pre-compute every cell so filters and consistency can read them.
  const cells = new Map<string, ReturnType<typeof cellSummary>>();
  for (const s of SECTIONS)
    for (const q of QUESTIONS[s.id])
      for (const r of cols) cells.set(`${r.id}:${q.key}`, cellSummary(q, r, raw[r.id] ?? {}, issuesByRow.get(r.id) ?? []));

  const problem = (st: CellStatus) => st !== "ok";

  /* Do the classes agree on this answer? Compares answers only, not inputs. */
  function consistency(q: RadioField) {
    const answered = cols.map((r) => cells.get(`${r.id}:${q.key}`)!).filter((c) => c.answer);
    if (answered.length < 2) return null;
    const yes = answered.filter((c) => c.answer === "Yes").length;
    const mode = yes * 2 >= answered.length ? "Yes" : "No";
    const outliers = new Set(cols.filter((r) => { const c = cells.get(`${r.id}:${q.key}`)!; return c.answer && c.answer !== mode; }).map((r) => r.id));
    return { mode, outliers };
  }

  const thBase = "px-2 py-2 text-left text-[10px] font-semibold tracking-widest text-neutral-500 uppercase";
  const stickyCol = "sticky left-0 z-10 bg-white";

  const sections = SECTIONS.map((s) => ({
    ...s,
    questions: QUESTIONS[s.id].filter((q) => fieldFilter === "all" || cols.some((r) => problem(cells.get(`${r.id}:${q.key}`)!.status))),
  })).filter((s) => s.questions.length > 0);

  return (
    <section aria-label="Every question by class" className="border border-neutral-200 bg-white">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-neutral-200 px-4 py-2.5">
        <h4 className="text-[11px] font-semibold tracking-widest text-neutral-800 uppercase">Every question · every class</h4>
        <Segmented
          label="Classes"
          value={classFilter}
          options={[
            { value: "all", label: `All ${rows.length}` },
            { value: "attention", label: `Need attention (${attentionCount})` },
          ]}
          onChange={onClassFilter}
        />
        <Segmented
          label="Questions"
          value={fieldFilter}
          options={[
            { value: "all", label: "All 15" },
            { value: "issues", label: "With issues" },
          ]}
          onChange={onFieldFilter}
        />
        <ul className="ml-auto flex flex-wrap items-center gap-3 text-[10px] text-neutral-500">
          <li className="flex items-center gap-1"><span className="h-2.5 w-2.5 border border-amber-200 bg-amber-50" /> blank</li>
          <li className="flex items-center gap-1"><span className="h-2.5 w-2.5 border border-red-200 bg-red-50" /> unrecognised / invalid</li>
          <li className="flex items-center gap-1"><span className="underline decoration-amber-500 decoration-dotted underline-offset-2">Yes</span> differs from the rest</li>
          <li>“Yes · 3/4” = three of four inputs filled</li>
        </ul>
      </header>

      {cols.length === 0 || sections.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-neutral-500">Nothing matches these filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead className="border-b border-neutral-200">
              <tr>
                <th scope="col" className={`${thBase} ${stickyCol}`} style={{ minWidth: 190 }}>
                  Question
                </th>
                {cols.map((r) => {
                  const n = issuesByRow.get(r.id)?.length ?? 0;
                  return (
                    <th key={r.id} scope="col" className="px-1 py-1.5 text-left align-bottom" style={{ minWidth: 76 }}>
                      <button
                        type="button"
                        onClick={() => onOpen(r)}
                        title={`Open ${r.label}`}
                        className="group flex w-full flex-col items-start gap-0.5 px-1 py-1 text-left hover:bg-neutral-100"
                      >
                        <span className="text-xs font-semibold text-neutral-900">{r.label.replace("Class ", "")}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${n ? "text-amber-700" : "text-emerald-700"}`}>
                          <span aria-hidden className={`h-1.5 w-1.5 ${n ? "bg-amber-500" : "bg-emerald-500"}`} />
                          {n ? `${n} to fix` : "Ready"}
                        </span>
                        <span className="text-[10px] text-neutral-400 underline-offset-2 group-hover:underline">Open</span>
                      </button>
                    </th>
                  );
                })}
                <th scope="col" className={`${thBase} text-right`} style={{ minWidth: 72 }}>
                  Agree?
                </th>
              </tr>
            </thead>
            {sections.map((s) => (
              <tbody key={s.id} className="border-b border-neutral-200">
                <tr className="bg-neutral-50">
                  <th scope="rowgroup" colSpan={cols.length + 2} className={`${thBase} ${stickyCol} bg-neutral-50 py-1.5`}>
                    {s.label}
                  </th>
                </tr>
                {s.questions.map((q) => {
                  const con = consistency(q);
                  return (
                    <tr key={q.key} className="border-t border-neutral-100">
                      <th scope="row" className={`${stickyCol} px-2 py-1 text-left text-[11px] font-medium text-neutral-700`}>
                        {q.label}
                      </th>
                      {cols.map((r) => {
                        const c = cells.get(`${r.id}:${q.key}`)!;
                        const active = activeCell?.rowId === r.id && activeCell.fieldKey === q.key;
                        const outlier = con?.outliers.has(r.id) ?? false;
                        return (
                          <td key={r.id} className={`p-0 transition-colors duration-700 ${flash === r.id ? "bg-emerald-50" : ""}`}>
                            <button
                              type="button"
                              title={`${r.label} · ${q.short}: ${c.full}`}
                              aria-label={`${q.label} for ${r.label}: ${c.full}. Edit`}
                              onClick={(e) => onCell(r.id, q.key, e.currentTarget.getBoundingClientRect())}
                              className={`block w-full truncate px-2 py-1.5 text-left tabular-nums transition ${CELL_TONE[c.status]} ${
                                active ? "ring-2 ring-neutral-900 ring-inset" : ""
                              } ${outlier ? "underline decoration-amber-500 decoration-dotted underline-offset-2" : ""}`}
                              style={{ maxWidth: 110 }}
                            >
                              {c.text}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-2 py-1 text-right text-[10px] whitespace-nowrap">
                        {con === null ? (
                          <span className="text-neutral-300">—</span>
                        ) : con.outliers.size === 0 ? (
                          <span className="text-neutral-400">all {con.mode.toLowerCase()}</span>
                        ) : (
                          <span className="font-medium text-amber-700">{con.outliers.size} differ</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-neutral-500">
      <span>{label}</span>
      <div className="flex">
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`border px-2 py-1 text-[11px] font-medium ${i > 0 ? "-ml-px" : ""} ${
              value === o.value
                ? "z-10 border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Cell popover — one question and its inputs, fixed to the viewport ───────────── */

function CellPopover({
  target,
  row,
  question,
  cells,
  issues,
  onChange,
  onOpen,
  onClose,
}: {
  target: CellTarget;
  row: ShareClass;
  question: RadioField;
  cells: Record<string, string>;
  issues: Issue[];
  onChange: (key: string, value: string) => void;
  onOpen: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onScroll(e: Event) {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const W = 380;
  const left = Math.max(8, Math.min(target.rect.left, window.innerWidth - W - 8));
  const below = target.rect.bottom + 420 < window.innerHeight;
  const style = below
    ? { top: target.rect.bottom + 4, left, width: W }
    : { bottom: window.innerHeight - target.rect.top + 4, left, width: W };
  const section = SECTIONS.find((s) => s.id === FIELD_INDEX[question.key]?.section);
  const notes = importNotes(row, cells);
  const answerIssue = issues.find((i) => i.field.key === question.key);
  const worst = issues.slice().sort((a, b) => KIND_META[a.kind].order - KIND_META[b.kind].order)[0];

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Edit ${question.label} for ${row.label}`}
      style={style}
      className="fixed z-50 border border-neutral-300 bg-white shadow-2xl animate-[drill-in_160ms_ease-out]"
    >
      <header className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
        <div className="min-w-0 flex-1 truncate text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
          {row.label} · {section?.label}
        </div>
        {worst && (
          <Chip tone={KIND_META[worst.kind].tone}>
            {issues.length > 1 ? `${issues.length} to fix` : KIND_META[worst.kind].label}
          </Chip>
        )}
      </header>
      <div className="max-h-96 overflow-y-auto px-3 py-3">
        <FieldView field={question} values={row.values} onChange={onChange} idPrefix={`cell-${row.id}`} columns={1} notes={notes} />
        {answerIssue?.suggestion && (
          <button
            type="button"
            onClick={() => onChange(question.key, answerIssue.suggestion!)}
            className={`${btnSecondary} mt-3 border-sky-300 text-sky-800 hover:bg-sky-50`}
          >
            Use “{answerIssue.suggestion}”
          </button>
        )}
      </div>
      <footer className="flex items-center gap-2 border-t border-neutral-200 bg-neutral-50 px-3 py-2">
        <button type="button" onClick={onOpen} className={`${btnGhost} mr-auto`}>
          Open full form
        </button>
        <button type="button" onClick={onClose} className={btnPrimary}>
          Done
        </button>
      </footer>
    </div>
  );
}
