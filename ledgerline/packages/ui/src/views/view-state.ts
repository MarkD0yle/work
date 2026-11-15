/**
 * Saved-view logic (SPEC 7.2): schema migration, comparing and diffing view state, and carrying an
 * unsaved diff in a URL so a view can be shared by link.
 */
import type { FilterCondition, SavedView } from '@ledgerline/contracts';

export type ViewState = SavedView['state'];

/** What a grid tells the view system about its columns, so old views can be brought up to date. */
export interface ViewSchema {
  /** Current schema version of this grid's views. Bump it whenever a column is renamed or removed. */
  version: number;
  /** Every column the grid has today, in default order. */
  columns: string[];
  /**
   * Renames by the version that introduced them: `{ 2: { securityId: 'security' } }` means that
   * a view saved before version 2 has `securityId` where the grid now has `security`.
   */
  renames?: Record<number, Record<string, string>>;
}

export interface MigratedView {
  state: ViewState;
  schemaVersion: number;
  /** Columns the view referred to that no longer exist. The view loads without them, with a warning. */
  dropped: string[];
  migrated: boolean;
}

/** Brings a saved view up to the grid's current schema. Never throws: an old view always loads. */
export function migrateView(
  view: Pick<SavedView, 'state' | 'schemaVersion'>,
  schema: ViewSchema,
): MigratedView {
  let rename = (field: string) => field;
  for (let v = view.schemaVersion + 1; v <= schema.version; v += 1) {
    const step = schema.renames?.[v];
    if (!step) continue;
    const previous = rename;
    rename = (field) => step[previous(field)] ?? previous(field);
  }
  const known = new Set(schema.columns);
  const dropped = new Set<string>();
  const keep = <T extends { field: string }>(items: T[]): T[] =>
    items.flatMap((item) => {
      const field = rename(item.field);
      if (known.has(field)) return [{ ...item, field }];
      dropped.add(item.field);
      return [];
    });

  const seen = new Set<string>();
  const columns = keep(view.state.columns).filter((c) => !seen.has(c.field) && seen.add(c.field));
  // Columns added to the grid since the view was saved appear at the end, visible.
  for (const field of schema.columns) if (!seen.has(field)) columns.push({ field, visible: true });

  const grouping = view.state.grouping?.flatMap((field) => {
    const next = rename(field);
    if (known.has(next)) return [next];
    dropped.add(field);
    return [];
  });

  const state: ViewState = {
    columns,
    sort: keep(view.state.sort),
    // Filters may use fields that are not columns (for example "created by"), so they are renamed but never dropped.
    filters: view.state.filters.map((f) => ({ ...f, field: rename(f.field) })),
    ...(view.state.quickSearch ? { quickSearch: view.state.quickSearch } : {}),
    ...(grouping?.length ? { grouping } : {}),
    ...(view.state.density ? { density: view.state.density } : {}),
  };
  return {
    state,
    schemaVersion: schema.version,
    dropped: [...dropped],
    migrated: view.schemaVersion !== schema.version || dropped.size > 0,
  };
}

/** The grid's own default: every column visible in default order, nothing else. "Restore default" never means empty. */
export function defaultViewState(schema: ViewSchema): ViewState {
  return { columns: schema.columns.map((field) => ({ field, visible: true })), sort: [], filters: [] };
}

/** One canonical form, so two states that mean the same thing compare equal. */
export function normaliseView(state: ViewState): ViewState {
  return {
    columns: state.columns.map((c) => ({
      field: c.field,
      visible: c.visible,
      ...(c.width === undefined ? {} : { width: Math.round(c.width) }),
      ...(c.pinned ? { pinned: c.pinned } : {}),
    })),
    sort: state.sort.map((s) => ({ field: s.field, dir: s.dir })),
    filters: state.filters,
    ...(state.quickSearch?.trim() ? { quickSearch: state.quickSearch.trim() } : {}),
    ...(state.grouping?.length ? { grouping: state.grouping } : {}),
    ...(state.density ? { density: state.density } : {}),
  };
}

const KEYS = ['columns', 'sort', 'filters', 'quickSearch', 'grouping', 'density'] as const;
type Key = (typeof KEYS)[number];
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function viewsEqual(a: ViewState, b: ViewState): boolean {
  const [x, y] = [normaliseView(a), normaliseView(b)];
  return KEYS.every((key) => same(x[key], y[key]));
}

/** The parts of `current` that differ from `base`. A cleared part is carried as null so it can be re-applied. */
export type ViewDiff = { [K in Key]?: ViewState[K] | null };

export function diffView(base: ViewState, current: ViewState): ViewDiff {
  const [x, y] = [normaliseView(base), normaliseView(current)];
  const diff: Record<string, unknown> = {};
  for (const key of KEYS) if (!same(x[key], y[key])) diff[key] = y[key] ?? null;
  return diff as ViewDiff;
}

export function applyViewDiff(base: ViewState, diff: ViewDiff): ViewState {
  const next: Record<string, unknown> = { ...normaliseView(base) };
  for (const key of KEYS) {
    if (!(key in diff)) continue;
    if (diff[key] === null || diff[key] === undefined) delete next[key];
    else next[key] = diff[key];
  }
  return next as unknown as ViewState;
}

/** URL-safe text for an unsaved diff. Empty string when there is nothing to carry. */
export function encodeViewDiff(diff: ViewDiff): string {
  if (Object.keys(diff).length === 0) return '';
  const bytes = new TextEncoder().encode(JSON.stringify(diff));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** Reads a diff from a URL. A damaged or hand-edited value is ignored rather than breaking the screen. */
export function decodeViewDiff(text: string | null | undefined): ViewDiff {
  if (!text) return {};
  try {
    const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
    const parsed: unknown = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))),
    );
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([key]) => (KEYS as readonly string[]).includes(key)),
    ) as ViewDiff;
  } catch {
    return {};
  }
}

/** Conditions applied to the query: each filter, plus quick search. The filter tags on screen must show exactly these. */
export function countConditions(state: Pick<ViewState, 'filters' | 'quickSearch'>): number {
  return state.filters.length + (state.quickSearch?.trim() ? 1 : 0);
}

export const filterEquals = (a: FilterCondition, b: FilterCondition): boolean => same(a, b);

/** The view a user starts on: their team's default if one is set, otherwise the grid default. */
export function startingView(views: SavedView[], team: string): SavedView | undefined {
  return (
    views.find((v) => v.defaultForTeam === team) ?? views.find((v) => v.ownership === 'default') ?? views[0]
  );
}
