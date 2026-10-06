import { useCallback, useState } from "react";
import Modal from "../patterns/Modal";
import {
  AccordionItem,
  Chip,
  DistributionBar,
  EmptyEntries,
  FieldBlock,
  FormFooter,
  InlineEntry,
  PlusIcon,
  RadioPills,
} from "./kit";
import {
  ASSET_GROUPS,
  ASSET_TYPES,
  HAIRCUT_OPTIONS,
  standardSchedule,
  type Haircut,
} from "./data";
import { TONE, btnDashed, btnPrimary, btnSecondary, inputClass, todayIso } from "./styles";

/* Example C — Credit Support Annex › Eligible collateral.
 *
 * Step 3 of a CSA set-up form holds the eligibility schedules, one per
 * direction (what we post, what the counterparty posts). Each is authored in
 * a matrix modal: 56 asset types as rows, haircut buckets as radio columns,
 * plus a concentration limit input that unlocks once a row is eligible.
 * Column headers fill every row in one click; group headers fold the table.
 * Saved schedules appear inline with a haircut distribution and, expanded,
 * a compact per-group read-out. */

type Direction = "we-post" | "they-post";

const DIRECTION_LABEL: Record<Direction, string> = {
  "we-post": "Posted by us",
  "they-post": "Posted by counterparty",
};

type Schedule = {
  direction: Direction;
  asOf: string;
  haircuts: Record<string, Haircut>;
  limits: Record<string, string>;
  wrongWay: boolean;
};

type SectionId = "agreement" | "thresholds" | "collateral" | "valuation";

export default function CollateralScheduleExample() {
  const [open, setOpen] = useState<Set<SectionId>>(new Set(["collateral"]));
  const [agreement, setAgreement] = useState({
    counterparty: "Nordhavn Bank AB",
    type: "2016 VM CSA (NY law)",
    signed: "2026-08-14",
  });
  const [thr, setThr] = useState({ threshold: "0", mta: "500,000", rounding: "10,000", ia: "" });
  const [schedules, setSchedules] = useState<Schedule[]>([
    {
      direction: "they-post",
      asOf: "2026-08-14",
      haircuts: standardSchedule(),
      limits: { "B2-0": "20", "B2-1": "20", "EQ-0": "10", "EQ-1": "10", "EQ-2": "10", "EQ-3": "10" },
      wrongWay: true,
    },
  ]);
  const [valuation, setValuation] = useState<{ agent: string; window: string }>({
    agent: "",
    window: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [draft, setDraft] = useState<{ schedule: Schedule; isNew: boolean } | null>(null);
  const closeModal = useCallback(() => setDraft(null), []);

  const missing = (["we-post", "they-post"] as Direction[]).filter(
    (d) => !schedules.some((s) => s.direction === d),
  );

  const agreementDone = agreement.counterparty.trim() !== "" && agreement.signed !== "";
  const thrDone = thr.threshold !== "" && thr.mta !== "";
  const collDone = missing.length === 0;
  const requiredDone = [agreementDone, thrDone, collDone].filter(Boolean).length;

  function toggle(id: SectionId) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save(s: Schedule) {
    setSchedules((prev) => [...prev.filter((p) => p.direction !== s.direction), s]);
    setDraft(null);
  }

  return (
    <div>
      <div className="space-y-2">
        <AccordionItem
          index={1}
          title="Agreement"
          summary={`${agreement.counterparty} · ${agreement.type}`}
          status={agreementDone ? "complete" : "incomplete"}
          open={open.has("agreement")}
          onToggle={() => toggle("agreement")}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldBlock label="Counterparty" htmlFor="c-cp" required>
              <input
                id="c-cp"
                className={inputClass}
                value={agreement.counterparty}
                onChange={(e) => setAgreement({ ...agreement, counterparty: e.target.value })}
              />
            </FieldBlock>
            <FieldBlock label="Agreement type" htmlFor="c-type">
              <select
                id="c-type"
                className={inputClass}
                value={agreement.type}
                onChange={(e) => setAgreement({ ...agreement, type: e.target.value })}
              >
                <option>2016 VM CSA (NY law)</option>
                <option>2016 VM CSB (English law)</option>
                <option>2018 IM CSD</option>
                <option>GMRA 2011</option>
              </select>
            </FieldBlock>
            <FieldBlock label="Signed" htmlFor="c-signed" required>
              <input
                id="c-signed"
                type="date"
                className={inputClass}
                value={agreement.signed}
                onChange={(e) => setAgreement({ ...agreement, signed: e.target.value })}
              />
            </FieldBlock>
          </div>
        </AccordionItem>

        <AccordionItem
          index={2}
          title="Threshold & transfer amounts"
          summary={`Threshold ${thr.threshold || "—"} · MTA ${thr.mta || "—"} · rounding ${thr.rounding || "—"}`}
          status={thrDone ? "complete" : "incomplete"}
          open={open.has("thresholds")}
          onToggle={() => toggle("thresholds")}
        >
          <div className="grid gap-4 sm:grid-cols-4">
            {(
              [
                ["threshold", "Threshold", true],
                ["mta", "Min. transfer amount", true],
                ["rounding", "Rounding", false],
                ["ia", "Independent amount", false],
              ] as const
            ).map(([k, label, req]) => (
              <FieldBlock key={k} label={label} htmlFor={`c-${k}`} required={req}>
                <input
                  id={`c-${k}`}
                  inputMode="numeric"
                  className={`${inputClass} tabular-nums`}
                  value={thr[k]}
                  onChange={(e) => setThr({ ...thr, [k]: e.target.value })}
                />
              </FieldBlock>
            ))}
          </div>
        </AccordionItem>

        <AccordionItem
          index={3}
          title="Eligible collateral"
          summary={
            collDone
              ? "Both directions scheduled"
              : `${schedules.length}/2 schedules · missing ${missing.map((d) => DIRECTION_LABEL[d].toLowerCase()).join(", ")}`
          }
          status={collDone ? "complete" : "incomplete"}
          open={open.has("collateral")}
          onToggle={() => toggle("collateral")}
        >
          <p className="mb-3 text-xs text-neutral-500">
            One schedule per direction. Each rates {ASSET_TYPES.length} asset types by haircut.
          </p>
          <div className="space-y-2">
            {schedules.length === 0 && <EmptyEntries>No schedules yet.</EmptyEntries>}
            {schedules.map((s) => (
              <ScheduleEntry
                key={s.direction}
                s={s}
                onEdit={() => setDraft({ schedule: structuredClone(s), isNew: false })}
                onRemove={() => setSchedules((prev) => prev.filter((p) => p.direction !== s.direction))}
              />
            ))}
            {missing.map((dir) => (
              <button
                key={dir}
                type="button"
                className={btnDashed}
                onClick={() =>
                  setDraft({
                    isNew: true,
                    schedule: {
                      direction: dir,
                      asOf: todayIso(),
                      haircuts: {},
                      limits: {},
                      wrongWay: false,
                    },
                  })
                }
              >
                <PlusIcon /> Add schedule · {DIRECTION_LABEL[dir]}
              </button>
            ))}
          </div>
        </AccordionItem>

        <AccordionItem
          index={4}
          title="Valuation & disputes"
          summary={valuation.agent ? `Valuation agent: ${valuation.agent}` : "Defaults to the CSA terms"}
          status={valuation.agent ? "complete" : "optional"}
          open={open.has("valuation")}
          onToggle={() => toggle("valuation")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock label="Valuation agent">
              <RadioPills
                name="c-agent"
                label="Valuation agent"
                value={valuation.agent || undefined}
                onChange={(v) => setValuation({ ...valuation, agent: v })}
                options={[
                  { value: "Us", label: "Us" },
                  { value: "Counterparty", label: "Counterparty" },
                  { value: "Calling party", label: "Calling party" },
                ]}
              />
            </FieldBlock>
            <FieldBlock label="Dispute window (business days)" htmlFor="c-win">
              <input
                id="c-win"
                inputMode="numeric"
                className={`${inputClass} w-32`}
                value={valuation.window}
                onChange={(e) => setValuation({ ...valuation, window: e.target.value })}
              />
            </FieldBlock>
          </div>
        </AccordionItem>
      </div>

      <FormFooter
        done={requiredDone}
        total={3}
        onSubmit={() => setSubmitted(true)}
        submitLabel="Send for legal review"
        submitted={submitted}
      />

      {draft && (
        <ScheduleModal
          key={draft.schedule.direction}
          initial={draft.schedule}
          isNew={draft.isNew}
          other={schedules.find((s) => s.direction !== draft.schedule.direction)}
          onClose={closeModal}
          onSave={save}
        />
      )}
    </div>
  );
}

function summarise(s: Schedule) {
  const counts: Record<Haircut, number> = { inel: 0, "0": 0, "2": 0, "5": 0, "10": 0, "15": 0 };
  let sum = 0;
  let eligible = 0;
  for (const a of ASSET_TYPES) {
    const h = s.haircuts[a.id];
    if (!h) continue;
    counts[h]++;
    if (h !== "inel") {
      eligible++;
      sum += Number(h);
    }
  }
  const limits = Object.entries(s.limits).filter(
    ([id, v]) => v && s.haircuts[id] && s.haircuts[id] !== "inel",
  ).length;
  return { counts, eligible, avg: eligible ? sum / eligible : 0, limits };
}

function ScheduleEntry({
  s,
  onEdit,
  onRemove,
}: {
  s: Schedule;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const sum = summarise(s);
  return (
    <InlineEntry
      title={DIRECTION_LABEL[s.direction]}
      meta={
        <>
          As of {s.asOf}
          {s.wrongWay && " · wrong-way risk exclusion on"}
        </>
      }
      badges={
        <>
          <Chip tone="good">
            {sum.eligible}/{ASSET_TYPES.length} eligible
          </Chip>
          <Chip tone="info">avg {sum.avg.toFixed(1)}% haircut</Chip>
          {sum.limits > 0 && <Chip>{sum.limits} conc. limits</Chip>}
        </>
      }
      onEdit={onEdit}
      onRemove={onRemove}
      details={
        <div className="space-y-3">
          <DistributionBar
            parts={HAIRCUT_OPTIONS.map((o) => ({
              label: o.label,
              count: sum.counts[o.value],
              tone: o.tone,
            }))}
          />
          <table className="w-full text-xs">
            <tbody>
              {ASSET_GROUPS.map((g) => {
                const rows = ASSET_TYPES.filter((a) => a.group === g);
                return (
                  <tr key={g} className="border-t border-neutral-200/70">
                    <th scope="row" className="w-48 py-1.5 pr-3 text-left font-medium text-neutral-700">
                      {g}
                    </th>
                    <td className="py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {rows.map((a) => {
                          const opt = HAIRCUT_OPTIONS.find((o) => o.value === s.haircuts[a.id]);
                          return (
                            <span
                              key={a.id}
                              title={a.name}
                              className={`border px-1.5 py-0.5 text-[10px] tabular-nums ${
                                opt ? TONE[opt.tone] : TONE.muted
                              }`}
                            >
                              {a.name.replace(g, "").trim() || a.name} ·{" "}
                              {opt ? (opt.value === "inel" ? "—" : opt.label) : "?"}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      }
    />
  );
}

function ScheduleModal({
  initial,
  isNew,
  other,
  onClose,
  onSave,
}: {
  initial: Schedule;
  isNew: boolean;
  other?: Schedule;
  onClose: () => void;
  onSave: (s: Schedule) => void;
}) {
  const [d, setD] = useState(initial);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const setCount = ASSET_TYPES.filter((a) => d.haircuts[a.id]).length;
  const complete = setCount === ASSET_TYPES.length;

  function setRow(id: string, h: Haircut) {
    setD((prev) => ({ ...prev, haircuts: { ...prev.haircuts, [id]: h } }));
  }

  function setMany(ids: string[], h: Haircut) {
    setD((prev) => {
      const haircuts = { ...prev.haircuts };
      for (const id of ids) haircuts[id] = h;
      return { ...prev, haircuts };
    });
  }

  function toggleFold(g: string) {
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  }

  const unfoldedIds = ASSET_TYPES.filter((a) => !folded.has(a.group)).map((a) => a.id);

  return (
    <Modal
      open
      onClose={onClose}
      size="2xl"
      title={`${isNew ? "New" : "Edit"} schedule · ${DIRECTION_LABEL[d.direction]}`}
      description="Pick a haircut for every asset type. Click a column header to apply it to all expanded groups."
      footer={
        <>
          <span className="mr-auto text-xs text-neutral-500 tabular-nums">
            {setCount} of {ASSET_TYPES.length} rated
          </span>
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="button" disabled={!complete} onClick={() => onSave(d)} className={btnPrimary}>
            {isNew ? "Add to form" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-end gap-4">
        <FieldBlock label="As of" htmlFor="s-asof">
          <input
            id="s-asof"
            type="date"
            className={inputClass}
            value={d.asOf}
            onChange={(e) => setD({ ...d, asOf: e.target.value })}
          />
        </FieldBlock>
        <label className="flex items-center gap-2 pb-2 text-xs text-neutral-700">
          <input
            type="checkbox"
            checked={d.wrongWay}
            onChange={(e) => setD({ ...d, wrongWay: e.target.checked })}
            className="h-4 w-4 accent-neutral-900"
          />
          Exclude issuers correlated with the poster (wrong-way risk)
        </label>
        <div className="ml-auto flex gap-2 pb-0.5">
          <button
            type="button"
            className={btnSecondary}
            onClick={() => setD({ ...d, haircuts: standardSchedule() })}
          >
            Load standard schedule
          </button>
          {other && (
            <button
              type="button"
              className={btnSecondary}
              onClick={() =>
                setD({ ...d, haircuts: { ...other.haircuts }, limits: { ...other.limits } })
              }
            >
              Mirror {DIRECTION_LABEL[other.direction].toLowerCase()}
            </button>
          )}
        </div>
      </div>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead className="sticky z-20 bg-white" style={{ top: -16 }}>
          <tr className="border-b border-neutral-300">
            <th scope="col" className="py-2 pr-3 text-left text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">
              Asset type
            </th>
            {HAIRCUT_OPTIONS.map((o) => (
              <th key={o.value} scope="col" className="px-1 py-2 text-center">
                <button
                  type="button"
                  onClick={() => setMany(unfoldedIds, o.value)}
                  title={`Set all expanded rows to ${o.label}`}
                  className="w-full px-1 py-0.5 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  {o.label}
                </button>
              </th>
            ))}
            <th scope="col" className="w-24 py-2 pl-2 text-right text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">
              Conc. %
            </th>
          </tr>
        </thead>
        {ASSET_GROUPS.map((g) => {
          const rows = ASSET_TYPES.filter((a) => a.group === g);
          const isFolded = folded.has(g);
          const done = rows.filter((a) => d.haircuts[a.id]).length;
          return (
            <tbody key={g}>
              <tr className="bg-neutral-50">
                <th colSpan={HAIRCUT_OPTIONS.length + 2} scope="rowgroup" className="p-0 text-left">
                  <button
                    type="button"
                    onClick={() => toggleFold(g)}
                    aria-expanded={!isFolded}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-100"
                  >
                    <span className={`inline-block transition-transform ${isFolded ? "" : "rotate-90"}`}>›</span>
                    {g}
                    <span
                      className={`ml-auto font-normal tabular-nums ${
                        done === rows.length ? "text-emerald-600" : "text-neutral-400"
                      }`}
                    >
                      {done}/{rows.length}
                    </span>
                  </button>
                </th>
              </tr>
              {!isFolded &&
                rows.map((a) => {
                  const h = d.haircuts[a.id];
                  const eligible = h !== undefined && h !== "inel";
                  return (
                    <tr
                      key={a.id}
                      className={`border-b border-neutral-100 ${h ? "" : "bg-amber-50/40"}`}
                    >
                      <th scope="row" className="py-1.5 pr-3 pl-6 text-left text-xs font-normal text-neutral-800">
                        {a.name}
                      </th>
                      {HAIRCUT_OPTIONS.map((o) => {
                        const checked = h === o.value;
                        return (
                          <td key={o.value} className="px-1 py-1 text-center">
                            <label
                              className={`flex h-7 cursor-pointer items-center justify-center border transition focus-within:ring-2 focus-within:ring-neutral-900/20 ${
                                checked ? TONE[o.tone] : "border-transparent hover:bg-neutral-100"
                              }`}
                            >
                              <input
                                type="radio"
                                name={`hc-${d.direction}-${a.id}`}
                                value={o.value}
                                checked={checked}
                                onChange={() => setRow(a.id, o.value)}
                                aria-label={`${a.name}: ${o.label}`}
                                className="h-3.5 w-3.5 accent-neutral-900"
                              />
                            </label>
                          </td>
                        );
                      })}
                      <td className="py-1 pl-2 text-right">
                        <input
                          aria-label={`Concentration limit for ${a.name}`}
                          inputMode="decimal"
                          disabled={!eligible}
                          placeholder={eligible ? "—" : ""}
                          value={eligible ? (d.limits[a.id] ?? "") : ""}
                          onChange={(e) =>
                            setD({ ...d, limits: { ...d.limits, [a.id]: e.target.value } })
                          }
                          className={`${inputClass} w-20 py-1 text-right text-xs tabular-nums`}
                        />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          );
        })}
      </table>
    </Modal>
  );
}
