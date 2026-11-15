import type { FilterCondition, SavedView } from '@ledgerline/contracts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Toaster, toast } from '../components/toaster';
import { TaskChips } from './task-chips';
import { ViewSelector } from './view-selector';

const meta: Meta = { title: 'Views/Saved views' };
export default meta;
type Story = StoryObj;

const ada = { type: 'user', id: 'u-ada', name: 'Ada' } as const;
const ben = { type: 'user', id: 'u-ben', name: 'Ben' } as const;
const view = (id: string, name: string, over: Partial<SavedView> = {}): SavedView => ({
  id,
  gridId: 'transactions',
  name,
  ownership: 'personal',
  owner: ada,
  state: { columns: [], sort: [], filters: [] },
  schemaVersion: 2,
  updatedAt: '',
  ...over,
});
const views = [
  view('default', 'All transactions', { ownership: 'default' }),
  view('yesterday', "Yesterday's unposted trades", {
    ownership: 'shared',
    defaultForTeam: 'Transaction Operations',
  }),
  view('ben', "Ben's checks", { ownership: 'shared', owner: ben }),
  view('mine', 'Big buys'),
];

function SelectorDemo({ start, dirty }: { start: string; dirty: boolean }) {
  const [current, setCurrent] = useState(start);
  return (
    <>
      <ViewSelector
        views={views}
        currentId={current}
        dirty={dirty}
        userId="u-ada"
        onSelect={(v) => setCurrent(v.id)}
        onSave={() => toast('View saved')}
        onSaveAs={({ name }) => toast('View saved', name)}
        onDelete={() => toast('View deleted')}
        onRestoreDefault={() => setCurrent('default')}
      />
      <Toaster />
    </>
  );
}

export const MyViewEdited: Story = { render: () => <SelectorDemo start="mine" dirty /> };
/** Someone else's shared view: it cannot be overwritten, only copied. */
export const SharedViewNotMine: Story = { render: () => <SelectorDemo start="ben" dirty /> };
export const Unchanged: Story = { render: () => <SelectorDemo start="default" dirty={false} /> };

function ChipsDemo() {
  const [filters, setFilters] = useState<FilterCondition[]>([
    { field: 'tradeDate', op: 'relative', period: 'today' },
  ]);
  return (
    <div className="flex flex-col gap-2">
      <TaskChips
        chips={[
          { id: 'warnings', label: 'Warnings only', filter: { field: 'warning', op: 'isNotNull' } },
          { id: 'mine', label: 'My records', filter: { field: 'createdBy', op: 'eq', value: 'u-ada' } },
          { id: 'today', label: 'Today', filter: { field: 'tradeDate', op: 'relative', period: 'today' } },
        ]}
        filters={filters}
        onChange={setFilters}
      />
      <p className="text-xs text-muted-foreground">
        {filters.length} conditions applied. Each also shows as a filter tag on the grid.
      </p>
    </div>
  );
}

export const Chips: Story = { render: () => <ChipsDemo /> };
