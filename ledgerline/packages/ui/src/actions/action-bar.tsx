import { Ellipsis } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { Button } from '../components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/tooltip';
import { cn } from '../lib/cn';
import { formatShortcut, layoutActions, type ResolvedAction } from './registry';

/** Text of an action wherever it appears: the same label and the same shortcut on every surface. */
export function ActionLabel<Row>({ action }: { action: ResolvedAction<Row> }) {
  return (
    <>
      <span>{action.def.label}</span>{' '}
      {action.def.shortcut ? (
        <kbd data-slot="action-shortcut" className="ml-auto pl-6 font-sans text-2xs text-muted-foreground">
          {formatShortcut(action.def.shortcut)}
        </kbd>
      ) : null}
    </>
  );
}

interface MenuParts {
  Item: ComponentType<{
    onSelect?: (event: Event) => void;
    className?: string;
    children?: ReactNode;
    'aria-disabled'?: boolean | undefined;
    'data-action-id'?: string;
  }>;
  Separator: ComponentType<object>;
}

/**
 * Menu items for a list of actions. The same list is rendered into the overflow menu, the row-actions
 * menu and the context menu, so they can never disagree.
 * An unavailable action stays in the menu, can be focused, and shows why it is unavailable.
 */
export function ActionMenuItems<Row>({
  actions,
  onRun,
  parts,
}: {
  actions: ResolvedAction<Row>[];
  onRun: (action: ResolvedAction<Row>) => void;
  parts: MenuParts;
}) {
  const { Item, Separator } = parts;
  const firstDestructive = actions.findIndex((a) => a.def.tier === 'destructive');
  return (
    <>
      {actions.map((action, i) => (
        <div key={action.def.id} role="presentation">
          {i === firstDestructive && i > 0 ? <Separator /> : null}
          <Item
            data-action-id={action.def.id}
            aria-disabled={!action.enabled || undefined}
            className={cn('flex-col items-stretch gap-0 py-1', !action.enabled && 'cursor-not-allowed')}
            onSelect={(event) => {
              if (action.enabled) onRun(action);
              // A disabled action keeps the menu open so its reason can be read.
              else event.preventDefault();
            }}
          >
            <span
              className={cn(
                'flex items-center gap-2',
                !action.enabled && 'text-muted-foreground',
                action.enabled && action.def.tier === 'destructive' && 'text-critical',
              )}
            >
              <ActionLabel action={action} />
            </span>
            {!action.enabled ? <span className="text-2xs text-muted-foreground">{action.reason}</span> : null}
          </Item>
        </div>
      ))}
    </>
  );
}

const dropdownParts: MenuParts = {
  Item: DropdownMenuItem as MenuParts['Item'],
  Separator: DropdownMenuSeparator,
};

export interface ActionBarProps<Row> {
  actions: ResolvedAction<Row>[];
  onRun: (action: ResolvedAction<Row>) => void;
  /** Accessible name of the group, e.g. "Actions for selected transactions". */
  label: string;
  /** How many actions show as buttons. The spec caps this at 3. */
  max?: number;
  className?: string;
}

/**
 * Contextual actions as buttons, with the rest in a "More actions" menu (SPEC 7.8).
 * A disabled button is still focusable and gives its reason on hover and on focus.
 */
export function ActionBar<Row>({ actions, onRun, label, max = 3, className }: ActionBarProps<Row>) {
  const { visible, overflow } = layoutActions(actions, Math.min(max, 3));
  if (actions.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="action-bar"
      className={cn('flex items-center gap-2', className)}
    >
      {visible.map((action) => {
        const destructive = action.def.tier === 'destructive';
        const button = (
          <Button
            key={action.def.id}
            data-action-id={action.def.id}
            variant={action.def.tier === 'primary' ? 'default' : 'secondary'}
            // Not the `disabled` attribute: a disabled button cannot take focus, so it could not say why.
            aria-disabled={!action.enabled || undefined}
            className={cn(destructive && 'border-critical/60 text-critical hover:bg-critical/10')}
            onClick={() => action.enabled && onRun(action)}
          >
            <span>{action.def.label}</span>{' '}
            {action.def.shortcut ? (
              <kbd className="font-sans text-2xs">{formatShortcut(action.def.shortcut)}</kbd>
            ) : null}
          </Button>
        );
        return action.enabled ? (
          button
        ) : (
          <Tooltip key={action.def.id}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>
              {action.def.label} is not available. {action.reason}
            </TooltipContent>
          </Tooltip>
        );
      })}
      {overflow.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" aria-label="More actions">
              <Ellipsis aria-hidden />
              More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-64">
            <ActionMenuItems actions={overflow} onRun={onRun} parts={dropdownParts} />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
