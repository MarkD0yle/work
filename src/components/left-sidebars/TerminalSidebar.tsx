import { useState } from "react";
import { cx } from "../patterns/tokens";
import { ALL_ITEMS, NAV_MODULES, type SidebarProps } from "./nav-model";
import { SidebarFrame } from "./SidebarKit";

/* 9 — Dense terminal.
 *
 * For the operator who lives in this screen eight hours a day. The whole
 * platform in one flat list at 24 pixels a row, each page with a short code.
 * The command line at the top takes a code and Enter, so a practised user
 * never reaches for the mouse.
 *
 * Dark and monospaced on purpose: codes and counts line up in columns, and
 * the chrome recedes next to a light data grid.
 */

const focusDark =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-400";

const COUNT_TEXT: Record<string, string> = {
  negative: "text-red-400",
  warning: "text-amber-400",
  info: "text-sky-400",
  neutral: "text-neutral-400",
};

export function TerminalSidebar({ activeId, onNavigate }: SidebarProps) {
  const [command, setCommand] = useState("");
  const [unknown, setUnknown] = useState(false);

  function run() {
    const code = command.trim().toUpperCase();
    if (!code) return;
    const hit = ALL_ITEMS.find((item) => item.code === code);
    if (hit) {
      onNavigate(hit.id);
      setCommand("");
      setUnknown(false);
    } else {
      setUnknown(true);
    }
  }

  return (
    <SidebarFrame label="Dense terminal sidebar" className="w-60 font-mono text-[11px]" dark>
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-800 px-3">
        <span className="font-semibold tracking-widest text-white">KEEL</span>
        <span className="border border-red-500 px-1 text-[10px] leading-4 font-semibold text-red-400">
          PROD
        </span>
      </div>

      <div className="shrink-0 border-b border-neutral-800 px-3 py-2">
        <label className="flex items-center gap-2 bg-neutral-900 px-2 py-1 focus-within:outline focus-within:outline-amber-400">
          <span aria-hidden className="text-amber-400">
            GO&gt;
          </span>
          <input
            value={command}
            onChange={(e) => {
              setCommand(e.target.value);
              setUnknown(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && run()}
            aria-label="Go to page by code"
            aria-invalid={unknown}
            placeholder="CODE"
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-white uppercase outline-none placeholder:text-neutral-600"
          />
        </label>
        <p role="status" className="mt-1 h-3.5 text-[10px] text-neutral-500">
          {unknown ? (
            <span className="text-red-400">Unknown code. Codes are listed below.</span>
          ) : (
            "Type a code, press Enter"
          )}
        </p>
      </div>

      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto pb-2">
        {NAV_MODULES.map((module) => (
          <section key={module.id} aria-labelledby={`term-${module.id}`}>
            <h3
              id={`term-${module.id}`}
              className="mt-2 border-b border-neutral-800 px-3 pb-0.5 text-[10px] font-normal tracking-widest text-neutral-500 uppercase"
            >
              {module.label}
            </h3>
            <ul>
              {module.items.map((item) => {
                const on = item.id === activeId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      aria-current={on ? "page" : undefined}
                      className={cx(
                        "flex h-6 w-full items-center gap-2 px-3 text-left",
                        on
                          ? "bg-amber-400 text-neutral-950"
                          : "text-neutral-300 hover:bg-neutral-800 hover:text-white",
                        focusDark,
                      )}
                    >
                      <span
                        className={cx(
                          "w-9 shrink-0 font-semibold",
                          on ? "text-neutral-950" : "text-amber-400",
                        )}
                      >
                        {item.code}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.count ? (
                        <span
                          className={cx(
                            "shrink-0 font-semibold tabular-nums",
                            on ? "text-neutral-950" : COUNT_TEXT[item.tone ?? "neutral"],
                          )}
                        >
                          {item.count}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>

      <div className="flex shrink-0 items-center justify-between border-t border-neutral-800 px-3 py-2 text-[10px] text-neutral-500">
        <span className="text-neutral-300">PNAIR</span>
        <span>VD 18-NOV-26</span>
        <span>DUB</span>
      </div>
    </SidebarFrame>
  );
}
