import type { FinancialValue } from '@ledgerline/contracts';
import { Calculator, Lock, PencilLine } from 'lucide-react';
import { useRef, useState, type RefObject } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '../components/popover';
import { cn } from '../lib/cn';
import { formatFinancial } from './format';
import { formatTimestamp, originLabel, provenanceSummary } from './provenance';

export interface FinancialCellProps {
  value: FinancialValue;
  /** Price type (clean, dirty, % of par) or rate basis, shown beside the number. */
  qualifier?: string;
  /** Original face, shown beside the current face when the factor is not 1. */
  originalFace?: FinancialValue;
  /**
   * In a grid the cell is not a tab stop: the grid moves focus, and its provenance shortcut opens the popover.
   * Standalone (default) the value is a normal tab stop.
   */
  inGrid?: boolean;
  className?: string;
}

export function ProvenanceDetails({ value }: { value: FinancialValue }) {
  const p = value.provenance;
  const rows: [string, string][] = [['Origin', originLabel(p.origin)]];
  if (p.source) rows.push(['Source', p.source]);
  if (p.asOf) rows.push(['As of', formatTimestamp(p.asOf)]);
  if (value.basis) rows.push(['Basis', value.basis]);
  if (p.overriddenBy) rows.push(['Overridden by', p.overriddenBy.name]);
  if (p.overrideReason) rows.push(['Reason', p.overrideReason]);
  if (p.originalValue) {
    const original = formatFinancial({
      ...value,
      value: p.originalValue,
      provenance: { origin: 'calculated' },
    });
    rows.push(['Original value', `${original.text}${original.currency ? ` ${original.currency}` : ''}`]);
  }
  if (value.locked) rows.push(['Locked', value.locked.reason]);
  if (value.value !== null) rows.push(['Stored value', value.value]);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {rows.map(([term, detail]) => (
        <div key={term} className="contents">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="tabular min-w-0 break-words">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The one display cell for every financial kind (SPEC 7.5).
 * Precision comes from the registry. Calculated, overridden and locked values carry an icon and a text
 * equivalent; provenance is one hover (title) or one keystroke (popover) away.
 */
export function FinancialCell({
  value,
  qualifier,
  originalFace,
  inGrid = false,
  className,
}: FinancialCellProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const f = formatFinancial(value);
  const origin = value.provenance.origin;
  const isNull = f.display !== 'value';
  // Origin icons describe a value, so a cell with no value shows none.
  const flags = [
    origin === 'calculated' && !isNull ? 'calculated' : null,
    origin === 'overridden' && !isNull ? 'overridden' : null,
    value.locked ? 'locked' : null,
  ].filter(Boolean);
  const face = originalFace && originalFace.value !== null ? formatFinancial(originalFace) : null;

  // The accessible name is built from the content itself (visible text plus screen-reader-only words),
  // so what is spoken always contains what is shown.
  // The popover is mounted only while open. A grid shows hundreds of these cells, so the closed cost must be one button.
  return (
    <>
      <button
        type="button"
        data-slot="financial-cell"
        data-display={f.display}
        data-origin={origin}
        data-currency={f.currency}
        ref={trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        tabIndex={inGrid ? -1 : 0}
        title={f.tooltip ?? provenanceSummary(value)}
        className={cn(
          'tabular flex w-full min-w-0 items-center justify-end gap-1.5 rounded-sm text-right font-mono',
          isNull && 'text-muted-foreground',
          className,
        )}
      >
        {origin === 'calculated' && !isNull ? (
          <Calculator aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        ) : null}
        {origin === 'overridden' && !isNull ? (
          <PencilLine aria-hidden className="size-3.5 shrink-0 text-info" />
        ) : null}
        {value.locked ? <Lock aria-hidden className="size-3.5 shrink-0 text-muted-foreground" /> : null}
        {qualifier ? <span className="font-sans text-2xs text-muted-foreground">{qualifier} </span> : null}
        {isNull ? <span className="sr-only">{f.ariaLabel}</span> : null}
        {f.negative && value.signConvention === 'accounting' ? <span className="sr-only">minus </span> : null}
        <span className="truncate" aria-hidden={isNull || undefined}>
          {f.text}
        </span>{' '}
        {f.currency ? <span className="font-sans text-2xs text-muted-foreground">{f.currency} </span> : null}
        {face ? (
          <span className="font-sans text-2xs text-muted-foreground">of {face.text} orig. </span>
        ) : null}
        <span className="sr-only">{[...flags, 'show provenance'].map((w) => `, ${w}`).join('')}</span>
      </button>
      {open ? (
        <Popover open onOpenChange={setOpen}>
          <PopoverAnchor virtualRef={trigger as RefObject<HTMLButtonElement>} />
          <PopoverContent
            align="end"
            aria-label="Provenance"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              trigger.current?.focus();
            }}
          >
            <ProvenanceDetails value={value} />
          </PopoverContent>
        </Popover>
      ) : null}
    </>
  );
}
