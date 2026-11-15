import type { EntityRef, EntitySearchResult } from '@ledgerline/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../components/button';
import { EntityPicker } from './entity-picker';
import { EntityPickerSheet, type EntityCriteria } from './entity-picker-sheet';

const meta: Meta = { title: 'Picker/Entity Picker' };
export default meta;
type Story = StoryObj;

const sec = (
  n: number,
  description: string,
  type: string,
  currency: string,
  parent: string,
  over: Partial<EntitySearchResult> = {},
): EntitySearchResult => ({
  ref: {
    kind: 'security',
    id: `S-${String(n).padStart(7, '0')}`,
    label: description,
    altIds: { isin: `US${String(912828000 + n)}5` },
  },
  description,
  type,
  currency,
  status: 'active',
  parent,
  ...over,
});
const universe: EntitySearchResult[] = [
  sec(1, 'US TREASURY N/B 3.875% 2031-05-15', 'govt', 'USD', 'US TREASURY'),
  sec(2, 'US TREASURY N/B 4.250% 2034-11-15', 'govt', 'USD', 'US TREASURY'),
  sec(3, 'UK TSY GILT 4.250% 2034-06-07', 'govt', 'GBP', 'UK TREASURY'),
  sec(4, 'APPLE INC ORD', 'equity', 'USD', 'APPLE INC'),
  sec(5, 'OLD CORP 5.000% 2020-01-15', 'corporate', 'USD', 'OLD CORP', { status: 'inactive' }),
  {
    ref: { kind: 'portfolio', id: 'P-0001', label: 'Lakeside General Account USD' },
    description: 'Lakeside General Account USD',
    type: 'generalAccount',
    currency: 'USD',
    status: 'active',
    parent: 'Harbour Asset Management',
    restricted: { reason: 'Outside your account scope.' },
  },
];

const find = async (
  q: string,
  o: { includeInactive: boolean; type?: string; currency?: string },
): Promise<EntitySearchResult[]> => {
  const text = q.toUpperCase();
  return universe
    .filter((r) => o.includeInactive || r.status === 'active')
    .filter((r) => (!o.type || r.type === o.type) && (!o.currency || r.currency === o.currency))
    .filter(
      (r) =>
        r.description.includes(text) || r.ref.id === text || Object.values(r.ref.altIds ?? {}).includes(text),
    )
    .map((r) => (r.ref.altIds?.isin === text ? { ...r, matchedOn: 'isin' } : r));
};

function InlineDemo({ initial = null, recent }: { initial?: EntityRef | null; recent?: boolean }) {
  const [value, setValue] = useState<EntityRef | null>(initial);
  return (
    <div className="h-96 w-96">
      <EntityPicker
        label="Security"
        value={value}
        onChange={setValue}
        search={find}
        {...(recent ? { recent: async () => universe.slice(0, 2) } : {})}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Try “treasury”, “la” (restricted), “old” with Show inactive, or paste US9128280015.
      </p>
    </div>
  );
}

export const Inline: Story = { render: () => <InlineDemo recent /> };
export const InlineWithValue: Story = { render: () => <InlineDemo initial={universe[3]?.ref ?? null} /> };

function SheetDemo() {
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState<EntityRef[]>([]);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Choose several… ({picked.length} chosen)
      </Button>
      <EntityPickerSheet
        open={open}
        onOpenChange={setOpen}
        title="Choose securities"
        search={(q: string, c: EntityCriteria) => find(q, c)}
        types={['govt', 'corporate', 'equity']}
        currencies={['USD', 'GBP']}
        selected={picked}
        onConfirm={setPicked}
      />
    </>
  );
}

/** Sheet mode: criteria search and multi-select. */
export const Sheet: Story = { render: () => <SheetDemo /> };
