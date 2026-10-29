import { INITIAL_ROWS, type OrderRow } from "../../pages/blotter";
import type { Answer, ContextSource, PromptCard, Scope, Source } from "./data";

/* Blotter scope: the assistant docked beside the MM Order Blotter.
 *
 * Answers are computed from the blotter's own seeded rows (INITIAL_ROWS), so
 * an order ID in the chat is one the user can find in the grid. The grid's
 * live feed re-prices copies of those rows, so the assistant reads the book
 * as it stood at the open and says so — the same honesty a real assistant
 * owes when its data lags the screen.
 *
 * Notionals are summed in their own currency units, as the blotter's KPI
 * strip does; tables show the currency beside every amount.
 */

const SNAPSHOT = "Book at open, 19 May";

const SRC: Record<string, Source> = {
  oms: { id: "oms", label: "Orders & fills", system: "OMS", asOf: SNAPSHOT },
  credit: { id: "credit", label: "Counterparty credit limits", system: "Credit engine", asOf: SNAPSHOT },
  ssi: { id: "ssi", label: "Settlement instructions", system: "SSI store", asOf: SNAPSHOT },
  mkt: { id: "mkt", label: "Market data", system: "Bloomberg", asOf: "Live, 15m delay" },
};

const OPEN = new Set<OrderRow["status"]>(["NEW", "PENDING-CREDIT", "WORKING", "PART-FILL"]);
const rows = () => INITIAL_ROWS;
const open = () => rows().filter((r) => OPEN.has(r.status));
const remaining = (r: OrderRow) => r.notional - r.filled;
const m = (n: number) => Math.round(n / 1e6);
const count = (xs: OrderRow[], f: (r: OrderRow) => boolean) => xs.filter(f).length;

function workingAnswer(): Answer {
  const o = open();
  const byProduct = new Map<string, number>();
  o.forEach((r) => byProduct.set(r.product, (byProduct.get(r.product) ?? 0) + remaining(r)));
  const products = [...byProduct.entries()].sort((a, b) => b[1] - a[1]);
  const top = [...o].sort((a, b) => remaining(b) - remaining(a)).slice(0, 8);
  const biggest = products[0];
  return {
    intent: "blotter-working",
    steps: [`Filtered ${rows().length} orders to open statuses`, "Summed remaining notional by product", "Ranked open orders by size"],
    blocks: [
      {
        type: "text",
        md: `**${o.length} orders are still open** — ${count(o, (r) => r.status === "WORKING")} working, ${count(o, (r) => r.status === "PART-FILL")} part-filled, ${count(o, (r) => r.status === "NEW")} new and ${count(o, (r) => r.status === "PENDING-CREDIT")} waiting on credit. **${biggest[0]}** carries the most unfilled size.`,
      },
      {
        type: "kpis",
        items: [
          { label: "Open orders", value: String(o.length) },
          { label: "Part-filled", value: String(count(o, (r) => r.status === "PART-FILL")) },
          { label: "Pending credit", value: String(count(o, (r) => r.status === "PENDING-CREDIT")), tone: "neg", delta: "Can't trade yet" },
          { label: "Largest open", value: `${top[0].ccy} ${m(remaining(top[0]))}m`, delta: top[0].orderId },
        ],
      },
      {
        type: "chart",
        id: "blotter-open-by-product",
        spec: {
          kind: "column",
          title: "Remaining notional by product (m, own ccy)",
          unit: "m",
          categories: products.map(([p]) => p),
          series: [{ name: "Remaining", data: products.map(([, v]) => m(v)), color: "#111827" }],
        },
      },
      {
        type: "table",
        id: "blotter-open-top",
        spec: {
          title: "Largest open orders",
          columns: [
            { key: "id", label: "Order" },
            { key: "rem", label: "Remaining (m)", align: "right", format: "num" },
            { key: "ccy", label: "Ccy" },
            { key: "p", label: "Product" },
            { key: "st", label: "Status" },
            { key: "side", label: "Side" },
            { key: "cp", label: "Counterparty" },
          ],
          rows: top.map((r) => ({ id: r.orderId, p: r.product, side: r.side, ccy: r.ccy, rem: m(remaining(r)), cp: r.counterparty, st: r.status })),
        },
      },
    ],
    sources: [SRC.oms],
    followUps: ["Which open orders are close to their credit limit?", "Show settlement problems on today's fills", "Break desk P&L down by desk"],
  };
}

function creditAnswer(): Answer {
  const hot = open()
    .filter((r) => r.limitUtil >= 85 || !r.creditOk)
    .sort((a, b) => b.limitUtil - a.limitUtil);
  const blocked = hot.filter((r) => !r.creditOk);
  return {
    intent: "blotter-credit",
    steps: ["Joined open orders to counterparty lines", "Flagged utilisation ≥ 85% or failed check"],
    blocks: [
      {
        type: "text",
        md: hot.length
          ? `**${hot.length} open orders** sit at or above **85%** of their counterparty line. **${blocked.length}** ${blocked.length === 1 ? "has" : "have"} failed the pre-trade credit check and can't be sent.`
          : "No open orders are above 85% of their counterparty line.",
      },
      {
        type: "table",
        id: "blotter-credit",
        spec: {
          title: "Open orders near their credit limit",
          columns: [
            { key: "id", label: "Order" },
            { key: "u", label: "Line used", align: "right", format: "pct" },
            { key: "ok", label: "Check" },
            { key: "cp", label: "Counterparty" },
            { key: "rt", label: "Rating" },
            { key: "ccy", label: "Ccy" },
            { key: "n", label: "Notional (m)", align: "right", format: "num" },
          ],
          rows: hot.slice(0, 10).map((r) => ({
            id: r.orderId,
            cp: r.counterparty,
            rt: r.cptyRating,
            ccy: r.ccy,
            n: m(r.notional),
            u: r.limitUtil,
            ok: r.creditOk ? "Pass" : "Fail",
          })),
        },
      },
      ...(blocked.length
        ? [{ type: "callout" as const, tone: "warn" as const, text: `${blocked.map((r) => r.orderId).join(", ")} need a limit increase or a different counterparty before they can trade.` }]
        : []),
    ],
    sources: [SRC.oms, SRC.credit],
    followUps: ["What's still working on the book?", "Show settlement problems on today's fills"],
  };
}

function settlementAnswer(): Answer {
  const traded = rows().filter((r) => r.status === "FILLED" || r.status === "PART-FILL");
  const failed = rows().filter((r) => r.ssi === "FAILED");
  const pending = traded.filter((r) => r.ssi === "PENDING");
  const matched = traded.filter((r) => r.ssi === "MATCHED");
  const pct = traded.length ? Math.round((matched.length / traded.length) * 100) : 0;
  const list = [...failed, ...pending].sort((a, b) => b.notional - a.notional).slice(0, 10);
  return {
    intent: "blotter-ssi",
    steps: ["Checked SSI status on every order", "Listed failed and pending instructions by size"],
    blocks: [
      {
        type: "text",
        md: `**${pct}%** of traded orders have matched settlement instructions. **${failed.length} failed** and **${pending.length} pending** need ops to chase before value date.`,
      },
      {
        type: "kpis",
        items: [
          { label: "Matched", value: `${pct}%`, tone: "pos" },
          { label: "Pending", value: String(pending.length), tone: "neutral" },
          { label: "Failed", value: String(failed.length), tone: failed.length ? "neg" : "neutral", delta: failed.length ? "Chase today" : undefined },
        ],
      },
      {
        type: "table",
        id: "blotter-ssi",
        spec: {
          title: "Instructions to chase",
          columns: [
            { key: "id", label: "Order" },
            { key: "s", label: "SSI" },
            { key: "vd", label: "Value date" },
            { key: "cp", label: "Counterparty" },
            { key: "ccy", label: "Ccy" },
            { key: "n", label: "Notional (m)", align: "right", format: "num" },
          ],
          rows: list.map((r) => ({ id: r.orderId, cp: r.counterparty, ccy: r.ccy, n: m(r.notional), vd: r.valueDate, s: r.ssi })),
        },
      },
    ],
    sources: [SRC.oms, SRC.ssi],
    followUps: ["Which open orders are close to their credit limit?", "What's still working on the book?"],
  };
}

function pnlAnswer(): Answer {
  const byDesk = new Map<string, { pnl: number; n: number }>();
  rows().forEach((r) => {
    const d = byDesk.get(r.desk) ?? { pnl: 0, n: 0 };
    byDesk.set(r.desk, { pnl: d.pnl + r.pnl, n: d.n + 1 });
  });
  const desks = [...byDesk.entries()].sort((a, b) => b[1].pnl - a[1].pnl);
  const total = desks.reduce((a, [, d]) => a + d.pnl, 0);
  const k = (v: number) => Math.round(v / 1000);
  return {
    intent: "blotter-pnl",
    steps: ["Summed order P&L by desk", "Ranked desks"],
    blocks: [
      {
        type: "text",
        md: `Desk P&L at the open is **${total >= 0 ? "+" : "−"}${Math.abs(k(total)).toLocaleString("en-GB")}k**. **${desks[0][0]}** leads; **${desks[desks.length - 1][0]}** is weakest.`,
      },
      {
        type: "chart",
        id: "blotter-pnl-desk",
        spec: {
          kind: "bar",
          title: "P&L by desk (k)",
          unit: "k",
          categories: desks.map(([d]) => d),
          series: [{ name: "P&L", data: desks.map(([, d]) => k(d.pnl)) }],
        },
      },
      {
        type: "table",
        id: "blotter-pnl-table",
        spec: {
          title: "P&L by desk",
          columns: [
            { key: "d", label: "Desk" },
            { key: "n", label: "Orders", align: "right", format: "num" },
            { key: "p", label: "P&L (k)", align: "right", format: "money" },
          ],
          rows: desks.map(([d, v]) => ({ d, n: v.n, p: k(v.pnl) })),
        },
      },
      { type: "callout", tone: "info", text: "This is P&L at the open. The blotter's Desk P&L tile is live, so it will differ. Both sum currencies without FX conversion." },
    ],
    sources: [SRC.oms],
    followUps: ["What's still working on the book?", "Which open orders are close to their credit limit?"],
  };
}

const fallback = (): Answer => ({
  intent: "fallback",
  steps: ["Searched the order book"],
  blocks: [{ type: "text", md: "I can't answer that from the order book. Try one of the suggestions below." }],
  sources: [],
  followUps: ["What's still working on the book?", "Which open orders are close to their credit limit?", "Show settlement problems on today's fills"],
});

// First match wins; credit before "working" because "open orders near limit"
// mentions both.
const RULES: [RegExp, () => Answer][] = [
  [/credit|limit|line|breach/i, creditAnswer],
  [/settle|ssi|fail|chase|instruction/i, settlementAnswer],
  [/p&l|pnl|profit|desk/i, pnlAnswer],
  [/working|open|unfilled|outstanding|still|book/i, workingAnswer],
];

const PROMPTS: PromptCard[] = [
  { id: "b1", group: "Orders", title: "What's open", prompt: "What's still working on the book?" },
  { id: "b2", group: "Credit", title: "Limits", prompt: "Which open orders are close to their credit limit?" },
  { id: "b3", group: "Settlement", title: "SSI problems", prompt: "Show settlement problems on today's fills" },
  { id: "b4", group: "P&L", title: "By desk", prompt: "Break desk P&L down by desk" },
];

const CONTEXT: ContextSource[] = Object.values(SRC).map((s) => ({ ...s, enabled: s.id !== "mkt" }));

export const BLOTTER_SCOPE: Scope = {
  id: "blotter",
  kind: "Current page",
  name: "MM Order Blotter",
  chip: "Order Blotter",
  asOf: SNAPSHOT,
  intro: "I can see the order book on this page: open orders, credit, settlement and P&L.",
  facts: [
    ["Desk", "Money Market Execution"],
    ["Orders", String(INITIAL_ROWS.length)],
    ["Products", "Depo, CD, CP, Repo, T-Bill, FX swap"],
    ["Data", "Opening snapshot — the grid keeps ticking"],
  ],
  prompts: PROMPTS,
  defaultContext: CONTEXT,
  answer: (prompt) => (RULES.find(([re]) => re.test(prompt))?.[1] ?? fallback)(),
};
