import { useMemo, useState } from "react";
import { PageHeader, SectionCard, SegmentedControl } from "../components/patterns";
import { button, cx, text } from "../components/patterns/tokens";
import { usePageCatalogue } from "../hooks/usePageCatalogue";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { navigateToPage } from "../lib/navigation";
import { LAST_SEEN_KEY, buildFeed, formatFeedDate } from "../lib/whatsNew";

export const title = "What's New";
export const section = "patterns";
export const fullWidth = true;

/* What's New — every feature note and new screen, newest first.
 *
 * The What's New tour on the landing page walks through the latest few of
 * these. This page is the full list, so nothing is lost when the tour is
 * skipped. Entries come from src/lib/whatsNew.ts. */

type Kind = "all" | "feature" | "screen";

const KINDS: { value: Kind; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "feature", label: "Features" },
  { value: "screen", label: "Screens" },
];

export default function WhatsNewPage() {
  const catalogue = usePageCatalogue();
  const [kind, setKind] = useState<Kind>("all");
  const [lastSeen, setLastSeen] = useLocalStorage(LAST_SEEN_KEY, 0);

  const feed = useMemo(() => buildFeed(catalogue), [catalogue]);
  const visible = feed.filter((item) => kind === "all" || item.kind === kind);
  const unseen = feed.filter((item) => item.ts > lastSeen).length;

  return (
    <div className="h-screen overflow-y-auto bg-neutral-50">
      <PageHeader
        className="pl-32"
        eyebrow="Tools"
        title="What's New"
        description={
          unseen > 0
            ? `${unseen} ${unseen === 1 ? "entry" : "entries"} since your last visit.`
            : "You are up to date."
        }
        actions={
          <>
            {unseen > 0 && (
              <button
                type="button"
                className={button.secondary}
                onClick={() => setLastSeen(Math.floor(Date.now() / 1000))}
              >
                Mark all as read
              </button>
            )}
            <button
              type="button"
              className={button.primary}
              onClick={() => navigateToPage("home", { tour: "news" })}
            >
              Start the tour
            </button>
          </>
        }
      />
      <div className="mx-auto grid max-w-3xl gap-4 p-6">
        <SegmentedControl label="Show" options={KINDS} value={kind} onChange={setKind} />
        <SectionCard flush>
          <ol className="divide-y divide-neutral-100">
            {visible.map((item) => (
              <li key={item.id} className="flex items-start gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-neutral-500">
                    <span className={item.kind === "feature" ? "text-indigo-700" : undefined}>
                      {item.kind === "feature" ? "New feature" : "New screen"}
                    </span>
                    <span>{formatFeedDate(item.ts)}</span>
                    {item.ts > lastSeen && (
                      <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Unread
                      </span>
                    )}
                  </p>
                  <h2 className={cx("mt-1", text.title)}>{item.title}</h2>
                  <p className={cx("mt-0.5", text.muted)}>{item.summary}</p>
                </div>
                <button
                  type="button"
                  className={button.secondary}
                  aria-label={`Open ${item.title}`}
                  onClick={() => navigateToPage(item.slug)}
                >
                  Open
                </button>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}
