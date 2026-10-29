import type { ReactNode } from "react";
import { MTD_DAYS, SPARK_DAYS, type Kpis, type Tone } from "./model";
import {
  INK,
  STATUS,
  TONE_COLOR,
  TONE_TEXT,
  days1,
  gbpC,
  gbpM,
  num0,
  pct,
  pp,
  signedDays,
  signedPct,
} from "./format";
import { MicroLabel } from "./ui";

/* KPI row: six bespoke stat tiles. Each carries a tone rail along its top
 * edge, a delta against its reference period, and where a number alone is
 * not enough, a small inline visual: the fails-rate sparkline with its
 * usual-range band, and the paid-versus-received split for penalties. */

const H = 34;

/** 30-point sparkline with a shaded p10–p90 band; current point marked. */
function Spark({
  values,
  lo,
  hi,
  tone,
  label,
}: {
  values: number[];
  lo: number;
  hi: number;
  tone: Tone;
  label: string;
}) {
  const min = Math.min(lo, ...values);
  const max = Math.max(hi, ...values);
  const span = max - min || 1;
  const pad = 3;
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * 100, y(v)] as const);
  const last = pts[pts.length - 1];
  return (
    <div role="img" aria-label={label} className="relative mt-2.5" style={{ height: H }}>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <rect x={0} y={y(hi)} width={100} height={Math.max(0, y(lo) - y(hi))} fill="#f0f0f0" />
        <line x1={0} x2={100} y1={y(hi)} y2={y(hi)} stroke="#d4d4d4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <line x1={0} x2={100} y1={y(lo)} y2={y(lo)} stroke="#d4d4d4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <polyline
          points={pts.map((p) => `${p[0]},${p[1].toFixed(2)}`).join(" ")}
          fill="none"
          stroke={INK}
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        aria-hidden
        className="absolute block"
        style={{
          width: 7,
          height: 7,
          left: `calc(${last[0]}% - 3.5px)`,
          top: last[1] - 3.5,
          background: TONE_COLOR[tone],
          boxShadow: "0 0 0 1.5px #fff",
        }}
      />
    </div>
  );
}

/** Paid (left, bad) against received (right, good), scaled to the larger. */
function SplitBar({ paid, received }: { paid: number; received: number }) {
  const max = Math.max(paid, received, 1);
  const l = (paid / max) * 50;
  const r = (received / max) * 50;
  return (
    <div
      role="img"
      aria-label={`Paid ${gbpC(paid)} against received ${gbpC(received)}`}
      className="relative mt-2.5 h-3 bg-neutral-100"
    >
      <div className="absolute inset-y-0" style={{ right: "50%", width: `${l}%`, background: STATUS.bad }} />
      <div className="absolute inset-y-0" style={{ left: "50%", width: `${r}%`, background: STATUS.good }} />
      <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-500" />
    </div>
  );
}

function Delta({ tone, text, vs }: { tone: Tone; text: string; vs: string }) {
  const arrow = text.startsWith("−") ? "▼" : text.startsWith("+") ? "▲" : "";
  return (
    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-[11px] leading-tight">
      <span className={`font-semibold whitespace-nowrap ${TONE_TEXT[tone]}`}>
        {arrow && <span aria-hidden>{arrow} </span>}
        {text}
      </span>
      <span className="text-neutral-400">{vs}</span>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
  sub,
  children,
}: {
  label: string;
  value: string;
  tone: Tone;
  sub: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="flex min-w-0 flex-col bg-white px-4 pt-3 pb-2.5"
      style={{ boxShadow: `inset 0 2px 0 ${TONE_COLOR[tone]}` }}
    >
      <dt>
        <MicroLabel>{label}</MicroLabel>
      </dt>
      <dd className="mt-1.5 text-[26px] leading-none font-semibold tracking-tight text-neutral-950">{value}</dd>
      {children}
      <div className="mt-auto pt-1.5 text-[10px] leading-snug text-neutral-400">{sub}</div>
    </div>
  );
}

const rel = (v: number, ref: number) => (ref > 0 ? ((v - ref) / ref) * 100 : 0);

export function KpiTiles({ kpis, empty }: { kpis: Kpis; empty: boolean }) {
  const k = kpis;
  const dash = "—";
  return (
    <dl className="grid grid-cols-2 gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-3 xl:grid-cols-6">
      <Tile
        label="Failing instructions"
        value={empty ? dash : num0(k.failing.v)}
        tone={empty ? "neutral" : k.failing.tone}
        sub={empty ? "No instructions in this slice" : `30-day average ${num0(Math.round(k.failing.ref))}`}
      >
        {!empty && <Delta tone={k.failing.tone} text={signedPct(rel(k.failing.v, k.failing.ref))} vs="vs 30-day avg" />}
      </Tile>
      <Tile
        label="Failing value"
        value={empty ? dash : gbpM(k.value.v)}
        tone={empty ? "neutral" : k.value.tone}
        sub={empty ? "No instructions in this slice" : `30-day average ${gbpM(k.value.ref)}`}
      >
        {!empty && <Delta tone={k.value.tone} text={signedPct(rel(k.value.v, k.value.ref))} vs="vs 30-day avg" />}
      </Tile>
      <Tile
        label="Fails rate"
        value={empty ? dash : pct(k.rate.v, 2)}
        tone={empty ? "neutral" : k.rate.tone}
        sub={
          empty ? (
            "Failing ÷ due to settle, by value"
          ) : (
            <>
              Usual range {pct(k.rate.p10, 2)}–{pct(k.rate.p90, 2)} (p10–p90, {SPARK_DAYS}d)
              {k.rate.aboveBand && <span className="ml-1 font-semibold text-rose-700">· above range</span>}
            </>
          )
        }
      >
        {!empty && (
          <>
            <Delta tone={k.rate.tone} text={pp(k.rate.v - k.rate.ref)} vs="vs 30-day avg" />
            <Spark
              values={k.rate.spark}
              lo={k.rate.p10}
              hi={k.rate.p90}
              tone={k.rate.tone}
              label={`Fails rate over the last ${SPARK_DAYS} business days, ${pct(k.rate.spark[0], 2)} to ${pct(k.rate.v, 2)}, usual range ${pct(k.rate.p10, 2)} to ${pct(k.rate.p90, 2)}`}
            />
          </>
        )}
      </Tile>
      <Tile
        label="Average age"
        value={empty ? dash : days1(k.age.v)}
        tone={empty ? "neutral" : k.age.tone}
        sub={empty ? "Business days since ISD" : `Business days since ISD · 30-day average ${days1(k.age.ref)}`}
      >
        {!empty && <Delta tone={k.age.tone} text={signedDays(k.age.v - k.age.ref)} vs="vs 30-day avg" />}
      </Tile>
      <Tile
        label="CSDR penalties MTD, net"
        value={empty ? dash : gbpC(k.penalties.v, true)}
        tone={empty ? "neutral" : k.penalties.tone}
        sub={
          empty
            ? "Received less paid, month to date"
            : `Received ${gbpC(k.penalties.received)} · paid ${gbpC(k.penalties.paid)} · ${MTD_DAYS} business days`
        }
      >
        {!empty && (
          <>
            <Delta
              tone={k.penalties.tone}
              text={gbpC(k.penalties.v - k.penalties.ref, true)}
              vs={`vs Aug, same ${MTD_DAYS} days`}
            />
            <SplitBar paid={k.penalties.paid} received={k.penalties.received} />
          </>
        )}
      </Tile>
      <Tile
        label="Unmatched instructions"
        value={empty ? dash : num0(k.unmatched.v)}
        tone={empty ? "neutral" : k.unmatched.tone}
        sub={
          empty
            ? "Not yet matched at the CSD"
            : `${pct(k.failing.v > 0 ? (100 * k.unmatched.v) / k.failing.v : 0, 0)} of failing · 30-day average ${num0(Math.round(k.unmatched.ref))}`
        }
      >
        {!empty && (
          <Delta tone={k.unmatched.tone} text={signedPct(rel(k.unmatched.v, k.unmatched.ref))} vs="vs 30-day avg" />
        )}
      </Tile>
    </dl>
  );
}
