import { useState } from "react";
import {
  GhostButton,
  KeyValueRows,
  MeterBar,
  MetaGrid,
  PanelBody,
  PanelFooter,
  PanelFrame,
  PanelHeader,
  PanelSection,
  PanelTabs,
  Pill,
  PrimaryButton,
} from "./PanelKit";
import { type Tone } from "./panel-tokens";

/* 3 · Tabbed — counterparty 360.
 *
 * Four unrelated bodies of content about one subject. Tabs win over a long
 * scroll here because nobody reads a counterparty top-to-bottom: credit wants
 * exposure, legal wants documents, sales wants contacts, and each arrives
 * knowing which. The identity block stays in the header so it survives every
 * switch, tab counts advertise what is inside before you pay the click, and
 * the footer action is the one thing that is true from any tab.
 *
 * The trade-off is real — tabs hide state, so the two facts that must not be
 * missed (utilisation, watchlist status) are lifted out of the tabs entirely
 * into the header and the always-visible meta grid.
 */

type Tab = "overview" | "exposure" | "documents" | "contacts";

const EXPOSURES: { product: string; used: number; limit: number; unit: string }[] =
  [
    { product: "FX forwards", used: 186, limit: 250, unit: "m" },
    { product: "Repo / GMRA", used: 214, limit: 225, unit: "m" },
    { product: "Rates swaps", used: 92, limit: 200, unit: "m" },
    { product: "Equity swaps", used: 40, limit: 120, unit: "m" },
  ];

const DOCUMENTS: {
  name: string;
  ref: string;
  status: "Executed" | "In negotiation" | "Expiring";
  date: string;
}[] = [
  { name: "ISDA Master Agreement", ref: "2002 form", status: "Executed", date: "11 Mar 2019" },
  { name: "Credit Support Annex", ref: "VM · EUR", status: "Executed", date: "11 Mar 2019" },
  { name: "GMRA", ref: "2011 form", status: "Expiring", date: "30 Sep 2026" },
  { name: "Give-up agreement", ref: "Tri-party", status: "In negotiation", date: "—" },
];

const DOC_TONE: Record<(typeof DOCUMENTS)[number]["status"], Tone> = {
  Executed: "positive",
  Expiring: "warn",
  "In negotiation": "info",
};

const CONTACTS = [
  { name: "Annika Virtanen", role: "Relationship manager", desk: "Helsinki", initials: "AV" },
  { name: "Tomas Lindqvist", role: "Credit officer", desk: "Stockholm", initials: "TL" },
  { name: "Priya Raman", role: "Collateral ops", desk: "London", initials: "PR" },
];

export function Counterparty360Panel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <PanelFrame label="Counterparty detail">
      <PanelHeader
        eyebrow="Counterparty"
        title="Nordea Bank Abp"
        subtitle="LEI 529900ODI3047E2LIV03 · Finland · Bank"
        tone="warn"
        onClose={onClose}
        badge={<Pill tone="warn">Watchlist</Pill>}
      >
        <PanelTabs<Tab>
          active={tab}
          onSelect={setTab}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "exposure", label: "Exposure" },
            { id: "documents", label: "Docs", count: DOCUMENTS.length },
            { id: "contacts", label: "Contacts", count: CONTACTS.length },
          ]}
        />
      </PanelHeader>

      <PanelBody>
        {/* Lifted out of the tabs: the two facts nobody should have to hunt for. */}
        <MetaGrid
          items={[
            { label: "Current", value: "412.6m" },
            { label: "Utilisation", value: "69%", tone: "warn" },
          ]}
        />

        {tab === "overview" && (
          <>
            <PanelSection title="Standing">
              <KeyValueRows
                rows={[
                  { label: "Internal rating", value: "AA- (3)" },
                  { label: "Rating date", value: "04 Jun 2026" },
                  { label: "Onboarded", value: "11 Mar 2019" },
                  { label: "Netting opinion", value: "Enforceable" },
                  { label: "Sector", value: "Financials · Banks" },
                  { label: "Domicile", value: "Finland (EU)" },
                ]}
              />
            </PanelSection>
            <PanelSection title="Why watchlisted" last>
              <p className="text-xs leading-relaxed text-neutral-600">
                Repo utilisation has sat above 90% for eleven consecutive
                sessions. Credit has requested a limit review; no restriction on
                new business in the meantime.
              </p>
              <div className="mt-2 flex gap-1.5">
                <Pill tone="warn">Since 04 Aug</Pill>
                <Pill tone="neutral">Owner: T. Lindqvist</Pill>
              </div>
            </PanelSection>
          </>
        )}

        {tab === "exposure" && (
          <PanelSection title="By product" trailing="EUR · EOD 16 Aug" last>
            <ul className="space-y-3">
              {EXPOSURES.map((e) => {
                const pct = (e.used / e.limit) * 100;
                const tone: Tone =
                  pct >= 90 ? "negative" : pct >= 75 ? "warn" : "info";
                return (
                  <li key={e.product}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-medium text-neutral-900">
                        {e.product}
                      </span>
                      <span className="text-[11px] text-neutral-500 tabular-nums">
                        {e.used}
                        {e.unit} / {e.limit}
                        {e.unit}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <MeterBar value={pct} tone={tone} marker={90} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-neutral-500">
              Marker at 90% — the escalation threshold, not the limit.
            </p>
          </PanelSection>
        )}

        {tab === "documents" && (
          <PanelSection title="Agreements" last>
            <ul className="divide-y divide-neutral-100">
              {DOCUMENTS.map((d) => (
                <li key={d.name} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-neutral-900">
                      {d.name}
                    </span>
                    <span className="block text-[11px] text-neutral-500">
                      {d.ref} · {d.date}
                    </span>
                  </span>
                  <Pill tone={DOC_TONE[d.status]}>{d.status}</Pill>
                </li>
              ))}
            </ul>
          </PanelSection>
        )}

        {tab === "contacts" && (
          <PanelSection title="Coverage" last>
            <ul className="space-y-2">
              {CONTACTS.map((c) => (
                <li key={c.name} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-600">
                    {c.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-neutral-900">
                      {c.name}
                    </span>
                    <span className="block text-[11px] text-neutral-500">
                      {c.role} · {c.desk}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100"
                  >
                    Message
                  </button>
                </li>
              ))}
            </ul>
          </PanelSection>
        )}
      </PanelBody>

      <PanelFooter>
        <PrimaryButton>Request limit review</PrimaryButton>
        <GhostButton>Full profile</GhostButton>
      </PanelFooter>
    </PanelFrame>
  );
}
