import { STALE_THRESHOLD_MIN, isStale } from "../../lib/qlik";

/* Spec §2.1 — stale-data indicator. Visible when Qlik's last refresh is
 * older than STALE_THRESHOLD_MIN. Spec §4.5: stale state must be visible,
 * never silently serve cached data. */

export default function StaleBanner({
  lastRefresh,
  now,
}: {
  lastRefresh: string;
  now: number;
}) {
  if (!isStale(lastRefresh, now)) return null;
  const ageMin = Math.floor(
    (now - new Date(lastRefresh).getTime()) / 60_000,
  );
  return (
    <div
      role="status"
      className="mb-3 flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900"
    >
      <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-amber-500" />
      <span>
        Qlik feed stale — last refresh {ageMin}m ago (threshold{" "}
        {STALE_THRESHOLD_MIN}m). Showing last-known state.
      </span>
    </div>
  );
}
