import { ReportsList, type Me } from '@ledgerline/compositions';
import { useOutletContext } from 'react-router';

/** Reports run as jobs: start one here, collect the file from Jobs. */
export function Reports() {
  const me = useOutletContext<Me>();
  return (
    <div className="flex flex-col gap-3 p-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Each report runs in the background and leaves a file under Jobs.
        </p>
      </header>
      <ReportsList me={me} />
    </div>
  );
}
