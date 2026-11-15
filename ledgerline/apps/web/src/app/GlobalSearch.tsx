import type { EntityRef } from '@ledgerline/contracts';
import { encodeViewDiff, EntityPicker } from '@ledgerline/ui';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { rememberEntity, searchEntities } from '../api/client';

/**
 * Global entity search in the top bar: the Entity Picker in search mode (SPEC 6, 7.3).
 * Choosing a portfolio or security opens Transactions filtered to it. The filter shows as a removable tag.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const search = useCallback(async (q: string, options: { includeInactive: boolean }) => {
    const [portfolios, securities] = await Promise.all([
      searchEntities('portfolio', q, options),
      searchEntities('security', q, options),
    ]);
    // Exact identifier matches first, whatever the kind.
    return [...portfolios, ...securities].sort(
      (a, b) => Number(Boolean(b.matchedOn)) - Number(Boolean(a.matchedOn)),
    );
  }, []);

  const open = (ref: EntityRef | null) => {
    if (!ref) return;
    void rememberEntity(ref);
    const field = ref.kind === 'portfolio' ? 'portfolioId' : 'securityId';
    const d = encodeViewDiff({ filters: [{ field, op: 'eq', value: ref.id }] });
    // The nonce makes Transactions re-read the link even when it is already open.
    void navigate(`/transactions?view=V-transactions-default&d=${d}`, {
      state: { nonce: `${ref.id}-${Date.now()}` },
    });
  };

  return (
    <EntityPicker
      label="Search portfolios and securities"
      hideLabel
      clearOnSelect
      className="w-80"
      value={null}
      onChange={open}
      search={search}
      placeholder="Search portfolios and securities"
    />
  );
}
