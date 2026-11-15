import cors from '@fastify/cors';
import type { Message, Permission, User } from '@ledgerline/contracts';
import { eq, sql } from 'drizzle-orm';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { schema, type Db } from './db/client';
import { SEED_TODAY } from './db/seed';
import { HttpError } from './lib/http';
import { registerEntityRoutes } from './routes/entities';
import { JobRunner } from './jobs/runner';
import { registerAdminRoutes } from './routes/admin';
import { registerApprovalRoutes } from './routes/approvals';
import { registerClientRoutes } from './routes/client';
import { registerCloseRoutes } from './routes/close';
import { registerEntryRoutes } from './routes/entry';
import { registerExceptionRoutes } from './routes/exceptions';
import { registerPriceRoutes } from './routes/prices';
import { registerJobRoutes } from './routes/jobs';
import { registerTransactionBulkRoutes, registerTransactionRoutes } from './routes/transactions';
import { registerViewRoutes } from './routes/views';

declare module 'fastify' {
  interface FastifyInstance {
    /** The job queue. Exposed so tests can run a job to the end without waiting. */
    jobs: JobRunner;
  }
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

export interface Clock {
  /** The engine's business date. Relative filters ("yesterday") resolve against this, not the wall clock. */
  today: string;
  /** Current timestamp, for audit events and as-of. */
  now: () => string;
}

/** The mock engine's business date is the seed date, so seeded "recent" data stays recent. */
const defaultClock: Clock = {
  today: process.env.LL_TODAY ?? SEED_TODAY,
  now: () => new Date().toISOString(),
};

export function buildApp(db: Db, clock: Clock = defaultClock): FastifyInstance {
  const app = Fastify({ logger: process.env.LL_LOG === '1' });
  app.register(cors, { origin: true, exposedHeaders: ['ETag'] });

  // Dev auth: the role switcher sends X-LL-User. Permissions are still enforced server-side.
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0] ?? '';
    if (request.method === 'OPTIONS' || PUBLIC_ROUTES.has(path) || !path.startsWith(API_BASE)) return;
    const header = request.headers['x-ll-user'];
    // The browser's EventSource cannot send headers, so the progress stream alone may name the user in the query.
    const streamUser =
      path === `${API_BASE}/jobs/stream` ? (request.query as { user?: string }).user : undefined;
    const userId = (Array.isArray(header) ? header[0] : header) ?? streamUser;
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

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError)
      return reply.code(error.status).send({ messages: error.messages, ...error.extra });
    if (error instanceof ZodError) {
      return reply.code(400).send({
        messages: error.issues.map((issue) => ({
          code: 'LL-VAL-0400',
          severity: 'error',
          level: 'field',
          text: `${issue.path.join('.') || 'Request'}: ${issue.message}`,
          fix: 'Correct the request and send it again.',
          ...(issue.path.length ? { target: issue.path.join('.') } : {}),
        })),
      });
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.code(status).send({
        messages: [
          message('LL-API-0400', 'The request could not be read.', 'Check the request body is valid JSON.'),
        ],
      });
    }
    app.log.error(error);
    return reply.code(500).send({
      messages: [
        message(
          'LL-API-0500',
          'The server hit an unexpected problem.',
          'Try again. If it keeps happening, contact support with this code.',
        ),
      ],
    });
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
      // The user's own startup workspaces come before the team default.
      .sort((a, b) => Number(b.owner.id === request.user.id) - Number(a.owner.id === request.user.id))
      .map((w) => ({ id: w.id, name: w.name }));
    // The engine's business date: date shortcuts and relative filters in the UI count from here, not from the browser clock.
    return { user: request.user, startupWorkspaces: startup, businessDate: clock.today };
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

  // Jobs run in this process and are saved after every chunk, so they carry on after a restart.
  const jobs = new JobRunner(db, {
    now: clock.now,
    chunk: Number(process.env.LL_JOB_CHUNK ?? 50),
    tickMs: Number(process.env.LL_JOB_TICK_MS ?? 150),
  });
  app.decorate('jobs', jobs);
  app.addHook('onClose', async () => jobs.stop());

  registerTransactionRoutes(app, db, API_BASE, clock);
  registerTransactionBulkRoutes(app, db, API_BASE, clock, jobs);
  registerJobRoutes(app, db, API_BASE, clock, jobs);
  registerViewRoutes(app, db, API_BASE, clock);
  registerEntityRoutes(app, db, API_BASE);
  registerEntryRoutes(app, db, API_BASE, clock);
  registerExceptionRoutes(app, db, API_BASE, clock);
  registerCloseRoutes(app, db, API_BASE, clock, jobs);
  registerApprovalRoutes(app, db, API_BASE, clock);
  registerPriceRoutes(app, db, API_BASE, clock);
  registerAdminRoutes(app, db, API_BASE, clock);
  registerClientRoutes(app, db, API_BASE, clock);

  // Every handler is registered by now: pick up anything left unfinished by the last run.
  jobs.resume();
  return app;
}
