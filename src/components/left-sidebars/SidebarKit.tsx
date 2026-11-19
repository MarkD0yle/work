import { type ReactNode } from "react";
import { cx, focus, tone as toneTokens, type Tone } from "../patterns/tokens";

/* SidebarKit — the small set of parts the sidebar variations share.
 *
 * Deliberately thin. The frame, the brand block, the count badge and the
 * user footer are the same everywhere so that what differs between two
 * variations is the navigation pattern itself.
 */

export function SidebarFrame({
  label,
  className,
  dark = false,
  children,
}: {
  label: string;
  /** Width and any overrides, e.g. "w-64". */
  className: string;
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={label}
      className={cx(
        "flex h-full min-h-0 shrink-0 flex-col border-r text-xs",
        dark
          ? "border-neutral-800 bg-neutral-950 text-neutral-300"
          : "border-neutral-200 bg-white text-neutral-700",
        className,
      )}
    >
      {children}
    </aside>
  );
}

/** Product mark. `compact` shows the square mark alone, for icon rails. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cx(
        "flex h-12 shrink-0 items-center gap-2.5 border-b border-neutral-200",
        compact ? "justify-center" : "px-4",
      )}
    >
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center bg-neutral-900 text-[11px] font-bold text-white"
      >
        K
      </span>
      {compact ? (
        <span className="sr-only">Keel Investment Services</span>
      ) : (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold tracking-tight text-neutral-900">
            Keel
          </span>
          <span className="block truncate text-[10px] text-neutral-500">
            Investment Services
          </span>
        </span>
      )}
    </div>
  );
}

/** Open-item count. Neutral counts stay quiet; toned counts carry severity. */
export function CountBadge({
  count,
  tone = "neutral",
  className,
}: {
  count?: number;
  tone?: Tone;
  className?: string;
}) {
  if (!count) return null;
  return (
    <span
      className={cx(
        "inline-flex min-w-5 shrink-0 items-center justify-center rounded-full border px-1.5 text-[10px] leading-4 font-semibold tabular-nums",
        toneTokens[tone].soft,
        className,
      )}
    >
      {count}
    </span>
  );
}

export function ToneDot({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("inline-block h-1.5 w-1.5 shrink-0 rounded-full", toneTokens[tone].solid, className)}
    />
  );
}

/** Small uppercase heading above a group of links. */
export function GroupLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "px-4 pt-4 pb-1 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The standard text link row: label left, count right, bar on the active row. */
export function NavLink({
  label,
  active,
  onClick,
  count,
  tone,
  icon,
  className,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex w-full items-center gap-2 border-l-2 py-1.5 pr-3 pl-3.5 text-left",
        active
          ? "border-l-neutral-900 bg-neutral-100 font-semibold text-neutral-900"
          : "border-l-transparent text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900",
        focus,
        "focus-visible:-outline-offset-2",
        className,
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <CountBadge count={count} tone={tone} />
    </button>
  );
}

/** Signed-in user, pinned to the bottom. `compact` shows the initials alone. */
export function UserFooter({
  compact = false,
  role = "Fund Accountant",
}: {
  compact?: boolean;
  role?: string;
}) {
  return (
    <div
      className={cx(
        "flex shrink-0 items-center gap-2.5 border-t border-neutral-200 py-2.5",
        compact ? "justify-center" : "px-4",
      )}
    >
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-700"
      >
        PN
      </span>
      {compact ? (
        <span className="sr-only">Priya Nair, {role}</span>
      ) : (
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-medium text-neutral-900">Priya Nair</span>
          <span className="block truncate text-[11px] text-neutral-500">{role} · Dublin</span>
        </span>
      )}
    </div>
  );
}
