import { ContextMenu as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

export function ContextMenu(props: ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root data-slot="context-menu" {...props} />;
}

export function ContextMenuTrigger(props: ComponentProps<typeof Primitive.Trigger>) {
  return <Primitive.Trigger data-slot="context-menu-trigger" {...props} />;
}

export function ContextMenuContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        data-slot="context-menu-content"
        className={cn(
          'z-50 max-h-(--radix-context-menu-content-available-height) min-w-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-popover',
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}

export function ContextMenuItem({ className, ...props }: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      data-slot="context-menu-item"
      className={cn(
        'relative flex min-h-(--ll-control-height) cursor-default items-center gap-2 rounded-sm px-2 text-body outline-hidden select-none focus:bg-accent focus:text-accent-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function ContextMenuSeparator({ className, ...props }: ComponentProps<typeof Primitive.Separator>) {
  return (
    <Primitive.Separator
      data-slot="context-menu-separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

export function ContextMenuLabel({ className, ...props }: ComponentProps<typeof Primitive.Label>) {
  return (
    <Primitive.Label
      className={cn(
        'px-2 py-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase',
        className,
      )}
      {...props}
    />
  );
}
