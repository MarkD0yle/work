import type { SavedView } from '@ledgerline/contracts';
import { ChevronDown, LayoutList } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '../components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '../components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/dropdown-menu';
import { Input, Label } from '../components/input';

export interface ViewSelectorProps {
  views: SavedView[];
  currentId: string | null;
  /** True when the grid differs from the saved view. */
  dirty: boolean;
  /** The signed-in user's id, to tell "my view" from someone else's. */
  userId: string;
  onSelect: (view: SavedView) => void;
  /** Overwrites the current view. Only offered to its owner. */
  onSave: () => void;
  onSaveAs: (input: { name: string; ownership: 'personal' | 'shared' }) => void;
  onDelete: () => void;
  /** Goes back to the grid's default view. Never to an empty grid. */
  onRestoreDefault: () => void;
}

const GROUPS: [SavedView['ownership'], string][] = [
  ['default', 'Default'],
  ['shared', 'Shared'],
  ['personal', 'My views'],
];

/** Chooses, saves and manages saved views (SPEC 7.2). */
export function ViewSelector({
  views,
  currentId,
  dirty,
  userId,
  onSelect,
  onSave,
  onSaveAs,
  onDelete,
  onRestoreDefault,
}: ViewSelectorProps) {
  const id = useId();
  const [saveAs, setSaveAs] = useState(false);
  const [name, setName] = useState('');
  const [ownership, setOwnership] = useState<'personal' | 'shared'>('personal');
  const [attempted, setAttempted] = useState(false);
  const current = views.find((v) => v.id === currentId);
  const mine = current?.owner.id === userId;

  const openSaveAs = (suggested: string) => {
    setName(suggested);
    setOwnership('personal');
    setAttempted(false);
    setSaveAs(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" data-slot="view-selector">
            <LayoutList aria-hidden />
            <span className="sr-only">View:</span>{' '}
            <span className="max-w-56 truncate">{current?.name ?? 'Unsaved view'}</span>{' '}
            {dirty ? (
              <span data-slot="view-dirty" className="rounded-sm bg-info/15 px-1 text-2xs text-info">
                edited
              </span>
            ) : null}
            <ChevronDown aria-hidden className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-72">
          <DropdownMenuRadioGroup
            value={currentId ?? ''}
            onValueChange={(value) => {
              const view = views.find((v) => v.id === value);
              if (view) onSelect(view);
            }}
          >
            {GROUPS.map(([kind, heading]) => {
              const group = views.filter((v) => v.ownership === kind);
              if (group.length === 0) return null;
              return (
                <div key={kind} role="group" aria-label={heading}>
                  <DropdownMenuLabel>{heading}</DropdownMenuLabel>
                  {group.map((v) => (
                    <DropdownMenuRadioItem key={v.id} value={v.id}>
                      <span className="truncate">{v.name}</span>{' '}
                      {v.ownership === 'shared' ? (
                        <span className="ml-auto pl-4 text-2xs text-muted-foreground">
                          {v.owner.id === userId ? 'yours' : v.owner.name}
                        </span>
                      ) : null}
                    </DropdownMenuRadioItem>
                  ))}
                </div>
              );
            })}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          {current && mine ? (
            <DropdownMenuItem disabled={!dirty} onSelect={onSave}>
              Save changes{dirty ? '' : ' (nothing to save)'}
            </DropdownMenuItem>
          ) : current ? (
            // Someone else's view cannot be overwritten: saving makes a personal copy instead.
            <DropdownMenuItem disabled={!dirty} onSelect={() => openSaveAs(`${current.name} (my copy)`)}>
              <span className="flex flex-col">
                <span>Save as my copy{dirty ? '' : ' (nothing to save)'}</span>
                <span className="text-2xs text-muted-foreground">
                  {current.ownership === 'default'
                    ? 'The default view is shared by everyone.'
                    : `Only ${current.owner.name} can change this view.`}
                </span>
              </span>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => openSaveAs('')}>Save as new view…</DropdownMenuItem>
          {current && mine && current.ownership !== 'default' ? (
            <DropdownMenuItem onSelect={onDelete}>Delete this view</DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={onRestoreDefault}>Restore default</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveAs} onOpenChange={setSaveAs}>
        <DialogContent>
          <DialogTitle>Save view</DialogTitle>
          <DialogDescription>
            Saves the columns, sort, filters, search, grouping and density as they are now.
          </DialogDescription>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) {
                setAttempted(true);
                return;
              }
              onSaveAs({ name: name.trim(), ownership });
              setSaveAs(false);
            }}
          >
            <div>
              <Label htmlFor={`${id}-name`}>Name</Label>
              <Input
                id={`${id}-name`}
                value={name}
                autoFocus
                aria-invalid={(attempted && !name.trim()) || undefined}
                aria-describedby={attempted && !name.trim() ? `${id}-name-error` : undefined}
                onChange={(e) => setName(e.target.value)}
              />
              {attempted && !name.trim() ? (
                <p id={`${id}-name-error`} role="alert" className="mt-1 text-xs text-critical">
                  Enter a name for the view.
                </p>
              ) : null}
            </div>
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-xs font-medium">Who can use it</legend>
              {(
                [
                  ['personal', 'Only me'],
                  ['shared', 'Everyone. Only I can change it.'],
                ] as const
              ).map(([value, text]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`${id}-ownership`}
                    value={value}
                    checked={ownership === value}
                    onChange={() => setOwnership(value)}
                  />
                  {text}
                </label>
              ))}
            </fieldset>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setSaveAs(false)}>
                Cancel
              </Button>
              <Button type="submit">Save view</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
