import { Button } from '@ledgerline/ui';
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

export interface SidePanelProps {
  /** Names the panel for assistive technology, e.g. "Exception detail". */
  label: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** A wider panel, for content with a table in it. */
  wide?: boolean;
}

/** The detail panel beside a grid. Focus moves to its heading when it opens; Escape closes it. */
export function SidePanel({ label, title, onClose, children, wide }: SidePanelProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [title]);
  return (
    <aside
      aria-label={label}
      data-slot="side-panel"
      className={`flex shrink-0 flex-col border-l bg-card ${wide ? 'w-xl' : 'w-96'}`}
      onKeyDown={(e) => {
        if (
          e.key === 'Escape' &&
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement) &&
          !(e.target instanceof HTMLSelectElement)
        )
          onClose();
      }}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <h2 ref={heading} tabIndex={-1} className="min-w-0 flex-1 truncate font-semibold outline-hidden">
          {title}
        </h2>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
          <X aria-hidden />
        </Button>
      </header>
      {children}
    </aside>
  );
}
