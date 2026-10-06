/* Order-config demo model — shared by every container variant so the only
 * thing that changes between them is where the form lives. Fields are
 * placeholders; swap them here and every variant follows. */

export const LABELS = Array.from({ length: 10 }, (_, i) => `Label ${i + 1}`);

export type CreationMode = "manual" | "scheduled" | "api";
export type RedemptionMode = "immediate" | "delayed" | "window";
export type LimitMode = "unlimited" | "limited";
export type Frequency = "daily" | "weekly" | "monthly";

export type OrderConfig = {
  id: string;
  label: string;
  // Basic info
  name: string;
  description: string;
  status: "active" | "inactive";
  // Order creation
  creation: CreationMode;
  frequency: Frequency;
  time: string;
  endpoint: string;
  // Order redemption settings
  redemption: RedemptionMode;
  delayDays: string;
  windowStart: string;
  windowEnd: string;
  limit: LimitMode;
  limitCount: string;
};

export type Errors = Partial<Record<keyof OrderConfig, string>>;

export type SectionId = "basic" | "creation" | "redemption";

export const SECTION_META: {
  id: SectionId;
  title: string;
  description: string;
}[] = [
  { id: "basic", title: "Basic info", description: "Name and status." },
  { id: "creation", title: "Order creation", description: "How orders are created." },
  {
    id: "redemption",
    title: "Order redemption settings",
    description: "When and how often orders can be redeemed.",
  },
];

/* Which section each field lives in — lets a container flag sections that
 * hold errors (e.g. collapsed sub-sections in the inline variant). */
export const FIELD_SECTION: Partial<Record<keyof OrderConfig, SectionId>> = {
  name: "basic",
  endpoint: "creation",
  time: "creation",
  delayDays: "redemption",
  windowStart: "redemption",
  windowEnd: "redemption",
  limitCount: "redemption",
};

let counter = 0;

export function makeDraft(label: string): OrderConfig {
  counter += 1;
  return {
    id: `oc-${Date.now()}-${counter}`,
    label,
    name: "",
    description: "",
    status: "active",
    creation: "manual",
    frequency: "weekly",
    time: "09:00",
    endpoint: "",
    redemption: "immediate",
    delayDays: "",
    windowStart: "",
    windowEnd: "",
    limit: "unlimited",
    limitCount: "",
  };
}

export function validate(c: OrderConfig): Errors {
  const e: Errors = {};
  if (!c.name.trim()) e.name = "Enter a name.";
  if (c.creation === "scheduled" && !c.time) e.time = "Pick a time.";
  if (c.creation === "api" && !c.endpoint.trim()) e.endpoint = "Enter an endpoint URL.";
  if (c.redemption === "delayed" && !(Number(c.delayDays) > 0))
    e.delayDays = "Enter a number of days.";
  if (c.redemption === "window") {
    if (!c.windowStart) e.windowStart = "Pick a start date.";
    if (!c.windowEnd) e.windowEnd = "Pick an end date.";
    else if (c.windowStart && c.windowEnd < c.windowStart)
      e.windowEnd = "End must be after start.";
  }
  if (c.limit === "limited" && !(Number(c.limitCount) > 0))
    e.limitCount = "Enter a limit.";
  return e;
}

export function sectionsWithErrors(errors: Errors): Set<SectionId> {
  const out = new Set<SectionId>();
  for (const key of Object.keys(errors) as (keyof OrderConfig)[]) {
    const s = FIELD_SECTION[key];
    if (s) out.add(s);
  }
  return out;
}

export function creationSummary(c: OrderConfig): string {
  if (c.creation === "manual") return "Manual";
  if (c.creation === "api") return "API";
  const f = c.frequency[0].toUpperCase() + c.frequency.slice(1);
  return `${f} · ${c.time}`;
}

export function redemptionSummary(c: OrderConfig): string {
  const base =
    c.redemption === "immediate"
      ? "Immediate"
      : c.redemption === "delayed"
        ? `After ${c.delayDays || "?"} days`
        : `${c.windowStart || "?"} → ${c.windowEnd || "?"}`;
  return c.limit === "limited" ? `${base} · max ${c.limitCount || "?"}` : base;
}

export type Group = { id: string; title: string };

export const GROUPS: Group[] = [
  { id: "retail", title: "Retail orders" },
  { id: "wholesale", title: "Wholesale orders" },
  { id: "partner", title: "Partner orders" },
];
