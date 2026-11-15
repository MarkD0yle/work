import type { MutationResult, SavedView, User, Workspace } from '@ledgerline/contracts';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Clock } from '../app';
import { schema, type Db } from '../db/client';
import { actorOf, writeAudit } from '../lib/audit';
import { HttpError, problem } from '../lib/http';
import * as schemas from '../schemas/index';

type ViewRow = typeof schema.views.$inferSelect;
type WorkspaceRow = typeof schema.workspaces.$inferSelect;

const toView = ({ defaultForTeam, ...row }: ViewRow): SavedView => ({
  ...row,
  ...(defaultForTeam ? { defaultForTeam } : {}),
});

const toWorkspace = ({ group, poppedOut, isTeamDefault, ...row }: WorkspaceRow): Workspace => ({
  ...row,
  ...(group ? { group } : {}),
  ...(poppedOut ? { poppedOut } : {}),
  ...(isTeamDefault ? { isTeamDefault } : {}),
});

const isAdmin = (user: User) => user.segment === 'admin';

/** Owners change their own views and workspaces. Administrators can too, so ownership can be reassigned when someone leaves. */
function requireOwner(user: User, owner: { id: string; name: string }, what: string, id: string): void {
  if (owner.id === user.id || isAdmin(user)) return;
  throw new HttpError(
    403,
    [
      problem(
        'LL-VIEW-0403',
        `Only ${owner.name} can change this ${what}.`,
        'Save your own copy, or ask the owner or an administrator.',
        id,
      ),
    ],
    {
      permission: {
        action: `${what}.update`,
        accessLevel: 'view',
        allowed: false,
        reason: 'role',
        explanation: `Only ${owner.name}, who owns this ${what}, can change it.`,
      },
    },
  );
}

const nextId = (db: Db, table: 'views' | 'workspaces', prefix: string) => {
  const n = (db.$client.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
  for (let i = n + 1; ; i += 1) {
    const id = `${prefix}-${String(i).padStart(5, '0')}`;
    if (!db.$client.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id)) return id;
  }
};

export function registerViewRoutes(app: FastifyInstance, db: Db, base: string, clock: Clock): void {
  // ── Saved views ─────────────────────────────────────────
  const loadView = (id: string): ViewRow => {
    const row = db.select().from(schema.views).where(eq(schema.views.id, id)).get();
    if (!row)
      throw new HttpError(404, [
        problem('LL-VIEW-0404', 'That view no longer exists.', 'Choose another view.', id),
      ]);
    return row;
  };
  const canSee = (row: ViewRow, user: User) => row.ownership !== 'personal' || row.owner.id === user.id;

  app.get<{ Querystring: { gridId?: string } }>(`${base}/views`, async (request): Promise<SavedView[]> => {
    const rows = request.query.gridId
      ? db.select().from(schema.views).where(eq(schema.views.gridId, request.query.gridId)).all()
      : db.select().from(schema.views).all();
    const order = { default: 0, shared: 1, personal: 2 } as const;
    return rows
      .filter((row) => canSee(row, request.user))
      .sort((a, b) => order[a.ownership] - order[b.ownership] || a.name.localeCompare(b.name))
      .map(toView);
  });

  app.post(`${base}/views`, async (request, reply): Promise<MutationResult<SavedView>> => {
    const input = schemas.savedViewInput.parse(request.body);
    if (
      (input.ownership === 'default' || input.defaultForTeam) &&
      !isAdmin(request.user) &&
      input.defaultForTeam !== request.user.team
    ) {
      throw new HttpError(403, [
        problem(
          'LL-VIEW-0401',
          'Only an administrator can set a default view for another team.',
          'Save it as a personal or shared view instead.',
        ),
      ]);
    }
    const row: ViewRow = {
      id: nextId(db, 'views', 'V'),
      gridId: input.gridId,
      name: input.name.trim(),
      ownership: input.ownership,
      owner: actorOf(request.user),
      defaultForTeam: input.defaultForTeam ?? null,
      state: input.state,
      schemaVersion: input.schemaVersion,
      updatedAt: clock.now(),
    };
    if (!row.name)
      throw new HttpError(400, [
        { ...problem('LL-VIEW-0001', 'A view needs a name.', 'Enter a name.', 'name'), level: 'field' },
      ]);
    db.insert(schema.views).values(row).run();
    const audit = writeAudit(db, {
      action: 'view.create',
      recordType: 'view',
      recordId: row.id,
      actor: row.owner,
      at: row.updatedAt,
      after: { name: row.name, ownership: row.ownership },
    });
    reply.code(201);
    return { record: toView(row), auditEventIds: [audit] };
  });

  app.put<{ Params: { id: string } }>(
    `${base}/views/:id`,
    async (request): Promise<MutationResult<SavedView>> => {
      const existing = loadView(request.params.id);
      if (!canSee(existing, request.user)) loadView('');
      // A shared view can only be overwritten by its owner; everyone else saves a personal copy (SPEC 7.2).
      requireOwner(request.user, existing.owner, 'view', existing.id);
      const input = schemas.savedViewInput.parse(request.body);
      const next: ViewRow = {
        ...existing,
        name: input.name.trim() || existing.name,
        ownership: input.ownership,
        owner: input.owner ?? existing.owner,
        defaultForTeam: input.defaultForTeam ?? null,
        state: input.state,
        schemaVersion: input.schemaVersion,
        updatedAt: clock.now(),
      };
      db.update(schema.views).set(next).where(eq(schema.views.id, existing.id)).run();
      const audit = writeAudit(db, {
        action: 'view.update',
        recordType: 'view',
        recordId: existing.id,
        actor: actorOf(request.user),
        at: next.updatedAt,
        before: {
          name: existing.name,
          ownership: existing.ownership,
          owner: existing.owner.id,
          state: existing.state,
        },
        after: { name: next.name, ownership: next.ownership, owner: next.owner.id, state: next.state },
      });
      return { record: toView(next), auditEventIds: [audit] };
    },
  );

  app.delete<{ Params: { id: string } }>(
    `${base}/views/:id`,
    async (request): Promise<{ auditEventIds: string[] }> => {
      const existing = loadView(request.params.id);
      requireOwner(request.user, existing.owner, 'view', existing.id);
      if (existing.ownership === 'default') {
        throw new HttpError(422, [
          problem(
            'LL-VIEW-0422',
            'The default view cannot be deleted.',
            'Restore default always needs it. Change it instead.',
            existing.id,
          ),
        ]);
      }
      db.delete(schema.views).where(eq(schema.views.id, existing.id)).run();
      const audit = writeAudit(db, {
        action: 'view.delete',
        recordType: 'view',
        recordId: existing.id,
        actor: actorOf(request.user),
        at: clock.now(),
        before: { name: existing.name, ownership: existing.ownership },
      });
      return { auditEventIds: [audit] };
    },
  );

  // ── Workspaces ──────────────────────────────────────────
  const loadWorkspace = (id: string): WorkspaceRow => {
    const row = db.select().from(schema.workspaces).where(eq(schema.workspaces.id, id)).get();
    if (!row)
      throw new HttpError(404, [
        problem('LL-WSP-0404', 'That workspace no longer exists.', 'Choose another workspace.', id),
      ]);
    return row;
  };

  app.get(`${base}/workspaces`, async (request): Promise<Workspace[]> =>
    db
      .select()
      .from(schema.workspaces)
      .all()
      // Yours, plus your team's defaults: a new user never starts with an empty list.
      .filter(
        (w) =>
          w.owner.id === request.user.id ||
          (w.isTeamDefault && w.group === request.user.team) ||
          isAdmin(request.user),
      )
      .sort(
        (a, b) =>
          Number(b.isTeamDefault ?? false) - Number(a.isTeamDefault ?? false) || a.name.localeCompare(b.name),
      )
      .map(toWorkspace),
  );

  app.post(`${base}/workspaces`, async (request, reply): Promise<MutationResult<Workspace>> => {
    const input = schemas.workspaceInput.parse(request.body);
    if (!input.name.trim())
      throw new HttpError(400, [
        { ...problem('LL-WSP-0001', 'A workspace needs a name.', 'Enter a name.', 'name'), level: 'field' },
      ]);
    const row: WorkspaceRow = {
      id: nextId(db, 'workspaces', 'W'),
      name: input.name.trim(),
      owner: actorOf(request.user),
      group: input.group ?? null,
      loadAtStartup: input.loadAtStartup,
      layout: input.layout,
      poppedOut: input.poppedOut ?? null,
      isTeamDefault:
        input.isTeamDefault && (isAdmin(request.user) || input.group === request.user.team) ? true : null,
      panels: input.panels,
    };
    db.insert(schema.workspaces).values(row).run();
    const audit = writeAudit(db, {
      action: 'workspace.create',
      recordType: 'workspace',
      recordId: row.id,
      actor: row.owner,
      at: clock.now(),
      after: { name: row.name, panels: row.panels },
    });
    reply.code(201);
    return { record: toWorkspace(row), auditEventIds: [audit] };
  });

  app.put<{ Params: { id: string } }>(
    `${base}/workspaces/:id`,
    async (request): Promise<MutationResult<Workspace>> => {
      const existing = loadWorkspace(request.params.id);
      requireOwner(request.user, existing.owner, 'workspace', existing.id);
      const input = schemas.workspaceInput.parse(request.body);
      const next: WorkspaceRow = {
        ...existing,
        name: input.name.trim() || existing.name,
        owner: input.owner ?? existing.owner,
        group: input.group ?? null,
        loadAtStartup: input.loadAtStartup,
        layout: input.layout,
        poppedOut: input.poppedOut ?? null,
        isTeamDefault: input.isTeamDefault ?? null,
        panels: input.panels,
      };
      db.update(schema.workspaces).set(next).where(eq(schema.workspaces.id, existing.id)).run();
      const audit = writeAudit(db, {
        action: 'workspace.update',
        recordType: 'workspace',
        recordId: existing.id,
        actor: actorOf(request.user),
        at: clock.now(),
        before: {
          name: existing.name,
          owner: existing.owner.id,
          loadAtStartup: existing.loadAtStartup,
          layout: existing.layout,
          panels: existing.panels,
        },
        after: {
          name: next.name,
          owner: next.owner.id,
          loadAtStartup: next.loadAtStartup,
          layout: next.layout,
          panels: next.panels,
        },
      });
      return { record: toWorkspace(next), auditEventIds: [audit] };
    },
  );

  app.delete<{ Params: { id: string } }>(
    `${base}/workspaces/:id`,
    async (request): Promise<{ auditEventIds: string[] }> => {
      const existing = loadWorkspace(request.params.id);
      requireOwner(request.user, existing.owner, 'workspace', existing.id);
      db.delete(schema.workspaces).where(eq(schema.workspaces.id, existing.id)).run();
      const audit = writeAudit(db, {
        action: 'workspace.delete',
        recordType: 'workspace',
        recordId: existing.id,
        actor: actorOf(request.user),
        at: clock.now(),
        before: { name: existing.name },
      });
      return { auditEventIds: [audit] };
    },
  );
}
