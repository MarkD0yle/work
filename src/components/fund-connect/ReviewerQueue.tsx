import {
  ageLabel,
  ageMinutes,
  stateLabel,
  summarise,
  userName,
} from "../../lib/fundConnect/engine";
import { ABANDONED_AFTER_MINUTES, REVIEW_SLA } from "../../lib/fundConnect/seed";
import { STATE_PILL, slaTone, toneFor } from "../../lib/fundConnect/tone";
import type { FundRecord, User } from "../../lib/fundConnect/types";

/* Reviewer queue and abandoned drafts — spec build step 9.
 *
 * Last in the sequence on purpose: throughput and monitoring only mean
 * something once the loop they measure is trustworthy. What it answers is
 * narrow — who is waiting, how long, who owns it, and which drafts have
 * been sitting untouched. */

function Pill({ record }: { record: FundRecord }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-[1px] text-[10px] font-medium tracking-wide uppercase ${STATE_PILL[record.state]}`}
    >
      {stateLabel(record.state)}
    </span>
  );
}

export default function ReviewerQueue({
  records,
  currentUser,
  activeId,
  onOpen,
}: {
  records: FundRecord[];
  currentUser: User;
  activeId: string;
  onOpen: (versionId: string) => void;
}) {
  const waiting = records.filter(
    (r) => r.state === "submitted" || r.state === "in_review",
  );
  const drafts = records.filter((r) => r.state === "draft" || r.state === "amendment");
  const done = records.filter((r) => r.state === "approved");

  return (
    <div className="flex flex-col gap-6">
      <section className="border border-neutral-200 bg-white">
        <header className="flex items-baseline justify-between border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">Awaiting review</h2>
          <p className="text-[11px] text-neutral-500">
            Target {REVIEW_SLA.target / 60}h · breach {REVIEW_SLA.breach / 60}h
          </p>
        </header>
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50 text-[10px] tracking-wide text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Record</th>
              <th className="px-4 py-2 font-medium">Submitted by</th>
              <th className="px-4 py-2 font-medium">Waiting</th>
              <th className="px-4 py-2 font-medium">Reviewer</th>
              <th className="px-4 py-2 font-medium">State</th>
              <th className="px-4 py-2 font-medium">Open items</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {waiting.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-neutral-500">
                  Nothing is waiting on a reviewer.
                </td>
              </tr>
            )}
            {waiting.map((r) => {
              const mins = ageMinutes(r.submittedAt ?? r.updatedAt);
              const tone = slaTone(mins, REVIEW_SLA);
              const t = toneFor(tone, "muted");
              const summary = summarise(r, "submit");
              const own = r.submittedBy === currentUser.id;
              return (
                <tr
                  key={r.versionId}
                  className={`border-t border-neutral-100 ${r.versionId === activeId ? "bg-neutral-50" : ""}`}
                >
                  <td className="px-4 py-2">
                    <div className="font-mono text-neutral-900">
                      {r.id} <span className="text-neutral-400">v{r.version}</span>
                    </div>
                    <div className="text-[11px] text-neutral-500">{r.label}</div>
                  </td>
                  <td className="px-4 py-2 text-neutral-700">{userName(r.submittedBy)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-[1px] font-medium tabular-nums ${
                        tone === "none"
                          ? "border-neutral-200 bg-white text-neutral-600"
                          : `${t.bg} ${t.border} ${t.text}`
                      }`}
                    >
                      {ageLabel(r.submittedAt ?? r.updatedAt)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-neutral-700">
                    {r.reviewerId ? userName(r.reviewerId) : "Unassigned"}
                  </td>
                  <td className="px-4 py-2">
                    <Pill record={r} />
                  </td>
                  <td className="px-4 py-2 text-neutral-600">
                    {summary.errors > 0 && (
                      <span className="mr-2 text-red-700">{summary.errors} error</span>
                    )}
                    {summary.warnings > 0 && (
                      <span className="mr-2 text-amber-800">{summary.warnings} to check</span>
                    )}
                    {summary.flags > 0 && (
                      <span className="text-amber-800">{summary.flags} flagged</span>
                    )}
                    {summary.errors + summary.warnings + summary.flags === 0 && (
                      <span className="text-neutral-400">Clean</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onOpen(r.versionId)}
                      className="rounded-md border border-neutral-300 px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      {own ? "Open (yours)" : "Open"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="border border-neutral-200 bg-white">
        <header className="flex items-baseline justify-between border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">Drafts in progress</h2>
          <p className="text-[11px] text-neutral-500">
            Untouched for {ABANDONED_AFTER_MINUTES / 1440} days or more counts as abandoned
          </p>
        </header>
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50 text-[10px] tracking-wide text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Record</th>
              <th className="px-4 py-2 font-medium">Owner</th>
              <th className="px-4 py-2 font-medium">Last touched</th>
              <th className="px-4 py-2 font-medium">Progress</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {drafts.map((r) => {
              const idle = ageMinutes(r.updatedAt);
              const abandoned = idle >= ABANDONED_AFTER_MINUTES;
              const summary = summarise(r, "submit");
              return (
                <tr
                  key={r.versionId}
                  className={`border-t border-neutral-100 ${r.versionId === activeId ? "bg-neutral-50" : ""}`}
                >
                  <td className="px-4 py-2">
                    <div className="font-mono text-neutral-900">
                      {r.id} <span className="text-neutral-400">v{r.version}</span>
                    </div>
                    <div className="text-[11px] text-neutral-500">{r.label}</div>
                  </td>
                  <td className="px-4 py-2 text-neutral-700">{userName(r.createdBy)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-[1px] font-medium tabular-nums ${
                        abandoned
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-neutral-200 bg-white text-neutral-600"
                      }`}
                    >
                      {ageLabel(r.updatedAt)} ago
                    </span>
                    {abandoned && (
                      <span className="ml-2 text-[11px] text-red-700">Abandoned</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-neutral-600 tabular-nums">
                    {summary.sectionsComplete}/{summary.sectionsTotal} sections ·{" "}
                    {summary.missing} outstanding
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onOpen(r.versionId)}
                      className="rounded-md border border-neutral-300 px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {done.length > 0 && (
        <section className="border border-neutral-200 bg-white">
          <header className="border-b border-neutral-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-neutral-900">Approved</h2>
          </header>
          <table className="w-full text-left text-xs">
            <tbody>
              {done.map((r) => (
                <tr key={r.versionId} className="border-t border-neutral-100 first:border-t-0">
                  <td className="px-4 py-2">
                    <div className="font-mono text-neutral-900">
                      {r.id} <span className="text-neutral-400">v{r.version}</span>
                    </div>
                    <div className="text-[11px] text-neutral-500">{r.label}</div>
                  </td>
                  <td className="px-4 py-2 text-neutral-700">
                    Approved by {userName(r.approvedBy)} · {ageLabel(r.approvedAt ?? r.updatedAt)} ago
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onOpen(r.versionId)}
                      className="rounded-md border border-neutral-300 px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
