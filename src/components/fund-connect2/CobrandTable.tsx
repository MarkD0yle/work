import {
  COBRAND_CODES,
  COUNTRY_CODES,
  parseCobrands,
  serialiseCobrands,
  type CobrandEntry,
  type CobrandScope,
} from "../../lib/fundConnect2/cobrands";

/* Fund distribution editor — the repeating group drawn as a table.
 *
 * The legacy layout stacked a full form block per cobrand, so a handful of
 * channels filled a page. Here:
 *   - the channel set is small and fixed, so there is no dropdown at all:
 *     every cobrand is a visible toggle chip — added channels are filled,
 *     available ones outlined, one click either way
 *   - each added cobrand is one compact row with sensible defaults
 *     (offsets 0, no country restriction), so only deviations need touching
 *   - country distribution is a three-way control; picking "Countries"
 *     reveals toggle chips for the markets, again with nothing hidden
 */

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

  function commit(next: CobrandEntry[]) {
    onChange(serialiseCobrands(next));
  }

  function patch(code: string, change: Partial<CobrandEntry>) {
    commit(entries.map((e) => (e.code === code ? { ...e, ...change } : e)));
  }

  function toggleChannel(code: string) {
    const added = entries.some((e) => e.code === code);
    if (added) {
      commit(entries.filter((e) => e.code !== code));
    } else {
      commit([...entries, { code, creation: "0", redemption: "0", scope: "none", countries: [] }]);
    }
  }

  return (
    <div className="px-4 py-3">
      <p className="max-w-xl text-[11px] leading-snug text-neutral-400">
        Channels the fund is offered through — click a channel to add or remove it.
        Offsets are minutes relative to the fund's dealing cut-off; negative closes
        that channel earlier. New channels start at 0 / 0 / no restriction, so only
        deviations need touching.
      </p>

      {/* Every cobrand, always visible: filled = offered, outlined = available. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {COBRAND_CODES.map((code) => {
          const added = entries.some((e) => e.code === code);
          return (
            <button
              key={code}
              type="button"
              disabled={readOnly}
              onClick={() => toggleChannel(code)}
              aria-pressed={added}
              title={
                readOnly
                  ? undefined
                  : added
                    ? `Remove ${code} and its terms`
                    : `Offer the fund through ${code}`
              }
              className={`rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium disabled:opacity-60 ${
                added
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-500 hover:border-neutral-900 hover:text-neutral-900"
              }`}
            >
              {added ? "✓ " : "+ "}
              {code}
            </button>
          );
        })}
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 border border-dashed border-neutral-300 px-3 py-3 text-xs text-neutral-500">
          Not offered through any cobrand yet
          {readOnly ? "." : " — click a channel above to set its dealing terms."}
        </p>
      ) : (
        <table className="mt-3 w-full text-left text-xs">
          <thead className="text-[10px] tracking-wide text-neutral-400 uppercase">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Cobrand</th>
              <th className="px-3 py-1.5 font-medium">Creation cut-off offset</th>
              <th className="px-3 py-1.5 font-medium">Redemption cut-off offset</th>
              <th className="px-3 py-1.5 font-medium">Country distribution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {entries.map((e) => (
              <tr key={e.code} className="align-top">
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
                        ["countries", "Countries"],
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
                        {scope === "countries" && e.scope === "countries" && e.countries.length > 0
                          ? `Countries (${e.countries.length})`
                          : label}
                      </button>
                    ))}
                  </div>
                  {e.scope === "countries" && (
                    <div className="mt-1.5 flex max-w-sm flex-wrap gap-1">
                      {COUNTRY_CODES.map((cc) => {
                        const on = e.countries.includes(cc);
                        return (
                          <button
                            key={cc}
                            type="button"
                            disabled={readOnly}
                            onClick={() =>
                              patch(e.code, {
                                countries: on
                                  ? e.countries.filter((x) => x !== cc)
                                  : [...e.countries, cc],
                              })
                            }
                            aria-pressed={on}
                            title={on ? `Remove ${cc}` : `Distribute in ${cc}`}
                            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] disabled:opacity-60 ${
                              on
                                ? "border-neutral-900 bg-neutral-900 text-white"
                                : "border-neutral-300 bg-white text-neutral-500 hover:border-neutral-900 hover:text-neutral-900"
                            }`}
                          >
                            {cc}
                          </button>
                        );
                      })}
                      {e.countries.length === 0 && (
                        <span className="ml-1 self-center text-[10px] text-amber-800">
                          pick at least one market — none picked behaves like “None”
                        </span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
