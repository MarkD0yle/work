/**
 * Admin (SPEC 9): users, their access level per action (grouped), and blotter scope.
 * Every change is audited with before and after. An administrator cannot remove their own way back in.
 */
import type { AccessLevel, Permission, User } from '@ledgerline/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Clock } from '../app';
import type { Db } from '../db/client';
import { actorOf, writeAudit } from '../lib/audit';
import { HttpError, problem, requirePermission } from '../lib/http';

const userEdit = z.object({
  blotterScope: z.array(z.string()).nullable().exactOptional(),
  defaultDensity: z.enum(['compact', 'standard', 'comfortable']).exactOptional(),
});
const permissionEdit = z.object({
  changes: z
    .array(z.object({ action: z.string(), accessLevel: z.enum(['none', 'view', 'edit', 'full']) }))
    .min(1),
});

interface UserRaw {
  id: string;
  name: string;
  role: string;
  team: string;
  segment: User['segment'];
  default_density: User['defaultDensity'];
  blotter_scope: string | null;
}
interface PermissionRaw {
  user_id: string;
  action: string;
  access_level: AccessLevel;
  allowed: number;
  reason: Permission['reason'] | null;
  explanation: string | null;
  group: string | null;
}

export function registerAdminRoutes(app: FastifyInstance, db: Db, base: string, clock: Clock): void {
  const sqlite = db.$client;
  const toUser = (raw: UserRaw): User => ({
    id: raw.id,
    name: raw.name,
    role: raw.role,
    team: raw.team,
    segment: raw.segment,
    defaultDensity: raw.default_density,
    ...(raw.blotter_scope ? { blotterScope: JSON.parse(raw.blotter_scope) as string[] } : {}),
  });
  const toPermission = (raw: PermissionRaw): Permission => ({
    action: raw.action,
    accessLevel: raw.access_level,
    allowed: Boolean(raw.allowed),
    ...(raw.reason ? { reason: raw.reason } : {}),
    ...(raw.explanation ? { explanation: raw.explanation } : {}),
    ...(raw.group ? { group: raw.group } : {}),
  });
  const need = (id: string): UserRaw => {
    const raw = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRaw | undefined;
    if (!raw)
      throw new HttpError(404, [
        problem('LL-ADM-0404', `There is no user ${id}.`, 'Choose a user from the list.'),
      ]);
    return raw;
  };
  const permissionsOf = (userId: string) =>
    (
      sqlite
        .prepare('SELECT * FROM permissions WHERE user_id = ? ORDER BY rowid')
        .all(userId) as PermissionRaw[]
    ).map(toPermission);

  app.get(`${base}/admin/users`, async (request): Promise<User[]> => {
    requirePermission(db, request.user, 'admin.users');
    return (sqlite.prepare('SELECT * FROM users ORDER BY name').all() as UserRaw[]).map(toUser);
  });

  // Blotter scope and default density. A scope limits every list and report to those portfolios.
  app.put<{ Params: { id: string } }>(`${base}/admin/users/:id`, async (request): Promise<User> => {
    requirePermission(db, request.user, 'admin.users');
    const body = userEdit.parse(request.body);
    const raw = need(request.params.id);
    const before = toUser(raw);
    const scope =
      body.blotterScope === undefined
        ? (before.blotterScope ?? null)
        : body.blotterScope?.length
          ? [...new Set(body.blotterScope)].sort()
          : null;
    if (scope) {
      const known = new Set(
        (sqlite.prepare('SELECT id FROM portfolios').all() as { id: string }[]).map((p) => p.id),
      );
      const unknown = scope.filter((p) => !known.has(p));
      if (unknown.length)
        throw new HttpError(422, [
          {
            ...problem(
              'LL-ADM-0001',
              `These are not portfolios: ${unknown.join(', ')}.`,
              'Choose portfolios from the picker.',
              'blotterScope',
            ),
            level: 'field',
          },
        ]);
    }
    const density = body.defaultDensity ?? before.defaultDensity;
    return sqlite.transaction(() => {
      sqlite
        .prepare('UPDATE users SET blotter_scope = ?, default_density = ? WHERE id = ?')
        .run(scope ? JSON.stringify(scope) : null, density, raw.id);
      const after = toUser(need(raw.id));
      writeAudit(db, {
        action: 'admin.user.update',
        recordType: 'user',
        recordId: raw.id,
        actor: actorOf(request.user),
        at: clock.now(),
        before: { blotterScope: before.blotterScope ?? null, defaultDensity: before.defaultDensity },
        after: { blotterScope: after.blotterScope ?? null, defaultDensity: after.defaultDensity },
      });
      return after;
    })();
  });

  app.get<{ Params: { id: string } }>(
    `${base}/admin/users/:id/permissions`,
    async (request): Promise<Permission[]> => {
      requirePermission(db, request.user, 'admin.permissions');
      need(request.params.id);
      return permissionsOf(request.params.id);
    },
  );

  // Access level per action. `none` denies the action, with an explanation the user will see wherever it is disabled.
  app.put<{ Params: { id: string } }>(
    `${base}/admin/users/:id/permissions`,
    async (request): Promise<Permission[]> => {
      requirePermission(db, request.user, 'admin.permissions');
      const { changes } = permissionEdit.parse(request.body);
      const target = need(request.params.id);
      const current = new Map(permissionsOf(target.id).map((p) => [p.action, p]));
      for (const change of changes) {
        if (!current.has(change.action))
          throw new HttpError(422, [
            {
              ...problem(
                'LL-ADM-0002',
                `"${change.action}" is not an action.`,
                'Choose an action from the list.',
                change.action,
              ),
              level: 'field',
            },
          ]);
      }
      // An administrator cannot lock themselves out: someone else has to take that access away.
      const lockout = changes.find(
        (c) =>
          target.id === request.user.id &&
          c.accessLevel === 'none' &&
          (c.action === 'admin.permissions' || c.action === 'admin.users'),
      );
      if (lockout) {
        throw new HttpError(409, [
          problem(
            'LL-ADM-0003',
            'You cannot remove your own administrator access.',
            'Ask another administrator to change it, so someone can always get back in.',
            lockout.action,
          ),
        ]);
      }
      const actor = actorOf(request.user);
      const at = clock.now();
      return sqlite.transaction(() => {
        for (const change of changes) {
          const before = current.get(change.action) as Permission;
          if (before.accessLevel === change.accessLevel) continue;
          const allowed = change.accessLevel !== 'none';
          sqlite
            .prepare(
              'UPDATE permissions SET access_level = ?, allowed = ?, reason = ?, explanation = ? WHERE user_id = ? AND action = ?',
            )
            .run(
              change.accessLevel,
              allowed ? 1 : 0,
              allowed ? null : 'role',
              allowed
                ? null
                : `An administrator has not given ${target.name} access to this. Ask an administrator if you need it.`,
              target.id,
              change.action,
            );
          writeAudit(db, {
            action: 'admin.permission.update',
            recordType: 'user',
            recordId: target.id,
            actor,
            at,
            // Keyed by the action, so the history reads "report.run: view → full" and names what changed.
            before: { [change.action]: before.accessLevel },
            after: { [change.action]: change.accessLevel },
          });
        }
        return permissionsOf(target.id);
      })();
    },
  );
}
