import type { NarrativeSectionDef } from "../../lib/pitchPerfect/narrative";

/* Adapted from components/pitch/SectionEditor.tsx, retyped for
 * NarrativeSectionDef (id: NarrativeSectionId instead of SectionId). */
export function NarrativeEditor({
  def,
  content,
  onChange,
  facts,
}: {
  def: NarrativeSectionDef;
  content: string;
  onChange: (value: string) => void;
  facts: { label: string; value: string }[];
}) {
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const short = words > 0 && words < def.minWords;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">{def.label}</h2>
          <span className={`text-[11px] tabular-nums ${short ? "text-amber-600" : "text-neutral-400"}`}>
            {words} words{short ? ` · aim for ${def.minWords}+` : ""}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">{def.help}</p>
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Draft the ${def.label.toLowerCase()}…`}
          className="mt-3 block min-h-[220px] w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-400 transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
        />
      </div>

      <aside className="rounded-lg border border-neutral-200 bg-neutral-50 p-3.5">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Source data</div>
        {facts.length === 0 ? (
          <p className="mt-2 text-xs text-neutral-400">No specific facts flagged for this section.</p>
        ) : (
          <dl className="mt-2 space-y-2.5">
            {facts.map((f, i) => (
              <div key={`${f.label}-${i}`}>
                <dt className="text-[11px] font-medium text-neutral-500">{f.label}</dt>
                <dd className="mt-0.5 text-xs leading-snug text-neutral-800">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </aside>
    </div>
  );
}
