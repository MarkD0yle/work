import type { EntityRef, EntitySearchResult } from '@ledgerline/contracts';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '../components/dialog';
import { Input, Label } from '../components/input';
import { cn } from '../lib/cn';
import { EntityOptionContent } from './entity-option';

export interface EntityCriteria {
  type?: string;
  currency?: string;
  includeInactive: boolean;
}

export interface EntityPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Runs a criteria search. An empty query with criteria is allowed. */
  search: (query: string, criteria: EntityCriteria) => Promise<EntitySearchResult[]>;
  /** Choices for the criteria. Leave a list out to hide that criterion. */
  types?: string[];
  currencies?: string[];
  /** Records already chosen, shown ticked. */
  selected?: EntityRef[];
  onConfirm: (selected: EntityRef[]) => void;
}

const selectClass = 'h-(--ll-control-height) w-full rounded-md border border-input bg-card px-2 text-body';

/** The sheet mode of the Entity Picker: criteria search and large multi-select (SPEC 7.3). */
export function EntityPickerSheet({
  open,
  onOpenChange,
  title,
  search,
  types,
  currencies,
  selected,
  onConfirm,
}: EntityPickerSheetProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [criteria, setCriteria] = useState<EntityCriteria>({ includeInactive: false });
  const [results, setResults] = useState<EntitySearchResult[]>([]);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [picked, setPicked] = useState<Map<string, EntityRef>>(new Map());
  const request = useRef(0);

  // Start each opening from the caller's current selection.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPicked(new Map((selected ?? []).map((ref) => [ref.id, ref])));
  }

  useEffect(() => {
    if (!open) return;
    const hasCriteria = Boolean(criteria.type || criteria.currency);
    if (query.trim().length < 2 && !hasCriteria) return;
    const ticket = ++request.current;
    const timer = setTimeout(() => {
      setPhase('loading');
      search(query.trim(), criteria).then(
        (found) => {
          if (ticket !== request.current) return;
          setResults(found);
          setPhase('ready');
        },
        () => ticket === request.current && setPhase('error'),
      );
    }, 200);
    return () => clearTimeout(timer);
  }, [open, query, criteria, search]);

  const toggle = (result: EntitySearchResult) => {
    if (result.restricted) return;
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(result.ref.id)) next.delete(result.ref.id);
      else next.set(result.ref.id, result.ref);
      return next;
    });
  };
  const selectable = results.filter((r) => !r.restricted);
  const waiting = query.trim().length < 2 && !criteria.type && !criteria.currency;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Search by name or identifier, narrow with the criteria, then tick the records you want.
        </DialogDescription>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2">
            <Label htmlFor={`${id}-q`}>Search</Label>
            <Input
              id={`${id}-q`}
              type="search"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {types ? (
            <div>
              <Label htmlFor={`${id}-type`}>Type</Label>
              <select
                id={`${id}-type`}
                className={selectClass}
                value={criteria.type ?? ''}
                onChange={(e) =>
                  setCriteria(({ type: _t, ...rest }) =>
                    e.target.value ? { ...rest, type: e.target.value } : rest,
                  )
                }
              >
                <option value="">Any type</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {currencies ? (
            <div>
              <Label htmlFor={`${id}-ccy`}>Currency</Label>
              <select
                id={`${id}-ccy`}
                className={selectClass}
                value={criteria.currency ?? ''}
                onChange={(e) =>
                  setCriteria(({ currency: _c, ...rest }) =>
                    e.target.value ? { ...rest, currency: e.target.value } : rest,
                  )
                }
              >
                <option value="">Any currency</option>
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={criteria.includeInactive}
              onChange={(e) => setCriteria((c) => ({ ...c, includeInactive: e.target.checked }))}
            />
            Show inactive
          </label>
          <span role="status" aria-live="polite" className="text-muted-foreground">
            {waiting
              ? 'Type at least 2 characters or choose a criterion.'
              : phase === 'loading'
                ? 'Searching…'
                : phase === 'error'
                  ? 'Search failed. Change the search to try again.'
                  : `${results.length} ${results.length === 1 ? 'result' : 'results'}${results.length >= 50 ? ' (first 50: narrow the search to see others)' : ''}`}
          </span>
          {selectable.length > 1 && !waiting ? (
            <Button
              variant="link"
              className="h-6 px-0 text-xs"
              onClick={() =>
                setPicked((prev) => new Map([...prev, ...selectable.map((r) => [r.ref.id, r.ref] as const)]))
              }
            >
              Select all {selectable.length} shown
            </Button>
          ) : null}
        </div>
        <ul aria-label={`${title} results`} className="min-h-0 flex-1 overflow-y-auto rounded-md border">
          {(waiting ? [] : results).map((result) => {
            const checked = picked.has(result.ref.id);
            return (
              <li key={result.ref.id} className="border-b last:border-b-0">
                <label
                  className={cn(
                    'flex items-start gap-3 px-3 py-1.5',
                    result.restricted ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-accent',
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    // Restricted records stay focusable so their reason is read; ticking them does nothing.
                    aria-disabled={result.restricted ? true : undefined}
                    onChange={() => toggle(result)}
                  />
                  <EntityOptionContent result={result} />
                </label>
              </li>
            );
          })}
        </ul>
        <DialogFooter className="items-center">
          <span className="mr-auto text-muted-foreground" role="status">
            {picked.size} selected
          </span>
          {picked.size ? (
            <Button variant="ghost" onClick={() => setPicked(new Map())}>
              Clear selection
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm([...picked.values()]);
              onOpenChange(false);
            }}
          >
            Use {picked.size} selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
