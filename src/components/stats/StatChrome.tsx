import type { ReactNode } from "react";
import {
  PERIODS,
  PERIOD_LABEL,
  TONE_TEXT,
  type Period,
  type Tone,
} from "../../lib/stats-trend";

/* Chrome shared by the KPI Trend Patterns page: the per-pattern section
 * heading, the card header with its period toggle, and the use-it-when
 * notes. Square corners throughout (the zero-radius rule). */

export function PatternSection({
  id,
  index,
  title,
  question,
  description,
  children,
}: {
  id: string;
  index: number;
  title: string;
  question: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="mt-12 border-t border-neutral-200 pt-8"
      style={{ scrollMarginTop: 24 }}
    >
      <div className="mb-4">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          {String(index).padStart(2, "0")} · {question}
        </div>
        <h2
          id={`${id}-title`}
          className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-900"
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function PeriodToggle({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex items-center gap-1 border border-neutral-200 p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={period === p}
          onClick={() => onChange(p)}
          className={`px-2 py-0.5 text-[10px] font-medium uppercase transition ${
            period === p
              ? "bg-neutral-900 text-white"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          {PERIOD_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

/** Card header: scope label left, extra context + period toggle right. */
export function CardHeader({
  label,
  aside,
  period,
  onPeriodChange,
}: {
  label: string;
  aside?: ReactNode;
  period: Period;
  onPeriodChange: (p: Period) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-neutral-100 px-5 py-3">
      <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
        {label}
      </span>
      <div className="flex items-center gap-3">
        {aside && <span className="text-[11px] text-neutral-400">{aside}</span>}
        <PeriodToggle period={period} onChange={onPeriodChange} />
      </div>
    </div>
  );
}

export function DeltaText({ text, tone }: { text: string; tone: Tone }) {
  return <span className={TONE_TEXT[tone]}>{text}</span>;
}

export function PatternNotes({
  useWhen,
  avoidWhen,
}: {
  useWhen: ReactNode[];
  avoidWhen: ReactNode[];
}) {
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      {[
        { title: "Use it when", items: useWhen },
        { title: "Reach for something else when", items: avoidWhen },
      ].map((col) => (
        <div key={col.title}>
          <div className="mb-2 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            {col.title}
          </div>
          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm text-neutral-600">
            {col.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
