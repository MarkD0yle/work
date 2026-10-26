import { useEffect, useRef, useState } from "react";
import {
  PanelBody,
  PanelFooter,
  PanelFrame,
  PanelHeader,
  PanelSection,
  Pill,
} from "./PanelKit";

/* 6 · AI assist — research copilot.
 *
 * Generated text earns less trust than fetched text, so this panel spends its
 * design budget on provenance rather than polish. Every answer carries inline
 * citations back to a numbered paragraph of the note on the left, the model's
 * state is stated plainly instead of implied by a spinner alone, and a
 * feedback control sits on each answer because the desk's corrections are the
 * only thing that improves it.
 *
 * Suggested prompts solve the cold start — an empty chat box next to a
 * fourteen-page note is a worse prompt than three good questions. The
 * disclaimer is pinned in the footer where it cannot be scrolled past.
 */

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  citations?: { n: number; label: string }[];
};

const SUGGESTIONS = [
  "Summarise the ECB call in three bullets",
  "What would change the author's mind?",
  "How does this differ from last week's note?",
];

const SEED: Message[] = [
  {
    id: 1,
    role: "user",
    text: "What is the recommended trade, and what carries it?",
  },
  {
    id: 2,
    role: "assistant",
    text: "The note recommends receiving 2y EUR OIS against paying 10y, targeting 40bp of steepening by year-end. Carry is roughly -1.8bp per month at current forwards, so the position needs the ECB to cut twice by December to break even on a hold-to-target basis.",
    citations: [
      { n: 3, label: "Recommendation" },
      { n: 7, label: "Carry & roll" },
    ],
  },
];

/* Canned replies — this is a pattern demo, not a model integration. */
const CANNED: Omit<Message, "id" | "role"> = {
  text: "The author flags two invalidation points: an upside surprise in core services inflation above 3.4%, or any signal that the Council is treating the June cut as a one-off. Either would argue for flattening the position rather than adding.",
  citations: [
    { n: 9, label: "Risks to the view" },
    { n: 11, label: "Positioning" },
  ],
};

export function ResearchCopilotPanel({ onClose }: { onClose?: () => void }) {
  const [messages, setMessages] = useState<Message[]>(SEED);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const nextId = useRef(SEED.length + 1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  function ask(text: string) {
    const q = text.trim();
    if (!q || thinking) return;
    setMessages((m) => [...m, { id: nextId.current++, role: "user", text: q }]);
    setDraft("");
    setThinking(true);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { id: nextId.current++, role: "assistant", ...CANNED },
      ]);
      setThinking(false);
    }, 1100);
  }

  return (
    <PanelFrame accent="info" label="Research copilot">
      <PanelHeader
        eyebrow="Copilot"
        title="Ask this note"
        subtitle="EUR Rates Weekly · 14 pages · indexed 15 Aug"
        onClose={onClose}
        badge={<Pill tone="info">Beta</Pill>}
      />

      <PanelBody>
        <PanelSection title="Suggested" dense>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="rounded-full border border-neutral-300 px-2.5 py-1 text-[11px] text-neutral-600 transition hover:border-neutral-900 hover:text-neutral-900"
              >
                {s}
              </button>
            ))}
          </div>
        </PanelSection>

        <div className="space-y-4 px-5 py-4">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-lg rounded-br-sm bg-neutral-900 px-3 py-2 text-xs text-white">
                  {m.text}
                </p>
              </div>
            ) : (
              <div key={m.id}>
                <p className="text-xs leading-relaxed text-neutral-800">
                  {m.text}
                </p>
                {m.citations && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.citations.map((c) => (
                      <button
                        key={c.n}
                        type="button"
                        className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 hover:bg-sky-100"
                      >
                        <span className="tabular-nums">¶{c.n}</span>
                        <span className="text-sky-600">{c.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2 text-neutral-300">
                  <button
                    type="button"
                    aria-label="Helpful"
                    className="rounded p-0.5 hover:bg-neutral-100 hover:text-emerald-600"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M11.5 2a1 1 0 0 0-.97.757L9.6 6.5H5.75A1.75 1.75 0 0 0 4 8.25v7A1.75 1.75 0 0 0 5.75 17h8.1a2 2 0 0 0 1.96-1.6l1.05-5.25A1.75 1.75 0 0 0 15.14 8H12l.45-2.7A2.5 2.5 0 0 0 10 2h1.5Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Not helpful"
                    className="rounded p-0.5 hover:bg-neutral-100 hover:text-rose-600"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3.5 w-3.5 rotate-180"
                    >
                      <path d="M11.5 2a1 1 0 0 0-.97.757L9.6 6.5H5.75A1.75 1.75 0 0 0 4 8.25v7A1.75 1.75 0 0 0 5.75 17h8.1a2 2 0 0 0 1.96-1.6l1.05-5.25A1.75 1.75 0 0 0 15.14 8H12l.45-2.7A2.5 2.5 0 0 0 10 2h1.5Z" />
                    </svg>
                  </button>
                  <span className="ml-auto text-[10px] text-neutral-400">
                    Generated · verify before acting
                  </span>
                </div>
              </div>
            ),
          )}

          {thinking && (
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <span className="flex gap-0.5" aria-hidden>
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </span>
              Reading §9–§12 of the note…
            </div>
          )}
          <div ref={endRef} />
        </div>
      </PanelBody>

      <PanelFooter note="Answers are drawn only from this note. Not investment advice.">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask(draft);
          }}
          placeholder="Ask about this note…"
          aria-label="Ask about this note"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900"
        />
        <button
          type="button"
          onClick={() => ask(draft)}
          disabled={!draft.trim() || thinking}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-300"
        >
          Ask
        </button>
      </PanelFooter>
    </PanelFrame>
  );
}
