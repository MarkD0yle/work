/**
 * Deterministic seed for the mock accounting engine.
 * Same scale in, same data out: a fixed faker seed and a fixed "today".
 * Nothing here reads the clock or the network.
 */
import { en, Faker } from '@faker-js/faker';
import type {
  ActorRef,
  CloseType,
  ExceptionStatus,
  ExceptionType,
  FinancialValue,
  PeriodState,
} from '@ledgerline/contracts';
import { Decimal } from 'decimal.js';
import { getTableColumns, getTableName, type InferInsertModel } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { createHash } from 'node:crypto';
import { addBusinessDays, addDays, isWeekend, shiftMonthEnd } from '../lib/dates';
import type { Db } from './client';
import { cusip, isin, sedol } from './identifiers';
import * as t from './schema';
import { ACTIONS, grantsFor, SEED_USERS } from './users';

export const SEED_TODAY = '2026-11-14';
export const SEED_NOW = '2026-11-14T16:00:00Z';
const FAKER_SEED = 20261114;

export type SeedScale = 'small' | 'full';

interface Volumes {
  securities: number;
  held: number;
  transactions: number;
  priceDays: number;
  cash: number;
  /** Count of each sampled (non-derived) exception type. */
  sampledExceptions: number;
}

export const VOLUMES: Record<SeedScale, Volumes> = {
  small: {
    securities: 5_000,
    held: 1_000,
    transactions: 5_000,
    priceDays: 30,
    cash: 2_000,
    sampledExceptions: 6,
  },
  full: {
    securities: 1_000_000,
    held: 20_000,
    transactions: 250_000,
    priceDays: 30,
    cash: 50_000,
    sampledExceptions: 40,
  },
};

const PORTFOLIO_COUNT = 60;
const MARKET_BY_CCY: Record<string, string> = { USD: 'US', EUR: 'EU', GBP: 'UK', JPY: 'JP' };
const COUNTRY_BY_CCY: Record<string, string> = { USD: 'US', EUR: 'DE', GBP: 'GB', JPY: 'JP' };
const MINOR_UNITS: Record<string, number> = { USD: 2, EUR: 2, GBP: 2, JPY: 0 };

const HOLIDAYS: [market: string, date: string, name: string][] = [
  ['US', '2026-01-01', "New Year's Day"],
  ['US', '2026-01-19', 'Martin Luther King Jr. Day'],
  ['US', '2026-05-25', 'Memorial Day'],
  ['US', '2026-07-03', 'Independence Day (observed)'],
  ['US', '2026-09-07', 'Labor Day'],
  ['US', '2026-10-12', 'Columbus Day'],
  ['US', '2026-11-11', 'Veterans Day'],
  ['US', '2026-11-26', 'Thanksgiving Day'],
  ['US', '2026-12-25', 'Christmas Day'],
  ['UK', '2026-01-01', "New Year's Day"],
  ['UK', '2026-04-03', 'Good Friday'],
  ['UK', '2026-04-06', 'Easter Monday'],
  ['UK', '2026-08-31', 'Summer bank holiday'],
  ['UK', '2026-12-25', 'Christmas Day'],
  ['UK', '2026-12-28', 'Boxing Day (substitute)'],
  ['EU', '2026-01-01', "New Year's Day"],
  ['EU', '2026-04-03', 'Good Friday'],
  ['EU', '2026-04-06', 'Easter Monday'],
  ['EU', '2026-05-01', 'Labour Day'],
  ['EU', '2026-12-25', 'Christmas Day'],
  ['JP', '2026-01-01', "New Year's Day"],
  ['JP', '2026-09-21', 'Respect for the Aged Day'],
  ['JP', '2026-10-12', 'Sports Day'],
  ['JP', '2026-11-03', 'Culture Day'],
  ['JP', '2026-11-23', 'Labour Thanksgiving Day'],
];

const SYSTEM: ActorRef = { type: 'system', id: 'close-checks', name: 'Close checks' };
const actor = (id: string): ActorRef => {
  const user = SEED_USERS.find((u) => u.id === id);
  if (!user) throw new Error(`Unknown seed user ${id}`);
  return { type: 'user', id: user.id, name: user.name };
};

const pad = (n: number, width: number) => String(n).padStart(width, '0');
const portfolioId = (i: number) => `P-${pad(i + 1, 4)}`;
const securityId = (i: number) => `S-${pad(i + 1, 7)}`;

/** Prepared-statement insert built from the Drizzle table, so column mapping stays typed. */
function inserter<T extends SQLiteTable>(db: Db, table: T): (row: InferInsertModel<T>) => void {
  const cols = Object.entries(getTableColumns(table));
  const stmt = db.$client.prepare(
    `insert into "${getTableName(table)}" (${cols.map(([, c]) => `"${c.name}"`).join(', ')}) values (${cols.map(() => '?').join(', ')})`,
  );
  return (row) => {
    const record = row as Record<string, unknown>;
    stmt.run(
      cols.map(([key, col]) => {
        const value = record[key];
        return value === undefined || value === null ? null : col.mapToDriverValue(value);
      }),
    );
  };
}

type Weighted<T> = readonly (readonly [T, number])[];

function makeRandom(faker: Faker) {
  const int = (min: number, max: number) => faker.number.int({ min, max });
  const chance = (p: number) => faker.number.float() < p;
  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)] as T;
  const weighted = <T>(items: Weighted<T>): T => {
    const total = items.reduce((sum, [, w]) => sum + w, 0);
    let roll = faker.number.float() * total;
    for (const [value, weight] of items) {
      roll -= weight;
      if (roll < 0) return value;
    }
    return (items[items.length - 1] as readonly [T, number])[0];
  };
  return { int, chance, pick, weighted, float: () => faker.number.float() };
}

const ASSET_CLASSES: Weighted<string> = [
  ['govt', 15],
  ['corporate', 30],
  ['muni', 10],
  ['mbs', 10],
  ['tba', 2],
  ['equity', 25],
  ['future', 3],
  ['swap', 3],
  ['fxForward', 2],
];
const CURRENCIES: Weighted<string> = [
  ['USD', 60],
  ['EUR', 20],
  ['GBP', 12],
  ['JPY', 8],
];
const PRICE_SOURCES = ['Primary vendor', 'Secondary vendor', 'Broker quote'] as const;
const PAR_PRICED = new Set(['govt', 'corporate', 'muni', 'mbs', 'tba']);
const US_STATES = ['CALIFORNIA', 'NEW YORK', 'TEXAS', 'ILLINOIS', 'OHIO', 'FLORIDA', 'WASHINGTON', 'GEORGIA'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const SAMPLED_EXCEPTIONS: [type: ExceptionType, label: string, slaDays: number][] = [
  ['positionBreak', 'Position differs from custodian', 3],
  ['marketValueBreak', 'Market value outside tolerance', 3],
  ['agedIncome', 'Income receivable past due', 5],
  ['accrualBreak', 'Accrued interest differs from expected', 5],
  ['ratingMissing', 'No regulatory rating', 10],
  ['impairmentReview', 'Impairment charge needs review', 10],
  ['glMappingBreak', 'No GL account mapped', 2],
  ['importRowError', 'Imported row failed validation', 1],
];

const STATUS_MIX: Weighted<ExceptionStatus> = [
  ['new', 60],
  ['inProgress', 20],
  ['waitingOnOthers', 8],
  ['resolved', 10],
  ['acceptedConditionally', 1],
  ['overridden', 1],
];

export interface SeedResult {
  scale: SeedScale;
  counts: Record<string, number>;
  /** sha256 over every row of every table, in rowid order. */
  checksum: string;
}

export function seed(db: Db, scale: SeedScale): SeedResult {
  const v = VOLUMES[scale];
  const faker = new Faker({ locale: [en] });
  faker.seed(FAKER_SEED);
  const r = makeRandom(faker);

  db.$client.transaction(() => {
    // ── Users and permissions ───────────────────────────────
    const insUser = inserter(db, t.users);
    const insPerm = inserter(db, t.permissions);
    for (const user of SEED_USERS) {
      insUser({ ...user, blotterScope: user.blotterScope ?? null });
      for (const grant of grantsFor(user.id)) insPerm({ userId: user.id, ...grant });
    }

    // ── Holidays ────────────────────────────────────────────
    const insHoliday = inserter(db, t.marketHolidays);
    const holidaysByMarket = new Map<string, Set<string>>();
    for (const [market, date, name] of HOLIDAYS) {
      insHoliday({ market, date, name });
      if (!holidaysByMarket.has(market)) holidaysByMarket.set(market, new Set());
      holidaysByMarket.get(market)?.add(date);
    }
    const holidaysFor = (market: string) => holidaysByMarket.get(market) ?? new Set<string>();

    // ── Portfolios ──────────────────────────────────────────
    const insPortfolio = inserter(db, t.portfolios);
    const portfolioCcy: string[] = [];
    const managers = Array.from({ length: 8 }, () => `${faker.company.name()} Asset Management`);
    for (let i = 0; i < PORTFOLIO_COUNT; i += 1) {
      const type = (['generalAccount', 'separateAccount', 'fund'] as const)[i % 3] as
        'generalAccount' | 'separateAccount' | 'fund';
      const ccy = i < 6 ? (['USD', 'USD', 'EUR', 'GBP', 'JPY', 'USD'][i] as string) : r.weighted(CURRENCIES);
      portfolioCcy.push(ccy);
      const label = { generalAccount: 'General Account', separateAccount: 'Separate Account', fund: 'Fund' }[
        type
      ];
      insPortfolio({
        id: portfolioId(i),
        name: `${faker.location.city()} ${label} ${ccy}`,
        type,
        baseCurrency: ccy,
        calendar: MARKET_BY_CCY[ccy] as string,
        manager: r.pick(managers),
        // Cleo owns the first 20 (SPEC §15: "I own 20 portfolios and a deadline").
        controllerId: i < 20 ? 'u-cleo' : 'team-investment-accounting',
        status: i === PORTFOLIO_COUNT - 1 ? 'inactive' : 'active',
      });
    }

    // ── Securities ──────────────────────────────────────────
    const insSecurity = inserter(db, t.securities);
    const issuers = Array.from({ length: 2_000 }, () => faker.company.name().toUpperCase());
    const held: {
      assetClass: string;
      currency: string;
      market: string;
      label: string;
      source: string;
      price: Decimal;
    }[] = [];
    for (let i = 0; i < v.securities; i += 1) {
      const assetClass = r.weighted(ASSET_CLASSES);
      const currency = ['muni', 'mbs', 'tba'].includes(assetClass) ? 'USD' : r.weighted(CURRENCIES);
      const issuer = r.pick(issuers);
      const coupon = (r.int(4, 28) * 0.25).toFixed(3);
      const year = r.int(2027, 2056);
      const month = r.int(1, 12);
      const maturity = `${year}-${pad(month, 2)}-15`;
      const tenor = r.pick([2, 5, 10, 30]);
      let description: string;
      let ticker: string | null = null;
      switch (assetClass) {
        case 'govt':
          description = `${{ USD: 'US TREASURY N/B', EUR: 'BUNDESREPUB. DEUTSCHLAND', GBP: 'UK TSY GILT', JPY: 'JAPAN GOVT BOND' }[currency]} ${coupon}% ${maturity}`;
          break;
        case 'corporate':
          description = `${issuer} ${coupon}% ${maturity}`;
          break;
        case 'muni':
          description = `${r.pick(US_STATES)} ST GO ${coupon}% ${maturity}`;
          break;
        case 'mbs':
          description = `${r.pick(['FNMA', 'FHLMC', 'GNMA'])} POOL ${r.pick(['AB', 'MA', 'BM', 'CA'])}${pad(r.int(0, 9999), 4)} ${coupon}%`;
          break;
        case 'tba':
          description = `${r.pick(['FNCL', 'FGLMC', 'G2SF'])} ${coupon} TBA ${MONTHS[month - 1]}`;
          break;
        case 'equity':
          ticker = [0, 1, 2, 3]
            .map((k) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(i / 26 ** k) % 26])
            .reverse()
            .join('')
            .replace(/^A+(?=.{3})/, '');
          description = `${issuer} ORD`;
          break;
        case 'future':
          description = `${currency} ${tenor}YR NOTE FUT ${MONTHS[month - 1]}${String(year).slice(2)}`;
          break;
        case 'swap':
          description = `IRS ${currency} ${coupon}% ${maturity} ${r.pick(['PAY FIX', 'REC FIX'])}`;
          break;
        default:
          description = `${currency}/${currency === 'USD' ? 'EUR' : 'USD'} FWD ${maturity}`;
      }
      const usCusip = currency === 'USD' ? cusip(i) : null;
      const gbSedol = currency === 'GBP' ? sedol(i) : null;
      const nsin = usCusip ?? (gbSedol ? `00${gbSedol}` : cusip(i));
      const market = MARKET_BY_CCY[currency] as string;
      insSecurity({
        id: securityId(i),
        isin: isin(COUNTRY_BY_CCY[currency] as string, nsin),
        cusip: usCusip,
        sedol: gbSedol,
        ticker,
        description,
        assetClass,
        currency,
        issuer,
        market,
        // Held securities stay active so positions always reference a live record.
        status: i >= v.held && r.chance(0.03) ? 'inactive' : 'active',
        held: i < v.held,
      });
      if (i < v.held) {
        const base = PAR_PRICED.has(assetClass)
          ? 80 + r.float() * 35
          : assetClass === 'equity'
            ? 5 + r.float() * 400
            : 90 + r.float() * 20;
        const scaled = currency === 'JPY' && assetClass === 'equity' ? base * 20 : base;
        held.push({
          assetClass,
          currency,
          market,
          label: description,
          source: r.pick(PRICE_SOURCES),
          price: new Decimal(scaled.toFixed(6)),
        });
      }
    }

    // ── Prices: one per held security per weekday, random walk with shaped breaks ──
    const insPrice = inserter(db, t.prices);
    const priceDays: string[] = [];
    for (let day = SEED_TODAY; priceDays.length < v.priceDays; day = addDays(day, -1)) {
      if (!isWeekend(day)) priceDays.unshift(day);
    }
    const lastPriceDay = priceDays[priceDays.length - 1] as string;
    const latest: {
      status: 'ok' | 'stale' | 'variance' | 'missing';
      price: string | null;
      prior: string | null;
    }[] = [];
    held.forEach((sec, i) => {
      const holidays = holidaysFor(sec.market);
      let prior: Decimal | null = null;
      let current = sec.price;
      priceDays.forEach((day, d) => {
        let status: 'ok' | 'stale' | 'variance' | 'missing' = 'ok';
        let value: Decimal | null;
        const roll = r.float();
        if (holidays.has(day)) {
          // Market closed: the vendor repeats the last price. Holiday-aware checks keep this 'ok'.
          value = prior ?? current;
        } else if (d > 0 && roll < 0.005) {
          status = 'missing';
          value = null;
        } else if (d > 0 && roll < 0.035) {
          status = 'stale';
          value = prior ?? current;
        } else if (d > 0 && roll < 0.045) {
          status = 'variance';
          value = current.mul(1 + (r.chance(0.5) ? 1 : -1) * (0.06 + r.float() * 0.09)).toDecimalPlaces(6);
        } else {
          value = current.mul(1 + (r.float() - 0.5) * 0.02).toDecimalPlaces(6);
        }
        const row = {
          status,
          price: value ? value.toFixed(6) : null,
          prior: prior ? prior.toFixed(6) : null,
        };
        insPrice({
          id: `PX-${pad(i + 1, 7)}-${day}`,
          securityId: securityId(i),
          priceDate: day,
          price: row.price,
          priorPrice: row.prior,
          currency: sec.currency,
          source: sec.source,
          toleranceStatus: status,
          version: 1,
        });
        if (value) {
          prior = value;
          current = value;
        }
        if (day === lastPriceDay) latest[i] = row;
      });
      sec.price = current;
    });

    // ── Positions: every held security sits in one to three portfolios ──
    const insPosition = inserter(db, t.positions);
    const positions: { portfolio: number; security: number; quantity: Decimal }[] = [];
    held.forEach((sec, i) => {
      const owners = new Set([i % PORTFOLIO_COUNT]);
      if (r.chance(0.7)) owners.add(r.int(0, PORTFOLIO_COUNT - 1));
      if (r.chance(0.4)) owners.add(r.int(0, PORTFOLIO_COUNT - 1));
      for (const p of owners) {
        const par = PAR_PRICED.has(sec.assetClass);
        const quantity = new Decimal(par ? r.int(100, 25_000) * 1_000 : r.int(1, 5_000) * 100);
        const factor = sec.assetClass === 'mbs' ? new Decimal((0.35 + r.float() * 0.6).toFixed(4)) : null;
        const price = latest[i]?.price;
        const marketValue = price
          ? quantity
              .mul(price)
              .div(par ? 100 : 1)
              .toFixed(MINOR_UNITS[sec.currency] as number)
          : null;
        positions.push({ portfolio: p, security: i, quantity });
        insPosition({
          id: `POS-${pad(positions.length, 7)}`,
          portfolioId: portfolioId(p),
          securityId: securityId(i),
          quantity: quantity.toFixed(4),
          originalFace: factor ? quantity.div(factor).toDecimalPlaces(0).toFixed(4) : null,
          marketValue,
          currency: sec.currency,
          asOf: lastPriceDay,
        });
      }
    });

    // ── Transactions ────────────────────────────────────────
    const insTxn = inserter(db, t.transactions);
    const txnTypes: Weighted<string> = [
      ['buy', 30],
      ['sell', 25],
      ['income', 20],
      ['corporateAction', 5],
      ['repo', 8],
      ['margin', 5],
      ['maturity', 2],
      ['fee', 5],
    ];
    const warningCodes = ['LL-VAL-0142', 'LL-VAL-0207', 'LL-VAL-0311'];
    const recentCutoff = addBusinessDays(SEED_TODAY, -5);
    const oldUnposted: {
      id: string;
      portfolio: number;
      label: string;
      tradeDate: string;
      amount: string;
      currency: string;
    }[] = [];
    for (let i = 0; i < v.transactions; i += 1) {
      const pos = r.pick(positions);
      const sec = held[pos.security] as (typeof held)[number];
      const type = r.weighted(txnTypes);
      // 5% unposted, all inside the last five business days, i.e. the open period.
      const unposted = r.chance(0.05);
      const offset = unposted ? r.int(0, 5) : Math.floor(r.float() ** 2 * 250);
      const tradeDate = addBusinessDays(SEED_TODAY, -offset - 1);
      const holidays = holidaysFor(sec.market);
      const settleDate = addBusinessDays(
        tradeDate,
        sec.assetClass === 'equity' || sec.assetClass === 'govt' ? 1 : 2,
        holidays,
      );
      const traded = type === 'buy' || type === 'sell' || type === 'repo' || type === 'maturity';
      const par = PAR_PRICED.has(sec.assetClass);
      const quantity = traded ? new Decimal(par ? r.int(10, 5_000) * 1_000 : r.int(1, 2_000) * 100) : null;
      const price = traded ? sec.price.mul(1 + (r.float() - 0.5) * 0.04).toDecimalPlaces(6) : null;
      const dp = MINOR_UNITS[sec.currency] as number;
      const amount =
        quantity && price
          ? quantity
              .mul(price)
              .div(par ? 100 : 1)
              .toFixed(dp)
          : new Decimal(r.int(50, 250_000)).add(dp ? r.int(0, 99) / 100 : 0).toFixed(dp);
      const status = unposted ? 'unposted' : r.chance(0.01) ? 'reversed' : 'posted';
      const id = `T-${pad(i + 1, 7)}`;
      insTxn({
        id,
        portfolioId: portfolioId(pos.portfolio),
        securityId: type === 'fee' ? null : securityId(pos.security),
        type,
        tradeDate,
        settleDate: type === 'fee' || type === 'margin' ? null : settleDate,
        quantity: quantity ? quantity.toFixed(4) : null,
        price: price ? price.toFixed(6) : null,
        amount,
        currency: sec.currency,
        status,
        warningCode: r.chance(0.02) ? r.pick(warningCodes) : null,
        origin: r.weighted([
          ['entered', 70],
          ['imported', 25],
          ['calculated', 5],
        ] as const),
        createdBy: r.weighted([
          ['u-ada', 60],
          ['u-ben', 25],
          ['interface-custody-feed', 15],
        ] as const),
        createdAt: `${tradeDate}T${pad(r.int(8, 17), 2)}:${pad(r.int(0, 59), 2)}:00Z`,
        version: 1,
      });
      if (unposted && tradeDate <= recentCutoff && oldUnposted.length < v.sampledExceptions * 3) {
        oldUnposted.push({
          id,
          portfolio: pos.portfolio,
          label: `${type} ${sec.label}`,
          tradeDate,
          amount,
          currency: sec.currency,
        });
      }
    }

    // ── Cash activity ───────────────────────────────────────
    const insCash = inserter(db, t.cashActivity);
    const cashBreaks: {
      id: string;
      portfolio: number;
      amount: string;
      currency: string;
      date: string;
      status: string;
      reference: string;
    }[] = [];
    for (let i = 0; i < v.cash; i += 1) {
      const p = r.int(0, PORTFOLIO_COUNT - 1);
      const currency = portfolioCcy[p] as string;
      const dp = MINOR_UNITS[currency] as number;
      const type = r.weighted([
        ['receipt', 40],
        ['disbursement', 30],
        ['wire', 15],
        ['fee', 5],
        ['interest', 10],
      ] as const);
      const roll = r.float();
      const status = roll < 0.01 ? 'unapplied' : roll < 0.015 && type === 'wire' ? 'outstanding' : 'applied';
      const amount = new Decimal(r.int(100, 5_000_000)).add(dp ? r.int(0, 99) / 100 : 0).toFixed(dp);
      const valueDate = addBusinessDays(SEED_TODAY, -r.int(1, 60));
      const id = `C-${pad(i + 1, 7)}`;
      const reference = `${type === 'wire' ? 'WIRE' : 'REF'}-${pad(r.int(0, 99_999_999), 8)}`;
      insCash({
        id,
        portfolioId: portfolioId(p),
        bankAccount: `${currency} Custody ${(p % 3) + 1}`,
        type,
        amount,
        currency,
        valueDate,
        status,
        reference,
      });
      if (status !== 'applied')
        cashBreaks.push({ id, portfolio: p, amount, currency, date: valueDate, status, reference });
    }

    // ── Periods: 12 month-ends per portfolio ────────────────
    const insPeriod = inserter(db, t.periods);
    const currentEnd = shiftMonthEnd(SEED_TODAY, 0);
    const closeTypes: CloseType[] = ['transaction', 'valuation', 'bankAccount', 'generalLedger'];
    const allCloses = (state: PeriodState) =>
      Object.fromEntries(closeTypes.map((c) => [c, state])) as Record<CloseType, PeriodState>;
    const REOPENED = { portfolio: 2, periodEnd: shiftMonthEnd(SEED_TODAY, -1) };
    for (let p = 0; p < PORTFOLIO_COUNT; p += 1) {
      for (let m = -11; m <= 0; m += 1) {
        const periodEnd = shiftMonthEnd(SEED_TODAY, m);
        const reopened = p === REOPENED.portfolio && periodEnd === REOPENED.periodEnd;
        const state: PeriodState = periodEnd === currentEnd ? 'open' : reopened ? 'reopened' : 'closed';
        insPeriod({
          id: `PER-${pad(p + 1, 4)}-${periodEnd.slice(0, 7)}`,
          portfolioId: portfolioId(p),
          periodEnd,
          cutoff: `${addBusinessDays(periodEnd, 5, holidaysFor(MARKET_BY_CCY[portfolioCcy[p] as string] as string))}T18:00:00Z`,
          state,
          closes: reopened ? { ...allCloses('closed'), transaction: 'reopened' } : allCloses(state),
          version: reopened ? 3 : state === 'closed' ? 2 : 1,
        });
      }
    }

    // ── Exceptions, generated by the same checks the close will run ──
    const insException = inserter(db, t.exceptions);
    let exceptionSeq = 0;
    const money = (value: string, currency: string): FinancialValue => ({
      kind: 'currencyAmount',
      value,
      currency,
      precision: MINOR_UNITS[currency] as number,
      signConvention: 'natural',
      provenance: { origin: 'calculated', source: 'close-checks', asOf: SEED_NOW },
    });
    const priceValue = (value: string | null, currency: string, source: string): FinancialValue => ({
      kind: 'price',
      value,
      currency,
      precision: 6,
      signConvention: 'natural',
      provenance: { origin: 'vendor', source, asOf: `${lastPriceDay}T22:00:00Z` },
      ...(value === null ? { nullReason: 'missing' as const } : {}),
    });
    const addException = (e: {
      type: ExceptionType;
      severity: 'low' | 'medium' | 'high';
      recordRef: { kind: string; id: string; label: string };
      portfolio: number;
      detected: string;
      slaDays: number;
      owner: string | null;
      values?: { expected?: FinancialValue; actual?: FinancialValue; tolerance?: FinancialValue };
    }) => {
      exceptionSeq += 1;
      const status = r.weighted(STATUS_MIX);
      const owner = status === 'new' && r.chance(0.5) ? null : e.owner;
      const commented = status !== 'new' && r.chance(0.3);
      insException({
        id: `EX-${pad(exceptionSeq, 6)}`,
        type: e.type,
        severity: e.severity,
        recordRef: e.recordRef,
        portfolioId: portfolioId(e.portfolio),
        periodEnd: currentEnd,
        detectedAt: `${e.detected}T06:00:00Z`,
        detectedBy: SYSTEM,
        owner: owner ? actor(owner) : null,
        status,
        values: e.values ?? null,
        rootCause: null,
        rootCauseCategory:
          status === 'resolved' ? r.pick(['timing', 'missingPrice', 'custodianError']) : null,
        dueBy: addBusinessDays(e.detected, e.slaDays),
        matchedRuleId: null,
        proposal: null,
        evidence: [],
        thread:
          commented && owner
            ? [
                {
                  id: `EX-${pad(exceptionSeq, 6)}-1`,
                  author: actor(owner),
                  at: `${e.detected}T10:30:00Z`,
                  text: 'Looking into this with the source.',
                },
              ]
            : [],
        version: 1,
      });
    };

    latest.forEach((row, i) => {
      if (row.status === 'ok') return;
      const sec = held[i] as (typeof held)[number];
      const type = ({ stale: 'priceStale', variance: 'priceVariance', missing: 'priceMissing' } as const)[
        row.status
      ];
      addException({
        type,
        severity:
          row.status === 'missing'
            ? 'high'
            : row.status === 'variance'
              ? r.chance(0.4)
                ? 'high'
                : 'medium'
              : 'low',
        recordRef: { kind: 'security', id: securityId(i), label: sec.label },
        portfolio: i % PORTFOLIO_COUNT,
        detected: lastPriceDay,
        slaDays: 1,
        owner: 'u-dev',
        values: {
          ...(row.prior ? { expected: priceValue(row.prior, sec.currency, sec.source) } : {}),
          actual: priceValue(row.price, sec.currency, sec.source),
        },
      });
    });
    for (const c of cashBreaks) {
      addException({
        type: 'cashBreak',
        severity: new Decimal(c.amount).gt(1_000_000) ? 'high' : 'medium',
        recordRef: {
          kind: 'cashActivity',
          id: c.id,
          label: `${c.status === 'unapplied' ? 'Unapplied receipt' : 'Outstanding wire'} ${c.reference}`,
        },
        portfolio: c.portfolio,
        detected: addBusinessDays(c.date, 1),
        slaDays: 3,
        owner: 'u-rafa',
        values: {
          expected: money(new Decimal(0).toFixed(MINOR_UNITS[c.currency] as number), c.currency),
          actual: money(c.amount, c.currency),
        },
      });
    }
    for (const txn of oldUnposted) {
      addException({
        type: 'unsettledTrade',
        severity: 'medium',
        recordRef: { kind: 'transaction', id: txn.id, label: txn.label },
        portfolio: txn.portfolio,
        detected: addBusinessDays(txn.tradeDate, 3),
        slaDays: 2,
        owner: 'u-ada',
        values: { actual: money(txn.amount, txn.currency) },
      });
    }
    for (const [type, label, slaDays] of SAMPLED_EXCEPTIONS) {
      for (let k = 0; k < v.sampledExceptions; k += 1) {
        const pos = r.pick(positions);
        const sec = held[pos.security] as (typeof held)[number];
        addException({
          type,
          severity: r.weighted([
            ['low', 50],
            ['medium', 35],
            ['high', 15],
          ] as const),
          recordRef: { kind: 'security', id: securityId(pos.security), label: `${label}: ${sec.label}` },
          portfolio: pos.portfolio,
          detected: addBusinessDays(SEED_TODAY, -r.int(1, 12)),
          slaDays,
          owner: r.pick(['u-rafa', 'u-cleo', 'u-rafa']),
        });
      }
    }

    // ── Reference and configuration data ────────────────────
    const insRootCause = inserter(db, t.rootCauses);
    for (const [id, label] of [
      ['timing', 'Timing'],
      ['missingPrice', 'Missing price'],
      ['custodianError', 'Custodian error'],
      ['manualEntryError', 'Manual entry error'],
      ['corporateAction', 'Corporate action'],
    ] as const) {
      insRootCause({ id, label });
    }

    const insTolerance = inserter(db, t.toleranceRules);
    const dayOverDay: Record<string, string> = {
      govt: '0.02',
      corporate: '0.03',
      muni: '0.03',
      mbs: '0.03',
      tba: '0.03',
      equity: '0.10',
      future: '0.05',
      swap: '0.05',
      fxForward: '0.03',
    };
    for (const [assetClass, threshold] of Object.entries(dayOverDay)) {
      insTolerance({
        id: `TOL-${assetClass}-dod`,
        version: 1,
        assetClass,
        currency: null,
        source: null,
        check: 'dayOverDay',
        threshold,
        holidayAware: true,
      });
      insTolerance({
        id: `TOL-${assetClass}-stale`,
        version: 1,
        assetClass,
        currency: null,
        source: null,
        check: 'stale',
        threshold: '1',
        holidayAware: true,
      });
      insTolerance({
        id: `TOL-${assetClass}-missing`,
        version: 1,
        assetClass,
        currency: null,
        source: null,
        check: 'missing',
        threshold: '0',
        holidayAware: true,
      });
    }

    inserter(
      db,
      t.recurringBreakRules,
    )({
      id: 'RBR-0001',
      name: 'Month-end custody fee timing',
      match: { type: 'cashBreak', maxAmount: '5000.00' },
      rootCauseCategory: 'timing',
      proposedActionId: 'exception.resolve',
      createdBy: actor('u-rafa'),
    });

    const insView = inserter(db, t.views);
    const txnColumns = [
      'id',
      'portfolioId',
      'securityId',
      'type',
      'tradeDate',
      'settleDate',
      'quantity',
      'price',
      'amount',
      'currency',
      'status',
    ];
    const columns = txnColumns.map((field) => ({ field, visible: true }));
    insView({
      id: 'V-transactions-default',
      gridId: 'transactions',
      name: 'All transactions',
      ownership: 'default',
      owner: actor('u-ada'),
      defaultForRole: null,
      state: { columns, sort: [{ field: 'tradeDate', dir: 'desc' }], filters: [] },
      schemaVersion: 1,
      updatedAt: SEED_NOW,
    });
    insView({
      id: 'V-transactions-unposted-yesterday',
      gridId: 'transactions',
      name: "Yesterday's unposted trades",
      ownership: 'shared',
      owner: actor('u-ada'),
      defaultForRole: 'Transaction Operations',
      state: {
        columns,
        sort: [{ field: 'tradeDate', dir: 'desc' }],
        filters: [
          { field: 'status', op: 'eq', value: 'unposted' },
          { field: 'tradeDate', op: 'relative', period: 'yesterday' },
        ],
        density: 'compact',
      },
      schemaVersion: 1,
      updatedAt: SEED_NOW,
    });

    const insWorkspace = inserter(db, t.workspaces);
    for (const [id, name, owner, group, panels] of [
      [
        'W-txn-ops',
        'Transaction Operations',
        'u-ada',
        'Transaction Operations',
        [{ gridId: 'transactions', viewId: 'V-transactions-default' }],
      ],
      [
        'W-accounting',
        'Period close',
        'u-cleo',
        'Investment Accounting',
        [
          { gridId: 'periods', viewId: 'default' },
          { gridId: 'exceptions', viewId: 'default' },
        ],
      ],
      ['W-market-data', 'Price review', 'u-dev', 'Market Data', [{ gridId: 'prices', viewId: 'default' }]],
      [
        'W-recon',
        'Breaks',
        'u-rafa',
        'Reconciliation and Control',
        [{ gridId: 'exceptions', viewId: 'default' }],
      ],
    ] as const) {
      insWorkspace({
        id,
        name,
        owner: actor(owner),
        group,
        loadAtStartup: true,
        layout: panels.length > 1 ? 'tabs' : 'single',
        poppedOut: null,
        isTeamDefault: true,
        panels: [...panels],
      });
    }

    const insReport = inserter(db, t.reports);
    for (const [id, name, description] of [
      ['R-holdings', 'Holdings by portfolio', 'Positions with market value as of a date.'],
      ['R-txn-register', 'Transaction register', 'Transactions for a portfolio and date range.'],
      ['R-cash-ledger', 'Cash ledger', 'Cash activity with applied status.'],
      ['R-exceptions', 'Open exceptions', 'Open exceptions by type, severity and age.'],
    ] as const) {
      insReport({ id, name, description, params: { portfolioIds: 'string[]', asOf: 'date' } });
    }

    const insStatement = inserter(db, t.statements);
    for (let p = 0; p < PORTFOLIO_COUNT; p += 1) {
      for (let m = -3; m <= -1; m += 1) {
        const periodEnd = shiftMonthEnd(SEED_TODAY, m);
        const id = `ST-${pad(p + 1, 4)}-${periodEnd.slice(0, 7)}`;
        insStatement({
          id,
          portfolioId: portfolioId(p),
          periodEnd,
          name: `Month-end statement ${periodEnd.slice(0, 7)}`,
          url: `/api/v1/statements/${id}/download`,
        });
      }
    }

    const insJob = inserter(db, t.jobs);
    insJob({
      id: 'J-000001',
      type: 'report',
      name: 'Holdings by portfolio',
      submittedBy: actor('u-cleo'),
      submittedAt: '2026-11-13T17:05:00Z',
      queue: 'reports',
      status: 'completed',
      progress: { done: 1, total: 1 },
      outputs: [{ name: 'holdings-2026-11-13.xlsx', format: 'xlsx', url: '/api/v1/jobs/J-000001/outputs/0' }],
      result: null,
      inputs: { reportId: 'R-holdings', asOf: '2026-11-13' },
      scheduledFor: null,
      log: [{ at: '2026-11-13T17:05:04Z', level: 'info', text: 'Report completed.' }],
    });
    insJob({
      id: 'J-000002',
      type: 'export',
      name: 'Transaction register export',
      submittedBy: actor('u-ada'),
      submittedAt: '2026-11-13T18:20:00Z',
      queue: 'exports',
      status: 'failed',
      progress: { done: 0, total: 1 },
      outputs: null,
      result: null,
      inputs: { reportId: 'R-txn-register', portfolioIds: [portfolioId(0)] },
      scheduledFor: null,
      log: [
        {
          at: '2026-11-13T18:20:09Z',
          level: 'error',
          text: 'Export target was unavailable. Retry uses the original inputs.',
        },
      ],
    });

    // The one reopened period carries its approval and audit trail.
    const reopenedId = `PER-${pad(REOPENED.portfolio + 1, 4)}-${REOPENED.periodEnd.slice(0, 7)}`;
    const reopenReason = 'Late corporate action notice received from custodian.';
    inserter(
      db,
      t.approvals,
    )({
      id: 'AP-000001',
      actionId: 'period.reopen',
      recordRefs: [{ type: 'period', id: reopenedId }],
      maker: actor('u-cleo'),
      requestedAt: '2026-11-10T09:12:00Z',
      reason: reopenReason,
      before: { closes: allCloses('closed') },
      after: { closes: { ...allCloses('closed'), transaction: 'reopened' } },
      evidence: null,
      status: 'approved',
      checker: actor('u-fay'),
      decidedAt: '2026-11-10T10:02:00Z',
      note: 'Approved. Notice attached to the period.',
    });
    inserter(
      db,
      t.auditEvents,
    )({
      id: 'AU-0000001',
      action: 'period.reopen',
      recordType: 'period',
      recordId: reopenedId,
      actor: actor('u-cleo'),
      at: '2026-11-10T10:02:00Z',
      effectiveDate: REOPENED.periodEnd,
      before: { state: 'closed' },
      after: { state: 'reopened' },
      note: { kind: 'approvalNote', text: reopenReason },
      evidence: null,
      batchId: null,
      immutable: true,
    });
  })();

  return { scale, ...summarise(db) };
}

/** Row count per table and one checksum over all content. Used to prove the seed is deterministic. */
export function summarise(db: Db): Pick<SeedResult, 'counts' | 'checksum'> {
  const hash = createHash('sha256');
  const counts: Record<string, number> = {};
  const tables = db.$client
    .prepare(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '\\_\\_%' escape '\\' order by name",
    )
    .all() as { name: string }[];
  for (const { name } of tables) {
    let count = 0;
    hash.update(name);
    for (const row of db.$client.prepare(`select * from "${name}" order by rowid`).raw().iterate()) {
      hash.update(JSON.stringify(row));
      count += 1;
    }
    counts[name] = count;
  }
  return { counts, checksum: hash.digest('hex') };
}

export { ACTIONS };
