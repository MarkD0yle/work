import type { ReactNode } from "react";
import { border, cx, radius, space, surface, text } from "./tokens";

/* SectionCard — the titled container every region sits in.
 *
 * Title + optional subtitle on the left, actions (period toggle, export,
 * "view all") on the right, body below, optional footer for a source note
 * or a link. A chart card is a SectionCard with a chart in it; a table card
 * is a SectionCard with `flush` so the table runs edge to edge. */

export function SectionCard({
  title,
  subtitle,
  actions,
  footer,
  flush = false,
  className,
  children,
}: {
  title?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  /** Drop body padding — for tables, lists and full-bleed charts. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("flex min-w-0 flex-col", surface.card, border.default, radius.container, className)}>
      {(title || actions) && (
        <header className={cx("flex items-start justify-between gap-3 border-b", border.subtle, space.cardPadX, space.cardPadY)}>
          <div className="min-w-0">
            {title && <h2 className={text.title}>{title}</h2>}
            {subtitle && <p className={cx("mt-0.5", text.muted)}>{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx("min-w-0 flex-1", !flush && space.cardPad)}>{children}</div>
      {footer && (
        <footer className={cx("border-t", border.subtle, space.cardPadX, "py-2", text.muted)}>{footer}</footer>
      )}
    </section>
  );
}
