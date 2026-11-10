import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, PageHeader, SectionCard, SegmentedControl } from "../components/patterns";
import { button, cx, focus, text } from "../components/patterns/tokens";
import { ScreenStage } from "../components/tools/ScreenStage";
import { usePageCatalogue } from "../hooks/usePageCatalogue";
import { useLocalStorage } from "../hooks/useLocalStorage";

export const title = "Demo Reel";
export const section = "patterns";
export const fullWidth = true;

/* Demo Reel — queue up screens and play them full screen.
 *
 * For stakeholder walk-throughs: instead of hunting for the next screen
 * mid-meeting, build the running order once and let it play. The playlist is
 * saved in this browser. Only the current screen is mounted while playing. */

// Screens that embed other screens cannot be played inside the reel.
const EXCLUDED = new Set(["demo-reel", "side-by-side"]);

const SPEEDS = [
  { value: "5", label: "5s" },
  { value: "10", label: "10s" },
  { value: "20", label: "20s" },
];

function Player({
  slugs,
  titles,
  seconds,
  onExit,
}: {
  slugs: string[];
  titles: Record<string, string>;
  seconds: number;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slug = slugs[index];

  const step = useCallback(
    (delta: number) => setIndex((i) => (i + delta + slugs.length) % slugs.length),
    [slugs.length],
  );

  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => step(1), seconds * 1000);
    return () => window.clearTimeout(id);
  }, [index, paused, seconds, step]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onExit();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit, step]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Demo reel player" className="fixed inset-0 z-[60] bg-neutral-50">
      <ScreenStage key={slug} slug={slug} />
      <div className="fixed inset-x-0 bottom-0 z-[70] flex justify-center p-4">
        <div className="w-full max-w-xl bg-neutral-900 text-white shadow-xl">
          <div className="h-0.5 bg-neutral-700">
            {!paused && (
              <div
                key={`${index}-${seconds}`}
                data-seconds={seconds}
                className="reel-progress h-full bg-white"
              />
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs">
              <span className="tabular-nums text-neutral-400">
                {index + 1} / {slugs.length}
              </span>{" "}
              <span className="font-medium" aria-live="polite">{titles[slug] ?? slug}</span>
            </span>
            <button type="button" className={cx("px-2 py-1 text-xs hover:bg-neutral-700", focus)} onClick={() => step(-1)}>
              Back
            </button>
            <button
              type="button"
              autoFocus
              className={cx("px-2 py-1 text-xs hover:bg-neutral-700", focus)}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? "Play" : "Pause"}
            </button>
            <button type="button" className={cx("px-2 py-1 text-xs hover:bg-neutral-700", focus)} onClick={() => step(1)}>
              Next
            </button>
            <button type="button" className={cx("bg-white px-2 py-1 text-xs font-medium text-neutral-900 hover:bg-neutral-200", focus)} onClick={onExit}>
              Exit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DemoReelPage() {
  const catalogue = usePageCatalogue();
  const [playlist, setPlaylist] = useLocalStorage<string[]>("demoReel.playlist", []);
  const [speed, setSpeed] = useLocalStorage("demoReel.seconds", "10");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState(false);

  const titles = useMemo(
    () => Object.fromEntries(catalogue.map((item) => [item.slug, item.title])),
    [catalogue],
  );

  // Drop saved slugs whose screen no longer exists (once the list has loaded).
  const queue = catalogue.length > 0 ? playlist.filter((slug) => slug in titles) : playlist;

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogue.filter(
      (item) =>
        !EXCLUDED.has(item.slug) &&
        !playlist.includes(item.slug) &&
        (!q || `${item.title} ${item.sectionLabel}`.toLowerCase().includes(q)),
    );
  }, [catalogue, playlist, query]);

  function move(from: number, delta: number) {
    const to = from + delta;
    if (to < 0 || to >= queue.length) return;
    const next = [...queue];
    [next[from], next[to]] = [next[to], next[from]];
    setPlaylist(next);
  }

  const exit = useCallback(() => setPlaying(false), []);

  return (
    <div className="h-screen overflow-y-auto bg-neutral-50">
      <PageHeader
        className="pl-32"
        eyebrow="Tools"
        title="Demo Reel"
        description="Queue up screens and play them full screen. Arrow keys step, Escape exits."
        actions={
          <>
            <SegmentedControl label="Seconds per screen" options={SPEEDS} value={speed} onChange={setSpeed} />
            <button
              type="button"
              className={button.primary}
              disabled={queue.length === 0}
              onClick={() => setPlaying(true)}
            >
              Play reel
            </button>
          </>
        }
      />
      <div className="mx-auto grid max-w-6xl gap-4 p-6 lg:grid-cols-2">
        <SectionCard flush title="All screens" subtitle={`${available.length} available`}>
          <div className="border-b border-neutral-100 p-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a screen…"
              aria-label="Find a screen"
              className={cx("w-full rounded-none border border-neutral-300 bg-white px-3 py-1.5 text-xs", focus)}
            />
          </div>
          <ul className="max-h-[60vh] divide-y divide-neutral-100 overflow-y-auto">
            {available.map((item) => (
              <li key={item.slug} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-neutral-900">{item.title}</span>
                  <span className="block text-[11px] text-neutral-500">{item.sectionLabel}</span>
                </span>
                <button
                  type="button"
                  className={button.secondary}
                  aria-label={`Add ${item.title} to the reel`}
                  onClick={() => setPlaylist([...queue, item.slug])}
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          flush
          title="Your reel"
          subtitle={`${queue.length} ${queue.length === 1 ? "screen" : "screens"}, about ${Math.ceil((queue.length * Number(speed)) / 60)} min`}
          actions={
            queue.length > 0 && (
              <button type="button" className={button.ghost} onClick={() => setPlaylist([])}>
                Clear
              </button>
            )
          }
        >
          {queue.length === 0 ? (
            <EmptyState
              kind="first"
              title="No screens yet"
              description="Add screens from the list to build your running order."
            />
          ) : (
            <ol className="divide-y divide-neutral-100">
              {queue.map((slug, i) => (
                <li key={slug} className="flex items-center gap-2 px-3 py-2">
                  <span className="w-5 text-right text-[11px] tabular-nums text-neutral-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-900">
                    {titles[slug] ?? slug}
                  </span>
                  <button
                    type="button"
                    className={button.ghost}
                    disabled={i === 0}
                    aria-label={`Move ${titles[slug] ?? slug} up`}
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={button.ghost}
                    disabled={i === queue.length - 1}
                    aria-label={`Move ${titles[slug] ?? slug} down`}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={button.ghost}
                    aria-label={`Remove ${titles[slug] ?? slug}`}
                    onClick={() => setPlaylist(queue.filter((s) => s !== slug))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
      <p className={cx("px-6 pb-6 text-center", text.muted)}>The reel is saved in this browser.</p>
      {playing && queue.length > 0 && (
        <Player slugs={queue} titles={titles} seconds={Number(speed)} onExit={exit} />
      )}
    </div>
  );
}
