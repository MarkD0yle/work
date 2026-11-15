import type { SavedView, Workspace } from '@ledgerline/contracts';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Input,
  Label,
} from '@ledgerline/ui';
import { Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { WorkspaceInput } from '../../api/client';
import { PANEL_GRIDS, type Panel } from './panels';

interface EditWorkspaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  /** True when the signed-in user owns it. Otherwise only "Save as mine" is offered. */
  mine: boolean;
  views: SavedView[];
  onSave: (input: WorkspaceInput) => void;
  onSaveAsNew: (input: WorkspaceInput) => void;
  onDelete: () => void;
}

const selectClass = 'h-(--ll-control-height) w-full rounded-md border border-input bg-card px-2 text-body';

/** Edits a workspace: name, group, layout, start-up behaviour and its panels. */
export function EditWorkspace({
  open,
  onOpenChange,
  workspace,
  mine,
  views,
  onSave,
  onSaveAsNew,
  onDelete,
}: EditWorkspaceProps) {
  const id = useId();
  const [name, setName] = useState(workspace.name);
  const [group, setGroup] = useState(workspace.group ?? '');
  const [layout, setLayout] = useState(workspace.layout);
  const [loadAtStartup, setLoadAtStartup] = useState(workspace.loadAtStartup);
  const [panels, setPanels] = useState<Panel[]>(workspace.panels);
  const [attempted, setAttempted] = useState(false);

  const transactionViews = views.filter((v) => v.gridId === 'transactions');
  const problem = !name.trim() ? 'Enter a name.' : panels.length === 0 ? 'Add at least one panel.' : null;
  const input = (): WorkspaceInput => ({
    name: name.trim(),
    ...(group.trim() ? { group: group.trim() } : {}),
    layout,
    loadAtStartup,
    panels,
    ...(mine && workspace.isTeamDefault ? { isTeamDefault: true } : {}),
  });
  const submit = (action: (input: WorkspaceInput) => void) => {
    if (problem) {
      setAttempted(true);
      return;
    }
    action(input());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogTitle>Edit workspace</DialogTitle>
        <DialogDescription>
          {mine
            ? 'A workspace is a named set of panels, each showing a grid with a saved view.'
            : `This workspace belongs to ${workspace.owner.name}. Save your changes as your own copy.`}
        </DialogDescription>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={(attempted && !name.trim()) || undefined}
            />
          </div>
          <div>
            <Label htmlFor={`${id}-group`}>Group (optional)</Label>
            <Input
              id={`${id}-group`}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="e.g. Month-end"
            />
          </div>
        </div>
        <fieldset className="flex flex-wrap items-center gap-4">
          <legend className="mb-1 text-xs font-medium">Layout</legend>
          {(
            [
              ['tabs', 'Tabs: one panel at a time, switch by tab'],
              ['single', 'Single: the first panel only'],
            ] as const
          ).map(([value, text]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name={`${id}-layout`}
                checked={layout === value}
                onChange={() => setLayout(value)}
              />
              {text}
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-muted-foreground">
          For side-by-side work, pop a panel out into its own window. It stays in step with this one.
        </p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={loadAtStartup}
            onChange={(e) => setLoadAtStartup(e.target.checked)}
          />
          Open this workspace when I sign in
        </label>

        <div>
          <p className="mb-1 text-xs font-medium">Panels</p>
          <ul className="flex flex-col gap-2">
            {panels.map((panel, i) => (
              <li key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor={`${id}-grid-${i}`}>Panel {i + 1} grid</Label>
                  <select
                    id={`${id}-grid-${i}`}
                    className={selectClass}
                    value={panel.gridId}
                    onChange={(e) =>
                      setPanels((prev) =>
                        prev.map((p, j) =>
                          j === i
                            ? {
                                gridId: e.target.value,
                                viewId:
                                  e.target.value === 'transactions'
                                    ? (transactionViews[0]?.id ?? 'default')
                                    : 'default',
                              }
                            : p,
                        ),
                      )
                    }
                  >
                    {Object.entries(PANEL_GRIDS).map(([gridId, grid]) => (
                      <option key={gridId} value={gridId}>
                        {grid.title}
                        {grid.milestone ? ' (not built yet)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <Label htmlFor={`${id}-view-${i}`}>View</Label>
                  <select
                    id={`${id}-view-${i}`}
                    className={selectClass}
                    value={panel.viewId}
                    disabled={panel.gridId !== 'transactions'}
                    onChange={(e) =>
                      setPanels((prev) =>
                        prev.map((p, j) => (j === i ? { ...p, viewId: e.target.value } : p)),
                      )
                    }
                  >
                    {panel.gridId === 'transactions' ? (
                      transactionViews.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))
                    ) : (
                      <option value={panel.viewId}>Default</option>
                    )}
                  </select>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove panel ${i + 1}`}
                  onClick={() => setPanels((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            className="mt-2"
            onClick={() =>
              setPanels((prev) => [
                ...prev,
                { gridId: 'transactions', viewId: transactionViews[0]?.id ?? 'default' },
              ])
            }
          >
            Add panel
          </Button>
        </div>
        {attempted && problem ? (
          <p role="alert" className="text-xs text-critical">
            {problem}
          </p>
        ) : null}
        <DialogFooter>
          {mine ? (
            <Button
              variant="ghost"
              className="mr-auto text-critical"
              onClick={() => {
                onDelete();
                onOpenChange(false);
              }}
            >
              Delete workspace
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={mine ? 'secondary' : 'default'} onClick={() => submit(onSaveAsNew)}>
            Save as new
          </Button>
          {mine ? <Button onClick={() => submit(onSave)}>Save</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
