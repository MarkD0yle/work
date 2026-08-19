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

/* Cards layout — the airy take.
 *
 * Discrete white tiles on a grey field, icon stacked above the title, one
 * accent colour per app. A tile carrying nothing but an icon and a title has
 * no content to give it weight, so it earns presence three ways: a resting
 * colour tint you can target before you read, an accent hairline that wipes
 * across the top on hover, and an arrow that marks it as a destination.
 *
 * Tiles are separate elements with a gap rather than cells in one sheet —
 * nine apps into four columns leaves a part-filled last row, which discrete
 * tiles absorb without any blank-cell padding. See SheetView for the other
 * approach. */

export default function CardsView({
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
  return (
    <div className="mx-auto max-w-6xl px-8 pt-8 pb-16">
      {/* ---------- Greeting ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting}, Mark
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{today}</p>
        </div>
        <div className="flex items-center gap-2 border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-600">
          <span className="h-1.5 w-1.5 bg-emerald-500" />
          All systems operational
        </div>
      </div>

      {/* ---------- Launchpad ---------- */}
      <div className="mt-8 flex items-baseline justify-between border-b border-neutral-200 pb-2">
        <h2 className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
          Applications
        </h2>
        <span className="text-xs text-neutral-400">
          {apps.length} of {APPS.length}
        </span>
      </div>

      {apps.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {apps.map((app) => (
            <button
              key={app.name}
              type="button"
              onClick={() => app.slug && navigateToPage(app.slug)}
              className="group relative flex h-32 flex-col justify-between overflow-hidden border border-neutral-200 bg-white p-4 text-left transition-colors hover:border-neutral-900 focus:outline-none focus-visible:border-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900/20"
            >
              {/* Accent hairline wipes in from the left on hover — the only
                  motion on the card, so the pointer target is unambiguous. */}
              <span
                className={`absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100 ${app.bar}`}
              />
              <span
                className={`flex h-10 w-10 items-center justify-center transition-colors ${app.tile} ${app.tileSolidHover}`}
              >
                <Icon path={app.icon} className="h-5 w-5" />
              </span>
              <span className="text-sm leading-snug font-semibold tracking-tight text-neutral-900">
                {app.name}
              </span>
              <Icon
                path={ICON.arrow}
                className="absolute top-4 right-4 h-4 w-4 -translate-x-1 text-neutral-900 opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100"
              />
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-neutral-500">
          No application matches “{query.trim()}”.
        </p>
      )}

      {/* ---------- Release notes + key contacts ----------
       * One container, one hairline between the columns, so the two read as a
       * single block of reference material rather than competing cards. */}
      <div className="mt-10 grid gap-px border border-neutral-200 bg-neutral-200 lg:grid-cols-3">
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
    <section className="p-6">
      <div className="flex items-baseline justify-between">
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

      {/* Timeline: a hairline rail running behind the version markers. The
          rail is drawn per-item and skipped on the last one so it stops at
          the oldest release instead of trailing off. */}
      <ol className="mt-5">
        {RELEASES.map((release, i) => (
          <li key={release.version} className="flex gap-4 pb-6 last:pb-0">
            <div className="relative flex w-1.5 shrink-0 justify-center">
              {i < RELEASES.length - 1 && (
                <span
                  className="absolute inset-y-0 w-px bg-neutral-200"
                  aria-hidden
                />
              )}
              <span
                className={`relative mt-1.5 h-1.5 w-1.5 shrink-0 ${
                  release.current ? "bg-neutral-900" : "bg-neutral-300"
                }`}
                aria-hidden
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-neutral-900">
                  v{release.version}
                </span>
                {release.current && (
                  <span className="bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-white uppercase">
                    Current
                  </span>
                )}
                <span className="ml-auto text-xs text-neutral-400">
                  {release.date}
                </span>
              </div>

              <ul className="mt-2.5 space-y-2">
                {release.changes.map((change) => {
                  const style = KIND_STYLE[change.kind];
                  return (
                    <li key={change.text} className="flex gap-2.5 text-sm">
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 ${style.dot}`}
                        aria-hidden
                      />
                      <p className="text-neutral-600">
                        <span
                          className={`mr-1.5 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${style.chip}`}
                        >
                          {style.label}
                        </span>
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
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function KeyContacts() {
  return (
    <section className="p-6">
      <div className="flex items-baseline justify-between">
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

      <div className="mt-5 space-y-5">
        {CONTACT_GROUPS.map((group) => (
          <div key={group.heading}>
            <h3 className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              {group.heading}
            </h3>
            <ul className="mt-2 divide-y divide-neutral-100 border-t border-neutral-100">
              {group.people.map((person) => (
                <li key={person.email}>
                  <a
                    href={`mailto:${person.email}`}
                    className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-neutral-50"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center text-[11px] font-semibold ${person.tint}`}
                    >
                      {initials(person.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-neutral-900">
                        {person.name}
                      </span>
                      <span className="block truncate text-xs text-neutral-500">
                        {person.role}
                      </span>
                    </span>
                    <Icon
                      path={ICON.arrow}
                      className="ml-auto h-3.5 w-3.5 shrink-0 -translate-x-1 text-neutral-400 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
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
