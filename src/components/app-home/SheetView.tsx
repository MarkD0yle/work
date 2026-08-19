import { navigateToPage } from "../../lib/navigation";
import { Icon } from "./Icon";
import { ICON } from "./icons";
import {
  APPS,
  CONTACT_GROUPS,
  KIND_STYLE,
  RELEASES,
  initials,
  type AppEntry,
} from "./data";

/* Sheet layout — the dense take.
 *
 * The same nine apps as one continuous hairline sheet: no gaps, no resting
 * colour, icon beside the title instead of above it. Colour is held back
 * until hover, where it arrives as a solid left edge and a tint under the
 * icon — so the grid reads as a single quiet object until you reach for it.
 *
 * Row height drops from 128px to 80px, which puts the whole launchpad plus
 * the reference block on one screen. The trade against CardsView is
 * recognition speed: without resting colour you read labels rather than
 * targeting shapes. */

/* Breakpoint column counts, low to high. Used to pad the last row. */
const COLS = [2, 4] as const;

/* A part-filled last row would leak the sheet's border-coloured background as
 * a grey block, so blank cells pad it out. The column count changes at lg, so
 * each ghost carries the visibility it needs: `pads[i]` blanks at `COLS[i]`. */
function ghostCells(count: number): string[] {
  const pads = COLS.map((c) => (c - (count % c)) % c);
  return Array.from({ length: Math.max(...pads) }, (_, i) => {
    const atSm = i < pads[0];
    const atLg = i < pads[1];
    if (atSm && atLg) return "block";
    return atSm ? "block lg:hidden" : "hidden lg:block";
  });
}

export default function SheetView({
  apps,
  query,
  greeting,
  today,
}: {
  apps: AppEntry[];
  query: string;
  greeting: string;
  today: string;
}) {
  const ghosts = ghostCells(apps.length);

  return (
    <div className="mx-auto max-w-6xl px-8 pt-6 pb-16">
      {/* ---------- Compact header ----------
       * Greeting and status share one line; the stat strip is hairline-divided
       * so it reads as instrumentation rather than decoration. */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {greeting}, Mark
          </h1>
          <p className="text-xs text-neutral-500">{today}</p>
        </div>
        <dl className="flex divide-x divide-neutral-200 border border-neutral-200 bg-white">
          {[
            { label: "Applications", value: String(APPS.length) },
            { label: "Updated this week", value: "3" },
            { label: "Open incidents", value: "0" },
          ].map((stat) => (
            <div key={stat.label} className="px-4 py-2">
              <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                {stat.label}
              </dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold text-neutral-900">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ---------- Launchpad ---------- */}
      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
          Applications
        </h2>
        <span className="text-xs text-neutral-400">
          {apps.length} of {APPS.length}
        </span>
      </div>

      {apps.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-px border border-neutral-200 bg-neutral-200 lg:grid-cols-4">
          {apps.map((app) => (
            <button
              key={app.name}
              type="button"
              onClick={() => app.slug && navigateToPage(app.slug)}
              className="group relative flex h-20 items-center gap-3 bg-white px-4 text-left transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-inset"
            >
              {/* Solid accent edge unrolls down the left on hover. */}
              <span
                className={`absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 transition-transform duration-200 group-hover:scale-y-100 ${app.bar}`}
              />
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center bg-neutral-100 text-neutral-400 transition-colors ${app.tileTintHover}`}
              >
                <Icon path={app.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0 text-[13px] leading-snug font-medium tracking-tight text-neutral-800 transition-colors group-hover:text-neutral-950">
                {app.name}
              </span>
              <Icon
                path={ICON.arrow}
                className="ml-auto h-3.5 w-3.5 shrink-0 -translate-x-1 text-neutral-900 opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100"
              />
            </button>
          ))}
          {ghosts.map((visibility, i) => (
            <span key={i} className={`bg-white ${visibility}`} aria-hidden />
          ))}
        </div>
      ) : (
        <p className="mt-2 border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-neutral-500">
          No application matches “{query.trim()}”.
        </p>
      )}

      {/* ---------- Release notes + key contacts ----------
       * Same split container as Cards, but the contents go tabular to match
       * the sheet: fixed left columns, no chips, colour only on the kind. */}
      <div className="mt-8 grid gap-px border border-neutral-200 bg-neutral-200 lg:grid-cols-3">
        <div className="bg-white lg:col-span-2">
          <ReleaseNotes />
        </div>
        <div className="bg-white">
          <KeyContacts />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ReleaseNotes() {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-neutral-200 px-5 py-3">
        <h2 className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
          Release notes
        </h2>
        <a
          href="#"
          className="text-xs font-medium text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
        >
          All releases
        </a>
      </div>

      <div className="divide-y divide-neutral-100">
        {RELEASES.map((release) => (
          <div key={release.version} className="flex gap-5 px-5 py-4">
            {/* Fixed version column — the anchor that makes this read as a
                table rather than a feed. */}
            <div className="w-20 shrink-0">
              <div className="font-mono text-sm font-semibold text-neutral-900">
                v{release.version}
              </div>
              <div className="mt-0.5 text-[11px] text-neutral-400">
                {release.date}
              </div>
              {release.current && (
                <div className="mt-1.5 inline-block bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-white uppercase">
                  Current
                </div>
              )}
            </div>

            <ul className="min-w-0 flex-1 space-y-1.5">
              {release.changes.map((change) => {
                const style = KIND_STYLE[change.kind];
                return (
                  <li
                    key={change.text}
                    className="grid grid-cols-[4.5rem_1fr] gap-3 text-[13px] leading-relaxed"
                  >
                    <span
                      className={`text-[10px] font-semibold tracking-wider uppercase ${style.text} pt-1`}
                    >
                      {style.label}
                    </span>
                    <p className="text-neutral-600">
                      <span className="font-medium text-neutral-900">
                        {change.app}
                      </span>
                      <span className="text-neutral-400"> · </span>
                      {change.text}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function KeyContacts() {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-neutral-200 px-5 py-3">
        <h2 className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
          Key contacts
        </h2>
        <a
          href="#"
          className="text-xs font-medium text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
        >
          Directory
        </a>
      </div>

      <div>
        {CONTACT_GROUPS.map((group) => (
          <div key={group.heading}>
            <h3 className="border-b border-neutral-100 bg-neutral-50 px-5 py-1.5 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              {group.heading}
            </h3>
            <ul className="divide-y divide-neutral-100">
              {group.people.map((person) => (
                <li key={person.email}>
                  <a
                    href={`mailto:${person.email}`}
                    className="group flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-neutral-50"
                  >
                    {/* Monograms stay neutral here — the sheet holds colour
                        back for hover states only. */}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-neutral-100 text-[11px] font-semibold text-neutral-600 transition-colors group-hover:bg-neutral-900 group-hover:text-white">
                      {initials(person.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-neutral-900">
                        {person.name}
                      </span>
                      <span className="block truncate text-[11px] text-neutral-500">
                        {person.role}
                      </span>
                    </span>
                    <Icon
                      path={ICON.arrow}
                      className="ml-auto h-3.5 w-3.5 shrink-0 -translate-x-1 text-neutral-900 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
