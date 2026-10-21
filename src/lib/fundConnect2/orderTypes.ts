/* Order types — the creation / redemption order types an ETF supports.
 *
 * Authorised participants create and redeem ETF shares in units (baskets).
 * Each order type the fund accepts carries its own sizing (shares per unit,
 * minimums) and controls (approval, comment, market-data ID, settlement-date
 * support, netting), and is offered for creation, redemption, or both.
 *
 * The list is stored in one form field (`orderTypes`) as a compact,
 * human-readable string —
 *   `Cash Create {u=50000 ms=1 mi= ap=n cm=n md=n sd=y nt=n c=y r=n}`
 * entries joined by "; " — so audit and delta review show a legible diff
 * instead of JSON. The two defaults live in their own fields and must point
 * at an entry offered for that direction.
 */

export type YesNo = "y" | "n" | "";

export type OrderTypeEntry = {
  name: string;
  /** Shares per creation / redemption unit (basket). Required. */
  unit: string;
  minShares: string;
  minInvest: string;
  approval: YesNo;
  comment: YesNo;
  marketDataId: YesNo;
  settleDate: YesNo;
  netting: YesNo;
  creation: YesNo;
  /* Creation terms — only asked, and only kept, while creation is "y". */
  /** Minutes relative to the fund's dealing cut-off; negative closes earlier. */
  creationCutoffOffset: string;
  /** Default settlement period for creations, e.g. "T+1". */
  creationSettlement: string;
  /** Transfer-agent instruction code. Optional. */
  creationTaCode: string;
  /** Basket the creation is delivered against. Optional. */
  creationBasketCode: string;
  redemption: YesNo;
};

export const SETTLEMENT_PERIODS = ["T+0", "T+1", "T+2", "T+3"];

/** Creation-only fields, blanked whenever creation is not offered. */
export const CREATION_FIELDS = [
  "creationCutoffOffset",
  "creationSettlement",
  "creationTaCode",
  "creationBasketCode",
] as const;

export type OrderCategory =
  | "Cash"
  | "In-Kind"
  | "Negotiated"
  | "Standard"
  | "T+0"
  | "NAV+"
  | "Hybrid / Custom";

export type CatalogItem = {
  name: string;
  category: OrderCategory;
  /** Which direction the type is normally used for — drives prefill. */
  direction: "create" | "redeem" | "both";
  description: string;
};

export const CATEGORIES: OrderCategory[] = [
  "Cash",
  "In-Kind",
  "Negotiated",
  "Standard",
  "T+0",
  "NAV+",
  "Hybrid / Custom",
];

export const CATALOG: CatalogItem[] = [
  { name: "Cash Create", category: "Cash", direction: "create", description: "AP delivers cash; the fund buys the basket." },
  { name: "Cash Redeem", category: "Cash", direction: "redeem", description: "AP receives cash; the fund sells the basket." },
  { name: "Cash Create T+1", category: "Cash", direction: "create", description: "Cash creation settling the next business day." },
  { name: "Cash Redeem T+1", category: "Cash", direction: "redeem", description: "Cash redemption settling the next business day." },
  { name: "Collateralised Cash Create", category: "Cash", direction: "create", description: "Cash creation against posted collateral." },
  { name: "In-Kind Create", category: "In-Kind", direction: "create", description: "AP delivers the published basket of securities." },
  { name: "In-Kind Redeem", category: "In-Kind", direction: "redeem", description: "AP receives the published basket of securities." },
  { name: "Custom In-Kind Create", category: "In-Kind", direction: "create", description: "In-kind creation against a non-standard basket." },
  { name: "Custom In-Kind Redeem", category: "In-Kind", direction: "redeem", description: "In-kind redemption against a non-standard basket." },
  { name: "Negotiated Basket", category: "Negotiated", direction: "both", description: "Basket agreed with the AP per order." },
  { name: "Negotiated Cash Create", category: "Negotiated", direction: "create", description: "Cash creation at a negotiated spread." },
  { name: "Negotiated Cash Redeem", category: "Negotiated", direction: "redeem", description: "Cash redemption at a negotiated spread." },
  { name: "Standard Create", category: "Standard", direction: "create", description: "Default creation on the fund's standard terms." },
  { name: "Standard Redeem", category: "Standard", direction: "redeem", description: "Default redemption on the fund's standard terms." },
  { name: "T+0 Cash Create", category: "T+0", direction: "create", description: "Same-day cash creation." },
  { name: "T+0 Cash Redeem", category: "T+0", direction: "redeem", description: "Same-day cash redemption." },
  { name: "NAV+ Cash Create", category: "NAV+", direction: "create", description: "Cash creation at NAV plus a fixed charge." },
  { name: "NAV+ Cash Redeem", category: "NAV+", direction: "redeem", description: "Cash redemption at NAV less a fixed charge." },
  { name: "Hybrid Basket", category: "Hybrid / Custom", direction: "both", description: "Part securities, part cash-in-lieu." },
  { name: "Cash-in-Lieu Basket", category: "Hybrid / Custom", direction: "both", description: "Basket with named positions replaced by cash." },
];

export const CATALOG_BY_NAME: Record<string, CatalogItem> = Object.fromEntries(
  CATALOG.map((c) => [c.name, c]),
);

/** Template defaults for a newly picked type — every Yes/No starts answered,
 *  so the user only changes the deviations instead of clicking ten radios. */
export function templateFor(item: CatalogItem): OrderTypeEntry {
  const negotiated = item.category === "Negotiated" || item.category === "Hybrid / Custom" || item.name.startsWith("Custom");
  return {
    name: item.name,
    unit: "",
    minShares: "",
    minInvest: "",
    approval: negotiated ? "y" : "n",
    comment: negotiated ? "y" : "n",
    marketDataId: "n",
    settleDate: item.category === "T+0" ? "n" : "y",
    netting: "n",
    creation: item.direction === "redeem" ? "n" : "y",
    creationCutoffOffset: item.direction === "redeem" ? "" : "0",
    // Prefill only where the type itself implies the period.
    creationSettlement:
      item.direction === "redeem"
        ? ""
        : item.category === "T+0"
          ? "T+0"
          : item.name.includes("T+1")
            ? "T+1"
            : "",
    creationTaCode: "",
    creationBasketCode: "",
    redemption: item.direction === "create" ? "n" : "y",
  };
}

const KEYS: [keyof OrderTypeEntry, string][] = [
  ["unit", "u"],
  ["minShares", "ms"],
  ["minInvest", "mi"],
  ["approval", "ap"],
  ["comment", "cm"],
  ["marketDataId", "md"],
  ["settleDate", "sd"],
  ["netting", "nt"],
  ["creation", "c"],
  ["creationCutoffOffset", "co"],
  ["creationSettlement", "cs"],
  ["creationTaCode", "ct"],
  ["creationBasketCode", "cb"],
  ["redemption", "r"],
];

const ENTRY = /^(.+?) \{(.*)\}$/;

export function parseOrderTypes(raw: string | undefined): OrderTypeEntry[] {
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const m = part.match(ENTRY);
      if (!m) return [];
      const attrs = Object.fromEntries(
        m[2]
          .split(" ")
          .filter(Boolean)
          .map((kv) => {
            const [k, v = ""] = kv.split("=");
            return [k, v];
          }),
      );
      const entry = { name: m[1] } as OrderTypeEntry;
      for (const [key, short] of KEYS) {
        (entry as Record<string, string>)[key] = attrs[short] ?? "";
      }
      return [entry];
    });
}

export function serialiseOrderTypes(entries: OrderTypeEntry[]): string {
  return entries
    .map((e) => `${e.name} {${KEYS.map(([key, short]) => `${short}=${e[key]}`).join(" ")}}`)
    .join("; ");
}

/** Problems with one entry, keyed by field — used by the modal and by
 *  section validation, so both agree on what "complete" means. */
export function entryErrors(e: OrderTypeEntry): Partial<Record<keyof OrderTypeEntry, string>> {
  const out: Partial<Record<keyof OrderTypeEntry, string>> = {};
  if (e.unit.trim() === "") out.unit = "Enter the shares per unit.";
  else if (!/^\d+$/.test(e.unit) || Number(e.unit) <= 0) out.unit = "Must be a whole number above 0.";
  if (e.minShares !== "" && !/^\d+$/.test(e.minShares)) out.minShares = "Must be a whole number.";
  if (e.minInvest !== "" && !/^\d+(\.\d{1,2})?$/.test(e.minInvest)) out.minInvest = "Must be an amount, up to 2 decimals.";
  for (const k of ["approval", "comment", "marketDataId", "settleDate", "netting", "creation", "redemption"] as const) {
    if (e[k] === "") out[k] = "Choose Yes or No.";
  }
  if (e.creation === "y") {
    if (e.creationCutoffOffset.trim() === "") out.creationCutoffOffset = "Enter the offset in minutes (0 = fund cut-off).";
    else if (!/^-?\d+$/.test(e.creationCutoffOffset)) out.creationCutoffOffset = "Must be whole minutes, e.g. -30.";
    if (e.creationSettlement === "") out.creationSettlement = "Choose the settlement period.";
  }
  if (e.creation === "n" && e.redemption === "n") {
    out.redemption = "Offer it for creation, redemption, or both.";
  }
  return out;
}

/** Drop creation terms when creation isn't offered, so they don't linger
 *  in the record (or the audit diff) after the toggle flips to No. */
export function normalise(e: OrderTypeEntry): OrderTypeEntry {
  if (e.creation === "y") return e;
  const out = { ...e };
  for (const k of CREATION_FIELDS) out[k] = "";
  return out;
}

/** "−30 min · T+1" — creation terms in one line for the grid. */
export function creationTerms(e: OrderTypeEntry): string {
  if (e.creation !== "y") return "";
  const off = e.creationCutoffOffset;
  const offText = off === "" ? "" : off === "0" ? "at cut-off" : `${off.replace("-", "−")} min`;
  return [offText, e.creationSettlement].filter(Boolean).join(" · ");
}

export function offeredFor(entries: OrderTypeEntry[], dir: "creation" | "redemption"): OrderTypeEntry[] {
  return entries.filter((e) => e[dir] === "y");
}

/** One line for the condensed section row. */
export function summariseOrderTypes(values: Record<string, string>): string {
  const entries = parseOrderTypes(values.orderTypes);
  if (entries.length === 0) return "No order types yet";
  const defaults = [
    values.defaultCreationOrderType && `create → ${values.defaultCreationOrderType}`,
    values.defaultRedemptionOrderType && `redeem → ${values.defaultRedemptionOrderType}`,
  ].filter(Boolean);
  return `${entries.length} type${entries.length === 1 ? "" : "s"}${
    defaults.length ? ` · ${defaults.join(" · ")}` : ""
  }`;
}

export function formatInt(raw: string): string {
  if (raw === "" || !/^\d+$/.test(raw)) return raw;
  return Number(raw).toLocaleString("en-US");
}
