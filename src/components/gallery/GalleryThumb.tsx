import { useId, type ReactNode } from "react";
import type { Accent, Motif } from "../../lib/galleryMeta";

/* GalleryThumb — an abstract, stylised preview drawn for each gallery card.
 *
 * We have no real screenshots of the pages, so each card paints a motif that
 * hints at the page's shape (a grid, a chart, a form…) over the section's
 * accent gradient. White shapes at low opacity read as a tiny wireframe and
 * keep every thumbnail visually consistent. */

type Props = {
  motif: Motif;
  accent: Accent;
  /** Varies the heatmap/treemap cell pattern so cards don't all look alike. */
  seed?: number;
};

// Deterministic 0..1 pseudo-random from an integer — keeps thumbnails stable
// across renders (no Math.random) while giving each card its own texture.
function rand(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function Grid() {
  return (
    <g fill="#fff">
      <rect x={28} y={26} width={264} height={20} rx={4} opacity={0.9} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect
            x={28}
            y={58 + i * 28}
            width={150}
            height={14}
            rx={3}
            opacity={0.4}
          />
          <rect
            x={190}
            y={58 + i * 28}
            width={54}
            height={14}
            rx={3}
            opacity={0.28}
          />
          <rect
            x={256}
            y={58 + i * 28}
            width={36}
            height={14}
            rx={7}
            opacity={i % 2 === 0 ? 0.85 : 0.5}
          />
        </g>
      ))}
    </g>
  );
}

function Chart() {
  return (
    <g>
      {/* baseline */}
      <line
        x1={28}
        y1={158}
        x2={292}
        y2={158}
        stroke="#fff"
        strokeWidth={2}
        opacity={0.35}
      />
      {/* area */}
      <path
        d="M28 132 L80 110 L132 124 L184 78 L236 96 L292 60 L292 158 L28 158 Z"
        fill="#fff"
        opacity={0.18}
      />
      {/* line */}
      <path
        d="M28 132 L80 110 L132 124 L184 78 L236 96 L292 60"
        fill="none"
        stroke="#fff"
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.95}
      />
      {/* bars */}
      {[44, 96, 148, 200, 252].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={158 - (24 + rand(i + 1) * 40)}
          width={20}
          height={24 + rand(i + 1) * 40}
          rx={3}
          fill="#fff"
          opacity={0.22}
        />
      ))}
    </g>
  );
}

function Heatmap({ seed = 1 }: { seed?: number }) {
  const cols = 9;
  const rows = 5;
  const cell = 26;
  const gap = 5;
  const x0 = 36;
  const y0 = 30;
  const out: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const o = 0.12 + rand(seed * 31 + r * cols + c) * 0.8;
      out.push(
        <rect
          key={`${r}-${c}`}
          x={x0 + c * (cell + gap)}
          y={y0 + r * (cell + gap)}
          width={cell}
          height={cell}
          rx={3}
          fill="#fff"
          opacity={o}
        />,
      );
    }
  }
  return <g>{out}</g>;
}

function Form() {
  return (
    <g fill="#fff">
      <rect x={40} y={28} width={120} height={14} rx={3} opacity={0.85} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x={40}
            y={58 + i * 36}
            width={70}
            height={9}
            rx={2}
            opacity={0.5}
          />
          <rect
            x={40}
            y={72 + i * 36}
            width={240}
            height={20}
            rx={5}
            opacity={0.22}
          />
        </g>
      ))}
      <rect x={206} y={168} width={74} height={22} rx={6} opacity={0.95} />
    </g>
  );
}

function Calendar() {
  return (
    <g fill="#fff">
      <rect x={48} y={26} width={224} height={22} rx={5} opacity={0.85} />
      {Array.from({ length: 4 }).map((_, r) =>
        Array.from({ length: 7 }).map((__, c) => {
          const highlight = (r === 1 && c === 3) || (r === 2 && (c === 4 || c === 5));
          return (
            <rect
              key={`${r}-${c}`}
              x={48 + c * 32}
              y={58 + r * 30}
              width={24}
              height={22}
              rx={5}
              opacity={highlight ? 0.95 : 0.25}
            />
          );
        }),
      )}
    </g>
  );
}

function Flow() {
  const nodes = [44, 116, 188, 260];
  const y = 100;
  return (
    <g>
      <line
        x1={56}
        y1={y}
        x2={272}
        y2={y}
        stroke="#fff"
        strokeWidth={3}
        opacity={0.4}
      />
      {nodes.map((x, i) => (
        <g key={x}>
          <circle
            cx={x + 12}
            cy={y}
            r={14}
            fill="#fff"
            opacity={i === 0 ? 0.95 : 0.55}
          />
          <rect
            x={x - 6}
            y={y + 26}
            width={48}
            height={9}
            rx={2}
            fill="#fff"
            opacity={0.4}
          />
        </g>
      ))}
    </g>
  );
}

function Treemap() {
  return (
    <g fill="#fff">
      <rect x={28} y={26} width={150} height={92} rx={5} opacity={0.85} />
      <rect x={186} y={26} width={106} height={56} rx={5} opacity={0.45} />
      <rect x={186} y={90} width={50} height={64} rx={5} opacity={0.6} />
      <rect x={244} y={90} width={48} height={28} rx={5} opacity={0.3} />
      <rect x={244} y={126} width={48} height={28} rx={5} opacity={0.5} />
      <rect x={28} y={126} width={150} height={48} rx={5} opacity={0.3} />
    </g>
  );
}

function Panel() {
  return (
    <g fill="#fff">
      {/* top bar */}
      <rect x={28} y={24} width={264} height={18} rx={4} opacity={0.85} />
      {/* stat cards */}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={28 + i * 90}
          y={54}
          width={78}
          height={44}
          rx={6}
          opacity={0.3}
        />
      ))}
      {/* sparkline panel */}
      <rect x={28} y={110} width={264} height={64} rx={6} opacity={0.18} />
      <path
        d="M44 156 L86 138 L128 148 L170 122 L212 134 L276 116"
        fill="none"
        stroke="#fff"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
    </g>
  );
}

function MotifShape({ motif, seed }: { motif: Motif; seed: number }) {
  switch (motif) {
    case "grid":
      return <Grid />;
    case "chart":
      return <Chart />;
    case "heatmap":
      return <Heatmap seed={seed} />;
    case "form":
      return <Form />;
    case "calendar":
      return <Calendar />;
    case "flow":
      return <Flow />;
    case "treemap":
      return <Treemap />;
    case "panel":
    default:
      return <Panel />;
  }
}

export default function GalleryThumb({ motif, accent, seed = 1 }: Props) {
  const gradId = useId();
  return (
    <svg
      viewBox="0 0 320 200"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      role="img"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent.from} />
          <stop offset="100%" stopColor={accent.to} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={320} height={200} fill={`url(#${gradId})`} />
      <MotifShape motif={motif} seed={seed} />
    </svg>
  );
}
