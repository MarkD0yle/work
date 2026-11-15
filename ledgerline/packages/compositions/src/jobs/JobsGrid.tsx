import type { FilterCondition, Job, User } from '@ledgerline/contracts';
import { formatTimestamp, TaskChips, type TaskChip } from '@ledgerline/ui';
import {
  gridFeatures,
  LLGrid,
  type LLColumnDef,
  type LLDataSource,
  type LLGridHandle,
} from '@ledgerline/ui/grid';
import { useEffect, useMemo, useRef, useState } from 'react';
import { queryJobs } from '../services';
import { JOB_STATUS, JOB_TYPE, JobDetail } from './JobDetail';
import { markJobSeen, useJobs } from './job-store';

const n = (value: number) => value.toLocaleString('en-US');
const columns: LLColumnDef<Job>[] = [
  { field: 'id', header: 'Job', type: 'text', mono: true, width: 110, pinned: 'left', value: (j) => j.id },
  { field: 'name', header: 'Name', type: 'text', width: 320, value: (j) => j.name },
  { field: 'type', header: 'Type', type: 'text', width: 130, value: (j) => JOB_TYPE[j.type] },
  {
    field: 'status',
    header: 'Status',
    type: 'status',
    width: 130,
    value: (j) => j.status,
    statuses: Object.fromEntries(Object.entries(JOB_STATUS).map(([key, v]) => [key, v])),
  },
  {
    field: 'progress',
    header: 'Progress',
    type: 'text',
    width: 260,
    sortable: false,
    value: (j) =>
      j.counts && j.type !== 'report'
        ? `${n(j.counts.succeeded)} succeeded, ${n(j.counts.failed)} failed, ${n(j.counts.skipped)} skipped`
        : j.progress
          ? `${n(j.progress.done)} of ${n(j.progress.total)}`
          : '',
  },
  {
    field: 'submittedBy',
    header: 'Submitted by',
    type: 'text',
    width: 170,
    value: (j) => j.submittedBy.name,
  },
  {
    field: 'submittedAt',
    header: 'Submitted',
    type: 'text',
    width: 190,
    value: (j) => formatTimestamp(j.submittedAt),
  },
];
const filterLabels = { submittedBy: 'Submitted by' };
const NOUN = { one: 'job', many: 'jobs' };

/** Every job, newest first (SPEC 7.11). Filter by status or to your own; open one for its inputs, log, files and row results. */
export function JobsGrid({ user }: { user: User }) {
  const grid = useRef<LLGridHandle>(null);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const dataSource = useMemo<LLDataSource<Job>>(() => ({ kind: 'server', query: queryJobs }), []);
  const features = useMemo(() => ({ ...gridFeatures(user.segment), selection: false }), [user.segment]);
  const chips = useMemo<TaskChip[]>(
    () => [
      { id: 'mine', label: 'My jobs', filter: { field: 'submittedBy', op: 'eq', value: user.id } },
      {
        id: 'running',
        label: 'Running',
        filter: { field: 'status', op: 'in', value: ['queued', 'running'] },
      },
      {
        id: 'attention',
        label: 'Failed or partly done',
        filter: { field: 'status', op: 'in', value: ['failed', 'partial'] },
      },
    ],
    [user.id],
  );
  // The list reloads whenever one of the user's own jobs changes state, so it never shows a stale status.
  const signature = useJobs()
    .map((j) => `${j.id}:${j.status}`)
    .join('|');
  useEffect(() => {
    if (signature) grid.current?.refresh();
  }, [signature]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <TaskChips chips={chips} filters={filters} onChange={setFilters} />
      <LLGrid
        ref={grid}
        gridId="jobs"
        label="Jobs"
        columns={columns}
        dataSource={dataSource}
        rowId={(j) => j.id}
        features={features}
        filters={filters}
        onFiltersChange={setFilters}
        filterLabels={filterLabels}
        noun={NOUN}
        onRowOpen={(job) => {
          markJobSeen(job.id);
          setDetail(job.id);
        }}
      />
      {detail ? (
        <JobDetail
          jobId={detail}
          userId={user.id}
          onClose={() => {
            const id = detail;
            setDetail(null);
            setTimeout(() => grid.current?.focusRow(id), 0);
          }}
          onRetried={(job) => {
            setDetail(job.id);
            grid.current?.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
