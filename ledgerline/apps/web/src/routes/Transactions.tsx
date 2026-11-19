import { decodeViewDiff, encodeViewDiff, type ViewDiff } from '@ledgerline/ui';
import { useCallback, useState } from 'react';
import { useLocation, useOutletContext, useSearchParams } from 'react-router';
import type { Me } from '../api/client';
import { TransactionsBlotter } from '@ledgerline/compositions/transactions';

/**
 * The Transactions page. The URL carries the view id and any unsaved changes (`?view=…&d=…`),
 * so a view can be shared by link exactly as it looks.
 */
export function Transactions() {
  const location = useLocation();
  // A link from global search carries a nonce: the screen starts again from that link even if it is already open.
  const nonce = (location.state as { nonce?: string } | null)?.nonce ?? 'page';
  return <TransactionsPage key={nonce} />;
}

function TransactionsPage() {
  const me = useOutletContext<Me>();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  // Read once: after that the screen owns its state and writes it back to the URL.
  const [initial] = useState(() => ({ viewId: params.get('view'), diff: decodeViewDiff(params.get('d')) }));

  const onLocation = useCallback(
    (viewId: string | null, diff: ViewDiff) => {
      const next = new URLSearchParams();
      if (viewId) next.set('view', viewId);
      const encoded = encodeViewDiff(diff);
      if (encoded) next.set('d', encoded);
      setParams((prev) => (prev.toString() === next.toString() ? prev : next), {
        replace: true,
        state: location.state,
      });
    },
    [setParams, location.state],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-3 py-2">
      <header className="shrink-0">
        <h1 className="text-base font-semibold tracking-tight">Transactions</h1>
        {me.user.blotterScope ? (
          <p className="text-muted-foreground">
            Showing only your portfolios: {me.user.blotterScope.join(', ')}. Other records are outside your
            account scope.
          </p>
        ) : null}
      </header>
      <div className="min-h-0 flex-1">
        <TransactionsBlotter me={me} initial={initial} onLocation={onLocation} />
      </div>
    </div>
  );
}
