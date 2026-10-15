import { cx, radius, tone as toneTokens, type Tone } from "./tokens";

/* StatusBadge — a state in one word.
 *
 * Soft pill by default. `dot` swaps the fill for a coloured dot and plain
 * text, for dense tables where many pills would shout. Use one label per
 * state across the product ("Failed", not "Fail" here and "Error" there). */

export function StatusBadge({
  tone = "neutral",
  label,
  dot = false,
}: {
  tone?: Tone;
  label: string;
  dot?: boolean;
}) {
  if (dot) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-neutral-700">
        <span aria-hidden className={cx("h-2 w-2 shrink-0", radius.pill, toneTokens[tone].solid)} />
        {label}
      </span>
    );
  }
  return (
    <span
      className={cx(
        "inline-flex items-center border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        radius.pill,
        toneTokens[tone].soft,
      )}
    >
      {label}
    </span>
  );
}
