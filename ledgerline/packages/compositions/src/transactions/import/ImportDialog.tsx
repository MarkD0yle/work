import type { BulkResult, ImportMapping, ImportRowResult, Message } from '@ledgerline/contracts';
import {
  BatchGrid,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Label,
  parseDelimited,
  readXlsx,
  SectionBanner,
  Select,
  Textarea,
  toast,
  type BatchColumn,
  type BatchEdit,
  type BatchRow,
} from '@ledgerline/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { commitImport, fetchImportMapping, problemOf, track, validateImport } from '../../services';
import {
  detectTable,
  IMPORT_FIELDS,
  importField,
  mappingComplete,
  mappingProblem,
  toMapping,
  type DetectedTable,
} from './mapping';

/** Above this, a paste goes through the mapping step like a file does (SPEC 8.1). */
const QUICK_PASTE_ROWS = 500;
/** The most rows one import can carry until imports run as jobs (Milestone 5). */
const MAX_ROWS = 10_000;

const UNREADABLE: Message = {
  code: 'LL-IMP-0020',
  severity: 'error',
  level: 'operation',
  text: 'Those rows could not be checked.',
  fix: 'Nothing was imported. Try again; if it keeps failing, check your connection.',
};
const problem = (code: string, text: string, fix: string): Message => ({
  code,
  severity: 'error',
  level: 'section',
  text,
  fix,
});
const count = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

export interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after rows have been committed, so the caller can refresh. */
  onImported: (result: BulkResult) => void;
}

/**
 * Quick paste and file import for transactions (SPEC 8.1). A paste that matches known columns goes straight
 * to an editable grid. Files and unknown columns pass through one mapping step first. Nothing is committed
 * while any row has an error, and committing always asks first.
 */
export function ImportDialog({ open, onOpenChange, onImported }: ImportDialogProps) {
  const [guarded, setGuarded] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setGuarded(false);
        onOpenChange(next);
      }}
    >
      <DialogContent
        variant="sheet"
        className="max-w-7xl"
        aria-describedby={undefined}
        // Rows the user has pasted are not thrown away by a stray click or Escape: closing is an explicit choice.
        onInteractOutside={(e) => guarded && e.preventDefault()}
        onEscapeKeyDown={(e) => guarded && e.preventDefault()}
      >
        <DialogTitle>Paste or import transactions</DialogTitle>
        <ImportBody onGuard={setGuarded} onClose={() => onOpenChange(false)} onImported={onImported} />
      </DialogContent>
    </Dialog>
  );
}

interface Source {
  kind: 'paste' | 'file';
  /** Recorded as evidence on every audit event of the import. */
  name: string;
}

function ImportBody({
  onGuard,
  onClose,
  onImported,
}: {
  onGuard: (guarded: boolean) => void;
  onClose: () => void;
  onImported: (result: BulkResult) => void;
}) {
  const ids = useId();
  const lastMapping = useQuery({
    queryKey: ['import-mapping', 'transaction'],
    queryFn: () => fetchImportMapping('transaction'),
  });
  const [step, setStep] = useState<'input' | 'map' | 'grid'>('input');
  const [text, setText] = useState('');
  const [table, setTable] = useState<DetectedTable | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [source, setSource] = useState<Source>({ kind: 'paste', name: 'Clipboard paste' });
  const [inputProblem, setInputProblem] = useState<Message | null>(null);
  const [rows, setRows] = useState<BatchRow[]>([]);
  /** Keys of rows that correct an existing transaction (the rest create new ones). */
  const [corrections, setCorrections] = useState<ReadonlySet<string>>(new Set());
  const [failure, setFailure] = useState<Message[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [mapping, setMapping] = useState<ImportMapping>({ targetType: 'transaction', columns: [] });
  const [committing, setCommitting] = useState(false);

  const rowsRef = useRef<BatchRow[]>([]);
  const mappingRef = useRef<ImportMapping>({ targetType: 'transaction', columns: [] });
  const sequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const applyResults = (keys: string[], results: ImportRowResult[]) => {
    const byKey = new Map(keys.map((key, i) => [key, results[i]]));
    const next = rowsRef.current.map((r) => {
      const result = byKey.get(r.key);
      return result && !r.excluded ? { ...r, status: result.status, messages: result.messages } : r;
    });
    rowsRef.current = next;
    setRows(next);
    setCorrections((prev) => {
      const out = new Set(prev);
      for (const [key, result] of byKey)
        if (result?.parsed.id) out.add(key);
        else out.delete(key);
      return out;
    });
  };

  const validate = useCallback(async () => {
    const run = (sequence.current += 1);
    const included = rowsRef.current.filter((r) => !r.excluded);
    if (included.length === 0) return;
    try {
      const results = await validateImport({
        mapping: mappingRef.current,
        rows: included.map((r) => r.values),
      });
      // An edit made while this check was running starts a newer check; this one is out of date.
      if (run !== sequence.current) return;
      applyResults(
        included.map((r) => r.key),
        results,
      );
      setFailure(null);
    } catch (error) {
      if (run === sequence.current) setFailure(problemOf(error)?.messages ?? [UNREADABLE]);
    }
  }, []);

  /** Changes the rows and re-checks them shortly after, so a burst of edits is checked once. */
  const update = (next: BatchRow[]) => {
    rowsRef.current = next;
    setRows(next);
    sequence.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void validate(), 250);
  };

  const openGrid = (detected: DetectedTable, chosen: Record<string, string>) => {
    mappingRef.current = toMapping(detected.headers, chosen);
    setMapping(mappingRef.current);
    const start = detected.rows.map((values, i): BatchRow => ({
      key: `r${i + 1}`,
      values,
      status: 'pending',
      messages: [],
    }));
    rowsRef.current = start;
    setRows(start);
    setStep('grid');
    onGuard(true);
    void validate();
  };

  const load = (cells: string[][], from: Source) => {
    if (cells.length === 0) {
      setInputProblem(
        problem(
          'LL-IMP-0021',
          'There are no rows in that.',
          'Copy the rows from your spreadsheet, including a header row if you have one, and paste again.',
        ),
      );
      return;
    }
    const detected = detectTable(cells, lastMapping.data ?? null);
    if (detected.rows.length === 0) {
      setInputProblem(
        problem(
          'LL-IMP-0021',
          'There is a header row but no rows under it.',
          'Copy the rows as well as the headers, and paste again.',
        ),
      );
      return;
    }
    if (detected.rows.length > MAX_ROWS) {
      setInputProblem(
        problem(
          'LL-IMP-0022',
          `That has ${detected.rows.length.toLocaleString('en-US')} rows. One import can carry up to ${MAX_ROWS.toLocaleString('en-US')}.`,
          'Split the file and import it in parts.',
        ),
      );
      return;
    }
    setInputProblem(null);
    setTable(detected);
    setTargets(detected.targets);
    setSource(from);
    // Quick paste: known columns and a modest number of rows go straight to the grid, with no wizard steps.
    if (
      from.kind === 'paste' &&
      detected.rows.length <= QUICK_PASTE_ROWS &&
      mappingComplete(detected.headers, detected.targets)
    )
      openGrid(detected, detected.targets);
    else setStep('map');
  };

  const readFile = async (file: File) => {
    try {
      const cells = /\.xlsx$/i.test(file.name)
        ? await readXlsx(await file.arrayBuffer())
        : parseDelimited(await file.text());
      load(cells, { kind: 'file', name: file.name });
    } catch {
      setInputProblem(
        problem(
          'LL-IMP-0023',
          `${file.name} could not be read.`,
          'Use a CSV file or an Excel workbook (.xlsx). Older .xls files need saving as .xlsx first.',
        ),
      );
    }
  };

  // ── Step 1: paste or choose a file ──
  if (step === 'input') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <p className="text-muted-foreground">
          Paste rows copied from a spreadsheet, or choose a file. Rows with a Transaction id correct that
          unposted transaction; rows without one create a new transaction. Nothing is saved until you choose
          Import.
        </p>
        {inputProblem ? <SectionBanner state={{ kind: 'blockingError', messages: [inputProblem] }} /> : null}
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <Label htmlFor={`${ids}-paste`}>Paste rows here</Label>
          <Textarea
            id={`${ids}-paste`}
            data-slot="import-paste"
            className="min-h-40 flex-1 font-mono text-xs"
            placeholder={'Transaction\tQuantity\tPrice\nT-0001234\t1,250,000\t99.125'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text/plain');
              if (!pasted.trim()) return;
              e.preventDefault();
              setText(pasted);
              load(parseDelimited(pasted), { kind: 'paste', name: 'Clipboard paste' });
            }}
          />
          <p className="text-xs text-muted-foreground">
            {lastMapping.data
              ? `No header row? Columns are read in the order of your last import: ${lastMapping.data.columns.map((c) => importField(c.targetField)?.label ?? c.targetField).join(', ')}.`
              : 'Include the header row the first time, so the columns can be recognised.'}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${ids}-file`}>Or choose a CSV or Excel file</Label>
            <input
              id={`${ids}-file`}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx"
              className="text-body file:mr-2 file:h-(--ll-control-height) file:rounded-md file:border file:border-input file:bg-card file:px-(--ll-padding-x)"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
          </div>
          <DialogFooter className="ml-auto">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!text.trim()}
              onClick={() => load(parseDelimited(text), { kind: 'paste', name: 'Clipboard paste' })}
            >
              Read rows
            </Button>
          </DialogFooter>
        </div>
      </div>
    );
  }

  // ── Step 2: say what each column is ──
  if (step === 'map' && table) {
    const blocked = mappingProblem(targets);
    const ignored = table.headers.filter((h) => !targets[h]);
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <DialogDescription>
          {count(table.rows.length, 'row')} from {source.name}.{' '}
          {table.basis === 'headers'
            ? 'Columns were matched by their headers. Check them, and choose what any unmatched column is.'
            : table.basis === 'lastMapping'
              ? 'There was no header row, so columns were read in the order of your last import. Check them.'
              : 'There was no header row. Choose what each column is.'}
        </DialogDescription>
        <div className="min-h-0 flex-1 overflow-auto rounded-md border">
          <table aria-label="Column mapping" className="w-full text-body">
            <thead className="sticky top-0 bg-muted text-left text-xs">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  Column in your data
                </th>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  First row
                </th>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  Import as
                </th>
              </tr>
            </thead>
            <tbody>
              {table.headers.map((header) => (
                <tr key={header} className="border-t">
                  <th scope="row" className="px-3 py-1.5 text-left font-medium">
                    {header}
                  </th>
                  <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                    {table.rows[0]?.[header] || '(empty)'}
                  </td>
                  <td className="px-3 py-1">
                    <Select
                      aria-label={`Import ${header} as`}
                      className="w-56"
                      value={targets[header] ?? ''}
                      onChange={(e) =>
                        setTargets((prev) => {
                          // A field can come from one column only: choosing it here releases it elsewhere.
                          const next = Object.fromEntries(
                            Object.entries(prev).filter(([h, f]) => h !== header && f !== e.target.value),
                          );
                          return e.target.value ? { ...next, [header]: e.target.value } : next;
                        })
                      }
                    >
                      <option value="">Do not import</option>
                      {IMPORT_FIELDS.map((f) => (
                        <option key={f.field} value={f.field}>
                          {f.label}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter className="items-center">
          <p className="mr-auto text-muted-foreground" role="status" data-slot="mapping-status">
            {blocked ??
              (ignored.length
                ? `${count(ignored.length, 'column')} will not be imported: ${ignored.join(', ')}.`
                : 'Every column is mapped.')}
          </p>
          <Button variant="ghost" onClick={() => setStep('input')}>
            Back
          </Button>
          <Button disabled={Boolean(blocked)} onClick={() => openGrid(table, targets)}>
            Check rows
          </Button>
        </DialogFooter>
      </div>
    );
  }

  // ── Step 3: fix, exclude, import ──
  return (
    <ImportGrid
      rows={rows}
      mapping={mapping}
      source={source}
      corrections={corrections}
      failure={failure}
      confirming={confirming}
      committing={committing}
      onEdit={(edits: BatchEdit[]) => {
        const byKey = new Map<string, BatchEdit[]>();
        for (const e of edits) byKey.set(e.key, [...(byKey.get(e.key) ?? []), e]);
        update(
          rowsRef.current.map((r) => {
            const mine = byKey.get(r.key);
            return mine
              ? {
                  ...r,
                  values: { ...r.values, ...Object.fromEntries(mine.map((e) => [e.field, e.value])) },
                  status: 'pending',
                  messages: [],
                }
              : r;
          }),
        );
      }}
      onExclude={(keys, excluded) =>
        update(rowsRef.current.map((r) => (keys.includes(r.key) ? { ...r, excluded } : r)))
      }
      onRetry={() => void validate()}
      onConfirming={setConfirming}
      onClose={onClose}
      onCommit={async (acknowledgeWarnings) => {
        const included = rowsRef.current.filter((r) => !r.excluded);
        setCommitting(true);
        try {
          const result = await commitImport({
            mapping: mappingRef.current,
            rows: included.map((r) => r.values),
            fileEvidence: {
              name:
                source.kind === 'paste' ? `${source.name}, ${count(included.length, 'row')}` : source.name,
            },
            ...(acknowledgeWarnings ? { acknowledgeWarnings: true } : {}),
          });
          track('import.committed', {
            rows: result.succeeded.length,
            source: source.kind,
            warnings: acknowledgeWarnings,
          });
          toast('Imported', `${count(result.succeeded.length, 'transaction')}, all unposted`);
          onImported(result);
          onClose();
        } catch (error) {
          const found = problemOf(error);
          // The server found something the last check did not (another user changed a record): show it on the rows.
          const flagged = found?.body.rows as ImportRowResult[] | undefined;
          if (flagged?.length) {
            const keys = included.map((r) => r.key);
            applyResults(
              flagged.map((r) => keys[r.rowNumber - 1] ?? ''),
              flagged,
            );
          }
          setFailure(found?.messages ?? [UNREADABLE]);
          setConfirming(false);
        } finally {
          setCommitting(false);
        }
      }}
    />
  );
}

interface ImportGridProps {
  rows: BatchRow[];
  mapping: ImportMapping;
  source: Source;
  corrections: ReadonlySet<string>;
  failure: Message[] | null;
  confirming: boolean;
  committing: boolean;
  onEdit: (edits: BatchEdit[]) => void;
  onExclude: (keys: string[], excluded: boolean) => void;
  onRetry: () => void;
  onConfirming: (open: boolean) => void;
  onClose: () => void;
  onCommit: (acknowledgeWarnings: boolean) => Promise<void>;
}

function ImportGrid({
  rows,
  mapping,
  source,
  corrections,
  failure,
  confirming,
  committing,
  onEdit,
  onExclude,
  onRetry,
  onConfirming,
  onClose,
  onCommit,
}: ImportGridProps) {
  const columns = useMemo<BatchColumn[]>(
    () =>
      mapping.columns.map((c) => {
        const field = importField(c.targetField);
        return {
          field: c.sourceHeader,
          header: field?.label ?? c.targetField,
          messageTarget: c.targetField,
          chars: field?.chars ?? 12,
          ...(field?.numeric ? { align: 'right' as const } : {}),
        };
      }),
    [mapping],
  );
  const included = rows.filter((r) => !r.excluded);
  const errors = included.filter((r) => r.status === 'error').length;
  const warnings = included.filter((r) => r.status === 'warning').length;
  const pending = included.filter((r) => r.status === 'pending').length;
  const correcting = included.filter((r) => corrections.has(r.key)).length;
  const creating = included.length - correcting;
  // The Import button never just greys out: the reason sits beside it.
  const blocked =
    included.length === 0
      ? 'Every row is excluded, so there is nothing to import.'
      : failure && pending
        ? 'The rows could not be checked.'
        : pending
          ? 'Checking rows…'
          : errors
            ? `Fix or exclude the ${count(errors, 'row')} with errors first. No row is imported while any row has an error.`
            : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <DialogDescription>
        From {source.name}. Fix a cell by typing in it, or untick Include to leave a row out.
      </DialogDescription>
      {failure ? (
        <div className="flex items-start gap-2">
          <SectionBanner className="flex-1" state={{ kind: 'blockingError', messages: failure }} />
          {pending ? (
            <Button variant="secondary" onClick={onRetry}>
              Check again
            </Button>
          ) : null}
        </div>
      ) : null}
      <BatchGrid
        className="flex-1"
        label="Rows to import"
        columns={columns}
        rows={rows}
        onEdit={onEdit}
        onExclude={onExclude}
      />
      <DialogFooter className="items-center">
        <p className="mr-auto" role="status" data-slot="import-status">
          {blocked ??
            `Ready: ${count(correcting, 'correction')} to existing transactions, ${creating.toLocaleString('en-US')} new.`}
        </p>
        <Button variant="ghost" onClick={onClose}>
          Discard and close
        </Button>
        <Button disabled={Boolean(blocked)} onClick={() => onConfirming(true)}>
          Import {count(included.length, 'row')}…
        </Button>
      </DialogFooter>

      <Dialog open={confirming} onOpenChange={(next) => !committing && onConfirming(next)}>
        <DialogContent data-slot="import-confirm">
          <DialogTitle>Import {count(included.length, 'row')}?</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-2">
              <p>
                {correcting ? `${count(correcting, 'row')} will change existing unposted transactions. ` : ''}
                {creating ? `${count(creating, 'row')} will create new unposted transactions. ` : ''}
                Nothing is posted to the ledger.
              </p>
              {warnings ? (
                <p className="font-medium text-foreground">
                  {count(warnings, 'row')} {warnings === 1 ? 'has a warning' : 'have warnings'}. Importing
                  keeps {warnings === 1 ? 'it' : 'them'} as entered, and records that you chose to.
                </p>
              ) : null}
              <p>Every row is recorded in the audit history as imported, with “{source.name}” as evidence.</p>
              {rows.length > included.length ? (
                <p>{count(rows.length - included.length, 'excluded row')} will be left out.</p>
              ) : null}
            </div>
          </DialogDescription>
          <DialogFooter>
            <Button variant="ghost" disabled={committing} onClick={() => onConfirming(false)}>
              Cancel
            </Button>
            <Button disabled={committing} onClick={() => void onCommit(warnings > 0)}>
              {committing ? 'Importing…' : warnings ? `Import with ${count(warnings, 'warning')}` : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
