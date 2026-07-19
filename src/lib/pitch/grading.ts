import type { GradeBand, GradeDimension, Pitch, PitchGrade } from "./types";
import { SECTION_DEFS } from "./sections";
import { getChecks } from "./review";

/* Whole-pitch grading — same two-stage shape as rubric/gates.md +
 * rubric/composition-rubric.md: binary gates run first and any failure
 * stops the run (no grade happens on a pitch that isn't fit to send).
 * Only a pitch that clears every gate gets graded, and grading is split
 * into STRUCTURE dimensions (always graded) and a GOAL dimension that only
 * grades if the rep stated an objective for this pitch — no objective
 * stated → skipped, scored N/A, never guessed. */

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function bandFor(passes: number, total: number): { band: GradeBand; score: number } {
  const ratio = total === 0 ? 0 : passes / total;
  if (ratio >= 1) return { band: "High", score: 5 };
  if (ratio >= 0.5) return { band: "Mid", score: 3 };
  return { band: "Low", score: 1 };
}

const BANNED_PHRASES = ["guarantee", "guaranteed", "no risk", "risk-free", "risk free"];

export function gradePitch(pitch: Pitch): PitchGrade {
  const gateFailures: string[] = [];

  for (const def of SECTION_DEFS) {
    const section = pitch.sections[def.id];
    if (section.status === "empty" || !section.content.trim()) {
      gateFailures.push(`${def.label} — no content drafted yet.`);
      continue;
    }
    const words = wordCount(section.content);
    if (words < def.minWords) {
      gateFailures.push(`${def.label} — ${words} words, below the ${def.minWords}-word floor for this section.`);
    }
  }

  const risksSection = pitch.sections.risks;
  const risksChecks = getChecks("risks", risksSection.content, pitch.data, pitch.objective);
  const disclosureCheck = risksChecks.find((c) => c.label === "Mandatory disclosures");
  if (!disclosureCheck?.pass) {
    gateFailures.push("Risks & fees — mandatory disclosures (risk of loss, fees, past performance, capital) are not present. A pitch cannot go out without these.");
  }

  if (gateFailures.length > 0) {
    return {
      gatesPassed: false,
      gateFailures,
      dimensions: [],
      overallScore: null,
      log: gateFailures.map((f) => `gate: ${f}`),
      gradedAt: new Date().toISOString(),
    };
  }

  const allText = SECTION_DEFS.map((d) => pitch.sections[d.id].content).join(" ");
  const log: string[] = [];
  const dimensions: GradeDimension[] = [];

  // 1. Completeness — every section drafted, reviewed, and out of "needs work".
  {
    const sections = SECTION_DEFS.map((d) => pitch.sections[d.id]);
    const checks = [
      { label: "Every section has content", pass: sections.every((s) => s.content.trim().length > 0) },
      { label: "Every section has been AI-reviewed", pass: sections.every((s) => s.review !== null) },
      { label: "No section still flagged Needs work", pass: sections.every((s) => s.review?.band !== "Needs work") },
    ];
    const passes = checks.filter((c) => c.pass).length;
    const { band, score } = bandFor(passes, checks.length);
    dimensions.push({ key: "completeness", label: "Completeness", tag: "STRUCTURE", checks, band, score });
    for (const c of checks.filter((c) => !c.pass)) log.push(`completeness: ${c.label.toLowerCase()}. 1×.`);
  }

  // 2. Data grounding — the sections that carry the numbers actually cite them.
  {
    const situationChecks = getChecks("situation", pitch.sections.situation.content, pitch.data, pitch.objective);
    const recChecks = getChecks("recommendation", pitch.sections.recommendation.content, pitch.data, pitch.objective);
    const impactChecks = getChecks("impact", pitch.sections.impact.content, pitch.data, pitch.objective);
    const checks = [
      { label: "Client situation cites a figure", pass: situationChecks.find((c) => c.label === "Data-grounded")?.pass ?? false },
      { label: "Recommendation cites fee/minimum", pass: recChecks.find((c) => c.label === "Data-grounded reasoning")?.pass ?? false },
      { label: "Impact quantifies the change", pass: impactChecks.find((c) => c.label === "Quantifies the change")?.pass ?? false },
    ];
    const passes = checks.filter((c) => c.pass).length;
    const { band, score } = bandFor(passes, checks.length);
    dimensions.push({ key: "data-grounding", label: "Data grounding", tag: "STRUCTURE", checks, band, score });
    for (const c of checks.filter((c) => !c.pass)) log.push(`data-grounding: ${c.label.toLowerCase()} — not met. 1×.`);
  }

  // 3. Compliance coverage — disclosures present, flags surfaced, no overreach.
  {
    const flagCheck = risksChecks.find((c) => c.label === "Flags known issues");
    const noOverreach = !BANNED_PHRASES.some((p) => allText.toLowerCase().includes(p));
    const checks = [
      { label: "Mandatory disclosures present", pass: disclosureCheck?.pass ?? false },
      { label: "Known compliance flags surfaced", pass: flagCheck?.pass ?? false },
      { label: "No guaranteed-return language", pass: noOverreach },
    ];
    const passes = checks.filter((c) => c.pass).length;
    const { band, score } = bandFor(passes, checks.length);
    dimensions.push({ key: "compliance", label: "Compliance coverage", tag: "STRUCTURE", checks, band, score });
    for (const c of checks.filter((c) => !c.pass)) log.push(`compliance: ${c.label.toLowerCase()} — not met. 1×.`);
  }

  // 4. Goal alignment — GOAL/INTENT dimension. Only grades if an objective
  // was actually stated for this pitch; otherwise skipped, scored N/A.
  const objective = pitch.objective.trim();
  if (objective) {
    const impactChecks = getChecks("impact", pitch.sections.impact.content, pitch.data, pitch.objective);
    const closeChecks = getChecks("close", pitch.sections.close.content, pitch.data, pitch.objective);
    const objectiveFragment = objective.split(" ").slice(0, 6).join(" ").toLowerCase();
    const checks = [
      {
        label: "Recommendation ties to the stated objective",
        pass: pitch.sections.recommendation.content.toLowerCase().includes(objectiveFragment),
      },
      { label: "Impact ties to the stated objective", pass: impactChecks.find((c) => c.label === "Ties to the objective")?.pass ?? false },
      { label: "Close has a clear call to action", pass: closeChecks.find((c) => c.label === "Clear call to action")?.pass ?? false },
    ];
    const passes = checks.filter((c) => c.pass).length;
    const { band, score } = bandFor(passes, checks.length);
    dimensions.push({ key: "goal-alignment", label: "Goal alignment", tag: "GOAL", checks, band, score });
    for (const c of checks.filter((c) => !c.pass)) log.push(`goal-alignment: ${c.label.toLowerCase()} — not met. 1×.`);
  } else {
    dimensions.push({
      key: "goal-alignment",
      label: "Goal alignment",
      tag: "GOAL",
      checks: [],
      band: "N/A",
      score: null,
    });
  }

  const scored = dimensions.map((d) => d.score).filter((s): s is number => s !== null);
  const overallScore = scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10 : null;

  return {
    gatesPassed: true,
    gateFailures: [],
    dimensions,
    overallScore,
    log,
    gradedAt: new Date().toISOString(),
  };
}
