import type { FilterCondition } from '@ledgerline/contracts';
import { cn } from '../lib/cn';
import { filterEquals } from './view-state';

export interface TaskChip {
  id: string;
  label: string;
  /** The condition this chip adds. It also appears as a filter tag: a chip is a shortcut, never a hidden filter. */
  filter: FilterCondition;
}

export interface TaskChipsProps {
  chips: TaskChip[];
  filters: FilterCondition[];
  onChange: (filters: FilterCondition[]) => void;
  className?: string;
}

/** One-click filters for common tasks, e.g. "Warnings only", "My records", "Today" (SPEC 7.2). */
export function TaskChips({ chips, filters, onChange, className }: TaskChipsProps) {
  return (
    <div
      role="group"
      aria-label="Quick filters"
      data-slot="task-chips"
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      {chips.map((chip) => {
        const active = filters.some((f) => filterEquals(f, chip.filter));
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={active}
            onClick={() =>
              onChange(
                active ? filters.filter((f) => !filterEquals(f, chip.filter)) : [...filters, chip.filter],
              )
            }
            className={cn(
              'h-6 rounded-full border px-2.5 text-xs transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-card text-foreground hover:bg-accent',
            )}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
