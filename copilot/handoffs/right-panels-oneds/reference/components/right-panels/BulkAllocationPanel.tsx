import { useMemo, useState } from "react";
import {
  GhostButton,
  MetaGrid,
  PanelBody,
  PanelFooter,
  PanelFrame,
  PanelHeader,
  PanelSection,
  Pill,
  PrimaryButton,
} from "./PanelKit";

/* 8 · Bulk action — allocation of a selection.
 *
 * The subject is a set, not a record, so the panel leads with what the set
 * adds up to. Anything that behaves differently from the rest of the
 * selection is surfaced as an exception before the action, because the danger
 * of a batch is not the ninety rows that are fine — it is the two that are
 * not, silently carried along by the other eighty-eight.
 *
 * Every member stays individually removable, and the destructive action
 * confirms inline rather than in a modal: the selection is the context, and
 * throwing it behind an overlay is how people confirm the wrong thing.
 */

type Fill = {
  id: string;
  account: string;
  qty: number;
  px: number;
  flag?: string;
};

const INITIAL: Fill[] = [
  { id: "F-1041", account: "GRWTH-EU", qty: 42000, px: 84.12 },
  { id: "F-1042", account: "PENS-UK-A", qty: 18500, px: 84.14 },
  { id: "F-1043", account: "INS-NL-2", qty: 9250, px: 84.11, flag: "Below min piece" },
  { id: "F-1044", account: "SOV-ME-1", qty: 60000, px: 84.19, flag: "Restricted list" },
  { id: "F-1045", account: "GRWTH-EU", qty: 31800, px: 84.16 },
  { id: "F-1046", account: "PENS-UK-B", qty: 24400, px: 84.13 },
];

export function BulkAllocationPanel({ onClose }: { onClose?: () => void }) {
  const [fills, setFills] = useState<Fill[]>(INITIAL);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  const { qty, notional, vwap, exceptions } = useMemo(() => {
    const q = fills.reduce((s, f) => s + f.qty, 0);
    const n = fills.reduce((s, f) => s + f.qty * f.px, 0);
    return {
      qty: q,
      notional: n,
      vwap: q ? n / q : 0,
      exceptions: fills.filter((f) => f.flag),
    };
  }, [fills]);

  return (
    <PanelFrame accent="info" label="Bulk allocation">
      <PanelHeader
        eyebrow="Selection"
        title={`${fills.length} fills selected`}
        subtitle="Program 4417 · Bund 2.60% 34 · 16 Aug"
        onClose={onClose}
        badge={<Pill tone="info">Batch</Pill>}
      />

      <PanelBody>
        <MetaGrid
          cols={3}
          items={[
            { label: "Quantity", value: qty.toLocaleString() },
            { label: "VWAP", value: vwap.toFixed(3) },
            {
              label: "Notional",
              value: `${(notional / 1_000_000).toFixed(2)}m`,
            },
          ]}
        />

        {/* Exceptions first — the whole risk of a batch lives here. */}
        {exceptions.length > 0 && (
          <PanelSection title="Needs attention" trailing={`${exceptions.length} of ${fills.length}`}>
            <ul className="space-y-1.5">
              {exceptions.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-neutral-900">
                      {f.account}
                    </span>
                    <span className="block text-[11px] text-amber-700">
                      {f.flag}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFills((prev) => prev.filter((x) => x.id !== f.id))
                    }
                    className="shrink-0 rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-100"
                  >
                    Exclude
                  </button>
                </li>
              ))}
            </ul>
          </PanelSection>
        )}

        <PanelSection title="Allocation method">
          <div className="space-y-1.5">
            {[
              { id: "pro-rata", label: "Pro-rata by order size", hint: "Default" },
              { id: "avg-px", label: "Average price across accounts", hint: "" },
              { id: "manual", label: "Manual override", hint: "Requires sign-off" },
            ].map((m, i) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md border border-neutral-200 px-2.5 py-2 hover:bg-neutral-50 has-checked:border-neutral-900"
              >
                <input
                  type="radio"
                  name="alloc-method"
                  defaultChecked={i === 0}
                  className="h-3.5 w-3.5 accent-neutral-900"
                />
                <span className="min-w-0 flex-1 text-xs text-neutral-900">
                  {m.label}
                </span>
                {m.hint && (
                  <span className="shrink-0 text-[10px] text-neutral-400">
                    {m.hint}
                  </span>
                )}
              </label>
            ))}
          </div>
        </PanelSection>

        <PanelSection title="In this batch" trailing={`${fills.length} fills`} last>
          <ul className="divide-y divide-neutral-100">
            {fills.map((f) => (
              <li key={f.id} className="group flex items-center gap-2 py-1.5">
                <span className="w-16 shrink-0 font-mono text-[11px] text-neutral-400">
                  {f.id}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-neutral-900">
                  {f.account}
                </span>
                <span className="shrink-0 text-[11px] text-neutral-600 tabular-nums">
                  {f.qty.toLocaleString()}
                </span>
                <span className="w-12 shrink-0 text-right text-[11px] text-neutral-500 tabular-nums">
                  {f.px.toFixed(2)}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${f.id}`}
                  onClick={() =>
                    setFills((prev) => prev.filter((x) => x.id !== f.id))
                  }
                  className="shrink-0 rounded p-0.5 text-neutral-300 opacity-0 transition group-hover:opacity-100 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path
                      fillRule="evenodd"
                      d="M4.28 4.28a.75.75 0 0 1 1.06 0L10 8.94l4.66-4.66a.75.75 0 1 1 1.06 1.06L11.06 10l4.66 4.66a.75.75 0 1 1-1.06 1.06L10 11.06l-4.66 4.66a.75.75 0 1 1-1.06-1.06L8.94 10 4.28 5.34a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </PanelSection>
      </PanelBody>

      <PanelFooter
        note={
          done ? (
            <span className="font-medium text-emerald-700">
              {fills.length} fills allocated · confirmations queued
            </span>
          ) : confirming ? (
            <span className="font-medium text-neutral-900">
              Allocate {fills.length} fills across{" "}
              {new Set(fills.map((f) => f.account)).size} accounts? This cannot
              be undone after confirmations go out.
            </span>
          ) : (
            `${new Set(fills.map((f) => f.account)).size} accounts · ${exceptions.length} flagged`
          )
        }
      >
        {confirming && !done ? (
          <>
            <PrimaryButton
              onClick={() => {
                setDone(true);
                setConfirming(false);
              }}
            >
              Yes, allocate
            </PrimaryButton>
            <GhostButton onClick={() => setConfirming(false)}>Back</GhostButton>
          </>
        ) : (
          <>
            <PrimaryButton
              onClick={() => setConfirming(true)}
              disabled={fills.length === 0 || done}
            >
              {done ? "Allocated" : `Allocate ${fills.length}`}
            </PrimaryButton>
            <GhostButton onClick={() => setFills(INITIAL)}>Reset</GhostButton>
          </>
        )}
      </PanelFooter>
    </PanelFrame>
  );
}
