import type { Workspace } from '@ledgerline/contracts';
import { Badge } from '@ledgerline/ui';
import type { Ref } from 'react';
import type { Me } from '../../api/client';
import { TransactionsBlotter, type BlotterHandle } from '../transactions/TransactionsBlotter';

export type Panel = Workspace['panels'][number];

/** Every grid a workspace panel can show. Grids that are not built yet say so instead of showing nothing. */
export const PANEL_GRIDS: Record<string, { title: string; milestone?: number }> = {
  transactions: { title: 'Transactions' },
  periods: { title: 'Period close', milestone: 6 },
  exceptions: { title: 'Exceptions', milestone: 6 },
  prices: { title: 'Prices', milestone: 6 },
};

export const panelTitle = (panel: Panel): string => PANEL_GRIDS[panel.gridId]?.title ?? panel.gridId;

interface PanelContentProps {
  panel: Panel;
  me: Me;
  onRefresh?: () => void;
  onSelection?: (ids: string[]) => void;
  ref?: Ref<BlotterHandle>;
}

export function PanelContent({ panel, me, onRefresh, onSelection, ref }: PanelContentProps) {
  if (panel.gridId === 'transactions') {
    return (
      <TransactionsBlotter
        {...(ref ? { ref } : {})}
        me={me}
        initial={{ viewId: panel.viewId }}
        {...(onRefresh ? { onRefresh } : {})}
        {...(onSelection ? { onSelection } : {})}
      />
    );
  }
  const grid = PANEL_GRIDS[panel.gridId];
  return (
    <div className="flex flex-col items-start gap-2 p-6">
      <Badge status="info">Not built yet</Badge>
      <p className="max-w-prose text-muted-foreground">
        {grid
          ? `${grid.title} arrives in Milestone ${grid.milestone} of docs/PLAN.md.`
          : `There is no “${panel.gridId}” grid.`}{' '}
        The panel keeps its place in this workspace.
      </p>
    </div>
  );
}
