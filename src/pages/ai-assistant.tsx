import { useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightOpen, Plus, Search, Sparkles } from "lucide-react";
import { CLIENT, HISTORY } from "../components/ai-chat/data";
import { IconButton, type OpenArtifact } from "../components/ai-chat/blocks";
import { ContextPanel, type PanelTab } from "../components/ai-chat/ContextPanel";
import { Composer, ModeToggle, ThreadView, type ChatMode } from "../components/ai-chat/Thread";
import { FloatingLauncher, FloatingWindow } from "../components/ai-chat/FloatingChat";
import { DockRail, DockedPane } from "../components/ai-chat/DockedChat";
import { HostPage } from "../components/ai-chat/HostPage";
import { useChat } from "../components/ai-chat/useChat";
import { useLocalStorage } from "../hooks/useLocalStorage";

export const title = "AI Assistant";
export const section = "patterns";
export const fullWidth = true;

/* AI Assistant — a chat interface for a wealth / asset-management desk, in
 * three layouts that share one conversation:
 *
 *   Floating    — a launcher button over the user's current screen that
 *                 opens a 420px chat window. For a quick question.
 *   Docked      — a resizable side pane that pushes the page over rather
 *                 than covering it. For working alongside a dense screen.
 *   Full screen — history rail, thread, and a right panel (Context /
 *                 Workspace / Sources). For deep work on a question.
 *
 * A Floating | Docked | Full screen toggle switches between them, and each
 * widget's expand button goes to full screen. Anything in a widget that
 * needs the side panel (open a chart large, sources, context) expands to
 * full screen with that tab open. Mode and dock width are remembered per
 * browser.
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

export default function AiAssistant() {
  const chat = useChat();
  const [mode, setMode] = useLocalStorage<ChatMode>("ai-assistant.mode", "full");
  const [floatOpen, setFloatOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const [dockWidth, setDockWidth] = useLocalStorage("ai-assistant.dockWidth", 400);
  const [launcherFocus, setLauncherFocus] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 1280);
  const [tab, setTab] = useState<PanelTab>("context");
  const [activeArtifact, setActiveArtifact] = useState<string | null>(null);
  const [activeHistory, setActiveHistory] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Switching layout keeps the chat in view: the window or pane opens rather
  // than collapsing to its launcher.
  const changeMode = (m: ChatMode) => {
    setMode(m);
    if (m === "floating") setFloatOpen(true);
    if (m === "docked") setDockOpen(true);
  };

  const showPanel = (t: PanelTab) => {
    setTab(t);
    setPanelOpen(true);
    setMode("full");
  };

  const openArtifact: OpenArtifact = (a) => {
    setActiveArtifact(a.id);
    showPanel("workspace");
  };

  const newChat = () => {
    chat.reset();
    setActiveArtifact(null);
    setActiveHistory(null);
    setTab("context");
    inputRef.current?.focus();
  };

  if (mode === "docked") {
    return (
      <div className="flex h-full">
        <div className="min-w-0 flex-1">
          <HostPage toolbar={<ModeToggle mode={mode} onChange={changeMode} />} />
        </div>
        {dockOpen ? (
          <DockedPane
            chat={chat}
            width={dockWidth}
            onWidth={setDockWidth}
            onClose={() => setDockOpen(false)}
            onExpand={() => setMode("full")}
            onContext={() => showPanel("context")}
            onOpen={openArtifact}
            onSources={() => showPanel("sources")}
          />
        ) : (
          <DockRail onOpen={() => setDockOpen(true)} busy={chat.streaming} />
        )}
      </div>
    );
  }

  if (mode === "floating") {
    return (
      <>
        <HostPage toolbar={<ModeToggle mode={mode} onChange={changeMode} />} />
        {floatOpen ? (
          <FloatingWindow
            chat={chat}
            onMinimise={() => {
              setFloatOpen(false);
              setLauncherFocus(true);
            }}
            onExpand={() => setMode("full")}
            onContext={() => showPanel("context")}
            onOpen={openArtifact}
            onSources={() => showPanel("sources")}
          />
        ) : (
          <FloatingLauncher onOpen={() => setFloatOpen(true)} busy={chat.streaming} focusOnMount={launcherFocus} />
        )}
      </>
    );
  }

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
            <h1 className="truncate text-[14px] font-semibold">{chat.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-1.5 border border-neutral-200 px-2 py-1 text-[12px] text-neutral-600 lg:flex">
              <span className="h-1.5 w-1.5 bg-emerald-500" aria-hidden /> {CLIENT.name}
            </span>
            <ModeToggle mode={mode} onChange={changeMode} />
            {!panelOpen && (
              <IconButton label="Show context panel" onClick={() => setPanelOpen(true)}>
                <PanelRightOpen size={16} />
              </IconButton>
            )}
          </div>
        </header>

        <ThreadView chat={chat} onOpen={openArtifact} onSources={() => showPanel("sources")} />
        <Composer chat={chat} inputRef={inputRef} onContext={() => showPanel("context")} />
      </section>

      {/* Right: context / workspace / sources */}
      {panelOpen && (
        <div className="fixed inset-y-0 right-0 z-30 w-[min(400px,100vw)] bg-white pt-16 shadow-xl xl:static xl:z-auto xl:w-[400px] xl:shrink-0 xl:pt-0 xl:shadow-none">
          <ContextPanel
            tab={tab}
            onTab={setTab}
            onClose={() => setPanelOpen(false)}
            context={chat.context}
            onToggleSource={chat.toggleSource}
            artifacts={chat.artifacts}
            activeArtifact={activeArtifact}
            onPickArtifact={setActiveArtifact}
            sources={chat.lastAnswer?.role === "assistant" ? chat.lastAnswer.answer.sources : []}
          />
        </div>
      )}
    </div>
  );
}
