import type { ReactNode } from "react";
import { border, cx, surface } from "./tokens";

/* SplitView — list on the left, the selected item on the right.
 *
 * Queues, inboxes, approval lists. The list never moves when a row opens,
 * so the user keeps their place. Put ContextPanel in `detail`. When
 * nothing is selected `detail` should say what to do ("Select an item").
 * Below `lg` the detail stacks under the list. */

const WIDTH = { sm: "lg:grid-cols-[1fr_20rem]", md: "lg:grid-cols-[1fr_26rem]", lg: "lg:grid-cols-[1fr_32rem]" } as const;

export function SplitView({
  list,
  detail,
  detailWidth = "md",
}: {
  list: ReactNode;
  detail: ReactNode;
  detailWidth?: keyof typeof WIDTH;
}) {
  return (
    <div className={cx("grid min-h-0 grid-cols-1", WIDTH[detailWidth], border.default, surface.card)}>
      <div className="min-h-0 min-w-0 overflow-auto">{list}</div>
      <div className={cx("min-h-0 min-w-0 border-t lg:border-t-0 lg:border-l", border.divider)}>{detail}</div>
    </div>
  );
}
