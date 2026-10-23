import { AlertTriangle, CheckCircle2, Info, Lock, XCircle } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "./Button";

export type Tone = "error" | "warning" | "success" | "info";
const TONE_ICON = { error: XCircle, warning: AlertTriangle, success: CheckCircle2, info: Info };

export function Banner({ tone = "info", children, onRetry }: { tone?: Tone; children: ReactNode; onRetry?: () => void }) {
  const I = TONE_ICON[tone];
  return (
    <div className="ea-banner" data-tone={tone} role={tone === "error" ? "alert" : "status"}>
      <I size={16} aria-hidden /><span className="ea-grow">{children}</span>
      {onRetry && <Button variant="tertiary" size="compact" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function Badge({ tone = "muted", children }: { tone?: Tone | "muted"; children: ReactNode }) {
  return <span className="ea-badge" data-tone={tone}>{children}</span>;
}

export function Chip({ children, onClick, title }: { children: ReactNode; onClick?: () => void; title?: string }) {
  return onClick
    ? <button type="button" className="ea-chip" onClick={onClick} title={title}>{children}</button>
    : <span className="ea-chip" title={title}>{children}</span>;
}

export function ReadOnlyBadge() {
  return <span className="ea-badge" data-tone="muted"><Lock size={12} aria-hidden />Read only</span>;
}

/** What is empty, why, and one action. */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="ea-empty">
      <div style={{ color: "var(--color-text)", fontWeight: 500 }}>{title}</div>
      {hint && <div className="ea-caption">{hint}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 12, style }: { width?: number | string; height?: number | string; style?: CSSProperties }) {
  return <div className="ea-skel" style={{ width, height, ...style }} aria-hidden />;
}

export function Direction({ value }: { value: "buy" | "sell" }) {
  // Blue/orange plus text: never red/green for direction.
  return <span className={value === "buy" ? "ea-buy" : "ea-sell"}>{value === "buy" ? "Buy" : "Sell"}</span>;
}
