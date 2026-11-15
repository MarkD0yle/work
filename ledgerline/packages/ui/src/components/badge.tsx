import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

/** Exported so plain-DOM grid cells get exactly the same classes as the React component. */
export const badgeVariants = cva(
  'inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-sm border px-1.5 text-2xs font-medium whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      /** Status is carried by the label text; colour only reinforces it. */
      status: {
        neutral: 'border-border bg-muted text-neutral',
        good: 'border-good/40 bg-good/10 text-good',
        warning: 'border-warning/40 bg-warning/10 text-warning',
        critical: 'border-critical/40 bg-critical/10 text-critical',
        info: 'border-info/40 bg-info/10 text-info',
      },
    },
    defaultVariants: { status: 'neutral' },
  },
);

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, status, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ status }), className)} {...props} />;
}
