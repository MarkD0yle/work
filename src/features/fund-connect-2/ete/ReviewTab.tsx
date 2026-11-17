import { userName } from "../lib/engine";
import { useEte } from "./ete-context";
import { countBySeverity, newOrderTypeLines, type OrderTypeChange, type OrderTypeChangeKind } from "./engine";
import { latestConfig } from "./model";
import { btn, cx, eyebrow, muted, type Tone } from "./styles";
import { Badge, EmptyNote } from "./ui";

/* Validation and Review — everything a submitter checks before sending the
 * change, and everything an approver reads before deciding: what is wrong,
 * what is questionable, which fields moved (before and after), and what
 * happened to each Order Type. Every row links back to where it lives. */

const KIND: Record<OrderTypeChangeKind, { label: string; tone: Tone }> = {
  added: { label: "Added", tone: "good" },
  edited: { label: "Edited", tone: "warn" },
  enabled: { label: "Enabled", tone: "good" },
  disabled: { label: "Disabled", tone: "neutral" },
  removed: { label: "Removed", tone: "bad" },
};

function Tile({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="border border-neutral-200 bg-white px-3 py-2">
      <div className={eyebrow}>{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-neutral-900 tabular-nums">{value}</div>
      <div className="text-[11px] text-neutral-500">{note}</div>
    </div>
  );
}

export function ReviewTab() {
  const { fund, pendingIssues, diff, goTo } = useEte();
  const pending = fund.pending;

  const history = (
    <section className="border border-neutral-200 bg-white">
      <h2 className="border-b border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-900">Activity</h2>
      <ol className="divide-y divide-neutral-100">
        {fund.history.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2 text-xs">
            <span className="font-medium text-neutral-900">{e.title}</span>
            <span className="text-neutral-500">{userName(e.actor)}</span>
            <span className="ml-auto text-[11px] text-neutral-500 tabular-nums">{e.at}</span>
            {e.detail && <span className="w-full text-neutral-600">{e.detail}</span>}
          </li>
        ))}
      </ol>
    </section>
  );

  if (!pending) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="border border-neutral-200 bg-white">
          <EmptyNote title="Nothing to review">Active version {fund.activeVersion} is in use and no change is pending. Choose Modify configuration to start one.</EmptyNote>
        </div>
        <div className="mt-4">{history}</div>
      </div>
    );
  }

  const errors = pendingIssues.filter((i) => i.severity === "error");
  const warnings = pendingIssues.filter((i) => i.severity === "warning");
  const counts = countBySeverity(pendingIssues);

  // A new fund has no earlier version: every Order Type counts as added.
  const orderTypeChanges: OrderTypeChange[] = diff
    ? diff.orderTypes
    : latestConfig(fund).orderTypes.map((o) => ({ id: o.id, name: o.name || "Unnamed Order Type", kind: "added", lines: newOrderTypeLines(o) }));
  const fieldChanges = diff?.fields ?? [];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Errors" value={counts.errors} note={counts.errors ? "Must be fixed to submit" : "None. Ready to submit"} />
        <Tile label="Warnings" value={counts.warnings} note={counts.warnings ? "Allowed, worth a second look" : "None"} />
        <Tile label="Modified fields" value={fieldChanges.length} note={diff ? `Against active version ${fund.activeVersion}` : "New fund, nothing to compare"} />
        <Tile label="Order Type changes" value={orderTypeChanges.length} note="Added, edited, enabled, disabled" />
      </div>

      <section className="mt-4 border border-neutral-200 bg-white">
        <h2 className="border-b border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-900">Validation</h2>
        {pendingIssues.length === 0 ? (
          <p className={cx("px-4 py-4", muted)}>No errors and no warnings.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {[...errors, ...warnings].map((i) => (
              <li key={i.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2.5">
                <span className="w-16 shrink-0 pt-0.5">
                  <Badge tone={i.severity === "error" ? "bad" : "warn"}>{i.severity === "error" ? "Error" : "Warning"}</Badge>
                </span>
                <span className="min-w-0 flex-1 text-xs">
                  <span className="block text-[11px] text-neutral-500">{i.where}</span>
                  <span className="text-neutral-900">{i.message}</span>
                </span>
                <button type="button" onClick={() => goTo(i.target)} className={btn.link}>
                  Go to field
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 border border-neutral-200 bg-white">
        <h2 className="border-b border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-900">Modified fields</h2>
        {!diff ? (
          <p className={cx("px-4 py-4", muted)}>This is a new fund. There is no active version to compare with, so every value is new.</p>
        ) : fieldChanges.length === 0 ? (
          <p className={cx("px-4 py-4", muted)}>No fund-level field differs from active version {fund.activeVersion}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  {["Field", `Before (active version ${fund.activeVersion})`, "After (pending change)", ""].map((h) => (
                    <th key={h} scope="col" className={cx("px-4 py-2", eyebrow)}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fieldChanges.map((c) => (
                  <tr key={`${c.area}-${c.label}`} className="border-b border-neutral-100 align-top last:border-b-0">
                    <th scope="row" className="px-4 py-2 font-normal">
                      <span className="block text-[11px] text-neutral-500">{c.area}</span>
                      <span className="font-medium text-neutral-900">{c.label}</span>
                    </th>
                    <td className="px-4 py-2 text-neutral-500 line-through">{c.before}</td>
                    <td className="px-4 py-2 font-medium text-neutral-900">{c.after}</td>
                    <td className="px-4 py-2 text-right">
                      <button type="button" onClick={() => goTo(c.target)} className={btn.link}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-4 border border-neutral-200 bg-white">
        <h2 className="border-b border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-900">Order Type changes</h2>
        {orderTypeChanges.length === 0 ? (
          <p className={cx("px-4 py-4", muted)}>No Order Type was added, edited, enabled or disabled.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {orderTypeChanges.map((c) => (
              <li key={`${c.id}-${c.kind}`} className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={KIND[c.kind].tone}>{KIND[c.kind].label}</Badge>
                  <span className="text-xs font-semibold text-neutral-900">{c.name}</span>
                  {c.kind === "disabled" && <span className={muted}>Configuration kept, can be enabled again.</span>}
                  {c.kind !== "removed" && (
                    <button type="button" onClick={() => goTo({ tab: "order-types", orderTypeId: c.id })} className={cx(btn.link, "ml-auto")}>
                      Open
                    </button>
                  )}
                </div>
                {c.lines.length > 0 && (
                  <ul className="mt-1.5 grid grid-cols-1 gap-x-6 gap-y-0.5 lg:grid-cols-2">
                    {c.lines.map((l) => (
                      <li key={l.label} className="text-xs text-neutral-700">
                        <span className="text-neutral-500">{l.label}: </span>
                        {l.before && (
                          <>
                            <span className="text-neutral-500 line-through">{l.before}</span>
                            <span aria-hidden> → </span>
                            <span className="sr-only"> changed to </span>
                          </>
                        )}
                        <span className="font-medium text-neutral-900">{l.after}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-4">{history}</div>
    </div>
  );
}
