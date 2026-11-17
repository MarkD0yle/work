/* ETE Fund Configuration — class strings shared by the workspace.
 *
 * Only utility classes that fund-connect-2.css remaps under `.fc2-dark` are
 * used, so the workspace follows the page's dark mode without its own rules.
 * Square corners throughout; pills and dots stay round. */

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

export const btn = {
  primary: `inline-flex items-center gap-1.5 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300 ${FOCUS}`,
  secondary: `inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:border-neutral-200 disabled:text-neutral-400 ${FOCUS}`,
  warn: `inline-flex items-center gap-1.5 border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50 disabled:border-neutral-200 disabled:text-neutral-400 ${FOCUS}`,
  link: `text-xs font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-600 ${FOCUS}`,
  ghost: `inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 ${FOCUS}`,
};

export const control =
  "w-full border bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-500";

export const label = "text-[11px] font-medium text-neutral-600";
export const eyebrow = "text-[10px] font-semibold tracking-wide text-neutral-400 uppercase";
export const muted = "text-xs text-neutral-500";
export const focusRing = FOCUS;

export type Tone = "neutral" | "info" | "warn" | "bad" | "good";

export const toneSoft: Record<Tone, string> = {
  neutral: "border-neutral-300 bg-neutral-100 text-neutral-700",
  info: "border-blue-300 bg-blue-50 text-blue-800",
  warn: "border-amber-400 bg-amber-50 text-amber-900",
  bad: "border-red-400 bg-red-50/40 text-red-700",
  good: "border-emerald-400 bg-emerald-50 text-emerald-800",
};

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
