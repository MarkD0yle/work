import { useEffect, useRef, useState } from "react";
import type { Lens } from "./LensBar";
import { LENS_LABEL } from "./LensBar";
import { ME } from "../../lib/qlik";
import { savedViewsRepo, type SavedView } from "../../lib/saved-views";

/* Spec v0.1.2 §3.3 — saved-view tab strip pinned to the lens row.
 *
 * Hard rule (spec §6, rule 23): inline editable. No settings page, no
 * Manage Views surface. Right-click a tab → rename / delete / set
 * default / share. + New view captures current filters with one prompt. */

interface ContextMenuState {
  viewId: string;
  x: number;
  y: number;
}

export default function SavedViewTabs({
  views,
  activeId,
  currentLens,
  onSelect,
}: {
  views: SavedView[];
  activeId: string | null;
  currentLens: Lens;
  onSelect: (view: SavedView) => void;
}) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [menu]);

  const personal = views.filter((v) => v.scope === "personal");
  const team = views.filter((v) => v.scope === "team");

  function handleNewView() {
    const name = window.prompt(
      "Name this view (captures current filters):",
      describeLens(currentLens),
    );
    if (!name) return;
    const view = savedViewsRepo.create({
      name: name.trim(),
      lens: currentLens,
      scope: "personal",
    });
    onSelect(view);
  }

  function handleRename(view: SavedView) {
    setMenu(null);
    setRenamingId(view.id);
  }

  function commitRename(view: SavedView, name: string) {
    const trimmed = name.trim();
    if (trimmed && trimmed !== view.name) savedViewsRepo.rename(view.id, trimmed);
    setRenamingId(null);
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
        Views
      </span>
      {personal.map((v) => (
        <ViewTab
          key={v.id}
          view={v}
          active={v.id === activeId}
          renaming={renamingId === v.id}
          onSelect={() => onSelect(v)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ viewId: v.id, x: e.clientX, y: e.clientY });
          }}
          onCommitRename={(name) => commitRename(v, name)}
        />
      ))}
      {team.length > 0 && (
        <span aria-hidden className="mx-1 h-3 w-px bg-neutral-200" />
      )}
      {team.map((v) => (
        <ViewTab
          key={v.id}
          view={v}
          active={v.id === activeId}
          renaming={renamingId === v.id}
          isTeam
          onSelect={() => onSelect(v)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ viewId: v.id, x: e.clientX, y: e.clientY });
          }}
          onCommitRename={(name) => commitRename(v, name)}
        />
      ))}
      <button
        type="button"
        onClick={handleNewView}
        className="rounded-full border border-dashed border-neutral-300 px-2.5 py-0.5 text-[11px] font-medium text-neutral-500 hover:border-neutral-500 hover:text-neutral-800"
      >
        + New view
      </button>

      {menu && (
        <ContextMenu
          ref={menuRef}
          view={views.find((v) => v.id === menu.viewId)!}
          x={menu.x}
          y={menu.y}
          onRename={handleRename}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

function ViewTab({
  view,
  active,
  renaming,
  isTeam,
  onSelect,
  onContextMenu,
  onCommitRename,
}: {
  view: SavedView;
  active: boolean;
  renaming: boolean;
  isTeam?: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onCommitRename: (name: string) => void;
}) {
  if (renaming) {
    return (
      <input
        autoFocus
        defaultValue={view.name}
        onBlur={(e) => onCommitRename(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommitRename((e.target as HTMLInputElement).value);
          if (e.key === "Escape") onCommitRename(view.name);
        }}
        className="rounded-full border border-blue-500 bg-white px-2.5 py-0.5 text-[11px] font-medium text-neutral-800 outline-none"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      onContextMenu={onContextMenu}
      title={isTeam ? `Team view · owner ${view.owner}` : view.name}
      className={`group inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
        active
          ? "border-blue-500 bg-blue-50 text-blue-700"
          : isTeam
            ? "border-neutral-200 bg-neutral-50/60 text-neutral-500 hover:bg-neutral-100"
            : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
      }`}
    >
      {active && (
        <span aria-hidden className="text-[9px] text-blue-600">
          ●
        </span>
      )}
      <span>{view.name}</span>
      {view.isDefault && !active && (
        <span aria-hidden title="Default" className="text-[8px] text-neutral-400">
          ★
        </span>
      )}
      {isTeam && (
        <span aria-hidden className="text-[8px] text-neutral-400">
          ◌
        </span>
      )}
    </button>
  );
}

function ContextMenu({
  view,
  x,
  y,
  onRename,
  onClose,
  ref,
}: {
  view: SavedView;
  x: number;
  y: number;
  onRename: (v: SavedView) => void;
  onClose: () => void;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const canEdit = !view.isSystem && view.owner === ME;
  const canPinAsDefault = !view.isDefault;
  return (
    <div
      ref={ref}
      style={{ left: x, top: y }}
      className="fixed z-50 min-w-[160px] rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
    >
      <MenuItem
        disabled={!canEdit}
        onClick={() => {
          if (canEdit) onRename(view);
        }}
      >
        Rename
      </MenuItem>
      <MenuItem
        disabled={!canPinAsDefault}
        onClick={() => {
          savedViewsRepo.setDefault(view.id);
          onClose();
        }}
      >
        Set as default
      </MenuItem>
      <MenuItem
        disabled={view.isSystem || view.scope === "team" || view.owner !== ME}
        onClick={() => {
          // Real impl would toggle scope to "team" here. Out of scope for
          // the v0.1.2 prototype — surfaced as a no-op the menu still shows.
          onClose();
        }}
      >
        Share with team
      </MenuItem>
      <div className="my-1 h-px bg-neutral-100" />
      <MenuItem
        disabled={view.isSystem || view.owner !== ME}
        onClick={() => {
          if (window.confirm(`Delete view "${view.name}"?`)) {
            savedViewsRepo.remove(view.id);
          }
          onClose();
        }}
        variant="danger"
      >
        Delete
      </MenuItem>
    </div>
  );
}

function MenuItem({
  disabled,
  onClick,
  children,
  variant,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  variant?: "danger";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full px-3 py-1.5 text-left text-[12px] ${
        disabled
          ? "cursor-not-allowed text-neutral-300"
          : variant === "danger"
            ? "text-red-700 hover:bg-red-50"
            : "text-neutral-700 hover:bg-neutral-50"
      }`}
    >
      {children}
    </button>
  );
}

function describeLens(lens: Lens): string {
  return LENS_LABEL[lens] ?? "Custom view";
}
