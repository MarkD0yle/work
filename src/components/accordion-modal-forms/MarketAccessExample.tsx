import { useCallback, useMemo, useState } from "react";
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
  ACCESS_OPTIONS,
  DESKS,
  MARKETS,
  REGIONS,
  type Access,
  type Region,
} from "./data";
import { btnDashed, btnPrimary, btnSecondary, inputClass, nextId, todayIso } from "./styles";

/* Example A — Client onboarding › Market access.
 *
 * The accordion is a four-step onboarding form. Step 3 holds "permission
 * sets": each one is authored in a wide modal that lists all 54 markets as a
 * Full / Restricted / Blocked radio row, grouped by region with bulk-apply,
 * search, and a free-text note on restricted markets. Saving drops the set
 * back into the step as an inline entry; a client can carry several (one per
 * desk). */

type PermissionSet = {
  id: string;
  name: string;
  desk: string;
  effective: string;
  maxNotional: string;
  notes: string;
  access: Record<string, Access>;
  restrictionNotes: Record<string, string>;
};

const SEED: PermissionSet = {
  id: "PS-7Q2LA",
  name: "Developed markets — cash",
  desk: "Cash Equities",
  effective: "2026-09-30",
  maxNotional: "25,000,000",
  notes: "Mirrors the parent entity's existing DM entitlements.",
  access: Object.fromEntries(
    MARKETS.map((m) => [
      m.code,
      ["US", "CA", "GB", "IE", "FR", "DE", "NL", "BE", "LU", "CH", "AT", "IT", "ES", "PT", "SE", "NO", "DK", "FI", "JP", "HK", "SG", "AU", "NZ"].includes(m.code)
        ? "full"
        : ["KR", "TW", "IL", "PL", "CZ"].includes(m.code)
          ? "restricted"
          : "blocked",
    ]),
  ) as Record<string, Access>,
  restrictionNotes: { KR: "Pre-funding required", TW: "Pre-funding required" },
};

type Entity = { legalName: string; lei: string; clientType: string; domicile: string };
type Contacts = { name: string; email: string; phone: string };

type SectionId = "entity" | "contacts" | "access" | "attest";

export default function MarketAccessExample() {
  const [open, setOpen] = useState<Set<SectionId>>(new Set(["access"]));
  const [entity, setEntity] = useState<Entity>({
    legalName: "Halden Ridge Capital LLP",
    lei: "549300HRC7Q2L4EXAMPL",
    clientType: "Professional",
    domicile: "GB",
  });
  const [contacts, setContacts] = useState<Contacts>({ name: "", email: "", phone: "" });
  const [sets, setSets] = useState<PermissionSet[]>([SEED]);
  const [attested, setAttested] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Modal: null = closed, otherwise the draft being edited.
  const [draft, setDraft] = useState<PermissionSet | null>(null);
  const closeModal = useCallback(() => setDraft(null), []);

  const entityDone = entity.legalName.trim() !== "" && entity.lei.trim().length === 20;
  const accessDone = sets.length > 0;
  const status = {
    entity: entityDone ? "complete" : "incomplete",
    contacts: contacts.email ? "complete" : "optional",
    access: accessDone ? "complete" : "incomplete",
    attest: attested ? "complete" : "incomplete",
  } as const;
  const requiredDone = [entityDone, accessDone, attested].filter(Boolean).length;

  function toggle(id: SectionId) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function newSet() {
    setDraft({
      id: nextId("PS"),
      name: "",
      desk: DESKS[0],
      effective: todayIso(),
      maxNotional: "",
      notes: "",
      access: {},
      restrictionNotes: {},
    });
  }

  function saveSet(s: PermissionSet) {
    setSets((prev) =>
      prev.some((p) => p.id === s.id) ? prev.map((p) => (p.id === s.id ? s : p)) : [...prev, s],
    );
    setDraft(null);
  }

  return (
    <div>
      <div className="space-y-2">
        <AccordionItem
          index={1}
          title="Entity details"
          summary={entity.legalName ? `${entity.legalName} · ${entity.clientType}` : "Legal name, LEI, classification"}
          status={status.entity}
          open={open.has("entity")}
          onToggle={() => toggle("entity")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock label="Legal name" htmlFor="a-legal" required>
              <input
                id="a-legal"
                className={inputClass}
                value={entity.legalName}
                onChange={(e) => setEntity({ ...entity, legalName: e.target.value })}
              />
            </FieldBlock>
            <FieldBlock label="LEI" htmlFor="a-lei" required hint={`${entity.lei.length}/20 characters`}>
              <input
                id="a-lei"
                className={`${inputClass} font-mono uppercase`}
                maxLength={20}
                value={entity.lei}
                onChange={(e) => setEntity({ ...entity, lei: e.target.value.toUpperCase() })}
              />
            </FieldBlock>
            <FieldBlock label="Client classification" htmlFor="a-type">
              <select
                id="a-type"
                className={inputClass}
                value={entity.clientType}
                onChange={(e) => setEntity({ ...entity, clientType: e.target.value })}
              >
                <option>Retail</option>
                <option>Professional</option>
                <option>Eligible counterparty</option>
              </select>
            </FieldBlock>
            <FieldBlock label="Domicile" htmlFor="a-dom">
              <select
                id="a-dom"
                className={inputClass}
                value={entity.domicile}
                onChange={(e) => setEntity({ ...entity, domicile: e.target.value })}
              >
                {MARKETS.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </select>
            </FieldBlock>
          </div>
        </AccordionItem>

        <AccordionItem
          index={2}
          title="Trading contacts"
          summary={contacts.email || "Who we call about breaks and fails"}
          status={status.contacts}
          open={open.has("contacts")}
          onToggle={() => toggle("contacts")}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldBlock label="Name" htmlFor="a-cn">
              <input
                id="a-cn"
                className={inputClass}
                value={contacts.name}
                onChange={(e) => setContacts({ ...contacts, name: e.target.value })}
              />
            </FieldBlock>
            <FieldBlock label="Email" htmlFor="a-ce">
              <input
                id="a-ce"
                type="email"
                className={inputClass}
                value={contacts.email}
                onChange={(e) => setContacts({ ...contacts, email: e.target.value })}
              />
            </FieldBlock>
            <FieldBlock label="Phone" htmlFor="a-cp">
              <input
                id="a-cp"
                className={inputClass}
                value={contacts.phone}
                onChange={(e) => setContacts({ ...contacts, phone: e.target.value })}
              />
            </FieldBlock>
          </div>
        </AccordionItem>

        <AccordionItem
          index={3}
          title="Market access"
          summary={
            sets.length
              ? `${sets.length} permission set${sets.length === 1 ? "" : "s"} · ${sets.map((s) => s.desk).join(", ")}`
              : "Which of 54 markets this client may trade"
          }
          status={status.access}
          open={open.has("access")}
          onToggle={() => toggle("access")}
        >
          <p className="mb-3 text-xs text-neutral-500">
            Add one permission set per desk. Each set rates every market as full, restricted or blocked.
          </p>
          <div className="space-y-2">
            {sets.length === 0 && <EmptyEntries>No permission sets yet.</EmptyEntries>}
            {sets.map((s) => (
              <PermissionEntry
                key={s.id}
                set={s}
                onEdit={() => setDraft(structuredClone(s))}
                onRemove={() => setSets((prev) => prev.filter((p) => p.id !== s.id))}
              />
            ))}
            <button type="button" onClick={newSet} className={btnDashed}>
              <PlusIcon /> Add permission set
            </button>
          </div>
        </AccordionItem>

        <AccordionItem
          index={4}
          title="Attestation"
          summary={attested ? "Attested" : "Confirm the entitlements before submission"}
          status={status.attest}
          open={open.has("attest")}
          onToggle={() => toggle("attest")}
        >
          <label className="flex items-start gap-3 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={attested}
              onChange={(e) => setAttested(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-neutral-900"
            />
            I confirm the market entitlements above match the signed client agreement and the
            relevant desk heads have approved them.
          </label>
        </AccordionItem>
      </div>

      <FormFooter
        done={requiredDone}
        total={3}
        onSubmit={() => setSubmitted(true)}
        submitLabel="Submit onboarding"
        submitted={submitted}
      />

      {draft && (
        <PermissionModal
          key={draft.id}
          initial={draft}
          isNew={!sets.some((s) => s.id === draft.id)}
          onClose={closeModal}
          onSave={saveSet}
        />
      )}
    </div>
  );
}

function PermissionEntry({
  set,
  onEdit,
  onRemove,
}: {
  set: PermissionSet;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const counts = countAccess(set.access);
  const restricted = MARKETS.filter((m) => set.access[m.code] === "restricted");
  const blocked = MARKETS.filter((m) => set.access[m.code] === "blocked");
  return (
    <InlineEntry
      title={set.name}
      meta={
        <>
          {set.desk} · effective {set.effective}
          {set.maxNotional && <> · max {set.maxNotional} / order</>}
        </>
      }
      badges={
        <>
          <Chip tone="good">{counts.full} full</Chip>
          <Chip tone="warn">{counts.restricted} restricted</Chip>
          <Chip tone="bad">{counts.blocked} blocked</Chip>
        </>
      }
      onEdit={onEdit}
      onRemove={onRemove}
      details={
        <div className="space-y-3">
          <DistributionBar
            parts={[
              { label: "Full", count: counts.full, tone: "good" },
              { label: "Restricted", count: counts.restricted, tone: "warn" },
              { label: "Blocked", count: counts.blocked, tone: "bad" },
            ]}
          />
          {restricted.length > 0 && (
            <div className="text-xs">
              <span className="font-medium text-neutral-700">Restricted: </span>
              {restricted.map((m, i) => (
                <span key={m.code} className="text-neutral-600">
                  {i > 0 && ", "}
                  {m.name}
                  {set.restrictionNotes[m.code] && (
                    <span className="text-neutral-400"> ({set.restrictionNotes[m.code]})</span>
                  )}
                </span>
              ))}
            </div>
          )}
          {blocked.length > 0 && (
            <div className="text-xs text-neutral-600">
              <span className="font-medium text-neutral-700">Blocked: </span>
              {blocked.map((m) => m.code).join(" · ")}
            </div>
          )}
          {set.notes && <p className="text-xs text-neutral-500 italic">{set.notes}</p>}
        </div>
      }
    />
  );
}

function countAccess(access: Record<string, Access>) {
  const c = { full: 0, restricted: 0, blocked: 0 };
  for (const v of Object.values(access)) c[v]++;
  return c;
}

function PermissionModal({
  initial,
  isNew,
  onClose,
  onSave,
}: {
  initial: PermissionSet;
  isNew: boolean;
  onClose: () => void;
  onSave: (s: PermissionSet) => void;
}) {
  const [d, setD] = useState(initial);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<Region | "all">("all");
  const [unsetOnly, setUnsetOnly] = useState(false);

  const setCount = Object.keys(d.access).length;
  const complete = setCount === MARKETS.length;
  const canSave = complete && d.name.trim() !== "";

  const visible = useMemo(() => {
    const ql = query.trim().toLowerCase();
    return MARKETS.filter(
      (m) =>
        (region === "all" || m.region === region) &&
        (!unsetOnly || !d.access[m.code]) &&
        (!ql || m.name.toLowerCase().includes(ql) || m.code.toLowerCase().includes(ql)),
    );
  }, [query, region, unsetOnly, d.access]);

  function setAccess(code: string, v: Access) {
    setD((prev) => ({ ...prev, access: { ...prev.access, [code]: v } }));
  }

  function applyToRegion(r: Region, v: Access) {
    setD((prev) => {
      const access = { ...prev.access };
      for (const m of MARKETS) if (m.region === r) access[m.code] = v;
      return { ...prev, access };
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="2xl"
      title={isNew ? "New permission set" : `Edit · ${initial.name}`}
      description="Rate every market. Use the region shortcuts to fill a block at once, then adjust individual rows."
      footer={
        <>
          <span className="mr-auto text-xs text-neutral-500 tabular-nums">
            {setCount} of {MARKETS.length} markets set
            {!d.name.trim() && " · name required"}
          </span>
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="button" disabled={!canSave} onClick={() => onSave(d)} className={btnPrimary}>
            {isNew ? "Add to form" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <FieldBlock label="Set name" htmlFor="ps-name" required className="sm:col-span-2">
          <input
            id="ps-name"
            className={inputClass}
            placeholder="e.g. EM derivatives"
            value={d.name}
            onChange={(e) => setD({ ...d, name: e.target.value })}
          />
        </FieldBlock>
        <FieldBlock label="Desk" htmlFor="ps-desk">
          <select
            id="ps-desk"
            className={inputClass}
            value={d.desk}
            onChange={(e) => setD({ ...d, desk: e.target.value })}
          >
            {DESKS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </FieldBlock>
        <FieldBlock label="Effective" htmlFor="ps-eff">
          <input
            id="ps-eff"
            type="date"
            className={inputClass}
            value={d.effective}
            onChange={(e) => setD({ ...d, effective: e.target.value })}
          />
        </FieldBlock>
      </div>

      {/* Sticky filter bar; negative offsets cancel the modal body padding. */}
      <div
        className="sticky z-20 -mx-5 mt-5 flex flex-wrap items-center gap-2 border-y border-neutral-200 bg-white/95 px-5 py-2.5 backdrop-blur"
        style={{ top: -16 }}
      >
        <input
          type="search"
          aria-label="Filter markets"
          placeholder="Filter markets…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${inputClass} w-48 py-1.5 text-xs`}
        />
        <div className="flex">
          {(["all", ...REGIONS] as const).map((r, i) => (
            <button
              key={r}
              type="button"
              aria-pressed={region === r}
              onClick={() => setRegion(r)}
              className={`border px-2.5 py-1.5 text-xs font-medium ${i > 0 ? "-ml-px" : ""} ${
                region === r
                  ? "z-10 border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {r === "all" ? "All" : r}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={unsetOnly}
            onChange={(e) => setUnsetOnly(e.target.checked)}
            className="accent-neutral-900"
          />
          Unset only
        </label>
      </div>

      <div className="mt-3 space-y-5">
        {REGIONS.filter((r) => region === "all" || region === r).map((r) => {
          const rows = visible.filter((m) => m.region === r);
          const total = MARKETS.filter((m) => m.region === r).length;
          const done = MARKETS.filter((m) => m.region === r && d.access[m.code]).length;
          return (
            <fieldset key={r}>
              <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 pb-2">
                <legend className="text-xs font-semibold tracking-widest text-neutral-800 uppercase">
                  {r}
                </legend>
                <span className="text-[11px] text-neutral-400 tabular-nums">
                  {done}/{total}
                </span>
                <span className="ml-auto text-[11px] text-neutral-500">Set all to</span>
                {ACCESS_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => applyToRegion(r, o.value)}
                    className="border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {rows.length === 0 ? (
                <p className="py-3 text-xs text-neutral-400">No markets match.</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {rows.map((m) => (
                    <li
                      key={m.code}
                      className={`flex flex-wrap items-center gap-x-3 gap-y-2 py-2 ${
                        d.access[m.code] ? "" : "bg-amber-50/40"
                      }`}
                    >
                      <span className="w-8 font-mono text-[11px] font-semibold text-neutral-500">
                        {m.code}
                      </span>
                      <span className="min-w-0 flex-1 text-sm text-neutral-800">{m.name}</span>
                      {d.access[m.code] === "restricted" && (
                        <input
                          aria-label={`Restriction note for ${m.name}`}
                          placeholder="Restriction note"
                          value={d.restrictionNotes[m.code] ?? ""}
                          onChange={(e) =>
                            setD({
                              ...d,
                              restrictionNotes: { ...d.restrictionNotes, [m.code]: e.target.value },
                            })
                          }
                          className={`${inputClass} w-44 py-1 text-xs`}
                        />
                      )}
                      <RadioPills
                        name={`access-${m.code}`}
                        label={`Access for ${m.name}`}
                        value={d.access[m.code]}
                        options={ACCESS_OPTIONS}
                        onChange={(v) => setAccess(m.code, v)}
                        size="xs"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 border-t border-neutral-200 pt-4 sm:grid-cols-3">
        <FieldBlock label="Max notional / order" htmlFor="ps-max">
          <input
            id="ps-max"
            inputMode="numeric"
            className={`${inputClass} tabular-nums`}
            placeholder="0"
            value={d.maxNotional}
            onChange={(e) => setD({ ...d, maxNotional: e.target.value })}
          />
        </FieldBlock>
        <FieldBlock label="Notes" htmlFor="ps-notes" className="sm:col-span-2">
          <input
            id="ps-notes"
            className={inputClass}
            value={d.notes}
            onChange={(e) => setD({ ...d, notes: e.target.value })}
          />
        </FieldBlock>
      </div>
    </Modal>
  );
}
