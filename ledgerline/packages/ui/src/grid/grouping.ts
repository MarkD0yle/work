import type { GridGroup } from '@ledgerline/contracts';

/**
 * A group row as the grid holds it. The server returns groups (value and record count) for a group level;
 * they sit in the grid's row data beside ordinary records, so every place that reads a row must tell them apart.
 */
export interface GroupRow {
  __llGroup: true;
  field: string;
  key: string | null;
  count: number;
}

export const toGroupRow = (group: GridGroup): GroupRow => ({ __llGroup: true, ...group });

export const isGroupRow = (data: unknown): data is GroupRow =>
  typeof data === 'object' && data !== null && '__llGroup' in data;

/** The record in a grid row, or undefined for a group row or a row that has not loaded. */
export const recordOf = <Row>(data: Row | undefined): Row | undefined =>
  isGroupRow(data) ? undefined : data;

/** Stable, unique id for a group row: its path of group values. */
export const groupRowId = (parentKeys: readonly string[] | undefined, group: GroupRow): string =>
  `group:${[...(parentKeys ?? []), group.key ?? ''].join('\u001f')}`;
