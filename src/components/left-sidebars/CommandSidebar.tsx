import { useState } from "react";
import { ChevronRight, Search, Star } from "lucide-react";
import { cx, focus } from "../patterns/tokens";
import {
  ALL_ITEMS,
  NAV_MODULES,
  findItem,
  type FlatItem,
  type SidebarProps,
} from "./nav-model";
import { Brand, CountBadge, GroupLabel, SidebarFrame, UserFooter } from "./SidebarKit";

/* 8 — Search first.
 *
 * For people who know the name of where they are going. A filter box leads,
 * then the pages this user has pinned and the ones they opened last. The full
 * menu is still there, one module at a time, for the day someone needs a page
 * they have never used.
 *
 * Typing filters on label and on the short code, so "crc" and "cash" both
 * find Cash Reconciliation. Enter opens the first result.
 */
export function CommandSidebar({ activeId, onNavigate }: SidebarProps) {
  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<string[]>(["nav-production", "cash-rec", "breaks"]);
  const [recent, setRecent] = useState<string[]>(["pricing", "dealing", "settlements"]);
  const [openModule, setOpenModule] = useState<string | null>(null);

  function go(id: string) {
    onNavigate(id);
    setQuery("");
    if (!pinned.includes(id)) {
      setRecent((prev) => [id, ...prev.filter((r) => r !== id)].slice(0, 4));
    }
  }

  function togglePin(id: string) {
    setPinned((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  const q = query.trim().toLowerCase();
  const results = q
    ? ALL_ITEMS.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.code.toLowerCase().startsWith(q) ||
          item.module.label.toLowerCase().includes(q),
      )
    : [];

  const row = (item: FlatItem, showModule = false) => (
    <Row
      key={item.id}
      item={item}
      active={item.id === activeId}
      pinned={pinned.includes(item.id)}
      showModule={showModule}
      onOpen={() => go(item.id)}
      onTogglePin={() => togglePin(item.id)}
    />
  );

  return (
    <SidebarFrame label="Search first sidebar" className="w-64">
      <Brand />

      <div className="shrink-0 border-b border-neutral-200 p-2">
        <label className="flex items-center gap-2 border border-neutral-300 bg-white px-2.5 py-1.5 focus-within:border-neutral-900">
          <Search aria-hidden className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) go(results[0].id);
              if (e.key === "Escape") setQuery("");
            }}
            placeholder="Go to page or code"
            aria-label="Filter navigation"
            className="min-w-0 flex-1 bg-transparent text-xs text-neutral-900 outline-none placeholder:text-neutral-400"
          />
        </label>
      </div>

      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto pb-3">
        {q ? (
          <>
            <GroupLabel>
              {results.length} {results.length === 1 ? "result" : "results"}
            </GroupLabel>
            {results.length ? (
              <ul>{results.map((item) => row(item, true))}</ul>
            ) : (
              <p className="px-4 py-2 text-neutral-500">
                No page matches “{query.trim()}”. Try a module name or a code such as NAV.
              </p>
            )}
          </>
        ) : (
          <>
            <GroupLabel>Pinned</GroupLabel>
            {pinned.length ? (
              <ul>{pinned.map((id) => row(findItem(id)))}</ul>
            ) : (
              <p className="px-4 py-1 text-neutral-500">Star a page to keep it here.</p>
            )}

            <GroupLabel>Recent</GroupLabel>
            <ul>{recent.filter((id) => !pinned.includes(id)).map((id) => row(findItem(id)))}</ul>

            <GroupLabel>All modules</GroupLabel>
            <ul>
              {NAV_MODULES.map((module) => {
                const Icon = module.icon;
                const open = openModule === module.id;
                return (
                  <li key={module.id}>
                    <button
                      type="button"
                      onClick={() => setOpenModule(open ? null : module.id)}
                      aria-expanded={open}
                      className={cx(
                        "flex w-full items-center gap-2 py-1.5 pr-3 pl-4 text-left text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900",
                        focus,
                        "focus-visible:-outline-offset-2",
                      )}
                    >
                      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                      <span className="min-w-0 flex-1 truncate">{module.label}</span>
                      <ChevronRight
                        aria-hidden
                        className={cx(
                          "h-3.5 w-3.5 text-neutral-400 transition-transform motion-reduce:transition-none",
                          open && "rotate-90",
                        )}
                      />
                    </button>
                    {open && (
                      <ul className="mb-1 ml-5 border-l border-neutral-200">
                        {module.items.map((item) => row({ ...item, module }))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>
      <UserFooter />
    </SidebarFrame>
  );
}

function Row({
  item,
  active,
  pinned,
  showModule,
  onOpen,
  onTogglePin,
}: {
  item: FlatItem;
  active: boolean;
  pinned: boolean;
  showModule: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
}) {
  return (
    <li
      className={cx(
        "group/row flex items-center border-l-2",
        active
          ? "border-l-neutral-900 bg-neutral-100"
          : "border-l-transparent hover:bg-neutral-50",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-3.5 text-left",
          active ? "font-semibold text-neutral-900" : "text-neutral-700",
          focus,
          "focus-visible:-outline-offset-2",
        )}
      >
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate">{item.label}</span>
          {showModule && (
            <span className="block truncate text-[11px] font-normal text-neutral-500">
              {item.module.label} · {item.code}
            </span>
          )}
        </span>
        <CountBadge count={item.count} tone={item.tone} />
      </button>
      <button
        type="button"
        onClick={onTogglePin}
        aria-pressed={pinned}
        aria-label={`${pinned ? "Unpin" : "Pin"} ${item.label}`}
        className={cx(
          "flex h-7 w-8 shrink-0 items-center justify-center",
          pinned
            ? "text-amber-500"
            : "text-neutral-300 opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 hover:text-neutral-700",
          focus,
          "focus-visible:-outline-offset-2",
        )}
      >
        <Star aria-hidden className={cx("h-3.5 w-3.5", pinned && "fill-amber-400")} />
      </button>
    </li>
  );
}
