import type { Job } from '@ledgerline/contracts';
import {
  Badge,
  Button,
  formatTimestamp,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useNotifications,
} from '@ledgerline/ui';
import { ListChecks } from 'lucide-react';
import { useEffect, useState } from 'react';
import { JOB_STATUS, JobDetail, JobProgress } from './JobDetail';
import { connectJobs, isActive, markJobSeen, onJobFinished, useJobs, useSeenJobs } from './job-store';

const TRAY_ROWS = 8;
const n = (value: number) => value.toLocaleString('en-US');
const outcome = (job: Job) =>
  job.counts && job.type !== 'report'
    ? `${n(job.counts.succeeded)} succeeded, ${n(job.counts.failed)} failed, ${n(job.counts.skipped)} skipped`
    : job.outputs?.length
      ? `${job.outputs.length === 1 ? 'A file is' : `${job.outputs.length} files are`} ready to download`
      : '';

export interface JobTrayProps {
  userId: string;
  /** Opens the full jobs list. */
  onOpenAll: () => void;
}

/**
 * The job tray (SPEC 7.11): the user's recent jobs, a badge for those running and those finished but not
 * yet looked at, and a notification the moment one finishes. Work submitted here survives closing the browser:
 * the result is waiting, unread, at the next sign-in.
 */
export function JobTray({ userId, onOpenAll }: JobTrayProps) {
  const jobs = useJobs();
  const seen = useSeenJobs();
  const { notify } = useNotifications();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => connectJobs(userId), [userId]);
  useEffect(
    () =>
      onJobFinished((job) => {
        const clean = job.status === 'completed';
        notify(
          {
            code: clean ? 'LL-JOB-0200' : 'LL-JOB-0207',
            severity: clean ? 'info' : job.status === 'failed' ? 'error' : 'warning',
            level: 'processing',
            text: `${job.name} ${clean ? 'finished' : JOB_STATUS[job.status].label.toLowerCase()}. ${outcome(job)}`.trim(),
            fix: `Open Jobs to see the result (${job.id}).`,
            target: job.id,
          },
          'Jobs',
        );
      }),
    [notify],
  );

  const running = jobs.filter(isActive).length;
  const unread = jobs.filter((j) => !isActive(j) && !seen.has(j.id)).length;
  const badge = running + unread;
  const summary = [running ? `${running} running` : '', unread ? `${unread} finished and not yet opened` : '']
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" data-slot="job-tray-button">
            <ListChecks aria-hidden />
            Jobs
            {/* The count is visible, and the words after it say what it counts: the spoken name starts with the visible text. */}
            {badge ? (
              <Badge status={running ? 'info' : 'warning'} data-slot="job-tray-badge">
                {badge}
              </Badge>
            ) : null}
            {summary ? <span className="sr-only">{summary}</span> : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" aria-label="Jobs" className="w-96" data-slot="job-tray">
          {jobs.length === 0 ? (
            <>
              <p className="font-medium">No jobs yet</p>
              <p className="text-muted-foreground">
                Reports, exports and large bulk actions run here, so you can leave a screen and come back for
                the result.
              </p>
            </>
          ) : (
            <ul className="flex flex-col">
              {jobs.slice(0, TRAY_ROWS).map((job) => (
                <li key={job.id} className="border-b last:border-b-0">
                  <button
                    type="button"
                    data-job-id={job.id}
                    className="flex w-full flex-col gap-0.5 rounded-sm px-1 py-1.5 text-left hover:bg-accent"
                    onClick={() => {
                      markJobSeen(job.id);
                      setDetail(job.id);
                      setOpen(false);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-medium">{job.name}</span>
                      {!isActive(job) && !seen.has(job.id) ? (
                        <span className="text-2xs font-semibold text-info">New</span>
                      ) : null}
                      <Badge status={JOB_STATUS[job.status].tone}>{JOB_STATUS[job.status].label}</Badge>
                    </span>
                    <JobProgress job={job} />
                    <span className="text-xs text-muted-foreground">
                      {isActive(job) ? '' : `${outcome(job)}${outcome(job) ? ' · ' : ''}`}
                      {formatTimestamp(job.submittedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                onOpenAll();
              }}
            >
              All jobs
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {detail ? (
        <JobDetail
          jobId={detail}
          userId={userId}
          onClose={() => setDetail(null)}
          onRetried={(job) => {
            markJobSeen(detail);
            setDetail(job.id);
          }}
        />
      ) : null}
    </>
  );
}
