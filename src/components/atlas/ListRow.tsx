import GalleryThumb from "../gallery/GalleryThumb";
import Highlight from "./Highlight";
import NewBadge from "./NewBadge";
import { isNew, relativeAdded, type AtlasItem } from "../../lib/atlasCatalog";

/* ListRow — one scannable row in the Atlas list view: small thumbnail,
 * title + description, tags, section and added date. The whole row is a
 * button; the list container moves focus between rows with the arrow keys. */

type Props = {
  item: AtlasItem;
  query: string;
  onOpen: (slug: string) => void;
};

export default function ListRow({ item, query, onOpen }: Props) {
  return (
    <button
      data-atlas-row
      type="button"
      onClick={() => onOpen(item.slug)}
      className="group grid w-full grid-cols-[72px_1fr_auto] items-center gap-4 rounded-xl border border-transparent px-3 py-2.5 text-left transition hover:border-stone-200 hover:bg-white hover:shadow-sm focus:outline-none focus-visible:border-stone-300 focus-visible:bg-white focus-visible:shadow-sm sm:grid-cols-[72px_minmax(0,2fr)_minmax(0,1fr)_110px_90px]"
    >
      <span className="block h-11 w-[72px] overflow-hidden rounded-lg">
        <GalleryThumb motif={item.motif} accent={item.accent} seed={item.seed} />
      </span>

      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold tracking-tight text-neutral-900">
            <Highlight text={item.title} query={query} />
          </span>
          {isNew(item) && <NewBadge />}
        </span>
        <span className="mt-0.5 block truncate text-xs text-neutral-500">
          <Highlight text={item.description} query={query} />
        </span>
      </span>

      <span className="hidden min-w-0 flex-wrap gap-1 sm:flex">
        {item.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-neutral-500"
          >
            #{tag}
          </span>
        ))}
      </span>

      <span className="hidden sm:block">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600"
          style={{ backgroundColor: `${item.accent.from}1a` }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: item.accent.from }}
          />
          {item.sectionLabel}
        </span>
      </span>

      <span className="hidden text-right text-[11px] tabular-nums text-neutral-400 sm:block">
        {relativeAdded(item.addedAt)}
      </span>
    </button>
  );
}
