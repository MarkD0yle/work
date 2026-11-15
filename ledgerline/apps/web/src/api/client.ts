import type { Message, MutationResult, User, Workspace } from '@ledgerline/contracts';
import type { Me } from '@ledgerline/compositions';
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

/** Fetches a file as the signed-in user and hands it to the browser to save. */
export async function download(path: string, fallbackName: string): Promise<void> {
  const userId = useSession.getState().userId;
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { headers: userId ? { 'X-LL-User': userId } : {} });
  } catch {
    throw new ApiError(0, [UNREACHABLE]);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { messages?: Message[] } | null;
    throw new ApiError(response.status, body?.messages?.length ? body.messages : [UNREACHABLE], body ?? {});
  }
  const name =
    /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** The job progress stream. The browser cannot send headers on an event stream, so the user travels in the query. */
export const openStream = (path: string) =>
  new EventSource(`/api/v1${path}?user=${encodeURIComponent(useSession.getState().userId ?? '')}`);

export const fetchUsers = () => api<User[]>('/users');
export const fetchMe = () => api<Me>('/me');

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
export const post = <T>(path: string, body: unknown) => api<T>(path, json('POST', body));
export const put = <T>(path: string, body: unknown) => api<T>(path, json('PUT', body));
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });

// ── Workspaces ──
export type WorkspaceInput = Omit<Workspace, 'id' | 'owner'>;
export const fetchWorkspaces = () => api<Workspace[]>('/workspaces');
export const createWorkspace = (input: WorkspaceInput) =>
  post<MutationResult<Workspace>>('/workspaces', input);
export const updateWorkspace = (id: string, input: WorkspaceInput) =>
  put<MutationResult<Workspace>>(`/workspaces/${id}`, input);
export const deleteWorkspace = (id: string) => del<unknown>(`/workspaces/${id}`);

// Calls shared with the compositions live there; re-exported so app code has one place to import from.
export {
  fetchPermissions,
  fetchViews,
  recentEntities,
  rememberEntity,
  searchEntities,
  type EntitySearchOptions,
  type Me,
} from '@ledgerline/compositions';
