import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Modal, { ConfirmDialog } from "../patterns/Modal";
import {
  CATALOG,
  CATALOG_BY_NAME,
  CATEGORIES,
  SETTLEMENT_PERIODS,
  creationTerms,
  entryErrors,
  formatInt,
  normalise,
  offeredFor,
  parseOrderTypes,
  serialiseOrderTypes,
  templateFor,
  type CatalogItem,
  type OrderTypeEntry,
  type YesNo,
} from "../../lib/fundConnect2/orderTypes";

/* Order types editor — grid of every configured type + add/edit modal.
 *
 * Grid
 *   - one row per type; all five controls collapse into a single chip column
 *     so the table fits the section width with no horizontal scroll
 *   - which direction a type serves (Create / Redeem) and whether it is the
 *     default is visible in the row itself, not only in the selects below
 *   - incomplete rows (e.g. imported without a unit size) are marked inline
 *     and open straight into the modal to fix
 *
 * Modal
 *   - one dialog, two steps: pick a type (searchable, grouped by category,
 *     already-added types shown but disabled), then configure it
 *   - every Yes/No is prefilled from the type's template, so only the
 *     deviations need touching; the primary button stays enabled and
 *     validates on click, pointing at what is missing instead of greying out
 *   - "Add & add another" for setting up several types in one go
 *   - closing with unsaved input asks first — inline, not a stacked dialog
 *
 * Defaults
 *   - each select only lists types offered for that direction, so a
 *     redemption default can't point at a creation-only type
 *   - the first eligible type becomes the default automatically; editing or
 *     removing a type that is a default clears it and says so
 */

type Patch = Record<string, string>;

type Props = {
  values: Record<string, string>;
  readOnly: boolean;
  /** Base currency of the fund — the unit shown for min invest value. */
  ccy: string;
  /** Applies one or more field changes as a single edit. */
  onChange: (patch: Patch) => void;
  /** Wrapper class for a field (delta / highlight styling from the page). */
  fieldClass: (fieldId: string) => string;
  /** Inline issue for a field, if any (missing / invalid at submit). */
  issueFor: (fieldId: string) => string | null;
};

const CONTROLS: { key: keyof OrderTypeEntry; label: string; short: string; help: string }[] = [
  { key: "approval", label: "Requires approval", short: "Approval", help: "Orders wait for an approver before they are accepted." },
  { key: "comment", label: "Requires comment", short: "Comment", help: "The AP must add a comment when placing the order." },
  { key: "marketDataId", label: "Requires market-data ID", short: "Market-data ID", help: "The order must carry the security's market-data identifier." },
  { key: "settleDate", label: "Supports share settlement date", short: "Settle date", help: "The AP may request a specific share settlement date." },
  { key: "netting", label: "Netting", short: "Netting", help: "Creations and redemptions of this type net against each other." },
];

const inputCls =
  "w-full rounded-md border bg-white px-2.5 py-1.5 font-mono text-sm text-neutral-900 tabular-nums focus:border-neutral-900 focus:outline-none";

export default function OrderTypeTable({ values, readOnly, ccy, onChange, fieldClass, issueFor }: Props) {
  const entries = useMemo(() => parseOrderTypes(values.orderTypes), [values.orderTypes]);
  const defCreate = values.defaultCreationOrderType ?? "";
  const defRedeem = values.defaultRedemptionOrderType ?? "";

  const [editor, setEditor] = useState<{ mode: "add" } | { mode: "edit"; name: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Write the list and keep both defaults pointing at an eligible type. */
  function commit(next: OrderTypeEntry[], message?: string) {
    const patch: Patch = { orderTypes: serialiseOrderTypes(next) };
    const notes: string[] = message ? [message] : [];
    for (const [field, dir, current] of [
      ["defaultCreationOrderType", "creation", defCreate],
      ["defaultRedemptionOrderType", "redemption", defRedeem],
    ] as const) {
      const eligible = offeredFor(next, dir);
      if (current && eligible.some((e) => e.name === current)) continue;
      if (eligible.length > 0) {
        patch[field] = eligible[0].name;
        notes.push(
          current
            ? `Default ${dir} type moved from ${current} to ${eligible[0].name}.`
            : `${eligible[0].name} set as the default ${dir} type.`,
        );
      } else if (current) {
        patch[field] = "";
        notes.push(`${current} is no longer offered for ${dir} — default cleared.`);
      }
    }
    onChange(patch);
    setNotice(notes.length ? notes.join(" ") : null);
  }

  function save(entry: OrderTypeEntry, original: string | null) {
    if (original) {
      commit(entries.map((e) => (e.name === original ? entry : e)), `${entry.name} updated.`);
    } else {
      commit([...entries, entry], `${entry.name} added.`);
    }
  }

  const editing = editor?.mode === "edit" ? entries.find((e) => e.name === editor.name) ?? null : null;
  const listIssue = issueFor("orderTypes");

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-[11px] leading-snug text-neutral-400">
          Every creation and redemption order type the fund accepts. Click a row to edit it.
          New types start from their template, so only deviations need changing.
        </p>
        {!readOnly && entries.length > 0 && (
          <AddButton onClick={() => setEditor({ mode: "add" })} />
        )}
      </div>

      {notice && (
        <p
          role="status"
          className="mt-2 flex items-start justify-between gap-3 border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-900"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 text-blue-700 hover:text-blue-900"
            aria-label="Dismiss"
          >
            ×
          </button>
        </p>
      )}

      {/* ── Grid ─────────────────────────────────────────────── */}
      <div id="fc2-field-orderTypes" className={`mt-2.5 ${fieldClass("orderTypes")}`}>
        {entries.length === 0 ? (
          <div className="flex flex-col items-start gap-2 border border-dashed border-neutral-300 px-4 py-5">
            <p className="text-sm font-medium text-neutral-800">No order types yet</p>
            <p className="text-xs text-neutral-500">
              Add at least one type offered for creation and one for redemption — the same type can
              serve both.
            </p>
            {!readOnly && <AddButton onClick={() => setEditor({ mode: "add" })} />}
          </div>
        ) : (
          <div className="overflow-x-auto border border-neutral-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-[10px] tracking-wide text-neutral-500 uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Order type</th>
                  <th className="px-3 py-2 font-medium">Used for</th>
                  <th className="px-3 py-2 text-right font-medium">Shares / unit</th>
                  <th className="px-3 py-2 text-right font-medium">Min shares</th>
                  <th className="px-3 py-2 text-right font-medium">Min invest ({ccy || "—"})</th>
                  <th className="px-3 py-2 font-medium">Controls</th>
                  {!readOnly && <th className="w-px px-3 py-2"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {entries.map((e) => {
                  const incomplete = Object.keys(entryErrors(e)).length > 0;
                  const on = CONTROLS.filter((c) => e[c.key] === "y");
                  return (
                    <tr
                      key={e.name}
                      onClick={readOnly ? undefined : () => setEditor({ mode: "edit", name: e.name })}
                      className={`align-top ${readOnly ? "" : "cursor-pointer hover:bg-neutral-50"} ${
                        incomplete ? "bg-red-50/40" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <p className="font-semibold text-neutral-900">{e.name}</p>
                        <p className="text-[10px] text-neutral-400">
                          {CATALOG_BY_NAME[e.name]?.category ?? "Custom"}
                          {incomplete && <span className="ml-1.5 font-medium text-red-700">· Incomplete</span>}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {e.creation === "y" && (
                            <DirChip label="Create" isDefault={defCreate === e.name} />
                          )}
                          {e.redemption === "y" && (
                            <DirChip label="Redeem" isDefault={defRedeem === e.name} />
                          )}
                        </div>
                        {creationTerms(e) && (
                          <p className="mt-1 font-mono text-[10px] whitespace-nowrap text-neutral-500">
                            Create {creationTerms(e)}
                          </p>
                        )}
                      </td>
                      <Num value={formatInt(e.unit)} />
                      <Num value={formatInt(e.minShares)} />
                      <Num value={e.minInvest ? Number(e.minInvest).toLocaleString("en-US") : ""} />
                      <td className="px-3 py-2">
                        {on.length === 0 ? (
                          <span className="text-neutral-400">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {on.map((c) => (
                              <span
                                key={c.key}
                                title={c.label}
                                className="border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-700"
                              >
                                {c.short}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      {!readOnly && (
                        <td className="px-3 py-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setEditor({ mode: "edit", name: e.name });
                            }}
                            className="px-1.5 py-0.5 text-[11px] font-medium text-neutral-600 hover:text-neutral-900"
                            aria-label={`Edit ${e.name}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setRemoving(e.name);
                            }}
                            className="px-1.5 py-0.5 text-[11px] font-medium text-neutral-500 hover:text-red-700"
                            aria-label={`Remove ${e.name}`}
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {listIssue && <p className="mt-1.5 text-xs text-red-700">{listIssue}</p>}
      </div>

      {/* ── Defaults ─────────────────────────────────────────── */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(
          [
            ["defaultCreationOrderType", "Default creation order type", "creation", defCreate],
            ["defaultRedemptionOrderType", "Default redemption order type", "redemption", defRedeem],
          ] as const
        ).map(([field, label, dir, current]) => {
          const eligible = offeredFor(entries, dir);
          const issue = issueFor(field);
          return (
            <div key={field} id={`fc2-field-${field}`} className={`flex flex-col gap-1 ${fieldClass(field)}`}>
              <label htmlFor={`ot-${field}`} className="text-sm font-medium text-neutral-800">
                {label}
                <span className="ml-1 text-neutral-400" aria-hidden>
                  *
                </span>
              </label>
              <select
                id={`ot-${field}`}
                value={current}
                disabled={readOnly || eligible.length === 0}
                onChange={(ev) => onChange({ [field]: ev.target.value })}
                className={`rounded-md border px-2.5 py-1.5 text-sm text-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500 ${
                  issue ? "border-red-400" : "border-neutral-300"
                }`}
              >
                <option value="">
                  {eligible.length === 0 ? `No type offered for ${dir} yet` : "Select an option"}
                </option>
                {eligible.map((e) => (
                  <option key={e.name} value={e.name}>
                    {e.name}
                  </option>
                ))}
              </select>
              <p className={`text-[11px] leading-snug ${issue ? "text-red-700" : "text-neutral-400"}`}>
                {issue ??
                  (eligible.length === 0
                    ? `Add a type offered for ${dir} to choose a default.`
                    : `Only types offered for ${dir} are listed.`)}
              </p>
            </div>
          );
        })}
      </div>

      {editor && (
        <OrderTypeModal
          key={editor.mode === "edit" ? editor.name : "add"}
          initial={editing}
          taken={entries.map((e) => e.name)}
          ccy={ccy}
          onClose={() => setEditor(null)}
          onSave={(entry, again) => {
            save(entry, editing ? editing.name : null);
            setEditor(null);
            if (again) requestAnimationFrame(() => setEditor({ mode: "add" }));
          }}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) commit(entries.filter((e) => e.name !== removing), `${removing} removed.`);
          setRemoving(null);
        }}
        title={`Remove ${removing ?? ""}?`}
        description={
          removing && (removing === defCreate || removing === defRedeem)
            ? "It is currently a default — the default will move to the next eligible type, or be cleared if there is none."
            : "Its sizing and controls will be removed from this record."
        }
        confirmLabel="Remove"
        destructive
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
    >
      <span aria-hidden>+</span> Add order type
    </button>
  );
}

function DirChip({ label, isDefault }: { label: string; isDefault: boolean }) {
  return (
    <span
      className={`border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${
        isDefault ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700"
      }`}
      title={isDefault ? `Default ${label.toLowerCase()} type` : undefined}
    >
      {label}
      {isDefault && " · default"}
    </span>
  );
}

function Num({ value }: { value: string }) {
  return (
    <td className="px-3 py-2 text-right font-mono text-neutral-900 tabular-nums">
      {value || <span className="text-neutral-300">—</span>}
    </td>
  );
}

/* ── Add / edit modal ───────────────────────────────────────── */

function OrderTypeModal({
  initial,
  taken,
  ccy,
  onClose,
  onSave,
}: {
  initial: OrderTypeEntry | null;
  taken: string[];
  ccy: string;
  onClose: () => void;
  onSave: (entry: OrderTypeEntry, addAnother: boolean) => void;
}) {
  const isEdit = initial !== null;
  const [draft, setDraft] = useState<OrderTypeEntry | null>(initial);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [tried, setTried] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [baseline, setBaseline] = useState(initial ? JSON.stringify(initial) : null);
  const dirty = draft !== null && JSON.stringify(draft) !== baseline;
  const errors = draft ? entryErrors(draft) : {};
  const errorCount = Object.keys(errors).length;

  function requestClose() {
    if (dirty && !confirmDiscard) setConfirmDiscard(true);
    else onClose();
  }

  // Modal re-runs its focus effect whenever onClose changes identity, so it
  // gets one stable callback that forwards to the latest requestClose.
  const closeRef = useRef(requestClose);
  useLayoutEffect(() => {
    closeRef.current = requestClose;
  });
  const stableClose = useCallback(() => closeRef.current(), []);

  function pick(item: CatalogItem) {
    const next = templateFor(item);
    setDraft(next);
    setBaseline(JSON.stringify(next));
    setTried(false);
    requestAnimationFrame(() => bodyRef.current?.querySelector<HTMLInputElement>("#ot-unit")?.focus());
  }

  function submit(addAnother: boolean) {
    if (!draft) return;
    if (errorCount > 0) {
      setTried(true);
      const first = Object.keys(errors)[0];
      requestAnimationFrame(() =>
        bodyRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      );
      return;
    }
    onSave(normalise(draft), addAnother);
  }

  const set = (patch: Partial<OrderTypeEntry>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const err = (k: keyof OrderTypeEntry) => (tried ? errors[k] : undefined);

  const q = query.trim().toLowerCase();
  const matches = q
    ? CATALOG.filter((c) => `${c.name} ${c.category}`.toLowerCase().includes(q))
    : CATALOG;

  return (
    <Modal
      open
      onClose={stableClose}
      size="lg"
      title={isEdit ? `Edit ${initial.name}` : "Add order type"}
      description={
        draft
          ? `${CATALOG_BY_NAME[draft.name]?.category ?? "Custom"} · ${CATALOG_BY_NAME[draft.name]?.description ?? ""}`
          : "Pick the order type, then set its sizing and controls."
      }
      footer={
        confirmDiscard ? (
          <>
            <span className="mr-auto text-xs text-neutral-700">Discard what you entered?</span>
            <button type="button" onClick={() => setConfirmDiscard(false)} className={secondaryBtn}>
              Keep editing
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
            >
              Discard
            </button>
          </>
        ) : (
          <>
            {tried && errorCount > 0 && (
              <span className="mr-auto text-xs text-red-700">
                {errorCount} field{errorCount === 1 ? "" : "s"} need{errorCount === 1 ? "s" : ""} attention
              </span>
            )}
            <button type="button" onClick={requestClose} className={secondaryBtn}>
              Cancel
            </button>
            {!isEdit && draft && (
              <button type="button" onClick={() => submit(true)} className={secondaryBtn}>
                Add &amp; add another
              </button>
            )}
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={!draft}
              title={draft ? undefined : "Pick an order type first"}
              className="bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-300"
            >
              {isEdit ? "Save changes" : "Add order type"}
            </button>
          </>
        )
      }
    >
      <div ref={bodyRef} className="flex flex-col gap-4">
        {/* Step 1 — pick. Collapses to a summary bar once a type is chosen. */}
        {draft ? (
          <div className="flex items-center justify-between gap-3 border border-neutral-200 bg-neutral-50 px-3 py-2">
            <div>
              <p className="text-[10px] tracking-wide text-neutral-400 uppercase">Order type</p>
              <p className="text-sm font-semibold text-neutral-900">{draft.name}</p>
            </div>
            {isEdit ? (
              <span className="text-[11px] text-neutral-400">
                To change the type, remove this one and add another.
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  setTried(false);
                }}
                className="text-xs font-medium text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
              >
                Change
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order types, e.g. cash, in-kind, T+0"
              aria-label="Search order types"
              className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
            />
            <div className="max-h-72 overflow-y-auto border border-neutral-200">
              {matches.length === 0 && (
                <p className="px-3 py-4 text-xs text-neutral-500">No order type matches “{query}”.</p>
              )}
              {CATEGORIES.map((cat) => {
                const items = matches.filter((c) => c.category === cat);
                if (items.length === 0) return null;
                // While searching every group with a hit is expanded.
                const expanded = q !== "" || open.has(cat);
                return (
                  <div key={cat} className="border-b border-neutral-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() =>
                        setOpen((s) => {
                          const n = new Set(s);
                          if (n.has(cat)) n.delete(cat);
                          else n.add(cat);
                          return n;
                        })
                      }
                      aria-expanded={expanded}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                    >
                      <span>
                        {cat} <span className="text-xs font-normal text-neutral-400">{items.length}</span>
                      </span>
                      <span aria-hidden className="text-neutral-400">
                        {expanded ? "▴" : "▾"}
                      </span>
                    </button>
                    {expanded && (
                      <ul className="pb-1">
                        {items.map((item) => {
                          const added = taken.includes(item.name);
                          return (
                            <li key={item.name}>
                              <button
                                type="button"
                                disabled={added}
                                onClick={() => pick(item)}
                                className="flex w-full items-start justify-between gap-3 px-5 py-1.5 text-left hover:bg-neutral-100 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              >
                                <span>
                                  <span className={`block text-sm ${added ? "text-neutral-400" : "text-neutral-900"}`}>
                                    {item.name}
                                  </span>
                                  <span className="block text-[11px] text-neutral-400">{item.description}</span>
                                </span>
                                {added && (
                                  <span className="mt-0.5 shrink-0 text-[10px] font-medium text-neutral-400 uppercase">
                                    Added
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2 — configure. */}
        {draft && (
          <>
            <Group title="Sizing">
              <div className="grid gap-3 sm:grid-cols-3">
                <NumField
                  id="ot-unit"
                  field="unit"
                  label="Shares per unit"
                  required
                  hint="Shares in one creation / redemption unit (basket)."
                  value={draft.unit}
                  error={err("unit")}
                  onChange={(v) => set({ unit: v })}
                />
                <NumField
                  id="ot-minShares"
                  field="minShares"
                  label="Min share amount"
                  hint="Optional floor per order."
                  value={draft.minShares}
                  error={err("minShares")}
                  onChange={(v) => set({ minShares: v })}
                />
                <NumField
                  id="ot-minInvest"
                  field="minInvest"
                  label="Min invest value"
                  unit={ccy}
                  decimals
                  hint="Optional, in the fund's base currency."
                  value={draft.minInvest}
                  error={err("minInvest")}
                  onChange={(v) => set({ minInvest: v })}
                />
              </div>
            </Group>

            <Group title="Available for" note="At least one.">
              <YesNoRow
                field="creation"
                label="Offered for creation"
                value={draft.creation}
                error={err("creation")}
                onChange={(v) =>
                  set(
                    // Turning creation on starts the offset at the fund cut-off.
                    v === "y" && draft.creationCutoffOffset === ""
                      ? { creation: v, creationCutoffOffset: "0" }
                      : { creation: v },
                  )
                }
                controls="ot-creation-terms"
              />
              {/* Creation terms — revealed only while creation is offered,
                  nested under the toggle that owns them. */}
              {draft.creation === "y" && (
                <div
                  id="ot-creation-terms"
                  className="ml-1 grid animate-[forensic-slide-up_200ms_ease-out] gap-3 border-l-2 border-neutral-200 py-1 pl-4 sm:grid-cols-2"
                >
                  <TextField
                    id="ot-creationCutoffOffset"
                    field="creationCutoffOffset"
                    label="Creation cut-off offset"
                    required
                    unit="min"
                    numeric
                    hint="Minutes relative to the fund's dealing cut-off; negative closes earlier."
                    value={draft.creationCutoffOffset}
                    error={err("creationCutoffOffset")}
                    onChange={(v) => set({ creationCutoffOffset: v })}
                  />
                  <div data-field="creationSettlement" className="flex flex-col gap-1">
                    <label htmlFor="ot-creationSettlement" className="text-xs font-medium text-neutral-800">
                      Default settlement period
                      <span className="ml-0.5 text-neutral-400" aria-hidden>
                        *
                      </span>
                    </label>
                    <select
                      id="ot-creationSettlement"
                      value={draft.creationSettlement}
                      onChange={(e) => set({ creationSettlement: e.target.value })}
                      aria-invalid={Boolean(err("creationSettlement"))}
                      className={`rounded-md border bg-white px-2.5 py-1.5 text-sm text-neutral-900 ${
                        err("creationSettlement") ? "border-red-400" : "border-neutral-300"
                      }`}
                    >
                      <option value="">Select settlement period</option>
                      {SETTLEMENT_PERIODS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <p
                      className={`text-[11px] leading-snug ${
                        err("creationSettlement") ? "text-red-700" : "text-neutral-400"
                      }`}
                    >
                      {err("creationSettlement") ?? "Business days from trade to settlement."}
                    </p>
                  </div>
                  <TextField
                    id="ot-creationTaCode"
                    field="creationTaCode"
                    label="TA instruct code"
                    hint="Optional. Transfer-agent instruction code."
                    value={draft.creationTaCode}
                    onChange={(v) => set({ creationTaCode: v })}
                  />
                  <TextField
                    id="ot-creationBasketCode"
                    field="creationBasketCode"
                    label="Basket code"
                    hint="Optional. Basket the creation is delivered against."
                    value={draft.creationBasketCode}
                    onChange={(v) => set({ creationBasketCode: v })}
                  />
                </div>
              )}
              <YesNoRow
                field="redemption"
                label="Offered for redemption"
                value={draft.redemption}
                error={err("redemption")}
                onChange={(v) => set({ redemption: v })}
              />
            </Group>

            <Group
              title="Controls"
              note={isEdit ? undefined : `Prefilled from the ${CATALOG_BY_NAME[draft.name]?.category ?? ""} template — review before adding.`}
            >
              {CONTROLS.map((c) => (
                <YesNoRow
                  key={c.key}
                  field={c.key}
                  label={c.label}
                  help={c.help}
                  value={draft[c.key] as YesNo}
                  error={err(c.key)}
                  onChange={(v) => set({ [c.key]: v } as Partial<OrderTypeEntry>)}
                />
              ))}
            </Group>
          </>
        )}
      </div>
    </Modal>
  );
}

const secondaryBtn =
  "border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100";

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-neutral-200 pt-3">
      <legend className="pr-2 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
        {title}
      </legend>
      {note && <p className="-mt-1 mb-2 text-[11px] text-neutral-400">{note}</p>}
      <div className="flex flex-col gap-2">{children}</div>
    </fieldset>
  );
}

function NumField({
  id,
  field,
  label,
  required,
  hint,
  unit,
  decimals,
  value,
  error,
  onChange,
}: {
  id: string;
  field: string;
  label: string;
  required?: boolean;
  hint: string;
  unit?: string;
  decimals?: boolean;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  // Thousands separators while reading; raw digits while typing.
  const shown = focused || value === "" ? value : decimals ? Number(value).toLocaleString("en-US") : formatInt(value);
  return (
    <div data-field={field} className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-neutral-800">
        {label}
        {required && (
          <span className="ml-0.5 text-neutral-400" aria-hidden>
            *
          </span>
        )}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          inputMode={decimals ? "decimal" : "numeric"}
          value={shown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value.replace(decimals ? /[^0-9.]/g : /[^0-9]/g, ""))}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-hint`}
          className={`${inputCls} text-right ${error ? "border-red-400" : "border-neutral-300"}`}
        />
        {unit && <span className="shrink-0 text-xs text-neutral-400">{unit}</span>}
      </div>
      <p id={`${id}-hint`} className={`text-[11px] leading-snug ${error ? "text-red-700" : "text-neutral-400"}`}>
        {error ?? hint}
      </p>
    </div>
  );
}

function YesNoRow({
  field,
  label,
  help,
  value,
  error,
  controls,
  onChange,
}: {
  field: string;
  label: string;
  help?: string;
  value: YesNo;
  error?: string;
  /** Id of the region a "Yes" reveals, for assistive tech. */
  controls?: string;
  onChange: (v: YesNo) => void;
}) {
  return (
    <div data-field={field} className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-neutral-800">{label}</p>
        {(error || help) && (
          <p className={`text-[11px] leading-snug ${error ? "text-red-700" : "text-neutral-400"}`}>
            {error ?? help}
          </p>
        )}
      </div>
      <div
        role="radiogroup"
        aria-label={label}
        className={`inline-flex shrink-0 border ${error ? "border-red-400" : "border-neutral-300"}`}
      >
        {(["y", "n"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            aria-controls={v === "y" ? controls : undefined}
            aria-expanded={v === "y" && controls ? value === "y" : undefined}
            onClick={() => onChange(v)}
            className={`w-12 py-1 text-xs font-medium ${
              value === v ? "bg-neutral-900 text-white" : "bg-white text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {v === "y" ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

function TextField({
  id,
  field,
  label,
  required,
  hint,
  unit,
  numeric,
  value,
  error,
  onChange,
}: {
  id: string;
  field: string;
  label: string;
  required?: boolean;
  hint: string;
  unit?: string;
  /** Whole numbers, sign allowed. Otherwise a code: no spaces, upper case. */
  numeric?: boolean;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div data-field={field} className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-neutral-800">
        {label}
        {required && (
          <span className="ml-0.5 text-neutral-400" aria-hidden>
            *
          </span>
        )}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          inputMode={numeric ? "numeric" : "text"}
          value={value}
          onChange={(e) =>
            onChange(
              numeric
                ? e.target.value.replace(/[^0-9-]/g, "").replace(/(?!^)-/g, "")
                : e.target.value.replace(/\s/g, "").toUpperCase(),
            )
          }
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-hint`}
          className={`${inputCls} ${numeric ? "text-right" : ""} ${error ? "border-red-400" : "border-neutral-300"}`}
        />
        {unit && <span className="shrink-0 text-xs text-neutral-400">{unit}</span>}
      </div>
      <p id={`${id}-hint`} className={`text-[11px] leading-snug ${error ? "text-red-700" : "text-neutral-400"}`}>
        {error ?? hint}
      </p>
    </div>
  );
}
