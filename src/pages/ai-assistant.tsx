import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import {
  CLIENT,
  DEFAULT_CONTEXT,
  HISTORY,
  PROMPT_CARDS,
  answerFor,
  type Answer,
  type Block,
  type Message,
} from "../components/ai-chat/data";
import { BlockView, IconButton, type OpenArtifact } from "../components/ai-chat/blocks";
import { ContextPanel, type Artifact, type PanelTab } from "../components/ai-chat/ContextPanel";

export const title = "AI Assistant";
export const section = "patterns";
export const fullWidth = true;

/* AI Assistant — a chat interface for a wealth / asset-management desk.
 *
 * Borrows the patterns that work in Claude and Microsoft Copilot:
 *   - Empty state is a prompt gallery, not a blank box (Copilot).
 *   - Answers are structured: text, KPI tiles, charts and tables inline,
 *     each with copy + "open in panel" (Claude artifacts, Copilot cards).
 *   - A visible, collapsible "what I did" trace before the answer.
 *   - Numbered source chips on every answer; the panel lists them.
 *   - Follow-up suggestions under the latest answer.
 *   - Composer shows its grounding (active client chip), Enter to send,
 *     Shift+Enter for a new line, Stop while streaming.
 *   - Right panel shows what the assistant is looking at and lets the user
 *     switch data sources off — scope is never hidden.
 *
 * Financial-services additions: as-of timestamps on data, entitlement and
 * audit notice, and a warning when an answer needs a source that is off.
 * The model is mocked (components/ai-chat/data.ts).
 */

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

const now = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export default function AiAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [railOpen, setRailOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 1280);
  const [tab, setTab] = useState<PanelTab>("context");
  const [activeArtifact, setActiveArtifact] = useState<string | null>(null);
  const [activeHistory, setActiveHistory] = useState<string | null>(null);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const streaming = messages.some((m) => m.role === "assistant" && m.streaming);
  const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant");

  /* Reveal the streaming answer one block at a time. A real backend would push
   * tokens; one block per tick is enough to show the pattern. */
  useEffect(() => {
    if (!streaming) return;
    const t = window.setInterval(() => {
      setMessages((ms) =>
        ms.map((m) => {
          if (m.role !== "assistant" || !m.streaming) return m;
          const shown = m.shown + 1;
          return { ...m, shown, streaming: shown < m.answer.blocks.length };
        }),
      );
    }, 650);
    return () => window.clearInterval(t);
  }, [streaming]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const artifacts = useMemo<Artifact[]>(() => {
    const out: Artifact[] = [];
    messages.forEach((m) => {
      if (m.role !== "assistant") return;
      m.answer.blocks.slice(0, m.shown).forEach((b) => {
        if ((b.type === "chart" || b.type === "table") && !out.some((a) => a.id === b.id)) {
          out.push({ id: b.id, kind: b.type, title: b.spec.title, block: b });
        }
      });
    });
    return out;
  }, [messages]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || streaming) return;
    const base = answerFor(q);
    const off = base.sources.filter((s) => !context.find((c) => c.id === s.id)?.enabled);
    const answer: Answer = off.length
      ? {
          ...base,
          blocks: [
            {
              type: "callout",
              tone: "warn",
              text: `${off.map((s) => s.label).join(", ")} ${off.length > 1 ? "are" : "is"} switched off in Context. This answer may be incomplete.`,
            },
            ...base.blocks,
          ],
        }
      : base;
    setMessages((ms) => [
      ...ms,
      { id: `m${++idRef.current}`, role: "user", text: q, at: now() },
      { id: `m${++idRef.current}`, role: "assistant", answer, at: now(), streaming: true, shown: 0 },
    ]);
    setDraft("");
    setActiveHistory(null);
  };

  const stop = () =>
    setMessages((ms) => ms.map((m) => (m.role === "assistant" && m.streaming ? { ...m, streaming: false } : m)));

  const regenerate = (id: string) =>
    setMessages((ms) => ms.map((m) => (m.id === id && m.role === "assistant" ? { ...m, shown: 0, streaming: true } : m)));

  const newChat = () => {
    setMessages([]);
    setActiveArtifact(null);
    setActiveHistory(null);
    setTab("context");
    inputRef.current?.focus();
  };

  const openArtifact: OpenArtifact = (a) => {
    setActiveArtifact(a.id);
    setTab("workspace");
    setPanelOpen(true);
  };

  const openSources = () => {
    setTab("sources");
    setPanelOpen(true);
  };

  return (
    <div className="flex h-full bg-white text-neutral-900">
      {/* Left rail: conversations */}
      {railOpen && (
        <nav aria-label="Conversations" className="hidden w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 md:flex">
          <div className="flex items-center justify-between px-3 pt-16 pb-3">
            <div className="flex items-center gap-2 text-[14px] font-semibold">
              <Sparkles size={16} /> Assistant
            </div>
            <IconButton label="Hide conversations" onClick={() => setRailOpen(false)}>
              <PanelLeftClose size={16} />
            </IconButton>
          </div>
          <div className="space-y-2 px-3">
            <button
              type="button"
              onClick={newChat}
              className="flex w-full items-center gap-2 bg-neutral-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              <Plus size={15} /> New chat
            </button>
            <label className="flex items-center gap-2 border border-neutral-200 bg-white px-2.5 py-1.5">
              <Search size={14} className="text-neutral-400" />
              <input placeholder="Search chats" className="w-full bg-transparent text-[13px] outline-none placeholder:text-neutral-400" />
            </label>
          </div>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {(["Today", "Yesterday", "Last 7 days"] as const).map((g) => (
              <div key={g} className="mt-3">
                <div className="px-2 pb-1 text-[11px] font-medium text-neutral-500">{g}</div>
                {HISTORY.filter((h) => h.when === g).map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setActiveHistory(h.id)}
                    aria-current={activeHistory === h.id ? "page" : undefined}
                    className={`block w-full truncate px-2 py-1.5 text-left text-[13px] focus-visible:outline-2 focus-visible:outline-neutral-900 ${
                      activeHistory === h.id ? "bg-neutral-200 text-neutral-950" : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {h.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-neutral-200 px-3 py-3">
            <div className="grid h-7 w-7 place-items-center bg-neutral-800 text-[11px] font-semibold text-white">JO</div>
            <div className="min-w-0 text-[12px]">
              <div className="truncate font-medium">James Okafor</div>
              <div className="truncate text-neutral-500">Wealth · London desk</div>
            </div>
          </div>
        </nav>
      )}

      {/* Centre: thread + composer */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header
          className={`flex h-12 shrink-0 items-center justify-between gap-2 border-b border-neutral-200 pr-3 ${railOpen ? "pl-32 md:pl-4" : "pl-32"}`}
        >
          <div className="flex min-w-0 items-center gap-2">
            {!railOpen && (
              <IconButton label="Show conversations" onClick={() => setRailOpen(true)}>
                <PanelLeftOpen size={16} />
              </IconButton>
            )}
            <h1 className="truncate text-[14px] font-semibold">
              {messages.find((m) => m.role === "user")?.text ?? "New chat"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 border border-neutral-200 px-2 py-1 text-[12px] text-neutral-600 sm:flex">
              <span className="h-1.5 w-1.5 bg-emerald-500" aria-hidden /> {CLIENT.name}
            </span>
            {!panelOpen && (
              <IconButton label="Show context panel" onClick={() => setPanelOpen(true)}>
                <PanelRightOpen size={16} />
              </IconButton>
            )}
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {messages.length === 0 ? (
              <EmptyState onPick={send} />
            ) : (
              <ol className="space-y-8" aria-live="polite">
                {messages.map((m) =>
                  m.role === "user" ? (
                    <li key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] bg-neutral-100 px-4 py-2.5 text-[14px] leading-relaxed text-neutral-900">{m.text}</div>
                    </li>
                  ) : (
                    <AssistantMessage
                      key={m.id}
                      msg={m}
                      isLast={m.id === lastAnswer?.id}
                      onOpen={openArtifact}
                      onSources={openSources}
                      onFollowUp={send}
                      onRegenerate={() => regenerate(m.id)}
                    />
                  ),
                )}
              </ol>
            )}
          </div>
        </div>

        <Composer
          inputRef={inputRef}
          draft={draft}
          setDraft={setDraft}
          streaming={streaming}
          onSend={() => send(draft)}
          onStop={stop}
          onContext={() => {
            setTab("context");
            setPanelOpen(true);
          }}
        />
      </section>

      {/* Right: context / workspace / sources */}
      {panelOpen && (
        <div className="fixed inset-y-0 right-0 z-30 w-[min(400px,100vw)] bg-white pt-16 shadow-xl xl:static xl:pt-0 xl:z-auto xl:w-[400px] xl:shrink-0 xl:shadow-none">
          <ContextPanel
            tab={tab}
            onTab={setTab}
            onClose={() => setPanelOpen(false)}
            context={context}
            onToggleSource={(id) => setContext((cs) => cs.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)))}
            artifacts={artifacts}
            activeArtifact={activeArtifact}
            onPickArtifact={setActiveArtifact}
            sources={lastAnswer?.role === "assistant" ? lastAnswer.answer.sources : []}
          />
        </div>
      )}
    </div>
  );
}

/* --- Empty state: greeting + guiding prompts ----------------------------------- */

function EmptyState({ onPick }: { onPick: (p: string) => void }) {
  return (
    <div className="pt-10">
      <div className="grid h-10 w-10 place-items-center bg-neutral-900 text-white">
        <Sparkles size={18} />
      </div>
      <h2 className="mt-4 text-[24px] font-semibold tracking-tight text-neutral-950">{greeting()}, James</h2>
      <p className="mt-1 text-[15px] text-neutral-500">
        Ask about <span className="text-neutral-800">{CLIENT.name}</span>. I can pull performance, exposure, risk and client notes.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
  isLast,
  onOpen,
  onSources,
  onFollowUp,
  onRegenerate,
}: {
  msg: Extract<Message, { role: "assistant" }>;
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
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center bg-neutral-900 text-white" aria-hidden>
        <Sparkles size={14} />
      </div>
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
            <BlockView block={b} onOpen={onOpen} />
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
              <div className="flex flex-wrap gap-2 pt-1">
                {answer.followUps.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => onFollowUp(f)}
                    className="border border-neutral-200 bg-white px-3 py-1.5 text-[13px] text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-neutral-900"
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

function Composer({
  inputRef,
  draft,
  setDraft,
  streaming,
  onSend,
  onStop,
  onContext,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  draft: string;
  setDraft: (v: string) => void;
  streaming: boolean;
  onSend: () => void;
  onStop: () => void;
  onContext: () => void;
}) {
  // Auto-grow up to ~8 lines, then scroll.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft, inputRef]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="shrink-0 px-4 pt-2 pb-3">
      <div className="mx-auto w-full max-w-3xl">
        <div className="border border-neutral-300 bg-white shadow-sm focus-within:border-neutral-900">
          <label htmlFor="ai-input" className="sr-only">
            Message the assistant
          </label>
          <textarea
            id="ai-input"
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask about performance, risk, holdings or the client…"
            className="block w-full resize-none bg-transparent px-4 pt-3 pb-1 text-[14px] leading-relaxed outline-none placeholder:text-neutral-400"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex items-center gap-1">
              <IconButton label="Attach file" onClick={() => {}}>
                <Paperclip size={15} />
              </IconButton>
              <button
                type="button"
                onClick={onContext}
                className="flex items-center gap-1.5 border border-neutral-200 px-2 py-1 text-[12px] text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
              >
                <span className="h-1.5 w-1.5 bg-emerald-500" aria-hidden />@{CLIENT.name.split(" ").slice(0, 2).join(" ")}
              </button>
            </div>
            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="grid h-8 w-8 place-items-center bg-neutral-900 text-white hover:bg-neutral-700"
              >
                <Square size={12} className="fill-white" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!draft.trim()}
                aria-label="Send message"
                className="grid h-8 w-8 place-items-center bg-neutral-900 text-white hover:bg-neutral-700 disabled:bg-neutral-200 disabled:text-neutral-400"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-neutral-400">
          AI can make mistakes. Check figures before sharing with clients. Not investment advice.
        </p>
      </div>
    </div>
  );
}
