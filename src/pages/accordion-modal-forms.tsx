import { useState } from "react";
import MarketAccessExample from "../components/accordion-modal-forms/MarketAccessExample";
import SuitabilityExample from "../components/accordion-modal-forms/SuitabilityExample";
import CollateralScheduleExample from "../components/accordion-modal-forms/CollateralScheduleExample";
import InlineRowEditorExample from "../components/accordion-modal-forms/alternatives/InlineRowEditorExample";
import SidePanelEditorExample from "../components/accordion-modal-forms/alternatives/SidePanelEditorExample";
import DrillInEditorExample from "../components/accordion-modal-forms/alternatives/DrillInEditorExample";
import ImportReviewExample from "../components/accordion-modal-forms/alternatives/ImportReviewExample";
import { FORM_COUNTS } from "../components/accordion-modal-forms/alternatives/share-class";

export const title = "Accordion + Modal Forms";
export const section = "forms";
export const fullWidth = true;

/* Accordion + Modal Forms — one pattern, three treatments.
 *
 * The parent form is an accordion of numbered sections. One section holds a
 * button that opens a large modal with 50+ radio rows (and a few other
 * inputs). Saving the modal writes a summary back into that section as an
 * inline entry that can be expanded, edited or removed. The three examples
 * vary how the modal organises its long list:
 *
 *   A  grouped list + bulk apply      (54 markets, Full / Restricted / Blocked)
 *   B  paged questionnaire + scoring  (52 suitability questions, 6 categories)
 *   C  matrix table + column fill     (56 asset types × 6 haircut buckets)
 *
 * Below those, a second block tackles the case where the accordion itself is
 * already inside a modal — so "open a modal" would stack a second one. The
 * section holds a table (headers only until a record is added) and an "Add"
 * dropdown of ten labels; each record is a three-section form — Basic info,
 * Order creation settings, Order redemption settings — of five yes/no
 * questions each, where a Yes reveals four inputs. Ways to place that editor
 * without stacking:
 *
 *   D  inline row editor    expands in place beneath the table row
 *   E  docked side panel    ContextPanel beside the accordion, table stays
 *   F  drill-in view        pushes a full-width view into the same dialog
 *   G  import review        the records arrive from a spreadsheet — a
 *                           summary, an attention queue and a field × class
 *                           matrix replace per-record authoring
 */

const EXAMPLES = [
  {
    id: "a",
    label: "Market access",
    context: "Client onboarding",
    modal: "Grouped list",
    blurb:
      "54 markets grouped by region, each a Full / Restricted / Blocked radio row. Region shortcuts fill a block; restricted rows open a note field. Several sets can be saved, one per desk.",
    Component: MarketAccessExample,
  },
  {
    id: "b",
    label: "Suitability",
    context: "Investment account",
    modal: "Paged questionnaire",
    blurb:
      "52 questions paged by category with a progress rail. Answers score live and flag compliance issues. Saves as a draft or complete; a new complete assessment supersedes the old one and gates product scope.",
    Component: SuitabilityExample,
  },
  {
    id: "c",
    label: "Collateral schedule",
    context: "CSA set-up",
    modal: "Matrix table",
    blurb:
      "56 asset types as rows, haircut buckets as radio columns, with a concentration limit per eligible row. Column headers fill every expanded row; a standard schedule or the other direction can seed it.",
    Component: CollateralScheduleExample,
  },
] as const;

const FLOW = ["Accordion section", "Open modal", "50+ radio rows", "Save → inline entry"];

const ALTERNATIVES = [
  {
    id: "d",
    label: "Inline row editor",
    tagline: "Expand in place",
    where: "A row of the table itself, directly under the record it edits.",
    bestWhen:
      "The form is short to medium, users add a few records at a time, and seeing the row fill in as they type is the main payoff.",
    watchOut:
      "Every Yes opens four inputs, so the row grows tall and pushes the rest of the accordion down; only one row edits at a time, so Add and other rows lock while it is open.",
    blurb:
      "Picking a label appends a draft row and opens the editor beneath it — three columns of five yes/no questions, one per section, the row above updating live. Nothing overlays the dialog and the parent layout is untouched. Add and the other rows lock until the open row is saved or discarded.",
    Component: InlineRowEditorExample,
  },
  {
    id: "e",
    label: "Docked side panel",
    tagline: "Edit beside the table",
    where: "A ContextPanel docked to the right of the accordion, inside the parent dialog.",
    bestWhen:
      "Users work through a run of similar records (ten labels) and want to compare the one they are editing against the rows already saved.",
    watchOut:
      "Needs width — the parent dialog grows or the panel overlays its right edge; the table drops to counts only. Fifteen questions plus their revealed inputs make a long scroll in a narrow panel. Fall back to drill-in on narrow screens.",
    blurb:
      "The existing content-panel pattern. Picking a label opens the editor in a panel beside the accordion; the table stays in view, tints the row in progress and sheds its secondary columns. “Save & add next” carries on to the next unadded label, and Edit on any row swaps the panel's contents.",
    Component: SidePanelEditorExample,
  },
  {
    id: "f",
    label: "Drill-in view",
    tagline: "Push, don't stack",
    where: "Replaces the accordion inside the same dialog, reached and left via a breadcrumb.",
    bestWhen:
      "The form is long or sectioned enough to want a stepper and full width — five questions with their revealed inputs two-up — and users edit one record at a time.",
    watchOut:
      "The parent context disappears while editing — echo it in the breadcrumb and a row preview, and highlight the saved row on return so the user re-orients.",
    blurb:
      "Picking a label pushes a new view into the same dialog: the accordion slides away, the header becomes a breadcrumb, and the editor gets the full width as a three-step wizard with a jumpable rail and a live row preview. Saving pops back and flashes the new row. The accordion stays mounted, so nothing typed elsewhere is lost.",
    Component: DrillInEditorExample,
  },
  {
    id: "g",
    label: "Import review",
    tagline: "Everything at once",
    where:
      "No per-record editor up front: a summary strip, an attention queue grouped by field, and a question × class matrix whose cells open a popover for that question. Drill-in for the rare full edit.",
    bestWhen:
      "Records arrive in bulk from a spreadsheet and the job is to review and correct, not to author. The answers are yes/no and fixable with one click; the inputs behind a Yes are where the blanks and bad formats hide.",
    watchOut:
      "Needs the full dialog width and a cap on columns — ten classes fit, fifty need paging or filters. Cell edits bypass the form's section flow, so completeness is recomputed live and the parent save stays blocked until the queue is empty.",
    blurb:
      "Ten classes land from share-classes.xlsx. Every answer the matcher could read as Yes or No is filled; the rest are flagged — blank, unrecognised (with a suggestion where the text is close) or invalid where an input behind a Yes is in the wrong format. The queue groups problems by field so one answer fixes every affected class. The matrix shows all fifteen questions for all ten classes, tints problems, dots outliers, and any cell opens a popover with that question and its inputs. Open a class for the full stepped form.",
    Component: ImportReviewExample,
  },
] as const;

const FLOW2 = ["Parent dialog", "Accordion section", "Table (headers only)", "Add ▾ · 10 labels", "✕ second modal"];

export default function AccordionModalFormsPage() {
  const [active, setActive] = useState<(typeof EXAMPLES)[number]["id"]>("a");
  const ex = EXAMPLES.find((e) => e.id === active)!;
  const Example = ex.Component;

  const [activeAlt, setActiveAlt] = useState<(typeof ALTERNATIVES)[number]["id"]>("d");
  const alt = ALTERNATIVES.find((a) => a.id === activeAlt)!;
  const Alternative = alt.Component;

  return (
    <div className="h-screen overflow-y-auto bg-neutral-100 text-neutral-900">
      {/* pl-36 clears the app's fixed Home pill. */}
      <header className="border-b border-neutral-200 bg-white py-5 pr-6 pl-36">
        <div className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
          Forms & Flows · Pattern
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Accordion + modal forms</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          A sectioned form where one section launches a long modal form. The modal&apos;s result
          is saved back into the section as an inline entry you can expand, edit or remove.
        </p>
        <ol className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
          {FLOW.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              {i > 0 && <span className="text-neutral-300">→</span>}
              <span className="border border-neutral-200 bg-neutral-50 px-2 py-1 font-medium">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-6">
        <div role="tablist" aria-label="Examples" className="grid gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-3">
          {EXAMPLES.map((e, i) => {
            const selected = e.id === active;
            return (
              <button
                key={e.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(e.id)}
                className={`px-4 py-3 text-left transition ${
                  selected ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <div className={`text-[10px] font-semibold tracking-widest uppercase ${selected ? "text-neutral-400" : "text-neutral-400"}`}>
                  Example {String.fromCharCode(65 + i)} · {e.modal}
                </div>
                <div className="mt-0.5 text-sm font-semibold">{e.label}</div>
                <div className={`text-xs ${selected ? "text-neutral-300" : "text-neutral-500"}`}>{e.context}</div>
              </button>
            );
          })}
        </div>

        <p className="mt-4 border-l-2 border-neutral-900 bg-white px-4 py-3 text-xs leading-relaxed text-neutral-600">
          {ex.blurb}
        </p>

        <div role="tabpanel" className="mt-4">
          {/* key resets each example's local state when switching. */}
          <Example key={ex.id} />
        </div>
      </div>

      {/* ── Alternatives to a modal inside a modal ── */}
      <section className="mt-10 border-t border-neutral-300 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
            Variation · the accordion is already inside a modal
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Four ways to avoid a modal on a modal</h2>
          <p className="mt-2 max-w-3xl text-sm text-neutral-500">
            The section holds a table that shows its column headers before any record exists. An “Add” dropdown
            offers ten labels; choosing one opens a three-section form: Basic info, Order creation settings, Order
            redemption settings. Each section asks five yes/no questions, and answering Yes reveals four inputs
            beneath the question — so a class carries anywhere from {FORM_COUNTS.radios} answers to{" "}
            {FORM_COUNTS.radios + FORM_COUNTS.inputs} controls. Saving adds a row.
            Opening that form as a second modal
            stacks two focus traps, hides the table the row lands in, and leaves no room for the form. The first
            three alternatives keep the editor inside the parent dialog instead. The fourth changes the question:
            when the records arrive from a spreadsheet, nobody authors them one at a time, so the section becomes a
            review of everything at once and of what needs attention. The parent is drawn in-flow so all four can be
            compared on one page.
          </p>
          <ol className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
            {FLOW2.map((step, i) => {
              const bad = i === FLOW2.length - 1;
              return (
                <li key={step} className="flex items-center gap-2">
                  {i > 0 && <span className="text-neutral-300">→</span>}
                  <span
                    className={`border px-2 py-1 font-medium ${
                      bad ? "border-red-200 bg-red-50 text-red-700 line-through" : "border-neutral-200 bg-neutral-50"
                    }`}
                  >
                    {step}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* Side-by-side comparison; doubles as the tab strip. */}
          <div role="tablist" aria-label="Alternatives" className="mt-6 grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-2 xl:grid-cols-4">
            {ALTERNATIVES.map((a, i) => {
              const selected = a.id === activeAlt;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveAlt(a.id)}
                  className={`flex flex-col px-4 py-4 text-left transition ${
                    selected ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                    Alternative {String.fromCharCode(65 + EXAMPLES.length + i)} · {a.tagline}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold">{a.label}</div>
                  <dl className={`mt-3 space-y-2 text-[11px] leading-relaxed ${selected ? "text-neutral-300" : "text-neutral-500"}`}>
                    <div>
                      <dt className="font-semibold tracking-widest text-neutral-400 uppercase">Editor lives</dt>
                      <dd className={selected ? "text-neutral-100" : "text-neutral-700"}>{a.where}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold tracking-widest text-neutral-400 uppercase">Best when</dt>
                      <dd>{a.bestWhen}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold tracking-widest text-neutral-400 uppercase">Watch out</dt>
                      <dd>{a.watchOut}</dd>
                    </div>
                  </dl>
                </button>
              );
            })}
          </div>

          <p className="mt-4 border-l-2 border-neutral-900 bg-neutral-50 px-4 py-3 text-xs leading-relaxed text-neutral-600">
            {alt.blurb}
          </p>

          <div role="tabpanel" className="mt-5">
            <Alternative key={alt.id} />
          </div>
        </div>
      </section>
    </div>
  );
}
