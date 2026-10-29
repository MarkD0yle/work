import type { ReactNode } from "react";
import { border, button, cx, radius, space, surface, text, tone as toneTokens, type Tone } from "./tokens";

/* InsightCard — a finding plus the action it implies.
 *
 * "Broker X slippage is 3bp above peers — review routing." Lead with the
 * finding, back it with one number, end with one action. If there is no
 * action, it's a MetricCard or a Banner, not an insight. */

export function InsightCard({
  eyebrow = "Insight",
  title,
  evidence,
  tone = "info",
  action,
  secondary,
}: {
  eyebrow?: string;
  title: string;
  evidence?: ReactNode;
  tone?: Tone;
  action: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <article className={cx("relative flex flex-col border-l-2", surface.card, border.default, radius.container, space.cardPad, toneTokens[tone].rail)}>
      <div className={text.eyebrow}>{eyebrow}</div>
      <h3 className={cx("mt-1", text.title)}>{title}</h3>
      {evidence && <div className={cx("mt-1", text.body)}>{evidence}</div>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={action.onClick} className={button.primary}>
          {action.label}
        </button>
        {secondary && (
          <button type="button" onClick={secondary.onClick} className={button.ghost}>
            {secondary.label}
          </button>
        )}
      </div>
    </article>
  );
}
