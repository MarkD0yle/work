/* Create / Edit forms that feed the maker-checker pipeline.
 * Submitting never touches production directly — it always produces a
 * request: form → diff preview → confirm & submit. */

import { useMemo, useState, type ReactNode } from "react";
import type {
  AssetType,
  Basis,
  BusinessEntity,
  FieldChange,
  KeyDateType,
  Rule,
  Transmission,
} from "./types";
import { COUNTRIES, TODAY } from "./data";
import { useDca } from "./store";
import { Btn, DiffView, Icons, Modal } from "./ui";

/* ---------- rule form value model ---------- */

export interface RuleValues {
  country: string;
  countryCode: string;
  assetType: AssetType;
  entity: BusinessEntity;
  active: boolean;
  effectiveDate: string;
  keyDateType: KeyDateType;
  basis: Basis;
  entitlementPeriod: string;
  generationDate: string;
  transmission: Transmission;
  sdCondition: string;
  tdCondition: string;
}

const LABELS: Record<keyof RuleValues, string> = {
  country: "Country",
  countryCode: "Country Code",
  assetType: "Asset Type",
  entity: "Business Entity",
  active: "Active",
  effectiveDate: "Effective Date",
  keyDateType: "Key Date Type",
  basis: "Position Entitlement Basis",
  entitlementPeriod: "Claim Entitlement Period",
  generationDate: "Claim Generation Date",
  transmission: "Claim Transmission",
  sdCondition: "Settlement Date Condition",
  tdCondition: "Trade Date Condition",
};

const asStr = (v: string | number | boolean) =>
  typeof v === "boolean" ? (v ? "Active" : "Inactive") : String(v);

function defaults(): RuleValues {
  return {
    country: "",
    countryCode: "",
    assetType: "Equity",
    entity: "Prime",
    active: true,
    effectiveDate: TODAY,
    keyDateType: "Record Date",
    basis: "Settle",
    entitlementPeriod: "EX-2",
    generationDate: "RD+1",
    transmission: "PD",
    sdCondition: "",
    tdCondition: "",
  };
}

function fromRule(r: Rule): RuleValues {
  return {
    country: r.country,
    countryCode: r.countryCode,
    assetType: r.assetType,
    entity: r.entity,
    active: r.active,
    effectiveDate: r.effectiveDate,
    keyDateType: r.keyDateType,
    basis: r.basis,
    entitlementPeriod: r.entitlementPeriod,
    generationDate: r.generationDate,
    transmission: r.transmission,
    sdCondition: r.sdCondition,
    tdCondition: r.tdCondition,
  };
}

/* ---------- small builders ---------- */

function parseOffset(v: string): { base: string; off: number } {
  const m = v.match(/^(EX|RD|PD)([+-]\d+)?$/);
  return { base: m?.[1] ?? "EX", off: m?.[2] ? Number(m[2]) : 0 };
}

function fmtOffset(base: string, off: number): string {
  return off === 0 ? base : `${base}${off > 0 ? "+" : ""}${off}`;
}

function OffsetBuilder({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { base, off } = parseOffset(value);
  return (
    <div className="flex items-center gap-1.5">
      <select
        className="dca-input h-8 w-20"
        value={base}
        disabled={disabled}
        onChange={(e) => onChange(fmtOffset(e.target.value, off))}
      >
        {["EX", "RD", "PD"].map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <input
        type="number"
        className="dca-input h-8 w-20"
        value={off}
        min={-9}
        max={9}
        disabled={disabled}
        onChange={(e) => onChange(fmtOffset(base, Number(e.target.value)))}
      />
      <span className="dca-mono dca-accent-text text-[12px] font-semibold">{fmtOffset(base, off)}</span>
    </div>
  );
}

function ConditionBuilder({
  left,
  value,
  onChange,
  disabled,
}: {
  left: "SD" | "TD";
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const m = value.match(/^(SD|TD) (<=|<|=|>=|>) (RD|EX|PD)$/);
  const enabled = Boolean(m);
  const op = m?.[2] ?? "<=";
  const right = m?.[3] ?? "RD";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label className="flex items-center gap-1.5 text-[12px]">
        <input
          type="checkbox"
          className="dca-check"
          checked={enabled}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? `${left} ${op} ${right}` : "")}
        />
        Set condition
      </label>
      {enabled ? (
        <>
          <span className="dca-mono dca-panel px-2 py-1 text-[12px]">{left}</span>
          <select
            className="dca-input h-8 w-16"
            value={op}
            disabled={disabled}
            onChange={(e) => onChange(`${left} ${e.target.value} ${right}`)}
          >
            {["<", "<=", "=", ">=", ">"].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <select
            className="dca-input h-8 w-20"
            value={right}
            disabled={disabled}
            onChange={(e) => onChange(`${left} ${op} ${e.target.value}`)}
          >
            {["RD", "EX", "PD"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </>
      ) : (
        <span className="dca-faint text-[12px]">N/A</span>
      )}
    </div>
  );
}

function CountryPicker({
  value,
  onSelect,
  disabled,
}: {
  value: string;
  onSelect: (name: string, code: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const matches = COUNTRIES.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  if (disabled) return <input className="dca-input h-8 w-full" value={value} disabled />;
  return (
    <div className="relative">
      <input
        className="dca-input h-8 w-full"
        placeholder="Search country…"
        value={open ? q : value}
        onFocus={() => {
          setOpen(true);
          setQ("");
        }}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="dca-pop absolute left-0 top-full z-30 mt-1 max-h-52 w-full overflow-y-auto py-1">
          {matches.length === 0 && <p className="dca-faint px-3 py-1.5 text-[12px]">No matches</p>}
          {matches.map((c) => (
            <button
              key={c.code}
              type="button"
              className="dca-pop-item"
              onMouseDown={() => {
                onSelect(c.name, c.code);
                setOpen(false);
              }}
            >
              {c.name} <span className="dca-faint">({c.code})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- field wrapper with "modified" marker ---------- */

function Field({
  label,
  required,
  modified,
  locked,
  children,
}: {
  label: string;
  required?: boolean;
  modified?: boolean;
  locked?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium">
        <span className="dca-muted">{label}</span>
        {required && <span className="dca-red-text">*</span>}
        {locked && <span className="dca-lock">locked</span>}
        {modified && <span className="dca-modified">modified</span>}
      </span>
      {children}
    </label>
  );
}

/* ---------- the rule form ---------- */

export function RuleForm({
  mode,
  original,
  prefill,
  onClose,
}: {
  mode: "create" | "edit";
  /** the production rule being edited (edit mode) */
  original?: Rule;
  /** optional overrides, e.g. from Revise & Resubmit */
  prefill?: Partial<RuleValues>;
  onClose: () => void;
}) {
  const { rules, submitRequest, navigate } = useDca();
  const base = useMemo<RuleValues>(
    () => ({ ...(original ? fromRule(original) : defaults()), ...prefill }),
    [original, prefill],
  );
  const [v, setV] = useState<RuleValues>(base);
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"form" | "preview">("form");
  const [showErrors, setShowErrors] = useState(false);

  const set = <K extends keyof RuleValues>(k: K, val: RuleValues[K]) => setV((s) => ({ ...s, [k]: val }));

  const originalValues = original ? fromRule(original) : null;
  const isModified = (k: keyof RuleValues) => (originalValues ? v[k] !== originalValues[k] : false);

  const duplicate =
    mode === "create"
      ? rules.find(
          (r) => r.active && r.country === v.country && r.assetType === v.assetType && r.entity === v.entity,
        )
      : undefined;

  const missing: string[] = [];
  if (!v.country) missing.push("Country");
  if (!v.effectiveDate) missing.push("Effective Date");
  if (!v.entitlementPeriod) missing.push("Claim Entitlement Period");
  if (!v.generationDate) missing.push("Claim Generation Date");
  if (!reason.trim()) missing.push("Reason for change");

  const changes: FieldChange[] = useMemo(() => {
    const keys = Object.keys(LABELS) as (keyof RuleValues)[];
    if (mode === "create") {
      return keys.map((k) => ({ field: LABELS[k], before: null, after: asStr(v[k]) }));
    }
    return keys
      .filter((k) => originalValues && v[k] !== originalValues[k])
      .map((k) => ({ field: LABELS[k], before: asStr(originalValues![k]), after: asStr(v[k]) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, v, original]);

  const changedValues = useMemo(() => {
    if (mode === "create") return { ...v } as unknown as Record<string, string | number | boolean>;
    const out: Record<string, string | number | boolean> = {};
    (Object.keys(LABELS) as (keyof RuleValues)[]).forEach((k) => {
      if (originalValues && v[k] !== originalValues[k]) out[k] = v[k];
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, v, original]);

  const canPreview = missing.length === 0 && !duplicate && (mode === "create" || changes.length > 0);

  const submit = () => {
    submitRequest({
      type: "Dividend Claim Rule",
      targetId: original?.id ?? null,
      targetLabel: original?.id ?? "New",
      entity: "rule",
      values: changedValues,
      changes,
      reason: reason.trim(),
    });
    onClose();
  };

  const title =
    step === "preview"
      ? "Review changes"
      : mode === "create"
        ? "Create Dividend Claim Rule"
        : `Edit ${original?.id} — ${original?.country} / ${original?.assetType}`;

  return (
    <Modal
      title={title}
      onClose={onClose}
      wide
      footer={
        step === "form" ? (
          <>
            {!canPreview && showErrors && (
              <span className="dca-red-text mr-auto text-[11px]">
                {duplicate ? "Resolve the duplicate scope first." : `Missing: ${missing.join(", ")}`}
              </span>
            )}
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn
              kind="primary"
              onClick={() => {
                if (!canPreview) {
                  setShowErrors(true);
                  return;
                }
                setStep("preview");
              }}
            >
              Continue to Diff Preview {Icons.chevronRight()}
            </Btn>
          </>
        ) : (
          <>
            <Btn onClick={() => setStep("form")}>{Icons.chevronLeft()} Back to form</Btn>
            <Btn kind="primary" onClick={submit}>
              Confirm &amp; Submit for approval
            </Btn>
          </>
        )
      }
    >
      {step === "preview" ? (
        <div className="space-y-4">
          <p className="dca-muted text-[12px]">
            {mode === "create"
              ? "This will create a request for a new production rule. Nothing changes until an approver signs off."
              : `Changes below will be applied to ${original?.id} only after approval.`}
          </p>
          <DiffView changes={changes} createMode={mode === "create"} />
          <div className="dca-panel p-3">
            <p className="dca-muted mb-1 text-[11px] font-semibold uppercase tracking-wide">Reason for change</p>
            <p className="text-[13px]">{reason}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {duplicate && (
            <div className="dca-warn flex items-start gap-2 px-3 py-2.5 text-[12px]">
              <span className="flex-1">
                An active rule for <strong>{v.country} / {v.assetType} / {v.entity}</strong> already exists (
                {duplicate.id}) — edit it instead?
              </span>
              <Btn
                small
                onClick={() => {
                  onClose();
                  navigate({ screen: "rules", openId: duplicate.id });
                }}
              >
                Open {duplicate.id}
              </Btn>
            </div>
          )}

          <section>
            <h3 className="dca-form-section">Scope</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Country" required locked={mode === "edit"}>
                <CountryPicker
                  value={v.country}
                  disabled={mode === "edit"}
                  onSelect={(name, code) => {
                    set("country", name);
                    set("countryCode", code);
                  }}
                />
              </Field>
              <Field label="Country Code" locked={mode === "edit"}>
                <input className="dca-input h-8 w-full" value={v.countryCode} disabled placeholder="Auto-filled" />
              </Field>
              <Field label="Asset Type" required locked={mode === "edit"}>
                <select
                  className="dca-input h-8 w-full"
                  value={v.assetType}
                  disabled={mode === "edit"}
                  onChange={(e) => set("assetType", e.target.value as AssetType)}
                >
                  {["Equity", "Fixed Income"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Business Entity" required locked={mode === "edit"}>
                <select
                  className="dca-input h-8 w-full"
                  value={v.entity}
                  disabled={mode === "edit"}
                  onChange={(e) => set("entity", e.target.value as BusinessEntity)}
                >
                  {["Prime", "Agency", "ALL"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Active" modified={isModified("active")}>
                <select
                  className="dca-input h-8 w-full"
                  value={v.active ? "Active" : "Inactive"}
                  onChange={(e) => set("active", e.target.value === "Active")}
                >
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </Field>
              <Field label="Effective Date" required modified={isModified("effectiveDate")}>
                <input
                  type="date"
                  className="dca-input h-8 w-full"
                  value={v.effectiveDate}
                  onChange={(e) => set("effectiveDate", e.target.value)}
                />
              </Field>
            </div>
          </section>

          <section>
            <h3 className="dca-form-section">Calculation</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Key Date Type" modified={isModified("keyDateType")}>
                <select
                  className="dca-input h-8 w-full"
                  value={v.keyDateType}
                  onChange={(e) => set("keyDateType", e.target.value as KeyDateType)}
                >
                  {["Record Date", "Ex Date"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Position Entitlement Basis" modified={isModified("basis")}>
                <select
                  className="dca-input h-8 w-full"
                  value={v.basis}
                  onChange={(e) => set("basis", e.target.value as Basis)}
                >
                  {["Settle", "Trade", "Trade + Settle", "Contractual Settlement"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Claim Entitlement Period" required modified={isModified("entitlementPeriod")}>
                <OffsetBuilder value={v.entitlementPeriod} onChange={(x) => set("entitlementPeriod", x)} />
              </Field>
              <Field label="Claim Generation Date" required modified={isModified("generationDate")}>
                <OffsetBuilder value={v.generationDate} onChange={(x) => set("generationDate", x)} />
              </Field>
              <Field label="Claim Transmission" modified={isModified("transmission")}>
                <select
                  className="dca-input h-8 w-full"
                  value={v.transmission}
                  onChange={(e) => set("transmission", e.target.value as Transmission)}
                >
                  {["PD", "PD-1", "PD-2"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <div />
              <Field label="Settlement Date Condition" modified={isModified("sdCondition")}>
                <ConditionBuilder left="SD" value={v.sdCondition} onChange={(x) => set("sdCondition", x)} />
              </Field>
              <Field label="Trade Date Condition" modified={isModified("tdCondition")}>
                <ConditionBuilder left="TD" value={v.tdCondition} onChange={(x) => set("tdCondition", x)} />
              </Field>
            </div>
          </section>

          <section>
            <h3 className="dca-form-section">Reason</h3>
            <Field label="Reason for change" required>
              <textarea
                className="dca-input min-h-16 w-full py-1.5"
                placeholder="Why is this change needed? Shown to the approver."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </section>

          {mode === "edit" && changes.length === 0 && (
            <p className="dca-faint text-[12px]">No fields changed yet — modify a calculation field to continue.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ---------- thin generic form for Trade Action Rules & Tax Markers ---------- */

export interface SimpleField {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
  locked?: boolean;
}

export function SimpleEditForm({
  title,
  requestType,
  entity,
  targetId,
  fields,
  original,
  onClose,
}: {
  title: string;
  requestType: "Trade Action Rule" | "Tax Marker";
  entity: "ta" | "tm";
  targetId: string;
  fields: SimpleField[];
  original: Record<string, string | number | boolean>;
  onClose: () => void;
}) {
  const { submitRequest } = useDca();
  const [v, setV] = useState<Record<string, string | number | boolean>>({ ...original });
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"form" | "preview">("form");

  const changes: FieldChange[] = fields
    .filter((f) => v[f.key] !== original[f.key])
    .map((f) => ({ field: f.label, before: asStr(original[f.key] as string | boolean), after: asStr(v[f.key] as string | boolean) }));

  const changedValues: Record<string, string | number | boolean> = {};
  fields.forEach((f) => {
    if (v[f.key] !== original[f.key]) changedValues[f.key] = v[f.key];
  });

  const canSubmit = changes.length > 0 && reason.trim().length > 0;

  return (
    <Modal
      title={step === "preview" ? "Review changes" : title}
      onClose={onClose}
      footer={
        step === "form" ? (
          <>
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn kind="primary" disabled={!canSubmit} onClick={() => setStep("preview")}>
              Continue to Diff Preview {Icons.chevronRight()}
            </Btn>
          </>
        ) : (
          <>
            <Btn onClick={() => setStep("form")}>{Icons.chevronLeft()} Back</Btn>
            <Btn
              kind="primary"
              onClick={() => {
                submitRequest({
                  type: requestType,
                  targetId,
                  targetLabel: targetId,
                  entity,
                  values: changedValues,
                  changes,
                  reason: reason.trim(),
                });
                onClose();
              }}
            >
              Confirm &amp; Submit for approval
            </Btn>
          </>
        )
      }
    >
      {step === "preview" ? (
        <div className="space-y-4">
          <DiffView changes={changes} />
          <div className="dca-panel p-3">
            <p className="dca-muted mb-1 text-[11px] font-semibold uppercase tracking-wide">Reason for change</p>
            <p className="text-[13px]">{reason}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {fields.map((f) => (
              <Field key={f.key} label={f.label} locked={f.locked} modified={v[f.key] !== original[f.key]}>
                {f.type === "select" ? (
                  <select
                    className="dca-input h-8 w-full"
                    value={String(v[f.key])}
                    disabled={f.locked}
                    onChange={(e) => setV((s) => ({ ...s, [f.key]: e.target.value }))}
                  >
                    {f.options?.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type}
                    className="dca-input h-8 w-full"
                    value={String(v[f.key])}
                    disabled={f.locked}
                    onChange={(e) =>
                      setV((s) => ({ ...s, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))
                    }
                  />
                )}
              </Field>
            ))}
          </div>
          <Field label="Reason for change" required>
            <textarea
              className="dca-input min-h-16 w-full py-1.5"
              placeholder="Why is this change needed?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>
      )}
    </Modal>
  );
}
