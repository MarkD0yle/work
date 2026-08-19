import { useState } from "react";
import {
  GhostButton,
  KeyValueRows,
  MetaGrid,
  PanelBody,
  PanelFooter,
  PanelFrame,
  PanelHeader,
  PanelSection,
  Pill,
  PrimaryButton,
} from "./PanelKit";

/* 7 · Timeline — trade lifecycle.
 *
 * A vertical stepper reads as chronology in a way a table of the same rows
 * never does: the eye gets sequence, duration and the break point for free.
 * The failed step is expanded in place with the mismatch and its remedy
 * attached, so diagnosis and repair happen in one column instead of sending
 * the operator to a second screen and back.
 *
 * Steps after the failure are drawn but greyed rather than hidden — knowing
 * what is blocked downstream is half of knowing how urgent this is.
 */

type StepState = "done" | "failed" | "blocked";

type Step = {
  id: string;
  label: string;
  at: string;
  state: StepState;
  detail: string;
};

const STEPS: Step[] = [
  {
    id: "executed",
    label: "Executed",
    at: "14 Aug · 15:42:07",
    state: "done",
    detail: "Filled on Tradeweb · 3 fills averaged",
  },
  {
    id: "captured",
    label: "Booked",
    at: "14 Aug · 15:42:11",
    state: "done",
    detail: "Booked to RATES-EUR by auto-capture",
  },
  {
    id: "allocated",
    label: "Allocated",
    at: "14 Aug · 16:05:33",
    state: "done",
    detail: "Split across 2 funds · pro-rata",
  },
  {
    id: "confirmed",
    label: "Confirmed",
    at: "14 Aug · 16:31:02",
    state: "done",
    detail: "Affirmed via CTM",
  },
  {
    id: "matched",
    label: "Matched",
    at: "15 Aug · 08:14:56",
    state: "failed",
    detail: "Settlement instruction mismatch at the depository",
  },
  {
    id: "settled",
    label: "Settled",
    at: "Due 15 Aug",
    state: "blocked",
    detail: "Blocked — will fail T+1 unless matched by 15:00",
  },
];

const MISMATCH = [
  { field: "Place of settlement", ours: "EOCLBEBB", theirs: "DAKVDEFF" },
  { field: "Safekeeping account", ours: "97431", theirs: "97431" },
  { field: "Settlement amount", ours: "12,406,882.14", theirs: "12,406,882.14" },
];

export function TradeLifecyclePanel({ onClose }: { onClose?: () => void }) {
  const [repaired, setRepaired] = useState(false);

  return (
    <PanelFrame accent={repaired ? "positive" : "negative"} label="Trade lifecycle">
      <PanelHeader
        eyebrow="Settlement exception"
        title="TRD-88412"
        subtitle="Nordea Bank Abp · EUR 12.4m · Bund 2.60% 34"
        tone={repaired ? "positive" : "negative"}
        onClose={onClose}
        badge={
          repaired ? (
            <Pill tone="positive">Resubmitted</Pill>
          ) : (
            <Pill tone="negative">Failing</Pill>
          )
        }
      />

      <PanelBody>
        <MetaGrid
          items={[
            { label: "Value date", value: "15 Aug 26" },
            { label: "Time to cutoff", value: "2h 14m", tone: "warn" },
          ]}
        />

        <PanelSection title="Lifecycle" trailing="6 steps">
          <ol className="relative">
            {STEPS.map((s, i) => {
              const last = i === STEPS.length - 1;
              const isFailed = s.state === "failed" && !repaired;
              const dot =
                s.state === "done" || (s.state === "failed" && repaired)
                  ? "bg-emerald-500"
                  : s.state === "failed"
                    ? "bg-rose-500"
                    : "bg-neutral-300";
              return (
                <li key={s.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {!last && (
                    <span
                      aria-hidden
                      className="absolute top-3 bottom-0 left-[5px] w-px bg-neutral-200"
                    />
                  )}
                  <span
                    aria-hidden
                    className={`relative mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${dot}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`text-xs font-medium ${
                          s.state === "blocked" && !repaired
                            ? "text-neutral-400"
                            : "text-neutral-900"
                        }`}
                      >
                        {s.label}
                      </span>
                      <span className="shrink-0 text-[10px] text-neutral-400 tabular-nums">
                        {s.at}
                      </span>
                    </div>
                    <p
                      className={`text-[11px] ${
                        isFailed ? "text-rose-600" : "text-neutral-500"
                      }`}
                    >
                      {repaired && s.state === "failed"
                        ? "Instruction corrected · awaiting re-match"
                        : s.detail}
                    </p>

                    {/* The break, opened where it happened. */}
                    {isFailed && (
                      <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2.5">
                        <div className="text-[10px] font-semibold tracking-widest text-rose-700 uppercase">
                          Mismatched fields
                        </div>
                        <table className="mt-1.5 w-full text-[11px] tabular-nums">
                          <thead>
                            <tr className="text-left text-[10px] text-rose-600/80">
                              <th className="font-medium">Field</th>
                              <th className="font-medium">Ours</th>
                              <th className="font-medium">Theirs</th>
                            </tr>
                          </thead>
                          <tbody>
                            {MISMATCH.map((m) => {
                              const differs = m.ours !== m.theirs;
                              return (
                                <tr
                                  key={m.field}
                                  className={differs ? "font-medium" : "text-neutral-500"}
                                >
                                  <td className="py-0.5 pr-2 whitespace-nowrap">
                                    {m.field}
                                  </td>
                                  <td
                                    className={`py-0.5 pr-2 ${differs ? "text-rose-700" : ""}`}
                                  >
                                    {m.ours}
                                  </td>
                                  <td className={differs ? "text-rose-700" : ""}>
                                    {m.theirs}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </PanelSection>

        <PanelSection title="Trade" last>
          <KeyValueRows
            rows={[
              { label: "Direction", value: "Buy" },
              { label: "Nominal", value: "EUR 12,500,000" },
              { label: "Price", value: "99.255" },
              { label: "Accrued", value: "EUR 25,182.14" },
              { label: "Trader", value: "M. Okafor", mono: false },
              { label: "Ops owner", value: "P. Raman", mono: false },
            ]}
          />
        </PanelSection>
      </PanelBody>

      <PanelFooter
        note={
          repaired
            ? "Corrected instruction sent 13:02 · re-match expected within 20 min"
            : "Repairing sends a corrected SWIFT MT541 and re-triggers matching."
        }
      >
        <PrimaryButton onClick={() => setRepaired(true)} disabled={repaired}>
          {repaired ? "Repair sent" : "Repair instruction"}
        </PrimaryButton>
        <GhostButton>Chase counterparty</GhostButton>
      </PanelFooter>
    </PanelFrame>
  );
}
