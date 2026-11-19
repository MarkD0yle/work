import { applyDensity, applyTheme } from '@ledgerline/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { ApiError, fetchMe, fetchWorkspaces } from '../api/client';
import { ErrorPanel, LoadingPanel } from '@ledgerline/compositions';
import type { BlotterHandle } from '@ledgerline/compositions/transactions';
import { useWorkspaceChannel, type WorkspaceMessage } from '../features/workspaces/channel';
import { PanelContent, panelTitle } from '../features/workspaces/panels';
import { useSession } from '../state/session';

/**
 * One workspace panel in its own browser window, for multi-monitor work.
 * It has no navigation of its own and stays in step with the main window: a refresh in either refreshes both,
 * and the main window can see the selection here and bring the panel back.
 */
export function Popout() {
  const { workspaceId, panel: panelParam } = useParams();
  const index = Number.parseInt(panelParam ?? '0', 10);
  const { userId, theme, density } = useSession();
  const me = useQuery({ queryKey: ['me', userId], queryFn: fetchMe, enabled: Boolean(userId) });
  const workspaces = useQuery({
    queryKey: ['workspaces', userId],
    queryFn: fetchWorkspaces,
    enabled: Boolean(userId),
  });
  const blotter = useRef<BlotterHandle>(null);

  const effectiveDensity = density ?? me.data?.user.defaultDensity ?? 'standard';
  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => applyDensity(effectiveDensity), [effectiveDensity]);

  const sendRef = useRef<(message: WorkspaceMessage) => void>(() => undefined);
  const onMessage = useCallback(
    (message: WorkspaceMessage) => {
      if (message.type === 'who') sendRef.current({ type: 'open', panel: index });
      else if (message.type === 'close' && message.panel === index) window.close();
      else if (message.type === 'refresh') blotter.current?.refresh();
    },
    [index],
  );
  const send = useWorkspaceChannel(workspaceId, onMessage);
  useEffect(() => {
    sendRef.current = send;
    send({ type: 'open', panel: index });
    const closed = () => send({ type: 'closed', panel: index });
    window.addEventListener('pagehide', closed);
    return () => {
      window.removeEventListener('pagehide', closed);
      closed();
    };
  }, [send, index]);

  const failed = me.error ?? workspaces.error;
  if (failed) {
    return (
      <ErrorPanel
        messages={failed instanceof ApiError ? failed.messages : []}
        onRetry={() => {
          void me.refetch();
          void workspaces.refetch();
        }}
      />
    );
  }
  if (!me.data || !workspaces.data) return <LoadingPanel label="Opening panel…" />;
  const workspace = workspaces.data.find((w) => w.id === workspaceId);
  const panel = workspace?.panels[index];
  if (!workspace || !panel) {
    return (
      <main className="p-6">
        <h1 className="text-lg font-semibold tracking-tight">Panel not found</h1>
        <p className="text-muted-foreground">
          The workspace or panel no longer exists. Close this window and pop the panel out again.
        </p>
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col gap-2 px-3 py-2">
      <header className="flex shrink-0 items-baseline gap-2">
        <h1 className="text-base font-semibold tracking-tight">{panelTitle(panel)}</h1>
        <p className="text-muted-foreground">
          Popped out of {workspace.name} · signed in as {me.data.user.name}
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <PanelContent
          ref={blotter}
          panel={panel}
          me={me.data}
          onRefresh={() => send({ type: 'refresh' })}
          onSelection={(ids) => send({ type: 'selection', panel: index, count: ids.length })}
        />
      </div>
    </main>
  );
}
