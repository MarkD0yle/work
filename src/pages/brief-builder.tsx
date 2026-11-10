import { useEffect, useMemo, useState } from "react";
import { PageHeader, SectionCard } from "../components/patterns";
import { button, cx, focus, text } from "../components/patterns/tokens";
import { usePageCatalogue } from "../hooks/usePageCatalogue";
import { useCopy } from "../hooks/useCopy";
import { HOUSE_RULES } from "../lib/houseRules";
import { PATTERN_NAMES } from "../lib/pageIntel";
import { clearNavParams, peekNavParams } from "../lib/navigation";

export const title = "Brief Builder";
export const section = "patterns";
export const fullWidth = true;

/* Brief Builder — assemble one prompt an AI assistant can follow.
 *
 * AI-built screens drift because the assistant is never told the house
 * rules. This tool puts the base screen, the patterns to reuse and the rules
 * into a single brief, so every prompt starts from the same contract. Think
 * of it as a component with props: the rules are fixed, the goal changes. */

const CORE_RULES = HOUSE_RULES.filter((r) => r.core).map((r) => r.id);

const field =
  "w-full rounded-none border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400";

function toSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toggle(set: Set<string>, id: string) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export default function BriefBuilderPage() {
  const catalogue = usePageCatalogue();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [base, setBase] = useState(() => peekNavParams("brief-builder").base ?? "");
  const [patterns, setPatterns] = useState<Set<string>>(new Set());
  const [rules, setRules] = useState<Set<string>>(new Set(CORE_RULES));
  const { copied, copy } = useCopy();

  useEffect(() => clearNavParams(), []);

  const baseItem = catalogue.find((item) => item.slug === base);

  const prompt = useMemo(() => {
    const slug = toSlug(name) || "new-screen";
    const lines: string[] = [
      "Build a new screen for the Absurd Alpha prototype gallery (Vite, React, TypeScript, Tailwind CSS v4).",
      "",
      `Screen: ${name.trim() || "New screen"}`,
      `File: src/pages/${slug}.tsx`,
      `Goal: ${goal.trim() || "(describe what the screen is for and who uses it)"}`,
    ];
    if (base) {
      lines.push(
        "",
        `Start from: src/pages/${base}.tsx${baseItem ? ` (${baseItem.title})` : ""}`,
        "Read it first. Keep its layout and data shape, and change only what the goal needs.",
      );
    }
    if (patterns.size > 0) {
      lines.push(
        "",
        "Reuse these patterns:",
        `import { ${[...patterns].sort().join(", ")} } from "../components/patterns";`,
      );
    }
    const chosen = HOUSE_RULES.filter((r) => rules.has(r.id));
    if (chosen.length > 0) {
      lines.push("", "House rules:");
      chosen.forEach((r, i) => lines.push(`${i + 1}. ${r.instruction}`));
    }
    lines.push(
      "",
      "When you are done, run `npm run lint` and `npm run build` and fix anything they report.",
    );
    return lines.join("\n");
  }, [name, goal, base, baseItem, patterns, rules]);

  return (
    <div className="h-screen overflow-y-auto bg-neutral-50">
      <PageHeader
        className="pl-32"
        eyebrow="Tools"
        title="Brief Builder"
        description="Pick a base screen, patterns and rules. Copy one prompt for your AI assistant."
      />
      <div className="mx-auto grid max-w-6xl gap-4 p-6 lg:grid-cols-2">
        <div className="grid content-start gap-4">
          <SectionCard title="1. What are you building?">
            <div className="grid gap-3">
              <label className="grid gap-1">
                <span className={text.label}>Screen name</span>
                <input
                  className={cx(field, focus)}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="FX Swap Blotter"
                />
              </label>
              <label className="grid gap-1">
                <span className={text.label}>Goal</span>
                <textarea
                  className={cx(field, focus, "min-h-24")}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="A trader checks today's FX swaps and rolls the ones maturing tomorrow."
                />
              </label>
              <label className="grid gap-1">
                <span className={text.label}>Start from an existing screen (optional)</span>
                <select
                  className={cx(field, focus)}
                  value={base}
                  onChange={(e) => setBase(e.target.value)}
                >
                  <option value="">Blank screen</option>
                  {catalogue.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.title} · {item.sectionLabel}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </SectionCard>

          <SectionCard title={`2. Patterns to reuse (${patterns.size} selected)`}>
            <div className="flex flex-wrap gap-1.5">
              {PATTERN_NAMES.map((p) => {
                const on = patterns.has(p);
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPatterns((prev) => toggle(prev, p))}
                    className={cx(
                      "rounded-none border px-2 py-1 font-mono text-[11px]",
                      on
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100",
                      focus,
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="3. House rules">
            <ul className="grid gap-2">
              {HOUSE_RULES.map((r) => (
                <li key={r.id}>
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-neutral-900"
                      checked={rules.has(r.id)}
                      onChange={() => setRules((prev) => toggle(prev, r.id))}
                    />
                    <span>
                      <span className="block text-xs font-medium text-neutral-900">{r.label}</span>
                      <span className={text.muted}>{r.instruction}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <SectionCard
            title="Your brief"
            actions={
              <button
                type="button"
                className={button.primary}
                onClick={() => copy("brief", prompt)}
              >
                {copied === "brief" ? "Copied" : "Copy prompt"}
              </button>
            }
          >
            <pre
              aria-label="Generated prompt"
              className="max-h-[70vh] overflow-auto bg-neutral-950 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-neutral-100"
            >
              {prompt}
            </pre>
            <p className={cx("mt-3", text.muted)}>
              Paste it into Claude Code or Copilot Chat. The brief updates as you change the form.
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
