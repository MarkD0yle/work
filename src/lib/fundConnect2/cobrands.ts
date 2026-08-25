/* Fund distribution — cobrand channel terms.
 *
 * A cobrand is a distribution channel (white-label platform, partner
 * programme) the ETF is offered through. Each carries its own dealing
 * terms: how many minutes before the fund's own cut-off its creation and
 * redemption orders close, and where it may distribute the fund — nowhere
 * restricted, all institutions, or a picked set of countries.
 *
 * The list is stored in one form field (`cobrands`) as a compact,
 * human-readable string — `WL1 c-30 r-30 all; SGA c-45 r-60 GB,IE,LU` —
 * so the audit trail and delta review show a legible diff instead of JSON.
 */

export const COBRAND_CODES = ["HCBRAND", "LMB", "SGA", "VOLT", "WL1", "AIS", "APX"];

/** Markets a cobrand can be scoped to. ISO 3166 alpha-2. */
export const COUNTRY_CODES = [
  "GB", "IE", "LU", "DE", "FR", "NL", "CH", "IT", "ES", "SE", "DK",
  "US", "CA", "SG", "HK", "JP", "AU",
];

export type CobrandScope = "none" | "all" | "countries";

export type CobrandEntry = {
  code: string;
  /** Creation cut-off offset in minutes relative to the fund cut-off. */
  creation: string;
  /** Redemption cut-off offset in minutes relative to the fund cut-off. */
  redemption: string;
  /** Country distribution: unrestricted-none, all institutions, or a set. */
  scope: CobrandScope;
  /** Selected markets — only meaningful when scope is "countries". */
  countries: string[];
};

const ENTRY = /^(\S+) c(-?\d+) r(-?\d+) (\S+)$/;

export function parseCobrands(raw: string | undefined): CobrandEntry[] {
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const m = part.match(ENTRY);
      if (!m) return [];
      const token = m[4];
      const scope: CobrandScope = token === "none" ? "none" : token === "all" ? "all" : "countries";
      return [
        {
          code: m[1],
          creation: m[2],
          redemption: m[3],
          scope,
          // "ctry" marks a country scope with nothing picked yet.
          countries:
            scope === "countries" && token !== "ctry" ? token.split(",").filter(Boolean) : [],
        },
      ];
    });
}

export function serialiseCobrands(entries: CobrandEntry[]): string {
  return entries
    .map((e) => {
      const scope =
        e.scope === "countries"
          ? e.countries.length
            ? e.countries.join(",")
            : "ctry" // country scope chosen, markets still to pick
          : e.scope;
      return `${e.code} c${e.creation || "0"} r${e.redemption || "0"} ${scope}`;
    })
    .join("; ");
}

/** One line for the condensed section row: "2 cobrands · WL1, SGA". */
export function summariseCobrands(raw: string | undefined): string {
  const entries = parseCobrands(raw);
  if (entries.length === 0) return "Not offered through any cobrand yet";
  return `${entries.length} cobrand${entries.length === 1 ? "" : "s"} · ${entries
    .map((e) => e.code)
    .join(", ")}`;
}
