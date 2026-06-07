import type { ReactNode } from "react";

/* FormCard — a titled section container for grouping related fields.
 * The header carries the section name + an optional one-line description and
 * an action slot (e.g. "Add another"). The body is a plain slot so callers
 * control their own field grid. */
export function FormCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-neutral-200 bg-white ${
        className ?? ""
      }`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}
