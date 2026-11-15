import type { Message, Permission, User } from '@ledgerline/contracts';
import { and, eq } from 'drizzle-orm';
import { schema, type Db } from '../db/client';

/** An error the API answers with `{ messages }` (and `permission` on 403), per API.md conventions. */
export class HttpError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 422,
    readonly messages: Message[],
    readonly extra: Record<string, unknown> = {},
  ) {
    super(messages[0]?.text ?? 'Request failed');
  }
}

export const problem = (code: string, text: string, fix: string, target?: string): Message => ({
  code,
  severity: 'error',
  level: 'operation',
  text,
  fix,
  ...(target ? { target } : {}),
});

export function permissionFor(db: Db, user: User, action: string): Permission {
  const row = db
    .select()
    .from(schema.permissions)
    .where(and(eq(schema.permissions.userId, user.id), eq(schema.permissions.action, action)))
    .get();
  if (!row) {
    return {
      action,
      accessLevel: 'none',
      allowed: false,
      reason: 'role',
      explanation: 'Your role does not include this action.',
    };
  }
  return {
    action: row.action,
    accessLevel: row.accessLevel,
    allowed: row.allowed,
    ...(row.reason ? { reason: row.reason } : {}),
    ...(row.explanation ? { explanation: row.explanation } : {}),
    ...(row.group ? { group: row.group } : {}),
    ...(user.blotterScope ? { blotterScope: user.blotterScope } : {}),
  };
}

/** Every endpoint enforces permissions server-side. A denial always carries the explanation. */
export function requirePermission(db: Db, user: User, action: string): Permission {
  const permission = permissionFor(db, user, action);
  if (!permission.allowed) {
    throw new HttpError(
      403,
      [
        problem(
          'LL-PERM-0001',
          permission.explanation ?? 'You are not allowed to do this.',
          'Ask an administrator if you need this access.',
        ),
      ],
      { permission },
    );
  }
  return permission;
}
