import { ArrowRightToLine, BarChart3, Home, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = { id: string; label: string; route: string };
export type NavGroup = { id: string; label: string; icon: LucideIcon; items: NavItem[] };

export const NAV: NavGroup[] = [
  { id: "home", label: "Home", icon: Home, items: [{ id: "home", label: "Home", route: "home" }] },
  {
    id: "pre-trade", label: "Pre-Trade", icon: ArrowRightToLine,
    items: [
      { id: "pre-trade", label: "Pre-Trade", route: "pre-trade" },
      { id: "spread-matrix", label: "Spread Matrix", route: "spread-matrix" },
      { id: "rfq-par", label: "RFQ Par Analysis", route: "rfq-par" },
      { id: "execution-planner", label: "Execution Planner", route: "execution-planner" },
    ],
  },
  {
    id: "post-trade", label: "Post-Trade", icon: BarChart3,
    items: [
      { id: "run-report", label: "Run Report", route: "run-report" },
      { id: "review-reports", label: "Review Reports", route: "review-reports" },
      { id: "schedule-reports", label: "Schedule Reports", route: "schedule-reports" },
      { id: "peer-analysis", label: "Peer Analysis", route: "peer-analysis" },
      { id: "trend-analysis", label: "Trend Analysis", route: "trend-analysis" },
      { id: "quant-zone", label: "Quant Zone", route: "quant-zone" },
    ],
  },
  {
    id: "compliance", label: "Compliance", icon: Scale,
    items: [
      { id: "exception-reporting", label: "Exception Reporting", route: "exception-reporting" },
      { id: "regulatory-reporting", label: "Regulatory Reporting", route: "regulatory-reporting" },
    ],
  },
];

export const routeLabel = (route: string) => NAV.flatMap((g) => g.items).find((i) => i.route === route)?.label ?? "Page";
