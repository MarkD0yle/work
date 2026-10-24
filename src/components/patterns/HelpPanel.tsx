import type { ReactNode } from "react";
import ContextPanel, { PanelSection } from "./ContextPanel";
import { EmptyState } from "./EmptyState";
import { cx, text } from "./tokens";

/* HelpPanel — guidance for the field the user is on, beside the form.
 *
 * Replaces tooltips and "?" icons that hide the rule until someone hovers.
 * The form stays full width; the panel shows what the focused field means,
 * an example, and the rules that will reject it. Drive it with useFieldHelp.
 * With no field focused it says so, rather than going blank.
 *
 * Write topics as answers to "what do I type here, and what will fail?".
 * Link out for policy; keep the rule itself in the panel. */

export type HelpTopic = {
  title: string;
  /** What the field means, in a sentence or two. */
  body: ReactNode;
  /** A valid value, shown in monospace. */
  example?: string;
  /** What validation will reject. */
  rules?: string[];
  /** Where the rule comes from. */
  source?: string;
};

export function HelpPanel({
  topic,
  onClose,
}: {
  topic: HelpTopic | null;
  onClose?: () => void;
}) {
  return (
    <ContextPanel title={topic?.title ?? "Field help"} eyebrow="Help" onClose={onClose}>
      {!topic ? (
        <EmptyState kind="first" title="Select a field" description="What it means and what is accepted shows here." compact />
      ) : (
        <>
          <PanelSection title="What it is">
            <p className={text.body}>{topic.body}</p>
          </PanelSection>
          {topic.example && (
            <PanelSection title="Example">
              <code className="block bg-neutral-100 px-2 py-1.5 font-mono text-xs text-neutral-900">{topic.example}</code>
            </PanelSection>
          )}
          {topic.rules && topic.rules.length > 0 && (
            <PanelSection title="Will be rejected if" last={!topic.source}>
              <ul className={cx("list-disc pl-4", text.body)}>
                {topic.rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </PanelSection>
          )}
          {topic.source && (
            <PanelSection last>
              <p className={text.muted}>Source: {topic.source}</p>
            </PanelSection>
          )}
        </>
      )}
    </ContextPanel>
  );
}
