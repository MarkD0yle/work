import GalleryThumb from "../gallery/GalleryThumb";
import NewBadge from "./NewBadge";
import { isNew, relativeAdded, type AtlasItem } from "../../lib/atlasCatalog";

/* RecentRail — a Dribbble-style horizontal strip of the latest additions,
 * shown above the main view when no filters are active. Gives "what's new
 * on the branch" a permanent, glanceable home. */

type Props = {
  items: AtlasItem[];
  onOpen: (slug: string) => void;
};

export default function RecentRail({ items, onOpen }: Props) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Recently added" className="mb-8">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900">
          Recently added
        </h2>
        <span className="text-[11px] text-neutral-400">
          newest work on the branch
        </span>
      </div>
      <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {items.map((item) => (
          <button
            key={item.slug}
            type="button"
            onClick={() => onOpen(item.slug)}
            className="group w-52 shrink-0 overflow-hidden rounded-xl border border-stone-200/80 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40"
          >
            <span className="relative block aspect-[16/10] w-full overflow-hidden">
              <span className="block h-full w-full transition-transform duration-300 group-hover:scale-[1.05]">
                <GalleryThumb
                  motif={item.motif}
                  accent={item.accent}
                  seed={item.seed}
                />
              </span>
              {isNew(item) && <NewBadge className="absolute right-2 top-2" />}
            </span>
            <span className="block p-3">
              <span className="block truncate text-[13px] font-semibold tracking-tight text-neutral-900">
                {item.title}
              </span>
              <span className="mt-0.5 block text-[11px] text-neutral-400">
                {item.sectionLabel} · {relativeAdded(item.addedAt)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
