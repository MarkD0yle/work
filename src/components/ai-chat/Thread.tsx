import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Maximize2,
  Paperclip,
  PictureInPicture2,
  RotateCcw,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { CLIENT, PROMPT_CARDS, type Block, type Message } from "./data";
import { BlockView, IconButton, type OpenArtifact } from "./blocks";
import type { Chat } from "./useChat";

/* The conversation itself — empty state, messages, composer — shared by the
 * full-screen page and the floating widget.
 *
 * `compact` is the only switch between them. Inner layout (KPI columns,
 * prompt grid) responds to the container via Tailwind container queries
 * (`@container` / `@md:`), not the viewport, so a 400px widget on a 1600px
 * screen still gets the narrow layout.
 */

export type ChatMode = "full" | "floating";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

/* --- Mode toggle: Floating | Full screen --------------------------------------- */

export function ModeToggle({ mode, onChange }: { mode: ChatMode; onChange: (m: ChatMode) => void }) {
  const opts: { id: ChatMode; label: string; icon: typeof Maximize2 }[] = [
    { id: "floating", label: "Floating", icon: PictureInPicture2 },
    { id: "full", label: "Full screen", icon: Maximize2 },
  ];
  return (
    <div role="radiogroup" aria-label="Chat layout" className="flex border border-neutral-200 bg-neutral-50 p-0.5">
      {opts.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          aria-label={label}
          title={label}
          onClick={() => onChange(id)}
          className={`flex h-7 items-center gap-1.5 px-2 text-[12px] font-medium focus-visible:outline-2 focus-visible:outline-neutral-900 ${
            mode === id ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <Icon size={13} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

/* --- Thread: scroll area with empty state or messages ------------------------- */

export function ThreadView({
  chat,
  compact = false,
  onOpen,
  onSources,
}: {
  chat: Chat;
  compact?: boolean;
  onOpen: OpenArtifact;
  onSources: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, lastAnswer } = chat;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div ref={scrollRef} className="@container min-h-0 flex-1 overflow-y-auto">
      <div className={`mx-auto w-full max-w-3xl ${compact ? "px-4 py-4" : "px-4 py-6"}`}>
        {messages.length === 0 ? (
          <EmptyState onPick={chat.send} compact={compact} />
        ) : (
          <ol className={compact ? "space-y-6" : "space-y-8"} aria-live="polite">
            {messages.map((m) =>
              m.role === "user" ? (
                <li key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] bg-neutral-100 px-4 py-2.5 text-[14px] leading-relaxed text-neutral-900">{m.text}</div>
                </li>
              ) : (
                <AssistantMessage
                  key={m.id}
                  msg={m}
                  compact={compact}
                  isLast={m.id === lastAnswer?.id}
                  onOpen={onOpen}
                  onSources={onSources}
                  onFollowUp={chat.send}
                  onRegenerate={() => chat.regenerate(m.id)}
                />
              ),
            )}
          </ol>
        )}
      </div>
    </div>
  );
}

/* --- Empty state: greeting + guiding prompts ----------------------------------- */

function EmptyState({ onPick, compact }: { onPick: (p: string) => void; compact: boolean }) {
  if (compact) {
    // Widget: fewer, shorter prompts as a list — a 400px panel can't hold a grid.
    return (
      <div className="pt-2">
        <h2 className="text-[18px] font-semibold tracking-tight text-neutral-950">{greeting()}, James</h2>
        <p className="mt-1 text-[13px] text-neutral-500">
          Ask about <span className="text-neutral-800">{CLIENT.name}</span>.
        </p>
        <div className="mt-5 text-[11px] font-medium tracking-wide text-neutral-500 uppercase">Try asking</div>
        <ul className="mt-2 divide-y divide-neutral-100 border border-neutral-200">
          {PROMPT_CARDS.slice(0, 4).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c.prompt)}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-900"
              >
                <span className="w-[72px] shrink-0 pt-px text-[10px] font-medium tracking-wide text-neutral-400 uppercase">{c.group}</span>
                <span className="text-[13px] leading-snug text-neutral-800">{c.prompt}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="pt-10">
      <div className="grid h-10 w-10 place-items-center bg-neutral-900 text-white">
        <Sparkles size={18} />
      </div>
      <h2 className="mt-4 text-[24px] font-semibold tracking-tight text-neutral-950">{greeting()}, James</h2>
      <p className="mt-1 text-[15px] text-neutral-500">
        Ask about <span className="text-neutral-800">{CLIENT.name}</span>. I can pull performance, exposure, risk and client notes.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-3 @lg:grid-cols-2 @3xl:grid-cols-3">
        {PROMPT_CARDS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.prompt)}
            className="group flex flex-col items-start border border-neutral-200 bg-white p-3.5 text-left transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            <span className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">{c.group}</span>
            <span className="mt-1 text-[14px] font-semibold text-neutral-900">{c.title}</span>
            <span className="mt-1 text-[12px] leading-snug text-neutral-500">{c.prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* --- Assistant message --------------------------------------------------------- */

function AssistantMessage({
  msg,
  compact,
  isLast,
  onOpen,
  onSources,
  onFollowUp,
  onRegenerate,
}: {
  msg: Extract<Message, { role: "assistant" }>;
  compact: boolean;
  isLast: boolean;
  onOpen: OpenArtifact;
  onSources: () => void;
  onFollowUp: (p: string) => void;
  onRegenerate: () => void;
}) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);
  const { answer, shown, streaming } = msg;
  const blocks = answer.blocks.slice(0, shown);
  const done = !streaming;
  const stopped = done && shown < answer.blocks.length;

  const copy = () => {
    const text = answer.blocks
      .filter((b): b is Extract<Block, { type: "text" }> => b.type === "text")
      .map((b) => b.md.replace(/\*\*/g, ""))
      .join("\n\n");
    void navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <li className="flex gap-3">
      {/* In the widget every pixel of width goes to the answer, so no avatar. */}
      {!compact && (
        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center bg-neutral-900 text-white" aria-hidden>
          <Sparkles size={14} />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-3">
        {/* Reasoning trace */}
        <button
          type="button"
          onClick={() => setStepsOpen((o) => !o)}
          aria-expanded={stepsOpen}
          className="flex items-center gap-1.5 text-[12px] text-neutral-500 hover:text-neutral-800"
        >
          {streaming && shown === 0 ? (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse bg-neutral-900" /> Working — {answer.steps[0].toLowerCase()}…
            </span>
          ) : (
            <>Used {answer.steps.length} steps · {answer.sources.length} sources</>
          )}
          <ChevronDown size={13} className={stepsOpen ? "rotate-180" : ""} />
        </button>
        {stepsOpen && (
          <ol className="space-y-1 border-l-2 border-neutral-200 pl-3 text-[12px] text-neutral-600">
            {answer.steps.map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <Check size={12} className="text-emerald-600" /> {s}
              </li>
            ))}
          </ol>
        )}

        {blocks.map((b, i) => (
          <div key={i} className="ai-block-in">
            <BlockView block={b} onOpen={onOpen} compact={compact} />
          </div>
        ))}

        {streaming && shown > 0 && <div className="h-4 w-2 animate-pulse bg-neutral-900" aria-label="Generating" />}
        {stopped && <div className="text-[12px] text-neutral-500 italic">Stopped. Regenerate to see the full answer.</div>}

        {done && (
          <>
            {answer.sources.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {answer.sources.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={onSources}
                    className="flex items-center gap-1.5 border border-neutral-200 px-2 py-1 text-[11px] text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
                  >
                    <span className="grid h-4 w-4 place-items-center bg-neutral-900 font-mono text-[9px] text-white">{i + 1}</span>
                    {s.system}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-0.5 text-neutral-500">
              <IconButton label={copied ? "Copied" : "Copy answer"} onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </IconButton>
              <IconButton label="Regenerate" onClick={onRegenerate}>
                <RotateCcw size={14} />
              </IconButton>
              <IconButton label="Good answer" onClick={() => setVote(vote === "up" ? null : "up")}>
                <ThumbsUp size={14} className={vote === "up" ? "fill-neutral-900 text-neutral-900" : ""} />
              </IconButton>
              <IconButton label="Bad answer" onClick={() => setVote(vote === "down" ? null : "down")}>
                <ThumbsDown size={14} className={vote === "down" ? "fill-neutral-900 text-neutral-900" : ""} />
              </IconButton>
              <span className="ml-2 text-[11px] text-neutral-400">{msg.at}</span>
            </div>

            {isLast && answer.followUps.length > 0 && (
              <div className={compact ? "flex flex-col items-start gap-1.5 pt-1" : "flex flex-wrap gap-2 pt-1"}>
                {answer.followUps.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => onFollowUp(f)}
                    className="border border-neutral-200 bg-white px-3 py-1.5 text-left text-[13px] text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-neutral-900"
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/* --- Composer ------------------------------------------------------------------ */

export function Composer({
  chat,
  inputRef,
  compact = false,
  onContext,
}: {
  chat: Chat;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  compact?: boolean;
  onContext: () => void;
}) {
  const { draft, setDraft, streaming } = chat;

  // Auto-grow up to ~8 lines (5 in the widget), then scroll.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, compact ? 120 : 200)}px`;
  }, [draft, inputRef, compact]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      chat.send(draft);
    }
  };

  return (
    <div className={`shrink-0 ${compact ? "border-t border-neutral-200 px-3 pt-3 pb-2" : "px-4 pt-2 pb-3"}`}>
      <div className="mx-auto w-full max-w-3xl">
        <div className="border border-neutral-300 bg-white shadow-sm focus-within:border-neutral-900">
          <label htmlFor={compact ? "ai-input-float" : "ai-input"} className="sr-only">
            Message the assistant
          </label>
          <textarea
            id={compact ? "ai-input-float" : "ai-input"}
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder={compact ? "Ask a question…" : "Ask about performance, risk, holdings or the client…"}
            className="block w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-[14px] leading-relaxed outline-none placeholder:text-neutral-400"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex min-w-0 items-center gap-1">
              <IconButton label="Attach file" onClick={() => {}}>
                <Paperclip size={15} />
              </IconButton>
              <button
                type="button"
                onClick={onContext}
                title="Show context"
                className="flex min-w-0 items-center gap-1.5 border border-neutral-200 px-2 py-1 text-[12px] text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
              >
                <span className="h-1.5 w-1.5 shrink-0 bg-emerald-500" aria-hidden />
                <span className="truncate">@{CLIENT.name.split(" ").slice(0, 2).join(" ")}</span>
              </button>
            </div>
            {streaming ? (
              <button
                type="button"
                onClick={chat.stop}
                aria-label="Stop generating"
                className="grid h-8 w-8 shrink-0 place-items-center bg-neutral-900 text-white hover:bg-neutral-700"
              >
                <Square size={12} className="fill-white" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => chat.send(draft)}
                disabled={!draft.trim()}
                aria-label="Send message"
                className="grid h-8 w-8 shrink-0 place-items-center bg-neutral-900 text-white hover:bg-neutral-700 disabled:bg-neutral-200 disabled:text-neutral-400"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-neutral-400">
          {compact ? "AI can make mistakes. Not investment advice." : "AI can make mistakes. Check figures before sharing with clients. Not investment advice."}
        </p>
      </div>
    </div>
  );
}
