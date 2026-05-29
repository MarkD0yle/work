import type { BmType, PipelineState } from "./qlik";
import { effectiveState, type MonitorAction, type QlikMonitor } from "./qlik";

/* Pipeline filter row (spec §1).
 *
 * Seven dimensions, AND across, OR within multi-selects.
 *
 *   1. Client       — multi-select
 *   2. Mandate      — multi-select (mandate name)
 *   3. Option A/B   — independent checkboxes (stub semantics)
 *   4. BM Type      — multi-select
 *   5. Username     — multi-select (assignee)
 *   6. Process      — multi-select
 *   7. Status       — toggle: New | Pending | (neither = both)
 */

export type PipelineStatusFilter = "new" | "pending" | null;

export interface PipelineFilters {
  clients: string[];
  mandates: string[];
  bmTypes: BmType[];
  usernames: string[];
  processes: string[];
  optionA: boolean;
  optionB: boolean;
  status: PipelineStatusFilter;
}

export const EMPTY_FILTERS: PipelineFilters = {
  clients: [],
  mandates: [],
  bmTypes: [],
  usernames: [],
  processes: [],
  optionA: false,
  optionB: false,
  status: null,
};

export function hasAnyFilter(f: PipelineFilters): boolean {
  return (
    f.clients.length > 0 ||
    f.mandates.length > 0 ||
    f.bmTypes.length > 0 ||
    f.usernames.length > 0 ||
    f.processes.length > 0 ||
    f.optionA ||
    f.optionB ||
    f.status !== null
  );
}

export function filterCount(f: PipelineFilters): number {
  let n = 0;
  if (f.clients.length > 0) n += 1;
  if (f.mandates.length > 0) n += 1;
  if (f.bmTypes.length > 0) n += 1;
  if (f.usernames.length > 0) n += 1;
  if (f.processes.length > 0) n += 1;
  if (f.optionA) n += 1;
  if (f.optionB) n += 1;
  if (f.status !== null) n += 1;
  return n;
}

/* Status derivation — "New" = at least one active stage with no ack on its
 * monitor; "Pending" = at least one active stage with someone working on
 * it. A pipeline can technically be both; we pick the more urgent ("New"
 * wins) when computing display status, but for filter matching a pipeline
 * is considered "New" if it has any unacked, "Pending" if any acked. */
function pipelineStatus(
  p: PipelineState,
  monitors: QlikMonitor[],
  actions: MonitorAction[],
): { isNew: boolean; isPending: boolean } {
  const monitorById = new Map(monitors.map((m) => [m.id, m]));
  let isNew = false;
  let isPending = false;
  for (const s of p.stages) {
    const isActive =
      s.status === "past_typical" ||
      s.status === "past_required" ||
      s.status === "past_benchmark" ||
      s.status === "failed";
    if (!isActive) continue;
    for (const id of s.monitorIds) {
      const m = monitorById.get(id);
      if (!m) continue;
      const e = effectiveState(m, actions);
      if (e.kind === "unacked") isNew = true;
      else if (e.kind === "acked") isPending = true;
    }
  }
  return { isNew, isPending };
}

export function applyPipelineFilters(
  pipelines: PipelineState[],
  filters: PipelineFilters,
  monitors: QlikMonitor[],
  actions: MonitorAction[],
): PipelineState[] {
  return pipelines.filter((p) => {
    if (filters.clients.length > 0 && !filters.clients.includes(p.clientName)) {
      return false;
    }
    if (filters.mandates.length > 0 && !filters.mandates.includes(p.groupName)) {
      return false;
    }
    if (filters.bmTypes.length > 0) {
      if (!p.bmType || !filters.bmTypes.includes(p.bmType)) return false;
    }
    if (filters.usernames.length > 0) {
      if (!p.assignee || !filters.usernames.includes(p.assignee)) return false;
    }
    if (filters.processes.length > 0) {
      if (!p.process || !filters.processes.includes(p.process)) return false;
    }
    if (filters.optionA && !p.optionA) return false;
    if (filters.optionB && !p.optionB) return false;
    if (filters.status !== null) {
      const { isNew, isPending } = pipelineStatus(p, monitors, actions);
      if (filters.status === "new" && !isNew) return false;
      if (filters.status === "pending" && !isPending) return false;
    }
    return true;
  });
}

/* Spec §3.6 — dropdown options come from visible-pipelines data, not the
 * universe. Honest about what's filterable right now. */
export function deriveFilterOptions(pipelines: PipelineState[]) {
  const clients = new Set<string>();
  const mandates = new Set<string>();
  const bmTypes = new Set<BmType>();
  const usernames = new Set<string>();
  const processes = new Set<string>();
  for (const p of pipelines) {
    clients.add(p.clientName);
    mandates.add(p.groupName);
    if (p.bmType) bmTypes.add(p.bmType);
    if (p.assignee) usernames.add(p.assignee);
    if (p.process) processes.add(p.process);
  }
  return {
    clients: Array.from(clients).sort(),
    mandates: Array.from(mandates).sort(),
    bmTypes: Array.from(bmTypes).sort(),
    usernames: Array.from(usernames).sort(),
    processes: Array.from(processes).sort(),
  };
}

/* Spec §3.5 — when filters return zero rows, suggest the most-restrictive
 * filter to remove. "Most restrictive" = removing it adds the most rows. */
export function suggestRemoval(
  pipelines: PipelineState[],
  filters: PipelineFilters,
  monitors: QlikMonitor[],
  actions: MonitorAction[],
): keyof PipelineFilters | null {
  if (!hasAnyFilter(filters)) return null;
  const keys: (keyof PipelineFilters)[] = [
    "clients",
    "mandates",
    "bmTypes",
    "usernames",
    "processes",
    "optionA",
    "optionB",
    "status",
  ];
  let best: { key: keyof PipelineFilters; count: number } | null = null;
  for (const key of keys) {
    // Skip filters that aren't active
    const v = filters[key];
    const isActive =
      (Array.isArray(v) && v.length > 0) ||
      (typeof v === "boolean" && v) ||
      v === "new" ||
      v === "pending";
    if (!isActive) continue;
    const without: PipelineFilters = {
      ...filters,
      ...(Array.isArray(v) ? { [key]: [] } : {}),
      ...(typeof v === "boolean" ? { [key]: false } : {}),
      ...(v === "new" || v === "pending" ? { [key]: null } : {}),
    };
    const count = applyPipelineFilters(pipelines, without, monitors, actions).length;
    if (best == null || count > best.count) best = { key, count };
  }
  return best?.key ?? null;
}

/* Human label per filter key, for status line + empty-state suggestions. */
export const FILTER_LABEL: Record<keyof PipelineFilters, string> = {
  clients: "Client",
  mandates: "Mandate",
  bmTypes: "BM Type",
  usernames: "Username",
  processes: "Process",
  optionA: "Option A",
  optionB: "Option B",
  status: "Status",
};

/* URL param sync (spec §3.2). Format:
 *   ?pipeline=client:cohen,ishares;mandate:capstock;bmtype:daily-nav;status:new
 * Round-trippable.  Slug-encode values so multi-word names survive.
 */

const URL_PARAM = "pipeline";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const SECTION_KEYS = ["client", "mandate", "bmtype", "user", "process"] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

function sectionForFilterKey(k: keyof PipelineFilters): SectionKey | null {
  switch (k) {
    case "clients":
      return "client";
    case "mandates":
      return "mandate";
    case "bmTypes":
      return "bmtype";
    case "usernames":
      return "user";
    case "processes":
      return "process";
    default:
      return null;
  }
}

export function readUrlFilters(allPipelines: PipelineState[]): PipelineFilters {
  if (typeof window === "undefined") return EMPTY_FILTERS;
  const raw = new URLSearchParams(window.location.search).get(URL_PARAM);
  if (!raw) return EMPTY_FILTERS;
  // Build slug → value maps for each dimension so we can decode round-trip.
  const lookup: Record<SectionKey, Map<string, string>> = {
    client: new Map(),
    mandate: new Map(),
    bmtype: new Map(),
    user: new Map(),
    process: new Map(),
  };
  for (const p of allPipelines) {
    lookup.client.set(slug(p.clientName), p.clientName);
    lookup.mandate.set(slug(p.groupName), p.groupName);
    if (p.bmType) lookup.bmtype.set(slug(p.bmType), p.bmType);
    if (p.assignee) lookup.user.set(slug(p.assignee), p.assignee);
    if (p.process) lookup.process.set(slug(p.process), p.process);
  }
  const f: PipelineFilters = { ...EMPTY_FILTERS };
  for (const part of raw.split(";")) {
    const [key, valueStr] = part.split(":");
    if (!key || !valueStr) continue;
    const values = valueStr.split(",").filter(Boolean);
    if (key === "client") f.clients = values.map((v) => lookup.client.get(v) ?? v);
    else if (key === "mandate")
      f.mandates = values.map((v) => lookup.mandate.get(v) ?? v);
    else if (key === "bmtype")
      f.bmTypes = values
        .map((v) => lookup.bmtype.get(v) ?? v)
        .filter((v): v is BmType => !!v) as BmType[];
    else if (key === "user") f.usernames = values.map((v) => lookup.user.get(v) ?? v);
    else if (key === "process")
      f.processes = values.map((v) => lookup.process.get(v) ?? v);
    else if (key === "optionA") f.optionA = valueStr === "1";
    else if (key === "optionB") f.optionB = valueStr === "1";
    else if (key === "status")
      f.status = valueStr === "new" ? "new" : valueStr === "pending" ? "pending" : null;
  }
  return f;
}

export function writeUrlFilters(f: PipelineFilters) {
  if (typeof window === "undefined") return;
  const parts: string[] = [];
  const push = (key: string, values: string[]) => {
    if (values.length === 0) return;
    parts.push(`${key}:${values.map(slug).join(",")}`);
  };
  push("client", f.clients);
  push("mandate", f.mandates);
  push("bmtype", f.bmTypes as string[]);
  push("user", f.usernames);
  push("process", f.processes);
  if (f.optionA) parts.push("optionA:1");
  if (f.optionB) parts.push("optionB:1");
  if (f.status) parts.push(`status:${f.status}`);
  const url = new URL(window.location.href);
  if (parts.length === 0) url.searchParams.delete(URL_PARAM);
  else url.searchParams.set(URL_PARAM, parts.join(";"));
  window.history.replaceState({}, "", url.toString());
}
