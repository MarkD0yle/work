import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/tooltip';

/** Plain-language definitions of domain terms (SPEC 7.7). Keys are lower case. */
export const GLOSSARY: Record<string, string> = {
  'trade date': 'The day the deal was agreed. It decides which accounting period the transaction falls in.',
  'settle date':
    'The day cash and securities actually change hands, usually a few business days after the trade date.',
  'settlement date':
    'The day cash and securities actually change hands, usually a few business days after the trade date.',
  unposted: 'Entered but not yet in the ledger. It can still be edited or deleted.',
  posted:
    'Recorded in the ledger. It can no longer be edited; to correct it, reverse it and enter a new one.',
  reversed: 'Cancelled by an equal and opposite entry. Both stay in the history.',
  reverse: 'Cancel a posted transaction with an equal and opposite entry. Both stay in the history.',
  override: 'Replacing a calculated value by hand. It needs a reason and the original value is kept.',
  'vendor price': 'The price supplied by a market data vendor, used to check the price on the trade.',
  tolerance: 'How far a value may differ from its comparison before someone must review it.',
  'closed period':
    'An accounting period that has been signed off. Nothing new can be entered in it until it is reopened.',
  period:
    'A month of accounting. Once a period is closed, nothing new can be entered in it until it is reopened.',
  provenance: 'Where a value came from: entered, imported, calculated, from a vendor, or overridden.',
  'original face': 'The principal amount of a bond when it was issued, before any repayments.',
  accrued: 'Interest earned since the last coupon payment but not yet paid.',
  'amortised cost': 'What was paid for a bond, adjusted over time towards the amount repaid at maturity.',
  basis: 'Which kind of date or cost a number is measured on, for example trade date or settle date.',
};

interface GlossaryContextValue {
  terms: Record<string, string>;
  seen: ReadonlySet<string>;
  markSeen: (term: string) => void;
}
const GlossaryContext = createContext<GlossaryContextValue | null>(null);

const STORAGE_KEY = 'll-glossary-seen';
function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export interface GlossaryProviderProps {
  /** Switch on for users flagged as new. When off, terms render as plain text. */
  enabled: boolean;
  terms?: Record<string, string>;
  children: ReactNode;
}

/**
 * Offers a definition on domain terms for new users. A term keeps its tooltip until the user has opened it
 * once in this browser session; after that it reads as plain text, so the help fades as the user learns.
 */
export function GlossaryProvider({ enabled, terms = GLOSSARY, children }: GlossaryProviderProps) {
  const [seen, setSeen] = useState(readSeen);
  const value = useMemo<GlossaryContextValue | null>(
    () =>
      enabled
        ? {
            terms,
            seen,
            markSeen: (term) =>
              setSeen((prev) => {
                if (prev.has(term)) return prev;
                const next = new Set(prev).add(term);
                try {
                  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
                } catch {
                  // Private browsing can refuse storage; the tooltip then simply stays available.
                }
                return next;
              }),
          }
        : null,
    [enabled, terms, seen],
  );
  return <GlossaryContext.Provider value={value}>{children}</GlossaryContext.Provider>;
}

export interface GlossaryTermProps {
  /** The glossary key. Defaults to the visible text. */
  term?: string;
  children: string;
}

/** A domain term. For new users it is a button that shows the definition on hover or focus. */
export function GlossaryTerm({ term, children }: GlossaryTermProps) {
  const glossary = useContext(GlossaryContext);
  const key = (term ?? children).toLowerCase();
  const definition = glossary?.terms[key];
  // The term stays a button while its tooltip is open, even though opening it marks it as seen.
  const [open, setOpen] = useState(false);
  if (!glossary || !definition || (glossary.seen.has(key) && !open)) return <>{children}</>;
  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) glossary.markSeen(key);
      }}
    >
      <TooltipTrigger asChild>
        <button
          type="button"
          data-slot="glossary-term"
          className="cursor-help rounded-sm underline decoration-dotted underline-offset-2"
          aria-label={`${children}: show definition`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{definition}</TooltipContent>
    </Tooltip>
  );
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Text with the first use of each known term turned into a `GlossaryTerm`. Plain text when the glossary is off. */
export function GlossaryText({ text }: { text: string }) {
  const glossary = useContext(GlossaryContext);
  const parts = useMemo(() => {
    if (!glossary) return null;
    // Longest terms first, so "settle date" wins over "date"-like shorter keys.
    const keys = Object.keys(glossary.terms).sort((a, b) => b.length - a.length);
    const pattern = new RegExp(`\\b(${keys.map(escape).join('|')})\\b`, 'gi');
    const used = new Set<string>();
    const out: (string | { term: string; text: string })[] = [];
    let last = 0;
    for (const match of text.matchAll(pattern)) {
      const key = match[0].toLowerCase();
      if (used.has(key)) continue;
      used.add(key);
      out.push(text.slice(last, match.index), { term: key, text: match[0] });
      last = match.index + match[0].length;
    }
    out.push(text.slice(last));
    return out;
  }, [glossary, text]);
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : (
          <GlossaryTerm key={i} term={part.term}>
            {part.text}
          </GlossaryTerm>
        ),
      )}
    </>
  );
}
