import GalleryThumb from "../gallery/GalleryThumb";
import Highlight from "./Highlight";
import NewBadge from "./NewBadge";
import { isNew, relativeAdded, type AtlasItem } from "../../lib/atlasCatalog";

/* MasonryCard — a Pinterest-style tile for the Atlas masonry view.
 *
 * Unlike the uniform File Gallery grid, each card picks one of a few
 * thumbnail aspect ratios from its stable seed, so the columns stagger the
 * way a real pin board does. Cards must not split across CSS columns, hence
 * break-inside-avoid on the root. */

// Full literal class names so Tailwind sees them at build time.
const ASPECTS = [
  "aspect-[4/5]",
  "aspect-[4/3]",
  "aspect-square",
  "aspect-[16/10]",
  "aspect-[3/4]",
] as const;

type Props = {
  item: AtlasItem;
  query: string;
  onOpen: (slug: string) => void;
  onTagClick: (tag: string) => void;
};

export default function MasonryCard({ item, query, onOpen, onTagClick }: Props) {
  const aspect = ASPECTS[item.seed % ASPECTS.length];
  return (
    <article className="group mb-5 break-inside-avoid overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-xl hover:shadow-stone-900/10">
      <button
        type="button"
        onClick={() => onOpen(item.slug)}
        aria-label={`Open ${item.title}`}
        className={`relative block w-full overflow-hidden ${aspect} focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40`}
      >
        <div className="h-full w-full transition-transform duration-300 group-hover:scale-[1.04]">
          <GalleryThumb
            motif={item.motif}
            accent={item.accent}
            seed={item.seed}
          />
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          {item.sectionLabel}
        </span>
        {isNew(item) && <NewBadge className="absolute right-3 top-3" />}
        {/* Hover veil with an inviting open affordance, Pinterest-style */}
        <span className="pointer-events-none absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/45 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="text-[10px] font-medium text-white/80">
            Added {relativeAdded(item.addedAt)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-neutral-900 shadow-sm">
            Open
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </span>
      </button>

      <div className="flex flex-col gap-1.5 p-4">
        <button
          type="button"
          onClick={() => onOpen(item.slug)}
          className="text-left focus:outline-none"
        >
          <h3 className="text-sm font-semibold tracking-tight text-neutral-900">
            <Highlight text={item.title} query={query} />
          </h3>
        </button>
        <p className="line-clamp-3 text-xs leading-relaxed text-neutral-500">
          <Highlight text={item.description} query={query} />
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagClick(tag)}
              className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-neutral-500 transition hover:border-stone-300 hover:bg-stone-100 hover:text-neutral-900"
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
