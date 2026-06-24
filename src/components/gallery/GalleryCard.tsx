import GalleryThumb from "./GalleryThumb";
import type { Accent, Motif } from "../../lib/galleryMeta";

/* GalleryCard — a single file/page tile in the Dribbble-style grid.
 *
 * The thumbnail (a stylised motif over the section accent) sits on top, with a
 * hover overlay inviting the user in. Title, one-line description and filter
 * tags sit below. The whole card is a button so the row is clickable. */

export type GalleryItem = {
  slug: string;
  title: string;
  section: string;
  sectionLabel: string;
  description: string;
  tags: string[];
  motif: Motif;
  accent: Accent;
};

type Props = {
  item: GalleryItem;
  index: number;
  query: string;
  onOpen: (slug: string) => void;
  onTagClick: (tag: string) => void;
};

// Emphasise the matched portion of a string, case-insensitively.
function highlight(text: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-200/70 px-0.5 text-inherit">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function GalleryCard({
  item,
  index,
  query,
  onOpen,
  onTagClick,
}: Props) {
  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-xl"
    >
      {/* Thumbnail — clicking opens the page */}
      <button
        type="button"
        onClick={() => onOpen(item.slug)}
        aria-label={`Open ${item.title}`}
        className="relative block aspect-[16/10] w-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/40"
      >
        <div className="h-full w-full transition-transform duration-300 group-hover:scale-[1.04]">
          <GalleryThumb motif={item.motif} accent={item.accent} seed={index + 1} />
        </div>

        {/* Section pill */}
        <span className="absolute left-3 top-3 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          {item.sectionLabel}
        </span>

        {/* Hover overlay */}
        <span className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/40 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-neutral-900 shadow-sm">
            Open
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
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

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <button
          type="button"
          onClick={() => onOpen(item.slug)}
          className="text-left focus:outline-none"
        >
          <h3 className="text-sm font-semibold tracking-tight text-neutral-900 group-hover:text-neutral-950">
            {highlight(item.title, query)}
          </h3>
        </button>
        <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500">
          {highlight(item.description, query)}
        </p>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {item.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagClick(tag)}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-600 transition hover:border-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
