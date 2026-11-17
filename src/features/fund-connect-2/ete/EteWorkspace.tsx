import type { User } from "../lib/types";
import { DistributionTab } from "./DistributionTab";
import { EteProvider } from "./EteProvider";
import { useEte } from "./ete-context";
import { countBySeverity, diffCount, validate } from "./engine";
import { FundDetailsTab } from "./FundDetailsTab";
import { FundOverview } from "./FundOverview";
import { latestConfig, workflowState, type TabId } from "./model";
import { OrderTypesTab } from "./OrderTypes";
import { ReviewTab } from "./ReviewTab";
import { btn, cx, eyebrow, focusRing, muted } from "./styles";
import { Badge, TabBar, WorkflowBadge, type TabItem } from "./ui";

/* ETE Fund Configuration — the Fund Connect 2 workspace for configuring one
 * fund around its real hierarchy:
 *
 *   ETE Fund
 *   └─ Order Type
 *      └─ Settlement Period
 *
 * It replaces the long fund-level form with nested Order Type modals: Order
 * Types come first and get the most room, fund-level fields sit behind them
 * in collapsible sections, and Review gathers validation and changes.
 *
 * Mock data only (see mock-data.ts); edits last for the session. The acting
 * user is the one chosen in the Fund Connect 2 header. */

function FundRail() {
  const { funds, fund, selectFund, reset } = useEte();
  return (
    <nav aria-label="Funds" className="flex min-h-0 flex-col border-b border-neutral-200 bg-neutral-100/70 lg:border-r lg:border-b-0">
      <div className="px-4 pt-3 pb-2">
        <h2 className={eyebrow}>ETE funds</h2>
        <p className="text-[11px] text-neutral-500">Pick a fund to configure.</p>
      </div>
      <ul className="max-h-44 min-h-0 flex-1 overflow-y-auto px-2 pb-2 lg:max-h-none">
        {funds.map((f) => {
          const c = latestConfig(f);
          const on = f.id === fund.id;
          const state = workflowState(f);
          const errors = f.pending?.state === "draft" ? countBySeverity(validate(f.pending.config)).errors : 0;
          return (
            <li key={f.id}>
              <button
                type="button"
                aria-current={on ? "true" : undefined}
                onClick={() => selectFund(f.id)}
                className={cx("mb-1 block w-full border px-3 py-2 text-left", on ? "border-neutral-900 bg-white" : "border-transparent hover:border-neutral-300 hover:bg-white", focusRing)}
              >
                <span className="block truncate text-xs font-semibold text-neutral-900">{c.details.fundName}</span>
                <span className="block truncate text-[11px] text-neutral-500">
                  <span className="font-mono">{c.details.fundCode}</span> · {c.details.issuer}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1">
                  <WorkflowBadge state={state} />
                  {f.active && f.pending && <Badge tone="good">Active v{f.activeVersion}</Badge>}
                  {errors > 0 && <Badge tone="bad">{errors === 1 ? "1 error" : `${errors} errors`}</Badge>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-neutral-200 px-4 py-2">
        <button type="button" onClick={reset} className={btn.ghost}>
          Reset demo data
        </button>
      </div>
    </nav>
  );
}

function Workspace() {
  const { fund, config, tab, setTab, pendingIssues, diff, readOnlyReason } = useEte();
  const counts = countBySeverity(pendingIssues);
  const changes = diff ? diffCount(diff) : 0;

  const tabs: TabItem<TabId>[] = [
    { value: "order-types", label: "Order Types", note: String(config.orderTypes.length) },
    { value: "details", label: "Fund Details" },
    { value: "distribution", label: "Fund Distribution" },
    {
      value: "review",
      label: "Validation and Review",
      note: counts.errors ? `${counts.errors} ${counts.errors === 1 ? "error" : "errors"}` : changes ? `${changes} ${changes === 1 ? "change" : "changes"}` : undefined,
      noteTone: counts.errors ? "bad" : "warn",
    },
  ];

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-1">
      <FundRail />
      <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto lg:overflow-hidden">
        <FundOverview />
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-4 border-b border-neutral-200 bg-white px-6 pt-2">
          <TabBar label="Fund configuration areas" tabs={tabs} value={tab} onChange={setTab} />
          {readOnlyReason && tab !== "review" && <p className={cx("pb-2", muted)}>Read-only. {readOnlyReason}</p>}
        </div>
        {/* Keyed by fund so per-tab UI state (search text) starts fresh. */}
        <div key={fund.id} role="tabpanel" className="min-h-[34rem] flex-1 lg:min-h-0">
          {tab === "order-types" && <OrderTypesTab />}
          {tab === "details" && <FundDetailsTab />}
          {tab === "distribution" && <DistributionTab />}
          {tab === "review" && <ReviewTab />}
        </div>
      </div>
    </div>
  );
}

export default function EteWorkspace({ user }: { user: User }) {
  return (
    <EteProvider user={user}>
      <Workspace />
    </EteProvider>
  );
}
