import type { BusinessDate, Message } from '@ledgerline/contracts';
import { useId, useMemo, useState } from 'react';
import { Input, Label } from '../components/input';
import { cn } from '../lib/cn';
import { FieldMessage } from '../state/field-message';
import { adjustToBusinessDay, isBusinessDay, weekdayNameOf } from './calendar-words';
import { BASIS_LABELS, formatIsoDate, formatIsoDateLong } from './format';
import { parseDateInput } from './parse';

export interface BusinessDateInputProps {
  label: string;
  /** The date and its basis. The basis label is always shown; a date is meaningless without it. */
  value: BusinessDate;
  /** Called with a valid date. A date that fails `validate` (for example a closed period) is not committed. */
  onCommit: (next: BusinessDate) => void;
  /** The engine's business date. Shortcuts such as `t+2` count from here. */
  today: string;
  /** Holidays of `value.calendar`, as ISO dates. */
  holidays?: readonly string[];
  /** Extra rule for this field, such as "the period is closed". Return an error to block the date. */
  validate?: (iso: string) => Message | null;
  /** A message from validation outside this field (record or server). */
  message?: Message;
  /** Order for all-numeric dates. */
  order?: 'dmy' | 'mdy';
  disabled?: boolean;
  /** Field name, used as the notification jump target. */
  name?: string;
  className?: string;
}

const msg = (code: string, severity: Message['severity'], text: string, fix: string): Message => ({
  code,
  severity,
  level: 'field',
  text,
  fix,
});

/** The one entry field for business dates (SPEC 7.6). */
export function BusinessDateInput({
  label,
  value,
  onCommit,
  today,
  holidays,
  validate,
  message,
  order = 'dmy',
  disabled,
  name,
  className,
}: BusinessDateInputProps) {
  const id = useId();
  const holidaySet = useMemo(() => new Set(holidays ?? []), [holidays]);
  const shown = (iso: string | null) => (iso === null ? '' : formatIsoDate(iso));
  const [text, setText] = useState(() => shown(value.value));
  const [local, setLocal] = useState<Message | null>(null);

  // Follow the value when the parent changes it (refresh, discard). A change that is just our own commit
  // coming back keeps the text and any warning shown with it.
  const [synced, setSynced] = useState(value.value);
  const [committed, setCommitted] = useState<string | null | undefined>(undefined);
  if (value.value !== synced) {
    setSynced(value.value);
    if (value.value !== committed) {
      setText(shown(value.value));
      setLocal(null);
    }
  }

  const rule = value.businessDayRule ?? 'none';
  const message_ = local ?? message ?? null;

  function handleBlur() {
    if (disabled) return;
    const parsed = parseDateInput(text, { today, holidays: holidaySet, order });
    if (!parsed.ok) {
      setLocal(msg('LL-DATE-0001', 'error', 'This is not a date.', parsed.reason));
      return;
    }
    if (parsed.value === null) {
      setText('');
      setLocal(null);
      if (value.value !== null) {
        setCommitted(null);
        onCommit({ ...value, value: null });
      }
      return;
    }
    // A date on a weekend or holiday warns, and shows the adjusted date when the field has a rule.
    let iso = parsed.value;
    let note: Message | null = null;
    if (!isBusinessDay(iso, holidaySet)) {
      const why = `${formatIsoDate(iso)} is ${holidaySet.has(iso) ? 'a market holiday' : `a ${weekdayNameOf(iso)}`}, not a business day.`;
      const adjusted = adjustToBusinessDay(iso, rule, holidaySet);
      note =
        adjusted === iso
          ? msg('LL-DATE-0002', 'warning', why, 'Check the date, or keep it if this is intended.')
          : msg(
              'LL-DATE-0003',
              'warning',
              `${why} Moved to ${formatIsoDateLong(adjusted)}.`,
              `Rule: ${rule === 'preceding' ? 'preceding' : rule === 'modifiedFollowing' ? 'modified following' : 'following'} business day.`,
            );
      iso = adjusted;
    }
    const blocked = validate?.(iso) ?? null;
    if (blocked?.severity === 'error') {
      setText(shown(iso));
      setLocal(blocked);
      return;
    }
    setText(shown(iso));
    setLocal(blocked ?? note);
    if (iso !== value.value) {
      setCommitted(iso);
      onCommit({ ...value, value: iso });
    }
  }

  const resolved = parseDateInput(text, { today, holidays: holidaySet, order });
  const preview = resolved.ok && resolved.value ? formatIsoDateLong(resolved.value) : null;

  return (
    <div data-slot="business-date-input" className={cn('flex flex-col', className)}>
      <Label htmlFor={id} className="mb-1 flex items-center gap-1.5">
        {label}
        <span
          data-slot="date-basis"
          className="rounded-sm border bg-muted px-1 text-2xs font-normal text-muted-foreground"
        >
          {BASIS_LABELS[value.basis]} basis
        </span>
      </Label>
      <Input
        id={id}
        value={text}
        placeholder="—"
        autoComplete="off"
        disabled={disabled}
        aria-invalid={message_?.severity === 'error' || undefined}
        aria-describedby={`${id}-hint${message_ ? ` ${id}-msg` : ''}`}
        data-ll-target={name}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setText(shown(value.value));
            setLocal(null);
          }
        }}
        className="tabular"
      />
      <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
        {text.trim() === '' ? (
          <span>No date</span>
        ) : preview ? (
          <span className="tabular">
            {preview}
            {value.calendar ? ` · ${value.calendar} calendar` : ''}
          </span>
        ) : (
          <span>Shortcuts: t, t+2, -1m, eom</span>
        )}
      </p>
      {message_ ? <FieldMessage id={`${id}-msg`} message={message_} /> : null}
    </div>
  );
}
