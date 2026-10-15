import type { ReactNode } from "react";
import { button, cx, radius, tone as toneTokens, type Tone } from "./tokens";

/* Banner — an inline message about the whole screen or a region.
 *
 * Stale data, a breach, a system outage, a read-only state. One sentence
 * of what happened, one of what to do, one action. Stack several with
 * BannerStack: worst first, so the eye meets the most urgent one. */

const ICON: Record<Tone, string> = {
  neutral: "i",
  info: "i",
  positive: "✓",
  warning: "!",
  negative: "!",
  critical: "!",
};

export function Banner({
  tone = "info",
  title,
  children,
  action,
  onDismiss,
}: {
  tone?: Tone;
  title: string;
  children?: ReactNode;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
}) {
  const urgent = tone === "negative" || tone === "critical" || tone === "warning";
  return (
    <div
      role={urgent ? "alert" : "status"}
      className={cx("flex items-start gap-3 border px-4 py-2.5", radius.container, toneTokens[tone].soft)}
    >
      <span
        aria-hidden
        className={cx(
          "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-[10px] font-bold text-white",
          radius.pill,
          toneTokens[tone].solid,
        )}
      >
        {ICON[tone]}
      </span>
      <div className="min-w-0 flex-1 text-xs">
        <div className="font-semibold">{title}</div>
        {children && <div className="mt-0.5 opacity-90">{children}</div>}
      </div>
      {action && (
        <button type="button" onClick={action.onClick} className={button.secondary}>
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className={cx(button.ghost, "px-1.5")}>
          ✕
        </button>
      )}
    </div>
  );
}

export function BannerStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}
