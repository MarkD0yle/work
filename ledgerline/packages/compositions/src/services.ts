/**
 * What compositions need from the app that hosts them: a way to call the API and a place to send analytics.
 * The app wires these once at start-up (`configureServices`). Compositions never import the app, so the
 * same blotter works in the workbench, in a pop-out window and in a test.
 */
import type {
  AccountingPeriod,
  ApprovalRequest,
  CloseChecklist,
  CloseSignOff,
  CloseType,
  Comparison,
  ExceptionRecord,
  PeriodOverviewRow,
  PositionRow,
  Statement,
  PriceRow,
  RecurringBreakRule,
  ToleranceImpact,
  ToleranceRule,
  AuditEvent,
  BulkResult,
  EntityKind,
  EntityRef,
  EntitySearchResult,
  ImportCommit,
  ImportMapping,
  ImportRequest,
  ImportRowResult,
  Job,
  GridQuery,
  GridResponse,
  MarketCalendar,
  Message,
  MutationResult,
  Permission,
  SavedView,
  TransactionCreate,
  TransactionRow,
  User,
} from '@ledgerline/contracts';
import type { DensityName as ContractDensity } from '@ledgerline/ui';

export interface Services {
  /** Calls the API. Rejects with an error that carries `status`, `messages` and the response `body`. */
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  track: (event: string, properties?: Record<string, unknown>) => void;
  /** Applies a density chosen on a screen (from a saved view or the grid menu). */
  setDensity: (density: ContractDensity) => void;
  /** Opens a server-sent event stream as the signed-in user. */
  openStream: (path: string) => EventSource;
  /** Fetches a file as the signed-in user and hands it to the browser to save. */
  download: (path: string, fallbackName: string) => Promise<void>;
}

let services: Services | null = null;
export function configureServices(next: Services): void {
  services = next;
}
const wired = (): Services => {
  if (!services) throw new Error('configureServices() must be called before a composition is used.');
  return services;
};

export const request = <T>(path: string, init?: RequestInit) => wired().request<T>(path, init);
export const track = (event: string, properties: Record<string, unknown> = {}) =>
  wired().track(event, properties);
export const setDensity = (density: ContractDensity) => wired().setDensity(density);
export const openStream = (path: string) => wired().openStream(path);
export const download = (path: string, fallbackName: string) => wired().download(path, fallbackName);

/** Saves text the browser already holds (an exported result list) as a file. */
export function saveText(name: string, text: string, type = 'text/csv'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** The parts of a failed API call that screens show. Null when the error is not from the API. */
export interface Problem {
  status: number;
  messages: Message[];
  body: Record<string, unknown>;
}
export function problemOf(error: unknown): Problem | null {
  const e = error as Partial<Problem> | null;
  return e && typeof e.status === 'number' && Array.isArray(e.messages)
    ? { status: e.status, messages: e.messages, body: e.body ?? {} }
    : null;
}

export interface Me {
  user: User;
  startupWorkspaces: { id: string; name: string }[];
  /** The engine's business date. Date shortcuts count from here, not from the browser clock. */
  businessDate: string;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
export const post = <T>(path: string, body: unknown) => request<T>(path, json('POST', body));
export const put = <T>(path: string, body: unknown) => request<T>(path, json('PUT', body));
export const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

export const fetchPermissions = () => request<Permission[]>('/me/permissions');

// ── Saved views ──
export type SavedViewInput = Pick<SavedView, 'gridId' | 'name' | 'ownership' | 'state' | 'schemaVersion'>;
export const fetchViews = (gridId: string) =>
  request<SavedView[]>(`/views?gridId=${encodeURIComponent(gridId)}`);
export const createView = (input: SavedViewInput) => post<MutationResult<SavedView>>('/views', input);
export const updateView = (id: string, input: SavedViewInput) =>
  put<MutationResult<SavedView>>(`/views/${id}`, input);
export const deleteView = (id: string) => del<unknown>(`/views/${id}`);

// ── Entities, periods, calendars ──
export interface EntitySearchOptions {
  includeInactive?: boolean;
  scope?: 'held';
  type?: string;
  currency?: string;
}
export function searchEntities(
  kind: EntityKind,
  q: string,
  options: EntitySearchOptions = {},
): Promise<EntitySearchResult[]> {
  const params = new URLSearchParams({ kind, q });
  if (options.includeInactive) params.set('includeInactive', 'true');
  if (options.scope) params.set('scope', options.scope);
  if (options.type) params.set('type', options.type);
  if (options.currency) params.set('currency', options.currency);
  return request<EntitySearchResult[]>(`/entities/search?${params.toString()}`);
}
export const recentEntities = (kind: EntityKind) =>
  request<EntitySearchResult[]>(`/entities/recent?kind=${kind}`);
/** Remembers a pick for the recent list. Best effort: a failure here must never block the user's choice. */
export const rememberEntity = (ref: EntityRef) =>
  post<unknown>('/entities/recent', { kind: ref.kind, id: ref.id }).catch(() => undefined);
export const fetchPeriods = (portfolioId: string) =>
  request<AccountingPeriod[]>(`/periods?portfolioId=${encodeURIComponent(portfolioId)}`);
export const fetchCalendar = (market: string) =>
  request<MarketCalendar>(`/calendars/${encodeURIComponent(market)}`);

// ── Transactions: entry, audit and import ──
export const createTransaction = (input: TransactionCreate) =>
  post<MutationResult<TransactionRow>>('/transactions', input);
export const fetchRecordAudit = (type: string, id: string) =>
  request<AuditEvent[]>(`/audit/record/${type}/${encodeURIComponent(id)}`);
export const validateImport = (input: ImportRequest) => post<ImportRowResult[]>('/imports/validate', input);
export const commitImport = (input: ImportCommit) => post<BulkResult>('/imports/commit', input);
export const fetchImportMapping = (targetType: ImportMapping['targetType']) =>
  request<ImportMapping | null>(`/imports/mappings/${targetType}`);

// ── Jobs and reports ──
export const queryJobs = (query: GridQuery) => post<GridResponse<Job>>('/jobs/query', query);
export const fetchJob = (id: string) => request<Job>(`/jobs/${encodeURIComponent(id)}`);
export const retryJob = (id: string) => post<Job>(`/jobs/${encodeURIComponent(id)}/retry`, {});
export const cancelJob = (id: string) => post<Job>(`/jobs/${encodeURIComponent(id)}/cancel`, {});
export interface ReportDef {
  id: string;
  name: string;
  description: string;
}
export const fetchReports = () => request<ReportDef[]>('/reports');
export const runReport = (id: string, input: { asOf?: string; portfolioIds?: string[] }) =>
  post<Job>(`/reports/${encodeURIComponent(id)}/run`, input);

// ── Exceptions ──
export const queryExceptions = (query: GridQuery) =>
  post<GridResponse<ExceptionRecord>>('/exceptions/query', query);
export const fetchException = (id: string) =>
  request<ExceptionRecord>(`/exceptions/${encodeURIComponent(id)}`);
export const addExceptionComment = (id: string, text: string) =>
  post<ExceptionRecord>(`/exceptions/${encodeURIComponent(id)}/thread`, { text });
export interface ExceptionInputs {
  note?: string;
  rootCauseCategory?: string;
  ownerId?: string;
  challengeRef?: string;
  evidence?: { name: string };
}
export const exceptionBulk = (actionId: string, ids: string[], inputs: ExceptionInputs = {}) =>
  post<BulkResult>('/exceptions/bulk', { actionId, ids, inputs });
export const fetchRootCauses = () => request<{ id: string; label: string }[]>('/exceptions/root-causes');
export const fetchBreakRules = () => request<RecurringBreakRule[]>('/exceptions/rules');
export type BreakRuleInput = Pick<RecurringBreakRule, 'name' | 'match' | 'rootCauseCategory'>;
export const createBreakRule = (input: BreakRuleInput) =>
  post<RecurringBreakRule>('/exceptions/rules', input);
export const applyBreakRule = (id: string) =>
  post<{ tagged: string[] }>(`/exceptions/rules/${encodeURIComponent(id)}/apply`, {});
export const deleteBreakRule = (id: string) => del<unknown>(`/exceptions/rules/${encodeURIComponent(id)}`);
export const fetchUsers = () => request<User[]>('/users');

// ── Period close ──
export const fetchCloseOverview = (periodEnd: string | null, scope: 'mine' | 'all') =>
  request<PeriodOverviewRow[]>(
    `/periods/overview?scope=${scope}${periodEnd ? `&periodEnd=${periodEnd}` : ''}`,
  );
export const fetchChecklist = (periodId: string) =>
  request<CloseChecklist>(`/periods/${encodeURIComponent(periodId)}/checklist`);
export const closePeriods = (portfolioIds: string[], periodEnd: string, closeTypes?: CloseType[]) =>
  post<Job>('/periods/close', { portfolioIds, periodEnd, ...(closeTypes ? { closeTypes } : {}) });
export const requestBlockOverride = (periodId: string, reason: string) =>
  post<ApprovalRequest>(`/periods/${encodeURIComponent(periodId)}/override-block`, { reason });
export const requestReopen = (periodId: string, reason: string, closeTypes?: CloseType[]) =>
  post<ApprovalRequest>('/periods/reopen', { periodId, reason, ...(closeTypes ? { closeTypes } : {}) });
export const signOffPeriod = (periodId: string, note: string) =>
  post<CloseSignOff>(`/periods/${encodeURIComponent(periodId)}/signoff`, { note });
export const createClosePackage = (periodId: string) =>
  post<Job>(`/periods/${encodeURIComponent(periodId)}/package`, {});
export const fetchBooksComparison = (portfolioId: string) =>
  post<Comparison>('/comparisons', { kind: 'books', portfolioId });

// ── Approvals ──
export const queryApprovals = (query: GridQuery) =>
  post<GridResponse<ApprovalRequest>>('/approvals/query', query);
export const decideApproval = (id: string, decision: 'approve' | 'reject', note: string) =>
  post<ApprovalRequest>(`/approvals/${encodeURIComponent(id)}/decide`, {
    decision,
    ...(note ? { note } : {}),
  });
export const decideApprovals = (ids: string[], decision: 'approve' | 'reject', note: string) =>
  post<BulkResult>('/approvals/decide', { ids, decision, ...(note ? { note } : {}) });

// ── Price review ──
export const queryPrices = (query: GridQuery) => post<GridResponse<PriceRow>>('/prices/query', query);
export const fetchTolerances = () => request<ToleranceRule[]>('/prices/tolerances');
export type ToleranceEdit = Pick<ToleranceRule, 'id' | 'threshold' | 'holidayAware'>;
export const previewTolerances = (rules: ToleranceEdit[]) =>
  post<ToleranceImpact>('/prices/tolerances/impact', { rules });
export const saveTolerances = (rules: ToleranceEdit[]) =>
  put<ToleranceRule[]>('/prices/tolerances', { rules });

// ── Audit ──
export const queryAudit = (query: GridQuery) => post<GridResponse<AuditEvent>>('/audit/query', query);

// ── Admin ──
export const fetchAdminUsers = () => request<User[]>('/admin/users');
export const updateAdminUser = (
  id: string,
  input: { blotterScope?: string[] | null; defaultDensity?: User['defaultDensity'] },
) => put<User>(`/admin/users/${encodeURIComponent(id)}`, input);
export const fetchUserPermissions = (id: string) =>
  request<Permission[]>(`/admin/users/${encodeURIComponent(id)}/permissions`);
export const updateUserPermissions = (
  id: string,
  changes: { action: string; accessLevel: Permission['accessLevel'] }[],
) => put<Permission[]>(`/admin/users/${encodeURIComponent(id)}/permissions`, { changes });

// ── Client home ──
export const queryPositions = (query: GridQuery) =>
  post<GridResponse<PositionRow>>('/positions/query', query);
export const fetchStatements = () => request<Statement[]>('/statements');
