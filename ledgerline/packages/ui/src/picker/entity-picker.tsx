import type { EntityRef, EntitySearchResult } from '@ledgerline/contracts';
import { LoaderCircle, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Input, Label } from '../components/input';
import { cn } from '../lib/cn';
import { EntityOptionContent } from './entity-option';
import { detectIdentifier, shouldSearch } from './identify';

const DEBOUNCE_MS = 200;

export interface EntityPickerProps {
  label: string;
  /** Hides the label visually (it stays the accessible name), for toolbars and the global search. */
  hideLabel?: boolean;
  value: EntityRef | null;
  onChange: (value: EntityRef | null, result?: EntitySearchResult) => void;
  /** Runs the search. Exact identifier matches must come first; restricted records must be included. */
  search: (query: string, options: { includeInactive: boolean }) => Promise<EntitySearchResult[]>;
  /** Last items this user picked, shown before they type. */
  recent?: () => Promise<EntitySearchResult[]>;
  placeholder?: string;
  disabled?: boolean;
  /** Clear the field after a pick (global search), instead of showing the picked item. */
  clearOnSelect?: boolean;
  className?: string;
}

type Phase = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The inline Entity Picker: one selection pattern for portfolios, securities and other records (SPEC 7.3).
 * A combobox that searches after 2 characters (or at once for an identifier), 200ms after typing stops.
 * Pasting a known identifier selects the record in one step.
 */
export function EntityPicker({
  label,
  hideLabel,
  value,
  onChange,
  search,
  recent,
  placeholder,
  disabled,
  clearOnSelect,
  className,
}: EntityPickerProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [results, setResults] = useState<EntitySearchResult[]>([]);
  const [showingRecent, setShowingRecent] = useState(false);
  const [active, setActive] = useState(0);
  const [includeInactive, setIncludeInactive] = useState(false);
  /** Guards against an older, slower search overwriting a newer one. */
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const choose = (result: EntitySearchResult) => {
    if (result.restricted) return;
    onChange(result.ref, result);
    setText('');
    setOpen(false);
    setResults([]);
    setPhase('idle');
    if (clearOnSelect) input.current?.blur();
  };

  const run = (query: string, inactive: boolean, autoSelect: boolean) => {
    clearTimeout(timer.current);
    const ticket = ++request.current;
    setPhase('loading');
    setShowingRecent(false);
    search(query.trim(), { includeInactive: inactive }).then(
      (found) => {
        if (ticket !== request.current) return;
        // A pasted identifier with one exact, unrestricted match is selected in one step.
        const exact = found.filter((r) => r.matchedOn && !r.restricted);
        if (autoSelect && exact.length === 1 && exact[0]) {
          choose(exact[0]);
          return;
        }
        setResults(found);
        setActive(
          Math.max(
            0,
            found.findIndex((r) => !r.restricted),
          ),
        );
        setPhase('ready');
      },
      () => {
        if (ticket === request.current) setPhase('error');
      },
    );
  };

  const loadRecent = () => {
    if (!recent) return;
    const ticket = ++request.current;
    recent().then(
      (found) => {
        if (ticket !== request.current) return;
        setResults(found);
        setShowingRecent(true);
        setActive(0);
        setPhase('ready');
      },
      () => undefined,
    );
  };

  const onText = (next: string, pasted = false) => {
    setText(next);
    setOpen(true);
    clearTimeout(timer.current);
    if (!shouldSearch(next)) {
      request.current += 1;
      setResults([]);
      setPhase('idle');
      if (next.trim() === '') loadRecent();
      return;
    }
    const identifier = detectIdentifier(next) !== null;
    if (pasted && identifier) run(next, includeInactive, true);
    else timer.current = setTimeout(() => run(next, includeInactive, false), DEBOUNCE_MS);
  };

  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-opt-${i}`;
  const showList = open && !disabled;
  const typed = text.trim();

  return (
    <div data-slot="entity-picker" className={cn('relative flex flex-col', className)}>
      <Label htmlFor={id} className={hideLabel ? 'sr-only' : 'mb-1'}>
        {label}
      </Label>
      <div className="relative flex items-center">
        <Search aria-hidden className="pointer-events-none absolute left-2 size-4 text-muted-foreground" />
        <Input
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? optionId(active) : undefined}
          autoComplete="off"
          disabled={disabled}
          value={text}
          placeholder={
            value ? `${value.label} (${value.id})` : (placeholder ?? 'Search by name or identifier')
          }
          onChange={(e) => onText(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text');
            if (detectIdentifier(pasted)) {
              e.preventDefault();
              onText(pasted.trim(), true);
            }
          }}
          onFocus={() => {
            setOpen(true);
            if (typed === '') loadRecent();
          }}
          onBlur={() => {
            // Leaving the field closes the list. Options are chosen on mouse down, before blur.
            setOpen(false);
            clearTimeout(timer.current);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              if (!open) setOpen(true);
              else if (results.length)
                setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length);
            } else if (e.key === 'Enter' && showList && results[active]) {
              e.preventDefault();
              choose(results[active]);
            } else if (e.key === 'Escape') {
              if (open) e.stopPropagation();
              setOpen(false);
              setText('');
            }
          }}
          className={cn('pl-8', value && !text ? 'pr-8 placeholder:text-foreground' : '')}
        />
        {phase === 'loading' ? (
          <LoaderCircle
            aria-hidden
            className="absolute right-2 size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
          />
        ) : null}
        {value && !text && phase !== 'loading' ? (
          <button
            type="button"
            aria-label={`Clear ${label}: ${value.label}`}
            disabled={disabled}
            onClick={() => {
              onChange(null);
              input.current?.focus();
            }}
            className="absolute right-1 flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div
        className={cn(
          'absolute top-full left-0 z-40 mt-1 w-full min-w-96 rounded-md border bg-popover text-popover-foreground shadow-popover',
          !showList && 'hidden',
        )}
        // Keep focus in the input while the list is clicked.
        onMouseDown={(e) => e.preventDefault()}
      >
        <ul
          id={listId}
          role="listbox"
          aria-label={showingRecent ? `Recent ${label.toLowerCase()}` : `${label} results`}
          className="max-h-80 overflow-y-auto p-1"
        >
          {showingRecent && results.length ? (
            <li
              role="presentation"
              className="px-2 py-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase"
            >
              Recent
            </li>
          ) : null}
          {results.map((result, i) => (
            <li
              key={`${result.ref.kind}-${result.ref.id}`}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              // Restricted records stay in the list and can be moved to, so their reason is announced; they cannot be chosen.
              aria-disabled={result.restricted ? true : undefined}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(result);
              }}
              className={cn(
                'flex cursor-default items-start gap-2 rounded-sm px-2 py-1',
                i === active && 'bg-accent',
                result.restricted && 'cursor-not-allowed',
              )}
            >
              <EntityOptionContent result={result} />
            </li>
          ))}
        </ul>
        <div
          role="status"
          aria-live="polite"
          className="px-3 py-1.5 text-xs text-muted-foreground empty:hidden"
        >
          {phase === 'loading' && results.length === 0 ? 'Searching…' : null}
          {phase === 'error' ? 'Search failed. Check your connection and type again.' : null}
          {phase === 'ready' && results.length === 0
            ? showingRecent
              ? 'Type at least 2 characters, or paste an identifier.'
              : `No matches for “${typed}”. Check the identifier${includeInactive ? '' : ', or show inactive records'}.`
            : null}
          {phase === 'idle' && typed.length === 1 ? 'Keep typing: search starts at 2 characters.' : null}
          {phase === 'idle' && typed === '' && !recent
            ? 'Type at least 2 characters, or paste an identifier.'
            : null}
          {phase === 'ready' && results.length > 0 && !showingRecent
            ? `${results.length} ${results.length === 1 ? 'result' : 'results'}`
            : null}
        </div>
        <label className="flex items-center gap-2 border-t px-3 py-1.5 text-xs">
          <input
            type="checkbox"
            checked={includeInactive}
            // The checkbox is inside the popup, so it must not take focus away from the input.
            tabIndex={-1}
            onChange={(e) => {
              setIncludeInactive(e.target.checked);
              if (shouldSearch(text)) run(text, e.target.checked, false);
            }}
          />
          Show inactive
        </label>
      </div>
    </div>
  );
}
