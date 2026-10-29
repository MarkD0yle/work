import { useCallback, useMemo, useState } from "react";
import Modal from "../patterns/Modal";
import {
  AccordionItem,
  Chip,
  EmptyEntries,
  FieldBlock,
  FormFooter,
  InlineEntry,
  PlusIcon,
  Progress,
  RadioPills,
} from "./kit";
import {
  MAX_SCORE,
  QUESTIONS,
  QUESTION_CATEGORIES,
  riskBand,
  type QuestionCategory,
} from "./data";
import { btnDashed, btnPrimary, btnSecondary, inputClass, nextId, todayIso } from "./styles";

/* Example B — Investment account › Suitability assessment.
 *
 * Step 2 of the account form launches a 52-question MiFID-style suitability
 * questionnaire. The modal pages through six categories (left rail with
 * per-category progress), flags compliance-relevant answers as you go, and
 * scores the result live. It can be saved incomplete as a draft. Saved
 * assessments sit in the step as inline entries; completing a new one
 * supersedes the previous, which stays visible (dimmed) as history. Step 3
 * then reads the latest risk band to gate which product families unlock. */

type Assessment = {
  id: string;
  date: string;
  assessor: string;
  channel: "in-person" | "video" | "phone";
  answers: Record<string, number>;
  comment: string;
};

type Scored = {
  answered: number;
  complete: boolean;
  score: number;
  band: ReturnType<typeof riskBand>;
  flags: string[];
};

function scoreOf(a: Assessment): Scored {
  let score = 0;
  const flags: string[] = [];
  let answered = 0;
  for (const q of QUESTIONS) {
    const v = a.answers[q.id];
    if (v === undefined) continue;
    answered++;
    score += q.scores[v] ?? 0;
    if (q.flagOn === v) flags.push(q.id);
  }
  return {
    answered,
    complete: answered === QUESTIONS.length,
    score,
    band: riskBand(score),
    flags,
  };
}

// Deterministic, plausible answers for the seeded historical assessment.
const SEED: Assessment = {
  id: "SA-2025",
  date: "2025-10-02",
  assessor: "R. Okafor",
  channel: "in-person",
  comment: "Annual review.",
  answers: Object.fromEntries(
    QUESTIONS.map((q, i) => [
      q.id,
      q.flagOn !== undefined ? (q.flagOn === 0 ? 1 : 0) : (i % 3) % q.options.length,
    ]),
  ),
};

const PRODUCTS: { id: string; label: string; minBand: number }[] = [
  { id: "funds", label: "Mutual funds & ETFs", minBand: 0 },
  { id: "bonds", label: "Direct bonds", minBand: 0 },
  { id: "equities", label: "Direct equities", minBand: 1 },
  { id: "structured", label: "Structured products", minBand: 2 },
  { id: "options", label: "Listed options", minBand: 2 },
  { id: "privates", label: "Private markets", minBand: 3 },
];
const BAND_ORDER = ["Conservative", "Balanced", "Growth", "Aggressive"];

type SectionId = "profile" | "suitability" | "products" | "signoff";

export default function SuitabilityExample() {
  const [open, setOpen] = useState<Set<SectionId>>(new Set(["suitability"]));
  const [profile, setProfile] = useState({ name: "Amelia Varga", account: "Discretionary", ccy: "EUR" });
  const [assessments, setAssessments] = useState<Assessment[]>([SEED]);
  const [products, setProducts] = useState<Set<string>>(new Set(["funds", "bonds"]));
  const [adviser, setAdviser] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [draft, setDraft] = useState<Assessment | null>(null);
  const closeModal = useCallback(() => setDraft(null), []);

  // Newest complete assessment is current; older complete ones are superseded.
  const scored = assessments.map((a) => ({ a, s: scoreOf(a) }));
  const current = [...scored].reverse().find((x) => x.s.complete);
  const bandIdx = current ? BAND_ORDER.indexOf(current.s.band.label) : -1;

  const profileDone = profile.name.trim() !== "";
  const suitDone = Boolean(current);
  const productsDone = PRODUCTS.some((p) => bandIdx >= p.minBand && products.has(p.id));
  const signDone = adviser.trim() !== "";
  const requiredDone = [profileDone, suitDone, productsDone, signDone].filter(Boolean).length;

  function toggle(id: SectionId) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save(a: Assessment) {
    setAssessments((prev) =>
      prev.some((p) => p.id === a.id) ? prev.map((p) => (p.id === a.id ? a : p)) : [...prev, a],
    );
    setDraft(null);
  }

  return (
    <div>
      <div className="space-y-2">
        <AccordionItem
          index={1}
          title="Client profile"
          summary={`${profile.name} · ${profile.account} · ${profile.ccy}`}
          status={profileDone ? "complete" : "incomplete"}
          open={open.has("profile")}
          onToggle={() => toggle("profile")}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldBlock label="Client name" htmlFor="b-name" required>
              <input
                id="b-name"
                className={inputClass}
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </FieldBlock>
            <FieldBlock label="Account type" htmlFor="b-acc">
              <select
                id="b-acc"
                className={inputClass}
                value={profile.account}
                onChange={(e) => setProfile({ ...profile, account: e.target.value })}
              >
                <option>Execution only</option>
                <option>Advisory</option>
                <option>Discretionary</option>
              </select>
            </FieldBlock>
            <FieldBlock label="Base currency" htmlFor="b-ccy">
              <select
                id="b-ccy"
                className={inputClass}
                value={profile.ccy}
                onChange={(e) => setProfile({ ...profile, ccy: e.target.value })}
              >
                {["EUR", "GBP", "USD", "CHF"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </FieldBlock>
          </div>
        </AccordionItem>

        <AccordionItem
          index={2}
          title="Suitability assessment"
          summary={
            current
              ? `Current: ${current.s.band.label} · ${current.a.date}`
              : "52-question questionnaire — required before products unlock"
          }
          status={suitDone ? "complete" : "incomplete"}
          open={open.has("suitability")}
          onToggle={() => toggle("suitability")}
        >
          <div className="space-y-2">
            {scored.length === 0 && <EmptyEntries>No assessments on file.</EmptyEntries>}
            {[...scored].reverse().map(({ a, s }) => {
              const superseded = s.complete && current?.a.id !== a.id;
              return (
                <InlineEntry
                  key={a.id}
                  muted={superseded}
                  title={`Assessment · ${a.date}`}
                  meta={
                    <>
                      {a.assessor || "Unassigned"} · {a.channel.replace("-", " ")}
                      {superseded && " · superseded"}
                    </>
                  }
                  badges={
                    s.complete ? (
                      <>
                        <Chip tone={s.band.tone}>{s.band.label}</Chip>
                        <Chip>
                          {s.score}/{MAX_SCORE} pts
                        </Chip>
                        {s.flags.length > 0 && <Chip tone="bad">{s.flags.length} flagged</Chip>}
                      </>
                    ) : (
                      <>
                        <Chip tone="warn">Draft</Chip>
                        <Progress done={s.answered} total={QUESTIONS.length} />
                      </>
                    )
                  }
                  onEdit={superseded ? undefined : () => setDraft(structuredClone(a))}
                  onRemove={() => setAssessments((prev) => prev.filter((p) => p.id !== a.id))}
                  details={<AssessmentDetails a={a} s={s} />}
                />
              );
            })}
            <button
              type="button"
              onClick={() =>
                setDraft({
                  id: nextId("SA"),
                  date: todayIso(),
                  assessor: "",
                  channel: "video",
                  answers: {},
                  comment: "",
                })
              }
              className={btnDashed}
            >
              <PlusIcon /> Start new assessment
            </button>
          </div>
        </AccordionItem>

        <AccordionItem
          index={3}
          title="Product scope"
          summary={
            current
              ? `${products.size} product families · gated by ${current.s.band.label}`
              : "Complete the suitability assessment first"
          }
          status={productsDone ? "complete" : "incomplete"}
          open={open.has("products")}
          onToggle={() => toggle("products")}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {PRODUCTS.map((p) => {
              const allowed = bandIdx >= p.minBand;
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 border px-3 py-2.5 text-sm ${
                    allowed ? "border-neutral-200 text-neutral-800" : "border-neutral-100 text-neutral-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!allowed}
                    checked={allowed && products.has(p.id)}
                    onChange={(e) =>
                      setProducts((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(p.id);
                        else next.delete(p.id);
                        return next;
                      })
                    }
                    className="h-4 w-4 accent-neutral-900"
                  />
                  <span className="flex-1">{p.label}</span>
                  {!allowed && (
                    <span className="text-[11px]">needs {BAND_ORDER[p.minBand]}+</span>
                  )}
                </label>
              );
            })}
          </div>
        </AccordionItem>

        <AccordionItem
          index={4}
          title="Adviser sign-off"
          summary={adviser ? `Signed by ${adviser}` : "Adviser confirms the recommendation"}
          status={signDone ? "complete" : "incomplete"}
          open={open.has("signoff")}
          onToggle={() => toggle("signoff")}
        >
          <FieldBlock label="Adviser name" htmlFor="b-adv" required className="max-w-sm">
            <input
              id="b-adv"
              className={inputClass}
              value={adviser}
              onChange={(e) => setAdviser(e.target.value)}
            />
          </FieldBlock>
        </AccordionItem>
      </div>

      <FormFooter
        done={requiredDone}
        total={4}
        onSubmit={() => setSubmitted(true)}
        submitLabel="Open account"
        submitted={submitted}
      />

      {draft && (
        <QuestionnaireModal
          key={draft.id}
          initial={draft}
          isNew={!assessments.some((a) => a.id === draft.id)}
          onClose={closeModal}
          onSave={save}
        />
      )}
    </div>
  );
}

function AssessmentDetails({ a, s }: { a: Assessment; s: Scored }) {
  const perCat = QUESTION_CATEGORIES.map((c) => {
    const qs = QUESTIONS.filter((q) => q.category === c);
    return { c, done: qs.filter((q) => a.answers[q.id] !== undefined).length, total: qs.length };
  });
  return (
    <div className="space-y-3 text-xs">
      <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {perCat.map((x) => (
          <div key={x.c} className="flex items-center justify-between gap-3">
            <span className="text-neutral-600">{x.c}</span>
            <Progress done={x.done} total={x.total} />
          </div>
        ))}
      </div>
      {s.flags.length > 0 && (
        <ul className="space-y-1 border-l-2 border-red-300 pl-3">
          {s.flags.map((id) => {
            const q = QUESTIONS.find((x) => x.id === id)!;
            return (
              <li key={id} className="text-red-700">
                <span className="font-mono text-[11px]">{id}</span> {q.text} —{" "}
                <strong>{q.options[a.answers[id]]}</strong>
              </li>
            );
          })}
        </ul>
      )}
      {a.comment && <p className="text-neutral-500 italic">{a.comment}</p>}
    </div>
  );
}

function QuestionnaireModal({
  initial,
  isNew,
  onClose,
  onSave,
}: {
  initial: Assessment;
  isNew: boolean;
  onClose: () => void;
  onSave: (a: Assessment) => void;
}) {
  const [d, setD] = useState(initial);
  const [cat, setCat] = useState<QuestionCategory>(QUESTION_CATEGORIES[0]);
  const s = useMemo(() => scoreOf(d), [d]);
  const catIdx = QUESTION_CATEGORIES.indexOf(cat);
  const questions = QUESTIONS.filter((q) => q.category === cat);

  function answer(id: string, v: number) {
    setD((prev) => ({ ...prev, answers: { ...prev.answers, [id]: v } }));
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="2xl"
      title={isNew ? "New suitability assessment" : `Edit assessment · ${initial.date}`}
      description={`${QUESTIONS.length} questions across ${QUESTION_CATEGORIES.length} categories. Answers are scored as you go; flagged answers need a compliance note.`}
      footer={
        <>
          <span className="mr-auto flex items-center gap-3 text-xs text-neutral-500">
            <Progress done={s.answered} total={QUESTIONS.length} />
            {s.answered > 0 && (
              <>
                <Chip tone={s.band.tone}>{s.band.label}</Chip>
                {s.flags.length > 0 && <Chip tone="bad">{s.flags.length} flagged</Chip>}
              </>
            )}
          </span>
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          {!s.complete && (
            <button type="button" onClick={() => onSave(d)} className={btnSecondary}>
              Save as draft
            </button>
          )}
          <button type="button" disabled={!s.complete} onClick={() => onSave(d)} className={btnPrimary}>
            Complete assessment
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <FieldBlock label="Assessment date" htmlFor="q-date">
          <input
            id="q-date"
            type="date"
            className={inputClass}
            value={d.date}
            onChange={(e) => setD({ ...d, date: e.target.value })}
          />
        </FieldBlock>
        <FieldBlock label="Assessed by" htmlFor="q-by">
          <input
            id="q-by"
            className={inputClass}
            value={d.assessor}
            onChange={(e) => setD({ ...d, assessor: e.target.value })}
          />
        </FieldBlock>
        <FieldBlock label="Meeting">
          <RadioPills
            name="q-channel"
            label="Meeting channel"
            value={d.channel}
            onChange={(v) => setD({ ...d, channel: v })}
            options={[
              { value: "in-person", label: "In person" },
              { value: "video", label: "Video" },
              { value: "phone", label: "Phone" },
            ]}
          />
        </FieldBlock>
      </div>

      <div className="mt-5 grid gap-5 border-t border-neutral-200 pt-4 md:grid-cols-4">
        {/* Category rail */}
        <nav aria-label="Question categories" className="md:col-span-1">
          <ol className="space-y-px">
            {QUESTION_CATEGORIES.map((c, i) => {
              const qs = QUESTIONS.filter((q) => q.category === c);
              const done = qs.filter((q) => d.answers[q.id] !== undefined).length;
              const flagged = qs.some((q) => q.flagOn !== undefined && d.answers[q.id] === q.flagOn);
              const active = c === cat;
              return (
                <li key={c}>
                  <button
                    type="button"
                    aria-current={active ? "step" : undefined}
                    onClick={() => setCat(c)}
                    className={`flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-xs transition ${
                      active
                        ? "border-l-neutral-900 bg-neutral-100 font-semibold text-neutral-900"
                        : "border-l-transparent text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    <span className="w-4 font-mono text-[10px] text-neutral-400">{i + 1}</span>
                    <span className="flex-1">{c}</span>
                    {flagged && <span className="h-1.5 w-1.5 bg-red-500" aria-label="Has flags" />}
                    <span
                      className={`tabular-nums ${done === qs.length ? "text-emerald-600" : "text-neutral-400"}`}
                    >
                      {done}/{qs.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="md:col-span-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">{cat}</h3>
            <span className="text-[11px] text-neutral-400">
              Category {catIdx + 1} of {QUESTION_CATEGORIES.length}
            </span>
          </div>
          <ol className="mt-3 divide-y divide-neutral-100 border-y border-neutral-100">
            {questions.map((q) => {
              const v = d.answers[q.id];
              const flagged = q.flagOn !== undefined && v === q.flagOn;
              return (
                <li key={q.id} className={`py-3 ${flagged ? "bg-red-50/60" : ""}`}>
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <span className="pt-0.5 font-mono text-[11px] text-neutral-400">{q.id}</span>
                    <p className="min-w-0 flex-1 text-sm text-neutral-800">{q.text}</p>
                    <RadioPills
                      name={`${d.id}-${q.id}`}
                      label={q.text}
                      value={v === undefined ? undefined : String(v)}
                      onChange={(x) => answer(q.id, Number(x))}
                      options={q.options.map((o, i) => ({
                        value: String(i),
                        label: o,
                        tone: q.flagOn === i ? "bad" : "info",
                      }))}
                      size="xs"
                    />
                  </div>
                  {flagged && (
                    <p className="mt-1.5 ml-9 text-[11px] font-medium text-red-700">
                      Flag raised — compliance will review this answer.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="mt-3 flex justify-between">
            <button
              type="button"
              disabled={catIdx === 0}
              onClick={() => setCat(QUESTION_CATEGORIES[catIdx - 1])}
              className={btnSecondary}
            >
              ← Previous
            </button>
            {catIdx < QUESTION_CATEGORIES.length - 1 ? (
              <button
                type="button"
                onClick={() => setCat(QUESTION_CATEGORIES[catIdx + 1])}
                className={btnSecondary}
              >
                Next: {QUESTION_CATEGORIES[catIdx + 1]} →
              </button>
            ) : (
              <span />
            )}
          </div>

          {catIdx === QUESTION_CATEGORIES.length - 1 && (
            <FieldBlock label="Adviser comment" htmlFor="q-comment" className="mt-5">
              <textarea
                id="q-comment"
                rows={3}
                className={`${inputClass} resize-y`}
                value={d.comment}
                onChange={(e) => setD({ ...d, comment: e.target.value })}
              />
            </FieldBlock>
          )}
        </div>
      </div>
    </Modal>
  );
}
