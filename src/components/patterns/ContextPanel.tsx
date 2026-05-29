import { type ReactNode } from "react";
import { SEVERITY_TONES, type Severity } from "../../lib/severity-tokens";

/* ContextPanel — reusable docked side-panel shell.
 *
 * Generalises the chrome that PipelineDrawer hand-builds (eyebrow + title +
 * severity dot, scrollable body, sticky footer of actions) so other surfaces
 * can adopt the same context-panel pattern without re-deriving the layout.
 * It is a region, not a modal: it sits inside a sized parent column and never
 * traps focus — use Modal for that. Compose the body from PanelSection and
 * PanelMetaGrid below.
 */

const SEVERITY_DOT: Record<Severity, string> = {
  benchmark: "bg-red-500",
  broken: "bg-red-500",
  required: "bg-amber-500",
  atrisk: "bg-amber-500",
  typical: "bg-yellow-400",
  watch: "bg-blue-500",
  working: "bg-blue-500",
  expected_absence: "bg-neutral-300",
  clean: "bg-neutral-300",
};

export default function ContextPanel({
  title,
  eyebrow,
  severity,
  onClose,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  severity?: Severity;
  onClose?: () => void;
  /** Sticky action bar pinned below the header. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const accentBorder = severity
    ? SEVERITY_TONES[severity].surface.border
    : "border-l-neutral-200";
  return (
    <aside
      role="region"
      aria-label={title}
      className={`flex h-full flex-col overflow-hidden border-l-2 bg-white ${accentBorder}`}
    >
      <header className="flex items-start gap-3 border-b border-neutral-200 px-5 pt-4 pb-4">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              {eyebrow}
            </div>
          )}
          <div className="mt-0.5 flex items-center gap-2">
            {severity && (
              <span
                aria-hidden
                className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${SEVERITY_DOT[severity]}`}
              />
            )}
            <h2 className="truncate text-lg font-semibold tracking-tight text-neutral-900">
              {title}
            </h2>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="-mr-1 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M4.28 4.28a.75.75 0 0 1 1.06 0L10 8.94l4.66-4.66a.75.75 0 1 1 1.06 1.06L11.06 10l4.66 4.66a.75.75 0 1 1-1.06 1.06L10 11.06l-4.66 4.66a.75.75 0 1 1-1.06-1.06L8.94 10 4.28 5.34a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {actions && (
          <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-5 py-3">
            {actions}
          </div>
        )}
        {children}
      </div>
    </aside>
  );
}

/* PanelSection — a titled block separated by the standard hairline. */
export function PanelSection({
  title,
  trailing,
  children,
  last = false,
}: {
  title?: string;
  trailing?: ReactNode;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <section className={`px-5 py-4 ${last ? "" : "border-b border-neutral-200"}`}>
      {(title || trailing) && (
        <div className="mb-3 flex items-baseline justify-between">
          {title && (
            <h3 className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
              {title}
            </h3>
          )}
          {trailing && <span className="text-xs text-neutral-500">{trailing}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/* PanelMetaGrid — the 2-up label/value grid used in PipelineDrawer's header.
 * Pass an even number of items for clean rows. */
export function PanelMetaGrid({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <section className="grid grid-cols-2 border-b border-neutral-200">
      {items.map((item, i) => {
        const borderCls = [
          i % 2 === 1 ? "border-l border-neutral-200" : "",
          i >= 2 ? "border-t border-neutral-200" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div key={item.label} className={`px-5 py-3 ${borderCls}`}>
            <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
              {item.label}
            </div>
            <div className="mt-1 flex items-center text-sm font-semibold tabular-nums text-neutral-900">
              {item.value}
            </div>
          </div>
        );
      })}
    </section>
  );
}
