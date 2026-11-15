import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { Tone } from './describe';

export const TONE_ICON: Record<Tone, LucideIcon> = {
  neutral: Info,
  info: Info,
  good: CircleCheck,
  warning: TriangleAlert,
  critical: CircleAlert,
};

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-neutral',
  info: 'text-info',
  good: 'text-good',
  warning: 'text-warning',
  critical: 'text-critical',
};

export const TONE_SURFACE: Record<Tone, string> = {
  neutral: 'border-border bg-muted',
  info: 'border-info/40 bg-info/10',
  good: 'border-good/40 bg-good/10',
  warning: 'border-warning/40 bg-warning/10',
  critical: 'border-critical/40 bg-critical/10',
};

export const SEVERITY_TONE = { info: 'info', warning: 'warning', error: 'critical' } as const;
export const SEVERITY_LABEL = { info: 'Info', warning: 'Warning', error: 'Error' } as const;

export function ToneIcon({
  tone,
  busy,
  className,
}: {
  tone: Tone;
  busy?: boolean | undefined;
  className?: string;
}) {
  const Icon = busy ? LoaderCircle : TONE_ICON[tone];
  return (
    <Icon
      aria-hidden
      className={`size-4 shrink-0 ${TONE_TEXT[tone]} ${busy ? 'animate-spin motion-reduce:animate-none' : ''} ${className ?? ''}`}
    />
  );
}
