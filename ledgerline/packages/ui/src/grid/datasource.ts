import type { GridQuery, GridResponse } from '@ledgerline/contracts';
import type { IDatasource, IGetRowsParams } from 'ag-grid-community';
import { toGroupRow, type GroupRow } from './grouping';

export interface QueryContext {
  filters: NonNullable<GridQuery['filters']>;
  quickSearch: string;
}

interface WindowRequest {
  startRow: number;
  endRow: number;
  sortModel: { colId: string; sort: 'asc' | 'desc' | null | undefined }[];
  /** Server-side grouping: the columns grouped by, and the values of the groups already opened. */
  groupBy?: string[];
  groupKeys?: string[];
}

/** Maps what the grid asks for onto the shared `/…/query` contract (API.md). */
export function toGridQuery(request: WindowRequest, context: QueryContext): GridQuery {
  const sort = request.sortModel.flatMap((s) => (s.sort ? [{ field: s.colId, dir: s.sort }] : []));
  const quickSearch = context.quickSearch.trim();
  return {
    startRow: request.startRow,
    endRow: request.endRow,
    ...(sort.length ? { sort } : {}),
    ...(context.filters.length ? { filters: context.filters } : {}),
    ...(quickSearch ? { quickSearch } : {}),
    ...(request.groupBy?.length ? { groupBy: request.groupBy, groupKeys: request.groupKeys ?? [] } : {}),
  };
}

export interface DatasourceHooks<Row> {
  /** Read at request time, so filter and search changes need no new datasource. */
  context: () => QueryContext;
  onLoaded: (response: GridResponse<Row>, query: GridQuery) => void;
  onError: (error: unknown) => void;
}

type Query<Row> = (query: GridQuery) => Promise<GridResponse<Row>>;

/** Community: the infinite row model loads blocks of rows as the user scrolls. */
export function createInfiniteDatasource<Row>(query: Query<Row>, hooks: DatasourceHooks<Row>): IDatasource {
  return {
    getRows(params: IGetRowsParams<Row>) {
      const gridQuery = toGridQuery(params, hooks.context());
      query(gridQuery).then(
        (response) => {
          params.successCallback(response.rows, response.totalRows);
          hooks.onLoaded(response, gridQuery);
        },
        (error: unknown) => {
          params.failCallback();
          hooks.onError(error);
        },
      );
    },
  };
}

/** Structural type of the Enterprise server-side request, so this file needs no Enterprise import. */
interface ServerSideParams<Row> {
  request: {
    startRow: number | undefined;
    endRow: number | undefined;
    sortModel: WindowRequest['sortModel'];
    rowGroupCols?: { id: string }[];
    groupKeys?: string[];
  };
  success: (result: { rowData: (Row | GroupRow)[]; rowCount: number }) => void;
  fail: () => void;
}

/** Enterprise: the server-side row model. Same contract, same query function. */
export function createServerSideDatasource<Row>(query: Query<Row>, hooks: DatasourceHooks<Row>) {
  return {
    getRows(params: ServerSideParams<Row>) {
      const startRow = params.request.startRow ?? 0;
      const gridQuery = toGridQuery(
        {
          startRow,
          endRow: params.request.endRow ?? startRow + 100,
          // Group rows are ordered by the server; sorting on a grouped column would only reorder inside groups.
          sortModel: params.request.sortModel.filter((s) => s.colId !== 'ag-Grid-AutoColumn'),
          groupBy: (params.request.rowGroupCols ?? []).map((c) => c.id),
          groupKeys: params.request.groupKeys ?? [],
        },
        hooks.context(),
      );
      query(gridQuery).then(
        (response) => {
          params.success({
            rowData: response.groups ? response.groups.map(toGroupRow) : response.rows,
            rowCount: response.totalRows,
          });
          hooks.onLoaded(response, gridQuery);
        },
        (error: unknown) => {
          params.fail();
          hooks.onError(error);
        },
      );
    },
  };
}
