import type { ReactNode } from "react";
import BaselineNestedModal from "../components/order-config/BaselineNestedModal";
import PanelVariant from "../components/order-config/PanelVariant";
import InlineVariant from "../components/order-config/InlineVariant";
import DrillInVariant from "../components/order-config/DrillInVariant";

export const title = "Order Config Patterns";
export const section = "patterns";

/* Order Config Patterns — one accordion + table + "add" dropdown + three-part
 * form, shown four ways. Block 0 is the current modal-on-modal pattern; A–C
 * are alternatives that keep the same data, fields and validation, so only the
 * container changes. */

function Block({
  tag,
  name,
  summary,
  pros,
  cons,
  children,
}: {
  tag: string;
  name: string;
  summary: string;
  pros: string;
  cons: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header>
        <div className="flex items-baseline gap-2">
          <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold tracking-widest text-white uppercase">
            {tag}
          </span>
          <h2 className="text-base font-semibold tracking-tight text-neutral-900">{name}</h2>
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">{summary}</p>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <div>
            <dt className="inline font-semibold text-emerald-700">Good: </dt>
            <dd className="inline text-neutral-600">{pros}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-red-700">Watch: </dt>
            <dd className="inline text-neutral-600">{cons}</dd>
          </div>
        </dl>
      </header>
      {children}
    </section>
  );
}

export default function OrderConfigPatternsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Order config: accordion, table, add, form
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Same data, same fields, same validation. Only the container for the form changes.
          Add a record in each block to compare.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          <span className="font-semibold text-neutral-700">Suggestion:</span> A as the
          default, because it reuses the context panel pattern. C when the form keeps
          growing. B only for short forms.
        </p>
      </header>

      <Block
        tag="Current"
        name="Accordion in a modal, form in a second modal"
        summary="The pattern to replace."
        pros="Familiar."
        cons="Two backdrops, two focus traps, table hidden while editing, Esc needs care."
      >
        <BaselineNestedModal />
      </Block>

      <Block
        tag="A"
        name="Docked side panel"
        summary="The form opens in the existing context panel beside the list."
        pros="Table stays visible, row stays highlighted, no focus trap, reuses ContextPanel."
        cons="Narrow panel: fields stack in one column. Saves screen width."
      >
        <PanelVariant />
      </Block>

      <Block
        tag="B"
        name="Inline editor row"
        summary="A draft row appears in the table and expands in place into collapsible sections."
        pros="No overlay at all. Fast for quick adds. Easy to compare with other rows."
        cons="Page grows tall and pushes other accordions down. Weak for long forms."
      >
        <InlineVariant />
      </Block>

      <Block
        tag="C"
        name="Drill-in view"
        summary="The accordion body swaps from table to a full-width form, with a breadcrumb back."
        pros="Most room for conditional fields. One focus. Clear way back."
        cons="Table is hidden while editing, so no side-by-side reference."
      >
        <DrillInVariant />
      </Block>
    </div>
  );
}
