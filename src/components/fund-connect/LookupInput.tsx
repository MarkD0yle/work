import { useMemo, useState } from "react";
import { masterEntries, type MasterHit, type MasterId } from "../../lib/fundConnect/reference";

/* Search-select against a reference system. Spec §3 — a field with a known
 * value set never gets a free-text box — and §7: the resolved *name* is
 * shown back, because a real-but-wrong code passes every format check. */

export default function LookupInput({
  master,
  value,
  disabled,
  invalid,
  onChange,
}: {
  master: MasterId;
  value: string;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const entries = masterEntries(master);

  const matches = useMemo(() => {
    const q = (query ?? "").trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) => e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q),
    );
  }, [entries, query]);

  function commit(hit: MasterHit) {
    onChange(hit.code);
    setQuery(null);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query ?? value}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onChange(e.target.value.toUpperCase());
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Let a click on an option land before the list closes.
          window.setTimeout(() => {
            setOpen(false);
            setQuery(null);
          }, 120);
        }}
        placeholder="Search code or name"
        className={`w-full rounded-md border px-2.5 py-1.5 font-mono text-sm text-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500 ${
          invalid ? "border-red-400 bg-red-50/40" : "border-neutral-300 bg-white"
        }`}
      />
      {open && !disabled && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg shadow-neutral-900/10">
          {matches.length === 0 && (
            <li className="px-3 py-2 text-xs text-neutral-500">
              Nothing in the {master} master matches.
            </li>
          )}
          {matches.map((hit) => (
            <li key={hit.code}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(hit)}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left hover:bg-neutral-100"
              >
                <span className="font-mono text-xs text-neutral-900">{hit.code}</span>
                <span className="text-[11px] text-neutral-500">
                  {hit.name}
                  {hit.status !== "active" && (
                    <span className="ml-1 text-red-600">· {hit.status}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
