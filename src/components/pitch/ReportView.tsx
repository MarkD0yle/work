import { SECTION_DEFS } from "../../lib/pitch/sections";
import { fmtMoney } from "../../lib/pitch/data";
import type { Pitch } from "../../lib/pitch/types";

export function ReportView({ pitch }: { pitch: Pitch }) {
  const { client } = pitch.data;
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="border-b border-neutral-100 px-6 py-5">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          Client pitch · prepared by {client.advisor}
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">
          {client.name}
        </h1>
        {pitch.objective && (
          <p className="mt-1 text-sm text-neutral-600">
            Objective: <span className="text-neutral-800">{pitch.objective}</span>
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-500">
          <span>
            AUM <span className="font-mono font-medium text-neutral-700">{fmtMoney(client.aum)}</span>
          </span>
          <span>
            Risk profile <span className="font-medium text-neutral-700">{client.riskProfile}</span>
          </span>
          <span>
            Segment <span className="font-medium text-neutral-700">{client.segment}</span>
          </span>
          <span>
            Prepared <span className="font-medium text-neutral-700">{new Date(pitch.updatedAt).toLocaleDateString()}</span>
          </span>
        </div>
      </header>

      <div className="divide-y divide-neutral-100">
        {SECTION_DEFS.map((def) => {
          const section = pitch.sections[def.id];
          return (
            <section key={def.id} className="px-6 py-5">
              <h2 className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                {def.label}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-800">
                {section.content || <span className="text-neutral-300 italic">Not drafted.</span>}
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
