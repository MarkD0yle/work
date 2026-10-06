import { Fragment, type ReactNode } from "react";
import { creationSummary, redemptionSummary, type OrderConfig } from "./model";

const TH =
  "px-3 py-2 text-left text-[10px] font-semibold tracking-widest text-neutral-500 uppercase";
const TD = "px-3 py-2 text-xs text-neutral-700";

/* RecordsTable — column headers always render; with no records a single
 * empty-state row sits underneath. Rows are keyboard-reachable through the
 * label button. Below ~576px of its own width it drops the Creation and
 * Redemption columns (e.g. inside the side panel variant). Optional hooks let a container mark the active row, flash a
 * just-saved row, or expand an editor under a row. */
export default function RecordsTable({
  caption,
  records,
  onEdit,
  activeId,
  flashId,
  draftId,
  renderExpanded,
}: {
  caption: string;
  records: OrderConfig[];
  onEdit?: (record: OrderConfig) => void;
  activeId?: string | null;
  flashId?: string | null;
  draftId?: string | null;
  renderExpanded?: (record: OrderConfig) => ReactNode;
}) {
  return (
    <div className="@container overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-neutral-200 bg-neutral-50">
          <tr>
            <th scope="col" className={TH}>Label</th>
            <th scope="col" className={TH}>Name</th>
            <th scope="col" className={`${TH} hidden @xl:table-cell`}>Creation</th>
            <th scope="col" className={`${TH} hidden @xl:table-cell`}>Redemption</th>
            <th scope="col" className={TH}>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-xs text-neutral-400">
                No order configs yet. Use “Add order config” below.
              </td>
            </tr>
          )}
          {records.map((r) => {
            const isDraft = r.id === draftId;
            const expanded = renderExpanded?.(r);
            const tone =
              r.id === flashId
                ? "bg-emerald-50"
                : r.id === activeId
                  ? "bg-neutral-100"
                  : "hover:bg-neutral-50";
            return (
              <Fragment key={r.id}>
                <tr
                  onClick={() => onEdit?.(r)}
                  className={`border-b border-neutral-100 transition-colors duration-500 ${
                    onEdit ? "cursor-pointer" : ""
                  } ${tone}`}
                >
                  <td className={TD}>
                    <button
                      type="button"
                      className="font-medium text-neutral-900 underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
                    >
                      {r.label}
                    </button>
                  </td>
                  <td className={TD}>
                    {r.name || <span className="text-neutral-400">Untitled</span>}
                  </td>
                  <td className={`${TD} hidden @xl:table-cell`}>{creationSummary(r)}</td>
                  <td className={`${TD} hidden @xl:table-cell`}>{redemptionSummary(r)}</td>
                  <td className={TD}>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isDraft
                          ? "bg-amber-100 text-amber-800"
                          : r.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {isDraft ? "Draft" : r.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b border-neutral-200 bg-neutral-50/60">
                    <td colSpan={5} className="p-0">
                      {expanded}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
