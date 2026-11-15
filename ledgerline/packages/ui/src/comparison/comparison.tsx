import type { Comparison, ComparisonRow, FinancialValue } from '@ledgerline/contracts';
import { Decimal } from 'decimal.js';
import { useState } from 'react';
import { Badge } from '../components/badge';
import { Select } from '../components/input';
import { formatDelta } from '../financial/delta';
import { FinancialCell } from '../financial/financial-cell';
import { formatFinancial } from '../financial/format';
import { formatTimestamp } from '../financial/provenance';
import { cn } from '../lib/cn';

export type DeltaMode = 'absolute' | 'percent' | 'units';
const MODE_LABEL: Record<DeltaMode, string> = { absolute: 'Amount', percent: 'Percent', units: 'Units' };
const TONE = { within: 'neutral', near: 'warning', breach: 'critical' } as const;

/** The difference between two sides as a value of the same kind. Null when either side has no value. */
function difference(
  left: FinancialValue | undefined,
  right: FinancialValue | undefined,
): FinancialValue | null {
  if (!left || !right || left.value === null || right.value === null) return null;
  return {
    ...right,
    value: new Decimal(right.value).minus(left.value).toString(),
    provenance: { origin: 'calculated' },
  };
}
const signed = (value: FinancialValue) => {
  const f = formatFinancial(value);
  return `${!f.negative && !new Decimal(value.value ?? 0).isZero() ? '+' : ''}${f.text}${f.currency ? ` ${f.currency}` : ''}`;
};

export interface ComparisonTableProps {
  comparison: Comparison;
  /** Which delta leads. The user can change it; the other two stay visible, smaller. */
  defaultMode?: DeltaMode;
  /** Show only rows that differ. Off by default: hiding rows is the user's choice, and it is stated when on. */
  onlyDifferences?: boolean;
  className?: string;
}

function sideNote(rows: ComparisonRow[], side: 'left' | 'right'): string {
  const provenance = rows.find((r) => r[side].provenance.source ?? r[side].provenance.asOf)?.[side]
    .provenance;
  if (!provenance) return '';
  return [
    provenance.source ? `Source: ${provenance.source}` : '',
    provenance.asOf ? `updated ${formatTimestamp(provenance.asOf)}` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Two sources side by side with the difference between them (SPEC 7.9): basis vs basis, expected vs actual,
 * investment book vs accounting book. The difference shows as amount, percent and units; the user picks which leads.
 * A tolerance result is always a word (Within, Near limit, Breach), never colour alone. A missing value is never
 * shown as zero: each side keeps its own display, and the difference says there is nothing to compare.
 */
export function ComparisonTable({
  comparison,
  defaultMode = 'absolute',
  onlyDifferences = false,
  className,
}: ComparisonTableProps) {
  const [mode, setMode] = useState<DeltaMode>(defaultMode);
  const hasUnits = comparison.rows.some((r) => r.leftUnits && r.rightUnits);
  const modes: DeltaMode[] = hasUnits ? ['absolute', 'percent', 'units'] : ['absolute', 'percent'];
  const judged = comparison.rows.map((row) => {
    const delta = formatDelta(
      row.right,
      row.left,
      comparison.tolerancePct,
      comparison.leftLabel.toLowerCase(),
    );
    const absolute = difference(row.left, row.right);
    const units = difference(row.leftUnits, row.rightUnits);
    const differs =
      delta.display === 'none'
        ? row.left.value !== row.right.value
        : !new Decimal(absolute?.value ?? 0).isZero();
    return { row, delta, absolute, units, differs };
  });
  const shown = onlyDifferences ? judged.filter((j) => j.differs) : judged;
  const breaches = judged.filter((j) => j.delta.level === 'breach').length;
  const text = (j: (typeof judged)[number], which: DeltaMode) =>
    which === 'percent'
      ? j.delta.text
      : which === 'absolute'
        ? j.absolute
          ? signed(j.absolute)
          : '—'
        : j.units
          ? signed(j.units)
          : '—';

  return (
    <div data-slot="comparison" className={cn('flex min-h-0 flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <p role="status" className="mr-auto">
          <span className="font-medium">{comparison.rows.length.toLocaleString('en-US')} compared.</span>{' '}
          {breaches.toLocaleString('en-US')} outside the {comparison.tolerancePct}% tolerance.
          {onlyDifferences ? ` Showing only the ${shown.length.toLocaleString('en-US')} that differ.` : ''}
        </p>
        <label className="flex items-center gap-2 text-xs font-medium">
          Lead with
          <Select className="w-32" value={mode} onChange={(e) => setMode(e.target.value as DeltaMode)}>
            {modes.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {/* Focusable, so the table can be scrolled with the keyboard. */}
      <div
        className="min-h-0 flex-1 overflow-auto rounded-md border"
        tabIndex={0}
        role="region"
        aria-label={`${comparison.leftLabel} against ${comparison.rightLabel}`}
      >
        <table className="w-full text-body">
          <thead className="sticky top-0 z-10 bg-muted text-left text-xs">
            <tr>
              <th scope="col" className="px-2 py-1.5 font-medium">
                Item
              </th>
              {(['left', 'right'] as const).map((side) => (
                <th key={side} scope="col" className="px-2 py-1.5 text-right font-medium">
                  {side === 'left' ? comparison.leftLabel : comparison.rightLabel}
                  <span className="block font-normal text-muted-foreground">
                    {sideNote(comparison.rows, side)}
                  </span>
                </th>
              ))}
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Difference ({MODE_LABEL[mode].toLowerCase()})
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                Against tolerance
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  {comparison.rows.length === 0
                    ? 'Nothing to compare.'
                    : 'The two sides agree on every item.'}
                </td>
              </tr>
            ) : null}
            {shown.map((j) => (
              <tr key={j.row.key} data-level={j.delta.level ?? 'none'} className="border-t align-top">
                <th scope="row" className="max-w-80 px-2 py-1 text-left font-normal">
                  {j.row.label}
                </th>
                <td className="px-2 py-1">
                  <FinancialCell value={j.row.left} />
                </td>
                <td className="px-2 py-1">
                  <FinancialCell value={j.row.right} />
                </td>
                <td className="tabular px-2 py-1 text-right font-mono" data-slot="comparison-delta">
                  {j.delta.display === 'none' ? (
                    <span className="font-sans text-muted-foreground">{j.delta.ariaLabel}</span>
                  ) : (
                    <>
                      <span>{text(j, mode)}</span>
                      <span className="block text-2xs text-muted-foreground">
                        {modes
                          .filter((m) => m !== mode)
                          .map((m) => text(j, m))
                          .join(' · ')}
                      </span>
                    </>
                  )}
                </td>
                <td className="px-2 py-1">
                  {j.delta.level && j.delta.label ? (
                    <Badge status={TONE[j.delta.level]}>{j.delta.label}</Badge>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
