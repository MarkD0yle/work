import type { Message } from '@ledgerline/contracts';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import { Button } from '../components/button';
import { cn } from '../lib/cn';
import { MessageText } from '../state/message-list';
import { ToneIcon } from '../state/tone';
import { parseDelimited } from './tabular';

export interface BatchColumn {
  /** Key of this column in a row's values. */
  field: string;
  header: string;
  align?: 'left' | 'right';
  /** The message target that belongs to this column, when it differs from `field`. */
  messageTarget?: string;
  /** Width in characters. */
  chars?: number;
}

export interface BatchRow {
  key: string;
  values: Record<string, string>;
  /** `pending` while the row is waiting to be validated. */
  status: 'valid' | 'warning' | 'error' | 'pending';
  messages: Message[];
  /** Excluded rows stay visible but are not committed. */
  excluded?: boolean;
}

export interface BatchEdit {
  key: string;
  field: string;
  value: string;
}

export interface BatchGridProps {
  /** Names the grid, e.g. "Rows to import". */
  label: string;
  columns: BatchColumn[];
  rows: BatchRow[];
  onEdit: (edits: BatchEdit[]) => void;
  onExclude: (keys: string[], excluded: boolean) => void;
  /** Rows pasted below the last row. Without this, a paste that runs past the end is cut off and the user is told. */
  onAppend?: (rows: Record<string, string>[]) => void;
  pageSize?: number;
  className?: string;
}

type Filter = 'all' | 'error' | 'warning';
const STATUS = {
  valid: { label: 'Valid', tone: 'good' },
  warning: { label: 'Warning', tone: 'warning' },
  error: { label: 'Error', tone: 'critical' },
  pending: { label: 'Checking', tone: 'neutral' },
} as const;

const count = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

interface CellProps {
  rowKey: string;
  rowIndex: number;
  column: BatchColumn;
  value: string;
  message: Message | undefined;
  describedBy: string | undefined;
  disabled: boolean;
  selected: boolean;
  label: string;
  onCommit: (key: string, field: string, value: string) => void;
}

/** One editable cell. It keeps what is being typed to itself and reports the value when the user leaves the cell. */
const Cell = memo(function Cell({
  rowKey,
  rowIndex,
  column,
  value,
  message,
  describedBy,
  disabled,
  selected,
  label,
  onCommit,
}: CellProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      data-row={rowIndex}
      data-field={column.field}
      data-selected={selected || undefined}
      aria-label={label}
      aria-invalid={message?.severity === 'error' || undefined}
      aria-describedby={message ? describedBy : undefined}
      title={message ? `${message.text} ${message.fix ?? ''}`.trim() : undefined}
      disabled={disabled}
      value={draft ?? value}
      size={column.chars ?? 12}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft.trim() !== value) onCommit(rowKey, column.field, draft.trim());
        setDraft(null);
      }}
      className={cn(
        'h-(--ll-control-height) w-full min-w-0 border border-transparent bg-transparent px-(--ll-padding-x) text-body',
        'hover:border-input focus:border-ring disabled:text-muted-foreground disabled:line-through',
        column.align === 'right' && 'tabular text-right font-mono',
        message?.severity === 'error' && 'border-critical bg-critical/5',
        message?.severity === 'warning' && 'border-warning bg-warning/5',
        selected && 'bg-accent',
      )}
    />
  );
});

/**
 * An editable grid for a batch of rows on their way in: pasted rows, an uploaded file, corrections (SPEC 7.1, 8.1).
 * Every cell can be fixed in place, rows can be excluded, and each row says whether it is valid and why not.
 * Keyboard: Up, Down and Enter move between rows; Shift+Up/Down selects a run of cells in a column;
 * Ctrl/Cmd+D fills down; a paste of several cells lands as a block.
 */
export function BatchGrid({
  label,
  columns,
  rows,
  onEdit,
  onExclude,
  onAppend,
  pageSize = 50,
  className,
}: BatchGridProps) {
  const table = useRef<HTMLTableElement>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [range, setRange] = useState<{ field: string; anchor: number; focus: number } | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const counts = useMemo(() => {
    const c = { valid: 0, warning: 0, error: 0, pending: 0, excluded: 0 };
    for (const r of rows) {
      if (r.excluded) c.excluded += 1;
      else c[r.status] += 1;
    }
    return c;
  }, [rows]);
  // A row being re-checked stays in view under any filter, so it does not vanish while the user is fixing it.
  const filtered = useMemo(
    () =>
      filter === 'all'
        ? rows
        : rows.filter((r) => !r.excluded && (r.status === filter || r.status === 'pending')),
    [rows, filter],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, (current + 1) * pageSize);
  const numberOf = useMemo(() => new Map(rows.map((r, i) => [r.key, i + 1])), [rows]);

  // Cells are memoised, so they get one stable callback that always reaches the latest `onEdit`.
  const commit = useRef(onEdit);
  useEffect(() => {
    commit.current = onEdit;
  }, [onEdit]);
  const commitOne = useCallback(
    (key: string, field: string, value: string) => commit.current([{ key, field, value }]),
    [],
  );

  const focusCell = (rowIndex: number, field: string) =>
    table.current
      ?.querySelector<HTMLInputElement>(`input[data-row="${rowIndex}"][data-field="${CSS.escape(field)}"]`)
      ?.focus();

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.dataset.row === undefined || !input.dataset.field)
      return;
    const rowIndex = parseInt(input.dataset.row, 10);
    const field = input.dataset.field;
    const move = event.key === 'ArrowDown' || event.key === 'Enter' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (move) {
      const next = rowIndex + move;
      if (next < 0 || next >= visible.length) return;
      event.preventDefault();
      if (event.shiftKey && event.key !== 'Enter') {
        setRange((prev) => ({ field, anchor: prev?.field === field ? prev.anchor : rowIndex, focus: next }));
      } else setRange(null);
      focusCell(next, field);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      // Fill-down: with a run of cells selected, the top value fills the rest; otherwise the value above fills this cell.
      const [top, bottom] =
        range && range.field === field
          ? [Math.min(range.anchor, range.focus), Math.max(range.anchor, range.focus)]
          : [rowIndex - 1, rowIndex];
      const source = visible[top];
      if (!source || top === bottom) {
        setAnnouncement('Nothing to fill down from: this is the first row.');
        return;
      }
      // The cell being typed in may not have reported its value yet.
      const value = top === rowIndex ? input.value.trim() : (source.values[field] ?? '');
      const edits = visible
        .slice(top + 1, bottom + 1)
        .filter((r) => !r.excluded && (r.values[field] ?? '') !== value)
        .map((r) => ({ key: r.key, field, value }));
      input.blur();
      if (edits.length) onEdit(edits);
      setAnnouncement(`Filled down ${count(bottom - top, 'cell')} with ${value || 'an empty value'}.`);
      setTimeout(() => focusCell(rowIndex, field), 0);
      return;
    }
    if (event.key === 'Escape' && range) setRange(null);
  };

  const onPaste = (event: ClipboardEvent<HTMLTableElement>) => {
    const input = event.target;
    const text = event.clipboardData.getData('text/plain');
    if (
      !(input instanceof HTMLInputElement) ||
      input.dataset.row === undefined ||
      !/[\t\n]/.test(text.trim())
    )
      return;
    event.preventDefault();
    const block = parseDelimited(text);
    const startRow = parseInt(input.dataset.row, 10);
    const startColumn = columns.findIndex((c) => c.field === input.dataset.field);
    const edits: BatchEdit[] = [];
    const extra: Record<string, string>[] = [];
    block.forEach((cells, r) => {
      const target = visible[startRow + r];
      const landed: Record<string, string> = {};
      cells.forEach((value, c) => {
        const column = columns[startColumn + c];
        if (!column) return;
        landed[column.field] = value;
        if (target && !target.excluded && (target.values[column.field] ?? '') !== value)
          edits.push({ key: target.key, field: column.field, value });
      });
      if (!target) extra.push(landed);
    });
    input.blur();
    if (edits.length) onEdit(edits);
    if (extra.length && onAppend) onAppend(extra);
    setAnnouncement(
      extra.length && !onAppend
        ? `Pasted ${count(block.length - extra.length, 'row')}. ${count(extra.length, 'row')} did not fit and ${extra.length === 1 ? 'was' : 'were'} left out.`
        : `Pasted ${count(block.length, 'row')}.`,
    );
  };

  const inRange = (rowIndex: number, field: string) =>
    range !== null &&
    range.field === field &&
    rowIndex >= Math.min(range.anchor, range.focus) &&
    rowIndex <= Math.max(range.anchor, range.focus);

  const filterButton = (value: Filter, text: string) => (
    <Button
      key={value}
      variant={filter === value ? 'secondary' : 'ghost'}
      aria-pressed={filter === value}
      onClick={() => {
        setFilter(value);
        setPage(0);
        setRange(null);
      }}
    >
      {text}
    </Button>
  );

  return (
    <div data-slot="batch-grid" className={cn('flex min-h-0 flex-col gap-2', className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <p role="status" data-slot="batch-summary" className="mr-auto">
          <span className="font-medium">{count(rows.length, 'row')}:</span>{' '}
          {counts.valid.toLocaleString('en-US')} valid, {count(counts.warning, 'warning')},{' '}
          {count(counts.error, 'error')}
          {counts.excluded ? `, ${counts.excluded.toLocaleString('en-US')} excluded` : ''}
          {counts.pending ? `, ${counts.pending.toLocaleString('en-US')} being checked` : ''}
        </p>
        <div role="group" aria-label="Show rows" className="flex gap-1">
          {filterButton('all', 'All rows')}
          {filterButton('error', `Errors (${counts.error})`)}
          {filterButton('warning', `Warnings (${counts.warning})`)}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        {/* The grid handles keys and paste for the inputs inside it. */}
        <table
          ref={table}
          aria-label={label}
          className="w-full border-collapse text-body"
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        >
          <thead className="sticky top-0 z-10 bg-muted text-left text-xs">
            <tr>
              <th scope="col" className="px-2 py-1.5 font-medium">
                Row
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                Include
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                Result
              </th>
              {columns.map((c) => (
                <th
                  key={c.field}
                  scope="col"
                  className={cn('px-2 py-1.5 font-medium', c.align === 'right' && 'text-right')}
                >
                  {c.header}
                </th>
              ))}
              <th scope="col" className="px-2 py-1.5 font-medium">
                What to fix
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 4} className="p-6 text-center text-muted-foreground">
                  {rows.length === 0
                    ? 'No rows yet.'
                    : `No rows with ${filter === 'error' ? 'errors' : 'warnings'}. Choose All rows to see everything.`}
                </td>
              </tr>
            ) : null}
            {visible.map((row, rowIndex) => {
              const number = numberOf.get(row.key) ?? 0;
              const status = STATUS[row.status];
              const messagesId = `batch-msg-${row.key}`;
              return (
                <tr
                  key={row.key}
                  data-row-key={row.key}
                  data-status={row.excluded ? 'excluded' : row.status}
                  className="border-t align-top"
                >
                  <th
                    scope="row"
                    className="tabular px-2 py-1.5 text-right font-mono text-xs font-normal text-muted-foreground"
                  >
                    {number}
                  </th>
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      aria-label={`Include row ${number}`}
                      checked={!row.excluded}
                      onChange={(e) => onExclude([row.key], !e.target.checked)}
                    />
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {row.excluded ? (
                      <span className="text-muted-foreground">Excluded</span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <ToneIcon tone={status.tone} busy={row.status === 'pending'} />
                        {status.label}
                      </span>
                    )}
                  </td>
                  {columns.map((column) => {
                    const target = column.messageTarget ?? column.field;
                    const message = row.excluded
                      ? undefined
                      : (row.messages.find((m) => m.target === target && m.severity === 'error') ??
                        row.messages.find((m) => m.target === target));
                    return (
                      <td key={column.field} className="p-0.5">
                        <Cell
                          rowKey={row.key}
                          rowIndex={rowIndex}
                          column={column}
                          value={row.values[column.field] ?? ''}
                          message={message}
                          describedBy={messagesId}
                          disabled={Boolean(row.excluded)}
                          selected={inRange(rowIndex, column.field)}
                          label={`${column.header}, row ${number}`}
                          onCommit={commitOne}
                        />
                      </td>
                    );
                  })}
                  <td id={messagesId} className="min-w-64 px-2 py-1.5 text-xs">
                    {row.excluded
                      ? null
                      : row.messages.map((m, i) => (
                          <p key={`${m.code}-${i}`} data-severity={m.severity}>
                            <MessageText message={m} />
                          </p>
                        ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <span>Ctrl+D fills down. Shift+Up or Down selects cells in a column. Paste lands as a block.</span>
        {pages > 1 ? (
          <span className="ml-auto flex items-center gap-2">
            <Button variant="ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>
              Previous
            </Button>
            <span role="status">
              Page {current + 1} of {pages}
            </span>
            <Button variant="ghost" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              Next
            </Button>
          </span>
        ) : null}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
