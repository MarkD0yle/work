import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { SECTIONS, sectionForSlug } from "../lib/pageSections";
import { navigateToPage } from "../lib/navigation";

export const title = "Home — Isometric Diorama";
export const section = "patterns";
export const fullWidth = true;

/* Home — Isometric Diorama. A concept for the Absurd Alpha landing page in
 * the "isometric diorama" style: an orthographic, 2:1 dimetric miniature town
 * on a floating island, with clay-like matte colours and soft ground shadows.
 * Every building is one sidebar section ("district"). Hover or pick a district
 * to see its screens; clicking a screen navigates there via the window event.
 * Everything is hand-built SVG — no 3D library. */

type PageModule = { default: ComponentType; title?: string; section?: string };

type PageItem = { slug: string; title: string; section: string };

// Lazy glob on purpose: an eager self-including glob creates an import cycle
// with the other catalogue pages (gallery, uxf) and trips the TDZ. By the time
// this effect runs, App has already loaded every module, so this is instant.
const pageLoaders = import.meta.glob<PageModule>("./*.tsx");

function usePages() {
  const [pages, setPages] = useState<PageItem[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.all(
      Object.entries(pageLoaders).map(async ([path, load]) => {
        const slug = path.replace(/^\.\//, "").replace(/\.tsx$/, "");
        const mod = await load();
        return {
          slug,
          title:
            mod.title ??
            slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          section: sectionForSlug(slug, mod.section),
        };
      }),
    ).then((all) => {
      if (!alive) return;
      setPages(
        all
          .filter((p) => p.slug !== "home-diorama")
          .sort((a, b) => a.title.localeCompare(b.title)),
      );
    });
    return () => {
      alive = false;
    };
  }, []);
  return pages;
}

/* ---------------- iso projection ---------------- */

const T = 22; // px per grid unit (half tile width)
const HZ = 25; // px per unit of height

type V3 = [number, number, number];

function pt(x: number, y: number, z = 0): [number, number] {
  return [(x - y) * T, ((x + y) * T) / 2 - z * HZ];
}

function poly(pts: V3[]) {
  return pts.map(([x, y, z]) => pt(x, y, z).join(",")).join(" ");
}

function mix(hex: string, to: string, t: number) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const ch = (n: number, s: number) => (n >> s) & 255;
  const c = (s: number) =>
    Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${c(16)}${c(8)}${c(0)}`;
}
const light = (c: string, t = 0.28) => mix(c, "#ffffff", t);
const dark = (c: string, t = 0.16) => mix(c, "#3b3046", t);

/* ---------------- primitives ---------------- */

type BoxProps = {
  x: number;
  y: number;
  z?: number;
  w: number;
  d: number;
  h: number;
  c: string;
};

// A cuboid: only the three faces the camera can see (top, +x, +y).
function Box({ x, y, z = 0, w, d, h, c }: BoxProps) {
  const b = z;
  const t = z + h;
  return (
    <g>
      <polygon
        points={poly([
          [x + w, y, b],
          [x + w, y + d, b],
          [x + w, y + d, t],
          [x + w, y, t],
        ])}
        fill={dark(c)}
      />
      <polygon
        points={poly([
          [x, y + d, b],
          [x + w, y + d, b],
          [x + w, y + d, t],
          [x, y + d, t],
        ])}
        fill={c}
      />
      <polygon
        points={poly([
          [x, y, t],
          [x + w, y, t],
          [x + w, y + d, t],
          [x, y + d, t],
        ])}
        fill={light(c)}
        stroke="#ffffff"
        strokeOpacity={0.45}
        strokeWidth={0.6}
      />
    </g>
  );
}

// Soft contact shadow cast toward +x (light comes from the upper left).
function GroundShadow({ x, y, w, d, h }: Omit<BoxProps, "c" | "z">) {
  const s = Math.min(h * 0.45, 1.6);
  return (
    <polygon
      points={poly([
        [x, y, 0],
        [x + w + s, y, 0],
        [x + w + s, y + d + s * 0.3, 0],
        [x, y + d + s * 0.3, 0],
      ])}
      fill="#4b5a3a"
      opacity={0.18}
      filter="url(#dio-soft)"
    />
  );
}

// Gable roof; ridge runs along the x axis ("x") or the y axis ("y").
function Gable({
  x,
  y,
  z,
  w,
  d,
  h,
  c,
  axis = "x",
}: BoxProps & { z: number; axis?: "x" | "y" }) {
  const t = z + h;
  if (axis === "x") {
    const ym = y + d / 2;
    return (
      <g>
        <polygon
          points={poly([
            [x, y, z],
            [x + w, y, z],
            [x + w, ym, t],
            [x, ym, t],
          ])}
          fill={light(c, 0.35)}
        />
        <polygon
          points={poly([
            [x + w, y, z],
            [x + w, y + d, z],
            [x + w, ym, t],
          ])}
          fill={dark(c, 0.22)}
        />
        <polygon
          points={poly([
            [x, y + d, z],
            [x + w, y + d, z],
            [x + w, ym, t],
            [x, ym, t],
          ])}
          fill={c}
        />
      </g>
    );
  }
  const xm = x + w / 2;
  return (
    <g>
      <polygon
        points={poly([
          [x, y, z],
          [x, y + d, z],
          [xm, y + d, t],
          [xm, y, t],
        ])}
        fill={light(c, 0.35)}
      />
      <polygon
        points={poly([
          [x, y + d, z],
          [x + w, y + d, z],
          [xm, y + d, t],
        ])}
        fill={c}
      />
      <polygon
        points={poly([
          [x + w, y, z],
          [x + w, y + d, z],
          [xm, y + d, t],
          [xm, y, t],
        ])}
        fill={dark(c, 0.2)}
      />
    </g>
  );
}

function Pyramid({ x, y, z, w, d, h, c }: BoxProps & { z: number }) {
  const apex: V3 = [x + w / 2, y + d / 2, z + h];
  return (
    <g>
      <polygon
        points={poly([[x + w, y, z], [x + w, y + d, z], apex])}
        fill={dark(c, 0.2)}
      />
      <polygon
        points={poly([[x, y + d, z], [x + w, y + d, z], apex])}
        fill={c}
      />
    </g>
  );
}

// Iso circle → ellipse with semi-axes r·√2·T and half that.
function Cylinder({
  cx,
  cy,
  z = 0,
  r,
  h,
  c,
}: {
  cx: number;
  cy: number;
  z?: number;
  r: number;
  h: number;
  c: string;
}) {
  const rx = r * Math.SQRT2 * T;
  const ry = rx / 2;
  const [bx, by] = pt(cx, cy, z);
  const ty = by - h * HZ;
  const id = `cyl-${cx}-${cy}`;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor={light(c, 0.1)} />
          <stop offset="0.55" stopColor={c} />
          <stop offset="1" stopColor={dark(c, 0.25)} />
        </linearGradient>
      </defs>
      <path
        d={`M${bx - rx},${ty} L${bx - rx},${by} A${rx},${ry} 0 0 0 ${bx + rx},${by} L${bx + rx},${ty} Z`}
        fill={`url(#${id})`}
      />
      <ellipse cx={bx} cy={ty} rx={rx} ry={ry} fill={light(c)} />
    </g>
  );
}

function Dome({
  cx,
  cy,
  z,
  r,
  h,
  c,
}: {
  cx: number;
  cy: number;
  z: number;
  r: number;
  h: number;
  c: string;
}) {
  const rx = r * Math.SQRT2 * T;
  const ry = rx / 2;
  const [x0, y0] = pt(cx, cy, z);
  return (
    <g>
      <path
        d={`M${x0 - rx},${y0} A${rx},${h * HZ} 0 0 1 ${x0 + rx},${y0} A${rx},${ry} 0 0 1 ${x0 - rx},${y0} Z`}
        fill="url(#dio-dome)"
      />
      <path
        d={`M${x0 - rx},${y0} A${rx},${h * HZ} 0 0 1 ${x0 + rx},${y0} A${rx},${ry} 0 0 1 ${x0 - rx},${y0} Z`}
        fill={c}
        opacity={0.55}
      />
      {/* telescope slit */}
      <path
        d={`M${x0 + rx * 0.05},${y0 - h * HZ * 0.98} L${x0 + rx * 0.35},${y0 - h * HZ * 0.75} L${x0 + rx * 0.42},${y0 + ry * 0.2} L${x0 + rx * 0.12},${y0 + ry * 0.35} Z`}
        fill="#3b3a5c"
        opacity={0.75}
      />
    </g>
  );
}

// Window / panel on the +y face (fixed y), spanning x1..x2, z1..z2.
function PanelY(props: {
  y: number;
  x1: number;
  x2: number;
  z1: number;
  z2: number;
  c: string;
  o?: number;
}) {
  const { y, x1, x2, z1, z2, c, o = 1 } = props;
  return (
    <polygon
      points={poly([
        [x1, y, z1],
        [x2, y, z1],
        [x2, y, z2],
        [x1, y, z2],
      ])}
      fill={c}
      opacity={o}
    />
  );
}

// Window / panel on the +x face (fixed x), spanning y1..y2, z1..z2.
function PanelX(props: {
  x: number;
  y1: number;
  y2: number;
  z1: number;
  z2: number;
  c: string;
  o?: number;
}) {
  const { x, y1, y2, z1, z2, c, o = 1 } = props;
  return (
    <polygon
      points={poly([
        [x, y1, z1],
        [x, y2, z1],
        [x, y2, z2],
        [x, y1, z2],
      ])}
      fill={c}
      opacity={o}
    />
  );
}

function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const [cx, cy] = pt(x, y, 0.75 * s);
  return (
    <g>
      <ellipse
        cx={pt(x + 0.35, y, 0)[0]}
        cy={pt(x + 0.35, y, 0)[1]}
        rx={T * 0.7 * s}
        ry={T * 0.3 * s}
        fill="#4b5a3a"
        opacity={0.16}
      />
      <Box x={x - 0.08} y={y - 0.08} w={0.16} d={0.16} h={0.5 * s} c="#a8835e" />
      <circle cx={cx} cy={cy} r={T * 0.5 * s} fill="url(#dio-tree)" />
    </g>
  );
}

/* ---------------- districts ---------------- */

type District = {
  id: string;
  name: string; // building name
  color: string;
  anchor: V3; // label position (roof)
  render: () => ReactNode;
};

const DISTRICTS: District[] = [
  {
    id: "trading",
    name: "The Exchange",
    color: "#9cc3e6",
    anchor: [2, 2, 7.3],
    render: () => (
      <g>
        <GroundShadow x={1} y={1} w={2} d={2} h={6} />
        <Box x={1} y={1} w={2} d={2} h={6} c="#9cc3e6" />
        {[0.6, 1.5, 2.4, 3.3, 4.2, 5.1].map((z) => (
          <g key={z}>
            <PanelY y={3} x1={1.15} x2={2.85} z1={z} z2={z + 0.45} c="#eaf4fd" o={0.8} />
            <PanelX x={3} y1={1.15} y2={2.85} z1={z} z2={z + 0.45} c="#5f86ad" o={0.7} />
          </g>
        ))}
        {/* ticker band */}
        <PanelY y={3} x1={1} x2={3} z1={0.05} z2={0.4} c="#24304a" />
        <line
          x1={pt(1.05, 3, 0.22)[0]}
          y1={pt(1.05, 3, 0.22)[1]}
          x2={pt(2.95, 3, 0.22)[0]}
          y2={pt(2.95, 3, 0.22)[1]}
          stroke="#5ef0a4"
          strokeWidth={2.4}
          strokeDasharray="3 4"
          className="dio-ticker"
        />
        <Box x={1.6} y={1.6} z={6} w={0.8} d={0.8} h={0.35} c="#c9dcef" />
        <line
          x1={pt(2, 2, 6.35)[0]}
          y1={pt(2, 2, 6.35)[1]}
          x2={pt(2, 2, 7.6)[0]}
          y2={pt(2, 2, 7.6)[1]}
          stroke="#6b7a90"
          strokeWidth={1.4}
        />
        <circle cx={pt(2, 2, 7.6)[0]} cy={pt(2, 2, 7.6)[1]} r={2.6} fill="#ff6b5e" className="dio-blink" />
      </g>
    ),
  },
  {
    id: "risk",
    name: "Watchtower",
    color: "#f2a48f",
    anchor: [4.9, 1.6, 5.8],
    render: () => (
      <g>
        <GroundShadow x={4.4} y={1.1} w={1} d={1} h={3.4} />
        <Box x={4.4} y={1.1} w={1} d={1} h={3.4} c="#f2a48f" />
        {[0.8, 1.8, 2.8].map((z) => (
          <PanelY key={z} y={2.1} x1={4.75} x2={5.05} z1={z} z2={z + 0.4} c="#7a4a40" o={0.55} />
        ))}
        <Box x={4.15} y={0.85} z={3.4} w={1.5} d={1.5} h={0.85} c="#f7c1b0" />
        <PanelY y={2.35} x1={4.3} x2={5.5} z1={3.6} z2={4.05} c="#3d3550" o={0.7} />
        <PanelX x={5.65} y1={1} y2={2.2} z1={3.6} z2={4.05} c="#3d3550" o={0.6} />
        <Pyramid x={4.05} y={0.75} z={4.25} w={1.7} d={1.7} h={0.9} c="#d9715d" />
        <circle cx={pt(4.9, 1.6, 5.3)[0]} cy={pt(4.9, 1.6, 5.3)[1]} r={3.2} fill="#ffc94a" className="dio-beacon" />
      </g>
    ),
  },
  {
    id: "library",
    name: "Pattern Library",
    color: "#f3d98b",
    anchor: [2.3, 4.9, 2.9],
    render: () => (
      <g>
        <GroundShadow x={1} y={4.1} w={2.6} d={1.6} h={1.4} />
        <Box x={1} y={4.1} w={2.6} d={1.6} h={1.4} c="#f3d98b" />
        {[1.2, 1.75, 2.3, 2.85].map((x) => (
          <PanelY key={x} y={5.7} x1={x} x2={x + 0.32} z1={0.45} z2={1.05} c="#8c6a2e" o={0.45} />
        ))}
        <Gable x={0.9} y={4} z={1.4} w={2.8} d={1.8} h={0.9} c="#d9715d" />
      </g>
    ),
  },
  {
    id: "operations",
    name: "Ops Works",
    color: "#b9c7d6",
    anchor: [10, 2, 3.4],
    render: () => (
      <g>
        <GroundShadow x={8.5} y={1} w={3} d={2} h={1.5} />
        <Box x={10.9} y={1.2} w={0.45} d={0.45} h={3.4} c="#d98c6a" />
        <Box x={8.5} y={1} w={3} d={2} h={1.5} c="#b9c7d6" />
        {[8.5, 9.5, 10.5].map((x) => (
          <Gable key={x} x={x} y={1} z={1.5} w={1} d={2} h={0.65} c="#8fa3b8" axis="y" />
        ))}
        {[8.75, 9.55, 10.35, 11.05].map((x) => (
          <PanelY key={x} y={3} x1={x} x2={x + 0.4} z1={0.4} z2={1.05} c="#f6f9fc" o={0.75} />
        ))}
        <PanelX x={11.5} y1={1.6} y2={2.4} z1={0} z2={0.9} c="#4d5a69" o={0.7} />
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={pt(11.1, 1.4, 3.6)[0]}
            cy={pt(11.1, 1.4, 3.6)[1]}
            r={5}
            fill="#ffffff"
            className="dio-smoke"
            style={{ animationDelay: `${i * 1.1}s` }}
          />
        ))}
      </g>
    ),
  },
  {
    id: "processing",
    name: "Claims Mill",
    color: "#c6b6e8",
    anchor: [12.8, 2, 2.6],
    render: () => (
      <g>
        <GroundShadow x={12.1} y={1.2} w={1.5} d={1.6} h={1.3} />
        <Box x={12.1} y={1.2} w={1.5} d={1.6} h={1.3} c="#c6b6e8" />
        <Pyramid x={12} y={1.1} z={1.3} w={1.7} d={1.8} h={0.6} c="#9a84c9" />
        <PanelY y={2.8} x1={12.5} x2={13.1} z1={0} z2={0.8} c="#5b4a85" o={0.6} />
        {/* conveyor of claim crates */}
        <Box x={11.6} y={3.2} w={2} d={0.35} h={0.12} c="#7c7488" />
        <g className="dio-conveyor">
          <Box x={11.75} y={3.22} z={0.12} w={0.3} d={0.3} h={0.28} c="#f3d98b" />
          <Box x={12.45} y={3.22} z={0.12} w={0.3} d={0.3} h={0.28} c="#f2a48f" />
          <Box x={13.15} y={3.22} z={0.12} w={0.3} d={0.3} h={0.28} c="#9fd6c8" />
        </g>
      </g>
    ),
  },
  {
    id: "dashboards",
    name: "Observatory",
    color: "#cfd4f3",
    anchor: [10.5, 4.8, 3.2],
    render: () => (
      <g>
        <ellipse
          cx={pt(10.9, 4.8, 0)[0]}
          cy={pt(10.9, 4.8, 0)[1]}
          rx={1.25 * Math.SQRT2 * T}
          ry={0.62 * Math.SQRT2 * T}
          fill="#4b5a3a"
          opacity={0.18}
          filter="url(#dio-soft)"
        />
        <Cylinder cx={10.5} cy={4.8} r={1.1} h={1.2} c="#cfd4f3" />
        <Dome cx={10.5} cy={4.8} z={1.2} r={1.1} h={1.3} c="#eef0fb" />
      </g>
    ),
  },
  {
    id: "wealth",
    name: "Private Bank",
    color: "#efe3cf",
    anchor: [2.5, 9.5, 2.7],
    render: () => (
      <g>
        <GroundShadow x={0.9} y={8.4} w={3.2} d={2.2} h={1.6} />
        <Box x={0.9} y={8.4} w={3.2} d={2.2} h={0.25} c="#d9ccb5" />
        <Box x={1.1} y={8.6} z={0.25} w={2.8} d={1.6} h={1.2} c="#efe3cf" />
        {[1.25, 1.75, 2.25, 2.75, 3.25, 3.7].map((x) => (
          <Box key={x} x={x} y={10.2} z={0.25} w={0.16} d={0.16} h={1.2} c="#fbf6ec" />
        ))}
        <Box x={1} y={8.5} z={1.45} w={3} d={1.95} h={0.18} c="#e3d5bd" />
        <Gable x={1} y={8.5} z={1.63} w={3} d={1.95} h={0.6} c="#d8c39f" />
        <circle cx={pt(2.5, 10.45, 1.95)[0]} cy={pt(2.5, 10.45, 1.95)[1]} r={3} fill="#e7b742" />
      </g>
    ),
  },
  {
    id: "forms",
    name: "Post Office",
    color: "#9fd6c8",
    anchor: [5.2, 9.4, 2.6],
    render: () => (
      <g>
        <GroundShadow x={4.6} y={8.6} w={1.5} d={1.5} h={1.3} />
        <Box x={4.6} y={8.6} w={1.5} d={1.5} h={1.3} c="#9fd6c8" />
        <Box x={4.5} y={8.5} z={1.3} w={1.7} d={1.7} h={0.15} c="#7fbcae" />
        <PanelY y={10.1} x1={5.05} x2={5.6} z1={0} z2={0.75} c="#3f6d63" o={0.6} />
        <Box x={5.75} y={10.45} w={0.25} d={0.25} h={0.5} c="#e65c4f" />
        <line x1={pt(4.75, 8.75, 1.45)[0]} y1={pt(4.75, 8.75, 1.45)[1]} x2={pt(4.75, 8.75, 2.6)[0]} y2={pt(4.75, 8.75, 2.6)[1]} stroke="#6b7a90" strokeWidth={1.2} />
        <polygon
          points={poly([
            [4.75, 8.75, 2.6],
            [4.75, 9.45, 2.45],
            [4.75, 8.75, 2.25],
          ])}
          fill="#e65c4f"
          className="dio-flag"
        />
      </g>
    ),
  },
  {
    id: "pitch",
    name: "The Stage",
    color: "#f2b6c9",
    anchor: [2.6, 12.4, 2.5],
    render: () => (
      <g>
        <GroundShadow x={1.3} y={11.6} w={2.6} d={1.6} h={1.5} />
        <Box x={1.3} y={11.6} w={2.6} d={1.6} h={1.5} c="#f2b6c9" />
        <PanelY y={13.2} x1={1.7} x2={3.5} z1={0.95} z2={1.35} c="#3d2f45" />
        {[1.85, 2.15, 2.45, 2.75, 3.05, 3.35].map((x, i) => (
          <circle
            key={x}
            cx={pt(x, 13.2, 1.15)[0]}
            cy={pt(x, 13.2, 1.15)[1]}
            r={1.7}
            fill="#ffd66b"
            className="dio-bulb"
            style={{ animationDelay: `${(i % 3) * 0.3}s` }}
          />
        ))}
        <PanelY y={13.2} x1={2.3} x2={2.9} z1={0} z2={0.7} c="#8a3d58" o={0.7} />
        <Box x={1.2} y={11.5} z={1.5} w={2.8} d={1.8} h={0.2} c="#e48fae" />
      </g>
    ),
  },
  {
    id: "portfolio-analytics",
    name: "Analytics Lab",
    color: "#a9dcc0",
    anchor: [9.5, 9.5, 3.6],
    render: () => (
      <g>
        <GroundShadow x={8.5} y={8.5} w={2} d={2} h={1.6} />
        <Box x={8.5} y={8.5} w={2} d={2} h={1.6} c="#a9dcc0" />
        {[8.7, 9.3, 9.9].map((x) => (
          <PanelY key={x} y={10.5} x1={x} x2={x + 0.4} z1={0.5} z2={1.2} c="#f4fbf7" o={0.8} />
        ))}
        {[
          [8.8, 0.5, "#c7d0f5"],
          [9.35, 0.95, "#8f9ce6"],
          [9.9, 1.45, "#6273d6"],
        ].map(([x, h, c]) => (
          <Box key={x as number} x={x as number} y={9.2} z={1.6} w={0.4} d={0.4} h={h as number} c={c as string} />
        ))}
      </g>
    ),
  },
  {
    id: "patterns",
    name: "Workshop",
    color: "#f6c7a1",
    anchor: [12.2, 9.3, 2.9],
    render: () => (
      <g>
        <GroundShadow x={11.4} y={8.6} w={1.8} d={1.6} h={1.2} />
        <Box x={11.4} y={8.6} w={1.8} d={1.6} h={1.2} c="#f6c7a1" />
        <Gable x={11.3} y={8.5} z={1.2} w={2} d={1.8} h={0.75} c="#c98a6a" axis="y" />
        <PanelY y={10.2} x1={11.8} x2={12.6} z1={0} z2={0.8} c="#7a4f3a" o={0.55} />
        {/* stacked reusable blocks */}
        <Box x={13.5} y={10.5} w={0.45} d={0.45} h={0.45} c="#9cc3e6" />
        <Box x={13.5} y={10.5} z={0.45} w={0.45} d={0.45} h={0.45} c="#f3d98b" />
        <Box x={13.5} y={11} w={0.45} d={0.45} h={0.45} c="#f2b6c9" />
      </g>
    ),
  },
];

/* The street. Buildings are drawn in their own local coordinates above; each
 * is then slid into a lot on one long street with its front facade on the
 * kerb line. `fp` is the local footprint [minX, minY, width, frontY]. The
 * order tells a story: back office → markets → clients → craft. */

type Lot = { fp: [number, number, number, number]; style: string };

const LOTS: Record<string, Lot> = {
  operations: {
    fp: [8.5, 1, 3, 3],
    style: "Brick factory with a sawtooth roof — the engine room that keeps everything running.",
  },
  processing: {
    fp: [11.6, 1.1, 2.1, 3.55],
    style: "Mill with a conveyor of crates — claims go in one end and come out settled.",
  },
  risk: {
    fp: [4.05, 0.75, 1.7, 2.45],
    style: "Watchtower with a beacon — always scanning for breaches.",
  },
  trading: {
    fp: [1, 1, 2, 3],
    style: "Glass tower with a live ticker — the tallest, busiest building on the street.",
  },
  forms: {
    fp: [4.5, 8.5, 1.7, 10.7],
    style: "Post office with a mailbox — forms in, approvals out.",
  },
  "portfolio-analytics": {
    fp: [8.5, 8.5, 2, 10.5],
    style: "Lab with a bar chart on the roof — where performance gets measured.",
  },
  dashboards: {
    fp: [9.4, 3.7, 2.2, 5.9],
    style: "Observatory dome — the wide view over everything at once.",
  },
  wealth: {
    fp: [0.9, 8.4, 3.2, 10.6],
    style: "Classical bank with columns — old-money calm for client screens.",
  },
  library: {
    fp: [0.9, 4, 2.8, 5.8],
    style: "Library with a pitched roof — the shared reference everyone borrows from.",
  },
  patterns: {
    fp: [11.3, 8.5, 2.65, 10.95],
    style: "Workshop with stacked blocks — reusable parts get made here.",
  },
  pitch: {
    fp: [1.2, 11.5, 2.8, 13.3],
    style: "Theatre with marquee lights — where the story gets told.",
  },
};

const STREET_ORDER = [
  "operations",
  "processing",
  "risk",
  "trading",
  "forms",
  "portfolio-analytics",
  "dashboards",
  "wealth",
  "library",
  "patterns",
  "pitch",
];

const KERB = 3.2; // y of the building line
const GAP = 0.55;
const START = 1;

type Placed = District & { dx: number; dy: number; lotX: number; lotW: number };

const STREET: Placed[] = (() => {
  let cursor = START;
  return STREET_ORDER.map((id) => {
    const d = DISTRICTS.find((x) => x.id === id)!;
    const [ox, , w, front] = LOTS[id].fp;
    const placed = { ...d, dx: cursor - ox, dy: KERB - front, lotX: cursor, lotW: w };
    cursor += w + GAP;
    return placed;
  });
})();

const STREET_LEN = STREET[STREET.length - 1].lotX + STREET[STREET.length - 1].lotW + START;
const ISLAND_D = 6.8;
const ROAD: [number, number] = [4, 5.6];

// Front pavement props: alternating trees and street lamps.
const PROPS = Array.from({ length: Math.floor(STREET_LEN / 1.9) }, (_, i) => ({
  x: 1 + i * 1.9,
  kind: i % 2 === 0 ? ("tree" as const) : ("lamp" as const),
}));

function Lamp({ x, y }: { x: number; y: number }) {
  const [bx, by] = pt(x, y, 0);
  const [tx, ty] = pt(x, y, 1.5);
  return (
    <g>
      <line x1={bx} y1={by} x2={tx} y2={ty} stroke="#55526a" strokeWidth={1.4} />
      <circle cx={tx} cy={ty} r={6} fill="#ffe08a" opacity={0.35} />
      <circle cx={tx} cy={ty} r={2.4} fill="#ffd25a" />
    </g>
  );
}

/* ---------------- the scene ---------------- */

function Diorama({
  active,
  counts,
  setHover,
  onPick,
}: {
  active: string | null;
  counts: Map<string, number>;
  setHover: (id: string | null) => void;
  onPick: (id: string) => void;
}) {
  const activeDistrict = STREET.find((d) => d.id === active);
  const L = STREET_LEN;
  const D = ISLAND_D;
  const [shX, shY] = pt(L / 2, D / 2, 0);

  return (
    <svg
      viewBox="-190 -150 960 680"
      className="h-auto w-full select-none"
      role="img"
      aria-label="Isometric diorama of Absurd Alpha: each building is a district of screens"
    >
      <defs>
        <filter id="dio-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="dio-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <radialGradient id="dio-tree" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#bfe3a0" />
          <stop offset="0.6" stopColor="#86c06a" />
          <stop offset="1" stopColor="#5f9a4c" />
        </radialGradient>
        <radialGradient id="dio-dome" cx="0.3" cy="0.25" r="0.9">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#aab2e6" />
        </radialGradient>
        <linearGradient id="dio-water" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bfe6f5" />
          <stop offset="1" stopColor="#7cc4e4" />
        </linearGradient>
      </defs>

      {/* floating island shadow (stays put while the island bobs) */}
      {/* rotate on a wrapper: the CSS animation would override a transform attribute */}
      <g transform={`rotate(26.57 ${shX} ${shY + 90})`}>
        <ellipse
          cx={shX}
          cy={shY + 90}
          rx={L * T * 0.6}
          ry={40}
          fill="#6b6f9a"
          opacity={0.22}
          filter="url(#dio-shadow)"
          className="dio-shadow"
        />
      </g>

      <g className="dio-float">
        {/* island: soil block + grass lip */}
        <Box x={0} y={0} z={-1.6} w={L} d={D} h={1.3} c="#d8b48a" />
        <PanelY y={D} x1={0} x2={L} z1={-1.6} z2={-1.05} c="#b98f68" o={0.5} />
        <PanelX x={L} y1={0} y2={D} z1={-1.6} z2={-1.05} c="#8e6a4b" o={0.45} />
        <Box x={0} y={0} z={-0.3} w={L} d={D} h={0.3} c="#9fca80" />

        {/* pavements + road */}
        <polygon points={poly([[0, KERB, 0.01], [L, KERB, 0.01], [L, ROAD[0], 0.01], [0, ROAD[0], 0.01]])} fill="#f1ebdf" />
        <polygon points={poly([[0, ROAD[0], 0.01], [L, ROAD[0], 0.01], [L, ROAD[1], 0.01], [0, ROAD[1], 0.01]])} fill="#8d8aa3" />
        <polygon points={poly([[0, ROAD[1], 0.01], [L, ROAD[1], 0.01], [L, D - 0.3, 0.01], [0, D - 0.3, 0.01]])} fill="#f1ebdf" />
        <line
          x1={pt(0.2, (ROAD[0] + ROAD[1]) / 2, 0)[0]}
          y1={pt(0.2, (ROAD[0] + ROAD[1]) / 2, 0)[1]}
          x2={pt(L - 0.2, (ROAD[0] + ROAD[1]) / 2, 0)[0]}
          y2={pt(L - 0.2, (ROAD[0] + ROAD[1]) / 2, 0)[1]}
          stroke="#ffffff"
          strokeWidth={1.6}
          strokeDasharray="8 8"
        />
        <PanelY y={D} x1={0} x2={L} z1={-0.3} z2={0} c="#9fca80" />

        {/* buildings, back-left to front-right */}
        {STREET.map((d) => {
          const [tx, ty] = pt(d.dx, d.dy, 0);
          return (
            <g
              key={d.id}
              className="dio-building"
              data-dim={active && active !== d.id ? "" : undefined}
              data-lift={active === d.id ? "" : undefined}
              tabIndex={0}
              role="button"
              aria-label={`${d.name}: ${SECTIONS.find((s) => s.id === d.id)?.label ?? d.id}`}
              onMouseEnter={() => setHover(d.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(d.id)}
              onBlur={() => setHover(null)}
              onClick={() => onPick(d.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(d.id);
                }
              }}
            >
              <g transform={`translate(${tx},${ty})`}>{d.render()}</g>
            </g>
          );
        })}

        {/* cars: one each way */}
        <g>
          <Box x={-0.35} y={-0.22} w={0.7} d={0.44} h={0.34} c="#ff8a65" />
          <animateMotion
            dur="14s"
            repeatCount="indefinite"
            path={`M${pt(0.4, 4.4, 0).join(",")} L${pt(L - 0.4, 4.4, 0).join(",")}`}
          />
        </g>
        <g>
          <Box x={-0.35} y={-0.22} w={0.7} d={0.44} h={0.34} c="#6c8cff" />
          <animateMotion
            dur="18s"
            repeatCount="indefinite"
            path={`M${pt(L - 0.4, 5.15, 0).join(",")} L${pt(0.4, 5.15, 0).join(",")}`}
          />
        </g>

        {/* front pavement props */}
        {PROPS.map((p) =>
          p.kind === "tree" ? (
            <Tree key={p.x} x={p.x} y={6.1} s={0.8} />
          ) : (
            <Lamp key={p.x} x={p.x} y={5.95} />
          ),
        )}

        {/* floating label over the active building */}
        {activeDistrict && (
          <Label district={activeDistrict} count={counts.get(activeDistrict.id) ?? 0} />
        )}
      </g>

      {/* drifting clouds */}
      <g className="dio-cloud" opacity={0.9}>
        <ellipse cx={-230} cy={-150} rx={34} ry={13} fill="#ffffff" />
        <ellipse cx={-205} cy={-158} rx={24} ry={14} fill="#ffffff" />
      </g>
      <g className="dio-cloud dio-cloud-b" opacity={0.75}>
        <ellipse cx={200} cy={-110} rx={40} ry={14} fill="#ffffff" />
        <ellipse cx={228} cy={-120} rx={26} ry={15} fill="#ffffff" />
      </g>
    </svg>
  );
}

function Label({ district, count }: { district: Placed; count: number }) {
  const [ax, ay, az] = district.anchor;
  const [x, y] = pt(ax + district.dx, ay + district.dy, az);
  const text = `${district.name} · ${count}`;
  const w = text.length * 6.4 + 20;
  return (
    <g pointerEvents="none" transform={`translate(${x},${y - 18})`}>
      <line x1={0} y1={6} x2={0} y2={16} stroke="#1f1d2b" strokeWidth={1} />
      <rect x={-w / 2} y={-14} width={w} height={22} fill="#1f1d2b" />
      <text
        x={0}
        y={1}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="#ffffff"
        style={{ fontFamily: "inherit" }}
      >
        {text}
      </text>
    </g>
  );
}

/* ---------------- page ---------------- */

const SCENE_CSS = `
.dio-float { animation: dio-float 6s ease-in-out infinite; }
.dio-shadow { animation: dio-shadow 6s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
@keyframes dio-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes dio-shadow { 0%,100% { transform: scale(1); opacity: .22; } 50% { transform: scale(.94); opacity: .16; } }
.dio-building { cursor: pointer; outline: none; transition: transform .35s cubic-bezier(.2,.8,.2,1), opacity .25s ease; }
.dio-building[data-lift] { transform: translateY(-7px); }
.dio-building[data-dim] { opacity: .45; }
.dio-blink { animation: dio-blink 1.4s steps(2) infinite; }
@keyframes dio-blink { 50% { opacity: .15; } }
.dio-beacon { animation: dio-beacon 2.2s ease-in-out infinite; }
@keyframes dio-beacon { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
.dio-bulb { animation: dio-blink .9s steps(2) infinite; }
.dio-ticker { animation: dio-ticker 1s linear infinite; }
@keyframes dio-ticker { to { stroke-dashoffset: -14; } }
.dio-smoke { opacity: 0; transform-box: fill-box; transform-origin: center; animation: dio-smoke 3.3s ease-out infinite; }
@keyframes dio-smoke { 0% { opacity: .85; transform: translate(0,0) scale(.6); } 100% { opacity: 0; transform: translate(14px,-44px) scale(1.9); } }
.dio-conveyor { animation: dio-conveyor 3s linear infinite; }
@keyframes dio-conveyor { from { transform: translate(-6px,-3px); } to { transform: translate(10px,5px); } }
.dio-flag { transform-box: fill-box; transform-origin: left center; animation: dio-flag 1.6s ease-in-out infinite; }
@keyframes dio-flag { 50% { transform: scaleX(.8) skewY(4deg); } }
.dio-cloud { animation: dio-cloud 28s ease-in-out infinite alternate; }
.dio-cloud-b { animation-duration: 36s; }
@keyframes dio-cloud { to { transform: translateX(60px); } }
@media (prefers-reduced-motion: reduce) {
  .dio-float, .dio-shadow, .dio-blink, .dio-beacon, .dio-bulb, .dio-ticker, .dio-smoke,
  .dio-conveyor, .dio-flag, .dio-cloud { animation: none; }
  .dio-building { transition: none; }
}
`;

export default function HomeDiorama() {
  const [hover, setHover] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const pages = usePages();
  const active = hover ?? picked;

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pages) m.set(p.section, (m.get(p.section) ?? 0) + 1);
    return m;
  }, [pages]);

  const activeDistrict = DISTRICTS.find((d) => d.id === active) ?? null;
  const activeLabel = SECTIONS.find((s) => s.id === active)?.label;
  const activePages = active ? pages.filter((p) => p.section === active) : [];

  const goRandom = () => {
    const pool = pages.filter((p) => p.slug !== "gallery");
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) navigateToPage(pick.slug);
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden text-[#1f1d2b]"
      style={{
        background:
          "linear-gradient(180deg, #e9e6fb 0%, #f6efe6 55%, #fbf7f1 100%)",
      }}
    >
      <style>{SCENE_CSS}</style>

      {/* ---------- top bar ---------- */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <svg viewBox="-12 -14 24 26" className="h-7 w-7" aria-hidden>
            <polygon points="0,-12 11,-6 0,0 -11,-6" fill="#c7d0f5" />
            <polygon points="-11,-6 0,0 0,12 -11,6" fill="#8f9ce6" />
            <polygon points="11,-6 0,0 0,12 11,6" fill="#6273d6" />
          </svg>
          <span className="text-[15px] font-semibold tracking-tight">
            Absurd Alpha
          </span>
        </div>
        <nav className="hidden items-center gap-7 text-sm text-[#5b5870] md:flex">
          <button type="button" onClick={() => navigateToPage("gallery")} className="hover:text-[#1f1d2b]">
            Gallery
          </button>
          <button type="button" onClick={() => setPicked("dashboards")} className="hover:text-[#1f1d2b]">
            Dashboards
          </button>
          <button type="button" onClick={() => setPicked("library")} className="hover:text-[#1f1d2b]">
            Pattern library
          </button>
        </nav>
        <span className="border border-[#1f1d2b]/10 bg-white/60 px-3 py-1 text-xs font-medium text-[#5b5870] backdrop-blur">
          {pages.length} screens · {DISTRICTS.length} districts
        </span>
      </header>

      {/* ---------- hero ---------- */}
      <section className="relative mx-auto grid max-w-7xl items-end gap-8 px-4 pt-4 sm:px-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6273d6]">
            Capital markets UI · prototype street
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            One street.
            <br />
            Every trading-floor screen.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-[#5b5870]">
            Each building is a section, built to match what happens inside.
            Hover one to look in, then step into any screen.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigateToPage("gallery")}
              className="bg-[#1f1d2b] px-5 py-3 text-sm font-medium text-white shadow-[0_6px_0_#000000,0_14px_24px_-10px_rgba(31,29,43,.6)] transition active:translate-y-[4px] active:shadow-[0_2px_0_#000000]"
            >
              Open the gallery
            </button>
            <button
              type="button"
              onClick={goRandom}
              className="border border-[#1f1d2b]/15 bg-white/70 px-5 py-3 text-sm font-medium shadow-[0_6px_0_rgba(31,29,43,.12)] backdrop-blur transition active:translate-y-[4px] active:shadow-[0_2px_0_rgba(31,29,43,.12)]"
            >
              Take me somewhere random
            </button>
          </div>
        </div>

        {/* district inspector */}
        <div className="min-h-[232px] border border-[#1f1d2b]/10 bg-white/65 p-5 shadow-[0_18px_40px_-24px_rgba(60,50,110,.45)] backdrop-blur">
          {activeDistrict ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3" style={{ background: activeDistrict.color }} />
                  <span className="text-sm font-semibold">{activeDistrict.name}</span>
                  <span className="text-sm text-[#8a879c]">{activeLabel}</span>
                </div>
                <span className="text-xs tabular-nums text-[#8a879c]">
                  {activePages.length} screens
                </span>
              </div>
              <p className="mt-2 text-sm text-[#5b5870]">{LOTS[activeDistrict.id].style}</p>
              <ul className="mt-3 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                {activePages.slice(0, 6).map((p) => (
                  <li key={p.slug}>
                    <button
                      type="button"
                      onClick={() => navigateToPage(p.slug)}
                      className="w-full truncate py-1 text-left text-sm text-[#3b3950] hover:text-[#6273d6]"
                    >
                      {p.title}
                    </button>
                  </li>
                ))}
              </ul>
              {activePages.length > 6 && (
                <p className="mt-2 text-xs text-[#8a879c]">
                  +{activePages.length - 6} more in the gallery
                </p>
              )}
            </>
          ) : (
            <div className="flex h-full min-h-[190px] flex-col justify-center">
              <p className="text-sm font-semibold">Walk down the street</p>
              <p className="mt-1 text-sm text-[#8a879c]">
                Hover a building, or tap a district below. Its screens show up
                here.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ---------- the street ---------- */}
      <section className="relative mx-auto max-w-7xl px-2 sm:px-6">
        <Diorama
          active={active}
          counts={counts}
          setHover={setHover}
          onPick={(id) => setPicked((cur) => (cur === id ? null : id))}
        />
      </section>

      {/* ---------- district legend ---------- */}
      <section className="relative mx-auto max-w-7xl px-4 pb-14 sm:px-8">
        <div className="flex flex-wrap gap-2">
          {STREET.map((d) => {
            const on = active === d.id;
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={picked === d.id}
                onClick={() => setPicked(picked === d.id ? null : d.id)}
                onMouseEnter={() => setHover(d.id)}
                onMouseLeave={() => setHover(null)}
                className={`flex items-center gap-2 border px-3 py-2 text-xs font-medium transition ${
                  on
                    ? "border-[#1f1d2b] bg-[#1f1d2b] text-white"
                    : "border-[#1f1d2b]/10 bg-white/60 text-[#3b3950] backdrop-blur hover:bg-white"
                }`}
              >
                <span className="h-2.5 w-2.5" style={{ background: d.color }} />
                {SECTIONS.find((s) => s.id === d.id)?.label ?? d.name}
                <span className="tabular-nums opacity-60">{counts.get(d.id) ?? 0}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
