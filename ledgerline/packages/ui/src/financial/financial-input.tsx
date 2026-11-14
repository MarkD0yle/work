import type { ActorRef, FinancialValue, Message } from '@ledgerline/contracts';
import { Calculator, Lock, PencilLine } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '../components/button';
import { Input, Label, Textarea } from '../components/input';
import { cn } from '../lib/cn';
import { FieldMessage } from '../state/field-message';
import { formatFinancial } from './format';
import { parseFinancialInput, toEditText } from './parse';
import { CURRENCY_KINDS, DISPLAY_SCALE, registryPrecision } from './registry';

export interface FinancialInputProps {
  label: string;
  value: FinancialValue;
  /**
   * Called with the next value once it is valid. For a calculated value this only happens after the user
   * gives an override reason. The parent decides when to save; nothing commits silently.
   */
  onCommit: (next: FinancialValue) => void;
  /** Who is editing. Recorded as `overriddenBy` on an override. */
  actor: ActorRef;
  /** Price type or rate basis label, e.g. "clean" or "ACT/360". */
  qualifier?: string;
  /** A message from validation outside this field (row, record or server). */
  message?: Message;
  disabled?: boolean;
  /** Field name, used as the notification jump target. */
  name?: string;
  className?: string;
}

interface PendingOverride {
  value: string | null;
  reason: string;
  attempted: boolean;
}

const msg = (code: string, severity: Message['severity'], text: string, fix: string): Message => ({
  code,
  severity,
  level: 'field',
  text,
  fix,
});

/** The one entry field for every financial kind (SPEC 7.5). */
export function FinancialInput({
  label,
  value,
  onCommit,
  actor,
  qualifier,
  message,
  disabled,
  name,
  className,
}: FinancialInputProps) {
  const id = useId();
  const [text, setText] = useState(() => toEditText(value.value, value.kind, value.currency));
  const [local, setLocal] = useState<Message | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingOverride | null>(null);

  // Follow the value when the parent changes it (refresh, revert), unless an override is waiting for its reason.
  const incoming = toEditText(value.value, value.kind, value.currency);
  const [synced, setSynced] = useState(incoming);
  if (incoming !== synced) {
    setSynced(incoming);
    if (!pending) setText(incoming);
  }

  const origin = value.provenance.origin;
  const needsReason = origin === 'calculated' || origin === 'overridden';
  const locked = Boolean(value.locked);
  const unit = CURRENCY_KINDS.has(value.kind) ? value.currency : DISPLAY_SCALE[value.kind]?.suffix;
  const decimals = registryPrecision(value.kind, value.currency);
  const shown = local ?? message ?? null;

  function handleBlur() {
    if (locked || disabled) return;
    const result = parseFinancialInput(text, value.kind, value.currency);
    if (!result.ok) {
      setPreview(null);
      setLocal(msg('LL-FIN-0001', 'error', 'This is not a number.', result.reason));
      return;
    }
    setText(toEditText(result.value, value.kind, value.currency));
    setPreview(
      result.expanded && result.value !== null
        ? formatFinancial({ ...value, value: result.value }).text +
            (unit && CURRENCY_KINDS.has(value.kind) ? ` ${unit}` : '')
        : null,
    );
    setLocal(
      result.rounded
        ? msg(
            'LL-FIN-0002',
            'warning',
            `Rounded to ${decimals} decimal${decimals === 1 ? '' : 's'}.`,
            'Check the rounded value before saving.',
          )
        : null,
    );
    if (result.value === value.value) {
      setPending(null);
      return;
    }
    if (needsReason) {
      setPending((prev) => ({ value: result.value, reason: prev?.reason ?? '', attempted: false }));
      return;
    }
    onCommit({ ...value, value: result.value, provenance: { origin: 'entered' } });
  }

  function applyOverride() {
    if (!pending) return;
    const reason = pending.reason.trim();
    if (!reason) {
      setPending({ ...pending, attempted: true });
      return;
    }
    const { nullReason: _dropped, ...rest } = value;
    onCommit({
      ...rest,
      value: pending.value,
      provenance: {
        origin: 'overridden',
        overriddenBy: actor,
        overrideReason: reason,
        asOf: new Date().toISOString(),
        // Keep the first calculated value, however many times it is overridden.
        ...((value.provenance.originalValue ?? value.value)
          ? { originalValue: (value.provenance.originalValue ?? value.value) as string }
          : {}),
        ...(value.provenance.source ? { source: value.provenance.source } : {}),
      },
    });
    setPending(null);
  }

  function cancelOverride() {
    setPending(null);
    setPreview(null);
    setLocal(null);
    setText(toEditText(value.value, value.kind, value.currency));
  }

  const describedBy = [
    shown ? `${id}-msg` : null,
    preview ? `${id}-preview` : null,
    locked ? `${id}-lock` : null,
    `${id}-origin`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div data-slot="financial-input" className={cn('group flex flex-col', className)}>
      <Label htmlFor={id} className="mb-1 flex items-center gap-1.5">
        {label}
        {qualifier ? <span className="font-normal text-muted-foreground">({qualifier})</span> : null}
      </Label>
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-2 flex items-center gap-1">
          {origin === 'calculated' ? (
            <Calculator aria-hidden className="size-3.5 text-muted-foreground" />
          ) : null}
          {origin === 'overridden' ? <PencilLine aria-hidden className="size-3.5 text-info" /> : null}
          {locked ? <Lock aria-hidden className="size-3.5 text-muted-foreground" /> : null}
        </span>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          readOnly={locked}
          disabled={disabled}
          aria-invalid={shown?.severity === 'error' || undefined}
          aria-describedby={describedBy}
          data-ll-target={name}
          title={
            origin === 'overridden' && value.provenance.originalValue
              ? `Original value ${value.provenance.originalValue}`
              : undefined
          }
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') cancelOverride();
          }}
          className={cn('tabular text-right font-mono', unit ? 'pr-12' : '', 'pl-7')}
        />
        {unit ? (
          <span className="pointer-events-none absolute right-2 text-2xs text-muted-foreground">{unit}</span>
        ) : null}
      </div>
      <span id={`${id}-origin`} className="sr-only">
        {origin === 'calculated' ? 'Calculated value. Changing it is an override and needs a reason.' : ''}
        {origin === 'overridden'
          ? `Overridden. Original value ${value.provenance.originalValue ?? 'unknown'}.`
          : ''}
      </span>
      {locked ? (
        <p id={`${id}-lock`} className="mt-1 hidden text-xs text-muted-foreground group-focus-within:block">
          Locked: {value.locked?.reason}
        </p>
      ) : null}
      {preview ? (
        <p id={`${id}-preview`} className="tabular mt-1 text-xs text-muted-foreground">
          Will save as <span className="font-mono text-foreground">{preview}</span>
        </p>
      ) : null}
      {shown ? <FieldMessage id={`${id}-msg`} message={shown} /> : null}
      {pending ? (
        <div
          className="mt-2 flex flex-col gap-1 rounded-md border border-info/40 bg-info/10 p-2"
          role="group"
          aria-label={`Override ${label}`}
        >
          <Label htmlFor={`${id}-reason`}>Reason for override (required)</Label>
          <Textarea
            id={`${id}-reason`}
            value={pending.reason}
            aria-invalid={(pending.attempted && !pending.reason.trim()) || undefined}
            aria-describedby={`${id}-reason-help`}
            onChange={(e) => setPending({ ...pending, reason: e.target.value })}
          />
          <p
            id={`${id}-reason-help`}
            className={cn(
              'text-xs',
              pending.attempted && !pending.reason.trim() ? 'text-critical' : 'text-muted-foreground',
            )}
          >
            {pending.attempted && !pending.reason.trim()
              ? 'Enter a reason. An override cannot be saved without one.'
              : 'The original calculated value is kept and the reason is recorded in the audit history.'}
          </p>
          <div className="flex gap-2">
            <Button onClick={applyOverride}>Apply override</Button>
            <Button variant="ghost" onClick={cancelOverride}>
              Keep calculated value
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
