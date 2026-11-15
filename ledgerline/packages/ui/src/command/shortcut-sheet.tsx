import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/dialog';
import { useCommands, type ShortcutEntry } from './command-context';

export interface ShortcutSection {
  title: string;
  entries: ShortcutEntry[];
}

const headingId = (title: string) => `shortcuts-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

/** Keys that work in every Ledgerline grid (SPEC 7.1). */
export const GRID_SHORTCUTS: ShortcutEntry[] = [
  { keys: 'Arrow keys', what: 'Move between cells' },
  { keys: 'Space', what: 'Select or clear the row' },
  { keys: 'Shift+Space', what: 'Extend the selection to this row' },
  { keys: 'Ctrl+A', what: 'Select all rows in view' },
  { keys: 'Enter or F2', what: 'Open the row' },
  { keys: 'Escape', what: 'Clear the selection' },
  { keys: 'Shift+F10', what: 'Open the actions menu for the row' },
  { keys: 'Ctrl+I', what: 'Show where a financial value came from' },
];

/** The shortcut sheet, opened with "?". It lists global keys, grid keys and the shortcuts of actions on this screen. */
export function ShortcutSheet({ sections }: { sections: ShortcutSection[] }) {
  const { sheetOpen, setSheetOpen, collect } = useCommands();
  // Action shortcuts come from the same registry the palette reads, so the sheet can never drift from the screen.
  const actions = sheetOpen
    ? collect()
        .filter((c) => c.group === 'Actions' && c.shortcut)
        .map((c) => ({ keys: c.shortcut as string, what: c.label }))
    : [];
  const all = [
    ...sections,
    { title: 'In a grid', entries: GRID_SHORTCUTS },
    ...(actions.length ? [{ title: 'Actions on this screen', entries: actions }] : []),
  ];
  return (
    <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>
          Everything in Ledgerline can be done without a mouse. On a Mac, Ctrl is ⌘.
        </DialogDescription>
        <div className="grid max-h-[70vh] gap-x-8 gap-y-4 overflow-y-auto md:grid-cols-2">
          {all.map((section) => (
            <section key={section.title} aria-labelledby={headingId(section.title)}>
              <h3
                id={headingId(section.title)}
                className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {section.title}
              </h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                {section.entries.map((entry) => (
                  <div key={`${entry.keys}-${entry.what}`} className="contents">
                    <dt>
                      <kbd className="rounded-sm border bg-muted px-1.5 py-0.5 font-sans text-xs whitespace-nowrap">
                        {entry.keys}
                      </kbd>
                    </dt>
                    <dd>{entry.what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
