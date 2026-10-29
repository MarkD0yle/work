import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Check, Info, Minus, X } from "lucide-react";
import { motion } from "framer-motion";
import { s, type Side } from "./tokens";
import { GLOSSARY, type GlossaryKey } from "./glossary";

/* FI Studio building blocks. Square corners (repo rule), soft paper
 * background, white cards, plain-English labels with a tooltip behind
 * every piece of jargon. */

export function Card({
  title,
  icon,
  hint,
  actions,
  children,
  className = "",
  bodyClassName = "p-4",
}: {
  title?: ReactNode;
  icon?: ReactNode;
  /** One short line under the title: what this card is for. */
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`flex min-h-0 min-w-0 flex-col ${s.card} ${className}`}>
      {title && (
        <header className="flex shrink-0 items-start gap-2.5 px-4 pt-3.5 pb-1">
          {icon && <span className="mt-0.5 text-indigo-500">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 className={s.h2}>{title}</h2>
            {hint && <p className="mt-0.5 text-[12px] text-stone-500">{hint}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** A jargon word with a dotted underline and a plain-English tooltip on hover or focus. */
export function Term({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  const id = useId();
  // Fixed positioning, so a tooltip inside a scrolling card is never clipped.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPos({ x: Math.min(r.left, window.innerWidth - 272), y: r.bottom + 6 });
  };
  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        aria-describedby={id}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={() => setPos(null)}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={() => setPos(null)}
        className="cursor-help border-b border-dotted border-stone-400 leading-tight focus:outline-none focus-visible:border-indigo-500"
      >
        {children ?? k}
      </button>
      <span
        id={id}
        role="tooltip"
        style={pos ? { left: pos.x, top: pos.y } : undefined}
        className={`pointer-events-none fixed z-[70] w-64 bg-stone-900 px-3 py-2 text-left text-[12px] leading-snug font-normal normal-case tracking-normal text-white shadow-lg transition-opacity ${
          pos ? "opacity-100" : "invisible opacity-0"
        }`}
      >
        {GLOSSARY[k]}
      </span>
    </span>
  );
}

export function InfoTip({ k }: { k: GlossaryKey }) {
  return (
    <Term k={k}>
      <Info className="h-3.5 w-3.5 text-stone-400" aria-label="What does this mean?" />
    </Term>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex bg-stone-100 p-0.5">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={`px-3 py-1 text-[12px] font-medium transition ${s.focus} disabled:cursor-not-allowed disabled:opacity-50 ${
              on ? "bg-white text-indigo-700 shadow-sm" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** "I want to buy / I want to sell" — the direction, in words, big. */
export function SideSwitch({ side, onChange, disabled, buyLabel = "Buy", sellLabel = "Sell" }: {
  side: Side;
  onChange: (s: Side) => void;
  disabled?: boolean;
  buyLabel?: string;
  sellLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Trade direction" className="grid grid-cols-2 gap-2">
      {(["Buy", "Sell"] as const).map((sd) => {
        const on = side === sd;
        return (
          <button
            key={sd}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(sd)}
            className={`flex items-center justify-center gap-2 border-2 py-2.5 text-[14px] font-semibold transition ${s.focus} disabled:cursor-not-allowed ${
              on
                ? sd === "Buy"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-orange-600 bg-orange-600 text-white"
                : "border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-800"
            }`}
          >
            {on && <Check className="h-4 w-4" />}
            {sd === "Buy" ? buyLabel : sellLabel}
          </button>
        );
      })}
    </div>
  );
}

export function Stat({ label, value, sub, valueClass = s.value, big }: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  valueClass?: string;
  big?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className={s.label}>{label}</p>
      <p className={`mt-0.5 font-semibold tabular-nums ${big ? "text-[22px] tracking-tight" : "text-[17px]"} ${valueClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-stone-500 tabular-nums">{sub}</p>}
    </div>
  );
}

export function Row({ k, v, vClass = s.value }: { k: ReactNode; v: ReactNode; vClass?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[13px]">
      <span className="text-stone-500">{k}</span>
      <span className={`text-right tabular-nums ${vClass}`}>{v}</span>
    </div>
  );
}

type Tone = "neutral" | "indigo" | "good" | "bad" | "warn" | "buy" | "sell";
const TONES: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-600",
  indigo: "bg-indigo-50 text-indigo-700",
  good: "bg-emerald-50 text-emerald-700",
  bad: "bg-rose-50 text-rose-700",
  warn: "bg-amber-50 text-amber-800",
  buy: "bg-blue-50 text-blue-700",
  sell: "bg-orange-50 text-orange-700",
};

export function Badge({ children, tone = "neutral", icon }: { children: ReactNode; tone?: Tone; icon?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONES[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

/** A market move with an arrow and a word, never colour alone. */
export function Move({ v, dp = 1, unit = "", goodWhenNegative = false, words }: {
  v: number;
  dp?: number;
  unit?: string;
  goodWhenNegative?: boolean;
  /** e.g. ["tighter", "wider"] for (negative, positive). */
  words?: [string, string];
}) {
  const flat = Math.abs(v) < 10 ** -dp / 2;
  const good = goodWhenNegative ? v < 0 : v > 0;
  const cls = flat ? "text-stone-500" : good ? "text-emerald-600" : "text-rose-600";
  const Icon = flat ? Minus : v > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 tabular-nums ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {v > 0 ? "+" : v < 0 ? "−" : ""}
      {Math.abs(v).toFixed(dp)}
      {unit}
      {words && !flat && <span className="ml-1 text-[11px] font-normal">{v < 0 ? words[0] : words[1]}</span>}
    </span>
  );
}

/** Numbered steps across the top of a flow. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((st, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={st} className="flex items-center gap-2" aria-current={on ? "step" : undefined}>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                done ? "bg-indigo-600 text-white" : on ? "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500" : "bg-stone-100 text-stone-400"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={`text-[12px] ${on ? "font-semibold text-stone-900" : done ? "text-stone-700" : "text-stone-400"}`}>{st}</span>
            {i < steps.length - 1 && <span className={`mx-1 h-px w-8 ${done ? "bg-indigo-400" : "bg-stone-200"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Centred confirm dialog. Esc or Back closes; focus lands on the main action. */
export function Dialog({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/30 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby={id}>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16 }}
        className={`w-full max-w-[480px] ${s.card} shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
          <h2 id={id} className="text-[15px] font-semibold text-stone-900">{title}</h2>
          <button type="button" onClick={onClose} className={`p-1 text-stone-400 hover:text-stone-700 ${s.focus}`} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-3">{actions}</div>
      </motion.div>
    </div>
  );
}

/** Countdown ring: fraction 1 → 0. */
export function Ring({ fraction, label, urgent, size = 76 }: { fraction: number; label: ReactNode; urgent?: boolean; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e7e5e4" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? "#e11d48" : "#4f46e5"}
          strokeWidth={6}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fraction)))}
          className="transition-[stroke-dashoffset] duration-100"
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[17px] font-semibold tabular-nums ${urgent ? "text-rose-600" : "text-stone-900"}`}>{label}</span>
    </div>
  );
}

/** Thin horizontal meter, 0–100. */
export function Meter({ pct, tone = "indigo", label }: { pct: number; tone?: "indigo" | "good" | "warn" | "bad"; label: string }) {
  const fill = { indigo: "bg-indigo-500", good: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-rose-500" }[tone];
  return (
    <div className="h-1.5 w-full bg-stone-100" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-1.5 ${fill}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

/** Small area sparkline. */
export function Spark({ data, label }: { data: number[]; label: string }) {
  const w = 320;
  const h = 64;
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const x = (i: number) => (i / (data.length - 1)) * w;
  const y = (v: number) => h - 4 - ((v - lo) / (hi - lo || 1)) * (h - 8);
  const path = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = data[data.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" role="img" aria-label={label}>
      <line x1={0} x2={w} y1={y(data[0])} y2={y(data[0])} stroke="#d6d3d1" strokeDasharray="3 3" />
      <path d={`${path} L${w},${h} L0,${h} Z`} fill="rgba(99,102,241,0.10)" />
      <path d={path} fill="none" stroke="#4f46e5" strokeWidth={1.75} />
      <circle cx={x(data.length - 1)} cy={y(last)} r={3} fill="#4f46e5" />
    </svg>
  );
}

/** A friendly one-paragraph summary at the top of a screen. */
export function Takeaway({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 border border-indigo-100 bg-indigo-50/60 px-4 py-3">
      <span className="mt-0.5 text-indigo-600">{icon}</span>
      <p className="text-[13px] leading-relaxed text-stone-700">{children}</p>
    </div>
  );
}
