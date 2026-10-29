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
} from "./PanelKit";

/* 2 · Informational — instrument reference.
 *
 * The read-only counterpart to the ticket. There is no primary action at all,
 * and that absence is the design: nothing in this panel should ever be
 * mistaken for a decision. Content is dense key/value rows because the reader
 * is verifying a specific field rather than absorbing a story, identifiers are
 * click-to-copy since they get pasted into other systems all day, and the only
 * buttons are utilities parked in the footer at ghost weight.
 */

const RATINGS = [
  { agency: "Moody's", grade: "A1", outlook: "Stable" },
  { agency: "S&P", grade: "A+", outlook: "Negative" },
  { agency: "Fitch", grade: "A+", outlook: "Stable" },
];

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-32 shrink-0 text-xs text-neutral-500">{label}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="group flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right"
      >
        <span className="truncate font-mono text-xs text-neutral-900 tabular-nums">
          {value}
        </span>
        <span
          className={`text-[10px] font-medium ${
            copied ? "text-emerald-600" : "text-neutral-300 group-hover:text-neutral-500"
          }`}
        >
          {copied ? "copied" : "copy"}
        </span>
      </button>
    </div>
  );
}

export function InstrumentReferencePanel({ onClose }: { onClose?: () => void }) {
  return (
    <PanelFrame label="Instrument reference">
      <PanelHeader
        eyebrow="Security master"
        title="SIEGR 3.25% 02/31"
        subtitle="Siemens AG · Senior unsecured · EUR"
        onClose={onClose}
        badge={<Pill tone="neutral">Read-only</Pill>}
      />

      <PanelBody>
        <MetaGrid
          items={[
            { label: "Mid price", value: "98.42" },
            { label: "Yield", value: "3.41%" },
            { label: "Z-spread", value: "+62bp" },
            { label: "Mod. duration", value: "5.21" },
          ]}
        />

        <PanelSection title="Terms">
          <KeyValueRows
            rows={[
              { label: "Coupon", value: "3.250% annual" },
              { label: "Issue date", value: "15 Feb 2024" },
              { label: "Maturity", value: "15 Feb 2031" },
              { label: "Next coupon", value: "15 Feb 2027" },
              { label: "Day count", value: "ACT/ACT (ICMA)" },
              { label: "Min. piece", value: "100,000 / 1,000" },
              { label: "Amt outstanding", value: "EUR 1.25bn" },
              { label: "Callable", value: "Make-whole + 20bp" },
            ]}
          />
        </PanelSection>

        <PanelSection title="Identifiers">
          <div className="divide-y divide-neutral-100">
            <CopyRow label="ISIN" value="DE000A3MQZK1" />
            <CopyRow label="CUSIP" value="D6T24GAB1" />
            <CopyRow label="FIGI" value="BBG0189QZ4R7" />
            <CopyRow label="Internal ID" value="SEC-4471902" />
          </div>
        </PanelSection>

        <PanelSection title="Ratings" trailing="as of 12 Aug 26">
          <ul className="space-y-1.5">
            {RATINGS.map((r) => (
              <li
                key={r.agency}
                className="flex items-center justify-between rounded-md border border-neutral-200 px-2.5 py-1.5"
              >
                <span className="text-xs text-neutral-600">{r.agency}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-900">
                    {r.grade}
                  </span>
                  <Pill tone={r.outlook === "Negative" ? "warn" : "neutral"}>
                    {r.outlook}
                  </Pill>
                </span>
              </li>
            ))}
          </ul>
        </PanelSection>

        <PanelSection title="Classification" last>
          <div className="flex flex-wrap gap-1.5">
            {[
              "Industrials",
              "Capital goods",
              "Investment grade",
              "EUR IG index",
              "MiFID II eligible",
              "HQLA level 2A",
            ].map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </PanelSection>
      </PanelBody>

      <PanelFooter note="Source: internal security master · synced 06:15 CET">
        <GhostButton full>Open in terminal</GhostButton>
        <GhostButton full>Export</GhostButton>
      </PanelFooter>
    </PanelFrame>
  );
}
