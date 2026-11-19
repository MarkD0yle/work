import { AdminConsole, type Me } from '@ledgerline/compositions';
import { useOutletContext } from 'react-router';

/** Admin: who can do what, and which portfolios each person sees. */
export function Admin() {
  const me = useOutletContext<Me>();
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-3 py-2">
      <header className="shrink-0">
        <h1 className="text-base font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">
          Access per action and blotter scope, per user. Every change is recorded.
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <AdminConsole me={me} />
      </div>
    </div>
  );
}
