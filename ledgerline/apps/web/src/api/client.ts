import type {
  AccountingPeriod,
  EntityKind,
  EntityRef,
  EntitySearchResult,
  MarketCalendar,
  Message,
  MutationResult,
  Permission,
  SavedView,
  User,
  Workspace,
} from '@ledgerline/contracts';
import { useSession } from '../state/session';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly messages: Message[],
    /** The full error body. A 409 carries the current `record`; a 403 carries the `permission`. */
    readonly body: Record<string, unknown> = {},
  ) {
    super(messages[0]?.text ?? `Request failed (${status})`);
  }
}

const UNREACHABLE: Message = {
  code: 'LL-NET-0001',
  severity: 'error',
  level: 'operation',
  text: 'The Ledgerline API did not respond.',
  fix: 'Check that the API is running (pnpm dev), then retry.',
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const userId = useSession.getState().userId;
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(userId ? { 'X-LL-User': userId } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(0, [UNREACHABLE]);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const messages = (body as { messages?: Message[] } | null)?.messages;
    throw new ApiError(
      response.status,
      messages?.length ? messages : [UNREACHABLE],
      (body as Record<string, unknown> | null) ?? {},
    );
  }
  return body as T;
}

export interface Me {
  user: User;
  startupWorkspaces: { id: string; name: string }[];
  /** The engine's business date. Date shortcuts count from here, not from the browser clock. */
  businessDate: string;
}

export const fetchUsers = () => api<User[]>('/users');
export const fetchMe = () => api<Me>('/me');
export const fetchPermissions = () => api<Permission[]>('/me/permissions');

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
export const post = <T>(path: string, body: unknown) => api<T>(path, json('POST', body));
export const put = <T>(path: string, body: unknown) => api<T>(path, json('PUT', body));
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });

// ── Saved views and workspaces ──
export type SavedViewInput = Pick<SavedView, 'gridId' | 'name' | 'ownership' | 'state' | 'schemaVersion'>;
export const fetchViews = (gridId: string) => api<SavedView[]>(`/views?gridId=${encodeURIComponent(gridId)}`);
export const createView = (input: SavedViewInput) => post<MutationResult<SavedView>>('/views', input);
export const updateView = (id: string, input: SavedViewInput) =>
  put<MutationResult<SavedView>>(`/views/${id}`, input);
export const deleteView = (id: string) => del<unknown>(`/views/${id}`);

export type WorkspaceInput = Omit<Workspace, 'id' | 'owner'>;
export const fetchWorkspaces = () => api<Workspace[]>('/workspaces');
export const createWorkspace = (input: WorkspaceInput) =>
  post<MutationResult<Workspace>>('/workspaces', input);
export const updateWorkspace = (id: string, input: WorkspaceInput) =>
  put<MutationResult<Workspace>>(`/workspaces/${id}`, input);
export const deleteWorkspace = (id: string) => del<unknown>(`/workspaces/${id}`);

// ── Entities, periods, calendars ──
export interface EntitySearchOptions {
  includeInactive?: boolean;
  scope?: 'held';
  type?: string;
  currency?: string;
}

export function searchEntities(
  kind: EntityKind,
  q: string,
  options: EntitySearchOptions = {},
): Promise<EntitySearchResult[]> {
  const params = new URLSearchParams({ kind, q });
  if (options.includeInactive) params.set('includeInactive', 'true');
  if (options.scope) params.set('scope', options.scope);
  if (options.type) params.set('type', options.type);
  if (options.currency) params.set('currency', options.currency);
  return api<EntitySearchResult[]>(`/entities/search?${params.toString()}`);
}
export const recentEntities = (kind: EntityKind) =>
  api<EntitySearchResult[]>(`/entities/recent?kind=${kind}`);
/** Remembers a pick for the recent list. Best effort: a failure here must never block the user's choice. */
export const rememberEntity = (ref: EntityRef) =>
  fetch('/api/v1/entities/recent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-LL-User': useSession.getState().userId ?? '' },
    body: JSON.stringify({ kind: ref.kind, id: ref.id }),
  }).catch(() => undefined);

export const fetchPeriods = (portfolioId: string) =>
  api<AccountingPeriod[]>(`/periods?portfolioId=${encodeURIComponent(portfolioId)}`);
export const fetchCalendar = (market: string) =>
  api<MarketCalendar>(`/calendars/${encodeURIComponent(market)}`);
