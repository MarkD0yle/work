import type { NarrativeSectionId, NarrativeSourceData, ReviewBand, ReviewCheck, SectionReview } from "./types";

/* Rule-based narrative reviewer — same deterministic shape as
 * lib/pitch/review.ts (3 checks per section: 3/3 → Strong·5, 2/3 → Solid·3,
 * 0-1 → Needs work·1), retargeted at NarrativeSourceData. */

function firstName(name: string): string {
  return name.split(" ")[0];
}

function has(content: string, needle: string): boolean {
  return needle.trim().length > 0 && content.toLowerCase().includes(needle.toLowerCase());
}

function hasAny(content: string, needles: string[]): boolean {
  return needles.some((n) => has(content, n));
}

function objectiveFragment(objective: string): string {
  return objective.split(" ").slice(0, 6).join(" ");
}

const CTA_WORDS = ["schedule", "call", "meeting", "sign", "proceed", "confirm", "follow up", "next step"];
const TIMING_WORDS = ["this week", "next week", "monday", "tuesday", "wednesday", "thursday", "friday", "by end of", "tomorrow"];
const NOW_WORDS = ["now", "today", "this quarter", "current", "currently", "moment"];

export function getNarrativeChecks(id: NarrativeSectionId, content: string, source: NarrativeSourceData): ReviewCheck[] {
  const { client, painPoints, solution, capabilitiesById, objective } = source;
  const name = client.name;

  const personalized: ReviewCheck = {
    label: "Personalized",
    pass: has(content, name) || has(content, firstName(name)),
    note: `Names ${name} directly rather than reading as boilerplate.`,
  };

  switch (id) {
    case "pointOfView": {
      const namesPainPoint = painPoints.some((p) => has(content, p.label));
      const statesWhyNow = hasAny(content, NOW_WORDS);
      return [
        personalized,
        {
          label: "Names a specific pain point",
          pass: namesPainPoint,
          note: "References a specific, named pain point rather than a generic challenge.",
        },
        {
          label: "States why now",
          pass: statesWhyNow,
          note: "Explains why this matters at this moment, not just in the abstract.",
        },
      ];
    }
    case "coreMessage": {
      const sentences = content.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
      const oneClearTakeaway = sentences.length > 0 && sentences.length <= 2;
      const tiesToObjective = objective.trim() ? has(content, objectiveFragment(objective)) : true;
      return [
        personalized,
        {
          label: "One clear takeaway",
          pass: oneClearTakeaway,
          note: "Reads as a single, memorable sentence rather than a paragraph of hedges.",
        },
        {
          label: "Ties to the objective",
          pass: tiesToObjective,
          note: objective.trim() ? "Connects back to the stated pitch objective." : "No objective stated for this opportunity — passes by default.",
        },
      ];
    }
    case "problemImpact": {
      const namesPainPoint = painPoints.some((p) => has(content, p.label));
      const quantifies = /\d/.test(content);
      return [
        personalized,
        {
          label: "References a specific pain point",
          pass: namesPainPoint,
          note: "Names one of the gathered pain points, not a generic problem statement.",
        },
        {
          label: "Quantifies or concretizes the cost",
          pass: quantifies,
          note: "Includes a concrete number so the cost of inaction is tangible.",
        },
      ];
    }
    case "solutionStory": {
      const namesCapability = solution.some((s) => has(content, capabilitiesById[s.capabilityId]?.name ?? ""));
      const citesDifferentiation = solution.some(
        (s) => s.differentiation.trim().length > 0 && has(content, s.differentiation.split(" ").slice(0, 5).join(" ")),
      );
      return [
        {
          label: "Names a specific capability",
          pass: namesCapability,
          note: "Names one of the actual recommended capabilities, not a vague 'a solution.'",
        },
        {
          label: "Cites differentiation vs. an incumbent",
          pass: citesDifferentiation,
          note: "States how this differs from the competitive alternative, not just what it is.",
        },
        personalized,
      ];
    }
    case "callToAction": {
      const cta = hasAny(content, CTA_WORDS);
      const timing = hasAny(content, TIMING_WORDS);
      return [
        personalized,
        {
          label: "Clear call to action",
          pass: cta,
          note: "Asks for something concrete rather than 'let's see.'",
        },
        {
          label: "Concrete timing",
          pass: timing,
          note: "Names a specific timeframe so the next step actually happens.",
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

export function reviewNarrativeSection(id: NarrativeSectionId, content: string, source: NarrativeSourceData): SectionReview {
  const checks = getNarrativeChecks(id, content, source);
  const { band, score } = bandFromChecks(checks);
  return {
    checks,
    band,
    score,
    suggestions: buildSuggestions(checks),
    reviewedAt: new Date().toISOString(),
  };
}

/* Deterministically closes the gap on whatever failed — only appends a fix
 * for checks currently failing, so re-running after a partial edit only adds
 * what's still missing. */
export function improveNarrativeSection(
  id: NarrativeSectionId,
  content: string,
  source: NarrativeSourceData,
  review: SectionReview,
): string {
  const { client, painPoints, solution, capabilitiesById, objective } = source;
  const failing = new Set(review.checks.filter((c) => !c.pass).map((c) => c.label));
  let next = content.trim();
  const append = (s: string) => {
    next = next ? `${next} ${s}` : s;
  };

  if (failing.has("Personalized")) append(`This is specific to ${client.name}.`);

  switch (id) {
    case "pointOfView": {
      const top = painPoints[0];
      if (failing.has("Names a specific pain point") && top) append(`Specifically, ${top.label.toLowerCase()} — ${top.detail}`);
      if (failing.has("States why now")) append(`This matters now, not next quarter.`);
      break;
    }
    case "coreMessage": {
      if (failing.has("One clear takeaway")) {
        const firstSentence = next.split(/[.!?]+/)[0]?.trim();
        if (firstSentence) next = `${firstSentence}.`;
      }
      if (failing.has("Ties to the objective") && objective.trim()) append(`This directly supports the goal to ${objective.trim().toLowerCase()}.`);
      break;
    }
    case "problemImpact": {
      const top = painPoints[0];
      if (failing.has("References a specific pain point") && top) append(`${top.label} is the clearest example: ${top.detail}`);
      if (failing.has("Quantifies or concretizes the cost") && top)
        append(`Left unresolved, this is already a ${top.severity.toLowerCase()}-severity gap — call it a 90-day cost, not a someday cost.`);
      break;
    }
    case "solutionStory": {
      const first = solution[0];
      const cap = first ? capabilitiesById[first.capabilityId] : undefined;
      if (failing.has("Names a specific capability") && cap) append(`Specifically, we're recommending ${cap.name}.`);
      if (failing.has("Cites differentiation vs. an incumbent") && first?.differentiation) append(first.differentiation);
      break;
    }
    case "callToAction": {
      if (failing.has("Clear call to action")) append(`Let's schedule a call to confirm next steps.`);
      if (failing.has("Concrete timing")) append(`I'll follow up this week to lock in a time.`);
      break;
    }
  }

  return next;
}
