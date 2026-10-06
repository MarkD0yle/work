import { useCallback, useState } from "react";
import { GROUPS, type OrderConfig } from "./model";

/* Per-accordion record lists. Starts empty — the table shows headers only
 * until the first record is saved. Upsert replaces by id, so the same call
 * serves "add" and "edit". */
export function useGroupRecords() {
  const [records, setRecords] = useState<Record<string, OrderConfig[]>>(() =>
    Object.fromEntries(GROUPS.map((g) => [g.id, [] as OrderConfig[]])),
  );

  const upsert = useCallback((groupId: string, record: OrderConfig) => {
    setRecords((prev) => {
      const list = prev[groupId] ?? [];
      const exists = list.some((r) => r.id === record.id);
      return {
        ...prev,
        [groupId]: exists
          ? list.map((r) => (r.id === record.id ? record : r))
          : [record, ...list],
      };
    });
  }, []);

  return { records, upsert };
}
