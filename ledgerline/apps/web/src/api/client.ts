import type { Message, Permission, User } from '@ledgerline/contracts';
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
}

export const fetchUsers = () => api<User[]>('/users');
export const fetchMe = () => api<Me>('/me');
export const fetchPermissions = () => api<Permission[]>('/me/permissions');
