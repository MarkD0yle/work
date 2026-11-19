import type { Me } from '@ledgerline/compositions';
import { ClientHome } from '@ledgerline/compositions/client';
import { useOutletContext } from 'react-router';

/** Where an external client lands: their positions, transactions and statements on one page. */
export function ClientHomePage() {
  const me = useOutletContext<Me>();
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-3 py-2">
      <header className="shrink-0">
        <h1 className="text-base font-semibold tracking-tight">Your account</h1>
        <p className="text-muted-foreground">
          {me.user.blotterScope
            ? `Portfolios on your account: ${me.user.blotterScope.join(', ')}. Other records are outside your account scope.`
            : 'Positions, transactions and statements.'}
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <ClientHome me={me} />
      </div>
    </div>
  );
}
