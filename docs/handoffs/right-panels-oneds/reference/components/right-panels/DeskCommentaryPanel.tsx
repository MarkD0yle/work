import { useEffect, useRef, useState } from "react";
import {
  PanelBody,
  PanelFooter,
  PanelFrame,
  PanelHeader,
  PanelSection,
  Pill,
} from "./PanelKit";

/* 10 · Collaboration — desk commentary.
 *
 * People rather than data, which changes what the panel owes the reader.
 * Chronology runs oldest to newest so the thread reads like a conversation,
 * the composer is pinned to the footer, and unread work is marked rather than
 * hidden.
 *
 * The surveillance banner sits above the scroll region and cannot be scrolled
 * past. On a regulated desk, "this is recorded" is not a footnote — anyone
 * about to type here has to have seen it, so it costs a permanent 40px.
 */

type Comment = {
  id: number;
  author: string;
  initials: string;
  role: string;
  at: string;
  body: string;
  mentions?: string[];
  system?: boolean;
};

const THREAD: Comment[] = [
  {
    id: 1,
    author: "System",
    initials: "—",
    role: "",
    at: "14 Aug 09:02",
    body: "Position flagged for review — vega concentration above desk guidance on the Dec 26 bucket.",
    system: true,
  },
  {
    id: 2,
    author: "Ravi Menon",
    initials: "RM",
    role: "Trader",
    at: "14 Aug 09:41",
    body: "Aware. It's the SX5E structured flow from last week — we keep the vega until the client leg prices on the 22nd, then it comes off naturally.",
  },
  {
    id: 3,
    author: "Claudia Ferrer",
    initials: "CF",
    role: "Market risk",
    at: "14 Aug 11:15",
    body: "Understood, but that's eight sessions above guidance. Can we hedge a third of it with listed Dec options in the meantime?",
    mentions: ["Ravi Menon"],
  },
  {
    id: 4,
    author: "Ravi Menon",
    initials: "RM",
    role: "Trader",
    at: "14 Aug 11:48",
    body: "Listed is thin above the 5200 strike — we'd pay away most of the structure's edge. Proposing we hedge 20% and revisit Monday.",
  },
  {
    id: 5,
    author: "Sofia Beaumont",
    initials: "SB",
    role: "Desk head",
    at: "15 Aug 08:20",
    body: "Agreed on 20% now, full review Monday morning. Please attach the revised vega ladder before then.",
    mentions: ["Claudia Ferrer", "Ravi Menon"],
  },
];

export function DeskCommentaryPanel({ onClose }: { onClose?: () => void }) {
  const [thread, setThread] = useState<Comment[]>(THREAD);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread]);

  function post() {
    const body = draft.trim();
    if (!body) return;
    setThread((t) => [
      ...t,
      {
        id: t.length + 1,
        author: "You",
        initials: "YO",
        role: "Structuring",
        at: "16 Aug 14:02",
        body,
      },
    ]);
    setDraft("");
  }

  return (
    <PanelFrame accent="warn" label="Desk commentary">
      <PanelHeader
        eyebrow="Discussion"
        title="Vega concentration"
        subtitle="Position EQD-SX5E-DEC26 · 5 participants"
        onClose={onClose}
        badge={<Pill tone="warn">Open review</Pill>}
      />

      {/* Non-negotiable and non-scrollable. */}
      <div className="flex shrink-0 items-start gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2.5">
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600"
        >
          <path
            fillRule="evenodd"
            d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-[11px] leading-snug text-amber-800">
          Recorded communication. Retained 7 years and subject to trade
          surveillance.
        </p>
      </div>

      <PanelBody>
        <div className="space-y-4 px-5 py-4">
          {thread.map((c) =>
            c.system ? (
              <div
                key={c.id}
                className="flex items-start gap-2 rounded-md bg-neutral-50 px-2.5 py-2"
              >
                <span className="mt-1 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                <p className="text-[11px] leading-snug text-neutral-500">
                  {c.body}
                  <span className="ml-1.5 text-neutral-400 tabular-nums">
                    {c.at}
                  </span>
                </p>
              </div>
            ) : (
              <div key={c.id} className="flex gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">
                  {c.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-neutral-900">
                      {c.author}
                    </span>
                    <span className="text-[10px] text-neutral-400">{c.role}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-neutral-400 tabular-nums">
                      {c.at}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-700">
                    {c.body}
                  </p>
                  {c.mentions && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.mentions.map((m) => (
                        <span
                          key={m}
                          className="rounded bg-sky-50 px-1.5 py-px text-[10px] font-medium text-sky-700"
                        >
                          @{m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>

        <PanelSection title="Attached" dense last>
          <ul className="space-y-1">
            {[
              { name: "vega-ladder-15aug.xlsx", meta: "C. Ferrer · 128 KB" },
              { name: "sx5e-structure-term-sheet.pdf", meta: "R. Menon · 412 KB" },
            ].map((f) => (
              <li key={f.name}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md border border-neutral-200 px-2.5 py-1.5 text-left hover:bg-neutral-50"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3.5 w-3.5 shrink-0 text-neutral-400"
                  >
                    <path d="M4 3.5A1.5 1.5 0 0 1 5.5 2h5.379a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 15.5 6.62V16.5A1.5 1.5 0 0 1 14 18H5.5A1.5 1.5 0 0 1 4 16.5v-13Z" />
                  </svg>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium text-neutral-900">
                      {f.name}
                    </span>
                    <span className="block text-[10px] text-neutral-400">
                      {f.meta}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PanelSection>
      </PanelBody>

      <PanelFooter>
        <div className="flex w-full flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Reply — use @ to mention someone…"
            aria-label="Reply to thread"
            className="w-full resize-none rounded-md border border-neutral-300 px-2.5 py-2 text-xs text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-neutral-300 px-2 py-1.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100"
            >
              Attach
            </button>
            <span className="text-[10px] text-neutral-400">
              Visible to EQD desk & risk
            </span>
            <button
              type="button"
              onClick={post}
              disabled={!draft.trim()}
              className="ml-auto rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-300"
            >
              Post
            </button>
          </div>
        </div>
      </PanelFooter>
    </PanelFrame>
  );
}
