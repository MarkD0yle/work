type PageEntry = {
  slug: string;
  title: string;
};

type SidebarProps = {
  pages: PageEntry[];
  activeSlug: string;
  onSelect: (slug: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export default function Sidebar({
  pages,
  activeSlug,
  onSelect,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  return (
    <aside
      className={`flex h-screen flex-col border-r border-neutral-200 bg-white transition-[width] duration-200 ease-in-out ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      <div className="flex h-14 items-center justify-between border-b border-neutral-200 px-3">
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-neutral-900">
            pages
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 transition-transform duration-200 ${
              collapsed ? "rotate-180" : ""
            }`}
          >
            <path
              fillRule="evenodd"
              d="M12.78 5.22a.75.75 0 0 1 0 1.06L9.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <div
          className={`px-2 pb-1 text-[10px] font-medium tracking-wider uppercase text-neutral-400 ${
            collapsed ? "sr-only" : ""
          }`}
        >
          /src/pages
        </div>
        <ul className="flex flex-col gap-0.5 px-2">
          {pages.map((page) => {
            const isActive = page.slug === activeSlug;
            return (
              <li key={page.slug}>
                <button
                  type="button"
                  onClick={() => onSelect(page.slug)}
                  title={collapsed ? page.title : undefined}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                    isActive
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4 shrink-0 opacity-70"
                  >
                    <path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v10.5C2 16.216 2.784 17 3.75 17h12.5A1.75 1.75 0 0 0 18 15.25V7.75A1.75 1.75 0 0 0 16.25 6H10.5a.75.75 0 0 1-.53-.22L8.69 4.5A1.75 1.75 0 0 0 7.46 4H3.75Z" />
                  </svg>
                  {!collapsed && (
                    <span className="truncate">{page.title}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {!collapsed && (
        <div className="border-t border-neutral-200 p-3 text-[11px] text-neutral-400">
          Files in <code className="font-mono">src/pages</code> appear here
          automatically.
        </div>
      )}
    </aside>
  );
}
