import type { BusinessDate } from '@ledgerline/contracts';
import { BusinessDateInput, Button, SectionBanner, toast, useNotifications } from '@ledgerline/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { noteJob } from '../jobs/job-store';
import { fetchReports, problemOf, runReport, type Me } from '../services';
import { ErrorPanel, LoadingPanel } from '../state-panels';

/**
 * Reports (SPEC 7.11). Each report runs as a job: the user starts it and can leave; the file appears under Jobs.
 * A user limited to some portfolios gets only those in the file.
 */
export function ReportsList({ me }: { me: Me }) {
  const { notify } = useNotifications();
  const reports = useQuery({ queryKey: ['reports', me.user.id], queryFn: fetchReports });
  const [asOf, setAsOf] = useState<BusinessDate>({ value: me.businessDate, basis: 'valuation' });
  const [busy, setBusy] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ name: string; jobId: string } | null>(null);

  if (reports.isPending) return <LoadingPanel label="Loading reports…" />;
  if (reports.error) {
    const found = problemOf(reports.error);
    // Not being allowed to run reports is a stated restriction, not a fault: there is nothing to retry.
    if (found?.status === 403) {
      return (
        <SectionBanner
          className="max-w-xl"
          state={{
            kind: 'permissionLimited',
            reason: found.messages[0]?.text ?? 'Your role cannot run reports.',
          }}
        />
      );
    }
    return <ErrorPanel messages={found?.messages ?? []} onRetry={() => void reports.refetch()} />;
  }

  const run = async (id: string, name: string) => {
    setBusy(id);
    try {
      const job = await runReport(id, asOf.value ? { asOf: asOf.value } : {});
      noteJob(job);
      setSubmitted({ name, jobId: job.id });
      toast('Report submitted', `${name} · ${job.id}`);
    } catch (error) {
      for (const m of problemOf(error)?.messages ?? []) notify(m, 'Reports');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <BusinessDateInput
        label="As of"
        name="asOf"
        className="w-56"
        value={asOf}
        today={me.businessDate}
        onCommit={setAsOf}
      />
      {me.user.blotterScope ? (
        <p className="text-muted-foreground">
          Reports cover only your portfolios: {me.user.blotterScope.join(', ')}.
        </p>
      ) : null}
      {submitted ? (
        <p
          role="status"
          data-slot="report-submitted"
          className="rounded-md border border-info/40 bg-info/10 px-3 py-2"
        >
          <span className="font-medium">
            {submitted.name} is running as a job ({submitted.jobId}).
          </span>{' '}
          You can leave this page. The file will be under Jobs when it is ready.
        </p>
      ) : null}
      {reports.data.length === 0 ? (
        <p className="text-muted-foreground">No reports are set up yet. An administrator adds them.</p>
      ) : (
        <ul className="flex flex-col rounded-md border">
          {reports.data.map((report) => (
            <li key={report.id} className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{report.name}</p>
                <p className="text-muted-foreground">{report.description}</p>
              </div>
              <Button
                variant="secondary"
                disabled={busy !== null || !asOf.value}
                aria-label={`Run ${report.name}`}
                onClick={() => void run(report.id, report.name)}
              >
                {busy === report.id ? 'Submitting…' : 'Run'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
