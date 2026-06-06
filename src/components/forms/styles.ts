/* Shared control styling for the form kit. Kept in a non-component module so
 * the component files can stay fast-refresh friendly (component-only exports)
 * while sharing one source of truth for input look + focus/error treatment. */

export const controlBase =
  "block w-full rounded-md border bg-white px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400";

export const controlTone = {
  default: "border-neutral-300 focus:border-neutral-500 focus:ring-neutral-900/10",
  error: "border-red-400 focus:border-red-500 focus:ring-red-500/15",
} as const;

export function controlClass(invalid: boolean, extra?: string) {
  return `${controlBase} ${invalid ? controlTone.error : controlTone.default}${
    extra ? ` ${extra}` : ""
  }`;
}
