import type { Job } from '@ledgerline/contracts';
import {
  Badge,
  Button,
  bulkResultCsv,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  formatTimestamp,
  MessageText,
  SectionBanner,
  useNotifications,
} from '@ledgerline/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { cancelJob, download, fetchJob, problemOf, retryJob, saveText } from '../services';
import { ErrorPanel, LoadingPanel } from '../state-panels';
import { isActive, noteJob, useJobs } from './job-store';

export const JOB_STATUS: Record<
  Job['status'],
  { label: string; tone: 'neutral' | 'good' | 'warning' | 'critical' | 'info' }
> = {
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'info' },
  completed: { label: 'Completed', tone: 'good' },
  partial: { label: 'Partly done', tone: 'warning' },
  failed: { label: 'Failed', tone: 'critical' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};
export const JOB_TYPE: Record<Job['type'], string> = {
  report: 'Report',
  export: 'Export',
  dataRequest: 'Data request',
  bulkAction: 'Bulk action',
  periodClose: 'Period close',
  search: 'Search',
  import: 'Import',
};
/** Inputs shown to the user, in their words. Internal fields (the handler name) are left out. */
const INPUT_LABELS: Record<string, string> = {
  actionId: 'Action',
  reason: 'Reason',
  reportId: 'Report',
  asOf: 'As of',
  portfolioIds: 'Portfolios',
  retryOf: 'Retry of',
  periodEnd: 'Period ending',
  closeType: 'Close type',
};
const FAILED_SHOWN = 100;
const n = (value: number) => value.toLocaleString('en-US');

export function JobProgress({ job }: { job: Job }) {
  if (!job.progress || !isActive(job)) return null;
  const { done, total } = job.progress;
  return (
    <div data-slot="job-progress">
      <progress
        className="h-1.5 w-full"
        value={done}
        max={Math.max(total, 1)}
        aria-label={`${job.name} progress`}
      />
      <p className="tabular text-xs text-muted-foreground">
        {n(done)} of {n(total)} done
      </p>
    </div>
  );
}

export interface JobDetailProps {
  jobId: string;
  userId: string;
  onClose: () => void;
  /** Called with the new job when a retry is submitted, so the caller can show it. */
  onRetried?: (job: Job) => void;
}

/** One job in full (SPEC 7.11): what it was asked to do, how far it got, each row's outcome, its files and its log. */
export function JobDetail({ jobId, userId, onClose, onRetried }: JobDetailProps) {
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf>>(null);
  const live = useJobs().find((j) => j.id === jobId);
  const query = useQuery({ queryKey: ['job', jobId], queryFn: () => fetchJob(jobId) });
  // The stream carries status and progress; when either moves, the full job (row results, log) is fetched again.
  const liveKey = live ? `${live.status}:${live.progress?.done ?? 0}` : '';
  useEffect(() => {
    if (liveKey) void queryClient.invalidateQueries({ queryKey: ['job', jobId] });
  }, [liveKey, jobId, queryClient]);

  const act = async (run: () => Promise<Job>, after?: (job: Job) => void) => {
    setBusy(true);
    setProblem(null);
    try {
      const job = await run();
      noteJob(job);
      await queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      after?.(job);
    } catch (error) {
      const found = problemOf(error);
      setProblem(found);
      for (const m of found?.messages ?? []) notify(m, 'Jobs');
    } finally {
      setBusy(false);
    }
  };

  const job = query.data
    ? {
        ...query.data,
        ...(live ? { status: live.status, ...(live.progress ? { progress: live.progress } : {}) } : {}),
      }
    : undefined;
  const mine = job?.submittedBy.id === userId;
  const result = query.data?.result;
  const canRetry =
    job &&
    !isActive(job) &&
    (job.status === 'partial' || job.status === 'failed' || job.status === 'cancelled');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent variant="sheet" data-slot="job-detail" aria-describedby={undefined}>
        <DialogTitle>{job ? job.name : `Job ${jobId}`}</DialogTitle>
        {query.isPending ? <LoadingPanel label="Loading job…" /> : null}
        {query.error ? (
          <ErrorPanel
            messages={problemOf(query.error)?.messages ?? []}
            onRetry={() => void query.refetch()}
          />
        ) : null}
        {job ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            <DialogDescription asChild>
              <div className="flex flex-wrap items-center gap-2">
                <Badge status={JOB_STATUS[job.status].tone} data-slot="job-status">
                  {JOB_STATUS[job.status].label}
                </Badge>
                <span className="font-mono text-xs">{job.id}</span>
                <span>
                  {JOB_TYPE[job.type]} · submitted by {job.submittedBy.name} ·{' '}
                  {formatTimestamp(job.submittedAt)}
                </span>
              </div>
            </DialogDescription>
            {problem ? <SectionBanner state={{ kind: 'blockingError', messages: problem.messages }} /> : null}
            <JobProgress job={job} />

            <div className="flex flex-wrap gap-2">
              {canRetry ? (
                <Button
                  disabled={busy || !mine}
                  title={mine ? undefined : `Only ${job.submittedBy.name} can retry this job.`}
                  onClick={() => void act(() => retryJob(job.id), onRetried)}
                >
                  {result?.failed.length ? `Retry the ${n(result.failed.length)} failed` : 'Retry'}
                </Button>
              ) : null}
              {isActive(job) ? (
                <Button
                  variant="secondary"
                  disabled={busy || !mine}
                  title={mine ? undefined : `Only ${job.submittedBy.name} can cancel this job.`}
                  onClick={() => void act(() => cancelJob(job.id))}
                >
                  Cancel job
                </Button>
              ) : null}
              {result && result.succeeded.length + result.failed.length + result.skipped.length > 0 ? (
                <Button
                  variant="secondary"
                  onClick={() => saveText(`${job.id}-results.csv`, bulkResultCsv(result))}
                >
                  Export results
                </Button>
              ) : null}
              {canRetry ? (
                <p className="self-center text-xs text-muted-foreground">
                  Retry uses the original inputs. Rows already done are not run again.
                </p>
              ) : null}
            </div>

            {job.outputs?.length ? (
              <section aria-label="Files">
                <h3 className="mb-1 font-semibold">Files</h3>
                <ul className="flex flex-col gap-1">
                  {job.outputs.map((output) => (
                    <li key={output.url}>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          void download(output.url.replace(/^\/api\/v1/, ''), output.name).catch(
                            (error: unknown) => {
                              const found = problemOf(error);
                              setProblem(found);
                              for (const m of found?.messages ?? []) notify(m, 'Jobs');
                            },
                          )
                        }
                      >
                        Download {output.name}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {result && job.type !== 'report' ? (
              <section aria-label="Row results" data-slot="job-results">
                <h3 className="mb-1 font-semibold">Row results</h3>
                <dl className="tabular mb-2 flex gap-4">
                  <div className="flex gap-1">
                    <dt>Succeeded</dt>
                    <dd className="font-semibold">{n(result.succeeded.length)}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>Failed</dt>
                    <dd className="font-semibold">{n(result.failed.length)}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>Skipped</dt>
                    <dd className="font-semibold">{n(result.skipped.length)}</dd>
                  </div>
                </dl>
                {result.failed.length ? (
                  <table aria-label="Failed rows" className="w-full text-body">
                    <thead className="bg-muted text-left text-xs">
                      <tr>
                        <th scope="col" className="px-2 py-1 font-medium">
                          Record
                        </th>
                        <th scope="col" className="px-2 py-1 font-medium">
                          Why it failed, and what to do
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.failed.slice(0, FAILED_SHOWN).map((f) => (
                        <tr key={f.id} className="border-t align-top">
                          <th scope="row" className="px-2 py-1 text-left font-mono font-normal">
                            {f.id}
                          </th>
                          <td className="px-2 py-1 text-xs">
                            <MessageText message={f.message} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {result.failed.length > FAILED_SHOWN ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Showing the first {FAILED_SHOWN}. Export the results for all {n(result.failed.length)}.
                  </p>
                ) : null}
                {result.skipped.length ? (
                  <p className="mt-2 text-xs">
                    <span className="font-medium">Skipped:</span>{' '}
                    {[...new Set(result.skipped.map((s) => s.reason))].slice(0, 4).join(' ')}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section aria-label="Inputs">
              <h3 className="mb-1 font-semibold">What it was asked to do</h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
                {Object.entries(job.inputs)
                  .filter(([key]) => INPUT_LABELS[key])
                  .map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="text-muted-foreground">{INPUT_LABELS[key]}</dt>
                      <dd>{Array.isArray(value) ? value.join(', ') : String(value)}</dd>
                    </div>
                  ))}
                {Array.isArray(job.inputs.ids) ? (
                  <div className="contents">
                    <dt className="text-muted-foreground">Rows</dt>
                    <dd>{n(job.inputs.ids.length)}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            {job.log?.length ? (
              <section aria-label="Log">
                <h3 className="mb-1 font-semibold">Log</h3>
                <ol className="flex flex-col gap-0.5 text-xs">
                  {job.log.map((line, i) => (
                    <li key={i} className={line.level === 'error' ? 'text-critical' : undefined}>
                      <time className="font-mono text-muted-foreground" dateTime={line.at}>
                        {formatTimestamp(line.at)}
                      </time>{' '}
                      {line.level === 'info' ? '' : `${line.level === 'error' ? 'Error' : 'Warning'}: `}
                      {line.text}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
