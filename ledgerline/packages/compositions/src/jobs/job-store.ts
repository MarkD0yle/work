/**
 * The signed-in user's jobs, kept current by the API's event stream (SPEC 7.11).
 * One store for the whole app: the tray, the job detail and any grid following a run all read it.
 * Which finished jobs the user has already looked at is remembered in the browser, per user.
 */
import type { BulkResult, Job, JobStatus } from '@ledgerline/contracts';
import { useSyncExternalStore } from 'react';
import { fetchJob, openStream, queryJobs } from '../services';

const ACTIVE: ReadonlySet<JobStatus> = new Set(['queued', 'running']);
export const isActive = (job: Pick<Job, 'status'>) => ACTIVE.has(job.status);

interface State {
  userId: string | null;
  jobs: Job[];
  seen: ReadonlySet<string>;
  connected: boolean;
}
let state: State = { userId: null, jobs: [], seen: new Set(), connected: false };
const listeners = new Set<() => void>();
const finishedListeners = new Set<(job: Job) => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const seenKey = (userId: string) => `ll-jobs-seen:${userId}`;
function readSeen(userId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(seenKey(userId)) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function upsert(job: Job): void {
  const before = state.jobs.find((j) => j.id === job.id);
  const jobs = before
    ? state.jobs.map((j) => (j.id === job.id ? { ...j, ...job } : j))
    : [job, ...state.jobs];
  set({
    jobs: jobs.sort((a, b) =>
      a.submittedAt < b.submittedAt ? 1 : a.submittedAt > b.submittedAt ? -1 : b.id.localeCompare(a.id),
    ),
  });
  // Only a job seen running in this session counts as "just finished": old results do not raise a notification again.
  if (before && isActive(before) && !isActive(job)) for (const listener of finishedListeners) listener(job);
}

async function load(userId: string): Promise<void> {
  const page = await queryJobs({
    startRow: 0,
    endRow: 30,
    filters: [{ field: 'submittedBy', op: 'eq', value: userId }],
  });
  if (state.userId !== userId) return;
  for (const job of page.rows.reverse()) upsert(job);
}

/** Starts following the user's jobs. Returns a function that stops. */
export function connectJobs(userId: string): () => void {
  set({ userId, jobs: [], seen: readSeen(userId), connected: false });
  void load(userId).catch(() => undefined);
  const stream = openStream('/jobs/stream');
  stream.addEventListener('open', () => {
    set({ connected: true });
    // After a dropped connection, anything that changed meanwhile is fetched again.
    void load(userId).catch(() => undefined);
  });
  stream.addEventListener('error', () => set({ connected: false }));
  stream.addEventListener('job', (event) => {
    try {
      upsert(JSON.parse((event as MessageEvent<string>).data) as Job);
    } catch {
      // A malformed event is ignored; the next one, or a reload, puts things right.
    }
  });
  return () => {
    stream.close();
    if (state.userId === userId) set({ userId: null, jobs: [], connected: false });
  };
}

/** Called when a job that was running in this session finishes. */
export function onJobFinished(listener: (job: Job) => void): () => void {
  finishedListeners.add(listener);
  return () => finishedListeners.delete(listener);
}

export function markJobSeen(id: string): void {
  if (state.seen.has(id) || !state.userId) return;
  const seen = new Set(state.seen).add(id);
  try {
    localStorage.setItem(seenKey(state.userId), JSON.stringify([...seen].slice(-500)));
  } catch {
    // Storage can be refused (private browsing); the badge then simply stays until the page is reloaded.
  }
  set({ seen });
}

/** Tells the store about a job this screen just submitted, so the tray shows it before the first stream event. */
export function noteJob(job: Job): void {
  if (state.userId && job.submittedBy.id === state.userId) upsert(job);
}

export const useJobs = (): Job[] => useSyncExternalStore(subscribe, () => state.jobs);
export const useSeenJobs = (): ReadonlySet<string> => useSyncExternalStore(subscribe, () => state.seen);

export interface JobUpdate {
  status: JobStatus;
  progress?: { done: number; total: number };
  result?: BulkResult;
}

/**
 * Follows one job to its end. Progress comes from the store when the stream is connected; otherwise
 * (a pop-out window with no shell) the job is asked for directly. The final update carries the full result.
 */
export function watchJob(jobId: string, onUpdate: (update: JobUpdate) => void): () => void {
  let stopped = false;
  let finishing = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const finish = async () => {
    if (finishing || stopped) return;
    finishing = true;
    try {
      const job = await fetchJob(jobId);
      if (stopped) return;
      if (isActive(job)) {
        finishing = false;
        onUpdate({ status: job.status, ...(job.progress ? { progress: job.progress } : {}) });
        return;
      }
      stop();
      onUpdate({
        status: job.status,
        ...(job.progress ? { progress: job.progress } : {}),
        ...(job.result ? { result: job.result } : {}),
      });
    } catch {
      finishing = false;
    }
  };
  const check = () => {
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    if (isActive(job)) onUpdate({ status: job.status, ...(job.progress ? { progress: job.progress } : {}) });
    else void finish();
  };
  const poll = () => {
    if (stopped) return;
    // The stream is the fast path. This slower check covers a missed event or a window with no stream.
    void finish().finally(() => {
      if (!stopped) timer = setTimeout(poll, state.connected ? 5000 : 1000);
    });
  };
  const unsubscribe = subscribe(check);
  timer = setTimeout(poll, state.connected ? 2000 : 300);
  function stop() {
    stopped = true;
    unsubscribe();
    if (timer) clearTimeout(timer);
  }
  return stop;
}
