/* All screens of the Div Claim Automation prototype. Every list screen uses
 * the shared DataTable; every cross-reference is a real navigation. */

import { useState } from "react";
import type { Claim, DivEvent, Entitlement, Rule, TaxMarker, TradeActionRule, WfRequest } from "./types";
import { REGION, TODAY, fmtMoney, fmtQty } from "./data";
import { useDca } from "./store";
import { DataTable, type Col, type FilterDef } from "./DataTable";
import { RuleForm, SimpleEditForm, type RuleValues } from "./RuleForm";
import { Btn, DL, DiffView, Empty, Icons, RequestStepper, StatusBadge, Timeline } from "./ui";

/* =================================================================== */
/* Home                                                                */
/* =================================================================== */

export function HomeScreen() {
  const { events, claims, requests, notifs, userName, role, navigate, markNotifRead } = useDca();
  const eventsToday = events.filter((e) => e.exDate === TODAY).length;
  const discrepancies = claims.filter((c) => c.status === "Discrepancy").length;
  const myRejected = requests.filter((r) => r.submittedBy === userName && r.status === "Rejected").length;
  const myNotifs = notifs.filter((n) => n.forUser === userName).slice(0, 5);

  const cards = [
    {
      label: "Dividend Events today",
      value: eventsToday,
      sub: "ex-date is today",
      onClick: () => navigate({ screen: "events" }),
    },
    {
      label: "Claims with discrepancies",
      value: discrepancies,
      sub: "expected ≠ received",
      onClick: () => navigate({ screen: "claims", statusFilter: "Discrepancy" }),
    },
    {
      label: "My requests",
      value: myRejected,
      sub: myRejected === 1 ? "1 rejected — needs your attention" : `${myRejected} rejected`,
      onClick: () => navigate({ screen: "myRequests", statusFilter: myRejected > 0 ? "Rejected" : undefined }),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-lg font-semibold">Good morning, {userName}</h1>
      <p className="dca-muted mb-5 text-[13px]">
        {TODAY} · signed in as {role} — here is today&apos;s work.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <button key={c.label} type="button" onClick={c.onClick} className="dca-card dca-homecard p-4 text-left">
            <p className="dca-muted text-[11px] font-semibold uppercase tracking-wide">{c.label}</p>
            <p className="dca-mono mt-1 text-3xl font-semibold">{c.value}</p>
            <p className="dca-faint mt-1 text-[12px]">{c.sub}</p>
            <span className="dca-accent-text mt-2 inline-flex items-center gap-1 text-[12px] font-medium">
              Open {Icons.chevronRight("h-3 w-3")}
            </span>
          </button>
        ))}
      </div>

      <h2 className="dca-muted mb-2 mt-8 text-[11px] font-semibold uppercase tracking-wide">Recent notifications</h2>
      {myNotifs.length === 0 ? (
        <Empty text="No notifications" sub="Approvals and rejections will appear here during the session." />
      ) : (
        <div className="dca-card divide-y dca-divide">
          {myNotifs.map((n) => (
            <button
              key={n.id}
              type="button"
              className="dca-notifrow flex w-full items-start gap-2.5 px-4 py-2.5 text-left"
              onClick={() => {
                markNotifRead(n.id);
                if (n.requestId) navigate({ screen: "myRequests", openId: n.requestId });
              }}
            >
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 ${n.read ? "dca-dot-read" : "dca-dot-unread"}`} />
              <span className="flex-1 text-[13px]">{n.text}</span>
              <span className="dca-faint whitespace-nowrap text-[11px]">{n.time}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* =================================================================== */
/* Dividend Claim Rules                                                */
/* =================================================================== */

export function RulesScreen({ openId }: { openId?: string }) {
  const { rules, role, deactivateRules, navigate } = useDca();
  const [form, setForm] = useState<{ mode: "create" | "edit"; rule?: Rule } | null>(null);
  const isMaker = role === "Maker";

  const columns: Col<Rule>[] = [
    { key: "id", label: "Rule ID", get: (r) => r.id, mono: true },
    { key: "country", label: "Country", get: (r) => r.country },
    { key: "code", label: "Code", get: (r) => r.countryCode, mono: true },
    { key: "asset", label: "Asset Type", get: (r) => r.assetType },
    { key: "entity", label: "Entity", get: (r) => r.entity },
    {
      key: "active",
      label: "Active",
      get: (r) => (r.active ? "Active" : "Inactive"),
      render: (r) => <StatusBadge status={r.active ? "Active" : "Inactive"} />,
    },
    { key: "ent", label: "Entitlement", get: (r) => r.entitlementPeriod, mono: true, exception: true },
    { key: "gen", label: "Generation", get: (r) => r.generationDate, mono: true, exception: true },
    { key: "trans", label: "Transmission", get: (r) => r.transmission, mono: true, exception: true },
    { key: "keydate", label: "Key Date", get: (r) => r.keyDateType, exception: true },
    { key: "basis", label: "Basis", get: (r) => r.basis, exception: true },
  ];

  const filters: FilterDef<Rule>[] = [
    { key: "country", label: "Country", get: (r) => r.country, primary: true },
    { key: "asset", label: "Asset Type", get: (r) => r.assetType, primary: true },
    { key: "entity", label: "Business Entity", get: (r) => r.entity, primary: true },
    { key: "active", label: "Active", get: (r) => (r.active ? "Active" : "Inactive"), primary: true },
    { key: "region", label: "Region", get: (r) => REGION[r.countryCode] ?? "Other" },
    { key: "keydate", label: "Key Date Type", get: (r) => r.keyDateType },
    { key: "basis", label: "Basis", get: (r) => r.basis },
    { key: "trans", label: "Transmission", get: (r) => r.transmission },
  ];

  return (
    <>
      <ScreenHead title="Dividend Claim Rules" sub="Production rules — changes go through maker-checker approval." />
      <DataTable<Rule>
        id="rules"
        rows={rules}
        rowId={(r) => r.id}
        columns={columns}
        filters={filters}
        searchText={(r) => `${r.id} ${r.country} ${r.countryCode} ${r.assetType} ${r.entity}`}
        searchPlaceholder="Search Rule ID, Country"
        groupOptions={["country", "asset", "entity"]}
        defaultViews={[
          { name: "Europe Equities", filters: { region: "Europe", asset: "Equity" }, groupBy: null },
          { name: "APAC", filters: { region: "APAC" }, groupBy: "country" },
        ]}
        initialOpenId={openId}
        primaryAction={isMaker ? { label: "Create Rule", onClick: () => setForm({ mode: "create" }) } : undefined}
        bulkActions={isMaker ? [{ label: "Deactivate", onClick: (ids) => deactivateRules(ids) }] : []}
        hoverActions={
          isMaker
            ? [
                { label: "Edit", icon: Icons.pencil(), onClick: (r) => setForm({ mode: "edit", rule: r }) },
                { label: "Deactivate", icon: Icons.off(), onClick: (r) => deactivateRules([r.id]), show: (r) => r.active },
              ]
            : []
        }
        dimRow={(r) => !r.active}
        rowFlag={(r) =>
          r.isNew ? <span className="dca-newdot" title="Landed in production this session" /> : null
        }
        drawerTitle={(r) => (
          <span className="dca-mono">
            {r.id} <span className="dca-muted font-normal">· {r.country} / {r.assetType}</span>
          </span>
        )}
        drawer={(r) => (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={r.active ? "Active" : "Inactive"} />
              {r.isNew && <span className="dca-accent-text text-[11px] font-medium">Updated this session</span>}
              {isMaker && (
                <span className="ml-auto">
                  <Btn small onClick={() => setForm({ mode: "edit", rule: r })}>
                    {Icons.pencil()} Edit
                  </Btn>
                </span>
              )}
            </div>
            <DL
              rows={[
                { label: "Country", value: `${r.country} (${r.countryCode})` },
                { label: "Asset Type", value: r.assetType },
                { label: "Business Entity", value: r.entity },
                { label: "Effective Date", value: <span className="dca-mono">{r.effectiveDate}</span> },
                { label: "Key Date Type", value: r.keyDateType },
                { label: "Position Entitlement Basis", value: r.basis },
                { label: "Claim Entitlement Period", value: <span className="dca-mono">{r.entitlementPeriod}</span> },
                { label: "Claim Generation Date", value: <span className="dca-mono">{r.generationDate}</span> },
                { label: "Claim Transmission", value: <span className="dca-mono">{r.transmission}</span> },
                { label: "Settlement Date Condition", value: <span className="dca-mono">{r.sdCondition || "N/A"}</span> },
                { label: "Trade Date Condition", value: <span className="dca-mono">{r.tdCondition || "N/A"}</span> },
              ]}
            />
            <p className="dca-faint text-[11px]">
              Edits are locked to calculation fields; scope (country / asset type / entity) cannot change after
              creation.
            </p>
            <Btn small onClick={() => navigate({ screen: "events" })}>
              View dividend events {Icons.chevronRight("h-3 w-3")}
            </Btn>
          </div>
        )}
        emptyText="No rules match"
      />
      {form && <RuleForm mode={form.mode} original={form.rule} onClose={() => setForm(null)} />}
    </>
  );
}

/* =================================================================== */
/* Trade Action Rules / Tax Markers (thin screens, same pipeline)      */
/* =================================================================== */

export function TradeActionsScreen({ openId }: { openId?: string }) {
  const { taRules, role } = useDca();
  const [edit, setEdit] = useState<TradeActionRule | null>(null);
  const isMaker = role === "Maker";

  const columns: Col<TradeActionRule>[] = [
    { key: "id", label: "Rule ID", get: (r) => r.id, mono: true },
    { key: "market", label: "Market Key", get: (r) => r.marketKey, mono: true },
    { key: "asset", label: "Asset Type", get: (r) => r.assetType },
    {
      key: "active",
      label: "Active",
      get: (r) => (r.active ? "Active" : "Inactive"),
      render: (r) => <StatusBadge status={r.active ? "Active" : "Inactive"} />,
    },
    { key: "status", label: "Trade Status", get: (r) => r.tradeStatus, exception: true },
    { key: "sdt", label: "Settlement Date Type", get: (r) => r.settlementDateType, exception: true },
    { key: "tt", label: "Trade Timing", get: (r) => r.tradeTiming, mono: true },
    { key: "st", label: "Settlement Timing", get: (r) => r.settlementTiming, mono: true, exception: true },
  ];

  return (
    <>
      <ScreenHead title="Trade Action Rules" sub="How trades qualify positions for entitlement." />
      <DataTable<TradeActionRule>
        id="ta-rules"
        rows={taRules}
        rowId={(r) => r.id}
        columns={columns}
        filters={[
          { key: "asset", label: "Asset Type", get: (r) => r.assetType, primary: true },
          { key: "active", label: "Active", get: (r) => (r.active ? "Active" : "Inactive"), primary: true },
          { key: "sdt", label: "Settlement Date Type", get: (r) => r.settlementDateType },
        ]}
        searchText={(r) => `${r.id} ${r.marketKey}`}
        searchPlaceholder="Search Rule ID, Market"
        initialOpenId={openId}
        hoverActions={isMaker ? [{ label: "Edit", icon: Icons.pencil(), onClick: (r) => setEdit(r) }] : []}
        dimRow={(r) => !r.active}
        drawerTitle={(r) => <span className="dca-mono">{r.id}</span>}
        drawer={(r) => (
          <div className="space-y-4">
            {isMaker && (
              <Btn small onClick={() => setEdit(r)}>
                {Icons.pencil()} Edit
              </Btn>
            )}
            <DL
              rows={[
                { label: "Market Key", value: <span className="dca-mono">{r.marketKey}</span> },
                { label: "Asset Type", value: r.assetType },
                { label: "Active", value: <StatusBadge status={r.active ? "Active" : "Inactive"} /> },
                { label: "Trade Status", value: r.tradeStatus },
                { label: "Settlement Date Type", value: r.settlementDateType },
                { label: "Trade Timing", value: <span className="dca-mono">{r.tradeTiming}</span> },
                { label: "Settlement Timing", value: <span className="dca-mono">{r.settlementTiming}</span> },
              ]}
            />
          </div>
        )}
      />
      {edit && (
        <SimpleEditForm
          title={`Edit ${edit.id} — ${edit.marketKey}`}
          requestType="Trade Action Rule"
          entity="ta"
          targetId={edit.id}
          original={{ ...edit }}
          onClose={() => setEdit(null)}
          fields={[
            { key: "marketKey", label: "Market Key", type: "text", locked: true },
            { key: "assetType", label: "Asset Type", type: "text", locked: true },
            { key: "tradeStatus", label: "Trade Status", type: "select", options: ["Settled", "Open"] },
            { key: "settlementDateType", label: "Settlement Date Type", type: "select", options: ["Actual", "Contractual"] },
            { key: "tradeTiming", label: "Trade Timing", type: "select", options: ["T", "T+1"] },
            { key: "settlementTiming", label: "Settlement Timing", type: "select", options: ["T+1", "T+2", "T+3"] },
          ]}
        />
      )}
    </>
  );
}

export function TaxMarkersScreen({ openId }: { openId?: string }) {
  const { taxMarkers, role } = useDca();
  const [edit, setEdit] = useState<TaxMarker | null>(null);
  const isMaker = role === "Maker";

  const columns: Col<TaxMarker>[] = [
    { key: "id", label: "Marker ID", get: (r) => r.id, mono: true },
    { key: "country", label: "Country", get: (r) => r.country },
    { key: "type", label: "Tax Type", get: (r) => r.taxType },
    { key: "rate", label: "Rate %", get: (r) => r.ratePct, align: "right", mono: true },
    { key: "code", label: "Marker Code", get: (r) => r.markerCode, mono: true },
    {
      key: "active",
      label: "Active",
      get: (r) => (r.active ? "Active" : "Inactive"),
      render: (r) => <StatusBadge status={r.active ? "Active" : "Inactive"} />,
    },
  ];

  return (
    <>
      <ScreenHead title="Tax Markers" sub="Withholding rates applied when computing net entitlements." />
      <DataTable<TaxMarker>
        id="tax-markers"
        rows={taxMarkers}
        rowId={(r) => r.id}
        columns={columns}
        filters={[
          { key: "country", label: "Country", get: (r) => r.country, primary: true },
          { key: "active", label: "Active", get: (r) => (r.active ? "Active" : "Inactive"), primary: true },
        ]}
        searchText={(r) => `${r.id} ${r.country} ${r.markerCode}`}
        searchPlaceholder="Search Marker, Country"
        initialOpenId={openId}
        hoverActions={isMaker ? [{ label: "Edit", icon: Icons.pencil(), onClick: (r) => setEdit(r) }] : []}
        dimRow={(r) => !r.active}
        drawerTitle={(r) => <span className="dca-mono">{r.id}</span>}
        drawer={(r) => (
          <div className="space-y-4">
            {isMaker && (
              <Btn small onClick={() => setEdit(r)}>
                {Icons.pencil()} Edit
              </Btn>
            )}
            <DL
              rows={[
                { label: "Country", value: r.country },
                { label: "Tax Type", value: r.taxType },
                { label: "Rate %", value: <span className="dca-mono">{r.ratePct}%</span> },
                { label: "Marker Code", value: <span className="dca-mono">{r.markerCode}</span> },
                { label: "Active", value: <StatusBadge status={r.active ? "Active" : "Inactive"} /> },
              ]}
            />
          </div>
        )}
      />
      {edit && (
        <SimpleEditForm
          title={`Edit ${edit.id} — ${edit.country}`}
          requestType="Tax Marker"
          entity="tm"
          targetId={edit.id}
          original={{ ...edit }}
          onClose={() => setEdit(null)}
          fields={[
            { key: "country", label: "Country", type: "text", locked: true },
            { key: "taxType", label: "Tax Type", type: "text", locked: true },
            { key: "ratePct", label: "Rate %", type: "number" },
            { key: "markerCode", label: "Marker Code", type: "text" },
          ]}
        />
      )}
    </>
  );
}

/* =================================================================== */
/* Requests: shared drawer body                                        */
/* =================================================================== */

function RequestDrawerBody({
  req,
  context,
  onRevise,
}: {
  req: WfRequest;
  context: "mine" | "approve";
  onRevise?: (req: WfRequest) => void;
}) {
  const { role, userName, approveRequest, rejectRequest, navigate } = useDca();
  const [rejecting, setRejecting] = useState(false);
  const [rejectText, setRejectText] = useState("");
  const pending = req.status === "Submitted" || req.status === "In Review";
  const selfApproval = req.submittedBy === userName;

  return (
    <div className="space-y-5">
      <div className="dca-panel px-3 py-4">
        <RequestStepper req={req} />
      </div>

      {req.status === "Rejected" && req.rejectionReason && (
        <div className="dca-reject px-3 py-2.5">
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide">Rejected — reason</p>
          <p className="text-[13px]">{req.rejectionReason}</p>
          {context === "mine" && role === "Maker" && req.type === "Dividend Claim Rule" && onRevise && (
            <Btn small kind="danger" onClick={() => onRevise(req)}>
              Revise &amp; Resubmit
            </Btn>
          )}
        </div>
      )}

      <DL
        rows={[
          { label: "Type", value: req.type },
          {
            label: "Target",
            value:
              req.targetId && req.type === "Dividend Claim Rule" ? (
                <button
                  type="button"
                  className="dca-accent-text dca-mono inline-flex items-center gap-1 underline underline-offset-2"
                  onClick={() => navigate({ screen: "rules", openId: req.targetId! })}
                >
                  {req.targetId} {Icons.link()}
                </button>
              ) : (
                <span className="dca-mono">{req.targetLabel}</span>
              ),
          },
          { label: "Submitted by", value: req.submittedBy },
          { label: "Submitted", value: <span className="dca-mono">{req.submittedAt}</span> },
          {
            label: "Current assignee",
            value: pending && req.assignee ? `Waiting on: ${req.assignee} (Approver)` : "—",
          },
          { label: "Last updated", value: <span className="dca-mono">{req.updatedAt}</span> },
        ]}
      />

      <div>
        <p className="dca-muted mb-1.5 text-[11px] font-semibold uppercase tracking-wide">Requested change</p>
        <DiffView changes={req.changes} createMode={req.targetId === null} />
      </div>

      <div className="dca-panel p-3">
        <p className="dca-muted mb-1 text-[11px] font-semibold uppercase tracking-wide">Reason for change</p>
        <p className="text-[13px]">{req.reason}</p>
      </div>

      {context === "approve" && pending && (
        <div className="dca-panel space-y-2.5 p-3">
          <p className="dca-muted text-[11px] font-semibold uppercase tracking-wide">Decision</p>
          {selfApproval && (
            <p className="dca-warn px-2.5 py-1.5 text-[12px]">You cannot approve your own request.</p>
          )}
          <div className="flex items-center gap-2">
            <Btn
              kind="primary"
              disabled={selfApproval}
              title={selfApproval ? "You cannot approve your own request." : undefined}
              onClick={() => approveRequest(req.id)}
            >
              {Icons.check()} Approve
            </Btn>
            <Btn
              kind="danger"
              disabled={selfApproval}
              title={selfApproval ? "You cannot approve your own request." : undefined}
              onClick={() => setRejecting((x) => !x)}
            >
              Reject…
            </Btn>
          </div>
          {rejecting && !selfApproval && (
            <div className="space-y-2">
              <textarea
                className="dca-input min-h-16 w-full py-1.5"
                placeholder="Rejection reason (required)"
                value={rejectText}
                onChange={(e) => setRejectText(e.target.value)}
              />
              <Btn
                kind="danger"
                disabled={!rejectText.trim()}
                onClick={() => {
                  rejectRequest(req.id, rejectText.trim());
                  setRejecting(false);
                  setRejectText("");
                }}
              >
                Confirm rejection
              </Btn>
            </div>
          )}
        </div>
      )}

      <div>
        <p className="dca-muted mb-1.5 text-[11px] font-semibold uppercase tracking-wide">Timeline</p>
        <Timeline req={req} />
      </div>
    </div>
  );
}

/* =================================================================== */
/* My Requests                                                         */
/* =================================================================== */

export function MyRequestsScreen({ openId, statusFilter }: { openId?: string; statusFilter?: string }) {
  const { requests, userName, rules } = useDca();
  const [revise, setRevise] = useState<{ rule?: Rule; prefill: Partial<RuleValues> } | null>(null);
  const mine = requests.filter((r) => r.submittedBy === userName);

  const columns: Col<WfRequest>[] = [
    { key: "id", label: "Request ID", get: (r) => r.id, mono: true },
    { key: "type", label: "Type", get: (r) => r.type },
    { key: "target", label: "Target", get: (r) => r.targetLabel, mono: true },
    {
      key: "status",
      label: "Status",
      get: (r) => r.status,
      render: (r) => (
        <span className="block">
          <StatusBadge status={r.status} />
          {r.status === "Rejected" && r.rejectionReason && (
            <span className="dca-faint mt-0.5 block max-w-56 truncate text-[11px]">{r.rejectionReason}</span>
          )}
        </span>
      ),
    },
    { key: "submitted", label: "Submitted", get: (r) => r.submittedAt, mono: true },
    {
      key: "assignee",
      label: "Current assignee",
      get: (r) =>
        r.status === "Submitted" || r.status === "In Review" ? `Waiting on: ${r.assignee} (Approver)` : "—",
    },
    { key: "updated", label: "Last updated", get: (r) => r.updatedAt, mono: true },
  ];

  const onRevise = (req: WfRequest) => {
    const rule = req.targetId ? rules.find((r) => r.id === req.targetId) : undefined;
    setRevise({ rule, prefill: req.payload.values as Partial<RuleValues> });
  };

  return (
    <>
      <ScreenHead title="My Requests" sub="Everything you have submitted through the approval pipeline." />
      {mine.length === 0 ? (
        <Empty text="You have no requests" sub="Create or edit a rule to submit your first request." />
      ) : (
        <DataTable<WfRequest>
          id="my-requests"
          rows={mine}
          rowId={(r) => r.id}
          columns={columns}
          filters={[
            { key: "status", label: "Status", get: (r) => r.status, primary: true },
            { key: "type", label: "Type", get: (r) => r.type, primary: true },
          ]}
          searchText={(r) => `${r.id} ${r.type} ${r.targetLabel} ${r.reason}`}
          searchPlaceholder="Search Request ID, Target"
          initialFilters={statusFilter ? { status: statusFilter } : undefined}
          initialOpenId={openId}
          drawerTitle={(r) => (
            <span className="dca-mono">
              {r.id} <span className="dca-muted font-normal">· {r.type}</span>
            </span>
          )}
          drawer={(r) => <RequestDrawerBody key={r.id} req={r} context="mine" onRevise={onRevise} />}
          emptyText="No requests match"
        />
      )}
      {revise && (
        <RuleForm
          mode={revise.rule ? "edit" : "create"}
          original={revise.rule}
          prefill={revise.prefill}
          onClose={() => setRevise(null)}
        />
      )}
    </>
  );
}

/* =================================================================== */
/* Approvals (Approver role only)                                      */
/* =================================================================== */

export function ApprovalsScreen({ openId }: { openId?: string }) {
  const { requests } = useDca();
  const queueOf = (r: WfRequest) =>
    r.status === "Submitted" || r.status === "In Review" ? "Pending" : r.status;

  const columns: Col<WfRequest>[] = [
    { key: "id", label: "Request ID", get: (r) => r.id, mono: true },
    { key: "type", label: "Type", get: (r) => r.type },
    { key: "target", label: "Target", get: (r) => r.targetLabel, mono: true },
    { key: "by", label: "Submitted by", get: (r) => r.submittedBy },
    { key: "status", label: "Status", get: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: "submitted", label: "Submitted", get: (r) => r.submittedAt, mono: true },
    { key: "updated", label: "Last updated", get: (r) => r.updatedAt, mono: true },
  ];

  const visible = requests.filter((r) => r.status !== "Draft");

  return (
    <>
      <ScreenHead
        title="Approvals"
        sub="Approvals are item-by-item by policy — review each request before deciding."
      />
      <DataTable<WfRequest>
        id="approvals"
        rows={visible}
        rowId={(r) => r.id}
        columns={columns}
        filters={[
          { key: "queue", label: "Queue", get: queueOf, primary: true },
          { key: "type", label: "Type", get: (r) => r.type, primary: true },
          { key: "by", label: "Submitted by", get: (r) => r.submittedBy },
        ]}
        searchText={(r) => `${r.id} ${r.type} ${r.targetLabel} ${r.submittedBy}`}
        searchPlaceholder="Search Request ID, Submitter"
        initialFilters={{ queue: "Pending" }}
        initialOpenId={openId}
        drawerTitle={(r) => (
          <span className="dca-mono">
            {r.id} <span className="dca-muted font-normal">· by {r.submittedBy}</span>
          </span>
        )}
        drawer={(r) => <RequestDrawerBody key={r.id} req={r} context="approve" />}
        emptyText="No requests waiting for you"
        emptySub="New submissions will appear here automatically."
      />
    </>
  );
}

/* =================================================================== */
/* Dividend Events                                                     */
/* =================================================================== */

export function EventsScreen({ openId }: { openId?: string }) {
  const { events, rules, entitlements, navigate } = useDca();

  const matchedRule = (e: DivEvent) =>
    rules.find((r) => r.country === e.country && r.assetType === "Equity" && r.active);

  const columns: Col<DivEvent>[] = [
    { key: "id", label: "Event ID", get: (r) => r.id, mono: true },
    {
      key: "sec",
      label: "Security",
      get: (r) => `${r.ticker} ${r.security}`,
      render: (r) => (
        <span>
          <span className="dca-mono dca-accent-text font-semibold">{r.ticker}</span>
          <span className="dca-muted"> · {r.security}</span>
        </span>
      ),
    },
    { key: "country", label: "Country", get: (r) => r.country },
    { key: "type", label: "Event Type", get: (r) => r.eventType },
    {
      key: "ex",
      label: "Ex Date",
      get: (r) => r.exDate,
      mono: true,
      render: (r) => (
        <span className={`dca-mono ${r.exDate === TODAY ? "dca-accent-text font-semibold" : ""}`}>
          {r.exDate}
          {r.exDate === TODAY ? " · today" : ""}
        </span>
      ),
    },
    { key: "rd", label: "Record Date", get: (r) => r.recordDate, mono: true },
    { key: "pd", label: "Pay Date", get: (r) => r.payDate, mono: true },
    { key: "rate", label: "Gross Rate", get: (r) => r.grossRate, align: "right", mono: true },
    { key: "ccy", label: "Ccy", get: (r) => r.currency, mono: true },
    { key: "status", label: "Status", get: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <ScreenHead title="Dividend Events" sub="Announced events feeding entitlement calculation." />
      <DataTable<DivEvent>
        id="events"
        rows={events}
        rowId={(r) => r.id}
        columns={columns}
        filters={[
          { key: "country", label: "Country", get: (r) => r.country, primary: true },
          { key: "status", label: "Status", get: (r) => r.status, primary: true },
          { key: "ccy", label: "Currency", get: (r) => r.currency },
        ]}
        searchText={(r) => `${r.id} ${r.ticker} ${r.security} ${r.country}`}
        searchPlaceholder="Search Event, Ticker"
        groupOptions={["country", "status"]}
        initialOpenId={openId}
        drawerTitle={(r) => (
          <span>
            <span className="dca-mono">{r.id}</span>
            <span className="dca-muted font-normal"> · {r.ticker}</span>
          </span>
        )}
        drawer={(r) => {
          const rule = matchedRule(r);
          const entCount = entitlements.filter((x) => x.eventId === r.id).length;
          return (
            <div className="space-y-4">
              <StatusBadge status={r.status} />
              <DL
                rows={[
                  { label: "Security", value: `${r.ticker} · ${r.security}` },
                  { label: "Country", value: r.country },
                  { label: "Event Type", value: r.eventType },
                  { label: "Ex Date", value: <span className="dca-mono">{r.exDate}</span> },
                  { label: "Record Date", value: <span className="dca-mono">{r.recordDate}</span> },
                  { label: "Pay Date", value: <span className="dca-mono">{r.payDate}</span> },
                  { label: "Gross Rate", value: <span className="dca-mono">{r.grossRate} {r.currency}</span> },
                ]}
              />
              <div className="dca-panel p-3">
                <p className="dca-muted mb-1.5 text-[11px] font-semibold uppercase tracking-wide">Applied rule</p>
                {rule ? (
                  <button
                    type="button"
                    className="dca-accent-text dca-mono inline-flex items-center gap-1 text-[13px] underline underline-offset-2"
                    onClick={() => navigate({ screen: "rules", openId: rule.id })}
                  >
                    {rule.id} {Icons.link()}
                  </button>
                ) : (
                  <p className="dca-faint text-[12px]">No active rule matches this market — create one.</p>
                )}
                {rule && (
                  <p className="dca-muted mt-1 text-[12px]">
                    {rule.country} / {rule.assetType} / {rule.entity} · entitlement {rule.entitlementPeriod}, generation{" "}
                    {rule.generationDate}, transmit {rule.transmission}
                  </p>
                )}
              </div>
              <Btn small kind="primary" onClick={() => navigate({ screen: "entitlements", eventId: r.id })}>
                View entitlements for this event ({entCount}) {Icons.chevronRight("h-3 w-3")}
              </Btn>
            </div>
          );
        }}
      />
    </>
  );
}

/* =================================================================== */
/* Trade Entitlements                                                  */
/* =================================================================== */

export function EntitlementsScreen({ eventId, openId }: { eventId?: string; openId?: string }) {
  const { entitlements, taxMarkers, navigate } = useDca();

  const gross = (e: Entitlement) => e.qty * e.grossRate;
  const tax = (e: Entitlement) => (gross(e) * e.taxRatePct) / 100;
  const net = (e: Entitlement) => gross(e) - tax(e);

  const columns: Col<Entitlement>[] = [
    { key: "id", label: "ID", get: (r) => r.id, mono: true },
    { key: "event", label: "Event", get: (r) => r.eventId, mono: true },
    { key: "client", label: "Client", get: (r) => r.client },
    { key: "account", label: "Account", get: (r) => r.account, mono: true },
    { key: "sec", label: "Security", get: (r) => r.security },
    { key: "qty", label: "Holding Qty", get: (r) => r.qty, align: "right", mono: true, render: (r) => <>{fmtQty(r.qty)}</> },
    { key: "rate", label: "Gross Rate", get: (r) => r.grossRate, align: "right", mono: true },
    { key: "gross", label: "Gross Amount", get: (r) => gross(r).toFixed(2), align: "right", mono: true, render: (r) => <>{fmtMoney(gross(r))}</> },
    { key: "taxr", label: "Tax %", get: (r) => r.taxRatePct, align: "right", mono: true },
    { key: "net", label: "Net Amount", get: (r) => net(r).toFixed(2), align: "right", mono: true, render: (r) => <>{fmtMoney(net(r))}</> },
    { key: "basis", label: "Basis", get: (r) => r.basis, exception: true },
  ];

  return (
    <>
      <ScreenHead title="Trade Entitlements" sub="Client-level entitlements computed per event." />
      <DataTable<Entitlement>
        id="entitlements"
        rows={entitlements}
        rowId={(r) => r.id}
        columns={columns}
        filters={[
          { key: "event", label: "Event", get: (r) => r.eventId, primary: true },
          { key: "client", label: "Client", get: (r) => r.client, primary: true },
          { key: "basis", label: "Basis", get: (r) => r.basis },
        ]}
        searchText={(r) => `${r.id} ${r.eventId} ${r.client} ${r.account} ${r.security}`}
        searchPlaceholder="Search Client, Event, Account"
        groupOptions={["event", "client"]}
        initialFilters={eventId ? { event: eventId } : undefined}
        initialOpenId={openId}
        drawerTitle={(r) => (
          <span className="dca-mono">
            {r.id} <span className="dca-muted font-normal">· {r.client}</span>
          </span>
        )}
        drawer={(r) => {
          const marker = taxMarkers.find((t) => t.id === r.taxMarkerId);
          return (
            <div className="space-y-4">
              <DL
                rows={[
                  { label: "Client", value: r.client },
                  { label: "Account", value: <span className="dca-mono">{r.account}</span> },
                  { label: "Security", value: r.security },
                  {
                    label: "Event",
                    value: (
                      <button
                        type="button"
                        className="dca-accent-text dca-mono inline-flex items-center gap-1 underline underline-offset-2"
                        onClick={() => navigate({ screen: "events", openId: r.eventId })}
                      >
                        {r.eventId} {Icons.link()}
                      </button>
                    ),
                  },
                  { label: "Position Basis", value: r.basis },
                ]}
              />
              <div className="dca-panel p-3">
                <p className="dca-muted mb-2 text-[11px] font-semibold uppercase tracking-wide">
                  Calculation breakdown
                </p>
                <div className="dca-mono space-y-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <span className="dca-muted">
                      {fmtQty(r.qty)} × {r.grossRate}
                    </span>
                    <span>= {fmtMoney(gross(r))} gross</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="dca-muted">
                      − tax {r.taxRatePct}% ({marker?.markerCode})
                    </span>
                    <span className="dca-red-text">− {fmtMoney(tax(r))}</span>
                  </div>
                  <div className="dca-total flex justify-between pt-1.5 font-semibold">
                    <span>Net entitlement</span>
                    <span>{fmtMoney(net(r))}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {marker && (
                  <Btn small onClick={() => navigate({ screen: "taxMarkers", openId: marker.id })}>
                    Tax marker {marker.id} {Icons.chevronRight("h-3 w-3")}
                  </Btn>
                )}
                <Btn small onClick={() => navigate({ screen: "rules", openId: r.ruleId })}>
                  Dates from rule {r.ruleId} {Icons.chevronRight("h-3 w-3")}
                </Btn>
              </div>
            </div>
          );
        }}
      />
    </>
  );
}

/* =================================================================== */
/* Dividend Claims                                                     */
/* =================================================================== */

function ResolveBox({ claimId, onDone }: { claimId: string; onDone: () => void }) {
  const { resolveClaim } = useDca();
  const [comment, setComment] = useState("");
  return (
    <div className="dca-panel space-y-2 p-3">
      <p className="dca-muted text-[11px] font-semibold uppercase tracking-wide">Resolve</p>
      <textarea
        className="dca-input min-h-14 w-full py-1.5"
        placeholder="Resolution comment (required)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Btn
        kind="primary"
        disabled={!comment.trim()}
        onClick={() => {
          resolveClaim(claimId, comment.trim());
          onDone();
        }}
      >
        {Icons.check()} Mark resolved
      </Btn>
    </div>
  );
}

export function ClaimsScreen({ statusFilter, openId }: { statusFilter?: string; openId?: string }) {
  const { claims, events, role, navigate } = useDca();

  const diff = (c: Claim) => c.received - c.expected;

  const columns: Col<Claim>[] = [
    { key: "id", label: "Claim ID", get: (r) => r.id, mono: true },
    { key: "event", label: "Event", get: (r) => r.eventId, mono: true },
    { key: "client", label: "Client", get: (r) => r.client },
    { key: "exp", label: "Expected", get: (r) => r.expected.toFixed(2), align: "right", mono: true, render: (r) => <>{fmtMoney(r.expected)}</> },
    { key: "rec", label: "Received", get: (r) => r.received.toFixed(2), align: "right", mono: true, render: (r) => <>{fmtMoney(r.received)}</> },
    {
      key: "diff",
      label: "Difference",
      get: (r) => diff(r).toFixed(2),
      align: "right",
      mono: true,
      render: (r) =>
        diff(r) === 0 ? (
          <span className="dca-faint">0.00</span>
        ) : (
          <span className="dca-red-text font-semibold">
            {diff(r) > 0 ? "▲" : "▼"} {fmtMoney(Math.abs(diff(r)))}
          </span>
        ),
    },
    { key: "status", label: "Status", get: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];

  const defaultFilter = statusFilter ?? (role === "Operations" ? "Discrepancy" : undefined);

  return (
    <>
      <ScreenHead title="Dividend Claims" sub="Settlement verification — expected vs received per claim." />
      <DataTable<Claim>
        id="claims"
        rows={claims}
        rowId={(r) => r.id}
        columns={columns}
        filters={[
          { key: "status", label: "Status", get: (r) => r.status, primary: true },
          { key: "client", label: "Client", get: (r) => r.client, primary: true },
          { key: "event", label: "Event", get: (r) => r.eventId },
        ]}
        searchText={(r) => `${r.id} ${r.eventId} ${r.client}`}
        searchPlaceholder="Search Claim, Client"
        groupOptions={["status", "client"]}
        initialFilters={defaultFilter ? { status: defaultFilter } : undefined}
        initialOpenId={openId}
        drawerTitle={(r) => (
          <span className="dca-mono">
            {r.id} <span className="dca-muted font-normal">· {r.client}</span>
          </span>
        )}
        drawer={(r, close) => {
          const ev = events.find((e) => e.id === r.eventId);
          return (
            <div className="space-y-4" key={r.id}>
              <StatusBadge status={r.status} />
              <DL
                rows={[
                  { label: "Client", value: r.client },
                  {
                    label: "Event",
                    value: (
                      <button
                        type="button"
                        className="dca-accent-text dca-mono inline-flex items-center gap-1 underline underline-offset-2"
                        onClick={() => navigate({ screen: "events", openId: r.eventId })}
                      >
                        {r.eventId} {Icons.link()}
                      </button>
                    ),
                  },
                  { label: "Security", value: ev ? `${ev.ticker} · ${ev.security}` : "—" },
                  { label: "Pay Date", value: <span className="dca-mono">{ev?.payDate ?? "—"}</span> },
                ]}
              />
              <div className="dca-panel p-3">
                <p className="dca-muted mb-2 text-[11px] font-semibold uppercase tracking-wide">
                  Expected vs received
                </p>
                <div className="dca-mono space-y-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <span className="dca-muted">Expected</span>
                    <span>{fmtMoney(r.expected)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="dca-muted">Received</span>
                    <span>{fmtMoney(r.received)}</span>
                  </div>
                  <div className="dca-total flex justify-between pt-1.5 font-semibold">
                    <span>Difference</span>
                    <span className={diff(r) === 0 ? "" : "dca-red-text"}>
                      {diff(r) === 0 ? "0.00" : `${diff(r) > 0 ? "▲" : "▼"} ${fmtMoney(Math.abs(diff(r)))}`}
                    </span>
                  </div>
                </div>
              </div>
              {r.resolvedComment && (
                <div className="dca-panel p-3">
                  <p className="dca-muted mb-1 text-[11px] font-semibold uppercase tracking-wide">Resolution note</p>
                  <p className="text-[13px]">{r.resolvedComment}</p>
                </div>
              )}
              {r.status !== "Matched" && <ResolveBox key={r.id} claimId={r.id} onDone={close} />}
            </div>
          );
        }}
      />
    </>
  );
}

/* =================================================================== */
/* shared screen header                                                */
/* =================================================================== */

function ScreenHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-3">
      <h1 className="text-base font-semibold">{title}</h1>
      <p className="dca-muted text-[12px]">{sub}</p>
    </div>
  );
}
