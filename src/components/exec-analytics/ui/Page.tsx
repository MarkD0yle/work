import type { ReactNode } from "react";

/** Standard page header row: title (+ badge) on the left, actions on the right. */
export function PageHeader({ title, badge, left, right }: { title: string; badge?: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="ea-page-head">
      <div className="ea-page-head-left"><h1 className="ea-title">{title}</h1>{badge}{left}</div>
      <div className="ea-page-head-right">{right}</div>
    </div>
  );
}
