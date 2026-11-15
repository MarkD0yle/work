/**
 * Validation rules for a transaction, shared by create, import and import-commit, so a record is judged the
 * same way however it arrives. Errors block; warnings can be acknowledged and saved through (SPEC 7.7).
 * Every message says what happened and what to do next, and names the field it is about.
 */
import type { Message, User } from '@ledgerline/contracts';
import { Decimal } from 'decimal.js';
import type { Db } from '../db/client';
import { addBusinessDays, endOfMonth } from './dates';

export const TRANSACTION_TYPES = [
  'buy',
  'sell',
  'income',
  'corporateAction',
  'repo',
  'margin',
  'maturity',
  'fee',
] as const;
/** Types that carry a quantity and a price; their amount is calculated. */
export const TRADED_TYPES: ReadonlySet<string> = new Set(['buy', 'sell', 'repo', 'maturity']);
const PAR_PRICED = new Set(['govt', 'corporate', 'muni', 'mbs', 'tba']);
const MINOR_UNITS: Record<string, number> = { JPY: 0 };
export const minorUnits = (currency: string) => MINOR_UNITS[currency] ?? 2;

export interface TransactionDraft {
  portfolioId: string;
  securityId: string | null;
  type: string;
  tradeDate: string;
  settleDate: string | null;
  quantity: string | null;
  price: string | null;
  amount: string | null;
}

export interface CheckedTransaction {
  messages: Message[];
  /** Canonical values to store. Present only when there are no errors. */
  record?: {
    currency: string;
    quantity: string | null;
    price: string | null;
    amount: string;
    settleDate: string | null;
  };
}

const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const isDecimal = (v: string) => /^-?\d+(\.\d+)?$/.test(v);

export function createTransactionRules(db: Db, today: string) {
  const sqlite = db.$client;
  const portfolio = sqlite.prepare(
    'SELECT id, name, base_currency, calendar, status FROM portfolios WHERE id = ?',
  );
  const security = sqlite.prepare(
    'SELECT id, description, asset_class, currency, market, status FROM securities WHERE id = ?',
  );
  const period = sqlite.prepare(
    'SELECT period_end, closes FROM periods WHERE portfolio_id = ? AND period_end = ?',
  );
  const holidays = sqlite.prepare('SELECT date FROM market_holidays WHERE market = ?');
  const vendorPrice = sqlite.prepare(
    'SELECT price FROM prices WHERE security_id = ? AND price_date <= ? AND price IS NOT NULL ORDER BY price_date DESC LIMIT 1',
  );
  const position = sqlite.prepare(
    'SELECT quantity FROM positions WHERE portfolio_id = ? AND security_id = ?',
  );
  const reopeners = () =>
    (
      sqlite
        .prepare(
          "SELECT DISTINCT u.role, u.team FROM permissions p JOIN users u ON u.id = p.user_id WHERE p.action = 'period.reopen' AND p.allowed = 1",
        )
        .all() as { role: string; team: string }[]
    )
      .map((r) => `a ${r.role.toLowerCase()} in ${r.team}`)
      .join(' or ') || 'a controller';
  const holidayCache = new Map<string, Set<string>>();
  const holidaysFor = (market: string) => {
    let set = holidayCache.get(market);
    if (!set) {
      set = new Set((holidays.all(market) as { date: string }[]).map((h) => h.date));
      holidayCache.set(market, set);
    }
    return set;
  };

  return function check(draft: TransactionDraft, user: User): CheckedTransaction {
    const messages: Message[] = [];
    const error = (code: string, target: string, text: string, fix: string) =>
      messages.push({ code, severity: 'error', level: 'field', text, fix, target });
    const warn = (code: string, target: string, text: string, fix: string) =>
      messages.push({ code, severity: 'warning', level: 'record', text, fix, target });

    // ── Portfolio ──
    const p = draft.portfolioId
      ? (portfolio.get(draft.portfolioId) as
          { id: string; name: string; base_currency: string; calendar: string; status: string } | undefined)
      : undefined;
    if (!draft.portfolioId)
      error('LL-VAL-0031', 'portfolioId', 'Portfolio is required.', 'Choose a portfolio.');
    else if (!p)
      error(
        'LL-VAL-0032',
        'portfolioId',
        `There is no portfolio ${draft.portfolioId}.`,
        'Check the portfolio id.',
      );
    else if (user.blotterScope && !user.blotterScope.includes(p.id))
      error(
        'LL-VAL-0033',
        'portfolioId',
        `${p.name} is outside your account scope.`,
        'Choose one of your own portfolios.',
      );
    else if (p.status !== 'active')
      error('LL-VAL-0034', 'portfolioId', `${p.name} is inactive.`, 'Choose an active portfolio.');

    // ── Type ──
    const typeOk = (TRANSACTION_TYPES as readonly string[]).includes(draft.type);
    if (!draft.type)
      error('LL-VAL-0041', 'type', 'Type is required.', `Choose one of: ${TRANSACTION_TYPES.join(', ')}.`);
    else if (!typeOk)
      error(
        'LL-VAL-0042',
        'type',
        `"${draft.type}" is not a transaction type.`,
        `Use one of: ${TRANSACTION_TYPES.join(', ')}.`,
      );
    const traded = TRADED_TYPES.has(draft.type);

    // ── Security ──
    const s = draft.securityId
      ? (security.get(draft.securityId) as
          | {
              id: string;
              description: string;
              asset_class: string;
              currency: string;
              market: string;
              status: string;
            }
          | undefined)
      : undefined;
    if (draft.securityId && !s)
      error(
        'LL-VAL-0052',
        'securityId',
        `There is no security ${draft.securityId}.`,
        'Check the identifier.',
      );
    else if (s && s.status !== 'active')
      error('LL-VAL-0053', 'securityId', `${s.description} is inactive.`, 'Choose an active security.');
    else if (!draft.securityId && typeOk && draft.type !== 'fee')
      error(
        'LL-VAL-0051',
        'securityId',
        'Security is required for this type.',
        'Choose a security. Only fees have none.',
      );

    // ── Dates ──
    let tradeOk = false;
    if (!draft.tradeDate)
      error('LL-VAL-0061', 'tradeDate', 'Trade date is required.', 'Enter the trade date.');
    else if (!isIsoDate(draft.tradeDate))
      error(
        'LL-VAL-0062',
        'tradeDate',
        `"${draft.tradeDate}" is not a date.`,
        'Use a date such as 2026-11-13.',
      );
    else tradeOk = true;
    let settleOk = draft.settleDate === null;
    if (draft.settleDate !== null) {
      if (!isIsoDate(draft.settleDate))
        error(
          'LL-VAL-0063',
          'settleDate',
          `"${draft.settleDate}" is not a date.`,
          'Use a date such as 2026-11-17.',
        );
      else settleOk = true;
    }
    if (tradeOk && p) {
      // Business rule 1: nothing enters a closed period; the message names the period and who can reopen it.
      const row = period.get(p.id, endOfMonth(draft.tradeDate)) as
        { period_end: string; closes: string } | undefined;
      const state = row ? (JSON.parse(row.closes) as Record<string, string>).transaction : undefined;
      if (row && (state === 'closed' || state === 'closing')) {
        error(
          'LL-PER-0001',
          'tradeDate',
          `Trade date ${draft.tradeDate} is in the period ending ${row.period_end}, which is ${state} for transactions in ${p.name}.`,
          `Use a date in an open period, or ask ${reopeners()} to reopen the period.`,
        );
      } else if (draft.tradeDate > today) {
        warn(
          'LL-VAL-0150',
          'tradeDate',
          `Trade date ${draft.tradeDate} is in the future.`,
          'Check the date, or acknowledge to keep it.',
        );
      }
    }
    if (tradeOk && settleOk && draft.settleDate !== null) {
      if (draft.settleDate < draft.tradeDate)
        error(
          'LL-VAL-0118',
          'settleDate',
          'Settlement date is before trade date.',
          `Choose a settlement date on or after ${draft.tradeDate}.`,
        );
      else if (
        draft.settleDate > addBusinessDays(draft.tradeDate, 3, holidaysFor(s?.market ?? p?.calendar ?? ''))
      ) {
        warn(
          'LL-VAL-0142',
          'settleDate',
          'Settlement date is later than usual for this security type.',
          'Check the settlement date, or acknowledge to keep it.',
        );
      }
    }

    // ── Amounts ──
    const decimal = (
      field: 'quantity' | 'price' | 'amount',
      label: string,
      required: boolean,
    ): Decimal | null => {
      const value = draft[field];
      if (value === null || value === '') {
        if (required)
          error(
            'LL-VAL-0071',
            field,
            `${label} is required for this type.`,
            `Enter the ${label.toLowerCase()}.`,
          );
        return null;
      }
      if (!isDecimal(value)) {
        error(
          'LL-VAL-0072',
          field,
          `${label} "${value}" is not a number.`,
          'Enter a number such as 1250000.00.',
        );
        return null;
      }
      const d = new Decimal(value);
      if (d.lte(0)) {
        error(
          'LL-VAL-0073',
          field,
          `${label} must be more than zero.`,
          'Enter a positive number. The type says whether it is a buy or a sell.',
        );
        return null;
      }
      return d;
    };
    const quantity = traded ? decimal('quantity', 'Quantity', true) : null;
    const price = traded ? decimal('price', 'Price', true) : null;
    const amount = traded ? null : decimal('amount', 'Amount', typeOk);
    if (!traded && typeOk && (draft.quantity || draft.price)) {
      warn(
        'LL-VAL-0080',
        draft.quantity ? 'quantity' : 'price',
        'Quantity and price are not used for this type.',
        'They will be ignored. Acknowledge to continue, or clear them.',
      );
    }

    if (traded && s && price && tradeOk) {
      const vendor = (vendorPrice.get(s.id, draft.tradeDate) as { price: string } | undefined)?.price;
      if (vendor && price.minus(vendor).abs().div(vendor).gt(0.05)) {
        warn(
          'LL-VAL-0207',
          'price',
          `Price ${price.toFixed(6)} differs from the latest vendor price ${new Decimal(vendor).toFixed(6)} by more than 5%.`,
          'Check the price against the trade ticket, or acknowledge to keep it.',
        );
      }
    }
    if (draft.type === 'sell' && s && p && quantity) {
      const held = (position.get(p.id, s.id) as { quantity: string } | undefined)?.quantity ?? '0';
      if (quantity.gt(held))
        warn(
          'LL-VAL-0311',
          'quantity',
          `Quantity ${quantity.toFixed(4)} is larger than the current position of ${new Decimal(held).toFixed(4)}.`,
          'Confirm this is not a duplicate entry, or acknowledge to keep it.',
        );
    }

    if (messages.some((m) => m.severity === 'error') || !p) return { messages };
    const currency = s?.currency ?? p.base_currency;
    const dp = minorUnits(currency);
    const par = Boolean(s && PAR_PRICED.has(s.asset_class));
    return {
      messages,
      record: {
        currency,
        quantity: quantity ? quantity.toFixed(4) : null,
        price: price ? price.toFixed(6) : null,
        amount:
          quantity && price
            ? quantity
                .mul(price)
                .div(par ? 100 : 1)
                .toFixed(dp)
            : (amount as Decimal).toFixed(dp),
        settleDate: draft.settleDate,
      },
    };
  };
}
