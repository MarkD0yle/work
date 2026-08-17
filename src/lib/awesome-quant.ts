/* Awesome Quant — charting & front-end subset.
 *
 * Derived from the community list at
 * https://github.com/wilsonfreitas/awesome-quant (MIT / CC0), then narrowed to
 * the entries that render something in a browser: financial charting libraries
 * and the front-end apps/tools built on them. The Python/R/Julia analytics bulk
 * of the upstream list is deliberately not mirrored here.
 *
 * The full 683-entry catalogue is still in git history (commit 5e18c9f) if the
 * wider list is ever wanted again.
 */

/** A sub-entry: a language port, add-on or sibling package of a resource. */
export type QuantResourceChild = {
  name: string;
  /** Null for entries the upstream list mentions without a canonical link. */
  url: string | null;
  description: string;
};

export type QuantResource = {
  name: string;
  url: string;
  /** Source repo, when the primary link points at docs or a homepage instead. */
  repo?: string;
  /** Language / interface tags, e.g. "TypeScript", "JavaScript". */
  tags: string[];
  description: string;
  /** Upstream flags the project as no longer maintained. */
  archived?: boolean;
  children?: QuantResourceChild[];
};

export type QuantCategory = {
  name: string;
  entries: QuantResource[];
};

export const AWESOME_QUANT_URL =
  "https://github.com/wilsonfreitas/awesome-quant";

/** Date the catalogue below was last mirrored from upstream. */
export const AWESOME_QUANT_SYNCED = "2026-08-17";

export const AWESOME_QUANT: QuantCategory[] = [
  {
    name: "Charting Libraries",
    entries: [
      {
        name: "dxcharts-lite",
        url: "https://github.com/devexperts/dxcharts-lite",
        repo: "https://github.com/devexperts/dxcharts-lite",
        tags: ["JavaScript"],
        description:
          "Flexible financial charting library based on HTML5 canvas.",
      },
      {
        name: "Exeria Charts",
        url: "https://github.com/efixdata/exeria-charts",
        repo: "https://github.com/efixdata/exeria-charts",
        tags: ["JavaScript"],
        description:
          "High-performance, native Canvas/WebGL financial charting library for self-hosted applications without iframe limits.",
      },
      {
        name: "QUANTAXIS_Webkit",
        url: "https://github.com/yutiansut/QUANTAXIS_Webkit",
        repo: "https://github.com/yutiansut/QUANTAXIS_Webkit",
        tags: ["JavaScript"],
        description:
          "An awesome visualization center based on quantaxis.",
      },
      {
        name: "PineTS",
        url: "https://github.com/LuxAlgo/PineTS",
        repo: "https://github.com/LuxAlgo/PineTS",
        tags: ["TypeScript", "JavaScript", "Pine Script"],
        description:
          "Open-source transpiler and runtime that executes Pine Script logic in Node.js and the browser with 1:1 syntax compatibility, for running indicators and strategies on your own infrastructure.",
      },
    ],
  },
  {
    name: "Front-End Apps & Tools",
    entries: [
      {
        name: "Ghostfolio",
        url: "https://github.com/ghostfolio/ghostfolio",
        repo: "https://github.com/ghostfolio/ghostfolio",
        tags: ["JavaScript"],
        description:
          "Wealth management software to keep track of financial assets like stocks, ETFs or cryptocurrencies and make solid, data-driven investment decisions.",
      },
      {
        name: "rebalance",
        url: "https://github.com/cjroth/rebalance",
        repo: "https://github.com/cjroth/rebalance",
        tags: ["JavaScript"],
        description:
          "Interactive portfolio rebalancing tool that imports brokerage CSV data, sets target allocations, and generates trade instructions.",
      },
      {
        name: "DepthSight",
        url: "https://github.com/depthsight-pro/depthsight",
        repo: "https://github.com/depthsight-pro/depthsight",
        tags: ["Python", "TypeScript"],
        description:
          "Self-hosted visual algo-trading platform featuring a drag-and-drop strategy builder, an AI co-pilot, and integrated billing.",
      },
      {
        name: "Finterm",
        url: "https://finterm.xyz",
        tags: ["TypeScript"],
        description:
          "Browser-based, keyboard-first financial terminal. No public GitHub repo (closed source).",
      },
    ],
  },
];

/** Every resource, flattened, with its category attached. */
export const ALL_RESOURCES: (QuantResource & { category: string })[] =
  AWESOME_QUANT.flatMap((cat) =>
    cat.entries.map((entry) => ({ ...entry, category: cat.name })),
  );

/** Tag → number of resources carrying it, most common first. */
export const TAG_COUNTS: [string, number][] = (() => {
  const counts = new Map<string, number>();
  for (const resource of ALL_RESOURCES) {
    for (const tag of resource.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
})();

/** Tags common enough to earn a filter chip; the rest live behind search.
 * Threshold is 2 rather than the upstream 5 — this list is small enough that a
 * count of 5 would leave no chips at all. */
export const PRIMARY_TAGS: string[] = TAG_COUNTS.filter(
  ([, count]) => count >= 2,
).map(([tag]) => tag);
