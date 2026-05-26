import type { StageTrendData } from "../../lib/trend-data";
import Sparkline from "./Sparkline";
import AnomalyIndicator from "./AnomalyIndicator";

/* One stage column inside the StageTrendStrip.
 * Layout per spec §2: sparkline · today count · rolling average · anomaly */

export default function StageTrendColumn({
  data,
  onPastDayClick,
}: {
  data: StageTrendData;
  onPastDayClick?: (date: string) => void;
}) {
  const above =
    data.anomaly.direction === "above" && !data.anomaly.insufficient;
  const significant = data.anomaly.magnitude === "significant";

  // Today's count is severity-tinted from anomaly state.
  const countColour =
    data.anomaly.insufficient || data.anomaly.magnitude === "normal"
      ? "text-neutral-700"
      : above && significant
        ? "text-red-700"
        : above
          ? "text-amber-800"
          : significant
            ? "text-emerald-700"
            : "text-blue-700";

  return (
    <div className="flex flex-1 flex-col gap-1.5 px-1">
      <Sparkline
        bars={data.dailyCounts}
        todayAnomaly={data.anomaly}
        onPastBarClick={onPastDayClick}
        ariaLabel={`${data.stage} trend: today ${data.todayCount} breached, average ${data.rollingAverage.toFixed(1)}`}
      />
      <div className="flex items-baseline gap-1.5">
        <span
          className={`text-base font-semibold tabular-nums ${countColour}`}
        >
          {data.todayCount}
        </span>
        <span className="text-[10px] text-neutral-500">today</span>
      </div>
      <div className="text-[10px] text-neutral-400">
        avg {data.rollingAverage.toFixed(1)}
      </div>
      <AnomalyIndicator state={data.anomaly} />
    </div>
  );
}
