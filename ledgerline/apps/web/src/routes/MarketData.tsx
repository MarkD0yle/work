import type { Me } from '@ledgerline/compositions';
import { PriceReview } from '@ledgerline/compositions/accounting';
import { useOutletContext } from 'react-router';

/** Market Data: price exceptions, prices with the prior day beside them, and the tolerance rules. */
export function MarketData() {
  const me = useOutletContext<Me>();
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-3 py-2">
      <header className="shrink-0">
        <h1 className="text-base font-semibold tracking-tight">Market Data</h1>
        <p className="text-muted-foreground">Review prices outside the rules, and set the rules.</p>
      </header>
      <div className="min-h-0 flex-1">
        <PriceReview me={me} />
      </div>
    </div>
  );
}
