import cors from '@fastify/cors';
import type { Message, Permission, User } from '@ledgerline/contracts';
import { eq, sql } from 'drizzle-orm';
import Fastify, { type FastifyInstance } from 'fastify';
import { schema, type Db } from './db/client';

declare module 'fastify' {
  interface FastifyRequest {
    /** The signed-in user. Set for every route except the public ones. */
    user: User;
  }
}

export const API_BASE = '/api/v1';
const PUBLIC_ROUTES = new Set([`${API_BASE}/health`, `${API_BASE}/users`]);

const message = (code: string, text: string, fix: string): Message => ({
  code,
  severity: 'error',
  level: 'operation',
  text,
  fix,
});

function toUser(row: typeof schema.users.$inferSelect): User {
  const { blotterScope, ...rest } = row;
  return blotterScope ? { ...rest, blotterScope } : rest;
}

function toPermission(row: typeof schema.permissions.$inferSelect, user: User): Permission {
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

export function buildApp(db: Db): FastifyInstance {
  const app = Fastify({ logger: process.env.LL_LOG === '1' });
  app.register(cors, { origin: true, exposedHeaders: ['ETag'] });

  // Dev auth: the role switcher sends X-LL-User. Permissions are still enforced server-side.
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0] ?? '';
    if (request.method === 'OPTIONS' || PUBLIC_ROUTES.has(path) || !path.startsWith(API_BASE)) return;
    const header = request.headers['x-ll-user'];
    const userId = Array.isArray(header) ? header[0] : header;
    if (!userId) {
      return reply.code(401).send({
        messages: [
          message(
            'LL-AUTH-0001',
            'No user is signed in.',
            'Choose a user in the role switcher and try again.',
          ),
        ],
      });
    }
    const row = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    if (!row) {
      return reply.code(401).send({
        messages: [
          message(
            'LL-AUTH-0002',
            `The user '${userId}' does not exist.`,
            'Choose a user in the role switcher and try again.',
          ),
        ],
      });
    }
    request.user = toUser(row);
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      messages: [
        message(
          'LL-API-0404',
          `Nothing is served at ${request.method} ${request.url.split('?')[0]}.`,
          'Check the path against docs/API.md.',
        ),
      ],
    }),
  );

  app.get(`${API_BASE}/health`, async () => ({ status: 'ok' }));

  app.get(`${API_BASE}/users`, async (): Promise<User[]> => db.select().from(schema.users).all().map(toUser));

  app.get(`${API_BASE}/me`, async (request) => {
    const startup = db
      .select()
      .from(schema.workspaces)
      .all()
      .filter(
        (w) =>
          w.loadAtStartup &&
          (w.owner.id === request.user.id || (w.isTeamDefault && w.group === request.user.team)),
      )
      .map((w) => ({ id: w.id, name: w.name }));
    return { user: request.user, startupWorkspaces: startup };
  });

  app.get(`${API_BASE}/me/permissions`, async (request): Promise<Permission[]> =>
    db
      .select()
      .from(schema.permissions)
      .where(eq(schema.permissions.userId, request.user.id))
      .orderBy(sql`rowid`)
      .all()
      .map((row) => toPermission(row, request.user)),
  );

  return app;
}
