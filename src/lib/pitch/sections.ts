import type { InternalData, SectionId } from "./types";
import { fmtMoney, fmtPct } from "./data";

/* Section definitions for the pitch. Each section auto-drafts from the
 * gathered internal data — deliberately a realistic "first pass": on-topic
 * and addressed to the client, but light on hard numbers and (for Risks)
 * missing the mandatory disclosures. That's the gap the AI review exists to
 * catch, and "Improve with AI" exists to close. */

export type SectionDef = {
  id: SectionId;
  label: string;
  help: string;
  minWords: number;
};

export const SECTION_DEFS: SectionDef[] = [
  { id: "situation", label: "Client situation", help: "Where they are today and what they've told us they want.", minWords: 25 },
  { id: "market", label: "Market context", help: "Why now — tie current conditions to this client's position.", minWords: 20 },
  { id: "recommendation", label: "Recommendation", help: "The specific product(s) and the reasoning.", minWords: 25 },
  { id: "impact", label: "Portfolio impact", help: "What changes, in numbers, if they say yes.", minWords: 20 },
  { id: "risks", label: "Risks & fees", help: "Mandatory disclosures — never optional.", minWords: 20 },
  { id: "close", label: "Next steps", help: "A specific, concrete call to action.", minWords: 12 },
];

function goalFragment(goal: string): string {
  const words = goal.split(" ");
  return words.slice(0, 6).join(" ");
}

// The pitch objective is deliberately not woven into the auto-draft: leaving
// it out lets the AI review's "ties to objective" check genuinely fail on a
// fresh draft, same as a real first-pass would — see review.ts.
export function autoDraft(id: SectionId, data: InternalData): string {
  const { client, recommendedProducts, marketNotes } = data;
  const name = client.name;

  switch (id) {
    case "situation":
      return (
        `${name} has been with us for ${client.tenureYears} year${client.tenureYears === 1 ? "" : "s"}, ` +
        `and the relationship notes point to one clear priority: ${goalFragment(client.primaryGoal)}. ` +
        `The current allocation has drifted from target in a few places, which is worth walking through together before we talk about any changes.`
      );
    case "market": {
      const note = marketNotes[0];
      return `${note.headline} — ${note.detail} Worth mentioning to ${name} on the call.`;
    }
    case "recommendation": {
      const top = recommendedProducts[0];
      return (
        `Given ${name}'s risk profile and stated goal, we think it's time to introduce ${top ? top.name : "a new allocation"} ` +
        `alongside the existing mandate. It fits the risk band we've already agreed and addresses the gap flagged in the last review.`
      );
    }
    case "impact":
      return (
        `Making this change shifts the portfolio closer to target and should reduce the drag we've been discussing. ` +
        `${name} will see the allocation move in the direction we agreed at the last review, without changing the overall risk stance.`
      );
    case "risks":
      return (
        `As with any change, ${name} should go in with eyes open about what could go differently than planned, and what it costs to make the change.`
      );
    case "close":
      return `Let's get ${name}'s thoughts on this and go from there.`;
    default:
      return "";
  }
}

/* A handful of source facts to surface next to the editor so the rep (and
 * the reviewer) can see exactly what's available to draw on. */
export function sourceHighlights(id: SectionId, data: InternalData): { label: string; value: string }[] {
  const { client, portfolio, recommendedProducts, marketNotes, complianceFlags } = data;
  switch (id) {
    case "situation":
      return [
        { label: "AUM", value: fmtMoney(client.aum) },
        { label: "Primary goal", value: client.primaryGoal },
        { label: "Tenure", value: `${client.tenureYears} yr` },
        ...(portfolio.concentrationFlags[0] ? [{ label: "Flag", value: portfolio.concentrationFlags[0] }] : []),
      ];
    case "market":
      return marketNotes.slice(0, 2).map((m) => ({ label: m.headline, value: m.detail }));
    case "recommendation":
      return recommendedProducts.map((p) => ({
        label: p.name,
        value: `${p.category} · ${p.feeBps}bps · min ${fmtMoney(p.minInvestment)}`,
      }));
    case "impact":
      return portfolio.allocation
        .filter((a) => Math.abs(a.currentPct - a.targetPct) >= 3)
        .map((a) => ({
          label: a.assetClass,
          value: `${fmtPct(a.currentPct)} → target ${fmtPct(a.targetPct)}`,
        }));
    case "risks":
      return [
        { label: "Recommended product fees", value: recommendedProducts.map((p) => `${p.name} ${p.feeBps}bps`).join(" · ") || "—" },
        ...complianceFlags.map((f) => ({ label: "Compliance flag", value: f })),
      ];
    case "close":
      return [
        { label: "Advisor", value: client.advisor },
        { label: "Last contact", value: client.lastContact },
      ];
    default:
      return [];
  }
}

export function emptySections(): Record<SectionId, { id: SectionId; content: string; status: "empty"; review: null; aiPasses: number }> {
  const out = {} as Record<SectionId, { id: SectionId; content: string; status: "empty"; review: null; aiPasses: number }>;
  for (const def of SECTION_DEFS) {
    out[def.id] = { id: def.id, content: "", status: "empty", review: null, aiPasses: 0 };
  }
  return out;
}
