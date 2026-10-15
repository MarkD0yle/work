import type { Stage, Tone } from "../patterns";

/* Fixture data for the Pattern Library demos. Illustrative only. */

export type Order = {
  id: string;
  instrument: string;
  side: "Buy" | "Sell";
  qty: number;
  filled: number;
  venue: string;
  status: "Working" | "Partial" | "Filled" | "Rejected" | "Pending";
  stage: string;
};

export const ORDERS: Order[] = [
  { id: "ORD-1042", instrument: "UKT 4¼ 2032", side: "Buy", qty: 25_000_000, filled: 0.6, venue: "Tradeweb", status: "Partial", stage: "working" },
  { id: "ORD-1043", instrument: "DBR 2.6 2034", side: "Sell", qty: 10_000_000, filled: 0, venue: "Bloomberg", status: "Working", stage: "working" },
  { id: "ORD-1044", instrument: "UST 4.0 2034", side: "Buy", qty: 50_000_000, filled: 1, venue: "Tradeweb", status: "Filled", stage: "filled" },
  { id: "ORD-1045", instrument: "EUR/GBP 3M", side: "Sell", qty: 15_000_000, filled: 0, venue: "360T", status: "Rejected", stage: "checks" },
  { id: "ORD-1046", instrument: "OAT 3.0 2033", side: "Buy", qty: 8_000_000, filled: 0, venue: "MTS", status: "Pending", stage: "checks" },
  { id: "ORD-1047", instrument: "BTP 4.1 2029", side: "Sell", qty: 12_000_000, filled: 1, venue: "MTS", status: "Filled", stage: "allocated" },
  { id: "ORD-1048", instrument: "UKT 0⅞ 2029", side: "Buy", qty: 30_000_000, filled: 0.25, venue: "Tradeweb", status: "Partial", stage: "working" },
];

export const STAGES: Stage[] = [
  { id: "checks", label: "Pre-trade", count: 2, issues: 1, issueTone: "negative", caption: "1 rejected" },
  { id: "working", label: "Working", count: 3 },
  { id: "filled", label: "Filled", count: 1 },
  { id: "allocated", label: "Allocated", count: 1, issues: 1, issueTone: "warning", caption: "1 unallocated > 30m" },
];

export const TREND = [96.1, 96.8, 97.2, 96.4, 97.9, 98.1, 97.5, 97.0, 96.6, 97.3, 97.8, 98.0, 97.6, 97.1, 96.9, 97.4, 97.7, 98.2, 97.9, 97.4];

export function statusTone(s: Order["status"]): Tone {
  return s === "Filled" ? "positive" : s === "Partial" ? "warning" : s === "Rejected" ? "negative" : s === "Working" ? "info" : "neutral";
}
