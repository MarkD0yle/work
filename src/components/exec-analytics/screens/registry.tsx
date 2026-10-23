import type { ComponentType } from "react";
import Home from "./Home";
import ExceptionReporting from "./ExceptionReporting";
import ReviewReports from "./ReviewReports";
import RegulatoryReporting from "./RegulatoryReporting";
import CostAnalysis from "./CostAnalysis";
import SpreadMatrix from "./SpreadMatrix";
import PeerAnalysis from "./PeerAnalysis";
import LiquidityCost from "./LiquidityCost";
import { Placeholder } from "./Placeholder";
import { routeLabel } from "../config/nav";

export type RouteDef = { component: ComponentType; layout: "dashboard" | "form" };
const ph = (route: string): RouteDef => ({ component: () => <Placeholder title={routeLabel(route)} />, layout: "form" });

/** route id -> screen. Run Report hosts Cost Analysis; Pre-Trade hosts the Liquidity & Cost dashboard. */
export const ROUTES: Record<string, RouteDef> = {
  home: { component: Home, layout: "dashboard" },
  "pre-trade": { component: LiquidityCost, layout: "dashboard" },
  "spread-matrix": { component: SpreadMatrix, layout: "dashboard" },
  "rfq-par": ph("rfq-par"),
  "execution-planner": ph("execution-planner"),
  "run-report": { component: CostAnalysis, layout: "dashboard" },
  "review-reports": { component: ReviewReports, layout: "form" },
  "schedule-reports": ph("schedule-reports"),
  "peer-analysis": { component: PeerAnalysis, layout: "dashboard" },
  "trend-analysis": ph("trend-analysis"),
  "quant-zone": ph("quant-zone"),
  "exception-reporting": { component: ExceptionReporting, layout: "form" },
  "regulatory-reporting": { component: RegulatoryReporting, layout: "form" },
};
