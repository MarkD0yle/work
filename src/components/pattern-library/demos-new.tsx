import { useMemo, useState, type ComponentType } from "react";
import {
  BulletBar,
  CommandPalette,
  CommentThread,
  ComparePanel,
  COMPARE_MAX,
  ContextPanel,
  DataTable,
  EditPanel,
  EmptyState,
  FacetRail,
  HelpPanel,
  KeyValueGrid,
  PanelHost,
  PanelInput,
  PanelSection,
  PanelSelect,
  PanelTrail,
  SegmentedControl,
  SkeletonCard,
  SkeletonPanel,
  SkeletonTable,
  SplitView,
  StatusBadge,
  ToastProvider,
  tokens,
  useCommandShortcut,
  useFieldHelp,
  usePanelStack,
  useToast,
  type Column,
  type Comment,
  type Command,
  type CompareField,
  type Facet,
  type HelpTopic,
  type StackItem,
} from "../patterns";
import { ORDERS, statusTone } from "./fixtures";

/* Demos for catalog entries 23–32. Fixture data only. */

const { cx, text, border, button } = tokens;

/* ── Panel host ─────────────────────────────────────────────────────────── */

function PanelHostDemo() {
  const [mode, setMode] = useState<"push" | "overlay">("push");
  const [sel, setSel] = useState<string | null>(ORDERS[0].id);
  const order = ORDERS.find((o) => o.id === sel);
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl label="Panel mode" value={mode} onChange={setMode} options={[{ value: "push", label: "Push" }, { value: "overlay", label: "Overlay" }]} />
      <div className="h-80">
        <PanelHost
          mode={mode}
          open={!!order}
          onClose={() => setSel(null)}
          label="Order detail"
          initialWidth="sm"
          main={
            <ul className={cx("divide-y", border.divide)}>
              {ORDERS.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => setSel(o.id)} className={cx("flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-xs", sel === o.id ? tokens.surface.selected : tokens.surface.hover)}>
                    <span className="font-medium">{o.id} · {o.instrument}</span>
                    <StatusBadge tone={statusTone(o.status)} label={o.status} dot />
                  </button>
                </li>
              ))}
            </ul>
          }
          panel={
            order && (
              <ContextPanel title={order.id} eyebrow={order.instrument} onClose={() => setSel(null)}>
                <PanelSection title="Economics" last>
                  <KeyValueGrid layout="rows" items={[{ label: "Side", value: order.side }, { label: "Quantity", value: order.qty.toLocaleString(), mono: true }, { label: "Venue", value: order.venue }]} />
                </PanelSection>
              </ContextPanel>
            )
          }
        />
      </div>
      <p className={text.muted}>Try S / M / L, » to collapse to a rail, Esc inside the panel, and ← → on the divider.</p>
    </div>
  );
}

/* ── Edit panel ─────────────────────────────────────────────────────────── */

type Limit = { limit: string; warn: string; owner: "rates" | "fx" | "credit" };
const SAVED_LIMIT: Limit = { limit: "100", warn: "80", owner: "fx" };

function EditPanelDemo() {
  const [saved, setSaved] = useState<Limit>(SAVED_LIMIT);
  const [draft, setDraft] = useState<Limit>(SAVED_LIMIT);
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const set = (patch: Partial<Limit>) => setDraft((d) => ({ ...d, ...patch }));
  const changed = (k: keyof Limit) => draft[k] !== saved[k];
  const dirty = (Object.keys(saved) as (keyof Limit)[]).some(changed);
  const limitError = draft.limit.trim() === "" || Number.isNaN(Number(draft.limit)) ? "Enter a number in £m." : Number(draft.limit) <= 0 ? "Must be above zero." : undefined;

  function save() {
    if (limitError) return;
    setSaving(true);
    setError(undefined);
    setTimeout(() => {
      setSaving(false);
      if (Number(draft.limit) > 200) setError("Limits above £200m need Risk Committee approval. Your edits are kept.");
      else setSaved(draft);
    }, 700);
  }

  if (!open) {
    return (
      <button type="button" className={button.secondary} onClick={() => setOpen(true)}>
        Edit FX desk limit
      </button>
    );
  }

  return (
    <div className={cx("h-[34rem] max-w-sm", border.default)}>
      <EditPanel
        title="FX desk limit"
        eyebrow="Edit"
        dirty={dirty}
        saving={saving}
        error={error}
        onSave={save}
        onDiscard={() => {
          setDraft(saved);
          setError(undefined);
        }}
        onClose={() => setOpen(false)}
      >
        <PanelInput label="Net open position limit (£m)" value={draft.limit} onChange={(v) => set({ limit: v })} changed={changed("limit")} error={limitError} hint="Try 250 to see a failed save." inputMode="decimal" mono />
        <PanelInput label="Warning threshold (% of limit)" value={draft.warn} onChange={(v) => set({ warn: v })} changed={changed("warn")} inputMode="numeric" mono />
        <PanelSelect label="Owner" value={draft.owner} onChange={(v) => set({ owner: v })} changed={changed("owner")} options={[{ value: "rates", label: "Rates desk" }, { value: "fx", label: "FX desk" }, { value: "credit", label: "Credit desk" }]} />
      </EditPanel>
    </div>
  );
}

/* ── Drill-in panel ─────────────────────────────────────────────────────── */

type Node = StackItem & { kind: "Order" | "Counterparty" | "Credit line"; broker?: string };

const BROKERS: Record<string, { name: string; rating: string; used: number; limit: number; line: string }> = {
  Tradeweb: { name: "Tradeweb Markets", rating: "A+", used: 62, limit: 100, line: "TW-CL-204" },
  Bloomberg: { name: "Bloomberg Trading", rating: "AA-", used: 31, limit: 80, line: "BB-CL-118" },
  "360T": { name: "360T", rating: "A", used: 74, limit: 75, line: "360-CL-009" },
  MTS: { name: "MTS", rating: "BBB+", used: 40, limit: 60, line: "MTS-CL-331" },
};

function DrillInDemo() {
  const { stack, current, open, push, pop, jump, close } = usePanelStack<Node>();

  function body(n: Node) {
    const b = BROKERS[n.broker ?? ""];
    if (n.kind === "Order") {
      const o = ORDERS.find((x) => x.id === n.id)!;
      return (
        <PanelSection title="Order" last>
          <KeyValueGrid layout="rows" items={[{ label: "Instrument", value: o.instrument }, { label: "Quantity", value: o.qty.toLocaleString(), mono: true }, { label: "Counterparty", value: b.name }]} />
          <button type="button" className={cx("mt-3", button.secondary)} onClick={() => push({ id: `cp-${o.venue}`, title: b.name, kind: "Counterparty", broker: o.venue })}>
            View counterparty →
          </button>
        </PanelSection>
      );
    }
    if (n.kind === "Counterparty") {
      return (
        <PanelSection title="Counterparty" last>
          <KeyValueGrid layout="rows" items={[{ label: "Rating", value: b.rating }, { label: "Credit line", value: b.line, mono: true }]} />
          <button type="button" className={cx("mt-3", button.secondary)} onClick={() => push({ id: `cl-${b.line}`, title: b.line, kind: "Credit line", broker: n.broker })}>
            View credit line →
          </button>
        </PanelSection>
      );
    }
    return (
      <PanelSection title="Utilisation" last>
        <div className="mb-1 flex justify-between text-xs tabular-nums">
          <span className={text.label}>Used</span>
          <span>£{b.used}m / £{b.limit}m</span>
        </div>
        <BulletBar value={b.used} target={b.limit * 0.8} limit={b.limit} max={b.limit * 1.2} label={`Credit used £${b.used}m, limit £${b.limit}m`} />
      </PanelSection>
    );
  }

  return (
    <div className="h-80">
      <SplitView
        detailWidth="sm"
        list={
          <ul className={cx("divide-y", border.divide)}>
            {ORDERS.slice(0, 4).map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => open({ id: o.id, title: o.id, kind: "Order", broker: o.venue })} className={cx("w-full px-4 py-2 text-left text-xs", stack[0]?.id === o.id ? tokens.surface.selected : tokens.surface.hover)}>
                  <span className="font-medium">{o.id}</span> · {o.instrument}
                </button>
              </li>
            ))}
          </ul>
        }
        detail={
          current ? (
            <ContextPanel title={current.title} eyebrow={current.kind} onClose={close} actions={<PanelTrail trail={stack} onBack={pop} onJump={jump} />}>
              {body(current)}
            </ContextPanel>
          ) : (
            <EmptyState kind="first" title="Select an order" description="Then follow its counterparty and credit line without leaving the panel." compact />
          )
        }
      />
    </div>
  );
}

/* ── Compare panel ──────────────────────────────────────────────────────── */

const QUOTES = [
  { id: "a", title: "Broker A", subtitle: "Tradeweb", price: 99.42, size: 25, fee: 1.2, settle: "T+1", valid: 20 },
  { id: "b", title: "Broker B", subtitle: "Bloomberg", price: 99.45, size: 25, fee: 0.8, settle: "T+1", valid: 45 },
  { id: "c", title: "Broker C", subtitle: "MTS", price: 99.44, size: 15, fee: 0.8, settle: "T+2", valid: 30 },
  { id: "d", title: "Broker D", subtitle: "360T", price: 99.4, size: 25, fee: 2.1, settle: "T+1", valid: 10 },
] as const;

function CompareDemo() {
  const [pinned, setPinned] = useState<string[]>(["a", "b"]);
  const items = QUOTES.filter((q) => pinned.includes(q.id));
  const fields: CompareField[] = [
    { label: "Instrument", values: items.map(() => "UKT 4¼ 2032") },
    { label: "Price", values: items.map((q) => q.price), mono: true, better: "low", format: (v) => Number(v).toFixed(2) },
    { label: "Size (£m)", values: items.map((q) => q.size), mono: true, better: "high" },
    { label: "Fee (bp)", values: items.map((q) => q.fee), mono: true, better: "low" },
    { label: "Settlement", values: items.map((q) => q.settle) },
    { label: "Valid (s)", values: items.map((q) => q.valid), mono: true, better: "high" },
  ];
  const toggle = (id: string) => setPinned((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < COMPARE_MAX ? [...p, id] : p));

  return (
    <div className="h-80">
      <SplitView
        detailWidth="lg"
        list={
          <div>
            <div className={cx("border-b px-4 py-2", border.divider, text.muted)}>Quotes for UKT 4¼ 2032 · pinned {pinned.length}/{COMPARE_MAX}</div>
            <ul className={cx("divide-y", border.divide)}>
              {QUOTES.map((q) => {
                const on = pinned.includes(q.id);
                return (
                  <li key={q.id} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                    <span><span className="font-medium">{q.title}</span> <span className="tabular-nums text-neutral-500">{q.price.toFixed(2)}</span></span>
                    <button type="button" aria-pressed={on} onClick={() => toggle(q.id)} disabled={!on && pinned.length >= COMPARE_MAX} className={button.secondary}>
                      {on ? "Pinned" : "Pin"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        }
        detail={
          <ContextPanel title="Compare quotes" eyebrow="Pinned">
            <ComparePanel items={items.map(({ id, title, subtitle }) => ({ id, title, subtitle }))} fields={fields} onRemove={toggle} onClear={() => setPinned([])} />
          </ContextPanel>
        }
      />
    </div>
  );
}

/* ── Comment thread ─────────────────────────────────────────────────────── */

function CommentThreadDemo() {
  const [comments, setComments] = useState<Comment[]>([
    { id: "1", author: "Priya Nair", at: "14:02", body: "Fill is 3bp through arrival. Was the sweep intentional?" },
    { id: "2", author: "Jamie Patel", at: "14:09", body: "Yes. Client asked for completion before the 14:30 auction." },
  ]);
  return (
    <div className={cx("h-[26rem] max-w-sm", border.default)}>
      <ContextPanel title="ORD-1042" eyebrow="Discussion">
        <CommentThread
          label="Comments on ORD-1042"
          comments={comments}
          onPost={(body) => setComments((c) => [...c, { id: String(c.length + 1), author: "You", at: "now", body }])}
          onResolve={(id) => setComments((c) => c.map((x) => (x.id === id ? { ...x, resolved: true } : x)))}
        />
      </ContextPanel>
    </div>
  );
}

/* ── Help panel ─────────────────────────────────────────────────────────── */

const TOPICS: Record<string, HelpTopic> = {
  isin: { title: "ISIN", body: "The 12-character code that identifies the security. We use it to find the instrument and its settlement rules.", example: "GB00B6460505", rules: ["It is not exactly 12 characters.", "The check digit fails.", "The instrument is not in the approved list."], source: "Securities static data policy §2.1" },
  qty: { title: "Quantity", body: "Nominal amount in the instrument's currency, not the number of lots.", example: "25000000", rules: ["It is above the desk's single-order limit (£50m).", "It is not a multiple of the minimum denomination."], source: "Desk mandate, order limits" },
  price: { title: "Limit price", body: "The worst price you will accept. Leave blank to trade at market.", example: "99.45", rules: ["It is more than 2% from the last price (fat-finger check)."] },
};

function HelpPanelDemo() {
  const { active, bind } = useFieldHelp();
  const [v, setV] = useState({ isin: "", qty: "", price: "" });
  return (
    <div className={cx("grid h-96 sm:grid-cols-2", border.default, tokens.surface.card)}>
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4 p-5">
        <div className={text.title}>New order</div>
        <PanelInput label="ISIN" value={v.isin} onChange={(x) => setV({ ...v, isin: x })} mono {...bind("isin")} />
        <PanelInput label="Quantity" value={v.qty} onChange={(x) => setV({ ...v, qty: x })} mono inputMode="numeric" {...bind("qty")} />
        <PanelInput label="Limit price" value={v.price} onChange={(x) => setV({ ...v, price: x })} mono inputMode="decimal" {...bind("price")} />
      </form>
      <div className={cx("min-h-0 border-t sm:border-t-0 sm:border-l", border.divider)}>
        <HelpPanel topic={active ? TOPICS[active] : null} />
      </div>
    </div>
  );
}

/* ── Command palette ────────────────────────────────────────────────────── */

function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState("Nothing run yet");
  useCommandShortcut(() => setOpen(true));
  const run = (label: string) => () => setLast(`Ran: ${label}`);
  const commands = useMemo<Command[]>(
    () => [
      { id: "blotter", label: "Open order blotter", group: "Go to", shortcut: "G B", onRun: run("Open order blotter") },
      { id: "ops", label: "Open ops overview", group: "Go to", keywords: "monitor", shortcut: "G O", onRun: run("Open ops overview") },
      { id: "limits", label: "Open limit monitor", group: "Go to", keywords: "risk breach", onRun: run("Open limit monitor") },
      { id: "new", label: "New order", group: "Actions", shortcut: "N", onRun: run("New order") },
      { id: "export", label: "Export current view", group: "Actions", keywords: "csv download", onRun: run("Export current view") },
      { id: "theme", label: "Switch to dense tables", group: "Actions", keywords: "density compact", onRun: run("Switch to dense tables") },
    ],
    [],
  );
  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" className={button.secondary} onClick={() => setOpen(true)}>
        Open command palette <kbd className="font-mono text-[10px] text-neutral-500">⌘K</kbd>
      </button>
      <p className={text.muted} aria-live="polite">{last}. Try “ord new”, or “csv”.</p>
      <CommandPalette open={open} onClose={() => setOpen(false)} commands={commands} />
    </div>
  );
}

/* ── Facet rail ─────────────────────────────────────────────────────────── */

const FACET_DEFS: { id: "venue" | "status" | "side"; label: string; value: (o: (typeof ORDERS)[number]) => string }[] = [
  { id: "venue", label: "Venue", value: (o) => o.venue },
  { id: "status", label: "Status", value: (o) => o.status },
  { id: "side", label: "Side", value: (o) => o.side },
];

function FacetRailDemo() {
  const [selected, setSelected] = useState<Record<string, string[]>>({ status: ["Partial"] });

  // A row passes if, for every facet other than `skip`, it matches that facet's selection.
  const passes = (o: (typeof ORDERS)[number], skip?: string) => FACET_DEFS.every((f) => f.id === skip || !(selected[f.id]?.length) || selected[f.id].includes(f.value(o)));
  const facets: Facet[] = FACET_DEFS.map((f) => {
    const values = [...new Set(ORDERS.map(f.value))];
    return { id: f.id, label: f.label, options: values.map((v) => ({ value: v, label: v, count: ORDERS.filter((o) => passes(o, f.id) && f.value(o) === v).length })) };
  });
  const rows = ORDERS.filter((o) => passes(o));
  const cols: Column<(typeof ORDERS)[number]>[] = [
    { key: "id", header: "Order", cell: (o) => <span className="font-mono">{o.id}</span> },
    { key: "venue", header: "Venue", cell: (o) => o.venue },
    { key: "status", header: "Status", cell: (o) => <StatusBadge tone={statusTone(o.status)} label={o.status} dot /> },
  ];

  return (
    <div className={cx("grid h-80 sm:grid-cols-[14rem_1fr]", border.default, tokens.surface.card)}>
      <div className={cx("min-h-0 border-b sm:border-r sm:border-b-0", border.divider)}>
        <FacetRail
          facets={facets}
          selected={selected}
          resultCount={rows.length}
          visibleOptions={3}
          onChange={(id, next) => setSelected((s) => ({ ...s, [id]: next }))}
          onClearAll={() => setSelected({})}
        />
      </div>
      <div className="min-h-0 overflow-auto">
        <DataTable caption="Filtered orders" columns={cols} rows={rows} rowKey={(o) => o.id} empty={<EmptyState kind="filtered" title="No orders match" compact />} />
      </div>
    </div>
  );
}

/* ── Toast ──────────────────────────────────────────────────────────────── */

function ToastDemoBody() {
  const toast = useToast();
  const [cancelled, setCancelled] = useState<Set<string>>(new Set());

  function cancel(id: string) {
    setCancelled((s) => new Set(s).add(id));
    toast.show({
      title: `${id} cancelled`,
      description: "Withdrawn from all venues. Fills so far are kept.",
      tone: "neutral",
      action: { label: "Undo", onClick: () => setCancelled((s) => (s.delete(id), new Set(s))) },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className={cx("max-w-md divide-y", border.default, border.divide, tokens.surface.card)}>
        {ORDERS.slice(0, 3).map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
            <span className={cancelled.has(o.id) ? "text-neutral-400 line-through" : "font-medium"}>{o.id} · {o.instrument}</span>
            <button type="button" className={button.secondary} disabled={cancelled.has(o.id)} onClick={() => cancel(o.id)}>
              Cancel
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button type="button" className={button.secondary} onClick={() => toast.show({ title: "View saved", tone: "positive" })}>
          Plain toast
        </button>
        <button type="button" className={button.secondary} onClick={() => toast.show({ title: "Cancel failed", description: "Venue rejected the request. Try again.", tone: "negative" })}>
          Failure (stays)
        </button>
      </div>
    </div>
  );
}

function ToastDemo() {
  return (
    <ToastProvider>
      <ToastDemoBody />
    </ToastProvider>
  );
}

/* ── Skeleton ───────────────────────────────────────────────────────────── */

function SkeletonDemo() {
  const [state, setState] = useState<"loading" | "loaded">("loading");
  const cols: Column<(typeof ORDERS)[number]>[] = [
    { key: "id", header: "Order", cell: (o) => <span className="font-mono">{o.id}</span> },
    { key: "instrument", header: "Instrument", cell: (o) => o.instrument },
    { key: "venue", header: "Venue", cell: (o) => o.venue },
    { key: "status", header: "Status", cell: (o) => <StatusBadge tone={statusTone(o.status)} label={o.status} dot /> },
  ];
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl label="Data state" value={state} onChange={setState} options={[{ value: "loading", label: "Loading" }, { value: "loaded", label: "Loaded" }]} />
      <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
        {state === "loading" ? (
          <>
            <div className="flex flex-col gap-4">
              <SkeletonCard label="Loading summary" />
              <SkeletonTable rows={5} columns={4} label="Loading orders" />
            </div>
            <div className={border.default}><SkeletonPanel label="Loading order detail" /></div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <div className={cx("p-4", border.default, tokens.surface.card)}>
                <div className={text.eyebrow}>Open orders</div>
                <div className={cx("mt-2", text.value)}>42</div>
                <div className={cx("mt-1", text.muted)}>6 more than at open</div>
              </div>
              <div className={border.default}><DataTable caption="Orders" columns={cols} rows={ORDERS.slice(0, 5)} rowKey={(o) => o.id} /></div>
            </div>
            <div className={border.default}>
              <ContextPanel title="ORD-1042" eyebrow="Order detail">
                <PanelSection title="Economics" last>
                  <KeyValueGrid layout="rows" items={[{ label: "Side", value: "Buy" }, { label: "Quantity", value: "25,000,000", mono: true }, { label: "Venue", value: "Tradeweb" }]} />
                </PanelSection>
              </ContextPanel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const NEW_DEMOS: Record<string, ComponentType> = {
  "panel-host": PanelHostDemo,
  "edit-panel": EditPanelDemo,
  "panel-trail": DrillInDemo,
  "compare-panel": CompareDemo,
  "comment-thread": CommentThreadDemo,
  "help-panel": HelpPanelDemo,
  "command-palette": CommandPaletteDemo,
  "facet-rail": FacetRailDemo,
  toast: ToastDemo,
  skeleton: SkeletonDemo,
};

/** Renders the live demo for catalog entries 23–32. */
export function NewPatternDemo({ id }: { id: string }) {
  const Demo = NEW_DEMOS[id];
  return Demo ? <Demo /> : null;
}
