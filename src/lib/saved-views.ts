/* Saved views — spec v0.1.2 §3.
 *
 * Named filter combinations pinned to the lens row. One-click switching
 * between scopes; right-click to rename / delete / set default / share.
 *
 * Persistence: localStorage for the prototype (spec §3.6 fallback). Real
 * impl wires to the user-preferences backend — same shape, swap the repo.
 *
 * Hard rule (spec §6, rule 23): inline editable, no settings page.
 */

import type { Lens } from "../components/ops-overview/LensBar";
import { ME } from "./qlik";

export type SavedViewScope = "personal" | "team";

export interface SavedView {
  id: string;
  name: string;
  owner: string;
  scope: SavedViewScope;
  lens: Lens;
  isDefault: boolean;
  /** System views can't be deleted (spec §3.4). */
  isSystem?: boolean;
  createdAt: string;
  lastUsedAt: string;
}

const STORAGE_KEY = "ccymgmt.savedViews.v1";

const SYSTEM_VIEWS: SavedView[] = [
  {
    id: "sys-needs-attention",
    name: "Needs my attention",
    owner: "system",
    scope: "personal",
    lens: "needs_attention",
    isDefault: true,
    isSystem: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastUsedAt: "2026-01-01T00:00:00.000Z",
  },
];

const TEAM_SEED: SavedView[] = [
  {
    id: "team-emea-close",
    name: "EMEA close",
    owner: "Sriram K",
    scope: "team",
    lens: "amber",
    isDefault: false,
    createdAt: "2026-03-01T08:00:00.000Z",
    lastUsedAt: "2026-05-20T15:30:00.000Z",
  },
  {
    id: "team-all-open",
    name: "All open",
    owner: "Howard W",
    scope: "team",
    lens: "unacked",
    isDefault: false,
    createdAt: "2026-02-15T08:00:00.000Z",
    lastUsedAt: "2026-05-22T11:00:00.000Z",
  },
];

interface PersistedState {
  views: SavedView[];
}

function loadState(): PersistedState {
  if (typeof window === "undefined") return { views: [...SYSTEM_VIEWS, ...TEAM_SEED] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { views: [...SYSTEM_VIEWS, ...TEAM_SEED] };
    const parsed = JSON.parse(raw) as PersistedState;
    // Always re-merge system views — they're undeletable and may evolve.
    const userViews = parsed.views.filter((v) => !v.isSystem);
    return { views: [...SYSTEM_VIEWS, ...userViews] };
  } catch {
    return { views: [...SYSTEM_VIEWS, ...TEAM_SEED] };
  }
}

function saveState(state: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    const userViews = state.views.filter((v) => !v.isSystem);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ views: userViews }));
  } catch {
    // Swallow — storage may be full / blocked. Spec §3.6: localStorage is
    // a fallback; persistence failure should not block UI.
  }
}

class SavedViewsRepo {
  private state: PersistedState = loadState();
  private subscribers = new Set<() => void>();

  snapshot(): SavedView[] {
    return this.state.views;
  }

  subscribe(fn: () => void) {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  create(input: { name: string; lens: Lens; scope: SavedViewScope }): SavedView {
    const view: SavedView = {
      id: `view-${Date.now().toString(36)}`,
      name: input.name,
      owner: ME,
      scope: input.scope,
      lens: input.lens,
      isDefault: false,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };
    this.state = { views: [...this.state.views, view] };
    this.persist();
    return view;
  }

  rename(id: string, name: string) {
    this.state = {
      views: this.state.views.map((v) =>
        v.id === id && !v.isSystem ? { ...v, name } : v,
      ),
    };
    this.persist();
  }

  remove(id: string) {
    this.state = {
      views: this.state.views.filter((v) => v.id !== id || v.isSystem),
    };
    this.persist();
  }

  setDefault(id: string) {
    this.state = {
      views: this.state.views.map((v) => ({ ...v, isDefault: v.id === id })),
    };
    this.persist();
  }

  touch(id: string) {
    this.state = {
      views: this.state.views.map((v) =>
        v.id === id ? { ...v, lastUsedAt: new Date().toISOString() } : v,
      ),
    };
    this.persist();
  }

  private persist() {
    saveState(this.state);
    for (const fn of this.subscribers) fn();
  }
}

export const savedViewsRepo = new SavedViewsRepo();

const URL_PARAM = "view";

export function readUrlView(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(URL_PARAM);
}

export function writeUrlView(id: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (id == null) url.searchParams.delete(URL_PARAM);
  else url.searchParams.set(URL_PARAM, id);
  window.history.replaceState({}, "", url.toString());
}
