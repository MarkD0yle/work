import type { Me } from '@ledgerline/compositions';
import { ApprovalQueue, AuditGrid, CloseConsole, ExceptionQueue } from '@ledgerline/compositions/accounting';
import type { FilterCondition } from '@ledgerline/contracts';
import { useMemo } from 'react';
import {
  NavLink,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from 'react-router';

const SECTIONS = [
  {
    path: '',
    label: 'Period close',
    blurb: 'Every portfolio for the period: cutoff, checks, what is blocking, and close status.',
  },
  {
    path: 'exceptions',
    label: 'Exceptions',
    blurb: 'Oldest first. Group similar ones, attach evidence to many, and resolve with a root cause.',
  },
  {
    path: 'approvals',
    label: 'Approvals',
    blurb: 'Reopens and close-block overrides waiting for a second person.',
  },
  { path: 'audit', label: 'Audit history', blurb: 'Every change, who made it and why. Read only.' },
] as const;

/** Accounting: the close console and what it depends on (exceptions, approvals, audit), one click apart. */
export function Accounting() {
  const me = useOutletContext<Me>();
  const navigate = useNavigate();
  const location = useLocation();
  const { section = '' } = useParams();
  const [params] = useSearchParams();
  const current = SECTIONS.find((s) => s.path === section);
  // The close console links here with a portfolio: its open high-severity exceptions.
  const portfolio = params.get('portfolio');
  const period = params.get('period');
  const filters = useMemo<FilterCondition[]>(
    () =>
      portfolio
        ? [
            { field: 'portfolioId', op: 'eq', value: portfolio },
            ...(period ? [{ field: 'periodEnd', op: 'eq' as const, value: period }] : []),
            { field: 'severity', op: 'eq', value: 'high' },
            { field: 'status', op: 'in', value: ['new', 'inProgress', 'waitingOnOthers'] },
          ]
        : [{ field: 'status', op: 'in', value: ['new', 'inProgress', 'waitingOnOthers'] }],
    [portfolio, period],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-3 py-2">
      <header className="shrink-0">
        <h1 className="text-base font-semibold tracking-tight">Accounting</h1>
        <nav aria-label="Accounting sections" className="mt-2 flex gap-1 border-b">
          {SECTIONS.map((s) => (
            <NavLink
              key={s.path}
              to={`/accounting${s.path ? `/${s.path}` : ''}`}
              end
              className={({ isActive }) =>
                `-mb-px border-b-2 px-3 py-1.5 font-medium ${isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-2 text-muted-foreground">
          {current?.blurb ?? 'There is no such section. Choose one above.'}
        </p>
      </header>
      <div className="min-h-0 flex-1">
        {section === '' ? (
          <CloseConsole
            me={me}
            onOpenExceptions={(portfolioId, periodEnd) =>
              void navigate(`/accounting/exceptions?portfolio=${portfolioId}&period=${periodEnd}`)
            }
          />
        ) : section === 'exceptions' ? (
          // Keyed by the link, so arriving from another portfolio starts from that portfolio's filters.
          <ExceptionQueue key={location.search} me={me} initialFilters={filters} />
        ) : section === 'approvals' ? (
          <ApprovalQueue me={me} />
        ) : section === 'audit' ? (
          <AuditGrid me={me} />
        ) : null}
      </div>
    </div>
  );
}
