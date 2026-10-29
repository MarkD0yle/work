import { useState } from "react";
import {
  GhostButton,
  MeterBar,
  MetaGrid,
  PanelBody,
  PanelFooter,
  PanelFrame,
  PanelHeader,
  PanelSection,
  Pill,
  PrimaryButton,
} from "./PanelKit";

/* 4 · Triage — limit breach.
 *
 * This panel interrupts, so it is allowed to be loud: a red accent edge, a
 * status dot, and the breach magnitude as the largest number on screen. Where
 * the other panels offer actions as equals, triage ranks them — acknowledge is
 * primary because it is what the next thirty seconds actually require, while
 * escalate and request-increase are demoted to secondary weight.
 *
 * The audit note is required before anything commits. A breach that gets
 * cleared without a reason is a breach nobody can explain at the next risk
 * committee, so the button stays disabled until the box has content.
 */

const CONTRIBUTORS = [
  { book: "EUR Swaps 2-5y", dv01: "+184k", share: 46, moved: "+62k today" },
  { book: "EUR Swaps 5-10y", dv01: "+121k", share: 30, moved: "+9k today" },
  { book: "EUR Basis", dv01: "+63k", share: 16, moved: "-4k today" },
  { book: "Inflation", dv01: "+32k", share: 8, moved: "flat" },
];

const ESCALATION = [
  { role: "Desk head", name: "M. Okafor", state: "Notified 09:12" },
  { role: "Market risk", name: "S. Beaumont", state: "Notified 09:12" },
  { role: "CRO office", name: "—", state: "At 120% or 60 min" },
];

export function LimitBreachPanel({ onClose }: { onClose?: () => void }) {
  const [note, setNote] = useState("");
  const [acked, setAcked] = useState(false);
  const utilisation = 108;

  return (
    <PanelFrame accent="negative" label="Limit breach">
      <PanelHeader
        eyebrow="Hard limit breach"
        title="EUR Rates DV01"
        subtitle="Book RATES-EUR · breached 09:11 CET · 34 min ago"
        tone="negative"
        onClose={onClose}
        badge={<Pill tone="negative">Level 2</Pill>}
      />

      <PanelBody>
        <PanelSection dense>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
                Utilisation
              </div>
              <div className="mt-0.5 text-3xl font-semibold text-rose-600 tabular-nums">
                {utilisation}%
              </div>
            </div>
            <div className="text-right text-[11px] text-neutral-500 tabular-nums">
              <div>Limit 370k</div>
              <div>Current 400k</div>
              <div className="font-medium text-rose-600">Excess 30k</div>
            </div>
          </div>
          <div className="mt-3">
            <MeterBar value={Math.min(utilisation, 100)} tone="negative" marker={92} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-neutral-400">
            <span>0</span>
            <span>Warning 92%</span>
            <span>Limit</span>
          </div>
        </PanelSection>

        <MetaGrid
          items={[
            { label: "Peak today", value: "112%", tone: "negative" },
            { label: "Breaches MTD", value: "3" },
          ]}
        />

        <PanelSection title="What is driving it" trailing="DV01 by book">
          <ul className="space-y-2.5">
            {CONTRIBUTORS.map((c) => (
              <li key={c.book}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium text-neutral-900">
                    {c.book}
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-neutral-900 tabular-nums">
                    {c.dv01}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="flex-1">
                    <MeterBar value={c.share} tone="negative" />
                  </span>
                  <span className="w-20 shrink-0 text-right text-[10px] text-neutral-500">
                    {c.moved}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </PanelSection>

        <PanelSection title="Escalation path">
          <ol className="space-y-2">
            {ESCALATION.map((e, i) => {
              const pending = e.name === "—";
              return (
                <li key={e.role} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${
                      pending
                        ? "bg-neutral-100 text-neutral-400"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-neutral-900">
                      {e.role}
                      {!pending && (
                        <span className="font-normal text-neutral-500"> · {e.name}</span>
                      )}
                    </span>
                    <span className="block text-[11px] text-neutral-500">
                      {e.state}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </PanelSection>

        <PanelSection title="Audit note" trailing="required" last>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Why is the book above limit, and what is the plan to bring it back?"
            className="w-full resize-none rounded-md border border-neutral-300 px-2.5 py-2 text-xs text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900"
          />
          <div className="mt-1 flex justify-between text-[10px] text-neutral-400">
            <span>Retained for 7 years</span>
            <span className="tabular-nums">{note.length}/500</span>
          </div>
        </PanelSection>
      </PanelBody>

      <PanelFooter
        note={
          acked ? (
            <span className="font-medium text-emerald-700">
              Acknowledged 09:45 · risk notified
            </span>
          ) : (
            "Acknowledging does not clear the breach — it records that the desk has seen it."
          )
        }
      >
        {/* Ranked, not equal: the primary owns its own row so the two
            secondary routes can't be reached for by accident. */}
        <div className="flex w-full flex-col gap-2">
          <PrimaryButton
            onClick={() => setAcked(true)}
            disabled={note.trim().length === 0 || acked}
          >
            {acked ? "Acknowledged" : "Acknowledge"}
          </PrimaryButton>
          <div className="flex gap-2">
            <GhostButton full>Escalate</GhostButton>
            <GhostButton full>Request increase</GhostButton>
          </div>
        </div>
      </PanelFooter>
    </PanelFrame>
  );
}
