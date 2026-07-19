import type { InternalData, ReviewBand, ReviewCheck, SectionId, SectionReview } from "./types";
import { fmtMoney, fmtPct } from "./data";

/* The "AI reviewer" — a deterministic, rule-based critique engine standing
 * in for an LLM call (this app has no backend / model access). It grades
 * each section against three concrete checks, exactly like the arrangement
 * rubric this repo already uses for screens (rubric/composition-rubric.md):
 * 3/3 → High·5, 2/3 → Mid·3, 0-1 → Low·1. Every check is a yes/no fact about
 * the text, not a vibe — so "Improve with AI" can close the gap precisely. */

function firstName(name: string): string {
  return name.split(" ")[0];
}

function has(content: string, needle: string): boolean {
  return content.toLowerCase().includes(needle.toLowerCase());
}

function hasAny(content: string, needles: string[]): boolean {
  return needles.some((n) => has(content, n));
}

function countAny(content: string, needles: string[]): number {
  return needles.filter((n) => has(content, n)).length;
}

function driftedLines(data: InternalData) {
  return data.portfolio.allocation.filter((a) => Math.abs(a.currentPct - a.targetPct) >= 3);
}

function goalFragment(goal: string): string {
  return goal.split(" ").slice(0, 6).join(" ");
}

const CTA_WORDS = ["schedule", "call", "meeting", "sign", "proceed", "confirm", "follow up", "next step"];
const TIMING_WORDS = ["this week", "next week", "monday", "tuesday", "wednesday", "thursday", "friday", "by end of", "tomorrow"];
const DISCLOSURE_WORDS = ["risk", "fee", "past performance", "capital"];
const LINKAGE_WORDS = ["portfolio", "allocation", "risk profile", "timing"];
const FLAG_WORDS = ["concentration", "liquidity", "suitability"];

export function getChecks(
  id: SectionId,
  content: string,
  data: InternalData,
  objective: string,
): ReviewCheck[] {
  const { client, portfolio, recommendedProducts, marketNotes, complianceFlags } = data;
  const name = client.name;

  const personalized: ReviewCheck = {
    label: "Personalized",
    pass: has(content, name) || has(content, firstName(name)),
    note: `Names ${name} directly rather than reading as boilerplate.`,
  };

  switch (id) {
    case "situation": {
      const drifted = driftedLines(data);
      const grounded = has(content, fmtMoney(client.aum)) || drifted.some((a) => has(content, fmtPct(a.currentPct)));
      const namesGoal = has(content, goalFragment(client.primaryGoal));
      return [
        personalized,
        {
          label: "Data-grounded",
          pass: grounded,
          note: `Cites a concrete figure — AUM (${fmtMoney(client.aum)}) or a drifted allocation %.`,
        },
        {
          label: "Names the goal",
          pass: namesGoal,
          note: `States the client's actual stated priority, not a generic one.`,
        },
      ];
    }
    case "market": {
      const note = marketNotes[0];
      const tiesToView = has(content, note.headline);
      const explainsRelevance = hasAny(content, LINKAGE_WORDS);
      return [
        personalized,
        {
          label: "Ties to a market view",
          pass: tiesToView,
          note: `References a specific, current market note rather than vague "markets are moving" language.`,
        },
        {
          label: "Explains relevance",
          pass: explainsRelevance,
          note: `Connects the market view back to this client's portfolio or risk profile — the "so what."`,
        },
      ];
    }
    case "recommendation": {
      const namesProduct = recommendedProducts.some((p) => has(content, p.name));
      const grounded = recommendedProducts.some(
        (p) => has(content, `${p.feeBps}bps`) || has(content, fmtMoney(p.minInvestment)),
      );
      return [
        personalized,
        {
          label: "Names a specific product",
          pass: namesProduct,
          note: `Names one of the actual recommended products, not "a new allocation."`,
        },
        {
          label: "Data-grounded reasoning",
          pass: grounded,
          note: `States the product's fee or minimum so the client can weigh the ask.`,
        },
      ];
    }
    case "impact": {
      const drifted = driftedLines(data);
      const lines = drifted.length ? drifted : portfolio.allocation;
      const quantifies = lines.some((a) => has(content, fmtPct(a.currentPct)) || has(content, fmtPct(a.targetPct)));
      const goalText = objective.trim() || client.primaryGoal;
      const tiesToObjective = has(content, goalFragment(goalText));
      return [
        personalized,
        {
          label: "Quantifies the change",
          pass: quantifies,
          note: `States the before/after allocation numbers, not just "moves closer to target."`,
        },
        {
          label: "Ties to the objective",
          pass: tiesToObjective,
          note: `Connects the number back to the stated objective for this pitch.`,
        },
      ];
    }
    case "risks": {
      const discloses = countAny(content, DISCLOSURE_WORDS) >= 2;
      const flagsKnown = complianceFlags.length === 0 || hasAny(content, FLAG_WORDS);
      return [
        personalized,
        {
          label: "Mandatory disclosures",
          pass: discloses,
          note: `Covers at least two of: risk of loss, fees, past performance, capital at risk.`,
        },
        {
          label: "Flags known issues",
          pass: flagsKnown,
          note:
            complianceFlags.length === 0
              ? "No open compliance flags on file for this client."
              : `Surfaces the open compliance flag(s) on file rather than staying silent on them.`,
        },
      ];
    }
    case "close": {
      const cta = hasAny(content, CTA_WORDS);
      const timing = hasAny(content, TIMING_WORDS);
      return [
        personalized,
        {
          label: "Clear call to action",
          pass: cta,
          note: `Asks for something concrete (a call, a meeting, a signature) rather than "let's see."`,
        },
        {
          label: "Concrete timing",
          pass: timing,
          note: `Names a specific timeframe so the next step actually happens.`,
        },
      ];
    }
    default:
      return [personalized];
  }
}

function bandFromChecks(checks: ReviewCheck[]): { band: ReviewBand; score: 1 | 3 | 5 } {
  const passes = checks.filter((c) => c.pass).length;
  if (passes >= 3) return { band: "Strong", score: 5 };
  if (passes === 2) return { band: "Solid", score: 3 };
  return { band: "Needs work", score: 1 };
}

function buildSuggestions(checks: ReviewCheck[]): string[] {
  return checks.filter((c) => !c.pass).map((c) => `${c.label}: ${c.note}`);
}

export function reviewSection(
  id: SectionId,
  content: string,
  data: InternalData,
  objective: string,
): SectionReview {
  const checks = getChecks(id, content, data, objective);
  const { band, score } = bandFromChecks(checks);
  return {
    checks,
    band,
    score,
    suggestions: buildSuggestions(checks),
    reviewedAt: new Date().toISOString(),
  };
}

/* Deterministically closes the gap on whatever failed. Only appends a fix for
 * checks that are currently failing, so re-running after a partial edit only
 * adds what's still missing rather than piling up duplicate sentences. */
export function improveSection(
  id: SectionId,
  content: string,
  data: InternalData,
  objective: string,
  review: SectionReview,
): string {
  const { client, marketNotes, recommendedProducts } = data;
  const name = client.name;
  const failing = new Set(review.checks.filter((c) => !c.pass).map((c) => c.label));
  let next = content.trim();
  const append = (s: string) => {
    next = next ? `${next} ${s}` : s;
  };

  if (failing.has("Personalized")) append(`This is specific to ${client.name}.`);

  switch (id) {
    case "situation": {
      if (failing.has("Data-grounded")) {
        const drifted = driftedLines(data)[0];
        append(
          `Their book stands at ${fmtMoney(client.aum)}${
            drifted ? `, with ${drifted.assetClass.toLowerCase()} running ${fmtPct(drifted.currentPct)} against a ${fmtPct(drifted.targetPct)} target` : ""
          }.`,
        );
      }
      if (failing.has("Names the goal")) append(`The stated priority is to ${client.primaryGoal.toLowerCase()}.`);
      break;
    }
    case "market": {
      const note = marketNotes[0];
      if (failing.has("Ties to a market view")) append(`${note.headline} — ${note.detail}`);
      if (failing.has("Explains relevance"))
        append(`That matters directly for ${name}'s portfolio and current risk profile, and affects the timing here.`);
      break;
    }
    case "recommendation": {
      const top = recommendedProducts[0];
      if (top && failing.has("Names a specific product")) append(`Specifically, we're recommending ${top.name}.`);
      if (top && failing.has("Data-grounded reasoning"))
        append(`It carries a ${top.feeBps}bps fee with a ${fmtMoney(top.minInvestment)} minimum, in line with the mandate size.`);
      break;
    }
    case "impact": {
      const drifted = driftedLines(data)[0] ?? data.portfolio.allocation[0];
      if (failing.has("Quantifies the change") && drifted)
        append(`Concretely, ${drifted.assetClass.toLowerCase()} moves from ${fmtPct(drifted.currentPct)} to a ${fmtPct(drifted.targetPct)} target.`);
      if (failing.has("Ties to the objective")) {
        const goalText = objective.trim() || client.primaryGoal;
        append(`This directly supports the goal to ${goalText.toLowerCase()}.`);
      }
      break;
    }
    case "risks": {
      if (failing.has("Mandatory disclosures")) {
        const fees = recommendedProducts.map((p) => `${p.name} at ${p.feeBps}bps`).join(", ");
        append(
          `There is risk of loss on any recommended holding, past performance is not a guide to future returns, and fees apply${
            fees ? ` — ${fees}` : ""
          }. Capital is at risk.`,
        );
      }
      if (failing.has("Flags known issues"))
        append(`We should also flag the existing concentration and liquidity considerations on file before proceeding.`);
      break;
    }
    case "close": {
      if (failing.has("Clear call to action")) append(`Let's schedule a call to walk through this and confirm next steps.`);
      if (failing.has("Concrete timing")) append(`I'll follow up this week to lock in a time.`);
      break;
    }
  }

  return next;
}
