import {
  ArrowLeftRight,
  Calculator,
  Database,
  LayoutDashboard,
  Scale,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "../patterns/tokens";

/* Navigation model shared by every sidebar on the Left Sidebar Patterns page.
 *
 * All ten variations render this one tree, for a fictional investment
 * services platform (fund accounting, reconciliation, transfer agency,
 * custody, oversight). Holding the content constant is what makes the
 * comparison fair: when two sidebars feel different it is the pattern, not
 * the menu, that changed.
 *
 * Counts are open items for the valuation date and are fixed, so the page
 * renders the same every time.
 */

export type NavChild = { id: string; label: string; count?: number };

export type NavItem = {
  id: string;
  label: string;
  /** Short mnemonic, used by the terminal variation and the command bar. */
  code: string;
  /** Open items needing attention on this page. */
  count?: number;
  tone?: Tone;
  children?: NavChild[];
};

export type NavModule = {
  id: string;
  label: string;
  /** Label for tight spaces such as an icon rail. */
  short: string;
  icon: LucideIcon;
  items: NavItem[];
};

export const VALUATION_DATE = "18 Nov 2026";

export const NAV_MODULES: NavModule[] = [
  {
    id: "overview",
    label: "Overview",
    short: "Home",
    icon: LayoutDashboard,
    items: [
      { id: "home", label: "Home", code: "HOME" },
      { id: "my-work", label: "My Work", code: "WORK", count: 18, tone: "info" },
    ],
  },
  {
    id: "fund-accounting",
    label: "Fund Accounting",
    short: "Acct",
    icon: Calculator,
    items: [
      { id: "nav-production", label: "NAV Production", code: "NAV", count: 4, tone: "warning" },
      { id: "nav-signoff", label: "NAV Sign-off", code: "SGN", count: 7, tone: "info" },
      { id: "pricing", label: "Pricing & Valuation", code: "PRC", count: 12, tone: "warning" },
      { id: "accruals", label: "Income & Accruals", code: "ACR" },
      { id: "fees", label: "Fees & Expenses", code: "FEE" },
      { id: "ledger", label: "General Ledger", code: "GL" },
    ],
  },
  {
    id: "reconciliation",
    label: "Reconciliation",
    short: "Recs",
    icon: Scale,
    items: [
      {
        id: "cash-rec",
        label: "Cash Reconciliation",
        code: "CRC",
        count: 14,
        tone: "negative",
        children: [
          { id: "cash-rec/nostro", label: "Nostro accounts", count: 9 },
          { id: "cash-rec/custody", label: "Custody cash", count: 4 },
          { id: "cash-rec/margin", label: "Broker margin", count: 1 },
        ],
      },
      {
        id: "position-rec",
        label: "Position Reconciliation",
        code: "POS",
        count: 6,
        tone: "warning",
        children: [
          { id: "position-rec/custody", label: "Custodian holdings", count: 4 },
          { id: "position-rec/prime", label: "Prime broker", count: 2 },
          { id: "position-rec/units", label: "Units in issue" },
        ],
      },
      { id: "transaction-rec", label: "Transaction Reconciliation", code: "TXN", count: 3, tone: "neutral" },
      { id: "breaks", label: "Breaks & Exceptions", code: "BRK", count: 23, tone: "negative" },
    ],
  },
  {
    id: "transfer-agency",
    label: "Transfer Agency",
    short: "TA",
    icon: Users,
    items: [
      { id: "dealing", label: "Dealing", code: "DEAL", count: 31, tone: "info" },
      { id: "register", label: "Investor Register", code: "REG" },
      { id: "distributions", label: "Distributions", code: "DIST" },
      { id: "investor-kyc", label: "Investor AML / KYC", code: "KYC", count: 5, tone: "warning" },
    ],
  },
  {
    id: "custody",
    label: "Custody & Settlement",
    short: "Custody",
    icon: ArrowLeftRight,
    items: [
      { id: "settlements", label: "Settlements", code: "STL", count: 5, tone: "negative" },
      { id: "corporate-actions", label: "Corporate Actions", code: "CA", count: 9, tone: "warning" },
      { id: "tax-reclaims", label: "Tax Reclaims", code: "TAX", count: 2, tone: "neutral" },
      { id: "fx-cash", label: "FX & Cash Management", code: "FXC" },
    ],
  },
  {
    id: "oversight",
    label: "Oversight & Reporting",
    short: "Oversight",
    icon: ShieldCheck,
    items: [
      { id: "fund-oversight", label: "Fund Oversight", code: "OVS" },
      { id: "regulatory", label: "Regulatory Reporting", code: "RGR", count: 1, tone: "warning" },
      { id: "client-reporting", label: "Client Reporting", code: "RPT" },
      { id: "audit", label: "Audit Trail", code: "AUD" },
    ],
  },
  {
    id: "data",
    label: "Reference Data",
    short: "Data",
    icon: Database,
    items: [
      { id: "security-master", label: "Security Master", code: "SEC" },
      { id: "price-sources", label: "Price Sources", code: "SRC" },
      { id: "calendars", label: "Calendars & Cut-offs", code: "CAL" },
    ],
  },
];

export type FlatItem = NavItem & { module: NavModule };

export const ALL_ITEMS: FlatItem[] = NAV_MODULES.flatMap((module) =>
  module.items.map((item) => ({ ...item, module })),
);

const BY_ID = new Map(ALL_ITEMS.map((item) => [item.id, item]));

/** Look an item up by id. A child id ("cash-rec/nostro") resolves to its parent. */
export function findItem(id: string): FlatItem {
  return BY_ID.get(id.split("/")[0]) ?? ALL_ITEMS[0];
}

export function moduleOf(id: string): NavModule {
  return findItem(id).module;
}

/** Breadcrumb trail and title for whatever id is active. */
export function describe(id: string): { crumbs: string[]; title: string; item: FlatItem } {
  const item = findItem(id);
  const child = item.children?.find((c) => c.id === id);
  return {
    crumbs: child ? [item.module.label, item.label] : [item.module.label],
    title: child ? child.label : item.label,
    item,
  };
}

export function moduleCount(module: NavModule): number {
  return module.items.reduce((sum, item) => sum + (item.count ?? 0), 0);
}

const SEVERITY: Tone[] = ["negative", "warning", "info", "neutral"];

/** The most severe tone among a module's items that have open work. */
export function moduleTone(module: NavModule): Tone | undefined {
  const tones = module.items.filter((i) => i.count).map((i) => i.tone ?? "neutral");
  return SEVERITY.find((t) => tones.includes(t));
}

/** Props every sidebar variation takes. */
export type SidebarProps = {
  activeId: string;
  onNavigate: (id: string) => void;
};
