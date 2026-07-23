/* Generic {label, pass, note}[] renderer — reused for intelligence gaps,
 * narrative review checks, and rehearsal scoring checks (pattern lifted from
 * components/pitch/ReviewPanel.tsx's check list). */
function CheckIcon({ pass }: { pass: boolean }) {
  return (
    <span
      className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
        pass ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
      }`}
      aria-hidden
    >
      {pass ? "✓" : "!"}
    </span>
  );
}

export type CheckItem = { label: string; pass: boolean; note: string };

export function GapChecklist({ items }: { items: CheckItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.label} className="flex items-start gap-2">
          <CheckIcon pass={c.pass} />
          <span className="min-w-0">
            <span className="block text-xs font-medium text-neutral-800">{c.label}</span>
            <span className="block text-[11px] text-neutral-500">{c.note}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
