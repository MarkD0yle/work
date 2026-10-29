import { useEffect, useMemo, useRef, useState } from "react";
import { CLIENT_SCOPE, type Answer, type Message, type Scope, type ScopeId } from "./data";
import { BLOTTER_SCOPE } from "./blotterScope";
import type { Artifact } from "./ContextPanel";

/* One conversation, shared by every layout.
 *
 * Floating, docked and full screen are presentations of the same chat, so the
 * state lives here, above them. Switching mode mid-answer keeps the thread,
 * the draft and the streaming answer exactly where they were — the same
 * promise Copilot makes when you pop its pane in and out.
 *
 * The scope (client or blotter) also lives here. Changing it keeps the
 * thread and drops a note into it, so earlier answers stay readable but it
 * is clear the next one is about something else.
 */

export const SCOPES: Record<ScopeId, Scope> = { client: CLIENT_SCOPE, blotter: BLOTTER_SCOPE };

const now = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function useChat(initialScope: ScopeId = "client") {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [scopeId, setScopeId] = useState<ScopeId>(initialScope);
  const scope = SCOPES[scopeId];
  const [context, setContext] = useState(scope.defaultContext);
  const idRef = useRef(0);

  const streaming = messages.some((m) => m.role === "assistant" && m.streaming);
  const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant");
  const title = messages.find((m) => m.role === "user")?.text ?? "New chat";

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
    if (!q || streaming) return false;
    const base = scope.answer(q);
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
    return true;
  };

  const stop = () =>
    setMessages((ms) => ms.map((m) => (m.role === "assistant" && m.streaming ? { ...m, streaming: false } : m)));

  const regenerate = (id: string) =>
    setMessages((ms) => ms.map((m) => (m.id === id && m.role === "assistant" ? { ...m, shown: 0, streaming: true } : m)));

  const reset = () => {
    setMessages([]);
    setDraft("");
  };

  const switchScope = (id: ScopeId) => {
    if (id === scopeId) return;
    stop();
    setScopeId(id);
    setContext(SCOPES[id].defaultContext);
    if (messages.length) {
      setMessages((ms) => [...ms, { id: `m${++idRef.current}`, role: "note", text: `Now looking at ${SCOPES[id].name}`, at: now() }]);
    }
  };

  const toggleSource = (id: string) => setContext((cs) => cs.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));

  return {
    messages,
    draft,
    setDraft,
    scope,
    switchScope,
    context,
    toggleSource,
    streaming,
    lastAnswer,
    title,
    artifacts,
    send,
    stop,
    regenerate,
    reset,
  };
}

export type Chat = ReturnType<typeof useChat>;
