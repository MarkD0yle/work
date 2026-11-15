import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

const field = [
  'w-full min-w-0 rounded-md border border-input bg-card px-(--ll-padding-x) text-body text-foreground',
  'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
  'aria-invalid:border-critical read-only:bg-muted',
];

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(field, 'h-(--ll-control-height)', className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(field, 'min-h-16 py-1.5', className)} {...props} />;
}

/** A native select: the browser's own list, which works with every keyboard and screen reader. For short, fixed lists. */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select data-slot="select" className={cn(field, 'h-(--ll-control-height)', className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label data-slot="label" className={cn('text-xs font-medium text-foreground', className)} {...props} />
  );
}
