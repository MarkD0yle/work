import { useState } from "react";
import { PageHeader, StatusBadge, Tabs, tokens } from "../components/patterns";
import { CATALOG, GROUPS, NOT_YET, type PatternEntry } from "../components/pattern-library/catalog";
import { BlotterComposition, PatternDemo } from "../components/pattern-library/demos";

export const title = "Pattern Library";
export const section = "library";
export const fullWidth = true;

/* Pattern Library — the shared patterns behind the ~100 screens.
 *
 * Each pattern shows what it's for, when not to use it, its rules, which
 * screens it was extracted from, and a working demo. The last section
 * builds the order blotter from patterns only, to prove they compose.
 * Source: src/components/patterns. Inventory: docs/patterns/README.md. */

const { cx, text, border, surface } = tokens;

function PatternSection({ p, index }: { p: PatternEntry; index: number }) {
  return (
    <section id={p.id} aria-labelledby={`${p.id}-title`} className={cx("scroll-mt-6 border-t pt-8", border.divider)}>
      <div className="grid gap-6 xl:grid-cols-[18rem_1fr]">
        <div>
          <div className={text.eyebrow}>
            {String(index + 1).padStart(2, "0")} · {p.group}
          </div>
          <h2 id={`${p.id}-title`} className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-900">
            {p.name}
          </h2>
          <div className="mt-1 flex flex-wrap gap-1">
            {p.exports.map((e) => (
              <code key={e} className="bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-700">
                {e}
              </code>
            ))}
          </div>
          <dl className="mt-4 flex flex-col gap-3 text-xs">
            <div>
              <dt className={text.label}>Use when</dt>
              <dd className="mt-0.5 text-neutral-800">{p.useWhen}</dd>
            </div>
            <div>
              <dt className={text.label}>Don't use when</dt>
              <dd className="mt-0.5 text-neutral-800">{p.avoidWhen}</dd>
            </div>
            <div>
              <dt className={text.label}>Rules</dt>
              <dd>
                <ul className="mt-0.5 list-disc pl-4 text-neutral-800">
                  {p.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt className={text.label}>{p.pages === 0 ? "New: no screen has a local version yet. Likely first use:" : `Replaces local versions in ~${p.pages} pages, e.g.`}</dt>
              <dd className="mt-0.5 text-neutral-600">{p.seenIn.join(", ")}</dd>
            </div>
          </dl>
        </div>
        <div className={cx("min-w-0 p-5", surface.sunken, border.default)}><PatternDemo id={p.id} /></div>
      </div>
    </section>
  );
}

export default function PatternLibraryPage() {
  const [group, setGroup] = useState<"all" | (typeof GROUPS)[number]>("all");
  const shown = CATALOG.filter((p) => group === "all" || p.group === group);

  return (
    // Full-width pages get a fixed-height, non-scrolling frame, so the page
    // owns its scroll. Top padding clears the app's floating Home pill.
    <div className={cx("h-full overflow-y-auto pt-16", surface.page)}>
      <PageHeader
        eyebrow="Design system"
        title="Pattern Library"
        description={`${CATALOG.length} shared patterns, extracted from an inventory of ~100 screens. Import from src/components/patterns.`}
        meta={
          <>
            <StatusBadge tone="info" label="v0.1" />
            <span className={text.muted}>Square corners · tokens in patterns/tokens.ts · no inline styles</span>
          </>
        }
      >
        <Tabs
          label="Pattern group"
          value={group}
          onChange={setGroup}
          tabs={[{ value: "all", label: "All", count: CATALOG.length }, ...GROUPS.map((g) => ({ value: g, label: g, count: CATALOG.filter((p) => p.group === g).length }))]}
        />
      </PageHeader>

      <div className="grid gap-8 px-6 py-6 lg:grid-cols-[12rem_1fr]">
        <nav aria-label="Patterns" className="hidden lg:block">
          <ol className="sticky top-6 flex flex-col gap-0.5 text-xs">
            {shown.map((p) => (
              <li key={p.id}>
                <a href={`#${p.id}`} className="block px-2 py-1 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900">
                  {p.name}
                </a>
              </li>
            ))}
            <li className={cx("mt-2 border-t pt-2", border.divider)}>
              <a href="#composition" className="block px-2 py-1 font-medium text-neutral-900 hover:bg-neutral-100">
                Composition test
              </a>
            </li>
          </ol>
        </nav>

        <main className="flex min-w-0 flex-col gap-10">
          {shown.map((p) => (
            <PatternSection key={p.id} p={p} index={CATALOG.indexOf(p)} />
          ))}

          <section id="composition" aria-labelledby="composition-title" className={cx("scroll-mt-6 border-t pt-8", border.divider)}>
            <div className={text.eyebrow}>Composition test</div>
            <h2 id="composition-title" className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-900">
              Order blotter, built only from patterns
            </h2>
            <p className={cx("mt-1 mb-4 max-w-2xl", text.body)}>
              Header, banner, metric row, status strip, filter bar, toolbar, table and side panel. No local styling. Click a stage or a row. If a
              screen can't be built like this, the gap belongs in the library, not in the screen.
            </p>
            <BlotterComposition />
          </section>

          <section aria-labelledby="not-yet-title" className={cx("border-t pt-8", border.divider)}>
            <h2 id="not-yet-title" className={text.title}>
              Found in the inventory, not extracted yet
            </h2>
            <ul className="mt-2 flex flex-col gap-1 text-xs">
              {NOT_YET.map((n) => (
                <li key={n.name}>
                  <span className="font-medium text-neutral-900">{n.name}</span> <span className="text-neutral-600">— {n.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
