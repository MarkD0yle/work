import type { FieldSource } from "../../lib/fundConnect/types";

/* Where the value in this field came from. Spec §2 and §4.
 *
 * "Imported" is the point of the import feature — you can see, field by
 * field, what you did not have to type. "Manually modified, verify" is the
 * gap import opens: a hand-edit on top of an imported value is exactly the
 * original risk, and without a badge it is invisible. */

const COPY: Record<FieldSource, { label: string; title: string; cls: string }> = {
  imported: {
    label: "Imported",
    title: "Written by the Excel import — not retyped.",
    cls: "border-neutral-300 bg-neutral-100 text-neutral-700",
  },
  modified: {
    label: "Modified · verify",
    title: "Imported, then hand-edited. Check it against the source before submitting.",
    cls: "border-amber-400 bg-amber-50 text-amber-900",
  },
  manual: {
    label: "Typed",
    title: "Entered by hand.",
    cls: "border-neutral-200 bg-white text-neutral-400",
  },
};

export default function SourceBadge({ source }: { source: FieldSource | null }) {
  if (!source) return null;
  const copy = COPY[source];
  return (
    <span
      title={copy.title}
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-[1px] text-[10px] font-medium tracking-wide uppercase ${copy.cls}`}
    >
      {copy.label}
    </span>
  );
}
