/* Fund distribution — cobrand channel terms.
 *
 * A cobrand is a distribution channel (white-label platform, partner
 * programme) the ETF is offered through. Each carries its own dealing
 * terms: how many minutes before the fund's own cut-off its creation and
 * redemption orders close, and how widely it may distribute the fund.
 *
 * The list is stored in one form field (`cobrands`) as a compact,
 * human-readable string — `WL1 c-30 r-30 all; AIS c0 r0 none` — so the
 * audit trail and delta review show a legible diff instead of JSON.
 */

export const COBRAND_CODES = ["HCBRAND", "LMB", "SGA", "VOLT", "WL1", "AIS", "APX"];

export type CobrandScope = "none" | "all";

export type CobrandEntry = {
  code: string;
  /** Creation cut-off offset in minutes relative to the fund cut-off. */
  creation: string;
  /** Redemption cut-off offset in minutes relative to the fund cut-off. */
  redemption: string;
  /** Country distribution: no restriction set, or all institutions. */
  scope: CobrandScope;
};

const ENTRY = /^(\S+) c(-?\d+) r(-?\d+) (none|all)$/;

export function parseCobrands(raw: string | undefined): CobrandEntry[] {
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const m = part.match(ENTRY);
      if (!m) return [];
      return [{ code: m[1], creation: m[2], redemption: m[3], scope: m[4] as CobrandScope }];
    });
}

export function serialiseCobrands(entries: CobrandEntry[]): string {
  return entries
    .map((e) => `${e.code} c${e.creation || "0"} r${e.redemption || "0"} ${e.scope}`)
    .join("; ");
}

/** One line for the condensed section row: "2 cobrands · WL1, AIS". */
export function summariseCobrands(raw: string | undefined): string {
  const entries = parseCobrands(raw);
  if (entries.length === 0) return "Not offered through any cobrand yet";
  return `${entries.length} cobrand${entries.length === 1 ? "" : "s"} · ${entries
    .map((e) => e.code)
    .join(", ")}`;
}
