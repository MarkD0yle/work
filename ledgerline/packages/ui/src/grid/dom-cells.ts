/**
 * Plain-DOM cell content for the grid.
 *
 * A grid redraws hundreds of cells while scrolling. Mounting a React component per cell made scrolling
 * stutter on large data, so grid cells are built as DOM nodes. They mirror the React components
 * (`FinancialCell`, `Badge`) class for class; `dom-cells.test.tsx` fails if the two drift apart.
 * Interactive parts (the provenance popover) are owned once by `LLGrid`, not per cell.
 */
import type { FinancialValue } from '@ledgerline/contracts';
import { Calculator, Lock, PencilLine, type LucideIcon } from 'lucide-react';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { badgeVariants } from '../components/badge';
import { formatFinancial } from '../financial/format';
import { provenanceSummary } from '../financial/provenance';
import { cn } from '../lib/cn';
import { displayText, formatBusinessDate } from './copy';
import type { LLColumnDef } from './types';

/** Renders a lucide icon to an SVG element once; cells clone it. */
function iconTemplate(Icon: LucideIcon, className: string): SVGElement {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(createElement(Icon, { 'aria-hidden': true, className })));
  // Clone it: React still owns the original and removes it on unmount.
  const svg = (host.firstElementChild as SVGElement).cloneNode(true) as SVGElement;
  root.unmount();
  return svg;
}

// Built when the grid module loads, which is outside any React render.
const ICONS =
  typeof document === 'undefined'
    ? null
    : {
        calculated: iconTemplate(Calculator, 'size-3.5 shrink-0 text-muted-foreground'),
        overridden: iconTemplate(PencilLine, 'size-3.5 shrink-0 text-info'),
        locked: iconTemplate(Lock, 'size-3.5 shrink-0 text-muted-foreground'),
      };

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const MUTED_LABEL = 'font-sans text-2xs text-muted-foreground';

/** Same markup and accessible name as `<FinancialCell inGrid />`. */
export function financialCellElement(value: FinancialValue, qualifier?: string): HTMLElement {
  const f = formatFinancial(value);
  const origin = value.provenance.origin;
  const isNull = f.display !== 'value';
  const flags = [
    origin === 'calculated' ? 'calculated' : null,
    origin === 'overridden' ? 'overridden' : null,
    value.locked ? 'locked' : null,
  ].filter(Boolean);

  const button = el(
    'button',
    cn(
      'tabular flex w-full min-w-0 items-center justify-end gap-1.5 rounded-sm text-right font-mono',
      isNull && 'text-muted-foreground',
    ),
  ) as HTMLButtonElement;
  button.type = 'button';
  button.tabIndex = -1;
  button.dataset.slot = 'financial-cell';
  button.dataset.display = f.display;
  button.dataset.origin = origin;
  if (f.currency) button.dataset.currency = f.currency;
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  button.title = f.tooltip ?? provenanceSummary(value);

  if (ICONS) {
    if (origin === 'calculated') button.append(ICONS.calculated.cloneNode(true));
    if (origin === 'overridden') button.append(ICONS.overridden.cloneNode(true));
    if (value.locked) button.append(ICONS.locked.cloneNode(true));
  }
  if (qualifier) button.append(el('span', MUTED_LABEL, `${qualifier} `));
  if (isNull) button.append(el('span', 'sr-only', f.ariaLabel));
  if (f.negative && value.signConvention === 'accounting') button.append(el('span', 'sr-only', 'minus '));
  const number = el('span', 'truncate', f.text);
  if (isNull) number.setAttribute('aria-hidden', 'true');
  button.append(number, ' ');
  if (f.currency) button.append(el('span', MUTED_LABEL, `${f.currency} `));
  button.append(el('span', 'sr-only', [...flags, 'show provenance'].map((w) => `, ${w}`).join('')));
  return button;
}

/** Content for one cell of any column type. */
export function cellElement<Row>(column: LLColumnDef<Row>, row: Row): HTMLElement {
  switch (column.type) {
    case 'financial':
      return financialCellElement(column.value(row));
    case 'date': {
      const date = column.value(row);
      if (date.value !== null) return el('span', 'tabular', formatBusinessDate(date));
      const none = el('span', 'text-muted-foreground', '—');
      none.setAttribute('aria-label', 'No date');
      return none;
    }
    case 'status': {
      const value = column.value(row);
      const status = column.statuses[value];
      const badge = el('span', badgeVariants({ status: status?.tone ?? 'neutral' }), status?.label ?? value);
      badge.dataset.slot = 'badge';
      return badge;
    }
    case 'entity': {
      const entity = column.value(row);
      if (!entity) {
        const none = el('span');
        none.setAttribute('aria-label', 'None');
        return none;
      }
      const wrap = el('span', 'flex min-w-0 items-baseline gap-2');
      wrap.title = `${entity.label} (${entity.id})`;
      wrap.append(
        el('span', 'truncate', entity.label),
        el('span', 'shrink-0 font-mono text-2xs text-muted-foreground', entity.id),
      );
      return wrap;
    }
    case 'text':
      return el('span', column.mono ? 'font-mono' : undefined, column.value(row) ?? '');
    case 'boolean':
      return el('span', undefined, displayText(column, row));
  }
}

export function placeholderElement(): HTMLElement {
  const node = el('span', 'text-muted-foreground', '…');
  node.setAttribute('aria-label', 'Loading');
  return node;
}
