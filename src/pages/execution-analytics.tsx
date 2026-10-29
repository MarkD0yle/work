import ExecutionAnalyticsApp from "../components/exec-analytics/ExecutionAnalyticsApp";

export const title = "Execution Analytics";
export const fullWidth = true;

/* Execution Analytics — redesigned execution-analytics platform: rail + fixed toolbar shell, token-driven
 * light/dark themes, shared DataTable / ChartPanel / DateRange, and eight screens over mock data. */
export default function ExecutionAnalyticsPage() {
  return <ExecutionAnalyticsApp />;
}
