import type { AdvancedFilterModel } from "ag-grid-community";
import { ASSET_LABEL, MARKET_LABEL, ORIGIN_LABEL, PORTFOLIO_TYPE_LABEL, STATUS_LABEL, TRANSACTIONS, TYPE_LABEL, type Txn } from "./model";

/* Data and saved filters for AG Grid's own Advanced Filter.
 *
 * AG Grid's expression bar and builder match against cell values, so list
 * fields carry their display labels ("Corporate action", "Unposted") rather
 * than Ledgerline's codes. That way what you type, what the builder offers
 * and what the grid shows are the same words. */

const CREATED_BY: Record<string, string> = { "u-ada": "Ada", "u-ben": "Ben", "interface-custody-feed": "Custody feed" };

export type Row = Txn;

export const ROWS: Row[] = TRANSACTIONS.map((r) => ({
  ...r,
  type: TYPE_LABEL[r.type] ?? r.type,
  status: STATUS_LABEL[r.status] ?? r.status,
  assetClass: r.assetClass ? (ASSET_LABEL[r.assetClass] ?? r.assetClass) : null,
  market: r.market ? (MARKET_LABEL[r.market] ?? r.market) : null,
  portfolioType: PORTFOLIO_TYPE_LABEL[r.portfolioType] ?? r.portfolioType,
  origin: ORIGIN_LABEL[r.origin] ?? r.origin,
  createdBy: CREATED_BY[r.createdBy] ?? r.createdBy,
}));

/* ---- saved filters, as AdvancedFilterModel ------------------------ */

type Cond = AdvancedFilterModel;
const text = (colId: string, type: string, filter?: string): Cond => ({ filterType: "text", colId, type, ...(filter !== undefined && { filter }) }) as Cond;
const num = (colId: string, type: string, filter: number): Cond => ({ filterType: "number", colId, type, filter }) as Cond;
const date = (colId: string, type: string, filter: string): Cond => ({ filterType: "dateString", colId, type, filter }) as Cond;
const bool = (colId: string, type: "true" | "false"): Cond => ({ filterType: "boolean", colId, type }) as Cond;
const and = (...conditions: Cond[]): Cond => ({ filterType: "join", type: "AND", conditions }) as Cond;
const or = (...conditions: Cond[]): Cond => ({ filterType: "join", type: "OR", conditions }) as Cond;

export interface SavedFilter {
  id: string;
  name: string;
  owner: string;
  note: string;
  model: AdvancedFilterModel | null;
}

export const SAVED_FILTERS: SavedFilter[] = [
  {
    id: "close-review",
    name: "Month-end close review",
    owner: "Investment Accounting",
    note: "Reversals, unposted older than three days, calculated rows with warnings.",
    model: or(
      text("status", "equals", "Reversed"),
      and(text("status", "equals", "Unposted"), num("age", "greaterThan", 3)),
      and(text("origin", "equals", "Calculated"), bool("hasWarning", "true")),
    ),
  },
  {
    id: "unposted-warnings",
    name: "Unposted with warnings",
    owner: "Transaction Ops",
    note: "Records that won't post until someone acknowledges the warning.",
    model: and(text("status", "equals", "Unposted"), text("warningCode", "notBlank")),
  },
  {
    id: "large-non-usd",
    name: "Large non-USD trades",
    owner: "Cleo · Controller",
    note: "Buys and sells over 1m outside USD, for the FX revaluation check.",
    model: and(or(text("type", "equals", "Buy"), text("type", "equals", "Sell")), text("currency", "notEqual", "USD"), num("amount", "greaterThan", 1_000_000)),
  },
  {
    id: "repo-margin-month",
    name: "Repo & margin this month, manual only",
    owner: "Funding desk",
    note: "Hand-keyed financing in November: excludes the custody feed.",
    model: and(
      or(text("type", "equals", "Repo"), text("type", "equals", "Margin")),
      date("tradeDate", "greaterThanOrEqual", "2026-11-01"),
      text("createdBy", "notEqual", "Custody feed"),
    ),
  },
  {
    id: "fi-slow-settle",
    name: "Fixed income settling T+3 or later",
    owner: "Settlements",
    note: "Bond buys and sells whose settle date sits three or more days out.",
    model: and(
      or(
        text("assetClass", "equals", "Government"),
        text("assetClass", "equals", "Corporate"),
        text("assetClass", "equals", "Municipal"),
        text("assetClass", "equals", "MBS"),
      ),
      or(text("type", "equals", "Buy"), text("type", "equals", "Sell")),
      num("settleLag", "greaterThanOrEqual", 3),
    ),
  },
  { id: "none", name: "No filter", owner: "All transactions", note: "", model: null },
];
