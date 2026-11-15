/**
 * In-process job queue (SPEC 7.11). Every job is a list of items worked through in small chunks.
 * After each chunk the job row is saved, so progress and results survive an API restart: on start-up,
 * unfinished jobs carry on from the items they have not done yet. Nothing is done twice.
 */
import type { ActorRef, BulkResult, Job, JobStatus, JobType, Message, User } from '@ledgerline/contracts';
import type { Db } from '../db/client';

export interface JobContext {
  job: Job;
  /** The user the job runs as. Permissions and scope are theirs. */
  user: User;
  /** Adds a line to the job log. */
  log: (level: 'info' | 'warn' | 'error', text: string) => void;
}

export interface JobHandler {
  /** The items this job works through. For a bulk action these are record ids. */
  items: (job: Job) => string[];
  /** Works on one item and records the outcome in `result`. Runs inside a database transaction with its chunk. */
  processItem: (ctx: JobContext, item: string, result: BulkResult) => void;
  /** Runs once after the last item, in its own transaction: batch audit event, output files. */
  finish?: (ctx: JobContext, result: BulkResult) => { outputs?: JobOutput[] } | void;
}

/** A file a job leaves behind. Text is stored as it is; anything else is stored as base64. */
export interface JobOutput {
  name: string;
  contentType: string;
  content: string | Buffer;
}

export interface JobRunnerOptions {
  /** Items per chunk. */
  chunk?: number;
  /** Pause between chunks, so a long job never blocks requests. */
  tickMs?: number;
  now: () => string;
}

type Listener = (job: Job) => void;

const emptyResult = (jobId: string): BulkResult => ({
  jobId,
  status: 'queued',
  succeeded: [],
  failed: [],
  skipped: [],
});
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const FORMATS: Record<string, NonNullable<Job['outputs']>[number]['format']> = {
  'text/csv': 'csv',
  'application/pdf': 'pdf',
  [XLSX_TYPE]: 'xlsx',
};

export function rowToJob(row: Record<string, unknown>): Job {
  const json = <T>(value: unknown): T | undefined =>
    value == null ? undefined : (JSON.parse(value as string) as T);
  const optional = {
    progress: json<Job['progress']>(row.progress),
    outputs: json<Job['outputs']>(row.outputs),
    result: json<BulkResult>(row.result),
    scheduledFor: (row.scheduled_for as string | null) ?? undefined,
    log: json<Job['log']>(row.log),
  };
  return {
    id: row.id as string,
    type: row.type as JobType,
    name: row.name as string,
    submittedBy: JSON.parse(row.submitted_by as string) as ActorRef,
    submittedAt: row.submitted_at as string,
    queue: row.queue as string,
    status: row.status as JobStatus,
    inputs: JSON.parse(row.inputs as string) as Record<string, unknown>,
    ...(Object.fromEntries(Object.entries(optional).filter(([, v]) => v !== undefined)) as Partial<Job>),
  };
}

export class JobRunner {
  private readonly handlers = new Map<string, JobHandler>();
  private readonly listeners = new Set<Listener>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly chunk: number;
  private readonly tickMs: number;
  private stopped = false;

  constructor(
    private readonly db: Db,
    private readonly options: JobRunnerOptions,
  ) {
    this.chunk = options.chunk ?? 50;
    this.tickMs = options.tickMs ?? 150;
  }

  /** Handlers are keyed by `inputs.handler`, so one job type (bulkAction) can serve several domains. */
  register(key: string, handler: JobHandler): void {
    this.handlers.set(key, handler);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get(id: string): Job | undefined {
    const row = this.db.$client.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as
      Record<string, unknown> | undefined;
    return row ? rowToJob(row) : undefined;
  }

  submit(input: {
    type: JobType;
    name: string;
    user: User;
    handler: string;
    inputs: Record<string, unknown>;
  }): Job {
    const sqlite = this.db.$client;
    const max =
      (
        sqlite
          .prepare("SELECT max(CAST(substr(id, 3) AS INTEGER)) AS n FROM jobs WHERE id LIKE 'J-%'")
          .get() as { n: number | null }
      ).n ?? 0;
    const id = `J-${String(max + 1).padStart(6, '0')}`;
    const at = this.options.now();
    const job: Job = {
      id,
      type: input.type,
      name: input.name,
      submittedBy: { type: 'user', id: input.user.id, name: input.user.name },
      submittedAt: at,
      queue: input.type === 'report' ? 'reports' : 'default',
      status: 'queued',
      inputs: { ...input.inputs, handler: input.handler },
      log: [{ at, level: 'info', text: 'Submitted.' }],
    };
    const handler = this.handlers.get(input.handler);
    job.progress = { done: 0, total: handler ? handler.items(job).length : 0 };
    job.result = emptyResult(id);
    sqlite
      .prepare(
        'INSERT INTO jobs (id, type, name, submitted_by, submitted_at, queue, status, progress, result, inputs, log) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        job.type,
        job.name,
        JSON.stringify(job.submittedBy),
        at,
        job.queue,
        job.status,
        JSON.stringify(job.progress),
        JSON.stringify(job.result),
        JSON.stringify(job.inputs),
        JSON.stringify(job.log),
      );
    this.emit(job);
    this.schedule(id, 0);
    return job;
  }

  /** Picks up jobs that were queued or running when the API last stopped. */
  resume(): number {
    const rows = this.db.$client
      .prepare("SELECT id FROM jobs WHERE status IN ('queued', 'running')")
      .all() as { id: string }[];
    for (const { id } of rows) {
      const job = this.get(id);
      if (!job) continue;
      if (!this.handlers.has(String(job.inputs.handler))) {
        // Seeded or foreign jobs with no handler cannot be continued; say so rather than leave them running for ever.
        this.save({
          ...job,
          status: 'failed',
          log: [
            ...(job.log ?? []),
            {
              at: this.options.now(),
              level: 'error',
              text: 'This job could not be continued after a restart.',
            },
          ],
        });
        continue;
      }
      this.save({
        ...job,
        log: [
          ...(job.log ?? []),
          { at: this.options.now(), level: 'info', text: 'Continued after a restart.' },
        ],
      });
      this.schedule(id, 0);
    }
    return rows.length;
  }

  cancel(id: string): Job | undefined {
    const job = this.get(id);
    if (!job || (job.status !== 'queued' && job.status !== 'running')) return job;
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
    const done = job.progress?.done ?? 0;
    const total = job.progress?.total ?? 0;
    const next: Job = {
      ...job,
      status: 'cancelled',
      ...(job.result ? { result: { ...job.result, status: 'cancelled' } } : {}),
      log: [
        ...(job.log ?? []),
        {
          at: this.options.now(),
          level: 'warn',
          text: `Cancelled. ${done} of ${total} were done; the rest were not touched.`,
        },
      ],
    };
    this.save(next);
    return next;
  }

  /** Stops timers. Used when the app closes, and by tests. */
  stop(): void {
    this.stopped = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  /** Runs a job to the end without waiting between chunks. For tests. */
  drain(id: string): Job {
    for (;;) {
      const job = this.get(id);
      if (!job || (job.status !== 'queued' && job.status !== 'running')) return job as Job;
      this.step(id, false);
    }
  }

  private schedule(id: string, delay: number): void {
    if (this.stopped) return;
    this.timers.set(
      id,
      setTimeout(() => this.step(id, true), delay),
    );
  }

  private emit(job: Job): void {
    for (const listener of this.listeners) {
      try {
        listener(job);
      } catch {
        // A broken listener must not stop the job.
      }
    }
  }

  private save(job: Job): void {
    this.db.$client
      .prepare('UPDATE jobs SET status = ?, progress = ?, outputs = ?, result = ?, log = ? WHERE id = ?')
      .run(
        job.status,
        JSON.stringify(job.progress ?? null),
        job.outputs ? JSON.stringify(job.outputs) : null,
        JSON.stringify(job.result ?? null),
        JSON.stringify(job.log ?? []),
        job.id,
      );
    this.emit(job);
  }

  private step(id: string, reschedule: boolean): void {
    this.timers.delete(id);
    const sqlite = this.db.$client;
    const job = this.get(id);
    if (!job || (job.status !== 'queued' && job.status !== 'running')) return;
    const handler = this.handlers.get(String(job.inputs.handler));
    const at = this.options.now();
    const log = [...(job.log ?? [])];
    const fail = (text: string) =>
      this.save({
        ...job,
        status: 'failed',
        log: [...log, { at, level: 'error', text }],
        ...(job.result ? { result: { ...job.result, status: 'failed' } } : {}),
      });
    if (!handler) return fail('There is nothing registered to run this kind of job.');
    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(job.submittedBy.id) as
      Record<string, unknown> | undefined;
    if (!user) return fail('The user who submitted this job no longer exists.');
    const scope = user.blotter_scope ? (JSON.parse(user.blotter_scope as string) as string[]) : undefined;
    const ctx: JobContext = {
      job,
      user: { ...(user as unknown as User), ...(scope ? { blotterScope: scope } : {}) },
      log: (level, text) => log.push({ at, level, text }),
    };

    const result = job.result ?? emptyResult(id);
    const items = handler.items(job);
    const done = new Set([
      ...result.succeeded,
      ...result.failed.map((f) => f.id),
      ...result.skipped.map((s) => s.id),
    ]);
    const pending = items.filter((item) => !done.has(item));
    try {
      if (pending.length) {
        if (job.status === 'queued') log.push({ at, level: 'info', text: `Started: ${items.length} to do.` });
        sqlite.transaction(() => {
          for (const item of pending.slice(0, this.chunk)) handler.processItem(ctx, item, result);
        })();
        const finished = result.succeeded.length + result.failed.length + result.skipped.length;
        this.save({
          ...job,
          status: 'running',
          result: { ...result, status: 'running' },
          progress: { done: finished, total: items.length },
          log,
        });
        if (reschedule) this.schedule(id, this.tickMs);
        return;
      }
      // Every item is done: finish, then settle the final status.
      let outputs: Job['outputs'];
      sqlite.transaction(() => {
        const produced = handler.finish?.(ctx, result);
        if (produced?.outputs?.length) {
          sqlite.prepare('DELETE FROM job_outputs WHERE job_id = ?').run(id);
          outputs = produced.outputs.map((o, idx) => {
            sqlite
              .prepare(
                'INSERT INTO job_outputs (job_id, idx, name, content_type, content) VALUES (?, ?, ?, ?, ?)',
              )
              .run(
                id,
                idx,
                o.name,
                o.contentType,
                typeof o.content === 'string' ? o.content : o.content.toString('base64'),
              );
            return {
              name: o.name,
              format: FORMATS[o.contentType] ?? 'delimited',
              url: `/api/v1/jobs/${id}/outputs/${idx}`,
            };
          });
        }
      })();
      const status: JobStatus =
        result.failed.length === 0 && result.skipped.length === 0
          ? 'completed'
          : result.succeeded.length === 0 && result.failed.length > 0
            ? 'failed'
            : 'partial';
      log.push({
        at,
        level: status === 'completed' ? 'info' : 'warn',
        text: `Finished: ${result.succeeded.length} succeeded, ${result.failed.length} failed, ${result.skipped.length} skipped.`,
      });
      this.save({
        ...job,
        status,
        result: { ...result, status },
        progress: { done: items.length, total: items.length },
        log,
        ...(outputs ? { outputs } : {}),
      });
    } catch (error) {
      const message: Message | undefined = (error as { messages?: Message[] }).messages?.[0];
      fail(
        message
          ? `${message.text} ${message.fix ?? ''}`.trim()
          : `The job stopped: ${error instanceof Error ? error.message : 'unexpected error'}.`,
      );
    }
  }
}
