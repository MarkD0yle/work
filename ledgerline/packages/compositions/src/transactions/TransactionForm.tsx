import type {
  BusinessDate,
  EntityRef,
  EntitySearchResult,
  FinancialKind,
  FinancialValue,
  Message,
  TransactionCreate,
  TransactionRow,
  User,
} from '@ledgerline/contracts';
import {
  BusinessDateInput,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  EntityPicker,
  FieldMessage,
  FinancialInput,
  GlossaryText,
  Label,
  MessageList,
  SectionBanner,
  Select,
  toast,
  useNotifications,
} from '@ledgerline/ui';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createTransaction, problemOf, recentEntities, rememberEntity, searchEntities } from '../services';
import { TYPE_LABELS } from './config';

/** Types that carry a quantity and a price; their amount is calculated when saved. */
const TRADED = new Set(['buy', 'sell', 'repo', 'maturity']);
const FIELDS = [
  'portfolioId',
  'securityId',
  'type',
  'tradeDate',
  'settleDate',
  'quantity',
  'price',
  'amount',
];
/** Codes the entry fields raise themselves when what was typed is not a number or a date. */
const UNREADABLE_CODES = ['LL-FIN-0001', 'LL-DATE-0001'];

const PRECISION: Partial<Record<FinancialKind, number>> = { quantity: 4, price: 6, currencyAmount: 2 };
const entered = (kind: FinancialKind, value: string | null, currency?: string): FinancialValue => ({
  kind,
  value,
  precision: PRECISION[kind] ?? 2,
  signConvention: 'natural',
  provenance: { origin: 'entered' },
  ...(currency ? { currency } : {}),
  ...(value === null ? { nullReason: 'missing' as const } : {}),
});

interface Draft {
  portfolio: EntityRef | null;
  security: EntityRef | null;
  currency: string | undefined;
  type: string;
  tradeDate: BusinessDate;
  settleDate: BusinessDate;
  quantity: string | null;
  price: string | null;
  amount: string | null;
}

const blank = (businessDate: string): Draft => ({
  portfolio: null,
  security: null,
  currency: undefined,
  type: 'buy',
  tradeDate: { value: businessDate, basis: 'trade' },
  settleDate: { value: null, basis: 'settle', businessDayRule: 'following' },
  quantity: null,
  price: null,
  amount: null,
});

/** A clone copies every field as it is. The user changes what differs; nothing is guessed for them. */
const cloneOf = (row: TransactionRow): Draft => ({
  portfolio: row.portfolio,
  security: row.security,
  currency: row.amount.currency,
  type: row.type,
  tradeDate: { ...row.tradeDate },
  settleDate: { ...row.settleDate, businessDayRule: 'following' },
  quantity: row.quantity.value,
  price: row.price.value,
  amount: TRADED.has(row.type) ? null : row.amount.value,
});

export interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  /** The engine's business date: the default trade date, and where date shortcuts count from. */
  businessDate: string;
  /** When given, the form starts as a copy of this transaction. */
  source?: TransactionRow | null;
  onSaved: (record: TransactionRow) => void;
}

/**
 * Entry form for one transaction: new, or cloned from an existing one (SPEC 7.1, 7.7).
 * Field problems show on the field, record warnings show together and must be acknowledged before saving,
 * and anything the server refuses stays on screen. The record is saved as unposted.
 */
export function TransactionForm({
  open,
  onOpenChange,
  user,
  businessDate,
  source,
  onSaved,
}: TransactionFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl"
        data-slot="transaction-form"
        onOpenAutoFocus={(event) => {
          // A clone starts on the first field that usually changes.
          const first = (event.currentTarget as HTMLElement).querySelector<HTMLElement>(
            source ? '[data-ll-target="quantity"], [data-ll-target="amount"]' : 'input',
          );
          if (first) {
            event.preventDefault();
            first.focus();
            if (first instanceof HTMLInputElement) first.select();
          }
        }}
      >
        <DialogTitle>{source ? `Clone of ${source.id}` : 'New transaction'}</DialogTitle>
        <FormBody
          key={source?.id ?? 'new'}
          user={user}
          businessDate={businessDate}
          source={source ?? null}
          onSaved={onSaved}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormBody({
  user,
  businessDate,
  source,
  onSaved,
  onClose,
}: Pick<TransactionFormProps, 'user' | 'businessDate' | 'onSaved'> & {
  source: TransactionRow | null;
  onClose: () => void;
}) {
  const ids = useId();
  const form = useRef<HTMLFormElement>(null);
  const { notify } = useNotifications();
  const [draft, setDraft] = useState<Draft>(() => (source ? cloneOf(source) : blank(businessDate)));
  /** What the server said about the last attempt. Field messages stay until that field changes. */
  const [messages, setMessages] = useState<Message[]>([]);
  const [warnings, setWarnings] = useState<Message[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const [saving, setSaving] = useState(false);
  const actor = { type: 'user' as const, id: user.id, name: user.name };
  const traded = TRADED.has(draft.type);

  /** Changes a field. Its own message goes, and any warning acknowledgement is withdrawn: the record is different now. */
  const set = (target: string, patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setMessages((prev) => prev.filter((m) => m.target !== target));
    setWarnings([]);
    setAcknowledged(false);
    setUnreadable(false);
  };
  const messageFor = (target: string) =>
    messages.find((m) => m.target === target && m.severity === 'error') ??
    warnings.find((m) => m.target === target);
  const general = messages.filter((m) => !m.target || !FIELDS.includes(m.target));

  const searchPortfolios = useCallback(
    (q: string, o: { includeInactive: boolean }) => searchEntities('portfolio', q, o),
    [],
  );
  const searchSecurities = useCallback(
    (q: string, o: { includeInactive: boolean }) => searchEntities('security', q, o),
    [],
  );
  const recentPortfolios = useCallback(() => recentEntities('portfolio'), []);
  const recentSecurities = useCallback(() => recentEntities('security'), []);
  const pick = (
    target: 'portfolioId' | 'securityId',
    value: EntityRef | null,
    result?: EntitySearchResult,
  ) => {
    if (value) void rememberEntity(value);
    if (target === 'portfolioId')
      set(target, { portfolio: value, ...(draft.security ? {} : { currency: result?.currency }) });
    else set(target, { security: value, ...(result?.currency ? { currency: result.currency } : {}) });
  };

  const save = async () => {
    // A field showing "not a number" or "not a date" still holds its last good value. Saving that would save
    // something the user cannot see, so the form stops here instead.
    const stuck = [
      ...(form.current?.querySelectorAll('[data-slot="field-message"][data-severity="error"]') ?? []),
    ].some((node) => UNREADABLE_CODES.some((code) => node.textContent?.includes(code)));
    setUnreadable(stuck);
    if (stuck) return;
    const input: TransactionCreate = {
      portfolioId: draft.portfolio?.id ?? '',
      securityId: draft.security?.id ?? null,
      type: draft.type,
      tradeDate: draft.tradeDate.value ?? '',
      settleDate: draft.settleDate.value,
      ...(traded ? { quantity: draft.quantity, price: draft.price } : { amount: draft.amount }),
      ...(acknowledged && warnings.length ? { acknowledgedWarnings: warnings.map((w) => w.code) } : {}),
      ...(source ? { cloneOf: source.id } : {}),
    };
    setSaving(true);
    try {
      const { record } = await createTransaction(input);
      toast('Saved as unposted', `Transaction ${record.id}`);
      onSaved(record);
      onClose();
    } catch (error) {
      const found = problemOf(error);
      if (found?.status === 422 && found.body.needsAcknowledgement) {
        // Warnings can be saved through, but only after the user has seen each one and said so.
        setWarnings(found.messages);
        setMessages([]);
        setAcknowledged(false);
      } else if (found?.status === 422) {
        setMessages(found.messages.filter((m) => m.severity === 'error'));
        setWarnings(found.messages.filter((m) => m.severity === 'warning'));
      } else {
        const failed = found?.messages ?? [
          {
            code: 'LL-ACT-0500',
            severity: 'error' as const,
            level: 'operation' as const,
            text: 'The transaction could not be saved.',
            fix: 'Nothing was changed. Try again.',
          },
        ];
        setMessages(failed);
        // A failed save is never only a passing message: it stays here and in the notification history.
        for (const m of failed) notify(m, 'Transactions');
      }
    } finally {
      setSaving(false);
    }
  };
  const latestSave = useRef(save);
  useEffect(() => {
    latestSave.current = save;
  });

  const errorCount = messages.filter((m) => m.severity === 'error').length;
  const needsAcknowledgement = warnings.length > 0 && errorCount === 0;

  return (
    <form
      ref={form}
      noValidate
      className="flex min-h-0 flex-col gap-3"
      // Enter inside a number or date field commits that field. Ctrl/Cmd+Enter saves the form from anywhere.
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          event.currentTarget.requestSubmit();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        // Pressing Enter in a field saves without leaving it, so the field is asked to report its value first.
        (document.activeElement as HTMLElement | null)?.blur();
        setTimeout(() => void latestSave.current(), 0);
      }}
    >
      <DialogDescription>
        {source
          ? 'Every field is copied from the original. Change what differs, then save. The original is not touched.'
          : 'Saved as unposted. It reaches the ledger only when someone posts it.'}
      </DialogDescription>

      {unreadable ? (
        <SectionBanner
          state={{
            kind: 'blockingError',
            messages: [
              {
                code: 'LL-VAL-0001',
                severity: 'error',
                level: 'record',
                text: 'A field holds something that could not be read.',
                fix: 'Fix the fields marked in red, then save.',
              },
            ],
          }}
        />
      ) : errorCount ? (
        <SectionBanner
          state={{
            kind: 'blockingError',
            messages: general.length
              ? general
              : [
                  {
                    code: 'LL-VAL-0002',
                    severity: 'error',
                    level: 'record',
                    text: `${errorCount} ${errorCount === 1 ? 'field needs' : 'fields need'} fixing before this can be saved.`,
                    fix: 'Each one is marked below.',
                  },
                ],
          }}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <EntityPicker
            label="Portfolio"
            value={draft.portfolio}
            onChange={(value, result) => pick('portfolioId', value, result)}
            search={searchPortfolios}
            recent={recentPortfolios}
            placeholder="Choose a portfolio"
            disabled={saving}
          />
          {messageFor('portfolioId') ? (
            <FieldMessage id={`${ids}-portfolio`} message={messageFor('portfolioId') as Message} />
          ) : null}
        </div>
        <div>
          <EntityPicker
            label={draft.type === 'fee' ? 'Security (optional for a fee)' : 'Security'}
            value={draft.security}
            onChange={(value, result) => pick('securityId', value, result)}
            search={searchSecurities}
            recent={recentSecurities}
            placeholder="Name, ISIN, CUSIP, SEDOL or ticker"
            disabled={saving}
          />
          {messageFor('securityId') ? (
            <FieldMessage id={`${ids}-security`} message={messageFor('securityId') as Message} />
          ) : null}
        </div>
        <div className="flex flex-col">
          <Label htmlFor={`${ids}-type`} className="mb-1">
            Type
          </Label>
          <Select
            id={`${ids}-type`}
            name="type"
            value={draft.type}
            disabled={saving}
            aria-invalid={messageFor('type')?.severity === 'error' || undefined}
            aria-describedby={messageFor('type') ? `${ids}-type-msg` : undefined}
            onChange={(e) => set('type', { type: e.target.value })}
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          {messageFor('type') ? (
            <FieldMessage id={`${ids}-type-msg`} message={messageFor('type') as Message} />
          ) : null}
        </div>
        <div />
        <BusinessDateInput
          label="Trade date"
          name="tradeDate"
          value={draft.tradeDate}
          today={businessDate}
          disabled={saving}
          {...(messageFor('tradeDate') ? { message: messageFor('tradeDate') as Message } : {})}
          onCommit={(next) => set('tradeDate', { tradeDate: next })}
        />
        <BusinessDateInput
          label="Settle date"
          name="settleDate"
          value={draft.settleDate}
          today={draft.tradeDate.value ?? businessDate}
          disabled={saving}
          {...(messageFor('settleDate') ? { message: messageFor('settleDate') as Message } : {})}
          onCommit={(next) => set('settleDate', { settleDate: next })}
        />
        {traded ? (
          <>
            <FinancialInput
              label="Quantity"
              name="quantity"
              value={entered('quantity', draft.quantity)}
              actor={actor}
              disabled={saving}
              {...(messageFor('quantity') ? { message: messageFor('quantity') as Message } : {})}
              onCommit={(next) => set('quantity', { quantity: next.value })}
            />
            <FinancialInput
              label="Price"
              name="price"
              value={entered('price', draft.price, draft.currency)}
              actor={actor}
              disabled={saving}
              {...(messageFor('price') ? { message: messageFor('price') as Message } : {})}
              onCommit={(next) => set('price', { price: next.value })}
            />
            <p className="col-span-2 text-xs text-muted-foreground">
              Amount is calculated from quantity and price when you save.
            </p>
          </>
        ) : (
          <>
            <FinancialInput
              label="Amount"
              name="amount"
              value={entered('currencyAmount', draft.amount, draft.currency)}
              actor={actor}
              disabled={saving}
              {...(messageFor('amount') ? { message: messageFor('amount') as Message } : {})}
              onCommit={(next) => set('amount', { amount: next.value })}
            />
            <p className="self-end text-xs text-muted-foreground">
              <GlossaryText
                text={`${TYPE_LABELS[draft.type] ?? draft.type} has no quantity or price, only an amount.`}
              />
            </p>
          </>
        )}
      </div>

      {needsAcknowledgement ? (
        <div
          data-slot="warning-acknowledgement"
          role="group"
          aria-label="Warnings to review"
          className="rounded-md border border-warning/40 bg-warning/10 p-3"
        >
          <p className="mb-1 font-medium">
            {warnings.length === 1
              ? 'There is a warning. It does not block saving, but check it first.'
              : `There are ${warnings.length} warnings. They do not block saving, but check them first.`}
          </p>
          <MessageList messages={warnings} />
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <span>
              I have checked {warnings.length === 1 ? 'this' : 'these'} and want to save anyway. This is
              recorded in the audit history.
            </span>
          </label>
        </div>
      ) : null}

      <DialogFooter className="items-center">
        {needsAcknowledgement && !acknowledged ? (
          <p className="mr-auto text-xs text-muted-foreground" data-slot="save-blocked-reason">
            Tick the box above to save with {warnings.length === 1 ? 'the warning' : 'warnings'}.
          </p>
        ) : null}
        <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving || (needsAcknowledgement && !acknowledged)}
          // Pressing the button must not move focus first: a field showing its message on blur would shift
          // the button from under the pointer and the click would miss. The submit handler commits the field.
          onMouseDown={(event) => event.preventDefault()}
        >
          {saving ? 'Saving…' : needsAcknowledgement ? 'Save with warnings' : 'Save as unposted'}
        </Button>
      </DialogFooter>
    </form>
  );
}
