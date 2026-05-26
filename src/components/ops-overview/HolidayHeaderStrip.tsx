import { useEffect, useState } from "react";

/* Spec v0.1.1 §9 — Holiday header strip.
 *
 * When today or tomorrow has a market closure affecting an active
 * currency, render a persistent secondary header strip below the main
 * app header. Operator sees the closure context BEFORE monitors start
 * firing.
 *
 * Strip is collapsible (×). Reappears next session if conditions still
 * apply. Tone = amber (informational, not breaking).
 *
 * Data source: spec §9.4 — pulls from existing market calendar / holiday
 * source. Mocked here pending backend confirmation. */

interface HolidayContext {
  ccy: string;
  occasion: string;
  closeType: "early" | "full";
  closeTime?: string; // "13:00 ET" for early close
  navStrikeAdjusted?: string; // "13:30" if NAV strike moves
  /** "today" or e.g. "Mon 25 May" if tomorrow */
  when: string;
}

/* Mock context — in production from useHolidayContext(). For the
 * prototype we surface a USD Memorial Day early close so the strip is
 * visible in the at-risk fixture. */
const MOCK_HOLIDAY_CONTEXT: HolidayContext | null = {
  ccy: "USD",
  occasion: "Memorial Day",
  closeType: "early",
  closeTime: "13:00 ET",
  navStrikeAdjusted: "13:30",
  when: "today",
};

export default function HolidayHeaderStrip() {
  const [dismissed, setDismissed] = useState(false);

  // If dismissed once, persist in sessionStorage so it doesn't keep
  // popping back during the same session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("holiday-strip-dismissed") === "1") {
      setDismissed(true);
    }
  }, []);

  if (!MOCK_HOLIDAY_CONTEXT || dismissed) return null;

  const ctx = MOCK_HOLIDAY_CONTEXT;
  const expectLine =
    ctx.closeType === "early" && ctx.navStrikeAdjusted
      ? `Expect: Actuals delayed, NAV strike at ${ctx.navStrikeAdjusted}`
      : "Expect: monitors may fire earlier than usual";

  return (
    <section
      role="status"
      aria-label="Upcoming market closure"
      className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-8 py-2"
    >
      <span
        aria-hidden
        className="mt-0.5 text-amber-700"
      >
        ⚠
      </span>
      <div className="flex-1 text-xs text-amber-900">
        <span className="font-semibold">{ctx.ccy} {ctx.occasion}</span>
        <span className="text-amber-800">
          {" · "}
          {ctx.closeType === "early"
            ? `early close ${ctx.closeTime}`
            : ctx.when === "today"
              ? "market closed today"
              : `closed ${ctx.when}`}
        </span>
        <span className="ml-3 text-amber-700">{expectLine}</span>
      </div>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          if (typeof window !== "undefined") {
            sessionStorage.setItem("holiday-strip-dismissed", "1");
          }
        }}
        aria-label="Dismiss closure notice for this session"
        className="rounded p-0.5 text-amber-700 hover:bg-amber-100"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path
            fillRule="evenodd"
            d="M4.28 4.28a.75.75 0 0 1 1.06 0L10 8.94l4.66-4.66a.75.75 0 1 1 1.06 1.06L11.06 10l4.66 4.66a.75.75 0 1 1-1.06 1.06L10 11.06l-4.66 4.66a.75.75 0 1 1-1.06-1.06L8.94 10 4.28 5.34a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </section>
  );
}
