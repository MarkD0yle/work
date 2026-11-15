import type { FinancialValue, Provenance } from '@ledgerline/contracts';

const ORIGIN_LABEL: Record<Provenance['origin'], string> = {
  calculated: 'Calculated',
  entered: 'Entered',
  overridden: 'Overridden',
  imported: 'Imported',
  vendor: 'Vendor',
};

export const originLabel = (origin: Provenance['origin']): string => ORIGIN_LABEL[origin];

/** Timestamps (not business dates) in a fixed, unambiguous form. */
export function formatTimestamp(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return m ? `${m[1]} ${m[2]} UTC` : iso;
}

/** One-line summary for hover. The popover shows the same facts in full. */
export function provenanceSummary(fv: FinancialValue): string {
  const p = fv.provenance;
  return [
    originLabel(p.origin),
    p.source ? `source ${p.source}` : null,
    p.asOf ? `as of ${formatTimestamp(p.asOf)}` : null,
    p.overriddenBy ? `by ${p.overriddenBy.name}` : null,
    p.originalValue ? `original ${p.originalValue}` : null,
    fv.locked ? `locked: ${fv.locked.reason}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
