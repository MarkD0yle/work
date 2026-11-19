import type { Workspace } from '@ledgerline/contracts';
import { Badge, Button, cn, toast, useNotifications } from '@ledgerline/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Pencil } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import {
  ApiError,
  createWorkspace,
  deleteWorkspace,
  fetchViews,
  fetchWorkspaces,
  updateWorkspace,
  type Me,
  type WorkspaceInput,
} from '../api/client';
import { ErrorPanel, LoadingPanel } from '@ledgerline/compositions';
import type { BlotterHandle } from '@ledgerline/compositions/transactions';
import { useWorkspaceChannel, type WorkspaceMessage } from '../features/workspaces/channel';
import { EditWorkspace } from '../features/workspaces/EditWorkspace';
import { PanelContent, panelTitle } from '../features/workspaces/panels';

/** A workspace: a named set of panels, shown as tabs or as a single panel. Panels can be popped out into their own windows. */
export function WorkspaceScreen() {
  const me = useOutletContext<Me>();
  const { workspaceId } = useParams();
  const workspaces = useQuery({ queryKey: ['workspaces', me.user.id], queryFn: fetchWorkspaces });

  if (workspaces.isPending) return <LoadingPanel label="Loading workspace…" />;
  if (workspaces.error) {
    return (
      <ErrorPanel
        messages={workspaces.error instanceof ApiError ? workspaces.error.messages : []}
        onRetry={() => void workspaces.refetch()}
      />
    );
  }
  const workspace = workspaces.data.find((w) => w.id === workspaceId);
  if (!workspace) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold tracking-tight">Workspace not found</h1>
        <p className="text-muted-foreground">
          It may have been deleted, or it belongs to someone else. Choose a workspace from the switcher in the
          top bar.
        </p>
      </div>
    );
  }
  return <WorkspaceView key={workspace.id} me={me} workspace={workspace} />;
}

function WorkspaceView({ me, workspace }: { me: Me; workspace: Workspace }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState(false);
  /** Panels currently open in their own windows, with the number of rows selected there. */
  const [popped, setPopped] = useState<Record<number, { selected: number }>>({});
  const blotter = useRef<BlotterHandle>(null);
  const views = useQuery({
    queryKey: ['views', 'transactions', me.user.id],
    queryFn: () => fetchViews('transactions'),
  });

  const onMessage = useCallback((message: WorkspaceMessage) => {
    if (message.type === 'open')
      setPopped((prev) => ({ ...prev, [message.panel]: prev[message.panel] ?? { selected: 0 } }));
    else if (message.type === 'closed') setPopped(({ [message.panel]: _gone, ...rest }) => rest);
    else if (message.type === 'selection')
      setPopped((prev) => ({ ...prev, [message.panel]: { selected: message.count } }));
    else if (message.type === 'refresh') blotter.current?.refresh();
  }, []);
  const send = useWorkspaceChannel(workspace.id, onMessage);
  // Find pop-outs that were already open before this window loaded.
  useEffect(() => send({ type: 'who' }), [send]);

  const mine = workspace.owner.id === me.user.id;
  const panels = workspace.layout === 'single' ? workspace.panels.slice(0, 1) : workspace.panels;
  const index = Math.min(active, panels.length - 1);
  const panel = panels[index];

  const popOut = (i: number) => {
    const opened = window.open(
      `${import.meta.env.BASE_URL}popout/${workspace.id}/${i}`,
      `ll-${workspace.id}-${i}`,
      'popup,width=1280,height=800',
    );
    if (!opened) {
      notify(
        {
          code: 'LL-WSP-0002',
          severity: 'warning',
          level: 'operation',
          text: 'The browser blocked the new window.',
          fix: 'Allow pop-ups for this site, then pop the panel out again.',
        },
        'Workspaces',
      );
    }
  };

  const reload = () => queryClient.invalidateQueries({ queryKey: ['workspaces', me.user.id] });
  const fail = (error: unknown) => {
    for (const m of error instanceof ApiError ? error.messages : []) notify(m, 'Workspaces');
  };
  const save = async (input: WorkspaceInput) => {
    try {
      await updateWorkspace(workspace.id, input);
      await reload();
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      toast('Workspace saved', input.name);
    } catch (error) {
      fail(error);
    }
  };
  const saveAsNew = async (input: WorkspaceInput) => {
    try {
      const { isTeamDefault: _notMine, ...own } = input;
      const { record } = await createWorkspace(own);
      await reload();
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      toast('Workspace saved', record.name);
      void navigate(`/w/${record.id}`);
    } catch (error) {
      fail(error);
    }
  };
  const remove = async () => {
    try {
      await deleteWorkspace(workspace.id);
      await reload();
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      toast('Workspace deleted', workspace.name);
      void navigate('/');
    } catch (error) {
      fail(error);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-3 py-2">
      <header className="flex shrink-0 flex-wrap items-center gap-2">
        <h1 className="text-base font-semibold tracking-tight">{workspace.name}</h1>
        {workspace.group ? <span className="text-muted-foreground">{workspace.group}</span> : null}
        {workspace.isTeamDefault ? <Badge status="info">Team default</Badge> : null}
        {workspace.loadAtStartup ? <Badge status="neutral">Opens at sign-in</Badge> : null}
        <div className="flex-1" />
        {panel ? (
          <Button variant="secondary" onClick={() => popOut(index)} disabled={popped[index] !== undefined}>
            <ExternalLink aria-hidden />
            Pop out {panelTitle(panel)}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => setEditing(true)}>
          <Pencil aria-hidden />
          Edit workspace
        </Button>
      </header>

      {panels.length > 1 ? (
        <div role="tablist" aria-label={`${workspace.name} panels`} className="flex shrink-0 gap-1 border-b">
          {panels.map((p, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              id={`panel-tab-${i}`}
              aria-selected={i === index}
              aria-controls="workspace-panel"
              tabIndex={i === index ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                const next = (i + (e.key === 'ArrowRight' ? 1 : panels.length - 1)) % panels.length;
                setActive(next);
                document.getElementById(`panel-tab-${next}`)?.focus();
              }}
              className={cn(
                '-mb-px flex h-(--ll-control-height) items-center gap-2 border-b-2 px-3',
                i === index
                  ? 'border-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {panelTitle(p)}
              <span className="text-2xs text-muted-foreground">
                {views.data?.find((v) => v.id === p.viewId)?.name ?? ''}
              </span>
              {popped[i] ? <Badge status="info">In its own window</Badge> : null}
            </button>
          ))}
        </div>
      ) : null}

      <div
        id="workspace-panel"
        role={panels.length > 1 ? 'tabpanel' : undefined}
        aria-labelledby={panels.length > 1 ? `panel-tab-${index}` : undefined}
        className="min-h-0 flex-1"
      >
        {!panel ? (
          <p className="p-6 text-muted-foreground">
            This workspace has no panels. Choose Edit workspace to add one.
          </p>
        ) : popped[index] ? (
          <div data-slot="popped-out" className="flex flex-col items-start gap-2 p-6">
            <p className="text-lg font-semibold">{panelTitle(panel)} is open in its own window</p>
            <p className="text-muted-foreground" role="status">
              {popped[index].selected} {popped[index].selected === 1 ? 'row' : 'rows'} selected there.
              Refreshing either window refreshes both.
            </p>
            <Button variant="secondary" onClick={() => send({ type: 'close', panel: index })}>
              Bring it back here
            </Button>
          </div>
        ) : (
          // Keyed by panel so switching tabs gives each panel its own grid and view.
          <PanelContent
            key={`${index}-${panel.gridId}-${panel.viewId}`}
            ref={blotter}
            panel={panel}
            me={me}
            onRefresh={() => send({ type: 'refresh' })}
          />
        )}
      </div>

      {editing ? (
        <EditWorkspace
          open
          onOpenChange={setEditing}
          workspace={workspace}
          mine={mine}
          views={views.data ?? []}
          onSave={(input) => void save(input)}
          onSaveAsNew={(input) => void saveAsNew(input)}
          onDelete={() => void remove()}
        />
      ) : null}
    </div>
  );
}
