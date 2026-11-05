import GalleryThumb from "../gallery/GalleryThumb";
import Highlight from "./Highlight";
import NewBadge from "./NewBadge";
import { isNew, type AtlasItem } from "../../lib/atlasCatalog";

/* BoardCard — a compact tile for the Atlas board (kanban) view.
 * Small thumbnail strip on top, title and a one-line description below;
 * dense enough that a column shows several patterns without scrolling. */

type Props = {
  item: AtlasItem;
  query: string;
  onOpen: (slug: string) => void;
};

export default function BoardCard({ item, query, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.slug)}
      className="group block w-full shrink-0 overflow-hidden rounded-xl border border-stone-200/80 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40"
    >
      <div className="relative h-20 w-full overflow-hidden">
        <div className="h-full w-full transition-transform duration-300 group-hover:scale-[1.05]">
          <GalleryThumb
            motif={item.motif}
            accent={item.accent}
            seed={item.seed}
          />
        </div>
        {isNew(item) && <NewBadge className="absolute right-2 top-2" />}
      </div>
      <div className="p-3">
        <h4 className="text-[13px] font-semibold tracking-tight text-neutral-900">
          <Highlight text={item.title} query={query} />
        </h4>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-neutral-500">
          <Highlight text={item.description} query={query} />
        </p>
      </div>
    </button>
  );
}
