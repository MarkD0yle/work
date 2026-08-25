import { useEffect, useRef, useState } from "react";
import {
  COBRAND_CODES,
  parseCobrands,
  serialiseCobrands,
  type CobrandEntry,
  type CobrandScope,
} from "../../lib/fundConnect2/cobrands";

/* Fund distribution editor — the repeating group drawn as a table.
 *
 * The legacy layout stacked a full form block per cobrand (two offset
 * fields and a radio group each), so a handful of channels filled a page.
 * Here each cobrand is one compact row with sensible defaults (offsets 0,
 * no country restriction), "Add cobrand" only offers channels not already
 * added, and the whole section stays a few lines tall at any count. */

function OffsetInput({
  value,
  disabled,
  label,
  onChange,
}: {
  value: string;
  disabled: boolean;
  label: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9-]/g, ""))}
        aria-label={label}
        inputMode="numeric"
        className="w-16 rounded-md border border-neutral-300 bg-white px-2 py-1 text-right font-mono text-xs text-neutral-900 tabular-nums disabled:bg-neutral-50 disabled:text-neutral-500"
      />
      <span className="text-[10px] text-neutral-400">min</span>
    </div>
  );
}

export default function CobrandTable({
  value,
  readOnly,
  onChange,
}: {
  /** The record's `cobrands` field, in its serialised form. */
  value: string;
  readOnly: boolean;
  onChange: (raw: string) => void;
}) {
  const entries = parseCobrands(value);
  const remaining = COBRAND_CODES.filter((c) => !entries.some((e) => e.code === c));
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addOpen) return;
    function onDown(e: MouseEvent) {
      if (!addRef.current?.contains(e.target as Node)) setAddOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [addOpen]);

  function commit(next: CobrandEntry[]) {
    onChange(serialiseCobrands(next));
  }

  function patch(code: string, change: Partial<CobrandEntry>) {
    commit(entries.map((e) => (e.code === code ? { ...e, ...change } : e)));
  }

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-md text-[11px] leading-snug text-neutral-400">
          Channels the fund is offered through. Offsets are minutes relative to the
          fund's dealing cut-off — negative closes that channel earlier. New rows
          start at 0 / 0 / no restriction, so only deviations need touching.
        </p>
        {!readOnly && (
          <div ref={addRef} className="relative">
            <button
              type="button"
              onClick={() => setAddOpen((o) => !o)}
              disabled={remaining.length === 0}
              aria-expanded={addOpen}
              title={remaining.length === 0 ? "Every cobrand is already added." : undefined}
              className="rounded-md border border-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-neutral-900 hover:bg-neutral-900 hover:text-white disabled:border-neutral-200 disabled:text-neutral-400 disabled:hover:bg-white"
            >
              + Add cobrand
            </button>
            {addOpen && (
              <ul className="absolute right-0 z-30 mt-1 w-36 rounded-lg border border-neutral-200 bg-white py-1 shadow-xl">
                {remaining.map((code) => (
                  <li key={code}>
                    <button
                      type="button"
                      onClick={() => {
                        commit([...entries, { code, creation: "0", redemption: "0", scope: "none" }]);
                        setAddOpen(false);
                      }}
                      className="w-full px-3 py-1.5 text-left font-mono text-xs text-neutral-800 hover:bg-neutral-50"
                    >
                      {code}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 border border-dashed border-neutral-300 px-3 py-3 text-xs text-neutral-500">
          Not offered through any cobrand yet
          {readOnly ? "." : " — add one to set its dealing terms."}
        </p>
      ) : (
        <table className="mt-3 w-full text-left text-xs">
          <thead className="text-[10px] tracking-wide text-neutral-400 uppercase">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Cobrand</th>
              <th className="px-3 py-1.5 font-medium">Creation cut-off offset</th>
              <th className="px-3 py-1.5 font-medium">Redemption cut-off offset</th>
              <th className="px-3 py-1.5 font-medium">Country distribution</th>
              {!readOnly && <th className="py-1.5 pl-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {entries.map((e) => (
              <tr key={e.code}>
                <td className="py-2 pr-3 font-mono text-xs font-semibold text-neutral-900">
                  {e.code}
                </td>
                <td className="px-3 py-2">
                  <OffsetInput
                    value={e.creation}
                    disabled={readOnly}
                    label={`${e.code} creation cut-off offset in minutes`}
                    onChange={(v) => patch(e.code, { creation: v })}
                  />
                </td>
                <td className="px-3 py-2">
                  <OffsetInput
                    value={e.redemption}
                    disabled={readOnly}
                    label={`${e.code} redemption cut-off offset in minutes`}
                    onChange={(v) => patch(e.code, { redemption: v })}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="inline-flex border border-neutral-300">
                    {(
                      [
                        ["none", "None"],
                        ["all", "All institutions"],
                      ] as [CobrandScope, string][]
                    ).map(([scope, label]) => (
                      <button
                        key={scope}
                        type="button"
                        disabled={readOnly}
                        onClick={() => patch(e.code, { scope })}
                        aria-pressed={e.scope === scope}
                        className={`px-2 py-1 text-[11px] font-medium disabled:opacity-60 ${
                          e.scope === scope
                            ? "bg-neutral-900 text-white"
                            : "bg-white text-neutral-500 hover:text-neutral-900"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </td>
                {!readOnly && (
                  <td className="py-2 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => commit(entries.filter((x) => x.code !== e.code))}
                      aria-label={`Remove cobrand ${e.code}`}
                      title={`Remove ${e.code}`}
                      className="rounded-md border border-neutral-300 px-1.5 py-0.5 text-[11px] text-neutral-400 hover:border-red-400 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
