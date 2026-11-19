import type { Me } from '@ledgerline/compositions';
import { JobsGrid } from '@ledgerline/compositions/jobs';
import { useOutletContext } from 'react-router';

/** Every job: reports, exports and large bulk runs. Reached from the job tray. */
export function Jobs() {
  const me = useOutletContext<Me>();
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-3 py-2">
      <header className="shrink-0">
        <h1 className="text-base font-semibold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground">Open a job for its inputs, row results, files and log.</p>
      </header>
      <div className="min-h-0 flex-1">
        <JobsGrid user={me.user} />
      </div>
    </div>
  );
}
