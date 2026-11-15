import type { AccountingPeriod, CloseType, PeriodState } from '@ledgerline/contracts';
import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import { Badge, type BadgeProps } from '../components/badge';
import { Button } from '../components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../components/dropdown-menu';
import { Label } from '../components/input';
import { cn } from '../lib/cn';
import { formatPeriod } from './format';

const STATE: Record<PeriodState, { label: string; tone: NonNullable<BadgeProps['status']> }> = {
  open: { label: 'Open', tone: 'good' },
  closing: { label: 'Closing', tone: 'warning' },
  closed: { label: 'Closed', tone: 'neutral' },
  reopened: { label: 'Reopened', tone: 'info' },
};

const CLOSE_LABELS: Record<CloseType, string> = {
  transaction: 'Transaction',
  valuation: 'Valuation',
  bankAccount: 'Bank account',
  generalLedger: 'General ledger',
};

export interface PeriodPickerProps {
  label: string;
  periods: AccountingPeriod[];
  /** Selected period id. */
  value: string | null;
  onChange: (period: AccountingPeriod) => void;
  /** Which close matters here. Close types are explicit: a period can be closed for one and open for another. */
  closeType: CloseType;
  /**
   * When set, periods that are closed or closing for `closeType` cannot be chosen, and each says who can reopen it.
   * Leave unset for read-only use (reports), where closed periods are fine to pick.
   */
  blockClosed?: { reopenBy: string };
  disabled?: boolean;
  className?: string;
}

/** Picks an accounting period and always shows its state (SPEC 7.6). */
export function PeriodPicker({
  label,
  periods,
  value,
  onChange,
  closeType,
  blockClosed,
  disabled,
  className,
}: PeriodPickerProps) {
  const id = useId();
  const selected = periods.find((p) => p.id === value);
  const stateOf = (p: AccountingPeriod) => p.closes[closeType];
  const blocked = (p: AccountingPeriod) =>
    Boolean(blockClosed) && (stateOf(p) === 'closed' || stateOf(p) === 'closing');

  return (
    <div data-slot="period-picker" className={cn('flex flex-col', className)}>
      <Label id={`${id}-label`} className="mb-1 flex items-center gap-1.5">
        {label}
        <span className="rounded-sm border bg-muted px-1 text-2xs font-normal text-muted-foreground">
          {CLOSE_LABELS[closeType]} close
        </span>
      </Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            disabled={disabled}
            aria-labelledby={`${id}-label ${id}-value`}
            className="justify-between"
          >
            <span id={`${id}-value`} className="flex items-center gap-2">
              {selected ? (
                <>
                  <span className="tabular">{formatPeriod(selected.periodEnd)}</span>
                  <Badge status={STATE[stateOf(selected)].tone}>{STATE[stateOf(selected)].label}</Badge>
                </>
              ) : (
                <span className="text-muted-foreground">Choose a period</span>
              )}
            </span>
            <ChevronDown aria-hidden className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-72">
          <DropdownMenuLabel>{CLOSE_LABELS[closeType]} periods</DropdownMenuLabel>
          {periods.map((p) => {
            const state = STATE[stateOf(p)];
            const isBlocked = blocked(p);
            return (
              <DropdownMenuItem
                key={p.id}
                // A blocked period stays focusable so its reason can be read; choosing it does nothing.
                aria-disabled={isBlocked || undefined}
                data-current={p.id === value || undefined}
                onSelect={(e) => {
                  if (isBlocked) e.preventDefault();
                  else onChange(p);
                }}
                className={cn('flex-col items-start gap-0.5 py-1', isBlocked && 'cursor-not-allowed')}
              >
                <span className="flex w-full items-center gap-2">
                  <span
                    className={cn(
                      'tabular',
                      p.id === value && 'font-semibold',
                      isBlocked && 'text-muted-foreground',
                    )}
                  >
                    {formatPeriod(p.periodEnd)}
                  </span>
                  <Badge status={state.tone}>{state.label}</Badge>
                  {p.id === value ? (
                    <span className="ml-auto text-2xs text-muted-foreground">Selected</span>
                  ) : null}
                </span>
                {isBlocked && blockClosed ? (
                  <span className="text-2xs text-muted-foreground">
                    Cannot be used: {state.label.toLowerCase()} for {CLOSE_LABELS[closeType].toLowerCase()}.{' '}
                    {blockClosed.reopenBy} can reopen it.
                  </span>
                ) : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
