import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/dialog';
import { cn } from '../lib/cn';
import { useCommands, type CommandGroup, type CommandItem } from './command-context';

const GROUP_ORDER: CommandGroup[] = ['Actions', 'Views', 'Navigation', 'Workspaces', 'Entities'];
const DEBOUNCE_MS = 200;

/** Every word typed must appear somewhere in the command's label, hint, keywords or group. */
export function matchCommands(items: CommandItem[], query: string): CommandItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((item) => {
    const text = `${item.label} ${item.hint ?? ''} ${item.keywords ?? ''} ${item.group}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

export interface CommandPaletteProps {
  /** Groups this user may see. External clients get navigation and views only (SPEC 8.6). */
  groups?: CommandGroup[];
  /** Finds entities (portfolios, securities) for the typed text. Runs after 2 characters. */
  searchEntities?: (query: string) => Promise<CommandItem[]>;
}

/** The command palette: Ctrl/Cmd+K. Arrow keys move, Enter runs, Escape closes. */
export function CommandPalette({ groups = GROUP_ORDER, searchEntities }: CommandPaletteProps) {
  const { open, setOpen, collect } = useCommands();
  const id = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [items, setItems] = useState<CommandItem[]>([]);
  const [entities, setEntities] = useState<CommandItem[]>([]);
  const [searching, setSearching] = useState(false);
  const request = useRef(0);

  // Ask every screen what it offers at the moment the palette opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setItems(collect());
      setQuery('');
      setActive(0);
      setEntities([]);
    }
  }

  const canSearchEntities = Boolean(searchEntities) && groups.includes('Entities');
  useEffect(() => {
    if (!open || !searchEntities || !canSearchEntities) return;
    const text = query.trim();
    const ticket = ++request.current;
    if (text.length < 2) return;
    const timer = setTimeout(() => {
      setSearching(true);
      searchEntities(text).then(
        (found) => {
          if (ticket !== request.current) return;
          setEntities(found);
          setSearching(false);
        },
        () => ticket === request.current && setSearching(false),
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, query, searchEntities, canSearchEntities]);

  const shown = useMemo(() => {
    const local = matchCommands(items, query).filter((i) => groups.includes(i.group));
    const found = query.trim().length >= 2 ? entities : [];
    return GROUP_ORDER.flatMap((group) => [...local, ...found].filter((i) => i.group === group));
  }, [items, entities, query, groups]);
  const index = Math.min(active, Math.max(0, shown.length - 1));
  const current = shown[index];

  const runItem = (item: CommandItem) => {
    if (item.disabledReason) return;
    setOpen(false);
    // Let the dialog close and give focus back before the command acts on the screen.
    setTimeout(item.run, 0);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-24 max-w-xl translate-y-0 gap-0 p-0" aria-describedby={`${id}-help`}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription id={`${id}-help`} className="sr-only">
          Type to search navigation, views, records and actions. Arrow keys move, Enter runs, Escape closes.
        </DialogDescription>
        <div className="flex items-center gap-2 border-b px-3">
          <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <input
            role="combobox"
            aria-label="Search commands"
            aria-expanded
            aria-controls={`${id}-list`}
            aria-activedescendant={current ? `${id}-${index}` : undefined}
            autoFocus
            value={query}
            placeholder="Go to, find a record, or run an action…"
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (shown.length)
                  setActive((index + (e.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length);
              } else if (e.key === 'Enter' && current) {
                e.preventDefault();
                runItem(current);
              }
            }}
            className="h-11 min-w-0 flex-1 bg-transparent pr-8 text-base outline-hidden placeholder:text-muted-foreground"
          />
        </div>
        <ul id={`${id}-list`} role="listbox" aria-label="Commands" className="max-h-96 overflow-y-auto p-1">
          {shown.map((item, i) => {
            const first = i === 0 || shown[i - 1]?.group !== item.group;
            return (
              <li key={`${item.group}-${item.id}`} role="presentation">
                {first ? (
                  <p
                    role="presentation"
                    className="px-2 pt-2 pb-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase"
                  >
                    {item.group}
                  </p>
                ) : null}
                <div
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={i === index}
                  aria-disabled={item.disabledReason ? true : undefined}
                  data-command-id={item.id}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => runItem(item)}
                  className={cn(
                    'flex cursor-default items-start gap-3 rounded-sm px-2 py-1.5',
                    i === index && 'bg-accent',
                    item.disabledReason && 'cursor-not-allowed',
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn(item.disabledReason && 'text-muted-foreground')}>{item.label}</span>
                    {item.disabledReason ? (
                      <span className="text-2xs text-muted-foreground">
                        Not available: {item.disabledReason}
                      </span>
                    ) : item.hint ? (
                      <span className="truncate text-2xs text-muted-foreground">{item.hint}</span>
                    ) : null}
                  </span>
                  {item.shortcut ? (
                    <kbd className="shrink-0 font-sans text-2xs text-muted-foreground">{item.shortcut}</kbd>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <p role="status" aria-live="polite" className="border-t px-3 py-1.5 text-xs text-muted-foreground">
          {searching
            ? 'Searching records…'
            : shown.length === 0
              ? `Nothing matches “${query.trim()}”.`
              : `${shown.length} ${shown.length === 1 ? 'command' : 'commands'}`}
          {canSearchEntities && query.trim().length < 2 ? ' · Type 2 or more characters to find records' : ''}
        </p>
      </DialogContent>
    </Dialog>
  );
}
