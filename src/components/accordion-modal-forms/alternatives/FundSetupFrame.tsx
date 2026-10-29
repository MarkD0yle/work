import { useState, type CSSProperties, type ReactNode } from "react";
import { AccordionItem, FieldBlock } from "../kit";
import { btnPrimary, btnSecondary, inputClass } from "../styles";
import type { ShareClass } from "./share-class";

/* DialogFrame — the parent "Fund set-up" modal, drawn in-flow rather than as
 * an overlay so the three alternatives can sit side by side on one page.
 * It mimics Modal's chrome (accent bar, header, scrolling body, footer) and
 * adds two slots the real Modal would need for these patterns:
 *   crumbs  a breadcrumb that replaces the title row when a view is pushed
 *   aside   a docked column to the right of the body (ContextPanel lives here) */
export function DialogFrame({
  eyebrow = "Parent dialog · drawn in-flow",
  title,
  description,
  crumbs,
  footer,
  aside,
  bodyStyle,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  crumbs?: { label: string; onClick?: () => void }[];
  footer: ReactNode;
  aside?: ReactNode;
  bodyStyle?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
        <span aria-hidden className="h-px w-6 bg-neutral-300" />
        {eyebrow}
      </div>
      <div className="flex flex-col overflow-hidden border border-neutral-300 bg-white shadow-lg">
        <span aria-hidden className="h-1 w-full shrink-0 bg-neutral-900" />
        <header className="flex items-start gap-3 border-b border-neutral-200 px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            {crumbs && (
              <nav aria-label="Breadcrumb" className="mb-1">
                <ol className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                  {crumbs.map((c, i) => {
                    const last = i === crumbs.length - 1;
                    return (
                      <li key={c.label} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-neutral-300">/</span>}
                        {c.onClick && !last ? (
                          <button
                            type="button"
                            onClick={c.onClick}
                            className="font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
                          >
                            {c.label}
                          </button>
                        ) : (
                          <span aria-current={last ? "page" : undefined} className={last ? "text-neutral-400" : ""}>
                            {c.label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            )}
            <h2 className="text-base font-semibold tracking-tight text-neutral-900">{title}</h2>
            {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            title="Closes the parent dialog (inert in this demo)"
            className="-mr-1 p-1 text-neutral-300 hover:bg-neutral-100 hover:text-neutral-700"
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

        {/* Only a fixed-height body scrolls; an auto-height one stays
            overflow-visible so the Add dropdown isn't clipped. */}
        <div className="flex min-h-0" style={bodyStyle}>
          <div
            className={`min-w-0 flex-1 bg-neutral-50 px-5 py-4 text-sm text-neutral-700 ${
              bodyStyle?.height != null ? "overflow-y-auto" : ""
            }`}
          >
            {children}
          </div>
          {aside && (
            <div className="grid shrink-0" style={{ width: 380 }}>
              {aside}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-white px-5 py-3">{footer}</footer>
      </div>
    </div>
  );
}

/* The parent dialog's own footer — it saves the fund, not a share class. */
export function ParentFooter({ shareClasses, blockers = 0 }: { shareClasses: ShareClass[]; blockers?: number }) {
  const ready = shareClasses.length > 0 && blockers === 0;
  return (
    <>
      <span className="mr-auto text-xs text-neutral-500">
        {blockers > 0
          ? `${blockers} share class${blockers === 1 ? "" : "es"} need${blockers === 1 ? "s" : ""} attention before the fund can be saved.`
          : ready
            ? `${shareClasses.length} share class${shareClasses.length === 1 ? "" : "es"} · ready to save`
            : "Add at least one share class to save the fund."}
      </span>
      <button type="button" className={btnSecondary}>
        Cancel
      </button>
      <button type="button" disabled={!ready} className={btnPrimary}>
        Save fund
      </button>
    </>
  );
}

/* FundAccordion — the list of sections the share-class table sits among.
 * Owns its own open-state and the trivial neighbouring fields so each
 * alternative only has to supply section 2. `hidden` keeps it mounted (and
 * its state intact) while the drill-in alternative shows a pushed view. */
type SectionId = "fund" | "classes" | "providers" | "approvals";

export function FundAccordion({
  shareClasses,
  hidden = false,
  children,
}: {
  shareClasses: ShareClass[];
  hidden?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<Set<SectionId>>(new Set(["classes"]));
  const [fund, setFund] = useState({ name: "Halden Global Credit Fund", domicile: "Ireland", structure: "UCITS" });
  const [providers, setProviders] = useState({ admin: "", custodian: "" });
  const [approved, setApproved] = useState(false);

  function toggle(id: SectionId) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const fundDone = fund.name.trim() !== "";
  const classesDone = shareClasses.length > 0;
  const providersDone = providers.admin !== "" && providers.custodian !== "";

  return (
    <div className={`space-y-2 ${hidden ? "hidden" : ""}`}>
      <AccordionItem
        index={1}
        title="Fund details"
        summary={`${fund.name} · ${fund.structure} · ${fund.domicile}`}
        status={fundDone ? "complete" : "incomplete"}
        open={open.has("fund")}
        onToggle={() => toggle("fund")}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <FieldBlock label="Fund name" htmlFor="fs-name" required className="sm:col-span-3">
            <input id="fs-name" className={inputClass} value={fund.name} onChange={(e) => setFund({ ...fund, name: e.target.value })} />
          </FieldBlock>
          <FieldBlock label="Domicile" htmlFor="fs-dom">
            <select id="fs-dom" className={inputClass} value={fund.domicile} onChange={(e) => setFund({ ...fund, domicile: e.target.value })}>
              <option>Ireland</option>
              <option>Luxembourg</option>
              <option>United Kingdom</option>
            </select>
          </FieldBlock>
          <FieldBlock label="Structure" htmlFor="fs-str">
            <select id="fs-str" className={inputClass} value={fund.structure} onChange={(e) => setFund({ ...fund, structure: e.target.value })}>
              <option>UCITS</option>
              <option>AIF</option>
              <option>OEIC</option>
            </select>
          </FieldBlock>
        </div>
      </AccordionItem>

      <AccordionItem
        index={2}
        title="Share classes"
        summary={
          classesDone
            ? `${shareClasses.length} class${shareClasses.length === 1 ? "" : "es"} · ${shareClasses.map((s) => s.label.replace("Class ", "")).join(", ")}`
            : "Dealing terms for each class offered"
        }
        status={classesDone ? "complete" : "incomplete"}
        open={open.has("classes")}
        onToggle={() => toggle("classes")}
      >
        {children}
      </AccordionItem>

      <AccordionItem
        index={3}
        title="Service providers"
        summary={providersDone ? `${providers.admin} · ${providers.custodian}` : "Administrator and depositary"}
        status={providersDone ? "complete" : "incomplete"}
        open={open.has("providers")}
        onToggle={() => toggle("providers")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldBlock label="Administrator" htmlFor="fs-admin" required>
            <select id="fs-admin" className={inputClass} value={providers.admin} onChange={(e) => setProviders({ ...providers, admin: e.target.value })}>
              <option value="">Select…</option>
              <option>Northern Trust</option>
              <option>State Street</option>
              <option>BNY</option>
            </select>
          </FieldBlock>
          <FieldBlock label="Depositary" htmlFor="fs-cust" required>
            <select id="fs-cust" className={inputClass} value={providers.custodian} onChange={(e) => setProviders({ ...providers, custodian: e.target.value })}>
              <option value="">Select…</option>
              <option>Northern Trust</option>
              <option>State Street</option>
              <option>BNY</option>
            </select>
          </FieldBlock>
        </div>
      </AccordionItem>

      <AccordionItem
        index={4}
        title="Approvals"
        summary={approved ? "Product committee sign-off recorded" : "Product committee sign-off"}
        status={approved ? "complete" : "optional"}
        open={open.has("approvals")}
        onToggle={() => toggle("approvals")}
      >
        <label className="flex items-start gap-3 text-sm text-neutral-700">
          <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} className="mt-0.5 h-4 w-4 accent-neutral-900" />
          The share class terms above were approved by the product committee and match the prospectus supplement.
        </label>
      </AccordionItem>
    </div>
  );
}

/* Short intro under the "Share classes" header shared by all three. */
export function SectionIntro({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs text-neutral-500">{children}</p>;
}
