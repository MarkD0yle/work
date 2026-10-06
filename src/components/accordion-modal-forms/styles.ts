/* Shared tokens for the accordion + modal form examples. Kept in a plain
 * module so the component files stay fast-refresh friendly. Square corners
 * throughout — see the zero-radius rule in src/index.css. */

export const btnPrimary =
  "inline-flex items-center gap-1.5 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40";

export const btnSecondary =
  "inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40";

export const btnGhost =
  "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900";

export const btnDashed =
  "flex w-full items-center justify-center gap-2 border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-xs font-medium text-neutral-600 transition hover:border-neutral-500 hover:bg-white hover:text-neutral-900";

export const inputClass =
  "block w-full border border-neutral-300 bg-white px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 transition focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400";

export const labelClass =
  "text-[11px] font-semibold tracking-widest text-neutral-600 uppercase";

/* Tone chips used in entry summaries and radio pills. */
export const TONE = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  bad: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  muted: "border-neutral-200 bg-neutral-50 text-neutral-600",
} as const;

export type Tone = keyof typeof TONE;

/* Solid dot colours for the same tones (distribution bars, legends). */
export const TONE_DOT: Record<Tone, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
  info: "bg-sky-500",
  muted: "bg-neutral-300",
};

export function nextId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
