import type { SavedView } from '@ledgerline/contracts';
import { describe, expect, it } from 'vitest';
import {
  applyViewDiff,
  countConditions,
  decodeViewDiff,
  defaultViewState,
  diffView,
  encodeViewDiff,
  migrateView,
  startingView,
  viewsEqual,
  type ViewSchema,
  type ViewState,
} from './view-state';

const schema: ViewSchema = {
  version: 3,
  columns: ['id', 'status', 'tradeDate', 'security', 'portfolio', 'amount', 'bookValue'],
  renames: { 2: { securityId: 'securityRef', portfolioId: 'portfolio' }, 3: { securityRef: 'security' } },
};

const v1: Pick<SavedView, 'state' | 'schemaVersion'> = {
  schemaVersion: 1,
  state: {
    columns: [
      { field: 'id', visible: true, width: 120, pinned: 'left' },
      { field: 'securityId', visible: true, width: 300 },
      { field: 'portfolioId', visible: false },
      { field: 'currency', visible: true },
      { field: 'amount', visible: true },
    ],
    sort: [
      { field: 'securityId', dir: 'asc' },
      { field: 'currency', dir: 'desc' },
    ],
    filters: [
      { field: 'portfolioId', op: 'eq', value: 'P-0001' },
      { field: 'tradeDate', op: 'relative', period: 'yesterday' },
    ],
    quickSearch: 'TREASURY',
    grouping: ['portfolioId', 'currency'],
    density: 'compact',
  },
};

describe('migrateView', () => {
  it('a view survives column renames across several schema versions', () => {
    const out = migrateView(v1, schema);
    expect(out.schemaVersion).toBe(3);
    expect(out.migrated).toBe(true);
    // securityId -> securityRef (v2) -> security (v3); width and pinning are kept.
    expect(out.state.columns.slice(0, 4)).toEqual([
      { field: 'id', visible: true, width: 120, pinned: 'left' },
      { field: 'security', visible: true, width: 300 },
      { field: 'portfolio', visible: false },
      { field: 'amount', visible: true },
    ]);
    expect(out.state.sort).toEqual([{ field: 'security', dir: 'asc' }]);
    expect(out.state.filters[0]).toEqual({ field: 'portfolio', op: 'eq', value: 'P-0001' });
    expect(out.state.grouping).toEqual(['portfolio']);
    expect(out.state).toMatchObject({ quickSearch: 'TREASURY', density: 'compact' });
  });

  it('a removed column is dropped and reported, so the view loads with a warning', () => {
    expect(migrateView(v1, schema).dropped).toEqual(['currency']);
  });

  it('columns added since the view was saved appear at the end, visible', () => {
    const fields = migrateView(v1, schema).state.columns.map((c) => c.field);
    expect(fields).toEqual(['id', 'security', 'portfolio', 'amount', 'status', 'tradeDate', 'bookValue']);
  });

  it('relative dates stay relative', () => {
    expect(migrateView(v1, schema).state.filters[1]).toEqual({
      field: 'tradeDate',
      op: 'relative',
      period: 'yesterday',
    });
  });

  it('a current view passes through unchanged', () => {
    const current = { schemaVersion: 3, state: defaultViewState(schema) };
    const out = migrateView(current, schema);
    expect(out).toMatchObject({ migrated: false, dropped: [] });
    expect(out.state).toEqual(current.state);
  });
});

describe('comparing and diffing', () => {
  const base: ViewState = {
    ...defaultViewState(schema),
    sort: [{ field: 'tradeDate', dir: 'desc' }],
    density: 'compact',
  };

  it('treats equivalent states as equal', () => {
    expect(viewsEqual(base, { ...base, quickSearch: '  ', grouping: [] })).toBe(true);
    expect(
      viewsEqual(base, {
        ...base,
        columns: base.columns.map((c, i) => (i === 0 ? { ...c, width: 120.4 } : c)),
      }),
    ).toBe(false);
  });

  it('diff holds only what changed, and applying it restores the state exactly', () => {
    const current: ViewState = {
      ...base,
      sort: [{ field: 'amount', dir: 'asc' }],
      filters: [{ field: 'status', op: 'eq', value: 'unposted' }],
      quickSearch: 'gilt',
      grouping: ['status'],
    };
    const diff = diffView(base, current);
    expect(Object.keys(diff).sort()).toEqual(['filters', 'grouping', 'quickSearch', 'sort']);
    expect(viewsEqual(applyViewDiff(base, diff), current)).toBe(true);
    expect(diffView(base, base)).toEqual({});
  });

  it('a cleared part is carried, so removing a sort or the density survives a round trip', () => {
    const current: ViewState = { ...defaultViewState(schema), sort: [] };
    const diff = diffView(base, current);
    expect(diff).toEqual({ sort: [], density: null });
    expect(viewsEqual(applyViewDiff(base, diff), current)).toBe(true);
  });

  it('round-trips through a URL, including non-ASCII text', () => {
    const diff = diffView(base, {
      ...base,
      quickSearch: 'Société Générale 4.25% €',
      filters: [{ field: 'tradeDate', op: 'relative', period: 'today' }],
    });
    const text = encodeViewDiff(diff);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeViewDiff(text)).toEqual(diff);
    expect(encodeViewDiff({})).toBe('');
  });

  it('ignores a damaged or hostile URL value', () => {
    for (const bad of ['%%%', 'bm90IGpzb24', btoa('[1,2]'), btoa('"x"'), null, ''])
      expect(decodeViewDiff(bad)).toEqual({});
    expect(decodeViewDiff(btoa(JSON.stringify({ sort: [], __proto__: { x: 1 }, evil: true })))).toEqual({
      sort: [],
    });
  });
});

describe('conditions and starting view', () => {
  it('counts each filter plus quick search', () => {
    expect(countConditions({ filters: [], quickSearch: ' ' })).toBe(0);
    expect(countConditions({ filters: v1.state.filters, quickSearch: 'x' })).toBe(3);
  });

  it('a user starts on their team default, else the grid default; never an empty list', () => {
    const view = (id: string, over: Partial<SavedView>): SavedView => ({
      id,
      gridId: 'transactions',
      name: id,
      ownership: 'shared',
      owner: { type: 'user', id: 'u-ada', name: 'Ada' },
      state: defaultViewState(schema),
      schemaVersion: 3,
      updatedAt: '',
      ...over,
    });
    const views = [
      view('default', { ownership: 'default' }),
      view('ops', { defaultForTeam: 'Transaction Operations' }),
    ];
    expect(startingView(views, 'Transaction Operations')?.id).toBe('ops');
    expect(startingView(views, 'Market Data')?.id).toBe('default');
    expect(startingView([], 'Market Data')).toBeUndefined();
  });
});
