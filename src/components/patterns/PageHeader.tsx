import type { ReactNode } from "react";
import { border, cx, space, surface, text } from "./tokens";

/* PageHeader — the top band of every screen.
 *
 * Eyebrow (where you are), title (what this is), one line of context
 * (as-of time, scope), and the page-level actions on the right. Optional
 * `meta` sits under the title for freshness or scope chips, and `children`
 * renders a second row for tabs or a lens bar that belongs to the header. */

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className={cx("border-b", border.divider, surface.card, space.pageX, "pt-4", children ? "pb-0" : "pb-4")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <div className={text.eyebrow}>{eyebrow}</div>}
          <h1 className={cx("mt-0.5", text.pageTitle)}>{title}</h1>
          {description && <p className={cx("mt-0.5", text.muted)}>{description}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </header>
  );
}
